import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  Scan, 
  Fingerprint, 
  KeyRound, 
  Clock, 
  Download, 
  Upload, 
  RefreshCw, 
  Check, 
  AlertTriangle,
  Smartphone,
  Eye,
  EyeOff,
  Sparkles,
  Cloud
} from 'lucide-react';
import { SecuritySettings, VaultItem, UserProfile } from '../types';
import { BiometricService } from '../services/webauthn';
import { CryptoService } from '../services/crypto';
import { StorageService } from '../services/storage';
import { CloudflareWorkersCard } from './CloudflareWorkersCard';

interface SettingsModalProps {
  isOpen: boolean;
  currentUser?: UserProfile | null;
  settings: SecuritySettings;
  items: VaultItem[];
  currentKey: CryptoKey;
  onClose: () => void;
  onUpdateSettings: (newSettings: SecuritySettings) => void;
  onImportItems: (importedItems: VaultItem[]) => void;
  onResetVault: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  currentUser,
  settings,
  items,
  currentKey,
  onClose,
  onUpdateSettings,
  onImportItems,
  onResetVault,
}) => {
  const username = currentUser ? currentUser.username : (StorageService.getActiveUsername() || 'admin');
  const [activeTab, setActiveTab] = useState<'security' | 'cloudflare' | 'backup' | 'general' | 'ios-fill'>('security');

  // Biometric test state
  const [bioTestStatus, setBioTestStatus] = useState<string>('');
  const [isTestingBio, setIsTestingBio] = useState(false);

  // Change password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Backup status
  const [backupMsg, setBackupMsg] = useState<string>('');

  if (!isOpen) return null;

  const deviceBio = BiometricService.getDeviceBiometricLabel();

  // Test Biometric Unlock
  const handleTestBiometric = async () => {
    setIsTestingBio(true);
    setBioTestStatus('در حال درخواست اسکن...');
    try {
      const verified = await BiometricService.verifyBiometric(settings.biometricCredentialId);
      if (verified) {
        setBioTestStatus('✅ احراز هویت بیومتریک با موفقیت تایید شد!');
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

  // Toggle Biometric
  const handleToggleBiometric = async (enabled: boolean) => {
    if (enabled) {
      try {
        const credId = await BiometricService.registerBiometric();
        await StorageService.cacheKeyForBiometrics(username, currentKey);
        const updated: SecuritySettings = {
          ...settings,
          biometricEnabled: true,
          biometricCredentialId: credId,
          biometricType: deviceBio.type,
        };
        StorageService.saveUserSettings(username, updated);
        onUpdateSettings(updated);
      } catch (err) {
        console.warn('Failed to register biometric:', err);
      }
    } else {
      StorageService.clearBiometricKeyCache(username);
      const updated: SecuritySettings = {
        ...settings,
        biometricEnabled: false,
        biometricCredentialId: undefined,
      };
      StorageService.saveUserSettings(username, updated);
      onUpdateSettings(updated);
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    try {
      const oldHash = await CryptoService.hashPassword(oldPassword, settings.salt);
      if (oldHash !== settings.masterPasswordHash) {
        setPasswordMsg({ text: 'رمز عبور فعلی اشتباه است.', isError: true });
        return;
      }

      if (newPassword.length < 4) {
        setPasswordMsg({ text: 'رمز عبور جدید باید حداقل ۴ کاراکتر باشد.', isError: true });
        return;
      }

      if (newPassword !== confirmPassword) {
        setPasswordMsg({ text: 'رمز عبور جدید با تکرار آن یکسان نیست.', isError: true });
        return;
      }

      const newSalt = CryptoService.generateSalt();
      const newKey = await CryptoService.deriveKey(newPassword, newSalt);
      const newHash = await CryptoService.hashPassword(newPassword, newSalt);

      // Re-encrypt vault with new key
      await StorageService.saveEncryptedVault(username, items, newKey);

      // Re-cache for biometrics if enabled
      if (settings.biometricEnabled) {
        await StorageService.cacheKeyForBiometrics(username, newKey);
      }

      const updatedSettings: SecuritySettings = {
        ...settings,
        salt: newSalt,
        masterPasswordHash: newHash,
      };

      StorageService.saveUserSettings(username, updatedSettings);
      onUpdateSettings(updatedSettings);
      setPasswordMsg({ text: 'رمز اصلی با موفقیت تغییر یافت.', isError: false });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در تغییر رمز عبور.';
      setPasswordMsg({ text: msg, isError: true });
    }
  };

  // Export Encrypted Backup
  const handleExportBackup = async () => {
    try {
      const backupStr = await StorageService.exportBackup(items);
      const blob = new Blob([backupStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `keeppass-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMsg('فایل پشتیبان با موفقیت دانلود شد.');
      setTimeout(() => setBackupMsg(''), 3000);
    } catch {
      setBackupMsg('خطا در ایجاد فایل پشتیبان.');
    }
  };

  // Import Backup
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = evt.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.items && Array.isArray(parsed.items)) {
          onImportItems(parsed.items);
          setBackupMsg('اطلاعات فایل پشتیبان با موفقیت بازگردانی شد.');
        } else if (Array.isArray(parsed)) {
          onImportItems(parsed);
          setBackupMsg('اطلاعات با موفقیت بازگردانی شد.');
        } else {
          setBackupMsg('قالب فایل پشتیبان نامعتبر است.');
        }
      } catch {
        setBackupMsg('خطا در خواندن فایل پشتیبان.');
      }
      setTimeout(() => setBackupMsg(''), 4000);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div 
        className="w-full max-w-xl bg-[#121A2C] border border-[#1F2B47] text-[#E7EDFA] rounded-2xl p-5 sm:p-6 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto"
        style={{
          backgroundColor: 'var(--ui-surface)',
          borderColor: 'var(--ui-border)',
          color: 'var(--ui-text)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1F2B47] sticky top-0 bg-[#121A2C] z-10 -mt-2 pt-2" style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#4F7CFF] to-[#8A5CFF] flex items-center justify-center text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">تنظیمات امنیت و گاوصندوق</h3>
              <p className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>مدیریت فیس‌آیدی، اثر انگشت، رمز اصلی و پشتیبان‌گیری</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#94A2C2] hover:text-white hover:bg-[#182239] transition cursor-pointer"
            style={{ color: 'var(--ui-text-secondary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="mt-4 p-1 rounded-xl bg-[#0F1524] border border-[#1F2B47] flex items-center gap-1 text-xs overflow-x-auto scrollbar-none" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'security'
                ? 'bg-[#4F7CFF] text-white shadow'
                : 'text-[#94A2C2] hover:text-white'
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
            امنیت و بیومتریک
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cloudflare')}
            className={`py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'cloudflare'
                ? 'bg-[#F38020] text-white shadow shadow-[#F38020]/25'
                : 'text-[#94A2C2] hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            اتصال به Cloudflare
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'backup'
                ? 'bg-[#4F7CFF] text-white shadow'
                : 'text-[#94A2C2] hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            پشتیبان و بازیابی
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ios-fill')}
            className={`py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'ios-fill'
                ? 'bg-[#007AFF] text-white shadow shadow-blue-500/25'
                : 'text-[#94A2C2] hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            AutoFill آیفون
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'general'
                ? 'bg-[#4F7CFF] text-white shadow'
                : 'text-[#94A2C2] hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            قفل خودکار
          </button>
        </div>

        {/* Tab: iOS AutoFill */}
        {activeTab === 'ios-fill' && (
          <div className="mt-5 space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0F1524] to-[#162238] border border-[#1F2B47] text-right" style={{ borderColor: 'var(--ui-border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="w-5 h-5 text-[#38E1FF]" />
                <h4 className="font-bold text-sm text-white">پرکردن خودکار در آیفون (iOS Fill Password & Keychain)</h4>
              </div>
              <p className="text-xs text-[#94A2C2] leading-relaxed mb-4" style={{ color: 'var(--ui-text-secondary)' }}>
                در آیفون، هنگامی که برای بار اول رمز اصلی گاوصندوق را تایپ می‌کنید، مرورگر سافاری پیشنهاد ذخیره در <strong>iCloud Keychain</strong> را می‌دهد. پس از ذخیره، با هر بار مراجعه به سایت، دکمه آبی‌رنگ <strong>Passwords 🔑</strong> در بالای کیبورد ظاهر می‌شود و با فیس‌آیدی رمز را با یک لمس پر می‌کند.
              </p>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-xl bg-[#121A2C] border border-[#1F2B47] flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-[11px]">۱</span>
                  <span className="text-[#E7EDFA]">
                    در تنظیمات آیفون: مسیر <strong>Settings &gt; Passwords &gt; Password Options</strong> را باز کنید و گزینه <strong>AutoFill Passwords and Passkeys</strong> را روشن کنید.
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#121A2C] border border-[#1F2B47] flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-[11px]">۲</span>
                  <span className="text-[#E7EDFA]">
                    در هنگام ورود، دکمه آبی <strong>Passwords</strong> بالای کیبورد را بزنید تا با اسکن فیس‌آیدی وارد شوید.
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#1F2B47]">
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const inputEl = (e.currentTarget.elements.namedItem('keychain-test') as HTMLInputElement)?.value;
                    if (inputEl) {
                      const { IOSAutoFillService } = await import('../services/iosAutofill');
                      await IOSAutoFillService.saveMasterPasswordToKeychain(inputEl, 'گاوصندوق رمزها');
                      alert('درخواست ذخیره در Keychain ارسال شد!');
                    }
                  }}
                  className="space-y-2"
                >
                  <label className="block text-xs font-semibold text-[#94A2C2]">تست و ذخیره رمز در جاکلیدی آیفون:</label>
                  <div className="flex gap-2">
                    <input
                      name="keychain-test"
                      type="password"
                      placeholder="رمز اصلی گاوصندوق..."
                      className="flex-1 bg-[#121A2C] border border-[#1F2B47] rounded-xl px-3 py-2 text-xs text-white"
                      required
                    />
                    <button
                      type="submit"
                      className="py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer"
                    >
                      ذخیره در Keychain
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Cloudflare Workers */}
        {activeTab === 'cloudflare' && (
          <div className="mt-5">
            <CloudflareWorkersCard />
          </div>
        )}

        {/* Tab 1: Security & Biometrics */}
        {activeTab === 'security' && (
          <div className="mt-5 space-y-5">
            {/* Biometric Card */}
            <div className="p-4 rounded-xl bg-[#0F1524] border border-[#1F2B47] space-y-3" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#4F7CFF]/15 text-[#4F7CFF] flex items-center justify-center">
                    {deviceBio.type === 'face-id' ? <Scan className="w-5 h-5" /> : <Fingerprint className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                      {deviceBio.labelFa}
                      {settings.biometricEnabled && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-normal">فعال</span>
                      )}
                    </h4>
                    <p className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>{deviceBio.subLabelFa}</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.biometricEnabled}
                    onChange={(e) => handleToggleBiometric(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#1F2B47] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4F7CFF]"></div>
                </label>
              </div>

              {settings.biometricEnabled && (
                <div className="pt-3 border-t border-[#1F2B47]/60 space-y-2.5" style={{ borderColor: 'var(--ui-border)' }}>
                  {/* Auto-Prompt toggle */}
                  <label className="flex items-center justify-between text-xs cursor-pointer py-1">
                    <span className="text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>درخواست خودکار بیومتریک هنگام باز شدن برنامه</span>
                    <input
                      type="checkbox"
                      checked={settings.autoBiometricPrompt}
                      onChange={(e) => {
                        const updated = { ...settings, autoBiometricPrompt: e.target.checked };
                        StorageService.saveSettings(updated);
                        onUpdateSettings(updated);
                      }}
                      className="accent-[#4F7CFF] w-4 h-4 rounded"
                    />
                  </label>

                  {/* Test Biometrics Button */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleTestBiometric}
                      disabled={isTestingBio}
                      className="py-1.5 px-3 rounded-lg bg-[#182239] hover:bg-[#1F2B47] text-xs text-[#38E1FF] font-medium transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isTestingBio ? 'در حال اسکن...' : 'تست عملکرد فیس‌آیدی / اثر انگشت'}
                    </button>
                    {bioTestStatus && <span className="text-xs font-medium animate-pulse">{bioTestStatus}</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Change Master Password Card */}
            <div className="p-4 rounded-xl bg-[#0F1524] border border-[#1F2B47]" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
              <h4 className="font-bold text-sm text-white flex items-center gap-2 mb-3">
                <KeyRound className="w-4 h-4 text-[#4F7CFF]" />
                تغییر رمز عبور اصلی (Master Password)
              </h4>

              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <label className="block text-xs text-[#94A2C2] mb-1" style={{ color: 'var(--ui-text-secondary)' }}>رمز عبور فعلی</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full bg-[#121A2C] border border-[#1F2B47] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4F7CFF]"
                    style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-[#94A2C2] mb-1" style={{ color: 'var(--ui-text-secondary)' }}>رمز عبور جدید</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-[#121A2C] border border-[#1F2B47] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4F7CFF]"
                      style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#94A2C2] mb-1" style={{ color: 'var(--ui-text-secondary)' }}>تکرار رمز عبور جدید</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-[#121A2C] border border-[#1F2B47] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4F7CFF]"
                      style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
                      required
                    />
                  </div>
                </div>

                {passwordMsg && (
                  <div className={`p-2 rounded-lg text-xs ${passwordMsg.isError ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {passwordMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  className="py-2 px-4 rounded-xl bg-[#4F7CFF] text-white font-medium text-xs hover:bg-[#315FEA] transition cursor-pointer"
                >
                  به‌روزرسانی رمز عبور اصلی
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 2: Backup & Restore */}
        {activeTab === 'backup' && (
          <div className="mt-5 space-y-4">
            <div className="p-4 rounded-xl bg-[#0F1524] border border-[#1F2B47] space-y-3" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
              <div className="flex items-center gap-2.5 text-sm font-bold text-white">
                <Download className="w-4 h-4 text-[#4F7CFF]" />
                پشتیبان‌گیری از داده‌ها
              </div>
              <p className="text-xs text-[#94A2C2] leading-relaxed" style={{ color: 'var(--ui-text-secondary)' }}>
                می‌توانید تمام رمزهای عبور و اطلاعات ذخیره شده را در قالب یک فایل استاندارد JSON دانلود کرده و در جای امن نگهداری کنید.
              </p>
              <button
                type="button"
                onClick={handleExportBackup}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#8A5CFF] text-white font-bold text-xs shadow hover:opacity-95 transition cursor-pointer flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                دانلود فایل پشتیبان ({items.length} آیتم)
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#0F1524] border border-[#1F2B47] space-y-3" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
              <div className="flex items-center gap-2.5 text-sm font-bold text-white">
                <Upload className="w-4 h-4 text-[#8A5CFF]" />
                بازیابی اطلاعات از فایل پشتیبان
              </div>
              <p className="text-xs text-[#94A2C2] leading-relaxed" style={{ color: 'var(--ui-text-secondary)' }}>
                اگر قبلاً فایلی از KeepPass دانلود کرده‌اید، می‌توانید آن را انتخاب کنید تا رمزها بازیابی شوند.
              </p>
              <label className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl bg-[#182239] hover:bg-[#1F2B47] border border-[#1F2B47] text-white font-medium text-xs transition cursor-pointer">
                <Upload className="w-4 h-4 text-[#38E1FF]" />
                <span>انتخاب فایل پشتیبان (.json)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
            </div>

            {backupMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                {backupMsg}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Auto-lock & General */}
        {activeTab === 'general' && (
          <div className="mt-5 space-y-4">
            <div className="p-4 rounded-xl bg-[#0F1524] border border-[#1F2B47] space-y-3" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
              <div className="flex items-center gap-2.5 text-sm font-bold text-white">
                <Clock className="w-4 h-4 text-[#4F7CFF]" />
                زمان‌بندی قفل خودکار گاوصندوق
              </div>
              <p className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>
                برای امنیت اطلاعات شما در صورت عدم استفاده یا خارج شدن از برنامه:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { value: 0, label: 'بلافاصله با خروج' },
                  { value: 1, label: '۱ دقیقه' },
                  { value: 5, label: '۵ دقیقه' },
                  { value: 15, label: '۱۵ دقیقه' },
                  { value: 30, label: '۳۰ دقیقه' },
                  { value: -1, label: 'غیرفعال (فقط دستی)' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      const updated = { ...settings, autoLockMinutes: opt.value };
                      StorageService.saveSettings(updated);
                      onUpdateSettings(updated);
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition cursor-pointer ${
                      settings.autoLockMinutes === opt.value
                        ? 'bg-[#4F7CFF]/20 border-[#4F7CFF] text-[#4F7CFF]'
                        : 'bg-[#121A2C] border-[#1F2B47] text-[#94A2C2] hover:text-white'
                    }`}
                    style={settings.autoLockMinutes !== opt.value ? { backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' } : {}}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset Vault danger zone */}
            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
              <h5 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                منطقه خطر (Reset گاوصندوق)
              </h5>
              <p className="text-[11px] text-[#94A2C2] leading-relaxed" style={{ color: 'var(--ui-text-secondary)' }}>
                پاک کردن تمام اطلاعات و رمزها و بازگشت به تنظیمات اولیه کارخانه. این عملیات غیرقابل بازگشت است.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('آیا مطمئن هستید که تمام رمزها و تنظیمات گاوصندوق پاک شوند؟')) {
                    onResetVault();
                  }
                }}
                className="py-2 px-3.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 text-xs font-medium transition cursor-pointer"
              >
                حذف کامل و ریست داده‌ها
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
