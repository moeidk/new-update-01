import React, { useState, useEffect } from 'react';
import { 
  X, 
  KeyRound, 
  CreditCard, 
  Globe, 
  Mail, 
  FileText, 
  Wifi, 
  Star, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Trash2, 
  Save, 
  Check, 
  Copy,
  ExternalLink
} from 'lucide-react';
import { VaultItem, ItemCategory } from '../types';
import { CryptoService } from '../services/crypto';
import { PasswordGeneratorModal } from './PasswordGeneratorModal';

interface ItemModalProps {
  isOpen: boolean;
  item: VaultItem | null; // null means adding new item
  defaultCategory?: ItemCategory;
  onClose: () => void;
  onSave: (savedItem: VaultItem) => void;
  onDelete?: (id: string) => void;
}

const CATEGORIES: { id: ItemCategory; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'login', label: 'ورود به حساب', icon: KeyRound },
  { id: 'social', label: 'شبکه‌های اجتماعی', icon: Globe },
  { id: 'bank', label: 'کارت و حساب بانکی', icon: CreditCard },
  { id: 'email', label: 'پست الکترونیک (ایمیل)', icon: Mail },
  { id: 'note', label: 'یادداشت امن', icon: FileText },
  { id: 'wifi', label: 'وای‌فای و شبکه', icon: Wifi },
];

export const ItemModal: React.FC<ItemModalProps> = ({
  isOpen,
  item,
  defaultCategory = 'login',
  onClose,
  onSave,
  onDelete,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ItemCategory>(defaultCategory);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');

  // Banking specific
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cvv2, setCvv2] = useState('');
  const [expireDate, setExpireDate] = useState('');
  const [pin, setPin] = useState('');

  const [isFavorite, setIsFavorite] = useState(false);
  const [tagsInput, setTagsInput] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showGenModal, setShowGenModal] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setCategory(item.category || 'login');
      setUsername(item.username || '');
      setPassword(item.password || '');
      setUrl(item.url || '');
      setNotes(item.notes || '');
      setCardNumber(item.cardNumber || '');
      setCardHolder(item.cardHolder || '');
      setCvv2(item.cvv2 || '');
      setExpireDate(item.expireDate || '');
      setPin(item.pin || '');
      setIsFavorite(item.isFavorite || false);
      setTagsInput(item.tags ? item.tags.join('، ') : '');
    } else {
      setTitle('');
      setCategory(defaultCategory);
      setUsername('');
      setPassword('');
      setUrl('');
      setNotes('');
      setCardNumber('');
      setCardHolder('');
      setCvv2('');
      setExpireDate('');
      setPin('');
      setIsFavorite(false);
      setTagsInput('');
    }
  }, [item, defaultCategory, isOpen]);

  if (!isOpen) return null;

  const strength = CryptoService.evaluateStrength(password);

  const formatCardNumber = (value: string) => {
    // Only numbers, format as XXXX XXXX XXXX XXXX
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardNumber(formatCardNumber(e.target.value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const now = new Date().toISOString();
    const tags = tagsInput
      ? tagsInput
          .split(/[,،]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const updatedItem: VaultItem = {
      id: item ? item.id : 'item-' + Date.now(),
      title: title.trim(),
      category,
      username: username.trim(),
      password,
      url: url.trim(),
      notes: notes.trim(),
      cardNumber: cardNumber.trim(),
      cardHolder: cardHolder.trim(),
      cvv2: cvv2.trim(),
      expireDate: expireDate.trim(),
      pin: pin.trim(),
      isFavorite,
      tags,
      createdAt: item ? item.createdAt : now,
      updatedAt: now,
    };

    onSave(updatedItem);
  };

  const handleQuickCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      setIsCopied(true);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
      }}
    >
      <div 
        className="w-full max-w-xl bg-[#121A2C] border border-[#1F2B47] text-[#E7EDFA] rounded-2xl p-5 sm:p-6 shadow-2xl relative my-auto max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-2rem)] overflow-y-auto"
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
              {item ? <Save className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base">{item ? 'ویرایش اطلاعات' : 'افزودن رمز یا حساب جدید'}</h3>
              <p className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>رمزگذاری محلی با امنیت بالای AES-256</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsFavorite(!isFavorite)}
              className={`p-2 rounded-lg transition cursor-pointer ${
                isFavorite ? 'text-amber-400 bg-amber-400/15' : 'text-[#94A2C2] hover:text-white hover:bg-[#182239]'
              }`}
              title={isFavorite ? 'نشان شده در برگزیده‌ها' : 'افزودن به برگزیده‌ها'}
            >
              <Star className={`w-5 h-5 ${isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-[#94A2C2] hover:text-white hover:bg-[#182239] transition cursor-pointer"
              style={{ color: 'var(--ui-text-secondary)' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Category Chips Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#94A2C2] mb-1.5" style={{ color: 'var(--ui-text-secondary)' }}>
              نوع داده / دسته‌بندی
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-2 rounded-xl border text-[11px] font-medium flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#4F7CFF]/15 border-[#4F7CFF] text-[#4F7CFF] shadow-sm'
                        : 'bg-[#0F1524] border-[#1F2B47] text-[#94A2C2] hover:text-white'
                    }`}
                    style={!isSelected ? { backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' } : {}}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span className="truncate max-w-full">{cat.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title Field */}
          <div>
            <label className="block text-xs font-semibold text-[#94A2C2] mb-1.5" style={{ color: 'var(--ui-text-secondary)' }}>
              عنوان حساب یا کارت *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: اینستاگرام شخصی، کارت بانک ملت، جیمیل و..."
              className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF] focus:ring-1 focus:ring-[#4F7CFF] transition"
              style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
              required
            />
          </div>

          {/* Banking Special Fields */}
          {category === 'bank' && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-[#121A2C] to-[#0F1524] border border-[#4F7CFF]/30 space-y-3" style={{ borderColor: 'var(--ui-border-strong)' }}>
              <div className="flex items-center gap-2 text-xs font-bold text-[#38E1FF]">
                <CreditCard className="w-4 h-4" />
                اطلاعات کارت شتاب / بانکی
              </div>

              <div>
                <label className="block text-[11px] text-[#94A2C2] mb-1" style={{ color: 'var(--ui-text-secondary)' }}>
                  شماره ۱۶ رقمی کارت
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  placeholder="6037 9975 1234 5678"
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-3.5 py-2.5 text-sm font-mono text-white text-center tracking-widest placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                  style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] text-[#94A2C2] mb-1" style={{ color: 'var(--ui-text-secondary)' }}>
                    کد CVV2
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={cvv2}
                    onChange={(e) => setCvv2(e.target.value)}
                    placeholder="123"
                    className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-3 py-2 text-sm font-mono text-white text-center focus:outline-none focus:border-[#4F7CFF]"
                    style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#94A2C2] mb-1" style={{ color: 'var(--ui-text-secondary)' }}>
                    تاریخ انقضا (ماه/سال)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={expireDate}
                    onChange={(e) => setExpireDate(e.target.value)}
                    placeholder="07/28"
                    className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-3 py-2 text-sm font-mono text-white text-center focus:outline-none focus:border-[#4F7CFF]"
                    style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] text-[#94A2C2] mb-1" style={{ color: 'var(--ui-text-secondary)' }}>
                    رمز دوم / پین
                  </label>
                  <input
                    type="password"
                    dir="ltr"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="••••"
                    className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-3 py-2 text-sm font-mono text-white text-center focus:outline-none focus:border-[#4F7CFF]"
                    style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Username / Email / Account ID (for non-notes) */}
          {category !== 'note' && (
            <div>
              <label className="block text-xs font-semibold text-[#94A2C2] mb-1.5" style={{ color: 'var(--ui-text-secondary)' }}>
                {category === 'wifi' ? 'نام شبکه وای‌فای (SSID)' : 'نام کاربری / ایمیل / شماره موبایل'}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={category === 'wifi' ? 'Home-WiFi-5G' : 'username یا email@example.com'}
                className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF] transition dir-ltr text-left"
                style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
              />
            </div>
          )}

          {/* Password Field (for non-notes) */}
          {category !== 'note' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>
                  رمز عبور (Password)
                </label>
                <button
                  type="button"
                  onClick={() => setShowGenModal(true)}
                  className="text-xs text-[#38E1FF] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  تولید رمز قوی
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="رمز عبور خود را وارد کنید..."
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF] transition dir-ltr text-left font-mono"
                  style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A2C2] hover:text-white p-1"
                  style={{ color: 'var(--ui-text-secondary)' }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password strength mini pill */}
              {password && (
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>امنیت رمز:</span>
                  <span className={`font-bold ${strength.color}`}>{strength.label}</span>
                </div>
              )}
            </div>
          )}

          {/* Website URL (for logins/socials) */}
          {(category === 'login' || category === 'social' || category === 'email') && (
            <div>
              <label className="block text-xs font-semibold text-[#94A2C2] mb-1.5" style={{ color: 'var(--ui-text-secondary)' }}>
                آدرس وب‌سایت یا اپلیکیشن (URL)
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-3.5 py-2 text-sm text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF] dir-ltr text-left"
                style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
              />
            </div>
          )}

          {/* Notes Field */}
          <div>
            <label className="block text-xs font-semibold text-[#94A2C2] mb-1.5" style={{ color: 'var(--ui-text-secondary)' }}>
              {category === 'note' ? 'متن یادداشت محرمانه *' : 'توضیحات و یادداشت تکمیلی (اختیاری)'}
            </label>
            <textarea
              rows={category === 'note' ? 5 : 2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="نکات امنیتی، کدهای بازیابی ۲ مرحله‌ای، پاسخ سوالات امنیتی و..."
              className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl p-3 text-sm text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF] resize-none"
              style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-[#94A2C2] mb-1.5" style={{ color: 'var(--ui-text-secondary)' }}>
              برچسب‌ها (با ویرگول جدا کنید)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="شخصی، کاری، دانشگاه، مهم"
              className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-3 py-2 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
              style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#1F2B47] flex items-center justify-between gap-3" style={{ borderColor: 'var(--ui-border)' }}>
            {item && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('آیا مطمئن هستید که این مورد حذف شود؟')) {
                    onDelete(item.id);
                  }
                }}
                className="py-2.5 px-3.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                حذف
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-xs text-[#94A2C2] hover:text-white transition cursor-pointer"
                style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
              >
                انصراف
              </button>
              <button
                type="submit"
                className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#8A5CFF] text-white font-bold text-xs shadow-lg shadow-[#4F7CFF]/20 hover:opacity-95 transition cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                ذخیره اطلاعات
              </button>
            </div>
          </div>
        </form>

        {/* Embedded Password Generator modal trigger */}
        <PasswordGeneratorModal
          isOpen={showGenModal}
          onClose={() => setShowGenModal(false)}
          onApplyPassword={(genPass) => {
            setPassword(genPass);
          }}
        />
      </div>
    </div>
  );
};
