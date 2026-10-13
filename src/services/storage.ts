/**
 * Storage & Vault Persistence Service with Multi-User Isolation
 */
import { VaultItem, SecuritySettings, UserProfile, LoanItem } from '../types';
import { CryptoService, KDF_ITERATIONS } from './crypto';
import { SecureStore, secureKeysFor, scrubSnapshots } from './secureStore';
import { BiometricKeyStore } from './biometricKeyStore';
import { ChangeBus } from './changeBus';

/** localStorage prefix where older versions stored the RAW vault key (insecure, now removed). */
const LEGACY_BIO_TOKEN_PREFIX = 'keeppass_bio_token_';

const USERS_REGISTRY_KEY = 'keeppass_users_registry_v2';
const ACTIVE_USER_KEY = 'keeppass_active_username_v2';
const SETTINGS_KEY_LEGACY = 'keeppass_settings_v1';
const ENCRYPTED_VAULT_KEY_LEGACY = 'keeppass_vault_v1';
const THEME_KEY = 'keeppass_theme';

export class StorageService {
  /**
   * Initialize or retrieve all registered user profiles
   */
  static getUsers(): UserProfile[] {
    const raw = localStorage.getItem(USERS_REGISTRY_KEY);
    let users: UserProfile[] = [];
    if (raw) {
      try {
        users = JSON.parse(raw);
      } catch {
        users = [];
      }
    }

    // Auto-migrate legacy single user if exists and no users yet in registry
    if (users.length === 0) {
      const legacyRaw = localStorage.getItem(SETTINGS_KEY_LEGACY);
      if (legacyRaw) {
        try {
          const legacySettings: SecuritySettings = JSON.parse(legacyRaw);
          if (legacySettings.isSetup && legacySettings.masterPasswordHash) {
            const defaultUser: UserProfile = {
              id: 'user_default',
              username: 'admin',
              displayName: 'کاربر اصلی',
              createdAt: new Date().toISOString(),
              settings: legacySettings,
            };
            users.push(defaultUser);
            localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(users));

            // Copy legacy vault to user-scoped key
            const legacyVault = localStorage.getItem(ENCRYPTED_VAULT_KEY_LEGACY);
            if (legacyVault) {
              localStorage.setItem(`keeppass_vault_user_admin`, legacyVault);
            }
          }
        } catch {
          // ignore error
        }
      }
    }

    return users;
  }

  /**
   * Retrieves active user's security settings (or default)
   */
  static getSettings(): SecuritySettings {
    const active = this.getActiveUsername();
    if (active) {
      const s = this.getUserSettings(active);
      if (s) return s;
    }
    const users = this.getUsers();
    if (users.length > 0) return users[0].settings;
    return {
      isSetup: false,
      masterPasswordHash: '',
      salt: '',
      biometricEnabled: false,
      biometricType: 'none',
      autoBiometricPrompt: false,
      autoLockMinutes: 5,
    };
  }

  /**
   * Saves updated security settings for the active user
   */
  static saveSettings(settings: SecuritySettings): void {
    const active = this.getActiveUsername();
    if (active) {
      this.saveUserSettings(active, settings);
    } else {
      const users = this.getUsers();
      if (users.length > 0) {
        this.saveUserSettings(users[0].username, settings);
      }
    }
  }

  /**
   * Save users list
   */
  static saveUsers(users: UserProfile[]): void {
    localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(users));
  }

  /**
   * Find a specific user by username (case-insensitive)
   */
  static getUserByUsername(username: string): UserProfile | null {
    const clean = username.trim().toLowerCase();
    const users = this.getUsers();
    return users.find((u) => u.username.toLowerCase() === clean) || null;
  }

  /**
   * Get active/last logged in username
   */
  static getActiveUsername(): string | null {
    return localStorage.getItem(ACTIVE_USER_KEY);
  }

  /**
   * Set active username
   */
  static setActiveUsername(username: string | null): void {
    if (username) {
      localStorage.setItem(ACTIVE_USER_KEY, username.trim().toLowerCase());
    } else {
      localStorage.removeItem(ACTIVE_USER_KEY);
    }
  }

  /**
   * Register a new user with completely isolated vault
   */
  static async registerUser(
    username: string,
    displayName: string,
    passwordHash: string,
    salt: string,
    biometricEnabled: boolean = false,
    biometricCredentialId?: string,
    kdfIterations: number = KDF_ITERATIONS,
    biometricKeyMode?: 'prf' | 'device'
  ): Promise<UserProfile> {
    const cleanUsername = username.trim().toLowerCase();
    const existing = this.getUserByUsername(cleanUsername);
    if (existing) {
      throw new Error('این نام کاربری قبلاً ثبت شده است. لطفاً نام دیگری انتخاب کنید.');
    }

    const settings: SecuritySettings = {
      isSetup: true,
      masterPasswordHash: passwordHash,
      salt,
      kdfIterations,
      biometricEnabled,
      biometricCredentialId,
      biometricKeyMode,
      biometricType: 'none',
      autoBiometricPrompt: false,
      autoLockMinutes: 5,
    };

    const newUser: UserProfile = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      username: cleanUsername,
      displayName: displayName.trim() || cleanUsername,
      createdAt: new Date().toISOString(),
      settings,
    };

    const users = this.getUsers();
    users.push(newUser);
    this.saveUsers(users);
    this.setActiveUsername(cleanUsername);

    return newUser;
  }

  /**
   * Update security settings for a specific user
   */
  static saveUserSettings(username: string, settings: SecuritySettings): void {
    const clean = username.trim().toLowerCase();
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.username.toLowerCase() === clean);
    if (idx !== -1) {
      users[idx].settings = settings;
      this.saveUsers(users);
      ChangeBus.emit(clean);
    }
  }

  /**
   * Retrieves security settings for user
   */
  static getUserSettings(username: string): SecuritySettings | null {
    const user = this.getUserByUsername(username);
    return user ? user.settings : null;
  }

  /**
   * Per-user vault key
   */
  private static getVaultKey(username: string): string {
    return `keeppass_vault_user_${username.trim().toLowerCase()}`;
  }

  /**
   * Saves encrypted items payload for a specific user
   */
  static async saveEncryptedVault(username: string, items: VaultItem[], key: CryptoKey): Promise<void> {
    const jsonStr = JSON.stringify(items);
    const encrypted = await CryptoService.encrypt(jsonStr, key);
    localStorage.setItem(this.getVaultKey(username), encrypted);
    ChangeBus.emit(username);
  }

  /**
   * Loads and decrypts items payload for a specific user
   */
  static async loadDecryptedVault(username: string, key: CryptoKey): Promise<VaultItem[]> {
    const storageKey = this.getVaultKey(username);
    const encrypted = localStorage.getItem(storageKey);
    if (!encrypted) {
      // First time initialized for this user: clean empty vault
      const initialItems: VaultItem[] = [];
      await this.saveEncryptedVault(username, initialItems, key);
      return initialItems;
    }

    try {
      const decryptedJson = await CryptoService.decrypt(encrypted, key);
      const items = JSON.parse(decryptedJson) as VaultItem[];
      // Remove any previously seeded sample items
      const cleaned = items.filter(
        (it) => !it.id.startsWith('sample-') && 
                it.title !== 'اینستاگرام شخصی' && 
                it.title !== 'کارت بانکی شتاب' && 
                it.title !== 'ایمیل شخصی / کاری'
      );
      if (cleaned.length !== items.length) {
        await this.saveEncryptedVault(username, cleaned, key);
      }
      return cleaned;
    } catch (e) {
      console.error('Failed to decrypt vault with provided key:', e);
      throw new Error('رمز وارد شده اشتباه است یا کلید رمزگشایی مطابقت ندارد.');
    }
  }

  /**
   * Retrieves isolated loans for a specific user (decrypted in memory while unlocked)
   */
  static getLoansForUser(username: string): LoanItem[] {
    const raw = SecureStore.getItem(secureKeysFor(username).loans);
    if (!raw) {
      return [];
    }
    try {
      const loans = JSON.parse(raw) as LoanItem[];
      // Filter out any default sample loan
      const cleaned = loans.filter(
        (l) => !l.id.startsWith('sample-') && 
               !l.lender.includes('اسنپ‌پی') && 
               !l.title.includes('اسنپ‌پی') && 
               !l.title.includes('خرید اقساطی')
      );
      if (cleaned.length !== loans.length) {
        this.saveLoansForUser(username, cleaned);
      }
      return cleaned;
    } catch {
      return [];
    }
  }

  /**
   * Saves isolated loans for a specific user (encrypted at rest)
   */
  static saveLoansForUser(username: string, loans: LoanItem[]): void {
    SecureStore.setItem(secureKeysFor(username).loans, JSON.stringify(loans));
  }

  // =========================================================================
  // Unlock / session helpers
  // =========================================================================

  /**
   * Verifies the master password for a stored user. Legacy accounts (fast SHA-256 hash) are
   * transparently upgraded to the key-derived verifier.
   */
  static async unlockWithPassword(
    user: UserProfile,
    password: string
  ): Promise<{ ok: boolean; key?: CryptoKey; user?: UserProfile }> {
    const res = await CryptoService.verifyMasterPassword(password, user.settings);
    if (!res.ok || !res.key) return { ok: false };

    let updatedUser = user;
    if (res.upgradedVerifier) {
      const settings: SecuritySettings = {
        ...user.settings,
        masterPasswordHash: res.upgradedVerifier,
        kdfIterations: CryptoService.iterationsFor(user.settings),
      };
      this.saveUserSettings(user.username, settings);
      updatedUser = { ...user, settings };
    }
    return { ok: true, key: res.key, user: updatedUser };
  }

  /** Opens the encrypted per-user stores. Must run before reading loans/hosting/Telegram data. */
  static async openSession(username: string, key: CryptoKey): Promise<void> {
    await SecureStore.open(username, key);
  }

  /** Clears decrypted data from memory. */
  static closeSession(): void {
    SecureStore.close();
  }

  /**
   * Removes raw vault keys written by older versions (`keeppass_bio_token_*`),
   * including copies inside migration snapshots. Returns the affected usernames.
   */
  static purgeLegacyBiometricTokens(): string[] {
    const affected: string[] = [];
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LEGACY_BIO_TOKEN_PREFIX)) {
        toRemove.push(k);
        affected.push(k.slice(LEGACY_BIO_TOKEN_PREFIX.length));
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    scrubSnapshots((k) => k.startsWith(LEGACY_BIO_TOKEN_PREFIX));
    return affected;
  }

  /**
   * After a password login: if biometric unlock is enabled but this device has no wrapped key
   * (e.g. right after the security update removed the old raw key), store one in device mode
   * without an extra prompt so Face ID keeps working.
   */
  static async ensureBiometricKey(user: UserProfile, key: CryptoKey): Promise<UserProfile> {
    const s = user.settings;
    if (!s.biometricEnabled || !s.biometricCredentialId) return user;
    if (await BiometricKeyStore.has(user.username)) return user;
    try {
      const mode = await BiometricKeyStore.wrapForCredential(user.username, s.biometricCredentialId, key, { tryPrf: false });
      const settings = { ...s, biometricKeyMode: mode };
      this.saveUserSettings(user.username, settings);
      return { ...user, settings };
    } catch (err) {
      console.warn('[StorageService] Could not restore biometric key:', err);
      return user;
    }
  }

  /**
   * Theme persistence
   */
  static getTheme(): 'dark' | 'light' {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  }

  static setTheme(theme: 'dark' | 'light'): void {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
  }

  // =========================================================================
  // Persistent Storage API (جلوگیری از پاک شدن خودکار کش توسط iOS و Android)
  // =========================================================================

  /**
   * درخواست فعال‌سازی ذخیره‌سازی پایدار و ضد-حذف خودکار از مرورگر و سیستم‌عامل
   */
  static async initPersistentStorage(): Promise<{ isPersisted: boolean; isSupported: boolean }> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        const isPersisted = await navigator.storage.persist();
        console.log(`[StorageService] Storage persistence granted: ${isPersisted}`);
        return { isPersisted, isSupported: true };
      } catch (err) {
        console.warn('[StorageService] Persistent storage request error:', err);
        return { isPersisted: false, isSupported: true };
      }
    }
    return { isPersisted: false, isSupported: false };
  }

  /**
   * بررسی وضعیت فعلی پایداری حافظه در سیستم‌عامل
   */
  static async checkPersistentStorage(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
      try {
        return await navigator.storage.persisted();
      } catch {
        return false;
      }
    }
    return false;
  }

  // =========================================================================
  // Zero-Knowledge Cloud Sync & Recovery
  // (حل مشکل حذف اپلیکیشن و پاک شدن کامل کش گوشی)
  // =========================================================================

  private static getCloudSyncKey(username: string): string {
    return `keeppass_last_cloud_sync_${username.trim().toLowerCase()}`;
  }

  private static getCloudRevisionKey(username: string): string {
    return `keeppass_cloud_rev_${username.trim().toLowerCase()}`;
  }

  /** Last cloud revision this device saw (null = never synced from this device). */
  static getCloudRevision(username: string): number | null {
    const raw = localStorage.getItem(this.getCloudRevisionKey(username));
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  static setCloudRevision(username: string, revision: number): void {
    localStorage.setItem(this.getCloudRevisionKey(username), String(revision));
  }

  static getLastCloudSyncTime(username: string): string | null {
    return localStorage.getItem(this.getCloudSyncKey(username));
  }

  static setLastCloudSyncTime(username: string, timestamp: string): void {
    localStorage.setItem(this.getCloudSyncKey(username), timestamp);
  }

  /**
   * بررسی وجود نسخه پشتیبان ابری برای یک نام کاربری
   */
  static async checkCloudBackupAvailable(username: string): Promise<{
    hasBackup: boolean;
    lastSync: string | null;
    salt?: string;
    kdfIterations?: number;
    revision?: number;
    reachable?: boolean;
  }> {
    try {
      const clean = username.trim().toLowerCase();
      const res = await fetch(`/api/vault/status/${encodeURIComponent(clean)}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        return {
          hasBackup: !!data.hasBackup,
          lastSync: data.lastSync || null,
          salt: data.salt,
          kdfIterations: data.kdfIterations,
          revision: typeof data.revision === 'number' ? data.revision : undefined,
          reachable: true,
        };
      }
      return { hasBackup: false, lastSync: null, reachable: false };
    } catch {
      return { hasBackup: false, lastSync: null, reachable: false };
    }
  }

  /**
   * همگام‌سازی و ذخیره ابری اطلاعات با رمزنگاری صفر (Zero-Knowledge)
   * داده‌ها در مرورگر رمزنگاری می‌شوند و فقط خروجی رمزشده ارسال می‌شود.
   * سرور فقط هش «توکن مالکیت» را نگه می‌دارد؛ بدون آن هیچ‌کس نمی‌تواند نسخه ابری را
   * بخواند یا بازنویسی کند.
   *
   * @param previousKey  کلید قبلی (فقط هنگام تغییر رمز اصلی) برای اثبات مالکیت نسخه ابری قدیمی
   */
  static async syncVaultToCloud(
    username: string,
    key: CryptoKey,
    opts: { previousKey?: CryptoKey; force?: boolean } = {}
  ): Promise<{
    success: boolean;
    message: string;
    updatedAt?: string;
    revision?: number;
    /** HTTP status (0 = network error / offline). */
    status?: number;
    conflict?: boolean;
  }> {
    const clean = username.trim().toLowerCase();
    const user = this.getUserByUsername(clean);
    if (!user) {
      return { success: false, message: 'کاربر جهت همگام‌سازی یافت نشد.' };
    }

    // Snapshot protected data synchronously, so a lock right after this call can't race it.
    const keys = secureKeysFor(clean);
    const loansRaw = SecureStore.getItem(keys.loans);
    const hostingsRaw = SecureStore.getItem(keys.hosting);
    const telegramRaw = SecureStore.getItem(keys.telegram);

    let res: Response;
    try {
      const vaultItems = await this.loadDecryptedVaultSilently(clean, key);
      const fullPackage = {
        version: 3,
        userProfile: user,
        vaultItems,
        loans: loansRaw ? JSON.parse(loansRaw) : [],
        hostingItems: hostingsRaw ? JSON.parse(hostingsRaw) : [],
        telegramSettings: telegramRaw ? JSON.parse(telegramRaw) : null,
        syncedAt: new Date().toISOString(),
      };

      // رمزنگاری کامل بسته با کلید اصلی کاربر (AES-256-GCM)
      const encryptedPayload = await CryptoService.encrypt(JSON.stringify(fullPackage), key);
      const newAuthToken = await CryptoService.computeSyncAuthToken(key);
      const authToken = opts.previousKey ? await CryptoService.computeSyncAuthToken(opts.previousKey) : newAuthToken;

      // ارسال امن به سرور بدون افشای رمز عبور یا کلید
      res = await fetch('/api/vault/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: clean,
          authToken,
          newAuthToken,
          salt: user.settings.salt,
          kdfIterations: CryptoService.iterationsFor(user.settings),
          encryptedPayload,
          schemaVersion: 3,
          baseRevision: this.getCloudRevision(clean),
          force: opts.force === true,
        }),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, status: 0, message: `ارتباط با سرور ابری برقرار نشد (${msg}).` };
    }

    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data.conflict) {
      return {
        success: false,
        status: 409,
        conflict: true,
        revision: data.revision,
        updatedAt: data.updatedAt,
        message: 'نسخه جدیدتری از دستگاه دیگری در فضای ابری هست.',
      };
    }
    if (!res.ok) {
      if (res.status === 404) {
        return { success: false, status: 404, message: 'سرویس ابری روی این نسخه از سایت در دسترس نیست.' };
      }
      return { success: false, status: res.status, message: data.error || 'خطا در ارسال داده‌ها به سرور ابری.' };
    }

    this.setLastCloudSyncTime(clean, data.updatedAt);
    if (typeof data.revision === 'number') this.setCloudRevision(clean, data.revision);
    return {
      success: true,
      status: 200,
      revision: data.revision,
      message: 'همگام‌سازی ابری با موفقیت انجام شد و داده‌ها به صورت رمزنگاری‌شده ذخیره گردیدند.',
      updatedAt: data.updatedAt,
    };
  }

  /** Reads the vault without triggering a sync for the "sample item cleanup" write. */
  private static loadDecryptedVaultSilently(username: string, key: CryptoKey): Promise<VaultItem[]> {
    return ChangeBus.silently(() => this.loadDecryptedVault(username, key));
  }

  /**
   * Replaces this device's data with the cloud copy, using the already-unlocked key
   * (used when another device saved newer data). Returns false if the key doesn't match.
   */
  static async pullCloudIntoLocal(
    username: string,
    key: CryptoKey
  ): Promise<{ success: boolean; message: string }> {
    const clean = username.trim().toLowerCase();
    try {
      const authToken = await CryptoService.computeSyncAuthToken(key);
      const res = await fetch('/api/vault/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: clean, authToken }),
      });
      if (res.status === 403) {
        return { success: false, message: 'نسخه ابری با رمز دیگری ذخیره شده است. برای دریافت آن از «بازیابی» در صفحه ورود با همان رمز استفاده کنید.' };
      }
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        return { success: false, message: e.error || 'خطا در دریافت نسخه ابری.' };
      }
      const { vault } = await res.json();
      const pkg = JSON.parse(await CryptoService.decrypt(vault.encryptedPayload, key));
      const keys = secureKeysFor(clean);

      await ChangeBus.silently(async () => {
        await this.saveEncryptedVault(clean, pkg.vaultItems || [], key);
        if (Array.isArray(pkg.loans)) this.saveLoansForUser(clean, pkg.loans);
        if (Array.isArray(pkg.hostingItems)) SecureStore.setItem(keys.hosting, JSON.stringify(pkg.hostingItems));
        if (pkg.telegramSettings) SecureStore.setItem(keys.telegram, JSON.stringify(pkg.telegramSettings));
        await SecureStore.flush();
      });

      if (typeof vault.revision === 'number') this.setCloudRevision(clean, vault.revision);
      this.setLastCloudSyncTime(clean, vault.updatedAt || new Date().toISOString());
      return { success: true, message: 'اطلاعات این دستگاه با نسخه ابری به‌روز شد.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `خطا در دریافت نسخه ابری: ${msg}` };
    }
  }

  /**
   * بازیابی کامل اطلاعات از سرور ابری هنگام حذف و نصب مجدد اپ یا پاک شدن کش
   */
  static async restoreVaultFromCloud(
    username: string, 
    masterPassword: string
  ): Promise<{ 
    success: boolean; 
    user?: UserProfile; 
    key?: CryptoKey; 
    message: string;
    itemsCount?: number;
  }> {
    const clean = username.trim().toLowerCase();
    if (!clean || !masterPassword) {
      return { success: false, message: 'نام کاربری و رمز عبور اصلی الزامی هستند.' };
    }

    try {
      // ۱. دریافت پارامترهای عمومی (salt و تعداد تکرار) برای ساخت کلید
      const status = await this.checkCloudBackupAvailable(clean);
      if (!status.hasBackup || !status.salt) {
        return { success: false, message: `هیچ نسخه پشتیبان ابری برای کاربر «${clean}» یافت نشد.` };
      }

      // ۲. ساخت کلید و توکن مالکیت در مرورگر
      const iterations = CryptoService.iterationsFor({ kdfIterations: status.kdfIterations });
      const derivedKey = await CryptoService.deriveKey(masterPassword, status.salt, iterations);
      const authToken = await CryptoService.computeSyncAuthToken(derivedKey);

      // ۳. دریافت فایل رمزشده (فقط با توکن مالکیت صحیح)
      const res = await fetch('/api/vault/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: clean, authToken }),
      });
      if (res.status === 401 || res.status === 403) {
        return { success: false, message: 'رمز عبور وارد شده برای این حساب ابری صحیح نیست.' };
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return { success: false, message: errData.error || 'خطا در دریافت نسخه پشتیبان ابری.' };
      }

      const { vault } = await res.json();
      if (!vault || !vault.encryptedPayload) {
        return { success: false, message: 'داده‌های ابری دریافت شده ساختار نامعتبری دارند.' };
      }

      // ۴. رمزگشایی بسته ابری در مرورگر
      let decryptedJson = '';
      try {
        decryptedJson = await CryptoService.decrypt(vault.encryptedPayload, derivedKey);
      } catch {
        return { 
          success: false, 
          message: 'رمز عبور وارد شده اشتباه است یا با کلید رمزنگاری ابری مطابقت ندارد.' 
        };
      }

      const fullPackage = JSON.parse(decryptedJson);

      // ۵. بازیابی و ثبت کاربر در ریجستری مرورگر (تنظیمات بیومتریک مخصوص هر دستگاه است)
      const baseProfile: UserProfile = fullPackage.userProfile || {
        id: `user_restored_${Date.now()}`,
        username: clean,
        displayName: clean,
        createdAt: new Date().toISOString(),
        settings: {
          isSetup: true,
          masterPasswordHash: '',
          salt: status.salt,
          biometricEnabled: false,
          biometricType: 'none',
          autoBiometricPrompt: false,
          autoLockMinutes: 5,
        },
      };
      const restoredUser: UserProfile = {
        ...baseProfile,
        username: clean,
        settings: {
          ...baseProfile.settings,
          isSetup: true,
          salt: status.salt,
          kdfIterations: iterations,
          masterPasswordHash: await CryptoService.computeVerifier(derivedKey),
          biometricEnabled: false,
          biometricCredentialId: undefined,
          biometricKeyMode: undefined,
          autoBiometricPrompt: false,
        },
      };

      const users = this.getUsers().filter((u) => u.username.toLowerCase() !== clean);
      users.push(restoredUser);
      this.saveUsers(users);
      this.setActiveUsername(clean);
      await BiometricKeyStore.remove(clean);

      // ۶. بازیابی موارد گاوصندوق
      const vaultItems: VaultItem[] = fullPackage.vaultItems || [];
      await this.saveEncryptedVault(clean, vaultItems, derivedKey);

      // ۷. بازیابی وام‌ها و هاست‌ها و تلگرام (رمزنگاری‌شده)
      const keys = secureKeysFor(clean);
      [keys.loans, keys.hosting, keys.telegram].forEach((k) => localStorage.removeItem(k));
      await SecureStore.open(clean, derivedKey);

      if (Array.isArray(fullPackage.loans)) {
        this.saveLoansForUser(clean, fullPackage.loans);
      }
      if (Array.isArray(fullPackage.hostingItems)) {
        SecureStore.setItem(keys.hosting, JSON.stringify(fullPackage.hostingItems));
      }
      if (fullPackage.telegramSettings) {
        SecureStore.setItem(keys.telegram, JSON.stringify(fullPackage.telegramSettings));
      }
      await SecureStore.flush();

      this.setLastCloudSyncTime(clean, vault.updatedAt || new Date().toISOString());
      if (typeof vault.revision === 'number') this.setCloudRevision(clean, vault.revision);

      return {
        success: true,
        user: restoredUser,
        key: derivedKey,
        itemsCount: vaultItems.length,
        message: `کلیه اطلاعات (${vaultItems.length} رمز و حساب کاربری) با موفقیت از فضای ابری بازیابی گردید!`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `خطا در بازیابی نسخه ابری: ${msg}` };
    }
  }
}
