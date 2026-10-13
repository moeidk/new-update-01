/**
 * Full-screen transition shown while the vault is being decrypted after a successful login,
 * so the user never sees the login form "bounce back" or a half-loaded dashboard.
 * It only appears while real work is happening — there is no artificial delay.
 */
import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const UnlockingScreen: React.FC<{ name?: string }> = ({ name }) => (
  <div
    className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-5 bg-[#070A12]/95 backdrop-blur-md"
    dir="rtl"
    role="status"
    aria-live="polite"
  >
    <div className="kp-pulse w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#4F7CFF] via-[#8A5CFF] to-[#38E1FF] p-[2px] shadow-2xl shadow-[#4F7CFF]/30">
      <div className="w-full h-full rounded-[22px] bg-[#121A2C] flex items-center justify-center">
        <ShieldCheck className="w-10 h-10 text-[#38E1FF]" />
      </div>
    </div>
    <div className="text-center space-y-1">
      <p className="text-sm font-bold text-white">در حال باز کردن گاوصندوق{name ? ` ${name}` : ''}</p>
      <p className="text-[11px] text-[#94A2C2]">رمزگشایی امن اطلاعات روی همین دستگاه</p>
    </div>
    <div className="w-40 h-1 rounded-full bg-white/10 overflow-hidden">
      <div className="kp-bar h-full w-1/2 rounded-full bg-gradient-to-l from-[#4F7CFF] to-[#38E1FF]" />
    </div>
  </div>
);
