/**
 * src/components/DeploymentManagerTab.tsx
 * Professional DevOps & Release Management Tab
 * 
 * ویژگی‌ها:
 * ۱. نمایش متادیتای بیلد جاری (شماره نسخه، کامیت گیت، برنچ، تاریخ بیلد)
 * ۲. بررسی دستی و زنده نسخه جدید با هدرهای ضد-کش
 * ۳. مدیریت کلید احراز هویت ادمین (Admin Secret Key)
 * ۴. تریگر امن دیپلوی به سایت اصلی (Production) از طریق سرور بک‌اند
 * ۵. نمایش وضعیت مصون‌سازی داده‌های کاربران و دانلود بکاپ اضطراری قبل از آپدیت
 */

import React, { useState, useEffect } from 'react';
import { 
  Rocket, 
  GitBranch, 
  Clock, 
  RefreshCw, 
  ShieldCheck, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Server, 
  Globe, 
  Layers, 
  FileText,
  Lock,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { VersionInfo, UpdateDetectorService } from '../services/updateDetector';
import { DataMigrationService, CURRENT_SCHEMA_VERSION, MigrationLog } from '../services/dataMigration';

interface DeploymentManagerTabProps {
  currentUsername: string;
}

export const DeploymentManagerTab: React.FC<DeploymentManagerTabProps> = ({ currentUsername }) => {
  const isAdmin = UpdateDetectorService.isAdminUser(currentUsername);

  // وضعیت نسخه جاری
  const [localVersion, setLocalVersion] = useState<VersionInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<{
    hasUpdate: boolean;
    remoteVersion: VersionInfo | null;
    checkedAt: string;
  } | null>(null);

  // وضعیت کلید ادمین
  const [adminKey, setAdminKey] = useState(() => UpdateDetectorService.getStoredAdminKey());
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keyNotice, setKeyNotice] = useState<string>('');

  // وضعیت استقرار
  const [targetEnv, setTargetEnv] = useState<'production' | 'staging'>('production');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployFeedback, setDeployFeedback] = useState<{ success: boolean; message: string; details?: string } | null>(null);

  // وضعیت مایگریشن و پشتیبان
  const [migrationLogs, setMigrationLogs] = useState<MigrationLog[]>([]);
  const [backupDownloadNotice, setBackupDownloadNotice] = useState<string>('');

  // بارگذاری اولیه
  useEffect(() => {
    UpdateDetectorService.getLocalVersion().then(setLocalVersion);
    setMigrationLogs(DataMigrationService.getMigrationLogs());
  }, []);

  // ذخیره کلید ادمین
  const handleSaveAdminKey = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingKey(true);
    UpdateDetectorService.saveAdminKey(adminKey);
    setKeyNotice('✅ کلید ادمین با موفقیت در این مرورگر ذخیره شد.');
    setTimeout(() => {
      setIsSavingKey(false);
      setKeyNotice('');
    }, 3000);
  };

  // بررسی دستی نسخه جدید
  const handleManualCheck = async () => {
    setIsCheckingUpdate(true);
    UpdateDetectorService.clearSnooze();
    try {
      const res = await UpdateDetectorService.checkForUpdate();
      setUpdateStatus({
        hasUpdate: res.hasUpdate,
        remoteVersion: res.newVersion,
        checkedAt: new Date().toLocaleTimeString('fa-IR'),
      });
    } catch {
      setUpdateStatus({
        hasUpdate: false,
        remoteVersion: null,
        checkedAt: new Date().toLocaleTimeString('fa-IR'),
      });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  // تریگر دیپلوی از پنل
  const handleTriggerDeploy = async () => {
    if (!adminKey.trim()) {
      setDeployFeedback({
        success: false,
        message: 'لطفاً ابتدا کلید احراز هویت ادمین را در بخش زیر وارد و ذخیره نمایید.',
      });
      return;
    }

    setIsDeploying(true);
    setDeployFeedback(null);

    const res = await UpdateDetectorService.triggerProductionDeploy(adminKey.trim(), targetEnv);
    setIsDeploying(false);
    setDeployFeedback({
      success: res.success,
      message: res.message,
      details: res.details,
    });
  };

  // دانلود بکاپ کامل داده‌ها قبل از آپدیت
  const handleDownloadSafetyBackup = () => {
    try {
      const json = DataMigrationService.exportFullSafetyBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `keeppass-safety-backup-v${CURRENT_SCHEMA_VERSION}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupDownloadNotice('✅ فایل پشتیبان اضطراری با موفقیت ذخیره شد.');
      setTimeout(() => setBackupDownloadNotice(''), 4000);
    } catch (err) {
      setBackupDownloadNotice('❌ خطا در ایجاد فایل پشتیبان.');
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* کارت اصلی سرتیتر */}
      <div 
        className="p-6 rounded-3xl border border-[#1F2B47] bg-[#0F1524] shadow-xl relative overflow-hidden"
        style={{ borderColor: 'var(--ui-border)' }}
      >
        <div className="absolute top-0 left-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 p-0.5 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <div className="w-full h-full bg-[#0A0D14] rounded-[14px] flex items-center justify-center">
                  <Rocket className="w-6 h-6 text-amber-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-white">مدیریت انتشار و به‌روزرسانی (DevOps)</h2>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                    isAdmin 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>
                    {isAdmin ? 'دسترسی ادمین تایید شده' : 'فقط مشاهده (نیاز به اکانت ادمین)'}
                  </span>
                </div>
                <p className="text-xs text-[#94A2C2] mt-0.5">
                  ارزیابی تغییرات در محیط Staging، تایید انتشار نهایی به Production و تضمین حفظ داده‌های کاربران
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualCheck}
              disabled={isCheckingUpdate}
              className="px-4 py-2.5 rounded-xl bg-[#1A2338] hover:bg-[#222E49] border border-[#2B3A5E] text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-amber-400 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
              <span>{isCheckingUpdate ? 'در حال پایش...' : 'بررسی دستی نسخه جدید'}</span>
            </button>
          </div>
        </div>

        {/* جعبه متادیتای نسخه جاری */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-[#0A0D14] border border-[#1F2B47]">
            <div className="text-[10px] text-[#94A2C2] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>نسخه جاری برنامه</span>
            </div>
            <div className="text-sm font-mono font-bold text-white mt-1">
              v{localVersion?.version || '1.0.0'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#0A0D14] border border-[#1F2B47]">
            <div className="text-[10px] text-[#94A2C2] flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-blue-400" />
              <span>کامیت گیت</span>
            </div>
            <div className="text-sm font-mono font-bold text-white mt-1">
              {localVersion?.gitCommit || 'c-prod'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#0A0D14] border border-[#1F2B47]">
            <div className="text-[10px] text-[#94A2C2] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span>زمان بیلد</span>
            </div>
            <div className="text-xs font-mono font-medium text-slate-300 mt-1 truncate">
              {localVersion?.buildTime ? new Date(localVersion.buildTime).toLocaleDateString('fa-IR') : 'هم‌اکنون'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#0A0D14] border border-[#1F2B47]">
            <div className="text-[10px] text-[#94A2C2] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>نسخه اسکیما (مایگریشن)</span>
            </div>
            <div className="text-sm font-mono font-bold text-emerald-400 mt-1">
              Schema v{CURRENT_SCHEMA_VERSION}
            </div>
          </div>
        </div>

        {/* نتیجه بررسی دستی نسخه */}
        {updateStatus && (
          <div className="mt-4 p-4 rounded-2xl border bg-[#0A0D14] border-[#1F2B47] text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {updateStatus.hasUpdate ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                <span className="font-bold text-white">
                  {updateStatus.hasUpdate 
                    ? `🎉 نسخه جدیدتر در دسترس است: v${updateStatus.remoteVersion?.version} (${updateStatus.remoteVersion?.gitCommit})`
                    : 'شما در حال استفاده از آخرین نسخه موجود هستید.'}
                </span>
              </div>
              <span className="text-[11px] text-[#94A2C2]">آخرین بررسی: {updateStatus.checkedAt}</span>
            </div>

            {updateStatus.hasUpdate && updateStatus.remoteVersion?.changelog && (
              <div className="mt-3 pt-3 border-t border-[#1F2B47] text-slate-300">
                <div className="text-[11px] font-bold text-amber-400 mb-1">تغییرات آماده انتشار:</div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  {updateStatus.remoteVersion.changelog.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* گام‌های انتشار و اکشن‌های ادمین */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* کارت تایید و انتشار با یک کلیک */}
        <div 
          className="p-6 rounded-3xl border border-[#1F2B47] bg-[#0F1524] space-y-4"
          style={{ borderColor: 'var(--ui-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">انتشار روی سایت اصلی (Production Trigger)</h3>
              <p className="text-xs text-[#94A2C2]">
                ارسال درخواست امن از طریق بک‌اند جهت آغاز دیپلوی نهایی
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">محیط هدف استقرار:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetEnv('production')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    targetEnv === 'production'
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-[#0A0D14] border-[#1F2B47] text-[#94A2C2]'
                  }`}
                >
                  سایت اصلی (Production)
                </button>
                <button
                  type="button"
                  onClick={() => setTargetEnv('staging')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    targetEnv === 'staging'
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                      : 'bg-[#0A0D14] border-[#1F2B47] text-[#94A2C2]'
                  }`}
                >
                  پیش‌نمایش (Staging)
                </button>
              </div>
            </div>

            {/* بازخورد دیپلوی */}
            {deployFeedback && (
              <div 
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  deployFeedback.success
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                }`}
              >
                {deployFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-bold">{deployFeedback.message}</div>
                  {deployFeedback.details && (
                    <div className="text-[11px] opacity-80 mt-1">{deployFeedback.details}</div>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={isDeploying || !isAdmin}
              onClick={handleTriggerDeploy}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition cursor-pointer"
            >
              {isDeploying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال برقراری ارتباط با سرویس استقرار...</span>
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  <span>انتشار روی سایت اصلی (Production)</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-[#94A2C2] text-center">
              توکن‌های حساس گیت‌هاب در بک‌اند نگهداری می‌شوند و هرگز در فرانت‌اند افشا نمی‌شوند.
            </p>
          </div>
        </div>

        {/* کارت تنظیم کلید احراز هویت ادمین */}
        <div 
          className="p-6 rounded-3xl border border-[#1F2B47] bg-[#0F1524] space-y-4"
          style={{ borderColor: 'var(--ui-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">کلید احراز هویت ادمین (Admin Key)</h3>
              <p className="text-xs text-[#94A2C2]">
                کلید امن جهت تایید هویت شما برای فعال‌سازی دیپلوی از کلاینت
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveAdminKey} className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                کلید مخفی ادمین (مطابق با ADMIN_SECRET_KEY در .env):
              </label>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="مثلاً: admin123456"
                className="w-full px-3.5 py-2.5 bg-[#0A0D14] border border-[#1F2B47] rounded-xl text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            {keyNotice && (
              <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs">
                {keyNotice}
              </div>
            )}

            <button
              type="submit"
              disabled={isSavingKey}
              className="w-full py-2.5 px-4 rounded-xl bg-[#1A2338] hover:bg-[#222E49] border border-[#2B3A5E] text-white text-xs font-bold transition cursor-pointer"
            >
              ذخیره کلید ادمین در این مرورگر
            </button>
            <p className="text-[11px] text-[#94A2C2]">
              نام کاربری مجاز ادمین: <code className="text-amber-400 font-mono">admin</code> (یا مقدار <code className="text-amber-400 font-mono">VITE_ADMIN_USERNAME</code>)
            </p>
          </form>
        </div>
      </div>

      {/* بخش مصونیت ۱۰۰٪ داده‌ها و سیستم مایگریشن */}
      <div 
        className="p-6 rounded-3xl border border-[#1F2B47] bg-[#0F1524] space-y-4"
        style={{ borderColor: 'var(--ui-border)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">تضمین مصونیت داده‌های کاربران (Idempotent Migration)</h3>
              <p className="text-xs text-[#94A2C2]">
                پایداری داده‌های رمزنگاری شده در localStorage بدون هیچ‌گونه ریسک حذف یا تداخل
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadSafetyBackup}
            className="px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 transition cursor-pointer self-start sm:self-auto"
          >
            <Download className="w-4 h-4" />
            <span>دانلود فایل پشتیبان اضطراری (JSON)</span>
          </button>
        </div>

        {backupDownloadNotice && (
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs">
            {backupDownloadNotice}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3.5 rounded-2xl bg-[#0A0D14] border border-[#1F2B47] space-y-1">
            <div className="text-amber-400 font-bold">۱. خاصیت Idempotent</div>
            <p className="text-[#94A2C2] text-[11px]">
              تابع مایگریشن در هر بار لود برنامه اجرا می‌شود و در صورت تطابق نسخه، بدون هیچ اثر جانبی رد می‌شود.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#0A0D14] border border-[#1F2B47] space-y-1">
            <div className="text-blue-400 font-bold">۲. معماری افزایشی (Additive)</div>
            <p className="text-[#94A2C2] text-[11px]">
              هیچ فیلد یا کلیدی حذف نمی‌شود؛ تنها فیلدهای جدید ساختار بدون دستکاری پسوردهای رمزنگاری شده تزریق می‌شوند.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#0A0D14] border border-[#1F2B47] space-y-1">
            <div className="text-emerald-400 font-bold">۳. اسنپ‌شات خودکار محلی</div>
            <p className="text-[#94A2C2] text-[11px]">
              پیش از هر ارتقای ساختار، یک رونوشت کامل از تمام کلیدها در حافظه مرورگر پشتیبان‌گیری می‌شود.
            </p>
          </div>
        </div>

        {/* لاگ‌های آخرین مایگریشن‌ها */}
        {migrationLogs.length > 0 && (
          <div className="pt-3 border-t border-[#1F2B47]">
            <div className="text-xs font-bold text-white mb-2">تاریخچه ارتقای ساختار داده در این سیستم:</div>
            <div className="space-y-1.5 font-mono text-[11px]">
              {migrationLogs.slice(0, 3).map((log, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-[#0A0D14] border border-[#1F2B47] flex items-center justify-between text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Schema v{log.fromVersion} ➔ v{log.toVersion}</span>
                    <span className="text-[#94A2C2]">({log.keysMigrated} رکورد بهینه‌سازی شد)</span>
                  </div>
                  <span className="text-[#94A2C2]">{new Date(log.timestamp).toLocaleDateString('fa-IR')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
