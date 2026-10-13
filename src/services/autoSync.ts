/**
 * Automatic encrypted cloud backup.
 *
 * - Any change to the vault, loans, hosting, Telegram settings or account settings schedules a
 *   sync ~10s after the last change (bursts of edits become one upload).
 * - Pending changes are sent immediately when the app goes to the background or is locked.
 * - The server refuses to overwrite a newer copy written by another device (revision check);
 *   in that case nothing is lost: syncing pauses and the user chooses which copy to keep.
 * - Offline / server errors retry quietly with back-off. A 403 (username owned by another
 *   account or password changed elsewhere) stops retries, so we never trip the server lockout.
 */
import { ChangeBus } from './changeBus';
import { StorageService } from './storage';

export type AutoSyncStatus =
  | 'disabled'
  | 'idle'
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'conflict'
  | 'error';

export interface AutoSyncState {
  status: AutoSyncStatus;
  lastSyncAt: string | null;
  message?: string;
}

type Listener = (s: AutoSyncState) => void;

const DEBOUNCE_MS = 10_000;
const MIN_INTERVAL_MS = 20_000;
const BACKOFF_MS = [30_000, 60_000, 120_000, 300_000];

export class AutoSyncService {
  private static username: string | null = null;
  private static key: CryptoKey | null = null;
  private static enabled = true;
  private static dirty = false;
  private static inFlight: Promise<void> | null = null;
  private static timer: number | undefined;
  private static lastRunAt = 0;
  private static failures = 0;
  private static blocked = false; // 403 / conflict: wait for the user
  private static unsubscribe: (() => void) | null = null;
  private static listeners = new Set<Listener>();
  private static state: AutoSyncState = { status: 'disabled', lastSyncAt: null };
  /** Called after cloud data replaced local data, so the app can reload what it shows. */
  static onRemoteApplied: (() => void | Promise<void>) | null = null;

  static subscribe(l: Listener): () => void {
    this.listeners.add(l);
    l(this.state);
    return () => this.listeners.delete(l);
  }

  static getState(): AutoSyncState {
    return this.state;
  }

  private static set(next: Partial<AutoSyncState>): void {
    this.state = { ...this.state, ...next };
    this.listeners.forEach((l) => l(this.state));
  }

  static isEnabledFor(settings: { autoCloudSync?: boolean }): boolean {
    return settings.autoCloudSync !== false;
  }

  /** Called right after unlock. */
  static start(username: string, key: CryptoKey, enabled: boolean): void {
    this.reset();
    this.username = username.trim().toLowerCase();
    this.key = key;
    this.enabled = enabled;
    this.unsubscribe = ChangeBus.on((u) => {
      if (u === this.username) this.markDirty();
    });
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('online', this.onOnline);
    this.set({
      status: enabled ? 'idle' : 'disabled',
      lastSyncAt: StorageService.getLastCloudSyncTime(this.username),
      message: undefined,
    });
    if (enabled) void this.checkRemote();
  }

  /** Called on lock: sends anything still pending, then forgets the key. */
  static async stop(): Promise<void> {
    const session = this.key;
    if (this.enabled && this.dirty && !this.blocked) {
      try {
        await this.runSync();
      } catch {
        /* best effort */
      }
    } else if (this.inFlight) {
      await this.inFlight.catch(() => {});
    }
    if (this.key !== session) return; // a new session started meanwhile — leave it alone
    this.reset();
    this.set({ status: 'disabled', lastSyncAt: null, message: undefined });
  }

  private static reset(): void {
    window.clearTimeout(this.timer);
    this.unsubscribe?.();
    this.unsubscribe = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('online', this.onOnline);
    this.username = null;
    this.key = null;
    this.dirty = false;
    this.failures = 0;
    this.blocked = false;
  }

  static setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      window.clearTimeout(this.timer);
      this.set({ status: 'disabled', message: undefined });
    } else if (this.username) {
      this.blocked = false;
      this.set({ status: 'idle', message: undefined });
      void this.checkRemote();
    }
  }

  /** After a master password change the app keeps syncing with the new key. */
  static setKey(key: CryptoKey): void {
    this.key = key;
  }

  private static onVisibility = () => {
    if (document.visibilityState === 'hidden') void AutoSyncService.syncNow();
  };

  private static onOnline = () => {
    if (AutoSyncService.dirty) AutoSyncService.schedule(1_000);
  };

  private static markDirty(): void {
    this.dirty = true;
    if (!this.enabled || this.blocked) return;
    this.set({ status: 'pending' });
    this.schedule(DEBOUNCE_MS);
  }

  private static schedule(delay: number): void {
    window.clearTimeout(this.timer);
    const sinceLast = Date.now() - this.lastRunAt;
    const wait = Math.max(delay, MIN_INTERVAL_MS - sinceLast, 0);
    this.timer = window.setTimeout(() => void this.syncNow(), wait);
  }

  /** Sends pending changes now (also used by the manual "sync" button). */
  static async syncNow(opts: { manual?: boolean } = {}): Promise<void> {
    if (!this.username || !this.key) return;
    if (!opts.manual && (!this.enabled || this.blocked || !this.dirty)) return;
    if (opts.manual) {
      this.blocked = false;
      this.dirty = true;
    }
    await this.runSync();
  }

  private static async runSync(): Promise<void> {
    if (this.inFlight) {
      await this.inFlight.catch(() => {});
      if (!this.dirty) return;
    }
    const username = this.username;
    const key = this.key;
    if (!username || !key) return;

    window.clearTimeout(this.timer);
    this.dirty = false;
    this.lastRunAt = Date.now();
    this.set({ status: 'syncing', message: undefined });

    this.inFlight = (async () => {
      const res = await StorageService.syncVaultToCloud(username, key);
      if (this.username !== username) return; // locked / switched meanwhile

      if (res.success) {
        this.failures = 0;
        this.set({ status: this.dirty ? 'pending' : 'synced', lastSyncAt: res.updatedAt || new Date().toISOString() });
        if (this.dirty) this.schedule(DEBOUNCE_MS);
        return;
      }

      this.dirty = true; // keep the changes marked as unsent
      if (res.conflict) {
        this.blocked = true;
        this.set({ status: 'conflict', message: res.message });
      } else if (res.status === 403) {
        this.blocked = true;
        this.set({ status: 'error', message: res.message });
      } else if (res.status === 404) {
        this.blocked = true;
        this.set({ status: 'error', message: res.message });
      } else {
        const delay = BACKOFF_MS[Math.min(this.failures, BACKOFF_MS.length - 1)];
        this.failures++;
        this.set({
          status: res.status === 0 ? 'offline' : 'error',
          message: res.status === 0 ? 'در انتظار اتصال به اینترنت' : res.message,
        });
        if (res.status === 429) this.schedule(15 * 60_000);
        else this.schedule(delay);
      }
    })();

    try {
      await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  /**
   * On unlock: if the cloud has a newer revision than this device last saw, another device
   * saved changes → ask the user. If there is no cloud copy yet, upload one.
   */
  private static async checkRemote(): Promise<void> {
    const username = this.username;
    if (!username) return;
    const remote = await StorageService.checkCloudBackupAvailable(username);
    if (this.username !== username || !this.enabled) return;

    if (!remote.reachable) {
      this.set({ status: 'offline', message: 'در انتظار اتصال به اینترنت' });
      this.dirty = true;
      this.schedule(BACKOFF_MS[0]);
      return;
    }

    if (!remote.hasBackup) {
      this.dirty = true;
      this.schedule(2_000);
      return;
    }

    const localRev = StorageService.getCloudRevision(username);
    const remoteRev = remote.revision ?? 0;
    if (localRev !== null && remoteRev > localRev) {
      this.blocked = true;
      this.set({ status: 'conflict', message: 'نسخه جدیدتری از دستگاه دیگری در فضای ابری هست.' });
      return;
    }
    if (localRev === null && remoteRev > 0) {
      // This device never synced, but the account has a cloud copy (e.g. another device).
      this.blocked = true;
      this.set({ status: 'conflict', message: 'برای این حساب نسخه‌ای در فضای ابری هست که از دستگاه دیگری ذخیره شده.' });
      return;
    }
    this.set({ status: this.dirty ? 'pending' : 'synced', lastSyncAt: remote.lastSync });
  }

  /** User's choice when the cloud copy is newer. */
  static async resolveConflict(choice: 'use-cloud' | 'use-device'): Promise<{ success: boolean; message: string }> {
    const username = this.username;
    const key = this.key;
    if (!username || !key) return { success: false, message: 'ابتدا وارد گاوصندوق شوید.' };

    this.set({ status: 'syncing', message: undefined });
    if (choice === 'use-cloud') {
      const res = await StorageService.pullCloudIntoLocal(username, key);
      if (res.success) {
        this.blocked = false;
        this.dirty = false;
        this.set({ status: 'synced', lastSyncAt: StorageService.getLastCloudSyncTime(username) });
        await this.onRemoteApplied?.();
      } else {
        this.set({ status: 'conflict', message: res.message });
      }
      return res;
    }

    const res = await StorageService.syncVaultToCloud(username, key, { force: true });
    if (res.success) {
      this.blocked = false;
      this.dirty = false;
      this.set({ status: 'synced', lastSyncAt: res.updatedAt || new Date().toISOString() });
      return { success: true, message: 'نسخه ابری با اطلاعات این دستگاه جایگزین شد.' };
    }
    this.set({ status: 'conflict', message: res.message });
    return { success: false, message: res.message };
  }
}
