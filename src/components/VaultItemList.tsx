import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  KeyRound, 
  CreditCard, 
  Globe, 
  Mail, 
  FileText, 
  Wifi, 
  Star, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  ExternalLink, 
  ShieldAlert, 
  ShieldCheck, 
  Trash2, 
  Edit3, 
  X,
  Clock,
  Sparkles,
  ChevronRight,
  MapPin,
  QrCode,
  Link2,
  History,
} from 'lucide-react';
import { VaultItem, ItemCategory } from '../types';
import { CryptoService } from '../services/crypto';
import {
  categoryDef,
  safeHref,
  maskCard,
  formatCardGroups,
  wifiQrPayload,
  addressText,
  monthsUntilExpiry,
  legacyViews,
  toForm,
  platformDef,
  EMAIL_PROVIDERS,
  WIFI_SECURITY,
  EXPIRY_CALENDARS,
  SSO_PROVIDERS,
} from '../vault/schema';
import { gregorianToJalali } from '../utils/jalali';
import { CATEGORY_ICONS } from './ItemModal';
import { WifiQrDialog } from './vault/WifiQrDialog';

interface VaultItemListProps {
  items: VaultItem[];
  onSelectItem: (item: VaultItem) => void;
  onAddNew: (category?: ItemCategory) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteItem: (id: string) => void;
}

const CATEGORY_TABS: { id: string; label: string; icon?: React.FC<{ className?: string }> }[] = [
  { id: 'all', label: 'همه رمزها' },
  { id: 'favorites', label: 'برگزیده‌ها', icon: Star },
  { id: 'social', label: 'شبکه‌های اجتماعی', icon: Globe },
  { id: 'bank', label: 'بانک و کارت‌ها', icon: CreditCard },
  { id: 'login', label: 'ورود به سایت‌ها', icon: KeyRound },
  { id: 'email', label: 'ایمیل‌ها', icon: Mail },
  { id: 'wifi', label: 'وای‌فای', icon: Wifi },
  { id: 'note', label: 'یادداشت امن', icon: FileText },
  { id: 'address', label: 'آدرس‌ها', icon: MapPin },
];

export const VaultItemList: React.FC<VaultItemListProps> = ({
  items,
  onSelectItem,
  onAddNew,
  onToggleFavorite,
  onDeleteItem,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('all');
  // Each secret field is revealed independently (key: `${itemId}:${field}`)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [qrFor, setQrFor] = useState<{ title: string; payload: string } | null>(null);
  
  // Clipboard Auto-clear Countdown
  const [clipboardNotice, setClipboardNotice] = useState<{
    text: string;
    itemTitle: string;
    secondsLeft: number;
  } | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Clipboard auto-clear countdown timer
  useEffect(() => {
    if (!clipboardNotice) return;
    if (clipboardNotice.secondsLeft <= 0) {
      // Clear clipboard for security
      try {
        navigator.clipboard.writeText('');
      } catch {}
      setClipboardNotice(null);
      return;
    }

    const timer = setInterval(() => {
      setClipboardNotice((prev) => (prev ? { ...prev, secondsLeft: prev.secondsLeft - 1 } : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [clipboardNotice]);

  const toggleReveal = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = async (text: string, label: string, itemTitle: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      setClipboardNotice({
        text: label,
        itemTitle,
        secondsLeft: 30, // 30-second security window
      });
    } catch {
      setCopiedId(id);
    }
  };

  const handleInstantClearClipboard = () => {
    try {
      navigator.clipboard.writeText('');
    } catch {}
    setClipboardNotice(null);
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    // Tab filter
    if (selectedTab === 'favorites' && !item.isFavorite) return false;
    if (selectedTab !== 'all' && selectedTab !== 'favorites' && item.category !== selectedTab) return false;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchUsername = item.username?.toLowerCase().includes(q) || false;
      const matchUrl = item.url?.toLowerCase().includes(q) || false;
      const matchCard = item.cardNumber?.replace(/\s/g, '').includes(q.replace(/\s/g, '')) || false;
      const matchTags = item.tags?.some((t) => t.toLowerCase().includes(q)) || false;
      const e = item.extra || {};
      const matchNew = [e.handle, e.platformOther, platformDef(e.platform)?.label, e.city, e.country]
        .some((x) => !!x && x.toLowerCase().includes(q));
      return matchTitle || matchUsername || matchUrl || matchCard || matchTags || matchNew;
    }

    return true;
  });

  // Calculate vault health statistics
  const totalCount = items.length;
  const weakCount = items.filter((i) => i.password && CryptoService.evaluateStrength(i.password).level === 'weak').length;
  const strongCount = items.filter((i) => i.password && (CryptoService.evaluateStrength(i.password).level === 'strong' || CryptoService.evaluateStrength(i.password).level === 'very-strong')).length;

  const getCategoryIcon = (category: ItemCategory) => CATEGORY_ICONS[category] || KeyRound;

  // ---------------------------------------------------------------- row helpers
  const rowLabel = (text: string) => (
    <span className="text-[11px] text-[#94A2C2] shrink-0" style={{ color: 'var(--ui-text-secondary)' }}>{text}</span>
  );

  const copyBtn = (text: string, label: string, item: VaultItem, key: string) => (
    <button
      type="button"
      onClick={(e) => copyToClipboard(text, label, item.title, key, e)}
      className="p-1 rounded text-[#94A2C2] hover:text-[#38E1FF] transition cursor-pointer"
      title={`کپی ${label}`}
      aria-label={`کپی ${label}`}
    >
      {copiedId === key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );

  const textRow = (item: VaultItem, field: string, label: string, value: string | undefined, opts: { ltr?: boolean; copy?: boolean } = {}) =>
    value ? (
      <div className="flex items-center justify-between gap-2" key={field}>
        {rowLabel(`${label}:`)}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-white text-xs truncate max-w-[190px] ${opts.ltr ? 'font-mono dir-ltr' : ''}`} dir={opts.ltr ? 'ltr' : 'auto'}>
            {value}
          </span>
          {opts.copy !== false && copyBtn(value, label, item, `${field}-${item.id}`)}
        </div>
      </div>
    ) : null;

  const secretRow = (item: VaultItem, field: string, label: string, value: string | undefined, display?: (v: string) => string) => {
    if (!value) return null;
    const key = `${item.id}:${field}`;
    const shown = !!revealed[key];
    return (
      <div className="flex items-center justify-between gap-2" key={field}>
        {rowLabel(`${label}:`)}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-white text-xs dir-ltr truncate max-w-[170px]" dir="ltr">
            {shown ? (display ? display(value) : value) : '••••••••••••'}
          </span>
          <button
            type="button"
            onClick={(e) => toggleReveal(key, e)}
            className="p-1 rounded text-[#94A2C2] hover:text-white transition cursor-pointer"
            title={shown ? 'پنهان‌سازی' : 'نمایش'}
            aria-label={shown ? `پنهان کردن ${label}` : `نمایش ${label}`}
            aria-pressed={shown}
          >
            {shown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          {copyBtn(value, label, item, `${field}-${item.id}`)}
        </div>
      </div>
    );
  };

  const linkBtn = (href: string | null, label: string) =>
    href ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 py-1 px-2 rounded-lg bg-[#4F7CFF]/10 text-[#7FA0FF] hover:bg-[#4F7CFF]/20 text-[11px] font-medium"
      >
        <ExternalLink className="w-3 h-3" />
        {label}
      </a>
    ) : null;

  const linkedRow = (item: VaultItem, label: string, linkedId: string | undefined) => {
    if (!linkedId) return null;
    const linked = items.find((x) => x.id === linkedId);
    return (
      <div className="flex items-center justify-between gap-2" key={`link-${label}`}>
        {rowLabel(`${label}:`)}
        {linked ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectItem(linked);
            }}
            className="inline-flex items-center gap-1 text-xs text-[#38E1FF] hover:underline cursor-pointer truncate max-w-[190px]"
          >
            <Link2 className="w-3 h-3 shrink-0" />
            {linked.title}
          </button>
        ) : (
          <span className="text-[11px] text-[#5D6B8F]">پیدا نشد</span>
        )}
      </div>
    );
  };

  const now = (() => {
    const d = new Date();
    const j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return { jy: j.jy, jm: j.jm, gy: d.getFullYear(), gm: d.getMonth() + 1 };
  })();

  /** Login-style rows shared by «حساب و ورود»، «شبکه‌های اجتماعی» و «ایمیل». */
  const accountRows = (item: VaultItem, identifierLabel: string) => {
    const e = item.extra || {};
    const method = e.loginMethod || 'password';
    const sso = method === 'sso' ? (e.ssoProvider === 'other' ? e.ssoProviderOther : SSO_PROVIDERS.find((p) => p.value === e.ssoProvider)?.label) : '';
    return (
      <>
        {textRow(item, 'user', identifierLabel, item.username, { ltr: true })}
        {method === 'password' && secretRow(item, 'pass', 'رمز عبور', item.password)}
        {method === 'sso' && textRow(item, 'sso', 'ورود با', sso || 'سرویس دیگر', { copy: false })}
        {method === 'otp' && textRow(item, 'otp', 'روش ورود', 'کد یک‌بارمصرف', { copy: false })}
        {method === 'sso' && linkedRow(item, 'حساب مرتبط', e.ssoAccountId)}
      </>
    );
  };

  const renderCategoryRows = (item: VaultItem) => {
    const e = item.extra || {};
    switch (item.category) {
      case 'bank': {
        const key = `${item.id}:card`;
        const shown = !!revealed[key];
        const months = item.expireDate ? monthsUntilExpiry(item.expireDate, e.expiryCalendar, now) : null;
        const cal = EXPIRY_CALENDARS.find((c) => c.value === e.expiryCalendar)?.label || 'تقویم نامشخص';
        return (
          <>
            {item.cardNumber && (
              <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#0F1524] border border-[#1F2B47]" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
                <span className="font-mono text-xs font-bold text-white tracking-widest" dir="ltr">
                  {shown ? formatCardGroups(item.cardNumber) : maskCard(item.cardNumber)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(ev) => toggleReveal(key, ev)}
                    className="p-1 rounded text-[#94A2C2] hover:text-white transition cursor-pointer"
                    aria-label={shown ? 'پنهان کردن شماره کارت' : 'نمایش کامل شماره کارت'}
                    aria-pressed={shown}
                    title={shown ? 'پنهان‌سازی' : 'نمایش کامل'}
                  >
                    {shown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  {copyBtn(item.cardNumber.replace(/\s/g, ''), 'شماره کارت', item, `card-${item.id}`)}
                </div>
              </div>
            )}
            {textRow(item, 'holder', 'دارنده', item.cardHolder, { copy: true })}
            {textRow(item, 'issuer', 'بانک', e.issuer, { copy: false })}
            {item.expireDate && (
              <div className="flex items-center justify-between gap-2">
                {rowLabel('انقضا:')}
                <span className="flex items-center gap-1.5 text-xs text-white">
                  <span className="font-mono" dir="ltr">{item.expireDate}</span>
                  <span className="text-[10px] text-[#94A2C2]">({cal})</span>
                  {months !== null && months < 0 && <span className="px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-300 text-[10px] font-bold">منقضی</span>}
                  {months !== null && months >= 0 && months <= 2 && <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-[10px] font-bold">نزدیک انقضا</span>}
                </span>
              </div>
            )}
            {secretRow(item, 'cvv2', 'CVV2', item.cvv2)}
            {secretRow(item, 'cardPin', 'PIN', e.cardPin)}
            {linkedRow(item, 'حساب ورود مرتبط', e.bankLoginAccountId)}
          </>
        );
      }
      case 'social': {
        const p = platformDef(e.platform);
        const name = e.platform === 'other' ? e.platformOther : p?.label;
        return (
          <>
            {textRow(item, 'platform', 'پلتفرم', name, { copy: false })}
            {textRow(item, 'handle', 'شناسه عمومی', e.handle, { ltr: true })}
            {accountRows(item, 'ورود با')}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {linkBtn(safeHref(e.profileUrl), 'باز کردن پروفایل')}
              {linkBtn(safeHref(item.url), 'صفحه ورود')}
            </div>
          </>
        );
      }
      case 'email': {
        const provider = e.emailProvider === 'other' ? e.emailProviderOther : EMAIL_PROVIDERS.find((x) => x.value === e.emailProvider)?.label;
        return (
          <>
            {accountRows(item, 'ایمیل')}
            {textRow(item, 'provider', 'سرویس', provider, { copy: false })}
            <div className="flex flex-wrap gap-1.5 pt-1">{linkBtn(safeHref(item.url), 'باز کردن وب‌میل')}</div>
          </>
        );
      }
      case 'wifi': {
        const qr = wifiQrPayload(item);
        const sec = e.wifiSecurity || 'personal';
        return (
          <>
            {textRow(item, 'ssid', 'نام شبکه', item.username, { ltr: true })}
            {textRow(item, 'sec', 'امنیت', WIFI_SECURITY.find((x) => x.value === sec)?.label, { copy: false })}
            {sec === 'enterprise' && textRow(item, 'identity', 'Identity', e.wifiIdentity, { ltr: true })}
            {sec !== 'open' && secretRow(item, 'pass', 'رمز شبکه', item.password)}
            {linkedRow(item, 'پنل مودم', e.modemAccountId)}
            <div className="pt-1">
              {'payload' in qr ? (
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setQrFor({ title: item.title, payload: qr.payload });
                  }}
                  className="inline-flex items-center gap-1 py-1 px-2 rounded-lg bg-[#4F7CFF]/10 text-[#7FA0FF] hover:bg-[#4F7CFF]/20 text-[11px] font-medium cursor-pointer"
                >
                  <QrCode className="w-3 h-3" />
                  نمایش QR اتصال
                </button>
              ) : (
                <span className="text-[10px] text-[#5D6B8F]">{qr.unsupported}</span>
              )}
            </div>
          </>
        );
      }
      case 'note': {
        if (!item.notes) return null;
        const key = `${item.id}:note`;
        const shown = !!revealed[key];
        return (
          <div className="space-y-1.5">
            <p className="text-xs text-[#94A2C2] leading-relaxed whitespace-pre-wrap break-words" style={{ color: shown ? 'var(--ui-text)' : 'var(--ui-text-secondary)' }} dir="auto">
              {shown ? item.notes : 'متن یادداشت مخفی است.'}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(ev) => toggleReveal(key, ev)}
                className="inline-flex items-center gap-1 py-1 px-2 rounded-lg bg-white/5 text-[#C9D3EA] hover:bg-white/10 text-[11px] cursor-pointer"
                aria-pressed={shown}
              >
                {shown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {shown ? 'پنهان کردن متن' : 'مشاهده متن'}
              </button>
              {copyBtn(item.notes, 'متن یادداشت', item, `note-${item.id}`)}
            </div>
          </div>
        );
      }
      case 'address': {
        const plain = addressText(item, false);
        const withContact = addressText(item, true);
        return (
          <>
            {textRow(item, 'place', 'شهر', [e.city, e.country].filter(Boolean).join('، '), { copy: false })}
            {e.fullAddress && (
              <p className="text-xs text-white leading-relaxed whitespace-pre-wrap break-words" dir="auto">
                {e.fullAddress}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={(ev) => copyToClipboard(plain, 'آدرس', item.title, `addr-${item.id}`, ev)}
                className="inline-flex items-center gap-1 py-1 px-2 rounded-lg bg-[#4F7CFF]/10 text-[#7FA0FF] hover:bg-[#4F7CFF]/20 text-[11px] font-medium cursor-pointer"
              >
                {copiedId === `addr-${item.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                کپی آدرس کامل
              </button>
              {withContact !== plain && (
                <button
                  type="button"
                  onClick={(ev) => copyToClipboard(withContact, 'آدرس با گیرنده', item.title, `addr2-${item.id}`, ev)}
                  className="inline-flex items-center gap-1 py-1 px-2 rounded-lg bg-white/5 text-[#C9D3EA] hover:bg-white/10 text-[11px] cursor-pointer"
                >
                  {copiedId === `addr2-${item.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  کپی با نام گیرنده و تماس
                </button>
              )}
            </div>
          </>
        );
      }
      default:
        return (
          <>
            {accountRows(item, 'شناسه ورود')}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {linkBtn(safeHref(item.url), 'باز کردن صفحه ورود')}
              {(item.urls || []).map((u, i) => (
                <React.Fragment key={i}>{linkBtn(safeHref(u), `آدرس ${i + 2}`)}</React.Fragment>
              ))}
            </div>
          </>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-6">
      {/* Security Health Mini Banner */}
      <div 
        className="rounded-2xl p-4 sm:p-5 bg-[#121A2C] border border-[#1F2B47] shadow-xl relative overflow-hidden"
        style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#4F7CFF] to-[#38E1FF] p-0.5 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-[#121A2C] rounded-[14px] flex items-center justify-center" style={{ backgroundColor: 'var(--ui-surface)' }}>
                <ShieldCheck className="w-6 h-6 text-[#38E1FF]" />
              </div>
            </div>
            <div>
              <h2 className="font-black text-base sm:text-lg text-white">وضعیت امنیت گاوصندوق</h2>
              <p className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>
                تمام رمزها به صورت محلی با کلید مشتق شده از رمز شما رمزنگاری شده‌اند
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end text-xs">
            <div className="text-center px-3 py-1.5 rounded-xl bg-[#0F1524] border border-[#1F2B47]" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
              <div className="font-bold text-white text-base">{totalCount}</div>
              <div className="text-[11px] text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>کل موارد</div>
            </div>

            <div className="text-center px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <div className="font-bold text-base">{strongCount}</div>
              <div className="text-[11px]">رمزهای قوی</div>
            </div>

            {weakCount > 0 ? (
              <div className="text-center px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <div className="font-bold text-base">{weakCount}</div>
                <div className="text-[11px]">نیاز به تقویت</div>
              </div>
            ) : (
              <div className="text-center px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[#38E1FF]">
                <div className="font-bold text-base">۱۰۰٪</div>
                <div className="text-[11px]">امنیت بالا</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Clipboard Auto-Clear Banner */}
      {clipboardNotice && (
        <div className="sticky top-16 z-20 animate-in slide-in-from-top duration-200">
          <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-r from-[#121A2C] to-[#182239] border border-[#38E1FF]/40 text-white shadow-2xl flex items-center justify-between gap-3" style={{ backgroundColor: 'var(--ui-surface)' }}>
            <div className="flex items-center gap-2.5 text-xs">
              <div className="w-7 h-7 rounded-lg bg-[#38E1FF]/15 text-[#38E1FF] flex items-center justify-center shrink-0">
                <Copy className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white">{clipboardNotice.text} «{clipboardNotice.itemTitle}» کپی شد!</span>
                <span className="text-[#94A2C2] mx-2 hidden sm:inline" style={{ color: 'var(--ui-text-secondary)' }}>•</span>
                <span className="text-[#38E1FF] text-[11px] font-mono">
                  پاکسازی خودکار تا {clipboardNotice.secondsLeft} ثانیه دیگر
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleInstantClearClipboard}
              className="py-1 px-2.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 text-xs font-medium transition cursor-pointer shrink-0"
            >
              پاکسازی فوری
            </button>
          </div>
        </div>
      )}

      {/* Search & Tabs Controls */}
      <div className="space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در بین تمام رمزها، نام کاربری، کارت یا برچسب‌ها..."
            className="w-full bg-[#121A2C] border border-[#1F2B47] rounded-2xl pr-10 pl-10 py-3 text-sm text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF] focus:ring-1 focus:ring-[#4F7CFF] transition shadow-sm"
            style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[#94A2C2] hover:text-white"
              style={{ color: 'var(--ui-text-secondary)' }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Categories Tab Scroll */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = selectedTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTab(tab.id)}
                className={`py-2 px-3.5 rounded-xl font-medium shrink-0 flex items-center gap-1.5 transition cursor-pointer border ${
                  isSelected
                    ? 'bg-[#4F7CFF] border-[#4F7CFF] text-white shadow-md shadow-[#4F7CFF]/20'
                    : 'bg-[#121A2C] border-[#1F2B47] text-[#94A2C2] hover:text-white hover:border-[#2C3C61]'
                }`}
                style={!isSelected ? { backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)', color: 'var(--ui-text-secondary)' } : {}}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Items Cards Grid */}
      {filteredItems.length === 0 ? (
        <div 
          className="text-center py-16 px-4 rounded-3xl bg-[#121A2C] border border-[#1F2B47] border-dashed"
          style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
        >
          <div className="w-16 h-16 rounded-2xl bg-[#0F1524] text-[#5D6B8F] mx-auto flex items-center justify-center mb-4">
            <KeyRound className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-base text-white">هیچ رمزی یافت نشد</h3>
          <p className="text-xs text-[#94A2C2] mt-1.5 max-w-sm mx-auto" style={{ color: 'var(--ui-text-secondary)' }}>
            {searchQuery
              ? 'نتیجه‌ای منطبق با عبارت جستجوی شما پیدا نشد.'
              : 'شما می‌توانید با زدن دکمه زیر اولین رمز عبور یا کارت بانکی خود را ذخیره کنید.'}
          </p>
          <button
            type="button"
            onClick={() => onAddNew()}
            className="mt-5 py-2.5 px-5 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#8A5CFF] text-white text-xs font-bold shadow-lg shadow-[#4F7CFF]/25 hover:opacity-95 transition cursor-pointer inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            افزودن رمز یا کارت جدید
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredItems.map((item) => {
            const CatIcon = getCategoryIcon(item.category);
            const usesPassword =
              (['login', 'social', 'email'].includes(item.category) && (item.extra?.loginMethod || 'password') === 'password') ||
              (item.category === 'wifi' && (item.extra?.wifiSecurity || 'personal') !== 'open');
            const passStrength = item.password && usesPassword ? CryptoService.evaluateStrength(item.password) : null;
            const legacyCount = legacyViews(toForm(item), item).length;

            return (
              <div
                key={item.id}
                onClick={() => onSelectItem(item)}
                className="group p-4 sm:p-5 rounded-2xl bg-[#121A2C] hover:bg-[#152037] border border-[#1F2B47] hover:border-[#4F7CFF]/50 transition-all shadow-md relative cursor-pointer"
                style={{
                  backgroundColor: 'var(--ui-surface)',
                  borderColor: 'var(--ui-border)',
                }}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0F1524] border border-[#1F2B47] text-[#38E1FF] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
                      <CatIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white group-hover:text-[#38E1FF] transition-colors flex items-center gap-2">
                        {item.title}
                        {item.isFavorite && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-[#94A2C2] whitespace-nowrap" style={{ color: 'var(--ui-text-secondary)' }}>
                          {categoryDef(item.category).label}
                        </span>
                        {item.url && (item.category === 'login' || item.category === 'social' || item.category === 'email') && (
                          <span className="text-[10px] text-[#5D6B8F] truncate max-w-[140px] dir-ltr text-left">
                            {item.url.replace(/^https?:\/\//, '')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Favorite Toggle & Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(item.id);
                      }}
                      className="p-1.5 rounded-lg text-[#94A2C2] hover:text-amber-400 transition cursor-pointer"
                      title={item.isFavorite ? 'حذف از برگزیده‌ها' : 'افزودن به برگزیده‌ها'}
                    >
                      <Star className={`w-4 h-4 ${item.isFavorite ? 'text-amber-400 fill-amber-400' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectItem(item);
                      }}
                      className="p-1.5 rounded-lg text-[#94A2C2] hover:text-white transition cursor-pointer"
                      title="ویرایش"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Content Rows */}
                <div className="mt-3.5 pt-3 border-t border-[#1F2B47]/70 space-y-2 text-xs" style={{ borderColor: 'var(--ui-border)' }}>
                  {renderCategoryRows(item)}
                  {legacyCount > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-300/90 pt-0.5">
                      <History className="w-3 h-3" />
                      {legacyCount} مورد در «اطلاعات قبلی» — برای مشاهده، مورد را باز کنید
                    </div>
                  )}
                </div>

                {/* Footer Pill: Strength or tags */}
                <div className="mt-3 flex items-center justify-between text-[10px]">
                  {passStrength ? (
                    <span className={`px-2 py-0.5 rounded-full bg-[#0F1524] border border-[#1F2B47] font-semibold ${passStrength.color}`} style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
                      امنیت: {passStrength.label}
                    </span>
                  ) : <div />}

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex items-center gap-1">
                      {item.tags.slice(0, 2).map((t, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-[#1F2B47]/60 text-[#94A2C2]">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {qrFor && <WifiQrDialog title={qrFor.title} payload={qrFor.payload} onClose={() => setQrFor(null)} />}

      {/* Floating "+" button: always visible (above the mobile bottom bar, and on desktop) */}
      <button
        type="button"
        onClick={() => onAddNew()}
        className="fixed z-30 left-4 lg:left-8 bottom-[calc(env(safe-area-inset-bottom,0px)+5.25rem)] lg:bottom-8 w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#4F7CFF] to-[#8A5CFF] text-white shadow-2xl shadow-[#4F7CFF]/50 flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition ring-4 ring-[#070A12]"
        aria-label="افزودن رمز جدید"
        title="افزودن رمز جدید"
      >
        <Plus className="w-7 h-7" strokeWidth={2.5} />
      </button>
    </div>
  );
};
