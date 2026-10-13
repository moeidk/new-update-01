import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  Scan, 
  Fingerprint, 
  Eye, 
  EyeOff, 
  Sparkles, 
  AlertCircle,
  Smartphone,
  User,
  UserPlus,
  LogIn,
  Users,
  ChevronRight,
  Shield,
  Cloud,
  RefreshCw
} from 'lucide-react';
import { SecuritySettings, UserProfile } from '../types';
import { CryptoService, KDF_ITERATIONS } from '../services/crypto';
import { BiometricService } from '../services/webauthn';
import { BiometricKeyStore } from '../services/biometricKeyStore';
import { StorageService } from '../services/storage';
import { IOSAutoFillService } from '../services/iosAutofill';
import { IOSAutoFillModal } from './IOSAutoFillModal';

interface LockScreenProps {
  onUnlocked: (user: UserProfile, key: CryptoKey) => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlocked }) => {
  const [users, setUsers] = useState<UserProfile[]>(() => StorageService.getUsers());
  const activeUsername = StorageService.getActiveUsername();

  // Mode: 'login' | 'register' | 'restore'
  const [mode, setMode] = useState<'login' | 'register' | 'restore'>(() => (users.length === 0 ? 'register' : 'login'));

  // Selected or typed username
  const [username, setUsername] = useState<string>(() => {
    if (activeUsername) return activeUsername;
    if (users.length > 0) return users[0].username;
    return '';
  });

  // Display name for registration
  const [displayName, setDisplayName] = useState('');

  // Password & confirm
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & loading
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Biometrics
  const [enableBioOnRegister, setEnableBioOnRegister] = useState(true);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [isBioScanning, setIsBioScanning] = useState(false);
  const [deviceBioInfo, setDeviceBioInfo] = useState<{
    type: 'face-id' | 'touch-id' | 'fingerprint' | 'generic' | 'none';
    labelFa: string;
    subLabelFa: string;
  }>({
    type: 'generic',
    labelFa: 'فیس‌آیدی / اثر انگشت',
    subLabelFa: 'سنسورهای بیومتریک دستگاه',
  });

  // iOS AutoFill Guide Modal
  const [isAutoFillModalOpen, setIsAutoFillModalOpen] = useState(false);
  const isIOS = IOSAutoFillService.isIOSDevice();

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  // Initial check for biometrics & persistent storage & users
  useEffect(() => {
    const freshUsers = StorageService.getUsers();
    setUsers(freshUsers);

    // محافظت از کش و فعال‌سازی Persistent Storage مرورگر
    StorageService.initPersistentStorage();

    const info = BiometricService.getDeviceBiometricLabel();
    setDeviceBioInfo(info);

    BiometricService.isAvailable().then((avail) => {
      setBioAvailable(avail);
    });
  }, []);

  // Update selected user settings when username changes
  const selectedUser = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());

  // Auto focus password or prompt biometric ONLY on initial mount or when mode toggles
  useEffect(() => {
    // Do not steal focus if user is already actively typing in an input
    const activeEl = document.activeElement;
    if (activeEl === usernameInputRef.current || activeEl === passwordInputRef.current) {
      return;
    }

    if (mode === 'login') {
      const currentSelected = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
      if (currentSelected?.settings.biometricEnabled && currentSelected.settings.autoBiometricPrompt) {
        const timer = setTimeout(() => {
          handleBiometricUnlock(currentSelected);
        }, 350);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          if (username.trim()) {
            passwordInputRef.current?.focus();
          } else {
            usernameInputRef.current?.focus();
          }
        }, 150);
        return () => clearTimeout(timer);
      }
    } else {
      const timer = setTimeout(() => {
        usernameInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Handle User Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 3) {
      setErrorMsg('نام کاربری باید حداقل ۳ کاراکتر انگلیسی یا عدد باشد.');
      return;
    }

    if (!password || password.length < 8) {
      setErrorMsg('رمز عبور اصلی باید حداقل ۸ کاراکتر باشد.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('تکرار رمز عبور با رمز عبور اصلی مطابقت ندارد.');
      return;
    }

    // Check duplicate
    if (StorageService.getUserByUsername(cleanUsername)) {
      setErrorMsg('این نام کاربری قبلاً ثبت شده است. لطفاً نام دیگری انتخاب کنید.');
      return;
    }

    setIsLoading(true);
    try {
      const salt = CryptoService.generateSalt();
      const derivedKey = await CryptoService.deriveKey(password, salt, KDF_ITERATIONS);
      const hash = await CryptoService.computeVerifier(derivedKey);

      let bioRegistered = false;
      let credId: string | undefined = undefined;
      let bioMode: 'prf' | 'device' | undefined = undefined;

      if (enableBioOnRegister && bioAvailable) {
        try {
          const enrolled = await BiometricKeyStore.enroll(cleanUsername, derivedKey);
          credId = enrolled.credentialId;
          bioMode = enrolled.mode;
          bioRegistered = true;
        } catch (bioErr) {
          console.warn('Biometric registration skipped or failed:', bioErr);
        }
      }

      // Register isolated user
      const newUser = await StorageService.registerUser(
        cleanUsername,
        displayName.trim() || cleanUsername,
        hash,
        salt,
        bioRegistered,
        credId,
        KDF_ITERATIONS,
        bioMode
      );

      // Offer saving to iOS Keychain AutoFill
      IOSAutoFillService.saveMasterPasswordToKeychain(password, cleanUsername);

      // Load or create initial isolated items for this user
      await StorageService.loadDecryptedVault(cleanUsername, derivedKey);

      setSuccessMsg(`حساب کاربری ${cleanUsername} با موفقیت ساخته شد.`);
      setUsers(StorageService.getUsers());

      setTimeout(() => {
        onUnlocked(newUser, derivedKey);
      }, 300);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در ثبت‌نام حساب کاربری.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Standard Password Login
  const handleLogin = async (e?: React.FormEvent, customPass?: string) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setErrorMsg('لطفاً نام کاربری را وارد کنید.');
      return;
    }

    const targetPass = customPass !== undefined ? customPass : password;
    if (!targetPass) {
      setErrorMsg('لطفاً رمز عبور را وارد کنید.');
      return;
    }

    const user = StorageService.getUserByUsername(cleanUsername);
    if (!user) {
      // اگر کاربر در حافظه دستگاه نبود، بررسی می‌کنیم آیا نسخه پشتیبان ابری دارد (مثلاً پس از پاک شدن کش یا نصب مجدد)
      setIsLoading(true);
      try {
        const cloudStatus = await StorageService.checkCloudBackupAvailable(cleanUsername);
        if (cloudStatus.hasBackup) {
          const restoreRes = await StorageService.restoreVaultFromCloud(cleanUsername, targetPass);
          if (restoreRes.success && restoreRes.user && restoreRes.key) {
            setSuccessMsg('اطلاعات این حساب با موفقیت از سرور ابری بازیابی و وارد شدید.');
            setTimeout(() => {
              onUnlocked(restoreRes.user!, restoreRes.key!);
            }, 300);
            return;
          } else {
            setErrorMsg(restoreRes.message || 'رمز عبور وارد شده برای این حساب ابری صحیح نیست.');
            setIsLoading(false);
            return;
          }
        }
      } catch {}
      setIsLoading(false);
      setErrorMsg(`حساب کاربری «${cleanUsername}» روی این مرورگر یافت نشد. در صورت تمایل به بازیابی از سرور، از برگه «بازیابی از کلود» استفاده کنید.`);
      return;
    }

    setIsLoading(true);
    try {
      const result = await StorageService.unlockWithPassword(user, targetPass);
      if (!result.ok || !result.key || !result.user) {
        setErrorMsg('رمز عبور وارد شده اشتباه است.');
        setIsLoading(false);
        return;
      }

      // Validated! Offer update to iCloud Keychain
      IOSAutoFillService.saveMasterPasswordToKeychain(targetPass, cleanUsername);
      StorageService.setActiveUsername(cleanUsername);

      // Keep biometric unlock working on this device (stored wrapped, never as a raw key)
      const readyUser = await StorageService.ensureBiometricKey(result.user, result.key);

      onUnlocked(readyUser, result.key);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در ورود به گاوصندوق.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Cloud Vault Recovery (Zero-Knowledge Restore)
  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setErrorMsg('لطفاً نام کاربری را وارد کنید.');
      return;
    }

    if (!password) {
      setErrorMsg('لطفاً رمز عبور اصلی حساب را وارد کنید.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await StorageService.restoreVaultFromCloud(cleanUsername, password);
      if (res.success && res.user && res.key) {
        setSuccessMsg(res.message);
        setUsers(StorageService.getUsers());
        setTimeout(() => {
          onUnlocked(res.user!, res.key!);
        }, 400);
      } else {
        setErrorMsg(res.message || 'خطا در بازیابی نسخه ابری.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در ارتباط با سرور ابری.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Biometric Unlock
  const handleBiometricUnlock = async (targetUser?: UserProfile) => {
    const userToUnlock = targetUser || selectedUser;
    if (!userToUnlock) {
      setErrorMsg('لطفاً ابتدا کاربر مورد نظر را انتخاب کنید.');
      return;
    }

    setIsBioScanning(true);
    setErrorMsg('');

    try {
      // Biometric prompt + unwrap the stored (encrypted) vault key
      const unlockedKey = await BiometricKeyStore.unlock(userToUnlock.username);

      // Make sure the key still matches this account (e.g. after a password change)
      const stored = userToUnlock.settings.masterPasswordHash || '';
      if (stored.startsWith('v2:') && (await CryptoService.computeVerifier(unlockedKey)) !== stored) {
        await BiometricKeyStore.remove(userToUnlock.username);
        throw new Error('کلید بیومتریک قدیمی است. لطفاً یک‌بار با رمز عبور وارد شوید.');
      }

      StorageService.setActiveUsername(userToUnlock.username);
      onUnlocked(userToUnlock, unlockedKey);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'احراز هویت بیومتریک ناموفق بود.';
      console.warn('Biometric unlock failed:', msg);
      setErrorMsg(msg);
    } finally {
      setIsBioScanning(false);
    }
  };

  // Handle iOS AutoFill Click (Credential Management API)
  const handleTriggerIOSAutoFill = async () => {
    setErrorMsg('');
    try {
      const cred = await IOSAutoFillService.requestPasswordFromKeychain();
      if (cred && cred.password) {
        if (cred.username) {
          setUsername(cred.username);
        }
        setPassword(cred.password);
        // Attempt unlock immediately with retrieved credentials
        handleLogin(undefined, cred.password);
      } else {
        // Open visual tutorial modal
        setIsAutoFillModalOpen(true);
      }
    } catch {
      setIsAutoFillModalOpen(true);
    }
  };

  return (
    <div 
      className="min-h-[100dvh] w-full flex items-center justify-center p-4 bg-[#070A12] relative overflow-y-auto"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)',
      }}
    >
      {/* Background ambient futuristic glow */}
      <div className="absolute top-1/4 -right-28 w-96 h-96 bg-[#4F7CFF]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-28 w-96 h-96 bg-[#8A5CFF]/15 rounded-full blur-3xl pointer-events-none" />

      <div 
        className="w-full max-w-md bg-[#121A2C] border border-[#1F2B47] rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 text-right backdrop-blur-xl transition"
        style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
      >
        {/* Brand & Security Badge */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#4F7CFF] via-[#8A5CFF] to-[#38E1FF] p-[2px] shadow-xl shadow-[#4F7CFF]/25 flex items-center justify-center mb-3">
            <div className="w-full h-full bg-[#121A2C] rounded-[14px] flex items-center justify-center" style={{ backgroundColor: 'var(--ui-surface)' }}>
              <ShieldCheck className="w-8 h-8 text-[#38E1FF]" />
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            KeepPass Vault
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              چندکاربره
            </span>
          </h1>

          <p className="text-xs text-[#94A2C2] mt-1 max-w-xs" style={{ color: 'var(--ui-text-secondary)' }}>
            گاوصندوق رمزها و مدیریت اقساط با پنل کاملاً اختصاصی برای هر کاربر
          </p>
        </div>

        {/* Mode Switcher Tabs: Login vs Register vs Cloud Restore */}
        <div className="mt-6 p-1 rounded-2xl bg-[#0F1524] border border-[#1F2B47] grid grid-cols-3 gap-1" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg('');
            }}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
              mode === 'login'
                ? 'bg-gradient-to-r from-[#4F7CFF] to-[#8A5CFF] text-white shadow-md'
                : 'text-[#94A2C2] hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5 shrink-0" />
            <span>ورود</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg('');
            }}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
              mode === 'register'
                ? 'bg-gradient-to-r from-[#4F7CFF] to-[#8A5CFF] text-white shadow-md'
                : 'text-[#94A2C2] hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 shrink-0" />
            <span>ثبت‌نام</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('restore');
              setErrorMsg('');
            }}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
              mode === 'restore'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-[#94A2C2] hover:text-emerald-400'
            }`}
            title="بازیابی حساب پس از حذف برنامه یا پاک شدن کش گوشی"
          >
            <Cloud className="w-3.5 h-3.5 shrink-0" />
            <span>بازیابی</span>
          </button>
        </div>

        {/* Quick User Selection Chips (when existing users exist in login mode) */}
        {mode === 'login' && users.length > 0 && (
          <div className="mt-4 pt-1">
            <div className="flex items-center justify-between text-[11px] text-[#94A2C2] mb-1.5" style={{ color: 'var(--ui-text-secondary)' }}>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3 text-[#4F7CFF]" />
                انتخاب حساب کاربری:
              </span>
              <span>{users.length} حساب موجود</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {users.map((u) => {
                const isSelected = u.username.toLowerCase() === username.trim().toLowerCase();
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setUsername(u.username);
                      setPassword('');
                      setErrorMsg('');
                      if (u.settings.biometricEnabled && u.settings.autoBiometricPrompt) {
                        handleBiometricUnlock(u);
                      } else {
                        setTimeout(() => passwordInputRef.current?.focus(), 100);
                      }
                    }}
                    className={`py-1.5 px-3 rounded-xl text-xs font-medium transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#4F7CFF]/20 text-[#38E1FF] border border-[#4F7CFF]'
                        : 'bg-[#0F1524] text-[#94A2C2] hover:text-white border border-[#1F2B47]'
                    }`}
                    style={{
                      backgroundColor: isSelected ? undefined : 'var(--ui-surface-subtle)',
                      borderColor: isSelected ? undefined : 'var(--ui-border)',
                    }}
                  >
                    <div className="w-4 h-4 rounded-full bg-[#4F7CFF]/30 flex items-center justify-center text-[10px] font-bold">
                      {u.displayName ? u.displayName.charAt(0) : u.username.charAt(0)}
                    </div>
                    <span>{u.displayName || u.username}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* iOS AutoFill (Fill Password) Quick Shortcut Button */}
        <div className="mt-4">
          <button
            type="button"
            onClick={handleTriggerIOSAutoFill}
            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-500/10 via-[#38E1FF]/10 to-blue-500/10 hover:from-blue-500/20 hover:to-blue-500/20 border border-[#38E1FF]/30 text-[#38E1FF] text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <Smartphone className="w-4 h-4 text-[#38E1FF]" />
            <span>ورود سریع با Fill Password آیفون / جاکلیدی</span>
          </button>
        </div>

        {/* FORM: Login Mode */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="mt-4 space-y-3.5" autoComplete="on">
            {/* Username Input */}
            <div>
              <label 
                htmlFor="login-username"
                className="block text-xs font-semibold text-[#94A2C2] mb-1" 
                style={{ color: 'var(--ui-text-secondary)' }}
              >
                نام کاربری
              </label>
              <div className="relative">
                <input
                  ref={usernameInputRef}
                  type="text"
                  name="username"
                  id="login-username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      passwordInputRef.current?.focus();
                    }
                  }}
                  placeholder="نام کاربری اختصاصی شما (مثال: ali)"
                  autoComplete="username"
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-3 text-sm text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF] focus:ring-1 focus:ring-[#4F7CFF] transition font-sans text-left"
                  dir="ltr"
                  style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                />
                <User className="w-4 h-4 text-[#5D6B8F] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Password Input (Clean native input - No virtual keypad) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label 
                  htmlFor="login-password"
                  className="text-xs font-semibold text-[#94A2C2]" 
                  style={{ color: 'var(--ui-text-secondary)' }}
                >
                  رمز عبور گاوصندوق
                </label>
                <span className="text-[11px] text-[#5D6B8F]">رمز اختصاصی کاربر</span>
              </div>
              <div className="relative">
                <input
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  id="login-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="رمز اصلی گاوصندوق..."
                  autoComplete="current-password"
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-3 text-sm text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF] focus:ring-1 focus:ring-[#4F7CFF] transition font-sans"
                  style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A2C2] hover:text-white p-1 cursor-pointer"
                  style={{ color: 'var(--ui-text-secondary)' }}
                  aria-label="نمایش رمز عبور"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading || !password || !username}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#8A5CFF] text-white font-bold text-sm shadow-xl shadow-[#4F7CFF]/25 hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  در حال بررسی رمز و بارگذاری پنل...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  ورود به پنل اختصاصی
                </>
              )}
            </button>

            {/* Biometric Unlock Option (if user enabled biometrics) */}
            {selectedUser?.settings.biometricEnabled && bioAvailable && (
              <button
                type="button"
                onClick={() => handleBiometricUnlock(selectedUser)}
                disabled={isBioScanning}
                className="w-full py-2.5 px-4 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-[#38E1FF] font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer mt-1"
                style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
              >
                {deviceBioInfo.type === 'face-id' ? <Scan className="w-4 h-4" /> : <Fingerprint className="w-4 h-4" />}
                <span>ورود با {deviceBioInfo.labelFa}</span>
              </button>
            )}
            {/* Cloud recovery helper link in login form */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('restore');
                  setErrorMsg('');
                }}
                className="text-[11px] text-[#38E1FF] hover:underline cursor-pointer flex items-center justify-center gap-1 mx-auto"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>کش دستگاه یا برنامه پاک شده است؟ بازیابی از سرور ابری</span>
              </button>
            </div>
          </form>
        )}

        {/* FORM: Registration Mode */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="mt-4 space-y-3.5" autoComplete="on">
            {/* New Username */}
            <div>
              <label 
                htmlFor="reg-username"
                className="block text-xs font-semibold text-[#94A2C2] mb-1" 
                style={{ color: 'var(--ui-text-secondary)' }}
              >
                نام کاربری جدید (انگلیسی یا اعداد) *
              </label>
              <div className="relative">
                <input
                  ref={usernameInputRef}
                  type="text"
                  name="username"
                  id="reg-username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: ali ، sara ، user1"
                  autoComplete="username"
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-3 text-sm text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF] focus:ring-1 focus:ring-[#4F7CFF] transition font-sans text-left"
                  dir="ltr"
                  style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                />
                <User className="w-4 h-4 text-[#5D6B8F] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Display Name (Optional) */}
            <div>
              <label 
                htmlFor="reg-display"
                className="block text-xs font-semibold text-[#94A2C2] mb-1" 
                style={{ color: 'var(--ui-text-secondary)' }}
              >
                نام نمایشی (اختیاری)
              </label>
              <input
                type="text"
                id="reg-display"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="مثال: علی رضایی"
                className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF] transition"
                style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
              />
            </div>

            {/* Master Password */}
            <div>
              <label 
                htmlFor="reg-password"
                className="block text-xs font-semibold text-[#94A2C2] mb-1" 
                style={{ color: 'var(--ui-text-secondary)' }}
              >
                رمز عبور اصلی گاوصندوق *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  id="reg-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="حداقل ۸ کاراکتر قوی..."
                  autoComplete="new-password"
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-3 text-sm text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF] focus:ring-1 focus:ring-[#4F7CFF] transition font-sans"
                  style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A2C2] hover:text-white p-1 cursor-pointer"
                  style={{ color: 'var(--ui-text-secondary)' }}
                  aria-label="نمایش رمز عبور"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label 
                htmlFor="reg-confirm"
                className="block text-xs font-semibold text-[#94A2C2] mb-1" 
                style={{ color: 'var(--ui-text-secondary)' }}
              >
                تکرار رمز عبور اصلی *
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                name="confirm-password"
                id="reg-confirm"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="تکرار رمز عبور..."
                autoComplete="new-password"
                className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-3 text-sm text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF] focus:ring-1 focus:ring-[#4F7CFF] transition font-sans"
                style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
              />
            </div>

            {/* Enable Biometrics Checkbox if hardware available */}
            {bioAvailable && (
              <label className="flex items-center gap-2 pt-1 text-xs text-[#94A2C2] cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableBioOnRegister}
                  onChange={(e) => setEnableBioOnRegister(e.target.checked)}
                  className="rounded border-[#1F2B47] text-[#4F7CFF] focus:ring-0"
                />
                <span>فعال‌سازی ورود با {deviceBioInfo.labelFa} برای این کاربر</span>
              </label>
            )}

            {/* Register Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !username || !password || !confirmPassword}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#8A5CFF] text-white font-bold text-sm shadow-xl shadow-[#4F7CFF]/25 hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  در حال ایجاد گاوصندوق مجزا...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  ایجاد حساب و ورود به پنل اختصاصی
                </>
              )}
            </button>
          </form>
        )}

        {/* FORM: Cloud Restore Mode (حل مشکل پاک شدن کش گوشی و حذف اپلیکیشن) */}
        {mode === 'restore' && (
          <form onSubmit={handleRestore} className="mt-4 space-y-3.5" autoComplete="on">
            <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-slate-300 space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Cloud className="w-4 h-4 shrink-0" />
                <span>بازیابی اطلاعات پس از پاک شدن کش یا حذف اپ</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                اطلاعات به صورت سرتاسری (Zero-Knowledge) رمزنگاری شده‌اند. با ورود نام کاربری و رمز، همه رمزها، وام‌ها و اطلاعات روی دستگاه شما بازگردانی می‌شوند.
              </p>
            </div>

            {/* Username */}
            <div>
              <label 
                htmlFor="restore-username"
                className="block text-xs font-semibold text-[#94A2C2] mb-1" 
                style={{ color: 'var(--ui-text-secondary)' }}
              >
                نام کاربری حساب قبلی *
              </label>
              <div className="relative">
                <input
                  ref={usernameInputRef}
                  type="text"
                  name="username"
                  id="restore-username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: ali"
                  autoComplete="username"
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-3 text-sm text-white placeholder-[#5D6B8F] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-sans text-left"
                  dir="ltr"
                  style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                />
                <User className="w-4 h-4 text-[#5D6B8F] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Master Password */}
            <div>
              <label 
                htmlFor="restore-password"
                className="block text-xs font-semibold text-[#94A2C2] mb-1" 
                style={{ color: 'var(--ui-text-secondary)' }}
              >
                رمز عبور اصلی حساب (جهت رمزگشایی در گوشی) *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  id="restore-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="رمز اصلی قبلی شما..."
                  autoComplete="current-password"
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-3 text-sm text-white placeholder-[#5D6B8F] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-sans"
                  style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A2C2] hover:text-white p-1 cursor-pointer"
                  style={{ color: 'var(--ui-text-secondary)' }}
                  aria-label="نمایش رمز عبور"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Restore Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-xl shadow-emerald-500/20 hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  در حال واکشی و رمزگشایی اطلاعات...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  بازیابی و ورود به حساب
                </>
              )}
            </button>
          </form>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success message */}
        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Security Notes Footer */}
        <div 
          className="mt-6 pt-4 border-t border-[#1F2B47] flex items-center justify-around text-center text-[11px] text-[#94A2C2]" 
          style={{ borderColor: 'var(--ui-border)', color: 'var(--ui-text-secondary)' }}
        >
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            جداسازی ۱۰۰٪ اطلاعات
          </span>
          <span className="text-[#1F2B47]">•</span>
          <span className="flex items-center gap-1">
            <KeyRound className="w-3.5 h-3.5 text-[#4F7CFF]" />
            رمزنگاری AES-256
          </span>
          <span className="text-[#1F2B47]">•</span>
          <span className="flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5 text-[#38E1FF]" />
            سازگار با آیفون
          </span>
        </div>
      </div>

      {/* iOS AutoFill Visual Guide Modal */}
      <IOSAutoFillModal
        isOpen={isAutoFillModalOpen}
        onClose={() => setIsAutoFillModalOpen(false)}
        masterPassword={password}
      />
    </div>
  );
};
