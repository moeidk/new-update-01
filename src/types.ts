export type ItemCategory = 
  | 'login' 
  | 'bank' 
  | 'social' 
  | 'email' 
  | 'note' 
  | 'wifi';

export interface VaultItem {
  id: string;
  title: string;
  category: ItemCategory;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  // Banking specific fields
  cardNumber?: string;
  cardHolder?: string;
  cvv2?: string;
  expireDate?: string;
  pin?: string;
  // Meta
  isFavorite: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export type BiometricType = 'face-id' | 'touch-id' | 'fingerprint' | 'generic' | 'none';

export interface SecuritySettings {
  isSetup: boolean;
  masterPasswordHash: string; // 'v2:' HMAC verifier derived from the master key (legacy: salted SHA-256)
  salt: string; // Base64 salt for PBKDF2
  kdfIterations?: number; // PBKDF2 iterations (missing = legacy 100,000)
  biometricEnabled: boolean;
  biometricCredentialId?: string;
  biometricType: BiometricType;
  autoBiometricPrompt: boolean; // Auto prompt Face ID / Touch ID on app launch
  autoLockMinutes: number; // 0 = immediate on background, 1, 5, 15, -1 = never
  autoCloudSync?: boolean; // automatic encrypted cloud backup (missing = on)
  /** How the biometric unlock key is protected on this device ('prf' = bound to Face ID/fingerprint via WebAuthn PRF). */
  biometricKeyMode?: 'prf' | 'device';
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
  settings: SecuritySettings;
}

export type AppTab = 'vault' | 'ghest';

export type SidebarNavView = 
  | 'dashboard'
  | 'loans'
  | 'hosting'
  | 'calendar'
  | 'analytics'
  | 'calculator'
  | 'alerts'
  | 'vault'
  | 'settings';

export interface TelegramSettings {
  enabled: boolean;
  botToken: string;
  chatId: string;
  alertDaysBefore: number;
  notifyHour: number;
  sendLoansAlerts: boolean;
  sendHostAlerts: boolean;
  lastNotifiedDate?: string;
  autoCheckEnabled: boolean;
}

export type HostingType = 'domain' | 'host' | 'vps' | 'ssl' | 'other';

export interface HostingDomainItem {
  id: string;
  name: string; // e.g. "siteirdood.ir", "سرور اختصاصی آلمان"
  type: HostingType;
  provider: string; // e.g. ایرنیک، ایران‌سرور، هیتزنر، کلودفلر
  renewalDate: string; // Jalali: e.g. "1404/05/15"
  cost: number; // هزینه تمدید به تومان
  period: 'monthly' | 'yearly' | 'multi-year';
  autoRenew: boolean;
  dnsOrIp?: string;
  loginUrl?: string;
  notes?: string;
  status: 'active' | 'expiring' | 'expired';
  createdAt: string;
  updatedAt: string;
}

export interface BackupData {
  version: number;
  timestamp: string;
  items: VaultItem[];
  loans?: LoanItem[];
  hostingItems?: HostingDomainItem[];
  telegramSettings?: TelegramSettings;
}

export interface LoanInstallment {
  number: number;
  dueDate: string; // Jalali: e.g. "1403/08/10"
  amount: number;
  isPaid: boolean;
  paidAt?: string;
  trackingCode?: string;
  notes?: string;
  principalPart?: number;
  interestPart?: number;
  remainingBalance?: number;
}

export interface LoanItem {
  id: string;
  title: string;
  lender: string; // e.g. بانک ملی، اسنپ‌پی، وام ازدواج، ضامن شخصی
  totalAmount: number; // اصل مبلغ وام (تومان)
  installmentAmount: number; // مبلغ هر قسط (تومان)
  totalInstallments: number; // تعداد کل اقساط (ماه)
  paidInstallments: number; // تعداد اقساط پرداخت شده
  interestRate?: number; // درصد سود سالانه (مثلاً ۲۳٪، ۱۸٪ یا ۰٪ قرض‌الحسنه)
  startDate: string; // تاریخ شروع یا اولین سررسید شمسی (مثلاً "۱۴۰۳/۰۷/۱۰")
  dueDay: number; // روز سررسید هر ماه (۱ تا ۳۱)
  status: 'active' | 'completed' | 'paused';
  notes?: string;
  installments?: LoanInstallment[];
  totalInterest?: number; // کل سود محاسبه شده
  totalRepayment?: number; // کل مبلغ بازپرداخت (اصل + سود)
  createdAt: string;
  updatedAt: string;
}
