/**
 * KeepPass Vault & Ghest Manager - Main Application
 * Modern Unified Architecture:
 * - Responsive Collapsible Sidebar Navigation
 * - 100% Ghest Financial System Parity (Dashboard, Loans, Jalali Calendar, Analytics, Central Bank Calculator, Alerts)
 * - Hosting & Domains Renewal Management (Dedicated Sidebar Module)
 * - Telegram Bot Integration for due date alerts (Bot Token & Chat ID)
 * - Full-page Tab-based Settings (no popup modal)
 * - English Numerals (0-9) & Live Comma Separator Formatting throughout
 * - Multi-user Vault Isolation (AES-GCM encryption per user)
 * - iOS Password AutoFill & PWA integration
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  VaultItem, 
  SecuritySettings, 
  ItemCategory, 
  UserProfile, 
  SidebarNavView, 
  LoanItem,
  HostingDomainItem
} from './types';
import { StorageService } from './services/storage';
import { LoanService } from './services/loanService';
import { HostingService } from './services/hostingService';
import { TelegramService } from './services/telegramService';
import { compareJalaliDates, getCurrentJalali } from './utils/jalali';
import { LockScreen } from './components/LockScreen';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { GhestCalendarView } from './components/GhestCalendarView';
import { GhestAnalyticsView } from './components/GhestAnalyticsView';
import { GhestCalculatorView } from './components/GhestCalculatorView';
import { GhestAlertsView } from './components/GhestAlertsView';
import { GhestManager } from './components/GhestManager';
import { HostingManager } from './components/HostingManager';
import { SettingsView } from './components/SettingsView';
import { VaultItemList } from './components/VaultItemList';
import { ItemModal } from './components/ItemModal';
import { PasswordGeneratorModal } from './components/PasswordGeneratorModal';
import { IOSInstallGuideModal } from './components/IOSInstallGuideModal';
import { IOSAutoFillModal } from './components/IOSAutoFillModal';
import { DataMigrationService } from './services/dataMigration';
import { UpdateBanner } from './components/UpdateBanner';
import { AppVersionFooter } from './components/AppVersionFooter';

import { 
  Menu, 
  Bell, 
  ShieldCheck, 
  CreditCard, 
  KeyRound, 
  Sun, 
  Moon, 
  Lock,
  Globe,
  Settings as SettingsIcon,
  LayoutDashboard
} from 'lucide-react';

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentView, setCurrentView] = useState<SidebarNavView>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Authenticated user & encryption key
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentKey, setCurrentKey] = useState<CryptoKey | null>(null);
  const [settings, setSettings] = useState<SecuritySettings>({
    isSetup: false,
    masterPasswordHash: '',
    salt: '',
    biometricEnabled: false,
    biometricType: 'none',
    autoBiometricPrompt: false,
    autoLockMinutes: 5,
  });

  // Vault data (isolated per user)
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Loans data (isolated per user)
  const [loans, setLoans] = useState<LoanItem[]>([]);

  // Hosting & Domains data (isolated per user)
  const [hostingItems, setHostingItems] = useState<HostingDomainItem[]>([]);

  // Signals for cross-component workflows
  const [openAddLoanSignal, setOpenAddLoanSignal] = useState(false);
  const [calculatorLoanData, setCalculatorLoanData] = useState<{
    totalAmount: number;
    interestRate: number;
    totalInstallments: number;
    installmentAmount: number;
  } | null>(null);

  // Modals state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [selectedVaultItem, setSelectedVaultItem] = useState<VaultItem | null>(null);
  const [addItemCategory, setAddItemCategory] = useState<ItemCategory>('login');
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isIOSGuideOpen, setIsIOSGuideOpen] = useState(false);
  const [isAutoFillGuideOpen, setIsAutoFillGuideOpen] = useState(false);

  // Auto-lock inactivity timer
  const lastActivityRef = useRef<number>(Date.now());

  // Initialize theme and run idempotent data migrations
  useEffect(() => {
    // Run idempotent client-side data migrations
    DataMigrationService.runMigrations();
    // Security: remove raw vault keys left in localStorage by older versions
    StorageService.purgeLegacyBiometricTokens();

    const savedTheme = StorageService.getTheme();
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    StorageService.setTheme(nextTheme);
  };

  // Lock handler (also switches user / returns to auth screen)
  const handleLock = useCallback(() => {
    StorageService.closeSession();
    setCurrentKey(null);
    setCurrentUser(null);
    setVaultItems([]);
    setLoans([]);
    setHostingItems([]);
    setIsItemModalOpen(false);
    setCurrentView('dashboard');
  }, []);

  // Unlock handler
  const handleUnlocked = async (user: UserProfile, key: CryptoKey) => {
    // 0. Decrypt protected per-user data (loans, hosting, Telegram) into memory
    //    before any view can read it.
    try {
      await StorageService.openSession(user.username, key);
    } catch (e) {
      console.error('Failed to open secure session:', e);
    }

    setCurrentUser(user);
    setSettings(user.settings);
    setCurrentKey(key);
    setIsLoadingItems(true);

    try {
      // 1. Load user isolated vault items
      const decrypted = await StorageService.loadDecryptedVault(user.username, key);
      setVaultItems(decrypted);

      // 2. Load user isolated loans
      const userLoans = LoanService.getLoans(user.username);
      setLoans(userLoans);

      // 3. Load user isolated hosting and domains
      const userHostings = HostingService.getHostingItems(user.username);
      setHostingItems(userHostings);
    } catch (e) {
      console.error('Failed to load user data:', e);
    } finally {
      setIsLoadingItems(false);
    }
  };

  // Auto-lock on page visibility change or user inactivity
  useEffect(() => {
    if (!currentKey || !currentUser) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (settings.autoLockMinutes === 0) {
          handleLock();
        }
      } else {
        lastActivityRef.current = Date.now();
      }
    };

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pointerdown', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('touchstart', updateActivity);

    const interval = setInterval(() => {
      if (settings.autoLockMinutes > 0) {
        const elapsedMinutes = (Date.now() - lastActivityRef.current) / 60000;
        if (elapsedMinutes >= settings.autoLockMinutes) {
          handleLock();
        }
      }
    }, 15000);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pointerdown', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
      clearInterval(interval);
    };
  }, [currentKey, currentUser, settings.autoLockMinutes, handleLock]);

  // Compute urgent alerts count for loans (sidebar badge)
  const alertCount = useMemo(() => {
    let count = 0;
    loans.forEach((loan) => {
      (loan.installments || []).forEach((inst) => {
        if (!inst.isPaid) {
          const diff = compareJalaliDates(inst.dueDate);
          if (diff <= 3) {
            count++;
          }
        }
      });
    });
    return count;
  }, [loans]);

  // Compute urgent alerts count for hosting & domains (sidebar badge)
  const hostAlertCount = useMemo(() => {
    return hostingItems.filter((h) => h.status === 'expiring' || h.status === 'expired').length;
  }, [hostingItems]);

  // Loan Payment Toggle Handler (Used across Calendar, Alerts, and Loans views)
  const handleTogglePayment = (loanId: string, installmentNumber: number, trackingCode?: string) => {
    if (!currentUser) return;
    const updated = LoanService.toggleInstallmentPaid(currentUser.username, loanId, installmentNumber, trackingCode);
    setLoans(updated);
  };

  // Vault item actions
  const handleSaveVaultItem = async (itemData: Partial<VaultItem>) => {
    if (!currentKey || !currentUser) return;
    const now = new Date().toISOString();
    let updatedItems: VaultItem[];

    const isExisting = !!itemData.id && vaultItems.some((it) => it.id === itemData.id);
    if (isExisting) {
      updatedItems = vaultItems.map((it) =>
        it.id === itemData.id ? ({ ...it, ...itemData, updatedAt: now } as VaultItem) : it
      );
    } else {
      const newItem: VaultItem = {
        id: `item-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        title: itemData.title || 'بدون عنوان',
        category: itemData.category || 'login',
        username: itemData.username,
        password: itemData.password,
        url: itemData.url,
        notes: itemData.notes,
        cardNumber: itemData.cardNumber,
        cardHolder: itemData.cardHolder,
        cvv2: itemData.cvv2,
        expireDate: itemData.expireDate,
        pin: itemData.pin,
        isFavorite: itemData.isFavorite ?? false,
        tags: itemData.tags || [],
        createdAt: now,
        updatedAt: now,
      };
      updatedItems = [newItem, ...vaultItems];
    }

    setVaultItems(updatedItems);
    await StorageService.saveEncryptedVault(currentUser.username, updatedItems, currentKey);
    setIsItemModalOpen(false);
  };

  const handleToggleFavoriteVaultItem = async (id: string) => {
    if (!currentKey || !currentUser) return;
    const updated = vaultItems.map((it) => (it.id === id ? { ...it, isFavorite: !it.isFavorite } : it));
    setVaultItems(updated);
    await StorageService.saveEncryptedVault(currentUser.username, updated, currentKey);
  };

  const handleDeleteVaultItem = async (id: string) => {
    if (!currentKey || !currentUser) return;
    const updated = vaultItems.filter((it) => it.id !== id);
    setVaultItems(updated);
    await StorageService.saveEncryptedVault(currentUser.username, updated, currentKey);
  };

  const handleImportVaultItems = async (importedItems: VaultItem[]) => {
    if (!currentKey || !currentUser) return;
    const merged = [...importedItems, ...vaultItems];
    const uniqueMap = new Map<string, VaultItem>();
    merged.forEach((item) => uniqueMap.set(item.id, item));
    const finalItems = Array.from(uniqueMap.values());
    setVaultItems(finalItems);
    await StorageService.saveEncryptedVault(currentUser.username, finalItems, currentKey);
  };

  const handleResetVault = async () => {
    if (!currentKey || !currentUser) return;
    if (window.confirm('آیا مطمئن هستید؟ تمام رمزها و کارت‌های این کاربر حذف خواهند شد.')) {
      setVaultItems([]);
      await StorageService.saveEncryptedVault(currentUser.username, [], currentKey);
    }
  };

  // If locked or no user active: render clean LockScreen
  if (!currentKey || !currentUser) {
    return (
      <>
        <LockScreen onUnlocked={handleUnlocked} />
        <UpdateBanner />
      </>
    );
  }

  // View Title and Subtitle Mapping
  const viewMeta: { [key in SidebarNavView]: { title: string; subtitle: string } } = {
    dashboard: { title: 'داشبورد جامع مالی و امنیتی', subtitle: 'دید کلی تعهدات اقساط، هاست‌ها و امنیت حساب' },
    loans: { title: 'مدیریت وام‌ها و جدول اقساط', subtitle: 'فهرست تسهیلات، استهلاک و ثبت پرداخت‌ها' },
    hosting: { title: 'مدیریت سررسید هاست، دامنه‌ها و سرورها', subtitle: 'پایش موعدهای تمدید سالانه و ماهانه، هزینه‌ها و هشدارهای تلگرام' },
    calendar: { title: 'گاهشمار سررسیدهای اقساط', subtitle: 'تقویم ماهانه و روزانه اقساط بر اساس تقویم شمسی' },
    analytics: { title: 'گزارش‌ها و تحلیل مالی', subtitle: 'پیش‌بینی جریان نقدی، سهم بانک‌ها و خروجی اکسل' },
    calculator: { title: 'ماشین‌حساب هوشمند تسهیلات', subtitle: 'محاسبه رسمی سود و اقساط بانک مرکزی ایران' },
    alerts: { title: 'مرکز هشدارها و سررسیدها', subtitle: 'اقساط معوقه و موعدهای پرداخت فوری' },
    vault: { title: 'گاوصندوق رمزها و حساب‌ها', subtitle: 'حفاظت امنیتی با کلید رمزنگاری اختصاصی' },
    settings: { title: 'تنظیمات سامانه، تلگرام و پشتیبان', subtitle: 'پیکربندی ربات تلگرام، امنیت، نسخه برنامه و فایل‌های پشتیبان' },
  };

  return (
    <div className="h-[100dvh] w-full bg-[#070A12] text-white flex overflow-hidden font-sans transition-colors duration-200" dir="rtl">
      {/* 1. Responsive Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={(v) => setCurrentView(v)}
        currentUser={currentUser}
        onLock={handleLock}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        alertCount={alertCount}
        hostAlertCount={hostAlertCount}
        onOpenIOSGuide={() => setIsIOSGuideOpen(true)}
      />

      {/* 2. Main Content Canvas */}
      <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden relative">
        {/* Top Navbar */}
        <header 
          className="sticky top-0 z-30 px-4 pb-3.5 border-b border-[#1F2B47] bg-[#0A0D14]/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0"
          style={{ 
            backgroundColor: 'var(--ui-surface)', 
            borderColor: 'var(--ui-border)',
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)'
          }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-sm md:text-base font-black text-white" style={{ color: 'var(--ui-text-primary)' }}>
                {viewMeta[currentView]?.title}
              </h2>
              <p className="text-[11px] text-[#94A2C2] hidden sm:block" style={{ color: 'var(--ui-text-secondary)' }}>
                {viewMeta[currentView]?.subtitle}
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            {/* Hosting Shortcut */}
            <button
              onClick={() => setCurrentView('hosting')}
              className={`py-2 px-3 rounded-xl border text-xs font-bold items-center gap-1.5 cursor-pointer transition shadow-xs hidden sm:flex ${
                currentView === 'hosting'
                  ? 'bg-[#38E1FF]/10 text-[#38E1FF] border-[#38E1FF]/30'
                  : 'bg-[#0F1524] hover:bg-[#182239] border-[#1F2B47] text-[#94A2C2] hover:text-white'
              }`}
              style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
            >
              <Globe className="w-3.5 h-3.5 text-[#38E1FF]" />
              <span>هاست و دامنه</span>
              {hostAlertCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400" />
              )}
            </button>

            {/* Generator Modal Shortcut */}
            <button
              onClick={() => setIsGeneratorOpen(true)}
              className="hidden md:flex py-2 px-3 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-[#38E1FF] text-xs font-bold items-center gap-1.5 cursor-pointer transition shadow-xs"
              style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>تولید رمز قوی</span>
            </button>

            {/* Quick Add Vault Item Shortcut */}
            <button
              onClick={() => {
                setSelectedVaultItem(null);
                setAddItemCategory('login');
                setIsItemModalOpen(true);
              }}
              className="py-2 px-3 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
              style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
              title="ثبت مورد در گاوصندوق"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">مورد جدید</span>
            </button>

            {/* Alerts Quick Bell */}
            <button
              onClick={() => setCurrentView('alerts')}
              className="relative p-2 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-[#94A2C2] hover:text-white cursor-pointer transition"
              title="مرکز هشدارها"
              style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
            >
              <Bell className="w-4 h-4 text-amber-400" />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white font-mono text-[9px] font-black flex items-center justify-center animate-pulse tabular-nums">
                  {alertCount}
                </span>
              )}
            </button>

            {/* Settings Tab Button */}
            <button
              onClick={() => setCurrentView('settings')}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                currentView === 'settings'
                  ? 'bg-[#4F7CFF]/15 text-[#4F7CFF] border-[#4F7CFF]/30'
                  : 'bg-[#0F1524] hover:bg-[#182239] border-[#1F2B47] text-[#94A2C2] hover:text-white'
              }`}
              title="تنظیمات سامانه و اتصال تلگرام"
              style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* View Content Renderer */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] lg:pb-8 overscroll-contain">
          {currentView === 'dashboard' && (
            <DashboardView
              currentUser={currentUser}
              loans={loans}
              vaultItems={vaultItems}
              hostingItems={hostingItems}
              onNavigate={(v) => setCurrentView(v)}
              onOpenAddLoan={() => {
                setCurrentView('loans');
                setOpenAddLoanSignal(true);
              }}
              onOpenAddVaultItem={() => {
                setSelectedVaultItem(null);
                setAddItemCategory('login');
                setIsItemModalOpen(true);
              }}
            />
          )}

          {currentView === 'loans' && (
            <GhestManager
              currentUser={currentUser}
              loans={loans}
              setLoans={setLoans}
              onOpenVaultTab={() => setCurrentView('vault')}
              openAddModalSignal={openAddLoanSignal}
              onAddModalSignalHandled={() => setOpenAddLoanSignal(false)}
              initialNewLoanData={calculatorLoanData}
              onClearInitialNewLoanData={() => setCalculatorLoanData(null)}
            />
          )}

          {currentView === 'hosting' && (
            <HostingManager
              currentUser={currentUser}
              hostingItems={hostingItems}
              setHostingItems={setHostingItems}
              onOpenSettingsTab={() => setCurrentView('settings')}
            />
          )}

          {currentView === 'calendar' && (
            <GhestCalendarView
              currentUser={currentUser}
              loans={loans}
              onTogglePayment={handleTogglePayment}
            />
          )}

          {currentView === 'analytics' && (
            <GhestAnalyticsView
              currentUser={currentUser}
              loans={loans}
            />
          )}

          {currentView === 'calculator' && (
            <GhestCalculatorView
              onTransferToNewLoan={(data) => {
                setCalculatorLoanData(data);
                setCurrentView('loans');
              }}
            />
          )}

          {currentView === 'alerts' && (
            <GhestAlertsView
              currentUser={currentUser}
              loans={loans}
              onTogglePayment={handleTogglePayment}
            />
          )}

          {currentView === 'vault' && (
            <div>
              {isLoadingItems ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-3 border-[#4F7CFF] border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>
                    در حال رمزگشایی گاوصندوق اختصاصی {currentUser.displayName || currentUser.username}...
                  </p>
                </div>
              ) : (
                <VaultItemList
                  items={vaultItems}
                  onSelectItem={(item) => {
                    setSelectedVaultItem(item);
                    setIsItemModalOpen(true);
                  }}
                  onAddNew={(cat) => {
                    setSelectedVaultItem(null);
                    setAddItemCategory(cat || 'login');
                    setIsItemModalOpen(true);
                  }}
                  onToggleFavorite={handleToggleFavoriteVaultItem}
                  onDeleteItem={handleDeleteVaultItem}
                />
              )}
            </div>
          )}

          {currentView === 'settings' && (
            <SettingsView
              currentUser={currentUser}
              settings={settings}
              vaultItems={vaultItems}
              loans={loans}
              hostingItems={hostingItems}
              currentKey={currentKey}
              onUpdateSettings={(newSettings) => {
                setSettings(newSettings);
                setCurrentUser((u) => (u ? { ...u, settings: newSettings } : u));
              }}
              onChangeKey={(newKey) => setCurrentKey(newKey)}
              onImportVaultItems={handleImportVaultItems}
              onResetVault={handleResetVault}
            />
          )}

          <AppVersionFooter className="mt-10 pt-4 border-t border-[#1F2B47]/50" />
        </main>

        {/* Mobile Bottom Navigation Bar (Docked to iOS Home Indicator with Safe Area) */}
        <nav 
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A0D14]/95 backdrop-blur-xl border-t border-[#1F2B47] px-2 flex items-center justify-around shadow-2xl transition-colors"
          style={{ 
            backgroundColor: 'var(--ui-surface)', 
            borderColor: 'var(--ui-border)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.35rem)',
            paddingTop: '0.45rem'
          }}
          dir="rtl"
        >
          <button
            type="button"
            onClick={() => setCurrentView('dashboard')}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl transition cursor-pointer ${
              currentView === 'dashboard'
                ? 'text-[#4F7CFF] font-bold'
                : 'text-[#94A2C2] hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px]">داشبورد</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentView('loans')}
            className={`relative flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl transition cursor-pointer ${
              currentView === 'loans'
                ? 'text-[#4F7CFF] font-bold'
                : 'text-[#94A2C2] hover:text-white'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-[10px]">اقساط و وام</span>
            {alertCount > 0 && (
              <span className="absolute top-0.5 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setCurrentView('hosting')}
            className={`relative flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl transition cursor-pointer ${
              currentView === 'hosting'
                ? 'text-[#38E1FF] font-bold'
                : 'text-[#94A2C2] hover:text-white'
            }`}
          >
            <Globe className="w-5 h-5" />
            <span className="text-[10px]">هاست و دامنه</span>
            {hostAlertCount > 0 && (
              <span className="absolute top-0.5 right-2 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setCurrentView('vault')}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl transition cursor-pointer ${
              currentView === 'vault'
                ? 'text-[#4F7CFF] font-bold'
                : 'text-[#94A2C2] hover:text-white'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[10px]">گاوصندوق</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentView('settings')}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl transition cursor-pointer ${
              currentView === 'settings'
                ? 'text-[#4F7CFF] font-bold'
                : 'text-[#94A2C2] hover:text-white'
            }`}
          >
            <SettingsIcon className="w-5 h-5" />
            <span className="text-[10px]">تنظیمات</span>
          </button>
        </nav>
      </div>

      {/* MODALS */}

      {/* 1. Add / Edit Vault Item Modal */}
      <ItemModal
        isOpen={isItemModalOpen}
        item={selectedVaultItem}
        defaultCategory={addItemCategory}
        onClose={() => setIsItemModalOpen(false)}
        onSave={handleSaveVaultItem}
        onDelete={handleDeleteVaultItem}
      />

      {/* 2. Password Generator Modal */}
      <PasswordGeneratorModal
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
      />

      {/* 3. iPhone PWA Installation Visual Guide Modal */}
      <IOSInstallGuideModal
        isOpen={isIOSGuideOpen}
        onClose={() => setIsIOSGuideOpen(false)}
      />

      {/* 4. iPhone AutoFill (Fill Password) Visual Guide Modal */}
      <IOSAutoFillModal
        isOpen={isAutoFillGuideOpen}
        onClose={() => setIsAutoFillGuideOpen(false)}
      />

      {/* 5. New version available banner (auto-deploy on git push) */}
      <UpdateBanner />
    </div>
  );
}
