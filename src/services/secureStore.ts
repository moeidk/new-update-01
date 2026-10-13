/**
 * Secure Store — encrypted-at-rest storage for per-user data outside the vault
 * (loans, hosting/domains, Telegram bot token & chat id).
 *
 * Previously these were written to localStorage as plain JSON. Now:
 *  - on unlock, `open()` decrypts them into an in-memory cache (and encrypts any legacy
 *    plaintext value it finds — a one-time, automatic migration);
 *  - the rest of the app reads/writes synchronously through `getItem` / `setItem`;
 *  - every write is encrypted with the user's vault key before it touches localStorage;
 *  - on lock, `close()` wipes the cache.
 */
import { CryptoService } from './crypto';
import { ChangeBus } from './changeBus';

const ENC_PREFIX = 'enc:v1:';
const SNAPSHOT_PREFIX = '__keeppass_migration_backup_';

export const secureKeysFor = (username: string) => {
  const u = username.trim().toLowerCase();
  return {
    loans: `keeppass_loans_user_${u}`,
    hosting: `keeppass_hosting_user_${u}`,
    telegram: `keeppass_telegram_user_${u}`,
  };
};

export class SecureStore {
  private static cache = new Map<string, string>();
  private static key: CryptoKey | null = null;
  private static username: string | null = null;
  private static unreadable = new Set<string>();
  private static writeChain: Promise<void> = Promise.resolve();

  static isOpenFor(username: string): boolean {
    return !!this.key && this.username === username.trim().toLowerCase();
  }

  /** Decrypts the user's protected keys into memory and encrypts any legacy plaintext. */
  static async open(username: string, key: CryptoKey): Promise<void> {
    await this.flush();
    this.cache.clear();
    this.unreadable.clear();
    this.key = key;
    this.username = username.trim().toLowerCase();

    const legacyPlainKeys: string[] = [];
    for (const storageKey of Object.values(secureKeysFor(username))) {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) continue;

      if (raw.startsWith(ENC_PREFIX)) {
        try {
          this.cache.set(storageKey, await CryptoService.decrypt(raw.slice(ENC_PREFIX.length), key));
        } catch (err) {
          // Never overwrite data we could not read.
          console.error(`[SecureStore] Could not decrypt ${storageKey}; it will be left untouched.`, err);
          this.unreadable.add(storageKey);
        }
      } else {
        this.cache.set(storageKey, raw);
        legacyPlainKeys.push(storageKey);
      }
    }

    // One-time migration: encrypt legacy plaintext and remove plaintext copies from old snapshots.
    for (const storageKey of legacyPlainKeys) {
      await this.persist(storageKey, this.cache.get(storageKey)!, key);
    }
    if (legacyPlainKeys.length > 0) {
      scrubSnapshots((k) => legacyPlainKeys.includes(k));
    }
  }

  /** Wipes decrypted data from memory (called on lock / user switch). */
  static close(): void {
    this.cache.clear();
    this.unreadable.clear();
    this.key = null;
    this.username = null;
  }

  static getItem(storageKey: string): string | null {
    return this.cache.get(storageKey) ?? null;
  }

  static setItem(storageKey: string, value: string): void {
    if (!this.key) {
      console.error(`[SecureStore] Refusing to write ${storageKey} while the vault is locked.`);
      return;
    }
    if (this.unreadable.has(storageKey)) {
      console.error(`[SecureStore] Refusing to overwrite unreadable encrypted data in ${storageKey}.`);
      return;
    }
    this.cache.set(storageKey, value);
    if (this.username) ChangeBus.emit(this.username);
    const key = this.key;
    this.writeChain = this.writeChain
      .then(() => this.persist(storageKey, value, key))
      .catch((err) => console.error('[SecureStore] Failed to persist encrypted data:', err));
  }

  /** Waits until every pending encrypted write has reached localStorage. */
  static flush(): Promise<void> {
    return this.writeChain;
  }

  /** Re-encrypts every cached value with a new key (master password change). */
  static async rekey(newKey: CryptoKey): Promise<void> {
    await this.flush();
    this.key = newKey;
    for (const [storageKey, value] of this.cache) {
      await this.persist(storageKey, value, newKey);
    }
  }

  private static async persist(storageKey: string, value: string, key: CryptoKey): Promise<void> {
    const encrypted = await CryptoService.encrypt(value, key);
    localStorage.setItem(storageKey, ENC_PREFIX + encrypted);
  }
}

/**
 * Removes matching keys from the localStorage safety snapshots created by DataMigrationService,
 * so no plaintext copy of protected data (or old raw biometric keys) survives there.
 */
export function scrubSnapshots(shouldRemove: (key: string) => boolean): void {
  for (let i = 0; i < localStorage.length; i++) {
    const snapKey = localStorage.key(i);
    if (!snapKey || !snapKey.startsWith(SNAPSHOT_PREFIX)) continue;
    try {
      const snap = JSON.parse(localStorage.getItem(snapKey) || '{}') as Record<string, string>;
      let changed = false;
      for (const k of Object.keys(snap)) {
        if (shouldRemove(k)) {
          delete snap[k];
          changed = true;
        }
      }
      if (changed) localStorage.setItem(snapKey, JSON.stringify(snap));
    } catch {
      /* ignore malformed snapshot */
    }
  }
}
