/**
 * Storage & Vault Persistence Service with Multi-User Isolation
 */
import { VaultItem, SecuritySettings, BackupData, UserProfile, LoanItem } from '../types';
import { CryptoService } from './crypto';

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
    biometricCredentialId?: string
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
      biometricEnabled,
      biometricCredentialId,
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
   * Per-user loans key
   */
  private static getLoansKey(username: string): string {
    return `keeppass_loans_user_${username.trim().toLowerCase()}`;
  }

  /**
   * Retrieves isolated loans for a specific user
   */
  static getLoansForUser(username: string): LoanItem[] {
    const key = this.getLoansKey(username);
    const raw = localStorage.getItem(key);
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
   * Saves isolated loans for a specific user
   */
  static saveLoansForUser(username: string, loans: LoanItem[]): void {
    const key = this.getLoansKey(username);
    localStorage.setItem(key, JSON.stringify(loans));
  }

  /**
   * Caches raw master key in local storage wrapped for biometric unlock of a specific user
   */
  static async cacheKeyForBiometrics(username: string, key: CryptoKey): Promise<void> {
    const rawBase64 = await CryptoService.exportKeyRaw(key);
    localStorage.setItem(`keeppass_bio_token_${username.trim().toLowerCase()}`, rawBase64);
  }

  /**
   * Retrieves cached master key for biometric unlock
   */
  static async getCachedKeyForBiometrics(username: string): Promise<CryptoKey | null> {
    const rawBase64 = localStorage.getItem(`keeppass_bio_token_${username.trim().toLowerCase()}`);
    if (!rawBase64) return null;
    try {
      return await CryptoService.importKeyRaw(rawBase64);
    } catch {
      return null;
    }
  }

  /**
   * Clears biometric key cache for a user
   */
  static clearBiometricKeyCache(username: string): void {
    localStorage.removeItem(`keeppass_bio_token_${username.trim().toLowerCase()}`);
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

  /**
   * Export encrypted backup for a user
   */
  static async exportBackup(items: VaultItem[], masterPassword?: string): Promise<string> {
    const backup: BackupData = {
      version: 2,
      timestamp: new Date().toISOString(),
      items,
    };
    const json = JSON.stringify(backup, null, 2);

    if (masterPassword) {
      const salt = CryptoService.generateSalt();
      const key = await CryptoService.deriveKey(masterPassword, salt);
      const encrypted = await CryptoService.encrypt(json, key);
      return JSON.stringify({
        isEncrypted: true,
        salt,
        data: encrypted,
        timestamp: backup.timestamp,
      });
    }

    return json;
  }

  /**
   * Initial sample items for user convenience upon first vault creation (Clean empty)
   */
  static getInitialSampleItems(_username?: string): VaultItem[] {
    return [];
  }

  /**
   * Initial sample loans for user (Clean empty)
   */
  static getInitialLoans(_username?: string): LoanItem[] {
    return [];
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

  static getLastCloudSyncTime(username: string): string | null {
    return localStorage.getItem(this.getCloudSyncKey(username));
  }

  static setLastCloudSyncTime(username: string, timestamp: string): void {
    localStorage.setItem(this.getCloudSyncKey(username), timestamp);
  }

  /**
   * بررسی وجود نسخه پشتیبان ابری برای یک نام کاربری
   */
  static async checkCloudBackupAvailable(username: string): Promise<{ hasBackup: boolean; lastSync: string | null }> {
    try {
      const clean = username.trim().toLowerCase();
      const res = await fetch(`/api/vault/status/${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = await res.json();
        return { hasBackup: !!data.hasBackup, lastSync: data.lastSync || null };
      }
      return { hasBackup: false, lastSync: null };
    } catch {
      return { hasBackup: false, lastSync: null };
    }
  }

  /**
   * همگام‌سازی و ذخیره ابری اطلاعات با رمزنگاری صفر (Zero-Knowledge)
   * داده‌ها در مرورگر رمزنگاری می‌شوند و فقط خروجی رمزشده ارسال می‌شود
   */
  static async syncVaultToCloud(
    username: string, 
    key: CryptoKey
  ): Promise<{ success: boolean; message: string; updatedAt?: string }> {
    const clean = username.trim().toLowerCase();
    const user = this.getUserByUsername(clean);
    if (!user) {
      return { success: false, message: 'کاربر جهت همگام‌سازی یافت نشد.' };
    }

    try {
      // جمع‌آوری کامل داده‌های کاربر (رمزها، وام‌ها، هاست‌ها، تنظیمات تلگرام)
      const vaultItems = await this.loadDecryptedVault(clean, key);
      const loans = this.getLoansForUser(clean);
      const hostingsRaw = localStorage.getItem(`keeppass_hosting_user_${clean}`);
      const telegramRaw = localStorage.getItem(`keeppass_telegram_${clean}`);

      const fullPackage = {
        version: 2,
        userProfile: user,
        vaultItems,
        loans,
        hostingItems: hostingsRaw ? JSON.parse(hostingsRaw) : [],
        telegramSettings: telegramRaw ? JSON.parse(telegramRaw) : null,
        syncedAt: new Date().toISOString(),
      };

      // رمزنگاری کامل بسته با کلید اصلی کاربر (AES-256-GCM)
      const packageJson = JSON.stringify(fullPackage);
      const encryptedPayload = await CryptoService.encrypt(packageJson, key);

      // ارسال امن به سرور بدون افشای رمز عبور
      const res = await fetch('/api/vault/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: clean,
          salt: user.settings.salt,
          encryptedPayload,
          schemaVersion: 2,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'خطا در ارسال داده‌ها به سرور ابری.' };
      }

      this.setLastCloudSyncTime(clean, data.updatedAt);
      return { 
        success: true, 
        message: 'همگام‌سازی ابری با موفقیت انجام شد و داده‌ها به صورت رمزنگاری‌شده ذخیره گردیدند.', 
        updatedAt: data.updatedAt 
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `خطا در فرآیند رمزنگاری و همگام‌سازی ابری: ${msg}` };
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
      // ۱. دریافت فایل رمزشده از سرور ابری
      const res = await fetch(`/api/vault/pull/${encodeURIComponent(clean)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return { 
          success: false, 
          message: errData.error || `هیچ نسخه پشتیبان ابری برای کاربر «${clean}» یافت نشد.` 
        };
      }

      const { vault } = await res.json();
      if (!vault || !vault.encryptedPayload || !vault.salt) {
        return { success: false, message: 'داده‌های ابری دریافت شده ساختار نامعتبری دارند.' };
      }

      // ۲. استخراج کلید رمزگشایی با استفاده از نمک (salt) ذخیره‌شده و رمز عبور واردشده
      const derivedKey = await CryptoService.deriveKey(masterPassword, vault.salt);

      // ۳. تلاش برای رمزگشایی بسته ابری در مرورگر
      let decryptedJson = '';
      try {
        decryptedJson = await CryptoService.decrypt(vault.encryptedPayload, derivedKey);
      } catch (decryptErr) {
        return { 
          success: false, 
          message: 'رمز عبور وارد شده اشتباه است یا با کلید رمزنگاری ابری مطابقت ندارد.' 
        };
      }

      const fullPackage = JSON.parse(decryptedJson);

      // ۴. بازیابی و ثبت کاربر در ریجستری مرورگر
      const users = this.getUsers().filter((u) => u.username.toLowerCase() !== clean);
      const restoredUser: UserProfile = fullPackage.userProfile || {
        id: `user_restored_${Date.now()}`,
        username: clean,
        displayName: clean,
        createdAt: new Date().toISOString(),
        settings: {
          isSetup: true,
          masterPasswordHash: await CryptoService.hashPassword(masterPassword, vault.salt),
          salt: vault.salt,
          biometricEnabled: false,
          biometricType: 'none',
          autoBiometricPrompt: false,
          autoLockMinutes: 5,
        },
      };

      users.push(restoredUser);
      this.saveUsers(users);
      this.setActiveUsername(clean);

      // ۵. بازیابی موارد گاوصندوق
      const vaultItems: VaultItem[] = fullPackage.vaultItems || [];
      await this.saveEncryptedVault(clean, vaultItems, derivedKey);

      // ۶. بازیابی وام‌ها و هاست‌ها و تلگرام
      if (fullPackage.loans && Array.isArray(fullPackage.loans)) {
        this.saveLoansForUser(clean, fullPackage.loans);
      }

      if (fullPackage.hostingItems && Array.isArray(fullPackage.hostingItems)) {
        localStorage.setItem(`keeppass_hosting_user_${clean}`, JSON.stringify(fullPackage.hostingItems));
      }

      if (fullPackage.telegramSettings) {
        localStorage.setItem(`keeppass_telegram_${clean}`, JSON.stringify(fullPackage.telegramSettings));
      }

      this.setLastCloudSyncTime(clean, vault.updatedAt || new Date().toISOString());

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

