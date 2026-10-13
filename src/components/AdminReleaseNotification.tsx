/**
 * src/components/AdminReleaseNotification.tsx
 * Admin Release Notification Modal & Banner
 * 
 * ویژگی‌ها:
 * ۱. راست‌به‌چپ (RTL) و کاملاً فارسی طبق نیازمندی
 * ۲. متن شفاف «نسخه جدید آماده انتشار است» با دکمه‌های «انتشار روی سایت اصلی» و «بعداً»
 * ۳. نمایش امن فقط برای کاربر Admin
 * ۴. دریافت کلید ادمین در صورت عدم ذخیره قبلی و ارسال امن به اندپوینت /api/trigger-deploy
 * ۵. طراحی شکیل با تم دارک/لایت هماهنگ با دیزاین سیستم
 */

import React, { useState, useEffect } from 'react';
import { 
  Rocket, 
  GitBranch, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Loader2, 
  KeyRound, 
  ExternalLink,
  ShieldAlert,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { VersionInfo, UpdateDetectorService } from '../services/updateDetector';

interface AdminReleaseNotificationProps {
  currentUsername: string;
  onDeployTriggered?: () => void;
}

export const AdminReleaseNotification: React.FC<AdminReleaseNotificationProps> = ({
  currentUsername,
  onDeployTriggered,
}) => {
  const [newVersion, setNewVersion] = useState<VersionInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showAdminKeyPrompt, setShowAdminKeyPrompt] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState(() => UpdateDetectorService.getStoredAdminKey());
  const [showDetails, setShowDetails] = useState(false);

  const isAdmin = UpdateDetectorService.isAdminUser(currentUsername);

  // بررسی دوره‌ای وجود نسخه جدید (هر ۶۰ ثانیه و هنگام فعال شدن تب)
  useEffect(() => {
    if (!isAdmin) return;

    let isMounted = true;

    const performCheck = async () => {
      const res = await UpdateDetectorService.checkForUpdate();
      if (isMounted && res.hasUpdate && res.newVersion) {
        setNewVersion(res.newVersion);
        setIsOpen(true);
      }
    };

    // بررسی اولیه با کمی تاخیر پس از لود صفحه
    const timer = setTimeout(performCheck, 2500);

    // پایش هر ۹۰ ثانیه
    const interval = setInterval(performCheck, 90000);

    // بررسی هنگام بازگشت کاربر به تب مرورگر
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        performCheck();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAdmin]);

  // اگر کاربر ادمین نیست یا نسخه‌ای کشف نشده، هیچ چیز رندر نکن
  if (!isAdmin || !isOpen || !newVersion) {
    return null;
  }

  const handleSnooze = () => {
    if (newVersion) {
      UpdateDetectorService.snoozeUpdate(newVersion.gitCommit);
    }
    setIsOpen(false);
  };

  const handleTriggerDeploy = async () => {
    const keyToUse = adminKeyInput.trim();
    if (!keyToUse) {
      setShowAdminKeyPrompt(true);
      return;
    }

    setIsDeploying(true);
    setDeployResult(null);

    // ذخیره کلید برای استفاده‌های بعدی
    UpdateDetectorService.saveAdminKey(keyToUse);

    const result = await UpdateDetectorService.triggerProductionDeploy(keyToUse, 'production');
    setIsDeploying(false);
    setDeployResult(result);

    if (result.success) {
      onDeployTriggered?.();
      // بستن بنر پس از چند ثانیه موفقیت
      setTimeout(() => {
        handleSnooze();
      }, 5000);
    }
  };

  return (
    <div 
      dir="rtl"
      className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] lg:bottom-6 left-4 right-4 md:right-auto md:left-6 md:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="bg-slate-900/95 dark:bg-slate-900/95 border border-amber-500/30 rounded-2xl p-5 shadow-2xl backdrop-blur-xl text-slate-100 ring-1 ring-white/10">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20 shrink-0">
              <Rocket className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white tracking-tight">
                  نسخه جدید آماده انتشار است
                </h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Admin Alert
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تغییرات در محیط Staging تست شده و آماده ارتقای Production است.
              </p>
            </div>
          </div>

          <button
            onClick={handleSnooze}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/80 transition-colors"
            title="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Version Badge & Info */}
        <div className="mt-4 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-300">
            <GitBranch className="w-3.5 h-3.5 text-amber-400" />
            <span>نسخه {newVersion.version}</span>
            <span className="text-slate-500">({newVersion.gitCommit})</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Clock className="w-3.5 h-3.5" />
            <span>{new Date(newVersion.buildTime).toLocaleDateString('fa-IR')}</span>
          </div>
        </div>

        {/* Collapsible Details */}
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
          >
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>مشاهده تغییرات و جزئیات انتشار</span>
          </button>

          {showDetails && (
            <div className="mt-2 p-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-[11px] space-y-1.5 animate-in fade-in">
              <div className="text-slate-400">تغییرات این نسخه:</div>
              {newVersion.changelog && newVersion.changelog.length > 0 ? (
                <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                  {newVersion.changelog.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-slate-400">به‌روزرسانی ساختار و رفع باگ‌ها</div>
              )}
            </div>
          )}
        </div>

        {/* Admin Key Prompt (If not set) */}
        {showAdminKeyPrompt && (
          <div className="mt-3 p-3 rounded-xl bg-amber-950/30 border border-amber-600/40 text-xs space-y-2 animate-in fade-in">
            <div className="flex items-center gap-1.5 text-amber-300 font-medium">
              <KeyRound className="w-3.5 h-3.5" />
              <span>کلید احراز هویت ادمین را وارد نمایید:</span>
            </div>
            <input
              type="password"
              placeholder="Admin Secret Key (از متغیرهای محیطی)"
              value={adminKeyInput}
              onChange={(e) => setAdminKeyInput(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        )}

        {/* Result Feedback */}
        {deployResult && (
          <div 
            className={`mt-3 p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
              deployResult.success 
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}
          >
            {deployResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="flex-1">{deployResult.message}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            disabled={isDeploying}
            onClick={handleTriggerDeploy}
            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isDeploying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>در حال آغاز انتشار...</span>
              </>
            ) : (
              <>
                <Rocket className="w-3.5 h-3.5" />
                <span>انتشار روی سایت اصلی</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isDeploying}
            onClick={handleSnooze}
            className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
          >
            بعداً
          </button>
        </div>
      </div>
    </div>
  );
};
