/**
 * src/components/DeploymentManagerTab.tsx
 * "Version & updates" settings tab.
 *
 * Deploys are fully automatic now (git push → GitHub Actions → Cloudflare), so this tab only
 * shows which build is running, lets the user check for / apply a new version, and download
 * a raw safety backup of this browser's storage.
 */
import React, { useEffect, useState } from 'react';
import {
  Rocket,
  RefreshCw,
  GitBranch,
  Clock,
  CheckCircle2,
  Download,
  Loader2,
  Sparkles,
  History,
} from 'lucide-react';
import { UpdateDetectorService, UpdateState } from '../services/updateDetector';
import { DataMigrationService } from '../services/dataMigration';

export const DeploymentManagerTab: React.FC = () => {
  const current = UpdateDetectorService.current;
  const [state, setState] = useState<UpdateState>(() => UpdateDetectorService.getState());
  const [isChecking, setIsChecking] = useState(false);
  const [checkedOnce, setCheckedOnce] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => UpdateDetectorService.subscribe(setState), []);

  const handleCheck = async () => {
    setIsChecking(true);
    setNotice('');
    const res = await UpdateDetectorService.checkForUpdate();
    setIsChecking(false);
    setCheckedOnce(true);
    if (!res.hasUpdate) setNotice('✅ شما از آخرین نسخه استفاده می‌کنید.');
  };

  const handleDownloadSafetyBackup = () => {
    const blob = new Blob([DataMigrationService.exportFullSafetyBackup()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keeppass-raw-storage-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setNotice('✅ نسخه پشتیبان خام (رمزنگاری‌شده) این مرورگر دانلود شد.');
  };

  const logs = DataMigrationService.getMigrationLogs();

  return (
    <div className="space-y-6">
      <div
        className="p-6 rounded-3xl bg-[#121A2C] border border-[#1F2B47] space-y-5 shadow-xl"
        style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-white" style={{ color: 'var(--ui-text-primary)' }}>
              نسخه برنامه و به‌روزرسانی
            </h3>
            <p className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>
              هر تغییر جدید به‌صورت خودکار منتشر می‌شود و همین‌جا اطلاع داده می‌شود.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[#0F1524] border border-[#1F2B47]" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
            <div className="text-[#94A2C2] mb-1">نسخه فعلی</div>
            <div className="font-mono font-bold text-white">
              {current.version} <span className="text-[#94A2C2]">({current.gitCommit})</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#0F1524] border border-[#1F2B47]" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
            <div className="text-[#94A2C2] mb-1 flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5" /> محیط
            </div>
            <div className="font-mono font-bold text-white">
              {current.environment} / {current.gitBranch}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#0F1524] border border-[#1F2B47]" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
            <div className="text-[#94A2C2] mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> زمان انتشار
            </div>
            <div className="font-bold text-white">{new Date(current.buildTime).toLocaleString('fa-IR')}</div>
          </div>
        </div>

        {state.hasUpdate && (
          <div className="p-4 rounded-2xl bg-[#4F7CFF]/10 border border-[#4F7CFF]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-white">
              <Sparkles className="w-4 h-4 text-[#38E1FF]" />
              <span>
                نسخه جدید {state.remote ? `${state.remote.version} (${state.remote.gitCommit})` : ''} آماده است.
              </span>
            </div>
            <button
              type="button"
              onClick={() => UpdateDetectorService.applyUpdate()}
              className="py-2 px-4 rounded-xl bg-[#4F7CFF] hover:bg-[#3E6AF0] text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> به‌روزرسانی الان
            </button>
          </div>
        )}

        {notice && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCheck}
            disabled={isChecking}
            className="py-2.5 px-4 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-white text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-60"
            style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
          >
            {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-[#38E1FF]" />}
            <span>{checkedOnce ? 'بررسی دوباره' : 'بررسی نسخه جدید'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadSafetyBackup}
            className="py-2.5 px-4 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
            style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>دانلود پشتیبان خام این مرورگر</span>
          </button>
        </div>
      </div>

      {logs.length > 0 && (
        <div
          className="p-6 rounded-3xl bg-[#121A2C] border border-[#1F2B47] space-y-3 shadow-xl"
          style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
        >
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-[#94A2C2]" /> تاریخچه مهاجرت داده‌ها
          </h4>
          <ul className="space-y-1.5 text-[11px] text-[#94A2C2]">
            {logs.map((log, i) => (
              <li key={i} className="flex flex-wrap gap-x-3">
                <span className="font-mono">{new Date(log.timestamp).toLocaleString('fa-IR')}</span>
                <span>
                  v{log.fromVersion} → v{log.toVersion}
                </span>
                <span className={log.success ? 'text-emerald-400' : 'text-rose-400'}>
                  {log.success ? 'موفق' : 'ناموفق'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
