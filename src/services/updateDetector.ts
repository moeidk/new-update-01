/**
 * src/services/updateDetector.ts
 * New-version detection for the auto-deployed PWA.
 *
 * Every `git push` to main is deployed to Cloudflare automatically. Open apps learn about the
 * new version in two ways:
 *  1. the service worker finds a new build (checked every 60s and whenever the app regains focus);
 *  2. as a fallback, /version.json on the server is compared with the version baked into this bundle.
 * Both raise the in-app "new version" banner for every user. Nothing reloads without the user's
 * click, so no unsaved edit is lost.
 */
import { registerSW } from 'virtual:pwa-register';

export interface VersionInfo {
  version: string;
  buildTime: string;
  gitCommit: string;
  gitBranch: string;
  environment: string;
  releaseName: string;
  changelog?: string[];
}

declare const __APP_BUILD__: VersionInfo;

type Listener = (state: UpdateState) => void;

export interface UpdateState {
  hasUpdate: boolean;
  remote: VersionInfo | null;
}

const CHECK_INTERVAL_MS = 60_000;

export class UpdateDetectorService {
  static readonly current: VersionInfo =
    typeof __APP_BUILD__ !== 'undefined'
      ? __APP_BUILD__
      : {
          version: '0.0.0',
          buildTime: new Date().toISOString(),
          gitCommit: 'dev',
          gitBranch: 'local',
          environment: 'development',
          releaseName: 'KeepPass (dev)',
        };

  private static state: UpdateState = { hasUpdate: false, remote: null };
  private static listeners = new Set<Listener>();
  private static started = false;
  private static registration: ServiceWorkerRegistration | undefined;
  private static updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
  private static swWaiting = false;

  /** Starts background checks. Safe to call more than once. */
  static start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      this.updateSW = registerSW({
        immediate: true,
        onNeedRefresh: () => {
          this.swWaiting = true;
          this.setState({ hasUpdate: true, remote: this.state.remote });
          void this.fetchRemote().then((remote) => remote && this.setState({ hasUpdate: true, remote }));
        },
        onRegisteredSW: (_url, registration) => {
          this.registration = registration;
        },
      });
    }

    const tick = () => void this.checkForUpdate();
    window.setInterval(tick, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') tick();
    });
    window.addEventListener('online', tick);
    window.setTimeout(tick, 5_000);
  }

  static subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  static getState(): UpdateState {
    return this.state;
  }

  private static setState(next: UpdateState): void {
    this.state = next;
    this.listeners.forEach((l) => l(next));
  }

  static async fetchRemote(): Promise<VersionInfo | null> {
    try {
      const res = await fetch(`/version.json?_cb=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return null;
      return (await res.json()) as VersionInfo;
    } catch {
      return null;
    }
  }

  /** Checks the server for a newer build than the one currently running. */
  static async checkForUpdate(): Promise<UpdateState> {
    try {
      await this.registration?.update();
    } catch {
      /* offline or SW unavailable */
    }

    const remote = await this.fetchRemote();
    const current = this.current;
    const differs =
      !!remote &&
      current.gitCommit !== 'dev' &&
      (remote.gitCommit !== current.gitCommit || remote.buildTime !== current.buildTime);

    if (differs || this.swWaiting) {
      this.setState({ hasUpdate: true, remote: remote ?? this.state.remote });
    }
    return this.state;
  }

  /** Activates the new version and reloads the page. */
  static async applyUpdate(): Promise<void> {
    if (this.updateSW && this.swWaiting) {
      await this.updateSW(true);
      // updateSW reloads once the new worker takes control; fall back just in case.
      window.setTimeout(() => window.location.reload(), 3_000);
      return;
    }
    try {
      await this.registration?.update();
    } catch {
      /* ignore */
    }
    if (this.updateSW && this.registration?.waiting) {
      await this.updateSW(true);
      window.setTimeout(() => window.location.reload(), 3_000);
      return;
    }
    window.location.reload();
  }
}
