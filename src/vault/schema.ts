/**
 * src/vault/schema.ts
 * Single shared definition of the vault item form: categories, fields, conditional visibility,
 * validation and the mapping between stored records and form values.
 *
 * Used by BOTH the add and edit paths (ItemModal) and by the vault cards (VaultItemList).
 * Pure module: no React, no I/O — everything here is unit-testable.
 *
 * Compatibility rules (records created before this form):
 *  - Category ids never change; only display names do.
 *  - Top-level fields (username/password/url/notes/card*) keep their meaning for the record's
 *    category. New category-specific values live in `extra`.
 *  - Values a category no longer shows (e.g. username/password on a bank card, the old combined
 *    "رمز دوم / پین") are left where they are and shown under «اطلاعات قبلی».
 *  - When the user changes the category, top-level values whose meaning depends on the category
 *    are moved into `legacy` instead of being silently reinterpreted or dropped.
 */
import type { ItemCategory, VaultCustomField, VaultItem, VaultLegacyEntry, CustomFieldType } from '../types';

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export interface CategoryDef {
  id: ItemCategory;
  label: string; // chip + card label
  addTitle: string;
  editTitle: string;
  titleLabel: string;
  titlePlaceholder: string;
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'login', label: 'حساب و ورود', addTitle: 'افزودن حساب و ورود', editTitle: 'ویرایش حساب و ورود', titleLabel: 'عنوان حساب', titlePlaceholder: 'مثال: پنل فروشگاه، حساب دیجی‌کالا' },
  { id: 'social', label: 'شبکه‌های اجتماعی', addTitle: 'افزودن حساب شبکه اجتماعی', editTitle: 'ویرایش حساب شبکه اجتماعی', titleLabel: 'عنوان حساب', titlePlaceholder: 'مثال: اینستاگرام شخصی' },
  { id: 'bank', label: 'کارت بانکی', addTitle: 'افزودن کارت بانکی', editTitle: 'ویرایش کارت بانکی', titleLabel: 'عنوان کارت', titlePlaceholder: 'مثال: کارت حقوق ملت' },
  { id: 'email', label: 'ایمیل', addTitle: 'افزودن حساب ایمیل', editTitle: 'ویرایش حساب ایمیل', titleLabel: 'عنوان', titlePlaceholder: 'مثال: ایمیل کاری' },
  { id: 'note', label: 'یادداشت امن', addTitle: 'افزودن یادداشت امن', editTitle: 'ویرایش یادداشت امن', titleLabel: 'عنوان یادداشت', titlePlaceholder: 'مثال: اطلاعات بیمه' },
  { id: 'wifi', label: 'وای‌فای', addTitle: 'افزودن شبکه وای‌فای', editTitle: 'ویرایش شبکه وای‌فای', titleLabel: 'عنوان', titlePlaceholder: 'مثال: وای‌فای خانه' },
  { id: 'address', label: 'آدرس', addTitle: 'افزودن آدرس', editTitle: 'ویرایش آدرس', titleLabel: 'عنوان آدرس', titlePlaceholder: 'مثال: خانه، محل کار' },
];

export const categoryDef = (id: ItemCategory | string | undefined): CategoryDef =>
  CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];

// ---------------------------------------------------------------------------
// Field definitions
// ---------------------------------------------------------------------------
export type FieldKind =
  | 'text'
  | 'exact' // case/space-sensitive raw text (SSID)
  | 'secret'
  | 'secretMultiline'
  | 'multiline'
  | 'url'
  | 'urlList'
  | 'email'
  | 'phone'
  | 'select'
  | 'toggle'
  | 'cardNumber'
  | 'expiry'
  | 'digits'
  | 'account'; // link to another vault item

export type Section = 'main' | 'more' | 'bankAccount' | 'mailServers';

export type Values = Record<string, string>;

export interface Option {
  value: string;
  label: string;
}

/** Where a field is stored on the record. */
export type Storage =
  | { kind: 'top'; key: TopKey }
  | { kind: 'extra'; key: string };

export const TOP_KEYS = ['username', 'password', 'url', 'notes', 'cardNumber', 'cardHolder', 'cvv2', 'expireDate', 'pin'] as const;
export type TopKey = (typeof TOP_KEYS)[number];

export interface FieldDef {
  id: string;
  kind: FieldKind;
  storage: Storage;
  label: string;
  hint?: string;
  placeholder?: string;
  options?: Option[];
  section: Section;
  /** Defaults to true. */
  visible?: (v: Values) => boolean;
  required?: (v: Values) => boolean;
  /** Persian/Arabic digits → Latin (only for numeric data). */
  normalizeDigits?: boolean;
  /** Field-specific validation beyond kind/required. */
  validate?: (value: string, v: Values) => { error?: string; warning?: string } | undefined;
  /** Default for NEW items. */
  defaultValue?: string;
}

const top = (key: TopKey): Storage => ({ kind: 'top', key });
const extra = (key: string): Storage => ({ kind: 'extra', key });

// ----- shared option lists -----
export const LOGIN_METHODS: Option[] = [
  { value: 'password', label: 'رمز عبور' },
  { value: 'sso', label: 'ورود با سرویس دیگر' },
  { value: 'otp', label: 'کد یک‌بارمصرف' },
];

export const SSO_PROVIDERS: Option[] = [
  { value: 'Google', label: 'Google' },
  { value: 'Apple', label: 'Apple' },
  { value: 'Microsoft', label: 'Microsoft' },
  { value: 'GitHub', label: 'GitHub' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'other', label: 'سایر' },
];

export const TWO_FACTOR: Option[] = [
  { value: '', label: 'مشخص نشده' },
  { value: 'off', label: 'غیرفعال' },
  { value: 'app', label: 'فعال — اپلیکیشن احراز هویت' },
  { value: 'sms', label: 'فعال — پیامک' },
  { value: 'email', label: 'فعال — ایمیل' },
  { value: 'key', label: 'فعال — کلید امنیتی' },
  { value: 'other', label: 'فعال — روش دیگر' },
];

export const SOCIAL_PLATFORMS: (Option & { profile?: (h: string) => string; login?: string })[] = [
  { value: 'instagram', label: 'Instagram', profile: (h) => `https://instagram.com/${h}`, login: 'https://www.instagram.com/accounts/login/' },
  { value: 'telegram', label: 'Telegram', profile: (h) => `https://t.me/${h}`, login: 'https://web.telegram.org/' },
  { value: 'x', label: 'X (Twitter)', profile: (h) => `https://x.com/${h}`, login: 'https://x.com/login' },
  { value: 'linkedin', label: 'LinkedIn', profile: (h) => `https://www.linkedin.com/in/${h}`, login: 'https://www.linkedin.com/login' },
  { value: 'facebook', label: 'Facebook', profile: (h) => `https://www.facebook.com/${h}`, login: 'https://www.facebook.com/login' },
  { value: 'youtube', label: 'YouTube', profile: (h) => `https://www.youtube.com/@${h}`, login: 'https://accounts.google.com/' },
  { value: 'tiktok', label: 'TikTok', profile: (h) => `https://www.tiktok.com/@${h}`, login: 'https://www.tiktok.com/login' },
  { value: 'github', label: 'GitHub', profile: (h) => `https://github.com/${h}`, login: 'https://github.com/login' },
  { value: 'threads', label: 'Threads', profile: (h) => `https://www.threads.net/@${h}`, login: 'https://www.threads.net/login' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'other', label: 'سایر' },
];

export const EMAIL_PROVIDERS: (Option & { webmail?: string })[] = [
  { value: 'gmail', label: 'Gmail', webmail: 'https://mail.google.com/' },
  { value: 'outlook', label: 'Outlook / Hotmail', webmail: 'https://outlook.live.com/mail/' },
  { value: 'yahoo', label: 'Yahoo', webmail: 'https://mail.yahoo.com/' },
  { value: 'icloud', label: 'iCloud', webmail: 'https://www.icloud.com/mail' },
  { value: 'proton', label: 'Proton Mail', webmail: 'https://mail.proton.me/' },
  { value: 'zoho', label: 'Zoho Mail', webmail: 'https://mail.zoho.com/' },
  { value: 'yandex', label: 'Yandex', webmail: 'https://mail.yandex.com/' },
  { value: 'other', label: 'سایر' },
];

const MAIL_SECURITY: Option[] = [
  { value: '', label: 'انتخاب نشده' },
  { value: 'ssl', label: 'SSL/TLS' },
  { value: 'starttls', label: 'STARTTLS' },
  { value: 'none', label: 'بدون رمزنگاری' },
];

export const WIFI_SECURITY: Option[] = [
  { value: 'personal', label: 'شبکه شخصی (WPA/WPA2/WPA3)' },
  { value: 'enterprise', label: 'شبکه سازمانی (802.1X)' },
  { value: 'open', label: 'بدون رمز' },
];

const WIFI_PERSONAL_TYPES: Option[] = [
  { value: 'wpa', label: 'WPA2 / WPA3 (پیشنهادی)' },
  { value: 'wep', label: 'WEP (قدیمی)' },
];

export const EAP_METHODS: Option[] = [
  { value: 'PEAP', label: 'PEAP' },
  { value: 'TTLS', label: 'TTLS' },
  { value: 'TLS', label: 'TLS (با گواهی)' },
  { value: 'PWD', label: 'PWD' },
  { value: 'other', label: 'سایر' },
];

const PHASE2: Option[] = [
  { value: '', label: 'انتخاب نشده' },
  { value: 'MSCHAPV2', label: 'MSCHAPv2' },
  { value: 'GTC', label: 'GTC' },
  { value: 'PAP', label: 'PAP' },
  { value: 'other', label: 'سایر' },
];

const CARD_FORMATS: Option[] = [
  { value: 'ir', label: 'کارت ایرانی (شتاب، ۱۶ رقم)' },
  { value: 'intl', label: 'کارت بین‌المللی' },
];

const CARD_TYPES: Option[] = [
  { value: '', label: 'مشخص نشده' },
  { value: 'debit', label: 'نقدی (دبیت)' },
  { value: 'credit', label: 'اعتباری' },
  { value: 'prepaid', label: 'پیش‌پرداخت / هدیه' },
  { value: 'other', label: 'سایر' },
];

export const EXPIRY_CALENDARS: Option[] = [
  { value: 'jalali', label: 'شمسی' },
  { value: 'gregorian', label: 'میلادی' },
];

export const IR_BANKS = [
  'ملی', 'ملت', 'صادرات', 'تجارت', 'سپه', 'مسکن', 'کشاورزی', 'رفاه', 'پاسارگاد', 'سامان', 'پارسیان',
  'اقتصاد نوین', 'آینده', 'شهر', 'دی', 'سینا', 'رسالت', 'خاورمیانه', 'گردشگری', 'کارآفرین', 'توسعه تعاون',
  'پست بانک', 'قرض‌الحسنه مهر ایران', 'بلو', 'ویپاد',
];

// ----- reusable predicates -----
const methodIs = (m: string) => (v: Values) => (v.loginMethod || 'password') === m;
const usesPassword = (v: Values) => (v.loginMethod || 'password') === 'password';
const wifiSec = (v: Values) => v.wifiSecurity || 'personal';
const isIran = (v: Values) => isIranCountry(v.country);
const eapNeedsPassword = (v: Values) => ['PEAP', 'TTLS', 'PWD'].includes(v.eapMethod || 'PEAP');

// ----- field library (one definition per meaning) -----
const F: Record<string, FieldDef> = {
  identifier: { id: 'identifier', kind: 'text', storage: top('username'), section: 'main', label: 'شناسه ورود', hint: 'نام کاربری، ایمیل یا شماره موبایلی که با آن وارد می‌شوید', placeholder: 'مثال: user@example.com' },
  loginMethod: { id: 'loginMethod', kind: 'select', storage: extra('loginMethod'), section: 'main', label: 'روش ورود', options: LOGIN_METHODS, defaultValue: 'password' },
  ssoProvider: { id: 'ssoProvider', kind: 'select', storage: extra('ssoProvider'), section: 'main', label: 'سرویس ورود', options: SSO_PROVIDERS, visible: methodIs('sso'), required: methodIs('sso'), defaultValue: 'Google' },
  ssoProviderOther: { id: 'ssoProviderOther', kind: 'text', storage: extra('ssoProviderOther'), section: 'main', label: 'نام سرویس', placeholder: 'مثال: Yahoo', visible: (v) => methodIs('sso')(v) && v.ssoProvider === 'other', required: (v) => methodIs('sso')(v) && v.ssoProvider === 'other' },
  ssoAccountId: { id: 'ssoAccountId', kind: 'account', storage: extra('ssoAccountId'), section: 'main', label: 'حساب مرتبط در گاوصندوق (اختیاری)', hint: 'حسابی که با آن وارد می‌شوید، مثلاً حساب Google شما', visible: methodIs('sso') },
  password: { id: 'password', kind: 'secret', storage: top('password'), section: 'main', label: 'رمز عبور', visible: usesPassword, required: usesPassword },
  loginUrls: { id: 'loginUrls', kind: 'urlList', storage: top('url'), section: 'main', label: 'آدرس صفحه ورود', placeholder: 'https://example.com/login' },
  recoveryEmail: { id: 'recoveryEmail', kind: 'email', storage: extra('recoveryEmail'), section: 'more', label: 'ایمیل بازیابی', placeholder: 'recovery@example.com' },
  recoveryPhone: { id: 'recoveryPhone', kind: 'phone', storage: extra('recoveryPhone'), section: 'more', label: 'موبایل بازیابی', placeholder: '+98 912 000 0000', normalizeDigits: true },
  twoFactor: { id: 'twoFactor', kind: 'select', storage: extra('twoFactor'), section: 'more', label: 'وضعیت احراز هویت دومرحله‌ای', hint: 'فقط برای یادآوری؛ این برنامه کد دومرحله‌ای تولید نمی‌کند.', options: TWO_FACTOR },
  recoveryCodes: { id: 'recoveryCodes', kind: 'secretMultiline', storage: extra('recoveryCodes'), section: 'more', label: 'کدهای بازیابی', hint: 'هر کد در یک خط' },
  notes: { id: 'notes', kind: 'multiline', storage: top('notes'), section: 'more', label: 'یادداشت تکمیلی (اختیاری)', placeholder: 'توضیحات اضافه درباره این مورد' },

  // social
  platform: { id: 'platform', kind: 'select', storage: extra('platform'), section: 'main', label: 'پلتفرم', options: SOCIAL_PLATFORMS, required: () => true, defaultValue: 'instagram' },
  platformOther: { id: 'platformOther', kind: 'text', storage: extra('platformOther'), section: 'main', label: 'نام پلتفرم', placeholder: 'مثال: Bale', visible: (v) => v.platform === 'other', required: (v) => v.platform === 'other' },
  handle: { id: 'handle', kind: 'text', storage: extra('handle'), section: 'main', label: 'نام کاربری یا شناسه عمومی', hint: 'همان نامی که دیگران در پروفایل شما می‌بینند', placeholder: 'مثال: my.page' },
  profileUrl: { id: 'profileUrl', kind: 'url', storage: extra('profileUrl'), section: 'main', label: 'لینک پروفایل', placeholder: 'https://instagram.com/my.page' },

  // bank
  cardHolder: { id: 'cardHolder', kind: 'text', storage: top('cardHolder'), section: 'main', label: 'نام دارنده کارت', placeholder: 'مثال: علی رضایی' },
  issuer: { id: 'issuer', kind: 'text', storage: extra('issuer'), section: 'main', label: 'بانک یا صادرکننده', placeholder: 'مثال: ملت' },
  cardFormat: { id: 'cardFormat', kind: 'select', storage: extra('cardFormat'), section: 'main', label: 'قالب کارت', options: CARD_FORMATS, defaultValue: 'ir' },
  cardNumber: {
    id: 'cardNumber', kind: 'cardNumber', storage: top('cardNumber'), section: 'main', label: 'شماره کارت', placeholder: '6037 0000 0000 0000', normalizeDigits: true,
    required: () => true,
    validate: (value, v) => validateCardNumber(value, v.cardFormat),
  },
  expiryCalendar: { id: 'expiryCalendar', kind: 'select', storage: extra('expiryCalendar'), section: 'main', label: 'نوع تقویم تاریخ انقضا', options: EXPIRY_CALENDARS, defaultValue: 'jalali', required: (v) => !!v.expireDate?.trim() },
  expireDate: {
    id: 'expireDate', kind: 'expiry', storage: top('expireDate'), section: 'main', label: 'تاریخ انقضا (اختیاری)', normalizeDigits: true,
    validate: (value, v) => validateExpiry(value, v.expiryCalendar),
  },
  cardType: { id: 'cardType', kind: 'select', storage: extra('cardType'), section: 'more', label: 'نوع کارت', options: CARD_TYPES },
  cvv2: { id: 'cvv2', kind: 'secret', storage: top('cvv2'), section: 'more', label: 'CVV2 (اختیاری)', normalizeDigits: true, validate: (value) => (/^\d{3,4}$/.test(value) ? undefined : { error: 'CVV2 باید ۳ یا ۴ رقم باشد.' }) },
  cardPin: { id: 'cardPin', kind: 'secret', storage: extra('cardPin'), section: 'more', label: 'PIN کارت / رمز اول (اختیاری)', normalizeDigits: true, validate: (value) => (/^\d{4,12}$/.test(value) ? undefined : { error: 'PIN باید فقط شامل ۴ تا ۱۲ رقم باشد.' }) },
  bankLoginAccountId: { id: 'bankLoginAccountId', kind: 'account', storage: extra('bankLoginAccountId'), section: 'more', label: 'حساب ورود مرتبط (اینترنت‌بانک یا اپ بانکی)', hint: 'به یک مورد «حساب و ورود» در گاوصندوق متصل می‌شود.' },
  accountNumber: { id: 'accountNumber', kind: 'digits', storage: extra('accountNumber'), section: 'bankAccount', label: 'شماره حساب', normalizeDigits: true, placeholder: 'مثال: 0123456789',
    validate: (value) => (/^[0-9.\-\s]{5,30}$/.test(value) ? undefined : { error: 'شماره حساب فقط شامل رقم (و در صورت نیاز خط تیره یا نقطه) است.' }) },
  sheba: { id: 'sheba', kind: 'text', storage: extra('sheba'), section: 'bankAccount', label: 'شماره شبا', normalizeDigits: true, placeholder: 'IR000000000000000000000000', validate: (value) => validateSheba(value) },

  // email
  emailAddress: { id: 'emailAddress', kind: 'email', storage: top('username'), section: 'main', label: 'آدرس ایمیل', placeholder: 'name@example.com', required: (v) => !v.emailLoginUsername?.trim() },
  emailProvider: { id: 'emailProvider', kind: 'select', storage: extra('emailProvider'), section: 'main', label: 'سرویس‌دهنده', options: [{ value: '', label: 'انتخاب نشده' }, ...EMAIL_PROVIDERS] },
  emailProviderOther: { id: 'emailProviderOther', kind: 'text', storage: extra('emailProviderOther'), section: 'main', label: 'نام سرویس‌دهنده', visible: (v) => v.emailProvider === 'other' },
  webmailUrl: { id: 'webmailUrl', kind: 'url', storage: top('url'), section: 'main', label: 'آدرس وب‌میل (اختیاری)', placeholder: 'https://mail.example.com' },
  emailLoginUsername: { id: 'emailLoginUsername', kind: 'text', storage: extra('emailLoginUsername'), section: 'more', label: 'نام کاربری ورود', hint: 'فقط اگر با آدرس ایمیل متفاوت است' },
  appPassword: { id: 'appPassword', kind: 'secret', storage: extra('appPassword'), section: 'more', label: 'رمز مخصوص برنامه (App Password)', hint: 'مستقل از رمز اصلی حساب' },
  imapHost: { id: 'imapHost', kind: 'text', storage: extra('imapHost'), section: 'mailServers', label: 'سرور IMAP', placeholder: 'imap.example.com' },
  imapPort: { id: 'imapPort', kind: 'digits', storage: extra('imapPort'), section: 'mailServers', label: 'پورت IMAP', placeholder: '993', normalizeDigits: true, validate: (v) => validatePort(v) },
  imapSecurity: { id: 'imapSecurity', kind: 'select', storage: extra('imapSecurity'), section: 'mailServers', label: 'نوع اتصال IMAP', options: MAIL_SECURITY },
  smtpHost: { id: 'smtpHost', kind: 'text', storage: extra('smtpHost'), section: 'mailServers', label: 'سرور SMTP', placeholder: 'smtp.example.com' },
  smtpPort: { id: 'smtpPort', kind: 'digits', storage: extra('smtpPort'), section: 'mailServers', label: 'پورت SMTP', placeholder: '465', normalizeDigits: true, validate: (v) => validatePort(v) },
  smtpSecurity: { id: 'smtpSecurity', kind: 'select', storage: extra('smtpSecurity'), section: 'mailServers', label: 'نوع اتصال SMTP', options: MAIL_SECURITY },
  popHost: { id: 'popHost', kind: 'text', storage: extra('popHost'), section: 'mailServers', label: 'سرور POP', placeholder: 'pop.example.com' },
  popPort: { id: 'popPort', kind: 'digits', storage: extra('popPort'), section: 'mailServers', label: 'پورت POP', placeholder: '995', normalizeDigits: true, validate: (v) => validatePort(v) },
  popSecurity: { id: 'popSecurity', kind: 'select', storage: extra('popSecurity'), section: 'mailServers', label: 'نوع اتصال POP', options: MAIL_SECURITY },

  // note (the free-text field IS the note body — same slot as «یادداشت تکمیلی»)
  noteBody: { id: 'notes', kind: 'multiline', storage: top('notes'), section: 'main', label: 'متن یادداشت', placeholder: 'اطلاعاتی که می‌خواهید محرمانه نگه دارید…', required: () => true },

  // wifi
  ssid: { id: 'ssid', kind: 'exact', storage: top('username'), section: 'main', label: 'نام شبکه (SSID)', hint: 'دقیقاً همان‌طور که در دستگاه نمایش داده می‌شود؛ حروف و فاصله‌ها تغییر داده نمی‌شوند.', required: () => true },
  wifiSecurity: { id: 'wifiSecurity', kind: 'select', storage: extra('wifiSecurity'), section: 'main', label: 'نوع امنیت', options: WIFI_SECURITY, defaultValue: 'personal' },
  wifiPersonalType: { id: 'wifiPersonalType', kind: 'select', storage: extra('wifiPersonalType'), section: 'main', label: 'پروتکل', options: WIFI_PERSONAL_TYPES, defaultValue: 'wpa', visible: (v) => wifiSec(v) === 'personal' },
  eapMethod: { id: 'eapMethod', kind: 'select', storage: extra('eapMethod'), section: 'main', label: 'روش احراز هویت (EAP)', options: EAP_METHODS, defaultValue: 'PEAP', visible: (v) => wifiSec(v) === 'enterprise' },
  phase2: { id: 'phase2', kind: 'select', storage: extra('phase2'), section: 'main', label: 'احراز هویت مرحله دوم', options: PHASE2, visible: (v) => wifiSec(v) === 'enterprise' && ['PEAP', 'TTLS'].includes(v.eapMethod || 'PEAP') },
  wifiIdentity: { id: 'wifiIdentity', kind: 'exact', storage: extra('wifiIdentity'), section: 'main', label: 'نام کاربری (Identity)', visible: (v) => wifiSec(v) === 'enterprise', required: (v) => wifiSec(v) === 'enterprise' },
  wifiPassword: {
    id: 'wifiPassword', kind: 'secret', storage: top('password'), section: 'main',
    label: 'رمز شبکه',
    visible: (v) => wifiSec(v) === 'personal' || (wifiSec(v) === 'enterprise' && eapNeedsPassword(v)),
    required: (v) => wifiSec(v) === 'personal' || (wifiSec(v) === 'enterprise' && eapNeedsPassword(v)),
    validate: (value, v) => {
      if (wifiSec(v) !== 'personal') return undefined;
      if ((v.wifiPersonalType || 'wpa') === 'wpa' && (value.length < 8 || value.length > 63)) {
        return { warning: 'رمز شبکه‌های WPA معمولاً ۸ تا ۶۳ کاراکتر است.' };
      }
      return undefined;
    },
  },
  wifiAnonIdentity: { id: 'wifiAnonIdentity', kind: 'exact', storage: extra('wifiAnonIdentity'), section: 'more', label: 'هویت ناشناس (Anonymous identity)', visible: (v) => wifiSec(v) === 'enterprise' },
  wifiHidden: { id: 'wifiHidden', kind: 'toggle', storage: extra('wifiHidden'), section: 'more', label: 'شبکه مخفی است (SSID پخش نمی‌شود)' },
  wifiLocation: { id: 'wifiLocation', kind: 'text', storage: extra('wifiLocation'), section: 'more', label: 'محل شبکه', placeholder: 'مثال: خانه، دفتر طبقه ۲' },
  modemAccountId: { id: 'modemAccountId', kind: 'account', storage: extra('modemAccountId'), section: 'more', label: 'حساب ورود پنل مدیریت مودم', hint: 'رمز پنل مودم جدا از رمز وای‌فای در یک مورد «حساب و ورود» نگه داشته می‌شود.' },

  // address
  country: { id: 'country', kind: 'text', storage: extra('country'), section: 'main', label: 'کشور', defaultValue: 'ایران', required: () => true },
  city: { id: 'city', kind: 'text', storage: extra('city'), section: 'main', label: 'شهر', placeholder: 'مثال: تهران' },
  fullAddress: { id: 'fullAddress', kind: 'multiline', storage: extra('fullAddress'), section: 'main', label: 'آدرس کامل', placeholder: 'مثال: خیابان ولیعصر، کوچه ۱۲، پلاک ۴، واحد ۳', required: () => true },
  region: { id: 'region', kind: 'text', storage: extra('region'), section: 'more', label: 'استان یا منطقه' },
  neighborhood: { id: 'neighborhood', kind: 'text', storage: extra('neighborhood'), section: 'more', label: 'محله' },
  street: { id: 'street', kind: 'text', storage: extra('street'), section: 'more', label: 'خیابان' },
  plaque: { id: 'plaque', kind: 'text', storage: extra('plaque'), section: 'more', label: 'پلاک', normalizeDigits: true },
  unit: { id: 'unit', kind: 'text', storage: extra('unit'), section: 'more', label: 'واحد', normalizeDigits: true },
  postalCode: { id: 'postalCode', kind: 'text', storage: extra('postalCode'), section: 'more', label: 'کد پستی', normalizeDigits: true, validate: (value, v) => validatePostalCode(value, v) },
  recipientName: { id: 'recipientName', kind: 'text', storage: extra('recipientName'), section: 'more', label: 'نام گیرنده' },
  contactPhone: { id: 'contactPhone', kind: 'phone', storage: extra('contactPhone'), section: 'more', label: 'شماره تماس', normalizeDigits: true, validate: (value, v) => (isIran(v) ? validateIranPhone(value) : undefined) },
  deliveryNote: { id: 'deliveryNote', kind: 'multiline', storage: extra('deliveryNote'), section: 'more', label: 'توضیح تحویل', placeholder: 'مثال: زنگ دوم، بعد از ساعت ۵' },
};

// Category-specific overrides of a shared field (label/section/placeholder only — never storage).
const withPatch = (f: FieldDef, patch: Partial<FieldDef>): FieldDef => ({ ...f, ...patch });

const RECOVERY = [F.recoveryEmail, F.recoveryPhone, F.twoFactor, F.recoveryCodes];

export const CATEGORY_FIELDS: Record<ItemCategory, FieldDef[]> = {
  login: [F.identifier, F.loginMethod, F.ssoProvider, F.ssoProviderOther, F.ssoAccountId, F.password, F.loginUrls, ...RECOVERY, F.notes],
  social: [
    F.platform,
    F.platformOther,
    F.handle,
    withPatch(F.identifier, { label: 'ایمیل یا موبایل ورود', hint: 'جدا از شناسه عمومی؛ همانی که برای ورود وارد می‌کنید', placeholder: 'مثال: user@example.com' }),
    F.loginMethod,
    F.ssoProvider,
    F.ssoProviderOther,
    F.ssoAccountId,
    F.password,
    F.profileUrl,
    withPatch(F.loginUrls, { section: 'more', label: 'آدرس صفحه ورود (در صورت نیاز)' }),
    ...RECOVERY,
    F.notes,
  ],
  bank: [F.cardHolder, F.issuer, F.cardFormat, F.cardNumber, F.expiryCalendar, F.expireDate, F.cardType, F.cvv2, F.cardPin, F.bankLoginAccountId, F.accountNumber, F.sheba, F.notes],
  email: [
    F.emailAddress,
    F.emailProvider,
    F.emailProviderOther,
    F.loginMethod,
    F.ssoProvider,
    F.ssoProviderOther,
    F.ssoAccountId,
    F.password,
    F.webmailUrl,
    F.emailLoginUsername,
    ...RECOVERY,
    F.appPassword,
    F.imapHost, F.imapPort, F.imapSecurity,
    F.smtpHost, F.smtpPort, F.smtpSecurity,
    F.popHost, F.popPort, F.popSecurity,
    F.notes,
  ],
  note: [F.noteBody],
  wifi: [F.ssid, F.wifiSecurity, F.wifiPersonalType, F.eapMethod, F.phase2, F.wifiIdentity, F.wifiPassword, F.wifiAnonIdentity, F.wifiHidden, F.wifiLocation, F.modemAccountId, F.notes],
  address: [F.country, F.city, F.fullAddress, F.region, F.neighborhood, F.street, F.plaque, F.unit, F.postalCode, F.recipientName, F.contactPhone, F.deliveryNote, F.notes],
};

export const fieldsFor = (cat: ItemCategory): FieldDef[] => CATEGORY_FIELDS[cat] || CATEGORY_FIELDS.login;

export const isVisible = (f: FieldDef, v: Values) => (f.visible ? f.visible(v) : true);
export const isRequired = (f: FieldDef, v: Values) => isVisible(f, v) && (f.required ? f.required(v) : false);

/** Every field id → a representative definition (for labels when a value comes from another category). */
const ALL_FIELDS: Map<string, FieldDef> = (() => {
  const m = new Map<string, FieldDef>();
  for (const list of Object.values(CATEGORY_FIELDS)) for (const f of list) if (!m.has(f.id)) m.set(f.id, f);
  return m;
})();
export const anyFieldDef = (id: string) => ALL_FIELDS.get(id);

export const isSecretKind = (k: FieldKind) => k === 'secret' || k === 'secretMultiline' || k === 'cardNumber';

// ---------------------------------------------------------------------------
// Helpers: digits, URLs, card, expiry, IBAN, phones
// ---------------------------------------------------------------------------
const FA_AR_DIGITS = /[۰-۹٠-٩]/g;
export function toLatinDigits(s: string): string {
  return s.replace(FA_AR_DIGITS, (ch) => {
    const code = ch.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

const UNSAFE_SCHEME = /^\s*(javascript|data|vbscript|file|blob|about):/i;

/** Returns a normalized http(s) URL, or null when the value is not a safe web URL. */
export function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (UNSAFE_SCHEME.test(value)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname || !u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Safe href for opening a stored URL (never returns javascript:, data:, …). */
export const safeHref = (raw: string | undefined | null): string | null => (raw ? normalizeUrl(raw) : null);

export function validateUrl(raw: string): { error?: string } | undefined {
  if (!raw.trim()) return undefined;
  if (UNSAFE_SCHEME.test(raw)) return { error: 'این نوع لینک برای امنیت پذیرفته نمی‌شود.' };
  return normalizeUrl(raw) ? undefined : { error: 'آدرس معتبر نیست. نمونه: https://example.com' };
}

export function luhnValid(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export const cardDigits = (value: string) => toLatinDigits(value).replace(/[\s-]/g, '');

export function validateCardNumber(value: string, format: string | undefined) {
  const digits = cardDigits(value);
  if (!/^\d+$/.test(digits)) return { error: 'شماره کارت فقط باید رقم باشد.' };
  if ((format || 'ir') === 'ir') {
    if (digits.length !== 16) return { error: 'شماره کارت‌های ایرانی ۱۶ رقم است.' };
  } else if (digits.length < 12 || digits.length > 19) {
    return { error: 'شماره کارت بین‌المللی باید بین ۱۲ تا ۱۹ رقم باشد.' };
  }
  if (!luhnValid(digits)) return { warning: 'شماره کارت با الگوی استاندارد کارت‌ها جور نیست؛ دوباره بررسی کنید.' };
  return undefined;
}

export const formatCardGroups = (value: string) => cardDigits(value).replace(/(\d{4})(?=\d)/g, '$1 ');
export const maskCard = (value: string) => {
  const d = cardDigits(value);
  if (d.length <= 4) return '•••• ' + d;
  return `•••• •••• •••• ${d.slice(-4)}`;
};

/** Expiry text: Jalali as YY/MM or YYYY/MM (as printed on Iranian cards); Gregorian as MM/YY or MM/YYYY. */
export function parseExpiry(raw: string, calendar: string | undefined): { year: number; month: number } | null {
  const v = toLatinDigits(raw).trim();
  if (calendar === 'jalali') {
    const m = v.match(/^(\d{2}|\d{4})\s*\/\s*(\d{1,2})$/);
    if (!m) return null;
    const month = +m[2];
    const year = m[1].length === 2 ? 1400 + +m[1] : +m[1];
    return month >= 1 && month <= 12 ? { year, month } : null;
  }
  if (calendar === 'gregorian') {
    const m = v.match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/);
    if (!m) return null;
    const month = +m[1];
    const year = m[2].length === 2 ? 2000 + +m[2] : +m[2];
    return month >= 1 && month <= 12 ? { year, month } : null;
  }
  return null;
}

export function validateExpiry(value: string, calendar: string | undefined) {
  if (!value.trim()) return undefined;
  if (!calendar) return { warning: 'نوع تقویم این تاریخ مشخص نیست؛ لطفاً شمسی یا میلادی را انتخاب کنید.' };
  if (!parseExpiry(value, calendar)) {
    return { error: calendar === 'jalali' ? 'قالب تاریخ شمسی: سال/ماه، مثل 07/05 یا 1407/05' : 'قالب تاریخ میلادی: ماه/سال، مثل 05/28 یا 05/2028' };
  }
  return undefined;
}

/** Months until expiry (negative = expired). `now` is {jy,jm} and {gy,gm}. */
export function monthsUntilExpiry(raw: string, calendar: string | undefined, now: { jy: number; jm: number; gy: number; gm: number }): number | null {
  const e = parseExpiry(raw, calendar);
  if (!e) return null;
  return calendar === 'jalali' ? (e.year - now.jy) * 12 + (e.month - now.jm) : (e.year - now.gy) * 12 + (e.month - now.gm);
}

export function validateSheba(value: string) {
  const v = toLatinDigits(value).replace(/\s/g, '').toUpperCase();
  if (!/^IR\d{24}$/.test(v)) return { error: 'شبا باید با IR شروع شود و ۲۴ رقم داشته باشد.' };
  // ISO 13616 mod-97 check
  const rearranged = v.slice(4) + '1827' + v.slice(2, 4);
  let rem = 0;
  for (const ch of rearranged) rem = (rem * 10 + (ch.charCodeAt(0) - 48)) % 97;
  return rem === 1 ? undefined : { warning: 'رقم کنترلی شبا درست به نظر نمی‌رسد؛ دوباره بررسی کنید.' };
}

export function validatePort(value: string) {
  const n = Number(toLatinDigits(value));
  return Number.isInteger(n) && n >= 1 && n <= 65535 ? undefined : { error: 'پورت باید عددی بین 1 تا 65535 باشد.' };
}

export const isIranCountry = (c: string | undefined) => {
  const v = (c || '').trim().toLowerCase();
  return v === 'ایران' || v === 'iran' || v === 'ir';
};

function validatePostalCode(value: string, v: Values) {
  const d = toLatinDigits(value).replace(/[\s-]/g, '');
  if (isIranCountry(v.country)) return /^\d{10}$/.test(d) ? undefined : { error: 'کد پستی ایران ۱۰ رقم است.' };
  return /^[A-Za-z0-9 -]{3,12}$/.test(toLatinDigits(value).trim()) ? undefined : { error: 'کد پستی معتبر نیست.' };
}

function validateIranPhone(value: string) {
  const d = toLatinDigits(value).replace(/[\s()-]/g, '');
  return /^(\+98|0098|0)?(9\d{9}|[1-8]\d{9})$/.test(d) ? undefined : { warning: 'شماره تماس ایرانی معمولاً ۱۱ رقم است (مثل 0912… یا 021…).' };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s()-]{6,20}$/;

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------
export interface FormState {
  category: ItemCategory;
  title: string;
  isFavorite: boolean;
  tags: string[];
  values: Values;
  customFields: VaultCustomField[];
  /** Legacy entries the user chose to remove (by entry key). */
  legacyRemovals: string[];
}

/** A value that the active category doesn't show (shown under «اطلاعات قبلی و پنهان»). */
export interface LegacyView {
  key: string; // 'top:pin' | 'field:<id>' | 'bucket:<id>'
  label: string;
  value: string;
  secret: boolean;
}

const LEGACY_TOP_LABEL: Record<TopKey, { label: string; secret: boolean }> = {
  username: { label: 'نام کاربری (قدیمی)', secret: false },
  password: { label: 'رمز عبور (قدیمی)', secret: true },
  url: { label: 'آدرس وب‌سایت (قدیمی)', secret: false },
  notes: { label: 'یادداشت (قدیمی)', secret: false },
  cardNumber: { label: 'شماره کارت (قدیمی)', secret: true },
  cardHolder: { label: 'نام دارنده کارت (قدیمی)', secret: false },
  cvv2: { label: 'CVV2 (قدیمی)', secret: true },
  expireDate: { label: 'تاریخ انقضا (قدیمی)', secret: false },
  pin: { label: 'رمز دوم / پین (قدیمی)', secret: true },
};

const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function readField(item: VaultItem, f: FieldDef): string {
  if (f.kind === 'urlList') {
    const list = [item.url, ...(item.urls || [])].filter((x): x is string => !!x && !!x.trim());
    return list.join('\n');
  }
  if (f.storage.kind === 'top') return (item[f.storage.key] as string | undefined) ?? '';
  return item.extra?.[f.storage.key] ?? '';
}

/** Initial form values for a new item of `category`. */
export function emptyForm(category: ItemCategory): FormState {
  const values: Values = {};
  for (const list of Object.values(CATEGORY_FIELDS)) {
    for (const f of list) if (values[f.id] === undefined) values[f.id] = '';
  }
  for (const f of fieldsFor(category)) if (f.defaultValue !== undefined) values[f.id] = f.defaultValue;
  return { category, title: '', isFavorite: false, tags: [], values, customFields: [], legacyRemovals: [] };
}

/** Defaults applied when the user switches category in the form (only to empty fields). */
export function applyCategoryDefaults(state: FormState, category: ItemCategory): FormState {
  const values = { ...state.values };
  for (const f of fieldsFor(category)) {
    if (f.defaultValue !== undefined && !values[f.id]) values[f.id] = f.defaultValue;
  }
  return { ...state, category, values };
}

/** Form values for an existing record (any version). */
export function toForm(item: VaultItem): FormState {
  const category = (CATEGORIES.some((c) => c.id === item.category) ? item.category : 'login') as ItemCategory;
  const state = emptyForm(category);
  // Only the record's own category decides what top-level fields mean.
  const isLegacy = item.formVersion === undefined;
  for (const f of fieldsFor(category)) {
    const v = readField(item, f);
    if (v) state.values[f.id] = v;
    else if (isLegacy) state.values[f.id] = legacyDefault(f, item);
    // new-format records keep emptyForm()'s defaults for empty fields
  }
  // Extra values (stable meaning) from fields of other categories — kept so nothing is hidden or lost.
  for (const [key, value] of Object.entries(item.extra || {})) {
    const def = [...ALL_FIELDS.values()].find((f) => f.storage.kind === 'extra' && f.storage.key === key);
    if (def && !fieldsFor(category).some((f) => f.id === def.id) && value) state.values[def.id] = value;
  }
  state.title = item.title || '';
  state.isFavorite = !!item.isFavorite;
  state.tags = [...(item.tags || [])];
  state.customFields = (item.customFields || []).map((c) => ({ ...c }));
  return state;
}

/** Defaults for records created before the new form (don't assume more than the old data says). */
function legacyDefault(f: FieldDef, item: VaultItem): string {
  if (f.id === 'loginMethod') return 'password';
  if (f.id === 'wifiSecurity') return 'personal';
  if (f.id === 'wifiPersonalType') return 'wpa';
  if (f.id === 'expiryCalendar') return ''; // unknown — never guess or convert
  if (f.id === 'cardFormat') return item.cardNumber && cardDigits(item.cardNumber).length === 16 ? 'ir' : '';
  if (f.id === 'platform') return '';
  if (f.id === 'country') return '';
  return f.defaultValue ?? '';
}

/** Top-level values on the record that its category doesn't use (e.g. the old PIN on bank cards). */
export function unmappedTop(item: VaultItem | null): LegacyView[] {
  if (!item) return [];
  const mapped = new Set(fieldsFor(item.category).filter((f) => f.storage.kind === 'top').map((f) => (f.storage as { key: TopKey }).key));
  const out: LegacyView[] = [];
  for (const key of TOP_KEYS) {
    const value = item[key];
    if (typeof value === 'string' && value.trim() && !mapped.has(key)) {
      out.push({ key: `top:${key}`, label: LEGACY_TOP_LABEL[key].label, value, secret: LEGACY_TOP_LABEL[key].secret });
    }
  }
  return out;
}

/** Field values that are hidden in the current state (other category, or hidden by a condition). */
export function inactiveValues(state: FormState): { def: FieldDef; value: string }[] {
  const active = new Set(fieldsFor(state.category).filter((f) => isVisible(f, state.values)).map((f) => f.id));
  const seen = new Set<string>();
  const out: { def: FieldDef; value: string }[] = [];
  for (const [id, value] of Object.entries(state.values)) {
    if (!value || !value.trim() || active.has(id) || seen.has(id)) continue;
    const def = fieldsFor(state.category).find((f) => f.id === id) || ALL_FIELDS.get(id);
    if (!def) continue;
    if (def.defaultValue !== undefined && value === def.defaultValue) continue; // untouched defaults
    if (def.kind === 'select' && def.options && !def.options.some((o) => o.value === value)) continue;
    seen.add(id);
    out.push({ def, value });
  }
  return out;
}

/** Everything shown in the «اطلاعات قبلی و پنهان» section. */
export function legacyViews(state: FormState, original: VaultItem | null): LegacyView[] {
  const removed = new Set(state.legacyRemovals);
  const views: LegacyView[] = [];
  views.push(...unmappedTop(original));
  for (const { def, value } of inactiveValues(state)) {
    if (def.kind === 'select' || def.kind === 'toggle') continue;
    const fromCat = fieldsFor(state.category).some((f) => f.id === def.id) ? '' : ` — ${categoryOfField(def.id)}`;
    views.push({ key: `field:${def.id}`, label: `${def.label}${fromCat}`, value, secret: isSecretKind(def.kind) });
  }
  for (const e of original?.legacy || []) {
    views.push({ key: `bucket:${e.id}`, label: e.label, value: e.value, secret: e.secret });
  }
  return views.filter((v) => !removed.has(v.key));
}

function categoryOfField(id: string): string {
  const cat = CATEGORIES.find((c) => fieldsFor(c.id).some((f) => f.id === id));
  return cat ? cat.label : 'دسته دیگر';
}

// ---------------------------------------------------------------------------
// Validation (shared by add & edit)
// ---------------------------------------------------------------------------
export interface FieldIssue {
  error?: string;
  warning?: string;
}

export function validateForm(state: FormState, original: VaultItem | null, initial: FormState | null): Record<string, FieldIssue> {
  const issues: Record<string, FieldIssue> = {};
  const v = state.values;
  const grandfather = (id: string) => !!original && !!initial && (initial.values[id] ?? '') === (v[id] ?? '');

  if (!state.title.trim()) issues.title = { error: 'عنوان لازم است.' };

  for (const f of fieldsFor(state.category)) {
    if (!isVisible(f, v)) continue;
    const value = v[f.id] ?? '';
    const trimmed = value.trim();
    let issue: FieldIssue | undefined;

    if (!trimmed) {
      if (isRequired(f, v)) issue = { error: `${stripOptional(f.label)} لازم است.` };
    } else if (f.kind === 'url') {
      issue = validateUrl(value);
    } else if (f.kind === 'urlList') {
      const bad = value.split('\n').map((s) => s.trim()).filter(Boolean).map(validateUrl).find((x) => x?.error);
      issue = bad;
    } else if (f.kind === 'email' && !EMAIL_RE.test(trimmed)) {
      issue = { error: 'آدرس ایمیل معتبر نیست. نمونه: name@example.com' };
    } else if (f.kind === 'phone' && !PHONE_RE.test(toLatinDigits(trimmed))) {
      issue = { error: 'شماره تلفن معتبر نیست.' };
    }
    if (!issue && trimmed && f.validate) {
      const val = f.normalizeDigits ? toLatinDigits(value) : value;
      issue = f.validate(val, v);
    }

    if (issue?.error) {
      // Records created before this form stay editable: unchanged old values only warn.
      // Unsafe links are never grandfathered.
      const unsafe = (f.kind === 'url' || f.kind === 'urlList') && UNSAFE_SCHEME.test(value);
      if (grandfather(f.id) && !unsafe) issue = { warning: `${issue.error} (مقدار قبلی)` };
    }
    if (issue && (issue.error || issue.warning)) issues[f.id] = issue;
  }

  state.customFields.forEach((c) => {
    const k = `custom:${c.id}`;
    if (!c.label.trim() && c.value.trim()) issues[k] = { error: 'برای فیلد سفارشی نام بنویسید.' };
    else if (c.type === 'url' && c.value.trim()) {
      const u = validateUrl(c.value);
      if (u) issues[k] = u;
    }
  });
  return issues;
}

const stripOptional = (label: string) => label.replace(/\s*\(اختیاری\)\s*/g, '').replace(/\s*\(در صورت نیاز\)\s*/g, '');

export const hasErrors = (issues: Record<string, FieldIssue>) => Object.values(issues).some((i) => !!i.error);

// ---------------------------------------------------------------------------
// Save mapping
// ---------------------------------------------------------------------------
export interface PendingHidden {
  id: string;
  label: string;
  value: string;
  secret: boolean;
}

/** Hidden values typed in THIS session (not stored before) — the user decides keep/discard. */
export function newlyHiddenValues(state: FormState, initial: FormState): PendingHidden[] {
  return inactiveValues(state)
    .filter(({ def, value }) => (initial.values[def.id] ?? '') !== value && def.kind !== 'select' && def.kind !== 'toggle')
    .map(({ def, value }) => ({ id: def.id, label: def.label, value, secret: isSecretKind(def.kind) }));
}

function normalizeForSave(f: FieldDef, value: string, unchanged: boolean): string {
  if (unchanged) return value; // never rewrite what the user didn't touch
  let v = f.normalizeDigits ? toLatinDigits(value) : value;
  switch (f.kind) {
    case 'secret':
    case 'secretMultiline':
    case 'exact':
      // exact bytes: no trimming or case changes; digit conversion only for numeric secrets (CVV2, PIN)
      return f.normalizeDigits ? toLatinDigits(value) : value;
    case 'cardNumber':
      return cardDigits(v);
    case 'url':
      return v.trim() ? normalizeUrl(v) ?? v.trim() : '';
    case 'multiline':
      return v.replace(/\s+$/, '');
    default:
      v = v.trim();
      if (f.id === 'sheba') v = v.replace(/\s/g, '').toUpperCase();
      return v;
  }
}

/**
 * Builds the record to store. `keepHidden` decides what happens to hidden values typed in this
 * session (see newlyHiddenValues). Values already stored are never dropped unless the user
 * removed them explicitly in the «اطلاعات قبلی» section.
 */
export function fromForm(
  state: FormState,
  original: VaultItem | null,
  initial: FormState,
  keepHidden: boolean
): Omit<VaultItem, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<VaultItem, 'id' | 'createdAt' | 'updatedAt'>> {
  const now = new Date().toISOString();
  const cat = state.category;
  const fields = fieldsFor(cat);
  const v = state.values;
  const removed = new Set(state.legacyRemovals);

  const out: VaultItem = original
    ? { ...original }
    : ({ id: '', category: cat, title: '', isFavorite: false, createdAt: now, updatedAt: now } as VaultItem);

  // 1) Start from a clean slate for category-managed storage
  for (const k of TOP_KEYS) delete out[k];
  delete out.urls;
  const extraOut: Record<string, string> = { ...(original?.extra || {}) };
  const legacyOut: VaultLegacyEntry[] = (original?.legacy || []).filter((e) => !removed.has(`bucket:${e.id}`));

  const writeTop = (key: TopKey, value: string) => {
    if (value) (out as unknown as Record<string, string>)[key] = value;
  };

  const categoryChanged = !!original && original.category !== cat;
  const hiddenIds = new Set(inactiveValues(state).map((x) => x.def.id));

  // 2) Active (and conditionally hidden) fields of the chosen category
  for (const f of fields) {
    const raw = v[f.id] ?? '';
    const unchanged = (initial.values[f.id] ?? '') === raw;
    const hidden = hiddenIds.has(f.id) || !isVisible(f, v);
    if (hidden) {
      const storedBefore = !!original && readField(original, f) === raw;
      // Defaults and choices of hidden selects carry no data of their own — keep only if stored before.
      const onlyDefault = (f.kind === 'select' || f.kind === 'toggle' || raw === f.defaultValue) && !storedBefore;
      const keep = !onlyDefault && !removed.has(`field:${f.id}`) && raw.trim() && (unchanged || keepHidden);
      if (!keep) {
        if (f.storage.kind === 'extra') delete extraOut[f.storage.key];
        continue;
      }
    }
    if (f.kind === 'urlList') {
      const initialList = (initial.values[f.id] || '').split('\n').map((x) => x.trim());
      const list = raw
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean)
        .map((u) => (initialList.includes(u) ? u : normalizeUrl(u) ?? u));
      if (list[0]) out.url = list[0];
      if (list.length > 1) out.urls = list.slice(1);
      continue;
    }
    const value = normalizeForSave(f, raw, unchanged);
    if (f.storage.kind === 'top') writeTop(f.storage.key, value);
    else if (value && !(f.kind === 'select' && value === '')) extraOut[f.storage.key] = value;
    else delete extraOut[f.storage.key];
  }

  // 3) Values of fields that don't belong to this category
  const ownIds = new Set(fields.map((f) => f.id));
  for (const [id, raw] of Object.entries(v)) {
    if (ownIds.has(id) || !raw || !raw.trim()) continue;
    const def = ALL_FIELDS.get(id);
    if (!def) continue;
    const storedBefore = def.storage.kind === 'extra' && original?.extra?.[def.storage.key] === raw;
    if (def.defaultValue !== undefined && raw === def.defaultValue && !storedBefore) continue;
    if (def.kind === 'select' || def.kind === 'toggle') {
      // Options of another category carry no data on their own — drop unless already stored.
      if (storedBefore) extraOut[def.storage.key] = raw;
      continue;
    }
    const unchanged = (initial.values[id] ?? '') === raw;
    const keep = !removed.has(`field:${id}`) && (unchanged || keepHidden);
    if (def.storage.kind === 'extra') {
      if (keep) extraOut[def.storage.key] = raw;
      else delete extraOut[def.storage.key];
    } else if (keep) {
      // Top-level meaning depends on the category → keep as a labelled legacy entry instead.
      legacyOut.push({ id: newId('legacy'), label: `${def.label} — ${categoryOfField(id)}`, value: raw, secret: isSecretKind(def.kind), from: original?.category || cat, savedAt: now });
    }
  }

  // 4) Old top-level values the original category never mapped (e.g. combined «رمز دوم / پین»)
  if (original) {
    for (const lv of unmappedTop(original)) {
      if (removed.has(lv.key)) continue;
      const key = lv.key.slice(4) as TopKey;
      if (!categoryChanged && out[key] === undefined) {
        (out as unknown as Record<string, string>)[key] = lv.value; // untouched, same place
      } else if (categoryChanged) {
        legacyOut.push({ id: newId('legacy'), label: lv.label, value: lv.value, secret: lv.secret, from: original.category, savedAt: now });
      }
    }
  }

  out.category = cat;
  out.title = state.title.trim();
  out.isFavorite = state.isFavorite;
  out.tags = state.tags.map((t) => t.trim()).filter(Boolean);
  out.extra = Object.keys(extraOut).length ? extraOut : undefined;
  if (!out.extra) delete out.extra;
  const customs = state.customFields
    .filter((c) => c.label.trim() || c.value.trim())
    .map((c) => ({ ...c, label: c.label.trim(), value: c.type === 'url' && c.value.trim() ? normalizeUrl(c.value) ?? c.value.trim() : c.value }));
  if (customs.length) out.customFields = customs;
  else delete out.customFields;
  if (legacyOut.length) out.legacy = legacyOut;
  else delete out.legacy;
  out.formVersion = 2;
  return out;
}

// ---------------------------------------------------------------------------
// Title suggestions & category-aware helpers
// ---------------------------------------------------------------------------
export function platformDef(value: string | undefined) {
  return SOCIAL_PLATFORMS.find((p) => p.value === value);
}

export function suggestTitle(state: FormState): string {
  const v = state.values;
  switch (state.category) {
    case 'login': {
      const first = (v.loginUrls || '').split('\n')[0];
      const href = first ? normalizeUrl(first) : null;
      if (href) return new URL(href).hostname.replace(/^www\./, '');
      return v.identifier?.trim() || '';
    }
    case 'social': {
      const name = v.platform === 'other' ? v.platformOther?.trim() : platformDef(v.platform)?.label;
      if (!name) return '';
      return v.handle?.trim() ? `${name} — ${v.handle.trim()}` : name;
    }
    case 'bank': {
      const last4 = cardDigits(v.cardNumber || '').slice(-4);
      const bank = v.issuer?.trim();
      if (bank && last4) return `کارت ${bank} — ${last4}`;
      return bank ? `کارت ${bank}` : '';
    }
    case 'email':
      return v.emailAddress?.trim() || '';
    case 'wifi':
      return v.ssid ? `وای‌فای ${v.ssid}` : '';
    case 'address':
      return v.city?.trim() ? `آدرس ${v.city.trim()}` : '';
    default:
      return '';
  }
}

export function suggestedProfileUrl(v: Values): string {
  const handle = (v.handle || '').trim().replace(/^@/, '');
  const p = platformDef(v.platform);
  return handle && p?.profile && /^[A-Za-z0-9._-]+$/.test(handle) ? p.profile(handle) : '';
}

export function suggestedWebmail(v: Values): string {
  return EMAIL_PROVIDERS.find((p) => p.value === v.emailProvider)?.webmail || '';
}

/** Full address text for copying (optionally with recipient & phone). */
export function addressText(item: VaultItem, withContact: boolean): string {
  const e = item.extra || {};
  const lines = [e.fullAddress || ''];
  const parts = [e.city, e.region, e.country].filter(Boolean).join('، ');
  if (parts && !(e.fullAddress || '').includes(e.city || '\u0000')) lines.push(parts);
  if (e.postalCode) lines.push(`کد پستی: ${e.postalCode}`);
  if (withContact) {
    if (e.recipientName) lines.push(`گیرنده: ${e.recipientName}`);
    if (e.contactPhone) lines.push(`تلفن: ${e.contactPhone}`);
  }
  return lines.filter((l) => l.trim()).join('\n');
}

// ---------------------------------------------------------------------------
// Wi-Fi QR (standard "WIFI:" payload, generated locally)
// ---------------------------------------------------------------------------
const escWifi = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');

/** Returns the QR payload, or null when the network type has no widely supported QR format. */
export function wifiQrPayload(item: VaultItem): { payload: string } | { unsupported: string } {
  const e = item.extra || {};
  const ssid = item.username || '';
  if (!ssid) return { unsupported: 'نام شبکه ثبت نشده است.' };
  const sec = e.wifiSecurity || 'personal';
  const hidden = e.wifiHidden === 'true' ? 'H:true;' : '';
  if (sec === 'enterprise') return { unsupported: 'QR برای شبکه‌های سازمانی در اکثر دستگاه‌ها پشتیبانی نمی‌شود.' };
  if (sec === 'open') return { payload: `WIFI:T:nopass;S:${escWifi(ssid)};${hidden};` };
  if (!item.password) return { unsupported: 'رمز شبکه ثبت نشده است.' };
  const t = (e.wifiPersonalType || 'wpa') === 'wep' ? 'WEP' : 'WPA';
  return { payload: `WIFI:T:${t};S:${escWifi(ssid)};P:${escWifi(item.password)};${hidden};` };
}

export const CUSTOM_FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'متن' },
  { value: 'secret', label: 'رمز' },
  { value: 'url', label: 'لینک' },
  { value: 'date', label: 'تاریخ' },
  { value: 'multiline', label: 'متن چندخطی' },
];

export const newCustomField = (): VaultCustomField => ({ id: newId('cf'), label: '', type: 'text', value: '' });

/** Comparable snapshot for "unsaved changes" detection. */
export const snapshot = (s: FormState) =>
  JSON.stringify({ c: s.category, t: s.title, f: s.isFavorite, g: s.tags, v: Object.entries(s.values).filter(([, x]) => x).sort(), cf: s.customFields, r: s.legacyRemovals });
