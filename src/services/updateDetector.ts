/**
 * src/services/updateDetector.ts
 * Auto-update and Release Detection Engine
 * 
 * وظایف:
 * ۱. پایش دوره‌ای و هنگام فوکوس روی پنجره از فایل /version.json
 * ۲. تشخیص نسخه جدید از طریق شماره نسخه و هش کامیت گیت
 * ۳. بررسی سطح دسترسی مدیر (Admin check)
 * ۴. ارسال امن درخواست استقرار به اندپوینت /api/trigger-deploy سرور
 */

export interface VersionInfo {
  version: string;
  buildTime: string;
  gitCommit: string;
  gitBranch: string;
  environment: string;
  releaseName: string;
  changelog?: string[];
}

export interface DeployTriggerResponse {
  success: boolean;
  message: string;
  details?: string;
  workflowId?: string;
}

// کلید ذخیره‌سازی کلید احراز هویت ادمین در حافظه محلی مرورگر ادمین
const ADMIN_AUTH_KEY_STORAGE = 'keeppass_admin_secret_key';
const SNOOZED_VERSION_KEY = 'keeppass_snoozed_update_version';

export class UpdateDetectorService {
  private static localVersion: VersionInfo | null = null;

  /**
   * بارگذاری نسخه باندل فعلی برنامه
   */
  static async getLocalVersion(): Promise<VersionInfo> {
    if (this.localVersion) return this.localVersion;

    try {
      // دریافت مستقیم فایل version.json که در حین بیلد تولید شده
      const res = await fetch(`/version.json?_init=${Date.now()}`);
      if (res.ok) {
        this.localVersion = await res.json();
        return this.localVersion!;
      }
    } catch {}

    // مقدار پیش‌فرض در صورت عدم دسترسی
    this.localVersion = {
      version: '1.0.0',
      buildTime: new Date().toISOString(),
      gitCommit: 'local',
      gitBranch: 'main',
      environment: 'production',
      releaseName: 'KeepPass Vault v1.0.0',
    };
    return this.localVersion;
  }

  /**
   * بررسی انتشار نسخه جدید با ارسال هدرهای ضد-کش به سرور
   */
  static async checkForUpdate(): Promise<{ hasUpdate: boolean; newVersion: VersionInfo | null }> {
    try {
      const local = await this.getLocalVersion();
      // جلوگیری قطعی از کش شدن در کلودفلر یا مرورگر
      const res = await fetch(`/version.json?_cb=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!res.ok) {
        return { hasUpdate: false, newVersion: null };
      }

      const remote: VersionInfo = await res.json();

      // آیا نسخه قبلاً توسط مدیر به تعویق انداخته (snooze) شده است؟
      const snoozed = localStorage.getItem(SNOOZED_VERSION_KEY);
      if (snoozed && snoozed === remote.gitCommit) {
        return { hasUpdate: false, newVersion: null };
      }

      // مقایسه هش کامیت و یا شماره نسخه
      const isNewCommit = remote.gitCommit && local.gitCommit && remote.gitCommit !== local.gitCommit;
      const isNewVersion = remote.version !== local.version;

      if (isNewCommit || isNewVersion) {
        return { hasUpdate: true, newVersion: remote };
      }

      return { hasUpdate: false, newVersion: null };
    } catch (err) {
      console.warn('[UpdateDetector] Failed to check for remote version:', err);
      return { hasUpdate: false, newVersion: null };
    }
  }

  /**
   * به تعویق انداختن اعلان برای نسخه فعلی (دکمه «بعداً»)
   */
  static snoozeUpdate(gitCommit: string): void {
    localStorage.setItem(SNOOZED_VERSION_KEY, gitCommit);
  }

  /**
   * پاکسازی تعویق جهت بررسی مجدد دستی
   */
  static clearSnooze(): void {
    localStorage.removeItem(SNOOZED_VERSION_KEY);
  }

  /**
   * تشخیص اینکه آیا کاربر جاری مدیر سیستم است یا خیر
   * روش: تطابق با متغیر ادمین در محیط یا داشتن کلید ادمین معتبر
   */
  static isAdminUser(username: string): boolean {
    const configuredAdmin = (import.meta.env.VITE_ADMIN_USERNAME || 'admin').toLowerCase().trim();
    const currentUsername = (username || '').toLowerCase().trim();
    return currentUsername === configuredAdmin;
  }

  /**
   * دریافت کلید مخفی ادمین ذخیره‌شده در مرورگر
   */
  static getStoredAdminKey(): string {
    return localStorage.getItem(ADMIN_AUTH_KEY_STORAGE) || '';
  }

  /**
   * ذخیره کلید احراز هویت ادمین
   */
  static saveAdminKey(key: string): void {
    localStorage.setItem(ADMIN_AUTH_KEY_STORAGE, key.trim());
  }

  /**
   * ارسال امن درخواست تریگر دیپلوی به سرور بک‌اند
   * توجه: توکن گیت‌هاب در بک‌اند نگهداری می‌شود و هرگز به کلاینت نمی‌آید
   */
  static async triggerProductionDeploy(
    adminKey: string,
    targetEnv: 'production' | 'staging' = 'production'
  ): Promise<DeployTriggerResponse> {
    try {
      const res = await fetch('/api/trigger-deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey,
        },
        body: JSON.stringify({
          environment: targetEnv,
          timestamp: new Date().toISOString(),
          requestedBy: 'React Admin Client',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          message: data.error || 'خطا در برقراری ارتباط با سرویس استقرار',
          details: data.details,
        };
      }

      return {
        success: true,
        message: data.message || 'درخواست استقرار نسخه اصلی با موفقیت ارسال شد.',
        workflowId: data.workflowId,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `خطای شبکه در ارسال درخواست استقرار: ${msg}`,
      };
    }
  }
}
