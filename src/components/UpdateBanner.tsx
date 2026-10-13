/**
 * src/components/UpdateBanner.tsx
 * Shown to every user when a newer version has been deployed (automatic deploy on git push).
 * The user decides when to reload, so nothing in progress is lost.
 */
import React, { useEffect, useState } from 'react';
import { RefreshCw, X, Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { UpdateDetectorService, UpdateState } from '../services/updateDetector';

const SNOOZE_MS = 30 * 60 * 1000;

export const UpdateBanner: React.FC = () => {
  const [state, setState] = useState<UpdateState>(() => UpdateDetectorService.getState());
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    UpdateDetectorService.start();
    return UpdateDetectorService.subscribe(setState);
  }, []);

  if (!state.hasUpdate || Date.now() < snoozedUntil) return null;

  const remote = state.remote;
  const changelog = remote?.changelog?.filter(Boolean) ?? [];

  const handleApply = async () => {
    setIsApplying(true);
    await UpdateDetectorService.applyUpdate();
  };

  return (
    <div
      dir="rtl"
      role="status"
      className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] lg:bottom-6 left-4 right-4 md:right-auto md:left-6 md:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="bg-slate-900/95 border border-[#4F7CFF]/40 rounded-2xl p-4 shadow-2xl backdrop-blur-xl text-slate-100 ring-1 ring-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#4F7CFF] to-[#38E1FF] flex items-center justify-center text-white shadow-lg shadow-[#4F7CFF]/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">نسخه جدید KeepPass منتشر شد</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                برای دریافت آخرین تغییرات به‌روزرسانی کنید. داده‌های شما حفظ می‌شوند.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSnoozedUntil(Date.now() + SNOOZE_MS)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer"
            title="بستن"
            aria-label="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {remote && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-[11px] text-slate-400 hover:text-[#38E1FF] flex items-center gap-1 transition-colors cursor-pointer"
            >
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>
                نسخه {remote.version} <span className="font-mono">({remote.gitCommit})</span> — جزئیات
              </span>
            </button>
            {showDetails && (
              <div className="mt-2 p-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-[11px] space-y-1">
                {changelog.length > 0 ? (
                  <ul className="list-disc list-inside space-y-0.5 text-slate-300" dir="auto">
                    {changelog.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-slate-400">بهبودها و رفع اشکال</div>
                )}
                <div className="text-slate-500 pt-1">
                  زمان انتشار: {new Date(remote.buildTime).toLocaleString('fa-IR')}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={isApplying}
            onClick={handleApply}
            className="flex-1 py-2 px-3 rounded-xl bg-[#4F7CFF] hover:bg-[#3E6AF0] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#4F7CFF]/20 disabled:opacity-60 transition-all cursor-pointer"
          >
            {isApplying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>{isApplying ? 'در حال به‌روزرسانی...' : 'به‌روزرسانی الان'}</span>
          </button>
          <button
            type="button"
            disabled={isApplying}
            onClick={() => setSnoozedUntil(Date.now() + SNOOZE_MS)}
            className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
          >
            بعداً
          </button>
        </div>
        <p className="mt-2 text-[10px] text-slate-500">
          پس از به‌روزرسانی، برای امنیت باید دوباره وارد گاوصندوق شوید.
        </p>
      </div>
    </div>
  );
};
