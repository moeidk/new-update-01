import React from 'react';
import { 
  LayoutDashboard, 
  CreditCard, 
  Calendar, 
  TrendingUp, 
  Calculator, 
  Bell, 
  ShieldCheck, 
  Settings, 
  Lock, 
  Sun, 
  Moon, 
  Smartphone, 
  ChevronRight, 
  ChevronLeft,
  X,
  Sparkles,
  Globe
} from 'lucide-react';
import { SidebarNavView, UserProfile } from '../types';

interface SidebarProps {
  currentView: SidebarNavView;
  onSelectView: (view: SidebarNavView) => void;
  currentUser: UserProfile;
  onLock: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  alertCount: number;
  hostAlertCount?: number;
  onOpenIOSGuide: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  currentUser,
  onLock,
  theme,
  onToggleTheme,
  isOpenMobile,
  onCloseMobile,
  alertCount,
  hostAlertCount = 0,
  onOpenIOSGuide,
}) => {
  const navItems: { id: SidebarNavView; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'داشبورد جامع', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'loans', label: 'وام‌ها و اقساط', icon: <CreditCard className="w-5 h-5" /> },
    { 
      id: 'hosting', 
      label: 'هاست و دامنه‌ها', 
      icon: <Globe className="w-5 h-5" />,
      badge: hostAlertCount > 0 ? hostAlertCount : undefined 
    },
    { id: 'calendar', label: 'گاهشمار سررسیدها', icon: <Calendar className="w-5 h-5" /> },
    { id: 'analytics', label: 'گزارش و تحلیل مالی', icon: <TrendingUp className="w-5 h-5" /> },
    { id: 'calculator', label: 'ماشین‌حساب وام', icon: <Calculator className="w-5 h-5" /> },
    { 
      id: 'alerts', 
      label: 'هشدارها و سررسید', 
      icon: <Bell className="w-5 h-5" />,
      badge: alertCount > 0 ? alertCount : undefined,
    },
    { id: 'vault', label: 'گاوصندوق رمزها', icon: <ShieldCheck className="w-5 h-5" /> },
    { id: 'settings', label: 'تنظیمات و پشتیبان', icon: <Settings className="w-5 h-5" /> },
  ];

  const handleNavClick = (view: SidebarNavView) => {
    onSelectView(view);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 right-0 z-50 w-72 flex flex-col shrink-0 border-l transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        } bg-[#0A0D14] border-[#1F2B47] text-white`}
        style={{
          backgroundColor: 'var(--ui-surface)',
          borderColor: 'var(--ui-border)',
          color: 'var(--ui-text-primary)',
        }}
      >
        {/* Brand Header */}
        <div 
          className="p-5 border-b border-[#1F2B47] flex items-center justify-between" 
          style={{ 
            borderColor: 'var(--ui-border)',
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)'
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#4F7CFF] via-[#38E1FF] to-[#8A5CFF] p-0.5 shadow-lg shadow-[#4F7CFF]/20 flex items-center justify-center">
              <div className="w-full h-full bg-[#07090E] rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-[#38E1FF]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-black text-sm tracking-tight text-white" style={{ color: 'var(--ui-text-primary)' }}>
                <span>KeepPass</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#38E1FF]/10 text-[#38E1FF] font-mono border border-[#38E1FF]/20">
                  Ghest
                </span>
              </div>
              <div className="text-[11px] text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>
                سامانه هوشمند مالی و گاوصندوق
              </div>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-[#94A2C2] hover:text-white hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
          <div className="px-3 mb-2 text-[10px] font-bold text-[#5D6B8F] tracking-wider uppercase">
            ماژول‌ها و ابزارها
          </div>
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer group ${
                  isActive
                    ? 'bg-gradient-to-r from-[#4F7CFF] to-[#6055F6] text-white shadow-md shadow-[#4F7CFF]/20'
                    : 'text-[#94A2C2] hover:text-white hover:bg-white/5'
                }`}
                style={{
                  color: isActive ? '#ffffff' : 'var(--ui-text-secondary)',
                }}
              >
                <div className="flex items-center gap-3">
                  <span className={`${isActive ? 'text-white' : 'text-[#4F7CFF] group-hover:text-[#38E1FF]'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    isActive ? 'bg-white text-[#4F7CFF]' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* User Card & System Actions */}
        <div 
          className="p-3.5 border-t border-[#1F2B47] space-y-3" 
          style={{ 
            borderColor: 'var(--ui-border)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)'
          }}
        >
          {/* Quick iOS Autofill Shortcut */}
          <button
            onClick={onOpenIOSGuide}
            className="w-full py-2 px-3 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-[#38E1FF] text-[11px] font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
          >
            <Smartphone className="w-3.5 h-3.5 text-[#38E1FF]" />
            <span>راهنمای Fill Password آیفون</span>
          </button>

          {/* User Profile Badge */}
          <div className="p-3 rounded-xl bg-[#0F1524] border border-[#1F2B47] flex items-center justify-between"
            style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4F7CFF] to-[#8A5CFF] flex items-center justify-center text-white font-black text-xs shrink-0 shadow-sm">
                {(currentUser.displayName || currentUser.username || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold truncate text-white" style={{ color: 'var(--ui-text-primary)' }}>
                  {currentUser.displayName || currentUser.username}
                </div>
                <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  رمزنگاری درجا
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={onToggleTheme}
                title={theme === 'dark' ? 'حالت روشن' : 'حالت تیره'}
                className="p-1.5 rounded-lg text-[#94A2C2] hover:text-white hover:bg-white/5 cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
              </button>

              <button
                onClick={onLock}
                title="قفل و خروج"
                className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
