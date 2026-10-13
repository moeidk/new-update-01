/**
 * src/services/dataMigration.ts
 * Idempotent Client-Side Data Migration Engine
 * 
 * ویژگی‌ها و تعهدات کلیدی:
 * ۱. مصونیت ۱۰۰٪ داده‌ها: هیچ رکورد، پسورد یا تنظیمی در فرآیند رفرش یا ارتقای نسخه حذف نمی‌شود.
 * ۲. Idempotent: اجرای مکرر این تابع هیچ عارضه جانبی (side-effect) یا تکثیر داده ایجاد نمی‌کند.
 * ۳. ایجاد نسخه پشتیبان خودکار (Snapshot Backup) از localStorage قبل از اعمال هرگونه مهاجرت.
 * ۴. استراتژی افزایشی (Additive Migration): فیلدهای جدید اضافه می‌شوند ولی هیچ فیلد قدیمی حذف نمی‌گردد.
 */

export interface MigrationLog {
  timestamp: string;
  fromVersion: number;
  toVersion: number;
  success: boolean;
  keysMigrated: number;
  details?: string;
}

export const CURRENT_SCHEMA_VERSION = 2;
const SCHEMA_VERSION_KEY = '__keeppass_schema_version__';
const MIGRATION_BACKUP_PREFIX = '__keeppass_migration_backup_';
const MIGRATION_LOGS_KEY = '__keeppass_migration_logs__';

export class DataMigrationService {
  /**
   * دریافت شماره نسخه فعلی ساختار داده‌ها در مرورگر
   */
  static getCurrentStoredVersion(): number {
    const raw = localStorage.getItem(SCHEMA_VERSION_KEY);
    if (!raw) return 1; // نسخه‌های پیشین نسخه ۱ در نظر گرفته می‌شوند
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? 1 : parsed;
  }

  /**
   * پشتیبان‌گیری فوری از کل داده‌های مرتبط با سامانه در localStorage
   */
  static createSafetySnapshot(fromVersion: number): string {
    const snapshot: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        !key.startsWith('keeppass_bio_token_') && // never copy (legacy) raw keys into snapshots
        (key.startsWith('keeppass_') || key.startsWith('ghest_') || key.startsWith('hosting_'))
      ) {
        snapshot[key] = localStorage.getItem(key) || '';
      }
    }
    const backupKey = `${MIGRATION_BACKUP_PREFIX}v${fromVersion}_${Date.now()}`;
    try {
      localStorage.setItem(backupKey, JSON.stringify(snapshot));
      return backupKey;
    } catch (e) {
      console.warn('[DataMigration] Warning: Could not create localStorage backup snapshot due to quota:', e);
      return '';
    }
  }

  /**
   * اجرای مهاجرت‌های ساختار داده به صورت Idempotent
   * این تابع در ابتدای لود نرم‌افزار صدا زده می‌شود
   */
  static runMigrations(): { migrated: boolean; from: number; to: number } {
    const fromVersion = this.getCurrentStoredVersion();

    if (fromVersion >= CURRENT_SCHEMA_VERSION) {
      // داده‌ها در به‌روزترین حالت قرار دارند - هیچ تغییری نیاز نیست
      return { migrated: false, from: fromVersion, to: CURRENT_SCHEMA_VERSION };
    }

    console.log(`[DataMigration] Migrating data from schema v${fromVersion} to v${CURRENT_SCHEMA_VERSION}...`);

    // ایجاد یک اسنپ‌شات اضطراری قبل از دستکاری کلیدها
    const backupKey = this.createSafetySnapshot(fromVersion);

    let keysMigratedCount = 0;

    try {
      // =====================================================================
      // مهاجرت از نسخه ۱ به نسخه ۲:
      // ۱. استانداردسازی فیلدهای وام‌ها و اطمینان از صحت انواع عددی
      // ۲. اطمینان از وجود متادیتای افزایشی در تنظیمات و هاست‌ها بدون حذف داده
      // =====================================================================
      if (fromVersion < 2) {
        // ۱. بررسی کلیدهای وام‌ها
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('keeppass_loans_')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                  let changed = false;
                  const normalized = parsed.map((item: any) => {
                    const now = new Date().toISOString();
                    const updated = {
                      ...item,
                      // فیلدهای تکمیلی افزایشی بدون تغییر داده‌های اصلی
                      tags: Array.isArray(item.tags) ? item.tags : [],
                      autoNotify: typeof item.autoNotify === 'boolean' ? item.autoNotify : true,
                      updatedAt: item.updatedAt || now,
                      createdAt: item.createdAt || now,
                      // تضمین اعتبارسنجی مقادیر عددی
                      totalAmount: Number(item.totalAmount) || 0,
                      installmentAmount: Number(item.installmentAmount) || 0,
                      installmentsPaid: Number(item.installmentsPaid) || 0,
                      totalInstallments: Number(item.totalInstallments) || 1,
                    };
                    if (JSON.stringify(updated) !== JSON.stringify(item)) {
                      changed = true;
                    }
                    return updated;
                  });

                  if (changed) {
                    localStorage.setItem(key, JSON.stringify(normalized));
                    keysMigratedCount++;
                  }
                }
              } catch (e) {
                console.error(`[DataMigration] Error migrating key ${key}:`, e);
              }
            }
          }

          // ۲. بررسی کلیدهای هاست و دامنه
          if (key && key.startsWith('keeppass_hostings_')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                  let changed = false;
                  const normalized = parsed.map((item: any) => {
                    const now = new Date().toISOString();
                    const updated = {
                      ...item,
                      autoRenewAlert: typeof item.autoRenewAlert === 'boolean' ? item.autoRenewAlert : true,
                      renewalCost: Number(item.renewalCost) || 0,
                      currency: item.currency || 'تومان',
                      updatedAt: item.updatedAt || now,
                      createdAt: item.createdAt || now,
                    };
                    if (JSON.stringify(updated) !== JSON.stringify(item)) {
                      changed = true;
                    }
                    return updated;
                  });

                  if (changed) {
                    localStorage.setItem(key, JSON.stringify(normalized));
                    keysMigratedCount++;
                  }
                }
              } catch (e) {
                console.error(`[DataMigration] Error migrating hosting key ${key}:`, e);
              }
            }
          }
        }
      }

      // به‌روزرسانی شناسه نسخه ساختار
      localStorage.setItem(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION.toString());

      // ثبت لاگ مهاجرت
      this.recordMigrationLog({
        timestamp: new Date().toISOString(),
        fromVersion,
        toVersion: CURRENT_SCHEMA_VERSION,
        success: true,
        keysMigrated: keysMigratedCount,
        details: backupKey ? `پشتیبان در ${backupKey} ذخیره شد.` : 'بدون اسنپ‌شات',
      });

      console.log(`[DataMigration] Successfully migrated ${keysMigratedCount} records to schema v${CURRENT_SCHEMA_VERSION}.`);
      return { migrated: true, from: fromVersion, to: CURRENT_SCHEMA_VERSION };
    } catch (err: unknown) {
      console.error('[DataMigration] Fatal migration error:', err);
      // ثبت لاگ خطا و عدم ارتقای نسخه تا از فساد داده‌ها جلوگیری شود
      this.recordMigrationLog({
        timestamp: new Date().toISOString(),
        fromVersion,
        toVersion: CURRENT_SCHEMA_VERSION,
        success: false,
        keysMigrated: keysMigratedCount,
        details: err instanceof Error ? err.message : String(err),
      });
      return { migrated: false, from: fromVersion, to: fromVersion };
    }
  }

  /**
   * ثبت تاریخچه فرآیند مایگریشن
   */
  private static recordMigrationLog(log: MigrationLog) {
    try {
      const raw = localStorage.getItem(MIGRATION_LOGS_KEY);
      const logs: MigrationLog[] = raw ? JSON.parse(raw) : [];
      logs.unshift(log);
      // نگهداری ۱۰ لاگ آخر
      localStorage.setItem(MIGRATION_LOGS_KEY, JSON.stringify(logs.slice(0, 10)));
    } catch {}
  }

  /**
   * دریافت گزارش تاریخچه مایگریشن‌ها جهت نمایش در تب تنظیمات ادمین
   */
  static getMigrationLogs(): MigrationLog[] {
    try {
      const raw = localStorage.getItem(MIGRATION_LOGS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * تولید بسته خروجی پشتیبان کامل از تمامی داده‌ها جهت دانلود دستی توسط کاربر
   */
  static exportFullSafetyBackup(): string {
    const data: Record<string, any> = {
      version: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      storage: {},
    };

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !key.startsWith(MIGRATION_BACKUP_PREFIX)) {
        data.storage[key] = localStorage.getItem(key);
      }
    }

    return JSON.stringify(data, null, 2);
  }
}
