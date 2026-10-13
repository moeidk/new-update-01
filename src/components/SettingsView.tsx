import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Send, 
  ShieldCheck, 
  KeyRound, 
  Lock, 
  Download, 
  Upload, 
  RefreshCw, 
  Cloud, 
  Smartphone, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Clock, 
  HelpCircle,
  ExternalLink,
  Trash2,
  Bell,
  Globe,
  Database,
  Rocket
} from 'lucide-react';
import { SecuritySettings, VaultItem, UserProfile, LoanItem, HostingDomainItem, TelegramSettings } from '../types';
import { BiometricService } from '../services/webauthn';
import { CryptoService, KDF_ITERATIONS } from '../services/crypto';
import { BiometricKeyStore } from '../services/biometricKeyStore';
import { SecureStore } from '../services/secureStore';
import { AutoSyncService } from '../services/autoSync';
import { useAutoSyncState, describeSync } from './SyncStatus';
import { StorageService } from '../services/storage';
import { TelegramService } from '../services/telegramService';
import { LoanService } from '../services/loanService';
import { HostingService } from '../services/hostingService';
import { DeploymentManagerTab } from './DeploymentManagerTab';

interface SettingsViewProps {
  currentUser: UserProfile;
  settings: SecuritySettings;
  vaultItems: VaultItem[];
  loans: LoanItem[];
  hostingItems: HostingDomainItem[];
  currentKey: CryptoKey;
  onUpdateSettings: (newSettings: SecuritySettings) => void;
  /** Called when the master password changes, so the app keeps using the new key. */
  onChangeKey: (newKey: CryptoKey) => void;
  onImportVaultItems: (imported: VaultItem[]) => void;
  onResetVault: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  settings,
  vaultItems,
  loans,
  hostingItems,
  currentKey,
  onUpdateSettings,
  onChangeKey,
  onImportVaultItems,
  onResetVault,
}) => {
  const [activeTab, setActiveTab] = useState<'telegram' | 'deployment' | 'security' | 'backup' | 'ios' | 'about'>('telegram');

  // Telegram Settings State
  const [tgSettings, setTgSettings] = useState<TelegramSettings>(() => TelegramService.getSettings(currentUser.username));
  const [tgStatusNotice, setTgStatusNotice] = useState<{ message: string; isError: boolean } | null>(null);
  const [isSendingTgTest, setIsSendingTgTest] = useState(false);
  const [isSendingTgSummary, setIsSendingTgSummary] = useState(false);

  // Biometric test
  const [bioTestStatus, setBioTestStatus] = useState<string>('');
  const [isTestingBio, setIsTestingBio] = useState(false);

  // Change Password
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<{ message: string; isError: boolean } | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Backup notice
  const [backupNotice, setBackupNotice] = useState<string>('');

  // Persistent Storage and Zero-Knowledge Cloud Sync States
  const [isPersisted, setIsPersisted] = useState(false);
  const [isRequestingPersist, setIsRequestingPersist] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [lastCloudSync, setLastCloudSync] = useState<string | null>(() => StorageService.getLastCloudSyncTime(currentUser.username));
  const [cloudNotice, setCloudNotice] = useState<{ message: string; isError: boolean } | null>(null);

  useEffect(() => {
    StorageService.checkPersistentStorage().then(setIsPersisted);
    setLastCloudSync(StorageService.getLastCloudSyncTime(currentUser.username));
  }, [currentUser.username]);

  const deviceBio = BiometricService.getDeviceBiometricLabel();

  // Save Telegram settings helper
  const handleSaveTelegramSettings = (newTg: TelegramSettings) => {
    setTgSettings(newTg);
    TelegramService.saveSettings(currentUser.username, newTg);
  };

  // Test Telegram Connection
  const handleTestTelegram = async () => {
    if (!tgSettings.botToken.trim() || !tgSettings.chatId.trim()) {
      setTgStatusNotice({ message: 'لطفاً ابتدا توکن ربات و شناسه چت را وارد نمایید.', isError: true });
      return;
    }

    setIsSendingTgTest(true);
    setTgStatusNotice({ message: 'در حال ارسال پیام تست به تلگرام...', isError: false });

    try {
      const res = await TelegramService.testConnection(tgSettings.botToken, tgSettings.chatId);
      if (res.success) {
        setTgStatusNotice({ message: '✅ پیام تایید با موفقیت به تلگرام شما ارسال شد!', isError: false });
        // Auto-enable Telegram alerts
        const updated = { ...tgSettings, enabled: true };
        handleSaveTelegramSettings(updated);
      } else {
        setTgStatusNotice({ message: `❌ خطا در ارسال: ${res.message}`, isError: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای نامشخص';
      setTgStatusNotice({ message: `❌ خطای شبکه در ارسال پیام: ${msg}`, isError: true });
    } finally {
      setIsSendingTgTest(false);
    }
  };

  // Send Manual Due Alerts Summary Now
  const handleSendDueAlertsSummary = async () => {
    if (!tgSettings.botToken.trim() || !tgSettings.chatId.trim()) {
      setTgStatusNotice({ message: 'لطفاً ابتدا توکن ربات و شناسه چت را پیکربندی نمایید.', isError: true });
      return;
    }

    setIsSendingTgSummary(true);
    setTgStatusNotice({ message: 'در حال استخراج سررسیدها و ارسال به تلگرام...', isError: false });

    try {
      const res = await TelegramService.sendDueAlertsSummary(tgSettings, loans, hostingItems);
      if (res.success) {
        setTgStatusNotice({ 
          message: `✅ گزارش سررسیدها (${res.count} مورد) با موفقیت به تلگرام ارسال گردید!`, 
          isError: false 
        });
      } else {
        setTgStatusNotice({ message: `❌ ${res.message}`, isError: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا';
      setTgStatusNotice({ message: `❌ خطا: ${msg}`, isError: true });
    } finally {
      setIsSendingTgSummary(false);
    }
  };

  // Biometric Toggle & Registration
  const handleToggleBiometric = async (enabled: boolean) => {
    if (enabled) {
      try {
        const { credentialId, mode } = await BiometricKeyStore.enroll(currentUser.username, currentKey);
        const updated: SecuritySettings = {
          ...settings,
          biometricEnabled: true,
          biometricCredentialId: credentialId,
          biometricKeyMode: mode,
          biometricType: deviceBio.type,
        };
        onUpdateSettings(updated);
        StorageService.saveUserSettings(currentUser.username, updated);
        setBioTestStatus(
          mode === 'prf'
            ? '✅ ورود بیومتریک فعال شد (کلید گاوصندوق مستقیماً به حسگر بیومتریک قفل شده است).'
            : '✅ ورود بیومتریک فعال شد (حالت سازگار: مرورگر شما از PRF پشتیبانی نمی‌کند).'
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'خطا در ثبت بیومتریک';
        setBioTestStatus(`❌ ${msg}`);
      }
    } else {
      await BiometricKeyStore.remove(currentUser.username);
      const updated: SecuritySettings = {
        ...settings,
        biometricEnabled: false,
        biometricCredentialId: undefined,
        biometricKeyMode: undefined,
      };
      onUpdateSettings(updated);
      StorageService.saveUserSettings(currentUser.username, updated);
      setBioTestStatus('احراز هویت بیومتریک غیرفعال شد.');
    }
    setTimeout(() => setBioTestStatus(''), 4000);
  };

  const handleTestBiometric = async () => {
    setIsTestingBio(true);
    setBioTestStatus('در حال بررسی بیومتریک...');
    try {
      const verified = await BiometricService.verifyBiometric(settings.biometricCredentialId);
      if (verified) {
        setBioTestStatus('✅ اسکن بیومتریک با موفقیت تایید شد!');
      } else {
        setBioTestStatus('❌ احراز هویت تایید نشد.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در اسکن.';
      setBioTestStatus(`❌ ${msg}`);
    } finally {
      setIsTestingBio(false);
      setTimeout(() => setBioTestStatus(''), 4000);
    }
  };

  // Change Master Password
  const handleChangeMasterPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordNotice({ message: 'لطفاً تمامی فیلدها را پر نمایید.', isError: true });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordNotice({ message: 'رمز عبور جدید با تکرار آن یکسان نیست.', isError: true });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordNotice({ message: 'رمز عبور جدید باید حداقل ۸ کاراکتر باشد.', isError: true });
      return;
    }

    setIsChangingPassword(true);
    setPasswordNotice(null);

    try {
      const check = await CryptoService.verifyMasterPassword(oldPassword, settings);
      if (!check.ok) {
        setPasswordNotice({ message: 'رمز عبور فعلی نادرست است.', isError: true });
        setIsChangingPassword(false);
        return;
      }

      // Generate new salt, key (600k PBKDF2 iterations) and key-derived verifier
      const previousKey = currentKey;
      const newSalt = CryptoService.generateSalt();
      const newKey = await CryptoService.deriveKey(newPassword, newSalt, KDF_ITERATIONS);
      const newVerifier = await CryptoService.computeVerifier(newKey);

      // Re-encrypt vault and protected data (loans, hosting, Telegram) with the new key
      await StorageService.saveEncryptedVault(currentUser.username, vaultItems, newKey);
      await SecureStore.rekey(newKey);

      let updatedSettings: SecuritySettings = {
        ...settings,
        masterPasswordHash: newVerifier,
        salt: newSalt,
        kdfIterations: KDF_ITERATIONS,
      };
      StorageService.saveUserSettings(currentUser.username, updatedSettings);
      onChangeKey(newKey);

      // Re-wrap the biometric key for the new master key
      let bioNote = '';
      if (settings.biometricEnabled && settings.biometricCredentialId) {
        try {
          const mode = await BiometricKeyStore.wrapForCredential(
            currentUser.username,
            settings.biometricCredentialId,
            newKey,
            { tryPrf: settings.biometricKeyMode === 'prf' }
          );
          updatedSettings = { ...updatedSettings, biometricKeyMode: mode };
        } catch {
          await BiometricKeyStore.remove(currentUser.username);
          updatedSettings = { ...updatedSettings, biometricEnabled: false, biometricCredentialId: undefined, biometricKeyMode: undefined };
          bioNote = ' ورود بیومتریک غیرفعال شد؛ در صورت تمایل دوباره فعالش کنید.';
        }
        StorageService.saveUserSettings(currentUser.username, updatedSettings);
      }
      onUpdateSettings(updatedSettings);

      // Keep the cloud backup in sync (proves ownership with the previous key)
      let cloudNote = '';
      if (StorageService.getLastCloudSyncTime(currentUser.username)) {
        const syncRes = await StorageService.syncVaultToCloud(currentUser.username, newKey, { previousKey });
        if (syncRes.success) {
          setLastCloudSync(syncRes.updatedAt || new Date().toISOString());
          cloudNote = ' نسخه ابری هم به‌روز شد.';
        } else {
          cloudNote = ` ⚠️ به‌روزرسانی نسخه ابری انجام نشد: ${syncRes.message}`;
        }
      }

      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordNotice({ message: `✅ رمز عبور اصلی با موفقیت تغییر کرد و گاوصندوق مجدداً رمزنگاری شد.${bioNote}${cloudNote}`, isError: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در تغییر رمز';
      setPasswordNotice({ message: `❌ خطا: ${msg}`, isError: true });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Full JSON Backup Export
  const handleExportJSON = () => {
    const backupData = {
      version: 2,
      timestamp: new Date().toISOString(),
      user: {
        username: currentUser.username,
        displayName: currentUser.displayName,
      },
      items: vaultItems,
      loans: loans,
      hostingItems: hostingItems,
      telegramSettings: tgSettings,
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `keeppass-ghest-backup-${currentUser.username}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setBackupNotice('✅ فایل پشتیبان کامل با موفقیت دانلود شد.');
    setTimeout(() => setBackupNotice(''), 4000);
  };

  // JSON Backup Import
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        let importedCount = 0;
        if (Array.isArray(parsed.items)) {
          onImportVaultItems(parsed.items);
          importedCount += parsed.items.length;
        }

        if (Array.isArray(parsed.loans)) {
          LoanService.saveLoans(currentUser.username, parsed.loans);
        }

        if (Array.isArray(parsed.hostingItems)) {
          parsed.hostingItems.forEach((h: HostingDomainItem) => {
            HostingService.saveHostingItem(currentUser.username, h);
          });
        }

        if (parsed.telegramSettings) {
          handleSaveTelegramSettings(parsed.telegramSettings);
        }

        setBackupNotice(`✅ اطلاعات با موفقیت بازیابی شد (${importedCount} مورد گاوصندوق، اقساط و هاست‌ها).`);
      } catch (err) {
        setBackupNotice('❌ خطا در خواندن فایل پشتیبان. فرمت فایل نامعتبر است.');
      }
      setTimeout(() => setBackupNotice(''), 5000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Persistent Storage activation handler
  const handleRequestPersistence = async () => {
    setIsRequestingPersist(true);
    try {
      const res = await StorageService.initPersistentStorage();
      setIsPersisted(res.isPersisted);
      if (res.isPersisted) {
        setCloudNotice({ message: '✅ ذخیره‌سازی پایدار با موفقیت توسط مرورگر و سیستم‌عامل تایید گردید.', isError: false });
      } else {
        setCloudNotice({ message: '⚠️ مرورگر به صورت خودکار حافظه را مدیریت می‌کند. برای تضمین امنیت از همگام‌سازی ابری استفاده کنید.', isError: false });
      }
    } catch {
      setCloudNotice({ message: 'خطا در درخواست دسترسی از مرورگر.', isError: true });
    } finally {
      setIsRequestingPersist(false);
    }
  };

  // Automatic cloud sync toggle & live status
  const syncState = useAutoSyncState();
  const autoSyncOn = settings.autoCloudSync !== false;
  const handleToggleAutoSync = (on: boolean) => {
    const updated: SecuritySettings = { ...settings, autoCloudSync: on };
    onUpdateSettings(updated);
    StorageService.saveUserSettings(currentUser.username, updated);
    AutoSyncService.setEnabled(on);
  };

  // Zero-Knowledge Cloud Sync handler
  const handleSyncToCloud = async () => {
    setIsSyncingCloud(true);
    setCloudNotice(null);
    try {
      await AutoSyncService.syncNow({ manual: true });
      const st = AutoSyncService.getState();
      if (st.status === 'synced') {
        setLastCloudSync(st.lastSyncAt || new Date().toISOString());
        setCloudNotice({ message: '✅ همگام‌سازی ابری با موفقیت انجام شد و داده‌ها به صورت رمزنگاری‌شده ذخیره گردیدند.', isError: false });
      } else if (st.status === 'conflict') {
        setCloudNotice({ message: '⚠️ نسخه جدیدتری از دستگاه دیگری در ابر هست؛ از پیام بالای صفحه انتخاب کنید کدام نسخه بماند.', isError: true });
      } else {
        setCloudNotice({ message: '❌ ' + (st.message || 'ذخیره ابری انجام نشد.'), isError: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در ارتباط';
      setCloudNotice({ message: '❌ خطا در همگام‌سازی ابری: ' + msg, isError: true });
    } finally {
      setIsSyncingCloud(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Settings Top Header Card */}
      <div 
        className="p-6 rounded-3xl border border-[#1F2B47] bg-gradient-to-br from-[#121A2C] via-[#0F1524] to-[#0A0D14] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl"
        style={{ borderColor: 'var(--ui-border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#4F7CFF] to-[#8A5CFF] p-0.5 flex items-center justify-center shadow-lg shadow-[#4F7CFF]/20">
            <div className="w-full h-full bg-[#0A0D14] rounded-[14px] flex items-center justify-center">
              <Settings className="w-6 h-6 text-[#38E1FF]" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-black text-white" style={{ color: 'var(--ui-text-primary)' }}>
              تنظیمات سامانه، پشتیبان و هشدارها
            </h1>
            <p className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>
              پیکربندی ربات تلگرام، امنیت حساب و مدیریت پشتیبان‌های رمزنگاری شده
            </p>
          </div>
        </div>

        {/* User Badge */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#0F1524] border border-[#1F2B47] self-start sm:self-auto"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-white">{currentUser.displayName || currentUser.username}</span>
          <span className="text-[10px] text-[#94A2C2] font-mono">({currentUser.username})</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#1F2B47]" style={{ borderColor: 'var(--ui-border)' }}>
        <button
          onClick={() => setActiveTab('telegram')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'telegram'
              ? 'bg-[#4F7CFF] text-white shadow-md shadow-[#4F7CFF]/20'
              : 'text-[#94A2C2] hover:text-white hover:bg-white/5'
          }`}
        >
          <Send className="w-4 h-4 text-[#38E1FF]" />
          <span>اتصال تلگرام (هشدارها)</span>
          {tgSettings.enabled && (
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('deployment')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'deployment'
              ? 'bg-[#4F7CFF] text-white shadow-md shadow-[#4F7CFF]/20'
              : 'text-[#94A2C2] hover:text-white hover:bg-white/5'
          }`}
        >
          <Rocket className="w-4 h-4 text-amber-400" />
          <span>نسخه و به‌روزرسانی</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'security'
              ? 'bg-[#4F7CFF] text-white shadow-md shadow-[#4F7CFF]/20'
              : 'text-[#94A2C2] hover:text-white hover:bg-white/5'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>امنیت و رمز عبور</span>
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'backup'
              ? 'bg-[#4F7CFF] text-white shadow-md shadow-[#4F7CFF]/20'
              : 'text-[#94A2C2] hover:text-white hover:bg-white/5'
          }`}
        >
          <Database className="w-4 h-4 text-amber-400" />
          <span>پشتیبان و داده‌ها</span>
        </button>

        <button
          onClick={() => setActiveTab('ios')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'ios'
              ? 'bg-[#4F7CFF] text-white shadow-md shadow-[#4F7CFF]/20'
              : 'text-[#94A2C2] hover:text-white hover:bg-white/5'
          }`}
        >
          <Smartphone className="w-4 h-4 text-purple-400" />
          <span>راهنمای آیفون و iOS</span>
        </button>
      </div>

      {/* TAB CONTENT: DEPLOYMENT & DEVOPS */}
      {activeTab === 'deployment' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <DeploymentManagerTab />
        </div>
      )}

      {/* TAB CONTENT 1: TELEGRAM INTEGRATION */}
      {activeTab === 'telegram' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Status Alert Banner */}
          {tgStatusNotice && (
            <div className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold shadow-lg ${
              tgStatusNotice.isError 
                ? 'bg-red-500/10 border border-red-500/30 text-red-300' 
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
            }`}>
              <div className="flex items-center gap-2">
                {tgStatusNotice.isError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{tgStatusNotice.message}</span>
              </div>
              <button onClick={() => setTgStatusNotice(null)} className="text-white/60 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>
          )}

          {/* Telegram Config Card */}
          <div 
            className="p-6 rounded-3xl bg-[#121A2C] border border-[#1F2B47] space-y-6 shadow-xl"
            style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1F2B47]" style={{ borderColor: 'var(--ui-border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#0088cc]/10 border border-[#0088cc]/20 flex items-center justify-center text-[#0088cc]">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>پیکربندی ربات تلگرام برای هشدارهای سررسید</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0088cc]/10 text-[#0088cc] border border-[#0088cc]/20">
                      Telegram Bot API
                    </span>
                  </h2>
                  <p className="text-xs text-[#94A2C2]">
                    ارسال خودکار و دستی پیام‌های هشدار سررسید اقساط و انقضای هاست‌ها به پیوی یا گروه شما
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                  tgSettings.botToken && tgSettings.chatId
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${tgSettings.botToken && tgSettings.chatId ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  {tgSettings.botToken && tgSettings.chatId ? 'اطلاعات ربات تنظیم شده' : 'نیازمند تنظیم توکن و چت'}
                </span>
              </div>
            </div>

            {/* Inputs Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#94A2C2] mb-1.5">
                  توکن ربات تلگرام (Bot Token) *
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={tgSettings.botToken}
                  onChange={(e) => handleSaveTelegramSettings({ ...tgSettings, botToken: e.target.value.trim() })}
                  placeholder="مثال: 7123456789:AAHk..._XYZ"
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-3 text-xs text-white font-mono placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                  style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                />
                <span className="text-[11px] text-[#5D6B8F] mt-1 block">
                  از ربات رسمی <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-[#38E1FF] hover:underline">@BotFather</a> در تلگرام دریافت می‌شود.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#94A2C2] mb-1.5">
                  شناسه چت یا کانال (Chat ID) *
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={tgSettings.chatId}
                  onChange={(e) => handleSaveTelegramSettings({ ...tgSettings, chatId: e.target.value.trim() })}
                  placeholder="مثال: 123456789 یا @my_channel"
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-3 text-xs text-white font-mono placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                  style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                />
                <span className="text-[11px] text-[#5D6B8F] mt-1 block">
                  با ارسال پیام به ربات <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-[#38E1FF] hover:underline">@userinfobot</a> شناسه عددی خود را ببینید.
                </span>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="p-4 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-3.5"
              style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
            >
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-amber-400" />
                <span>تنظیمات هشدارهای هوشمند</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Days before alert */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#94A2C2] mb-1">
                    بازه هشدار پیش از موعد:
                  </label>
                  <select
                    value={tgSettings.alertDaysBefore}
                    onChange={(e) => handleSaveTelegramSettings({ ...tgSettings, alertDaysBefore: Number(e.target.value) })}
                    className="w-full bg-[#121A2C] border border-[#1F2B47] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4F7CFF]"
                  >
                    <option value={1}>۱ روز قبل از سررسید</option>
                    <option value={2}>۲ روز قبل از سررسید</option>
                    <option value={3}>۳ روز قبل از سررسید (پیش‌فرض)</option>
                    <option value={5}>۵ روز قبل از سررسید</option>
                    <option value={7}>۷ روز قبل (یک هفته)</option>
                    <option value={10}>۱۰ روز قبل از سررسید</option>
                  </select>
                </div>

                {/* Loans toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#121A2C] border border-[#1F2B47]">
                  <div>
                    <div className="text-xs font-bold text-white">هشدارهای وام و اقساط</div>
                    <div className="text-[10px] text-[#94A2C2]">اقساط معوقه و فوری</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={tgSettings.sendLoansAlerts}
                    onChange={(e) => handleSaveTelegramSettings({ ...tgSettings, sendLoansAlerts: e.target.checked })}
                    className="w-4 h-4 accent-[#4F7CFF] rounded cursor-pointer"
                  />
                </div>

                {/* Hostings toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#121A2C] border border-[#1F2B47]">
                  <div>
                    <div className="text-xs font-bold text-white">هشدارهای هاست و دامنه</div>
                    <div className="text-[10px] text-[#94A2C2]">سررسید تمدید سالانه</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={tgSettings.sendHostAlerts}
                    onChange={(e) => handleSaveTelegramSettings({ ...tgSettings, sendHostAlerts: e.target.checked })}
                    className="w-4 h-4 accent-[#4F7CFF] rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Test & Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isSendingTgTest}
                onClick={handleTestTelegram}
                className="py-3 px-5 rounded-xl bg-gradient-to-r from-[#0088cc] to-[#00a8e8] hover:opacity-90 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-[#0088cc]/20 cursor-pointer disabled:opacity-50 transition transform active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>{isSendingTgTest ? 'در حال ارسال تست...' : 'تست اتصال و ارسال پیام به تلگرام'}</span>
              </button>

              <button
                type="button"
                disabled={isSendingTgSummary}
                onClick={handleSendDueAlertsSummary}
                className="py-3 px-5 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-[#38E1FF] text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 transition"
                style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
              >
                <Bell className="w-4 h-4 text-amber-400" />
                <span>{isSendingTgSummary ? 'در حال ارسال...' : 'ارسال دستی خلاصه سررسیدها به تلگرام'}</span>
              </button>
            </div>
          </div>

          {/* Quick Step-by-Step Guide Card */}
          <div 
            className="p-6 rounded-3xl bg-[#121A2C] border border-[#1F2B47] space-y-4 shadow-xl"
            style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#38E1FF]" />
              <span>راهنمای ۳ مرحله‌ای راه‌اندازی ربات تلگرام:</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-2"
                style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
              >
                <div className="w-6 h-6 rounded-full bg-[#4F7CFF]/20 text-[#4F7CFF] font-black text-xs flex items-center justify-center font-mono">
                  1
                </div>
                <h4 className="font-bold text-white">ساخت ربات با BotFather</h4>
                <p className="text-[#94A2C2] text-[11px] leading-relaxed">
                  در تلگرام به <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-[#38E1FF] underline">@BotFather</a> پیام دهید و دستور <code>/newbot</code> را بفرستید تا توکن ربات (HTTP API Token) را دریافت کنید.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-2"
                style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
              >
                <div className="w-6 h-6 rounded-full bg-[#4F7CFF]/20 text-[#4F7CFF] font-black text-xs flex items-center justify-center font-mono">
                  2
                </div>
                <h4 className="font-bold text-white">استارت ربات خودتان</h4>
                <p className="text-[#94A2C2] text-[11px] leading-relaxed">
                  وارد آیدی رباتی که ساختید شوید و دکمه <b>Start</b> را بزنید تا ربات اجازه ارسال پیام به شما را داشته باشد.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-2"
                style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
              >
                <div className="w-6 h-6 rounded-full bg-[#4F7CFF]/20 text-[#4F7CFF] font-black text-xs flex items-center justify-center font-mono">
                  3
                </div>
                <h4 className="font-bold text-white">دریافت شناسه (Chat ID)</h4>
                <p className="text-[#94A2C2] text-[11px] leading-relaxed">
                  پیامی به <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-[#38E1FF] underline">@userinfobot</a> بفرستید تا عدد <code>Id</code> شما را بگوید، سپس آن را در کادر بالا وارد کرده و دکمه تست را بزنید!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: SECURITY & PASSWORDS */}
      {activeTab === 'security' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Biometrics Card */}
          <div 
            className="p-6 rounded-3xl bg-[#121A2C] border border-[#1F2B47] space-y-5 shadow-xl"
            style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#1F2B47]" style={{ borderColor: 'var(--ui-border)' }}>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>ورود بیومتریک ({deviceBio.labelFa})</span>
                </h3>
                <p className="text-xs text-[#94A2C2] mt-0.5">
                  استفاده از سنسور اثر انگشت یا چهره بدون نیاز به وارد کردن مکرر رمز عبور
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.biometricEnabled}
                  onChange={(e) => handleToggleBiometric(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#0F1524] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4F7CFF]" />
              </label>
            </div>

            {settings.biometricEnabled && (
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  disabled={isTestingBio}
                  onClick={handleTestBiometric}
                  className="py-2 px-4 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  <span>تست اعتبارسنجی بیومتریک دستگاه</span>
                </button>

                {bioTestStatus && (
                  <span className="text-xs font-bold text-[#38E1FF]">{bioTestStatus}</span>
                )}
              </div>
            )}
          </div>

          {/* Auto Lock Timer */}
          <div 
            className="p-6 rounded-3xl bg-[#121A2C] border border-[#1F2B47] space-y-4 shadow-xl"
            style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#38E1FF]" />
                  <span>زمان‌بندی قفل خودکار گاوصندوق</span>
                </h3>
                <p className="text-xs text-[#94A2C2] mt-0.5">
                  در صورت عدم فعالیت یا به حداقل رسیدن تب مرورگر
                </p>
              </div>

              <select
                value={settings.autoLockMinutes}
                onChange={(e) => {
                  const minutes = Number(e.target.value);
                  const updated = { ...settings, autoLockMinutes: minutes };
                  onUpdateSettings(updated);
                  StorageService.saveUserSettings(currentUser.username, updated);
                }}
                className="bg-[#0F1524] border border-[#1F2B47] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4F7CFF]"
              >
                <option value={0}>بلافاصله پس از رفتن به پس‌زمینه</option>
                <option value={1}>۱ دقیقه عدم فعالیت</option>
                <option value={5}>۵ دقیقه عدم فعالیت (پیش‌فرض)</option>
                <option value={15}>۱۵ دقیقه عدم فعالیت</option>
                <option value={-1}>هرگز قفل نشود</option>
              </select>
            </div>
          </div>

          {/* Change Master Password Card */}
          <div 
            className="p-6 rounded-3xl bg-[#121A2C] border border-[#1F2B47] space-y-4 shadow-xl"
            style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-purple-400" />
              <span>تغییر رمز عبور اصلی کاربر</span>
            </h3>

            {passwordNotice && (
              <div className={`p-3 rounded-xl text-xs font-bold ${
                passwordNotice.isError ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {passwordNotice.message}
              </div>
            )}

            <form onSubmit={handleChangeMasterPassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#94A2C2] mb-1">رمز عبور فعلی</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#94A2C2] mb-1">رمز عبور جدید</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#94A2C2] mb-1">تکرار رمز عبور جدید</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-xs text-[#94A2C2] hover:text-white flex items-center gap-1.5 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{showPassword ? 'مخفی کردن حروف رمز' : 'نمایش حروف رمز'}</span>
                </button>

                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#8A5CFF] text-white text-xs font-bold shadow-lg shadow-[#4F7CFF]/20 cursor-pointer disabled:opacity-50"
                >
                  {isChangingPassword ? 'در حال رمزنگاری مجدد...' : 'ذخیره رمز عبور جدید'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: BACKUP & DATA MANAGEMENT */}
      {activeTab === 'backup' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {backupNotice && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold shadow-lg">
              {backupNotice}
            </div>
          )}

          {/* CARD: Protection against Cache Clearance & App Uninstall */}
          <div 
            className="p-6 rounded-3xl bg-[#121A2C] border border-emerald-500/30 space-y-5 shadow-xl relative overflow-hidden"
            style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1F2B47]" style={{ borderColor: 'var(--ui-border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>محافظت در برابر پاک شدن کش گوشی و حذف اپلیکیشن</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Zero-Knowledge Sync
                    </span>
                  </h3>
                  <p className="text-xs text-[#94A2C2]">
                    ذخیره دائمی و پشتیبان‌گیری رمزشده سرتاسری برای بازیابی آنی پس از ریست یا نصب مجدد
                  </p>
                </div>
              </div>

              {lastCloudSync && (
                <div className="text-[11px] text-slate-400 font-mono">
                  آخرین همگام‌سازی: {new Date(lastCloudSync).toLocaleDateString('fa-IR')}
                </div>
              )}
            </div>

            {cloudNotice && (
              <div className={`p-3 rounded-xl text-xs font-bold ${
                cloudNotice.isError ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
              }`}>
                {cloudNotice.message}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Feature 1: Persistent Storage */}
              <div className="p-4 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-3" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#38E1FF]" />
                    <h4 className="text-xs font-bold text-white">ذخیره‌سازی پایدار مرورگر (Persistent Storage)</h4>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isPersisted ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}>
                    {isPersisted ? 'فعال و محافظت‌شده' : 'پیش‌فرض مرورگر'}
                  </span>
                </div>
                <p className="text-[11px] text-[#94A2C2] leading-relaxed">
                  جلوگیری از پاک شدن خودکار حافظه کش در سافاری آیفون و اندروید هنگام کمبود فضای ذخیره‌سازی گوشی.
                </p>
                <button
                  type="button"
                  disabled={isRequestingPersist || isPersisted}
                  onClick={handleRequestPersistence}
                  className="w-full py-2 px-3 rounded-xl bg-[#1F2B47] hover:bg-[#2C3C61] text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {isPersisted ? '✓ حافظه در برابر پاکسازی خودکار محافظت شده است' : 'درخواست فعال‌سازی حافظه پایدار از سیستم‌عامل'}
                </button>
              </div>

              {/* Feature 2: Zero-Knowledge Cloud Backup */}
              <div className="p-4 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-3" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white">همگام‌سازی ابری با دانش صفر (Cloud Backup)</h4>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    AES-256-GCM
                  </span>
                </div>
                <p className="text-[11px] text-[#94A2C2] leading-relaxed">
                  اطلاعات در دستگاه شما رمزگذاری می‌شوند و کلید هرگز به سرور ارسال نمی‌شود؛ در صورت حذف برنامه، با رمز اصلی برمی‌گردند.
                </p>

                {/* Automatic sync toggle */}
                <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-black/20 border border-white/5 cursor-pointer">
                  <div>
                    <div className="text-xs font-bold text-white">همگام‌سازی خودکار</div>
                    <div className="text-[11px] text-[#94A2C2] mt-0.5">
                      {autoSyncOn ? describeSync(syncState).text : 'خاموش — فقط با دکمه زیر ذخیره می‌شود'}
                    </div>
                  </div>
                  <span className="relative inline-flex shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={autoSyncOn}
                      onChange={(e) => handleToggleAutoSync(e.target.checked)}
                      aria-label="همگام‌سازی خودکار"
                    />
                    <span className="w-11 h-6 rounded-full bg-[#1F2B47] peer-checked:bg-emerald-500 transition" />
                    <span className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white shadow transition peer-checked:-translate-x-5" />
                  </span>
                </label>
                <button
                  type="button"
                  disabled={isSyncingCloud}
                  onClick={handleSyncToCloud}
                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSyncingCloud ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>در حال همگام‌سازی رمزشده...</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-3.5 h-3.5" />
                      <span>همگام‌سازی و ذخیره ابری همین حالا</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div 
            className="p-6 rounded-3xl bg-[#121A2C] border border-[#1F2B47] space-y-6 shadow-xl"
            style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          >
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-400" />
                <span>پشتیبان‌گیری کامل و بازیابی یکپارچه</span>
              </h3>
              <p className="text-xs text-[#94A2C2] mt-0.5">
                فایل خروجی شامل کلیه رمزها، اقساط، وام‌ها، اطلاعات هاست‌ها و تنظیمات تلگرام است
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Export JSON Card */}
              <div className="p-5 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-3"
                style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#4F7CFF]/10 text-[#4F7CFF]">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">دریافت فایل پشتیبان کامل (JSON)</h4>
                    <p className="text-[10px] text-[#94A2C2]">رمزنگاری شده و سازگار با همه دستگاه‌ها</p>
                  </div>
                </div>

                <button
                  onClick={handleExportJSON}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#4F7CFF] hover:bg-[#3d6bf0] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#4F7CFF]/20 cursor-pointer transition"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود فایل پشتیبان کامل</span>
                </button>
              </div>

              {/* Import JSON Card */}
              <div className="p-5 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-3"
                style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">بازیابی از فایل پشتیبان (Import)</h4>
                    <p className="text-[10px] text-[#94A2C2]">افزودن و ترکیب اطلاعات فایل JSON</p>
                  </div>
                </div>

                <label className="w-full py-2.5 px-4 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>انتخاب و بارگذاری فایل JSON</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJSON}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Clear Vault */}
            <div className="pt-4 border-t border-[#1F2B47] flex items-center justify-between" style={{ borderColor: 'var(--ui-border)' }}>
              <div>
                <h4 className="text-xs font-bold text-red-400">حذف موارد گاوصندوق این کاربر</h4>
                <p className="text-[11px] text-[#94A2C2]">تمامی کارت‌ها و رمزهای ثبت شده پاکسازی خواهند شد</p>
              </div>
              <button
                onClick={onResetVault}
                className="py-2 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>پاکسازی گاوصندوق</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: IOS GUIDE */}
      {activeTab === 'ios' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div 
            className="p-6 rounded-3xl bg-[#121A2C] border border-[#1F2B47] space-y-4 shadow-xl"
            style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">راهنمای پرکردن خودکار رمزها در آیفون (iOS Fill)</h3>
                <p className="text-xs text-[#94A2C2]">استفاده از میانبر Apple Shortcuts برای پر کردن در سافاری</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-2 text-xs text-[#94A2C2] leading-relaxed"
              style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
            >
              <p>۱. برنامه KeepPass به صورت PWA استاندارد بر روی صفحه اصلی (Add to Home Screen) نصب می‌شود.</p>
              <p>۲. برای پر کردن سریع رمزها در برنامه‌ها یا سافاری آیفون، می‌توانید از شورتکات رسمی iOS بهره ببرید.</p>
              <p>۳. کلیه اطلاعات به صورت آفلاین و در حافظه امن مرورگر شما با الگوریتم AES-GCM نگهداری می‌شود.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
