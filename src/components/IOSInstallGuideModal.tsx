import React from 'react';
import { Share, PlusSquare, Smartphone, CheckCircle2, X, Sparkles, ShieldCheck } from 'lucide-react';

interface IOSInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IOSInstallGuideModal: React.FC<IOSInstallGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
      }}
    >
      <div 
        className="w-full max-w-md bg-[#121A2C] border border-[#1F2B47] text-[#E7EDFA] rounded-2xl p-6 shadow-2xl relative overflow-hidden my-auto max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-2rem)] overflow-y-auto"
        style={{
          backgroundColor: 'var(--ui-surface)',
          borderColor: 'var(--ui-border)',
          color: 'var(--ui-text)',
        }}
      >
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-[#4F7CFF]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-[#8A5CFF]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1F2B47]" style={{ borderColor: 'var(--ui-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F7CFF] to-[#8A5CFF] flex items-center justify-center text-white shadow-lg shadow-[#4F7CFF]/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">نصب KeepPass روی آیفون</h3>
              <p className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>اجرا بدون نوار آدرس مثل اپلیکیشن اختصاصی iOS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A2C2] hover:text-white hover:bg-[#182239] transition"
            style={{ color: 'var(--ui-text-secondary)' }}
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visual Steps */}
        <div className="mt-5 space-y-4">
          {/* Step 1 */}
          <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[#0F1524] border border-[#1F2B47]/80" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
            <div className="w-8 h-8 rounded-lg bg-[#4F7CFF]/15 text-[#4F7CFF] flex items-center justify-center shrink-0 font-bold text-sm">
              ۱
            </div>
            <div className="text-sm">
              <div className="font-semibold flex items-center gap-2">
                لمس دکمه اشتراک‌گذاری (Share)
                <Share className="w-4 h-4 text-[#4F7CFF]" />
              </div>
              <p className="text-xs text-[#94A2C2] mt-1 leading-relaxed" style={{ color: 'var(--ui-text-secondary)' }}>
                در نوار پایین مرورگر سافاری (Safari)، روی آیکون اشتراک‌گذاری (مربع با فلش رو به بالا) بزنید.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[#0F1524] border border-[#1F2B47]/80" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
            <div className="w-8 h-8 rounded-lg bg-[#8A5CFF]/15 text-[#8A5CFF] flex items-center justify-center shrink-0 font-bold text-sm">
              ۲
            </div>
            <div className="text-sm">
              <div className="font-semibold flex items-center gap-2">
                انتخاب گزینه افزودن به صفحه اصلی
                <PlusSquare className="w-4 h-4 text-[#8A5CFF]" />
              </div>
              <p className="text-xs text-[#94A2C2] mt-1 leading-relaxed" style={{ color: 'var(--ui-text-secondary)' }}>
                در منوی باز شده کمی پایین بیایید و گزینه <strong className="text-white">Add to Home Screen</strong> یا <strong className="text-white">افزودن به صفحه اصلی</strong> را انتخاب کنید.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[#0F1524] border border-[#1F2B47]/80" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
            <div className="w-8 h-8 rounded-lg bg-[#38E1FF]/15 text-[#38E1FF] flex items-center justify-center shrink-0 font-bold text-sm">
              ۳
            </div>
            <div className="text-sm">
              <div className="font-semibold flex items-center gap-2">
                تایید دکمه افزودن (Add)
                <CheckCircle2 className="w-4 h-4 text-[#38E1FF]" />
              </div>
              <p className="text-xs text-[#94A2C2] mt-1 leading-relaxed" style={{ color: 'var(--ui-text-secondary)' }}>
                در گوشه بالا روی <strong className="text-white">Add</strong> بزنید. آیکون برنامه سریعاً به صفحه اصلی آیفون شما اضافه می‌شود!
              </p>
            </div>
          </div>
        </div>

        {/* Perks pill */}
        <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-[#4F7CFF]/10 to-[#8A5CFF]/10 border border-[#4F7CFF]/20 text-xs text-[#94A2C2] flex items-center gap-2.5" style={{ color: 'var(--ui-text-secondary)' }}>
          <Sparkles className="w-4 h-4 text-[#38E1FF] shrink-0" />
          <span>پس از نصب، برنامه مثل یک اپلیکیشن کاملاً مستقل باز شده و با Face ID در کمتر از یک ثانیه باز می‌شود.</span>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#8A5CFF] text-white font-medium text-sm shadow-lg shadow-[#4F7CFF]/25 hover:opacity-95 active:scale-[0.99] transition cursor-pointer"
        >
          متوجه شدم
        </button>
      </div>
    </div>
  );
};
