import React from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Settings, 
  KeyRound, 
  Sun, 
  Moon, 
  Download, 
  Smartphone,
  Plus,
  CreditCard,
  Key,
  User,
  LogOut
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { AppTab, UserProfile } from '../types';

interface VaultHeaderProps {
  currentUser: UserProfile;
  theme: 'dark' | 'light';
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onToggleTheme: () => void;
  onLock: () => void;
  onOpenSettings: () => void;
  onOpenGenerator: () => void;
  onOpenAddItem: () => void;
  onOpenIOSGuide: () => void;
  onOpenAutoFillGuide: () => void;
}

export const VaultHeader: React.FC<VaultHeaderProps> = ({
  currentUser,
  theme,
  activeTab,
  onTabChange,
  onToggleTheme,
  onLock,
  onOpenSettings,
  onOpenGenerator,
  onOpenAddItem,
  onOpenIOSGuide,
  onOpenAutoFillGuide,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  return (
    <header 
      className="sticky top-0 z-30 bg-[#0B0F1A]/90 backdrop-blur-md border-b border-[#1F2B47] px-4 sm:px-6 py-2.5 safe-area-top"
      style={{
        backgroundColor: 'var(--ui-bg)',
        borderColor: 'var(--ui-border)',
      }}
    >
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left Side: Brand & Tabs */}
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#4F7CFF] via-[#8A5CFF] to-[#38E1FF] p-[1.5px] shadow-lg shadow-[#4F7CFF]/20 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-[#121A2C] rounded-[10px] flex items-center justify-center" style={{ backgroundColor: 'var(--ui-surface)' }}>
                <ShieldCheck className="w-5 h-5 text-[#38E1FF]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base sm:text-lg tracking-tight text-white">KeepPass</h1>
                {/* User badge */}
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#4F7CFF]/15 text-[#38E1FF] border border-[#4F7CFF]/30 text-[11px] font-bold">
                  <User className="w-3 h-3" />
                  <span>{currentUser.displayName || currentUser.username}</span>
                </div>
              </div>
              <p className="text-[11px] text-[#94A2C2] hidden sm:block" style={{ color: 'var(--ui-text-secondary)' }}>
                پنل اختصاصی • امنیت چندلایه AES-256
              </p>
            </div>
          </div>

          {/* 2 Main Unified Tabs Navigation */}
          <div className="flex items-center p-1 rounded-2xl bg-[#121A2C] border border-[#1F2B47]" style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}>
            <button
              type="button"
              onClick={() => onTabChange('vault')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'vault'
                  ? 'bg-gradient-to-r from-[#4F7CFF] to-[#8A5CFF] text-white shadow-md'
                  : 'text-[#94A2C2] hover:text-white'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>گاوصندوق رمزها</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('ghest')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'ghest'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                  : 'text-[#94A2C2] hover:text-white'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>مدیریت اقساط و وام‌ها</span>
            </button>
          </div>
        </div>

        {/* Right Side: Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 w-full md:w-auto justify-end">
          {/* iOS AutoFill (Fill Password) Helper Button */}
          <button
            type="button"
            onClick={onOpenAutoFillGuide}
            className="py-1.5 px-2.5 sm:px-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            title="آموزش و تنظیم Fill Password در آیفون"
          >
            <Smartphone className="w-4 h-4 text-blue-400" />
            <span className="hidden xs:inline">AutoFill آیفون</span>
          </button>

          {/* PWA Install Button (iPhone or Android/Desktop) */}
          {!isInstalled && (
            <>
              {isIOS ? (
                <button
                  type="button"
                  onClick={onOpenIOSGuide}
                  className="py-1.5 px-2.5 sm:px-3 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#4F7CFF]/40 text-[#38E1FF] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  style={{ backgroundColor: 'var(--ui-surface-subtle)' }}
                  title="نصب روی آیفون"
                >
                  <Smartphone className="w-4 h-4 text-[#38E1FF]" />
                  <span className="hidden sm:inline">نصب آیفون</span>
                </button>
              ) : isInstallable ? (
                <button
                  type="button"
                  onClick={install}
                  className="py-1.5 px-2.5 sm:px-3 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#4F7CFF]/40 text-[#38E1FF] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  style={{ backgroundColor: 'var(--ui-surface-subtle)' }}
                  title="نصب برنامه"
                >
                  <Download className="w-4 h-4 text-[#38E1FF]" />
                  <span className="hidden sm:inline">نصب برنامه</span>
                </button>
              ) : null}
            </>
          )}

          {/* Quick Add Button (only on vault tab) */}
          {activeTab === 'vault' && (
            <button
              type="button"
              onClick={onOpenAddItem}
              className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#8A5CFF] text-white text-xs font-bold shadow-md shadow-[#4F7CFF]/25 hover:opacity-95 transition cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">افزودن رمز</span>
            </button>
          )}

          {/* Password Generator tool trigger */}
          <button
            type="button"
            onClick={onOpenGenerator}
            className="p-2 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-[#94A2C2] hover:text-white transition cursor-pointer"
            style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)', color: 'var(--ui-text-secondary)' }}
            title="تولید کننده رمز قوی"
            aria-label="تولید کننده رمز قوی"
          >
            <KeyRound className="w-4 h-4" />
          </button>

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-[#94A2C2] hover:text-white transition cursor-pointer"
            style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)', color: 'var(--ui-text-secondary)' }}
            title={theme === 'dark' ? 'حالت روشن' : 'حالت تیره'}
            aria-label="تغییر پوسته"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>

          {/* Settings Trigger */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-[#94A2C2] hover:text-white transition cursor-pointer"
            style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)', color: 'var(--ui-text-secondary)' }}
            title="تنظیمات امنیت و آیفون"
            aria-label="تنظیمات"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Switch User / Lock Vault Button */}
          <button
            type="button"
            onClick={onLock}
            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 transition cursor-pointer flex items-center gap-1.5"
            title="خروج از حساب / قفل کردن گاوصندوق"
            aria-label="خروج از حساب"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
