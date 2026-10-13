import React, { useState } from 'react';
import { 
  X, 
  Smartphone, 
  KeyRound, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  ChevronLeft, 
  Lock, 
  SlidersHorizontal,
  ExternalLink
} from 'lucide-react';
import { IOSAutoFillService } from '../services/iosAutofill';

interface IOSAutoFillModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterPassword?: string;
}

export const IOSAutoFillModal: React.FC<IOSAutoFillModalProps> = ({
  isOpen,
  onClose,
  masterPassword,
}) => {
  const [testPassword, setTestPassword] = useState(masterPassword || '');
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSaveToKeychain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPassword) return;

    setIsSaving(true);
    setSaveStatus('در حال ارسال درخواست به جاکلیدی آیفون...');

    try {
      const success = await IOSAutoFillService.saveMasterPasswordToKeychain(testPassword, 'گاوصندوق رمزها');
      if (success) {
        setSaveStatus('✅ درخواست ذخیره در Keychain ارسال شد! آیفون ممکن است پیامی با عنوان "Save Password" نمایش دهد.');
      } else {
        setSaveStatus('ℹ️ فرم استاندارد فعال شد. برای ذخیره، کافیست یک بار با این فرم در آیفون لاگین کنید تا سافاری آن را به طور خودکار پیشنهاد دهد.');
      }
    } catch {
      setSaveStatus('فرم برای شناسایی توسط AutoFill آیفون آماده است.');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(''), 7000);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
      }}
    >
      <div 
        className="w-full max-w-lg bg-[#121A2C] border border-[#1F2B47] rounded-3xl p-5 sm:p-7 shadow-2xl relative my-auto max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-2rem)] overflow-y-auto text-right"
        style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1F2B47]" style={{ borderColor: 'var(--ui-border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] p-0.5 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-white flex items-center gap-1.5">
                راهنمای Fill Password در آیفون
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#007AFF]/20 text-[#38E1FF] border border-[#007AFF]/30">
                  iOS AutoFill
                </span>
              </h3>
              <p className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>
                تنظیم ورود سریع ۱-کلیکه با فیس‌آیدی و کیبورد آیفون
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#0F1524] text-[#94A2C2] hover:text-white transition cursor-pointer"
            style={{ backgroundColor: 'var(--ui-surface-subtle)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hero Visual Mockup of iPhone AutoFill */}
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-b from-[#0F1524] to-[#162035] border border-[#1F2B47] text-center" style={{ borderColor: 'var(--ui-border)' }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>نوار بالای کیبورد آیفون در هنگام ورود</span>
          </div>

          {/* Keyboard AutoFill Bar Simulation */}
          <div className="max-w-xs mx-auto bg-[#2C2C2E] border border-white/10 rounded-xl p-2 shadow-xl flex items-center justify-between text-xs text-white">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-300">سایت گاوصندوق:</span>
            </div>
            <div className="px-3 py-1 rounded-lg bg-[#007AFF] text-white font-bold flex items-center gap-1.5 shadow-md">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Passwords 🔑</span>
            </div>
          </div>
          <p className="text-[11px] text-[#94A2C2] mt-2">
            با یک بار زدن این دکمه آبی، آیفون چهره شما را اسکن کرده و رمز را به صورت خودکار پر می‌کند.
          </p>
        </div>

        {/* 3 Step Visual Guide */}
        <div className="mt-5 space-y-3">
          <h4 className="font-bold text-xs text-[#94A2C2] uppercase tracking-wider" style={{ color: 'var(--ui-text-secondary)' }}>
            مراحل فعال‌سازی در ۳ قدم ساده:
          </h4>

          {/* Step 1 */}
          <div className="p-3.5 rounded-xl bg-[#0F1524] border border-[#1F2B47] flex items-start gap-3" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
            <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              ۱
            </div>
            <div className="text-xs">
              <p className="font-bold text-white">روشن کردن AutoFill در تنظیمات آیفون</p>
              <p className="text-[#94A2C2] mt-0.5 leading-relaxed" style={{ color: 'var(--ui-text-secondary)' }}>
                در آیفون خود به مسیر <span className="text-blue-400 font-mono">Settings ➔ Passwords ➔ Password Options</span> بروید و تیک گزینه <strong className="text-white">AutoFill Passwords and Passkeys</strong> را فعال کنید.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-xl bg-[#0F1524] border border-[#1F2B47] flex items-start gap-3" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
            <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              ۲
            </div>
            <div className="text-xs">
              <p className="font-bold text-white">ذخیره رمز هنگام اولین ورود</p>
              <p className="text-[#94A2C2] mt-0.5 leading-relaxed" style={{ color: 'var(--ui-text-secondary)' }}>
                وقتی برای بار اول رمز اصلی را تایپ می‌کنید، مرورگر سافاری آیفون یک کادر در پایین صفحه باز می‌کند: <strong className="text-white">"Save Password?"</strong> کافیست دکمه Save را بزنید.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-xl bg-[#0F1524] border border-[#1F2B47] flex items-start gap-3" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              ۳
            </div>
            <div className="text-xs">
              <p className="font-bold text-white">ورود فوق‌سریع در دفعات بعد</p>
              <p className="text-[#94A2C2] mt-0.5 leading-relaxed" style={{ color: 'var(--ui-text-secondary)' }}>
                در دفعات بعدی، تنها با لمس کادر رمز یا دکمه «ورود با Fill Password»، نوار بالای کیبورد آیفون دکمه <strong className="text-white">Passwords</strong> را پیشنهاد می‌دهد و با تایید فیس‌آیدی وارد می‌شوید!
              </p>
            </div>
          </div>
        </div>

        {/* Live Keychain Test Form */}
        <div className="mt-5 p-4 rounded-2xl bg-[#0F1524] border border-[#1F2B47]" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-blue-400" />
            <h4 className="font-bold text-xs text-white">تست فوری و ذخیره در جاکلیدی (iCloud Keychain)</h4>
          </div>
          <p className="text-[11px] text-[#94A2C2] mb-3" style={{ color: 'var(--ui-text-secondary)' }}>
            می‌توانید همین الان با فشردن دکمه زیر، درخواست ثبت این رمز در جاکلیدی آیفون را فعال کنید:
          </p>

          <form onSubmit={handleSaveToKeychain} className="space-y-3" autoComplete="on">
            <input 
              type="text" 
              name="username" 
              id="ios-keychain-user" 
              defaultValue="vault-master" 
              autoComplete="username" 
              className="hidden" 
              aria-hidden="true" 
            />
            <div className="relative">
              <input
                type="password"
                name="password"
                id="ios-keychain-pass"
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                placeholder="رمز اصلی گاوصندوق..."
                autoComplete="current-password"
                className="w-full bg-[#121A2C] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
              />
            </div>

            <button
              type="submit"
              disabled={isSaving || !testPassword}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#007AFF] to-[#5856D6] hover:opacity-95 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>در حال فعال‌سازی...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>ثبت در جاکلیدی آیفون (Trigger Keychain Save)</span>
                </>
              )}
            </button>
          </form>

          {saveStatus && (
            <div className="mt-2.5 p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-[11px] text-blue-300 text-center leading-normal">
              {saveStatus}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white text-xs font-semibold transition cursor-pointer"
          >
            متوجه شدم، بستن
          </button>
        </div>
      </div>
    </div>
  );
};
