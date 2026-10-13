/**
 * Cloud auto-sync UI: a small status icon for the header and a banner that asks the user
 * which copy to keep when another device saved newer data.
 */
import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, CloudAlert, RefreshCw, Check, X } from 'lucide-react';
import { AutoSyncService, AutoSyncState } from '../services/autoSync';

export function useAutoSyncState(): AutoSyncState {
  const [state, setState] = useState<AutoSyncState>(() => AutoSyncService.getState());
  useEffect(() => AutoSyncService.subscribe(setState), []);
  return state;
}

export function describeSync(state: AutoSyncState): { text: string; tone: 'ok' | 'busy' | 'warn' | 'off' } {
  switch (state.status) {
    case 'synced':
      return { text: state.lastSyncAt ? `ذخیره ابری: ${timeAgo(state.lastSyncAt)}` : 'ذخیره ابری به‌روز است', tone: 'ok' };
    case 'pending':
      return { text: 'تغییرات به‌زودی در ابر ذخیره می‌شوند', tone: 'busy' };
    case 'syncing':
      return { text: 'در حال ذخیره ابری...', tone: 'busy' };
    case 'offline':
      return { text: state.message || 'در انتظار اتصال به اینترنت', tone: 'warn' };
    case 'conflict':
      return { text: state.message || 'نسخه جدیدتری در ابر هست', tone: 'warn' };
    case 'error':
      return { text: state.message || 'ذخیره ابری انجام نشد', tone: 'warn' };
    case 'idle':
      return { text: 'همگام‌سازی خودکار فعال است', tone: 'ok' };
    default:
      return { text: 'همگام‌سازی خودکار خاموش است', tone: 'off' };
  }
}

export function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'همین الان';
  if (min < 60) return `${min} دقیقه پیش`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ساعت پیش`;
  return new Date(iso).toLocaleDateString('fa-IR');
}

/** Header icon: green = saved, spinning = saving, amber = needs attention, grey = off. */
export const SyncStatusIndicator: React.FC<{ onOpen?: () => void }> = ({ onOpen }) => {
  const state = useAutoSyncState();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  if (state.status === 'disabled') return null;
  const { text, tone } = describeSync(state);
  const color =
    tone === 'ok' ? 'text-emerald-400' : tone === 'busy' ? 'text-[#38E1FF]' : tone === 'warn' ? 'text-amber-400' : 'text-[#5D6B8F]';
  const Icon =
    state.status === 'syncing' || state.status === 'pending'
      ? RefreshCw
      : state.status === 'offline'
        ? CloudOff
        : state.status === 'conflict' || state.status === 'error'
          ? CloudAlert
          : Cloud;

  return (
    <button
      type="button"
      onClick={onOpen}
      title={text}
      aria-label={text}
      className="relative p-2 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] cursor-pointer transition"
      style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
    >
      <Icon className={`w-4 h-4 ${color} ${state.status === 'syncing' ? 'animate-spin' : ''}`} />
      {state.status === 'synced' && (
        <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center">
          <Check className="w-2 h-2 text-white" strokeWidth={4} />
        </span>
      )}
      {(state.status === 'conflict' || state.status === 'error') && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400" />
      )}
    </button>
  );
};

/** Asks which copy to keep when the cloud has newer data from another device. */
export const SyncConflictBanner: React.FC = () => {
  const state = useAutoSyncState();
  const [busy, setBusy] = useState<'use-cloud' | 'use-device' | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (state.status === 'conflict') setHidden(false);
  }, [state.status]);

  useEffect(() => {
    if (!result?.ok) return;
    const t = window.setTimeout(() => setResult(null), 4000);
    return () => window.clearTimeout(t);
  }, [result]);

  if (result?.ok) {
    return (
      <div dir="rtl" className="fixed top-[calc(env(safe-area-inset-top,0px)+4.5rem)] left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50">
        <div className="p-3 rounded-2xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-2 shadow-2xl backdrop-blur">
          <Check className="w-4 h-4 shrink-0" /> {result.text}
        </div>
      </div>
    );
  }

  if (state.status !== 'conflict' || hidden) return null;

  const choose = async (choice: 'use-cloud' | 'use-device') => {
    setBusy(choice);
    const res = await AutoSyncService.resolveConflict(choice);
    setBusy(null);
    setConfirmReplace(false);
    setResult({ ok: res.success, text: res.message });
  };

  return (
    <div
      dir="rtl"
      role="alertdialog"
      className="fixed top-[calc(env(safe-area-inset-top,0px)+4.5rem)] left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50"
    >
      <div className="p-4 rounded-2xl bg-slate-900/95 border border-amber-500/40 shadow-2xl backdrop-blur-xl text-slate-100 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <CloudAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold">نسخه جدیدتری در فضای ابری هست</h4>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                احتمالاً از دستگاه دیگری تغییراتی ذخیره شده. همگام‌سازی خودکار متوقف شد تا چیزی بازنویسی نشود. کدام نسخه نگه داشته شود؟
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHidden(true)}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
            aria-label="بعداً"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {result && !result.ok && (
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px]">{result.text}</div>
        )}

        {!confirmReplace ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => choose('use-cloud')}
              className="py-2.5 px-3 rounded-xl bg-[#4F7CFF] hover:bg-[#3E6AF0] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {busy === 'use-cloud' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
              دریافت نسخه ابری (پیشنهادی)
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => setConfirmReplace(true)}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              نگه داشتن اطلاعات این دستگاه
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-amber-300">
              نسخه ابری با اطلاعات این دستگاه جایگزین می‌شود و تغییرات دستگاه دیگر از ابر حذف می‌شوند. مطمئن هستید؟
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!!busy}
                onClick={() => choose('use-device')}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {busy === 'use-device' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                بله، جایگزین کن
              </button>
              <button
                type="button"
                onClick={() => setConfirmReplace(false)}
                className="py-2 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
