/**
 * Add / edit form for vault items («گاوصندوق رمزها»).
 * Both paths use the shared definition in src/vault/schema.ts (fields, conditions, validation,
 * mapping to/from stored records), so add and edit can never drift apart.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  KeyRound,
  CreditCard,
  Globe,
  Mail,
  FileText,
  Wifi,
  MapPin,
  Star,
  Sparkles,
  Trash2,
  Save,
  Loader2,
  AlertTriangle,
  Undo2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { VaultItem, ItemCategory, VaultCustomField } from '../types';
import { CryptoService } from '../services/crypto';
import { PasswordGeneratorModal } from './PasswordGeneratorModal';
import { JalaliDatePicker } from './JalaliDatePicker';
import {
  CATEGORIES,
  categoryDef,
  fieldsFor,
  FieldDef,
  FormState,
  emptyForm,
  toForm,
  fromForm,
  applyCategoryDefaults,
  validateForm,
  hasErrors,
  isVisible,
  isRequired,
  legacyViews,
  newlyHiddenValues,
  suggestTitle,
  suggestedProfileUrl,
  suggestedWebmail,
  toLatinDigits,
  snapshot,
  CUSTOM_FIELD_TYPES,
  newCustomField,
  PendingHidden,
  LegacyView,
  FieldIssue,
  IR_BANKS,
  formatCardGroups,
} from '../vault/schema';
import {
  FieldShell,
  SecretInput,
  SecretTextarea,
  TagInput,
  Collapsible,
  CopyButton,
  AddRowButton,
  inputCls,
  inputStyle,
  labelCls,
  labelStyle,
  describedBy,
} from './vault/FormControls';

interface ItemModalProps {
  isOpen: boolean;
  item: VaultItem | null; // null means adding new item
  defaultCategory?: ItemCategory;
  /** All vault items (for linking related accounts). */
  allItems?: VaultItem[];
  onClose: () => void;
  onSave: (savedItem: VaultItem) => void | Promise<void>;
  onDelete?: (id: string) => void;
}

export const CATEGORY_ICONS: Record<ItemCategory, React.FC<{ className?: string }>> = {
  login: KeyRound,
  social: Globe,
  bank: CreditCard,
  email: Mail,
  note: FileText,
  wifi: Wifi,
  address: MapPin,
};

const ACCOUNT_TARGETS: Record<string, ItemCategory[]> = {
  ssoAccountId: ['login', 'email', 'social'],
  bankLoginAccountId: ['login'],
  modemAccountId: ['login'],
};

export const ItemModal: React.FC<ItemModalProps> = ({ isOpen, item, defaultCategory = 'login', allItems = [], onClose, onSave, onDelete }) => {
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultCategory));
  const [initial, setInitial] = useState<FormState>(() => emptyForm(defaultCategory));
  const [titleTouched, setTitleTouched] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [moreOpen, setMoreOpen] = useState(false);
  const [bankAccountOpen, setBankAccountOpen] = useState(false);
  const [mailServersOpen, setMailServersOpen] = useState(false);
  const [legacyOpen, setLegacyOpen] = useState(true);
  const [genTarget, setGenTarget] = useState<string | null>(null);
  const [pendingHidden, setPendingHidden] = useState<PendingHidden[] | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const autoValues = useRef<Record<string, string>>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);

  // (Re)initialise whenever the modal opens or the edited item changes
  useEffect(() => {
    if (!isOpen) return;
    const start = item ? toForm(item) : emptyForm(defaultCategory);
    setForm(start);
    setInitial(start);
    setTitleTouched(!!item);
    setShowErrors(false);
    setTouched(new Set());
    setMoreOpen(false);
    setBankAccountOpen(!!(start.values.accountNumber || start.values.sheba));
    setMailServersOpen(false);
    setLegacyOpen(true);
    setPendingHidden(null);
    setConfirmClose(false);
    setSaving(false);
    setSaveError('');
    savingRef.current = false;
    autoValues.current = {};
    window.setTimeout(() => dialogRef.current?.focus(), 0);
  }, [item, defaultCategory, isOpen]);

  const issues = useMemo(() => validateForm(form, item, item ? initial : null), [form, item, initial]);
  const legacy = useMemo(() => legacyViews(form, item), [form, item]);
  const hiddenTyped = useMemo(() => newlyHiddenValues(form, initial), [form, initial]);
  const isDirty = useMemo(() => snapshot(form) !== snapshot(initial), [form, initial]);
  const cat = categoryDef(form.category);
  const fields = fieldsFor(form.category);
  const CatIcon = CATEGORY_ICONS[form.category];

  const requestClose = useCallback(() => {
    if (savingRef.current) return;
    if (isDirty) setConfirmClose(true);
    else onClose();
  }, [isDirty, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && genTarget === null) {
        e.preventDefault();
        if (confirmClose) setConfirmClose(false);
        else if (pendingHidden) setPendingHidden(null);
        else requestClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, requestClose, confirmClose, pendingHidden, genTarget]);

  if (!isOpen) return null;

  // ------------------------------------------------------------------ state updates
  const withSuggestions = (next: FormState, changedId?: string): FormState => {
    const v = { ...next.values };
    // Platform / provider suggestions never overwrite what the user typed
    if (next.category === 'social' && (changedId === 'handle' || changedId === 'platform')) {
      const s = suggestedProfileUrl(v);
      if (!v.profileUrl || v.profileUrl === autoValues.current.profileUrl) {
        v.profileUrl = s;
        autoValues.current.profileUrl = s;
      }
    }
    if (next.category === 'email' && changedId === 'emailProvider') {
      const s = suggestedWebmail(v);
      if (!v.webmailUrl || v.webmailUrl === autoValues.current.webmailUrl) {
        v.webmailUrl = s;
        autoValues.current.webmailUrl = s;
      }
    }
    let title = next.title;
    if (!item && !titleTouched) title = suggestTitle({ ...next, values: v });
    return { ...next, values: v, title };
  };

  const setValue = (id: string, value: string) => {
    setForm((prev) => withSuggestions({ ...prev, values: { ...prev.values, [id]: value } }, id));
  };

  const setCategory = (c: ItemCategory) => {
    setForm((prev) => withSuggestions(applyCategoryDefaults(prev, c)));
  };

  const markTouched = (id: string) => setTouched((t) => (t.has(id) ? t : new Set(t).add(id)));

  const issueFor = (id: string): FieldIssue | undefined => {
    const i = issues[id];
    if (!i) return undefined;
    if (i.error && !(showErrors || touched.has(id))) return i.warning ? { warning: i.warning } : undefined;
    return i;
  };

  // ------------------------------------------------------------------ save
  const sectionOf = (id: string) => fields.find((f) => f.id === id)?.section;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    if (hasErrors(issues)) {
      setShowErrors(true);
      const errIds = Object.entries(issues).filter(([, i]) => i.error).map(([k]) => k);
      if (errIds.some((k) => k.startsWith('custom:') || sectionOf(k) && sectionOf(k) !== 'main')) setMoreOpen(true);
      if (errIds.some((k) => sectionOf(k) === 'bankAccount')) setBankAccountOpen(true);
      if (errIds.some((k) => sectionOf(k) === 'mailServers')) setMailServersOpen(true);
      window.setTimeout(() => {
        const el = dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        el?.focus();
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 30);
      return;
    }
    if (hiddenTyped.length) {
      setPendingHidden(hiddenTyped);
      return;
    }
    await doSave(true);
  };

  const doSave = async (keepHidden: boolean) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setPendingHidden(null);
    setSaveError('');
    try {
      const record = fromForm(form, item, initial, keepHidden) as VaultItem;
      await onSave(record);
    } catch {
      // The form keeps everything the user entered; no data is logged.
      setSaveError('ذخیره انجام نشد. اطلاعات فرم حفظ شده است؛ دوباره تلاش کنید.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // ------------------------------------------------------------------ field rendering
  const renderField = (f: FieldDef) => {
    if (!isVisible(f, form.values)) return null;
    const id = `vf-${f.id}`;
    const value = form.values[f.id] ?? '';
    const issue = issueFor(f.id);
    const required = isRequired(f, form.values);
    const aria = {
      id,
      'aria-invalid': issue?.error ? (true as const) : undefined,
      'aria-required': required || undefined,
      'aria-describedby': describedBy(id, issue?.error, issue?.warning, f.hint),
      onBlur: () => markTouched(f.id),
    };
    const change = (v: string) => setValue(f.id, f.normalizeDigits ? toLatinDigits(v) : v);
    const shell = (control: React.ReactNode, labelAction?: React.ReactNode, extraHint?: React.ReactNode) => (
      <FieldShell key={f.id} id={id} label={f.label} required={required} hint={f.hint} error={issue?.error} warning={issue?.warning} labelAction={labelAction}>
        {control}
        {extraHint}
      </FieldShell>
    );

    switch (f.kind) {
      case 'select':
        return shell(
          <select {...aria} value={value} onChange={(e) => change(e.target.value)} className={`${inputCls} cursor-pointer`} style={inputStyle}>
            {!f.options?.some((o) => o.value === value) && <option value={value}>{value ? value : 'انتخاب نشده'}</option>}
            {f.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      case 'toggle':
        return (
          <label key={f.id} className="flex items-center gap-2.5 text-xs text-white cursor-pointer select-none">
            <input
              id={id}
              type="checkbox"
              checked={value === 'true'}
              onChange={(e) => change(e.target.checked ? 'true' : '')}
              className="w-4 h-4 accent-[#4F7CFF] cursor-pointer"
            />
            {f.label}
          </label>
        );
      case 'secret': {
        const isPassword = f.id === 'password' || f.id === 'wifiPassword';
        const strength = isPassword && value ? CryptoService.evaluateStrength(value) : null;
        return shell(
          <SecretInput
            {...aria}
            value={value}
            onChange={change}
            revealLabel={f.label}
            inputMode={f.normalizeDigits ? 'numeric' : undefined}
          />,
          isPassword ? (
            <button type="button" onClick={() => setGenTarget(f.id)} className="text-xs text-[#38E1FF] hover:underline flex items-center gap-1 font-medium cursor-pointer">
              <Sparkles className="w-3.5 h-3.5" />
              تولید رمز قوی
            </button>
          ) : undefined,
          <>
            {f.id === 'wifiPassword' && <p className="mt-1 text-[11px] text-[#5D6B8F]">تولید رمز در اینجا، رمز مودم را تغییر نمی‌دهد.</p>}
            {strength && (
              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                <span className="text-[#94A2C2]" style={labelStyle}>
                  امنیت رمز:
                </span>
                <span className={`font-bold ${strength.color}`}>{strength.label}</span>
              </div>
            )}
            {strength?.level === 'weak' && (
              <p className="mt-1 text-[11px] text-amber-300">این رمز ضعیف است؛ ذخیره ممکن است، ولی بهتر است آن را تقویت کنید.</p>
            )}
          </>
        );
      }
      case 'secretMultiline':
        return shell(<SecretTextarea id={id} value={value} onChange={change} label={f.label} ariaDescribedBy={aria['aria-describedby']} />);
      case 'cardNumber':
        return shell(
          <SecretInput {...aria} value={value} onChange={change} revealLabel="شماره کارت" inputMode="numeric" placeholder={f.placeholder} className="tracking-widest" />,
          undefined,
          value ? <p className="mt-1 text-[11px] text-[#5D6B8F] font-mono" dir="ltr">{`${formatCardGroups(value).replace(/\d(?=.{5})/g, '•')}`}</p> : undefined
        );
      case 'multiline':
        return shell(
          <textarea
            {...aria}
            rows={f.id === 'notes' && form.category === 'note' ? 6 : f.id === 'fullAddress' ? 3 : 2}
            value={value}
            onChange={(e) => change(e.target.value)}
            placeholder={f.placeholder}
            dir="auto"
            className={`${inputCls} resize-y`}
            style={inputStyle}
          />
        );
      case 'urlList': {
        const lines = value ? value.split('\n') : [''];
        const setLine = (i: number, v: string) => {
          const next = [...lines];
          next[i] = v;
          change(next.join('\n'));
        };
        return shell(
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  {...(i === 0 ? aria : { onBlur: aria.onBlur, 'aria-label': `${f.label} ${i + 1}` })}
                  type="url"
                  inputMode="url"
                  dir="ltr"
                  value={line}
                  onChange={(e) => setLine(i, e.target.value)}
                  placeholder={f.placeholder}
                  className={`${inputCls} text-left`}
                  style={inputStyle}
                />
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => change(lines.filter((_, j) => j !== i).join('\n'))}
                    className="p-2 rounded-lg text-[#94A2C2] hover:text-rose-400 cursor-pointer shrink-0"
                    aria-label={`حذف آدرس ${i + 1}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <AddRowButton onClick={() => change([...lines, ''].join('\n'))}>افزودن آدرس دیگر</AddRowButton>
          </div>
        );
      }
      case 'account': {
        const targets = ACCOUNT_TARGETS[f.id] || ['login'];
        const options = allItems.filter((it) => it.id !== item?.id && targets.includes(it.category));
        const missing = value && !options.some((o) => o.id === value);
        return shell(
          <select {...aria} value={value} onChange={(e) => change(e.target.value)} className={`${inputCls} cursor-pointer`} style={inputStyle}>
            <option value="">بدون اتصال</option>
            {missing && <option value={value}>(مورد مرتبط پیدا نشد)</option>}
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title} — {categoryDef(o.category).label}
              </option>
            ))}
          </select>,
          undefined,
          options.length === 0 ? <p className="mt-1 text-[11px] text-[#5D6B8F]">هنوز موردی برای اتصال ثبت نشده است.</p> : undefined
        );
      }
      case 'expiry': {
        const calendar = form.values.expiryCalendar;
        return shell(
          <input
            {...aria}
            type="text"
            inputMode="numeric"
            dir="ltr"
            value={value}
            onChange={(e) => change(e.target.value)}
            placeholder={calendar === 'gregorian' ? 'MM/YY — مثال: 05/28' : calendar === 'jalali' ? 'YY/MM — مثال: 07/05' : 'ابتدا نوع تقویم را انتخاب کنید'}
            className={`${inputCls} text-left font-mono`}
            style={inputStyle}
          />,
          undefined,
          <p className="mt-1 text-[11px] text-[#5D6B8F]">
            {calendar === 'jalali' ? 'شمسی، به ترتیب «سال/ماه» مثل روی کارت‌های ایرانی.' : calendar === 'gregorian' ? 'میلادی، به ترتیب «ماه/سال».' : 'تاریخ ذخیره‌شده تبدیل نمی‌شود.'}
          </p>
        );
      }
      default: {
        const ltr = ['url', 'email', 'phone', 'digits'].includes(f.kind) || ['handle', 'identifier', 'emailLoginUsername', 'sheba', 'imapHost', 'smtpHost', 'popHost'].includes(f.id);
        const type = f.kind === 'url' ? 'url' : f.kind === 'email' ? 'email' : f.kind === 'phone' ? 'tel' : 'text';
        const inputMode = f.kind === 'digits' ? 'numeric' : f.kind === 'email' ? 'email' : f.kind === 'phone' ? 'tel' : f.kind === 'url' ? 'url' : undefined;
        const exact = f.kind === 'exact';
        return shell(
          <>
            <input
              {...aria}
              type={type}
              inputMode={inputMode}
              dir={ltr ? 'ltr' : 'auto'}
              value={value}
              onChange={(e) => change(e.target.value)}
              placeholder={f.placeholder}
              autoCapitalize={exact || ltr ? 'off' : undefined}
              autoCorrect={exact || ltr ? 'off' : undefined}
              spellCheck={exact || ltr ? false : undefined}
              list={f.id === 'issuer' ? 'vf-bank-list' : f.id === 'country' ? 'vf-country-list' : undefined}
              className={`${inputCls} ${ltr ? 'text-left' : ''} ${exact ? 'font-mono' : ''}`}
              style={inputStyle}
            />
            {f.id === 'issuer' && (
              <datalist id="vf-bank-list">
                {IR_BANKS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            )}
            {f.id === 'country' && (
              <datalist id="vf-country-list">
                {['ایران', 'ترکیه', 'امارات', 'آلمان', 'کانادا', 'آمریکا', 'انگلستان'].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            )}
          </>
        );
      }
    }
  };

  const bySection = (s: FieldDef['section']) => fields.filter((f) => f.section === s && f.id !== 'notes');
  const notesField = fields.find((f) => f.id === 'notes');
  const notesInMain = notesField?.section === 'main';
  const moreFields = bySection('more');
  const bankAccountFields = bySection('bankAccount');
  const mailFields = bySection('mailServers');
  const filledMore = [...moreFields, ...bankAccountFields, ...mailFields, ...(notesInMain ? [] : notesField ? [notesField] : [])].filter(
    (f) => isVisible(f, form.values) && (form.values[f.id] || '').trim() && f.kind !== 'select'
  ).length + form.tags.length + form.customFields.length;
  const titleSuggestion = !form.title.trim() ? suggestTitle(form) : '';
  const titleIssue = issueFor('title');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-sm"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-form-title"
        tabIndex={-1}
        className="w-full max-w-xl bg-[#121A2C] border border-[#1F2B47] text-[#E7EDFA] rounded-t-2xl sm:rounded-2xl shadow-2xl relative flex flex-col max-h-[calc(100dvh-env(safe-area-inset-top,0px)-0.75rem)] sm:max-h-[calc(100dvh-2rem)] focus:outline-none"
        style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)', color: 'var(--ui-text)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-4 pb-4 border-b border-[#1F2B47] shrink-0" style={{ borderColor: 'var(--ui-border)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#4F7CFF] to-[#8A5CFF] flex items-center justify-center text-white shrink-0">
              {item ? <Save className="w-5 h-5" /> : <CatIcon className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 id="vault-form-title" className="font-bold text-base truncate">
                {item ? cat.editTitle : cat.addTitle}
              </h3>
              <p className="text-xs text-[#94A2C2]" style={labelStyle}>
                رمزگذاری محلی با امنیت بالای AES-256
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, isFavorite: !p.isFavorite }))}
              className={`p-2 rounded-lg transition cursor-pointer ${form.isFavorite ? 'text-amber-400 bg-amber-400/15' : 'text-[#94A2C2] hover:text-white hover:bg-[#182239]'}`}
              aria-pressed={form.isFavorite}
              aria-label={form.isFavorite ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
              title={form.isFavorite ? 'در علاقه‌مندی‌ها — برای حذف بزنید' : 'افزودن به علاقه‌مندی‌ها'}
            >
              <Star className={`w-5 h-5 ${form.isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={requestClose}
              className="p-2 rounded-lg text-[#94A2C2] hover:text-white hover:bg-[#182239] transition cursor-pointer"
              style={labelStyle}
              aria-label="بستن فرم"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col min-h-0 flex-1">
          {/* Scrollable body */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5 space-y-4">
            {/* Category selector */}
            <div>
              <span id="vf-category-label" className={labelCls} style={labelStyle}>
                نوع اطلاعات
              </span>
              <div
                role="radiogroup"
                aria-labelledby="vf-category-label"
                className="grid grid-cols-4 sm:grid-cols-7 gap-1.5"
                onKeyDown={(e) => {
                  const idx = CATEGORIES.findIndex((c) => c.id === form.category);
                  const delta = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0; // RTL
                  if (!delta) return;
                  e.preventDefault();
                  const next = CATEGORIES[(idx + delta + CATEGORIES.length) % CATEGORIES.length];
                  setCategory(next.id);
                  window.setTimeout(() => document.getElementById(`vf-cat-${next.id}`)?.focus(), 0);
                }}
              >
                {CATEGORIES.map((c) => {
                  const Icon = CATEGORY_ICONS[c.id];
                  const selected = form.category === c.id;
                  return (
                    <button
                      key={c.id}
                      id={`vf-cat-${c.id}`}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => setCategory(c.id)}
                      className={`p-2 rounded-xl border text-[11px] font-medium flex flex-col items-center justify-center gap-1 transition cursor-pointer min-h-[3.5rem] ${
                        selected ? 'bg-[#4F7CFF]/15 border-[#4F7CFF] text-[#4F7CFF] shadow-sm' : 'bg-[#0F1524] border-[#1F2B47] text-[#94A2C2] hover:text-white'
                      }`}
                      style={!selected ? inputStyle : {}}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="leading-tight text-center">{c.label}</span>
                    </button>
                  );
                })}
              </div>
              {hiddenTyped.length > 0 && (
                <p className="mt-2 text-[11px] text-amber-300 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {hiddenTyped.length} مقدار واردشده در این حالت نمایش داده نمی‌شود و پاک نشده است؛ هنگام ذخیره می‌پرسیم نگه داشته شود یا نه.
                </p>
              )}
            </div>

            {/* Title */}
            <FieldShell id="vf-title" label={cat.titleLabel} required error={titleIssue?.error} warning={titleIssue?.warning}>
              <input
                id="vf-title"
                type="text"
                dir="auto"
                value={form.title}
                onChange={(e) => {
                  setTitleTouched(true);
                  const t = e.target.value;
                  setForm((p) => ({ ...p, title: t }));
                }}
                onBlur={() => markTouched('title')}
                placeholder={cat.titlePlaceholder}
                aria-required
                aria-invalid={titleIssue?.error ? true : undefined}
                aria-describedby={describedBy('vf-title', titleIssue?.error, titleIssue?.warning)}
                className={inputCls}
                style={inputStyle}
              />
              {titleSuggestion && (
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, title: titleSuggestion }))}
                  className="mt-1.5 text-[11px] text-[#38E1FF] hover:underline cursor-pointer"
                >
                  پیشنهاد: «{titleSuggestion}» — استفاده
                </button>
              )}
            </FieldShell>

            {/* Main fields */}
            {fields.filter((f) => f.section === 'main').map(renderField)}

            {/* More information */}
            <Collapsible title="اطلاعات بیشتر" badge={filledMore ? `${filledMore} مورد` : undefined} open={moreOpen} onToggle={() => setMoreOpen((o) => !o)}>
              {moreFields.map(renderField)}

              {bankAccountFields.length > 0 && (
                <Collapsible title="اطلاعات حساب بانکی مرتبط (اختیاری)" open={bankAccountOpen} onToggle={() => setBankAccountOpen((o) => !o)}>
                  <p className="text-[11px] text-[#5D6B8F]">شماره حساب و شبا از شماره کارت جدا نگه داشته می‌شوند.</p>
                  {bankAccountFields.map(renderField)}
                </Collapsible>
              )}

              {mailFields.length > 0 && (
                <Collapsible title="تنظیمات سرور IMAP / SMTP / POP (اختیاری)" open={mailServersOpen} onToggle={() => setMailServersOpen((o) => !o)}>
                  <p className="text-[11px] text-[#5D6B8F]">برای یک حساب ایمیل معمولی لازم نیست.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{mailFields.map(renderField)}</div>
                </Collapsible>
              )}

              {notesField && !notesInMain && renderField(notesField)}

              <TagInput tags={form.tags} onChange={(tags) => setForm((p) => ({ ...p, tags }))} />

              <CustomFieldsEditor
                fields={form.customFields}
                issues={issues}
                showErrors={showErrors}
                onChange={(customFields) => setForm((p) => ({ ...p, customFields }))}
              />
            </Collapsible>

            {/* Previous / hidden information */}
            {legacy.length > 0 && (
              <Collapsible title="اطلاعات قبلی و پنهان" badge={`${legacy.length} مورد`} open={legacyOpen} onToggle={() => setLegacyOpen((o) => !o)} tone="amber">
                <p className="text-[11px] text-[#94A2C2]" style={labelStyle}>
                  این مقادیر از نسخه قبلی فرم یا از دسته/روش دیگری هستند و در فرم فعلی جایی ندارند. حذف نشده‌اند و تا وقتی خودتان حذفشان نکنید باقی می‌مانند.
                </p>
                <ul className="space-y-2">
                  {legacy.map((lv) => (
                    <LegacyRow key={lv.key} entry={lv} onRemove={() => setForm((p) => ({ ...p, legacyRemovals: [...p.legacyRemovals, lv.key] }))} />
                  ))}
                </ul>
              </Collapsible>
            )}
            {form.legacyRemovals.length > 0 && (
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, legacyRemovals: [] }))}
                className="text-[11px] text-[#38E1FF] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
                بازگرداندن {form.legacyRemovals.length} مورد حذف‌شده از اطلاعات قبلی (تا قبل از ذخیره)
              </button>
            )}
          </div>

          {saveError && (
            <p role="alert" className="mx-5 sm:mx-6 mb-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {saveError}
            </p>
          )}

          {/* Sticky actions */}
          <div
            className="px-5 sm:px-6 pt-3 border-t border-[#1F2B47] flex items-center justify-between gap-3 shrink-0 bg-[#121A2C] rounded-b-2xl"
            style={{ borderColor: 'var(--ui-border)', backgroundColor: 'var(--ui-surface)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
          >
            {item && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('آیا مطمئن هستید که این مورد حذف شود؟')) onDelete(item.id);
                }}
                className="py-2.5 px-3.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                حذف
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={requestClose}
                disabled={saving}
                className="py-2.5 px-4 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-xs text-[#94A2C2] hover:text-white transition cursor-pointer disabled:opacity-50"
                style={inputStyle}
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={saving}
                aria-busy={saving}
                className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#8A5CFF] text-white font-bold text-xs shadow-lg shadow-[#4F7CFF]/20 hover:opacity-95 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'در حال ذخیره…' : 'ذخیره اطلاعات'}
              </button>
            </div>
          </div>
        </form>

        {/* Hidden values typed in this session: keep or discard */}
        {pendingHidden && (
          <InlineDialog title="مقادیری که در این حالت نمایش داده نمی‌شوند" onCancel={() => setPendingHidden(null)}>
            <p className="text-xs text-[#94A2C2]" style={labelStyle}>
              این مقادیر را وارد کرده‌اید ولی به «{cat.label}» یا روش انتخاب‌شده مربوط نیستند:
            </p>
            <ul className="text-xs text-white space-y-1 list-disc pr-5">
              {pendingHidden.map((p) => (
                <li key={p.id}>
                  {p.label}
                  {p.secret ? ' (محرمانه)' : ''}
                </li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button type="button" onClick={() => doSave(true)} className="flex-1 py-2.5 rounded-xl bg-[#4F7CFF] text-white text-xs font-bold cursor-pointer">
                ذخیره و نگه‌داشتن در «اطلاعات قبلی»
              </button>
              <button type="button" onClick={() => doSave(false)} className="flex-1 py-2.5 rounded-xl bg-rose-500/15 text-rose-300 text-xs font-bold cursor-pointer">
                ذخیره بدون این مقادیر
              </button>
              <button type="button" onClick={() => setPendingHidden(null)} className="py-2.5 px-4 rounded-xl bg-white/5 text-[#94A2C2] text-xs cursor-pointer">
                بازگشت
              </button>
            </div>
          </InlineDialog>
        )}

        {/* Unsaved changes guard */}
        {confirmClose && (
          <InlineDialog title="تغییرات ذخیره نشده‌اند" onCancel={() => setConfirmClose(false)}>
            <p className="text-xs text-[#94A2C2]" style={labelStyle}>
              اگر فرم را ببندید، تغییراتی که ذخیره نکرده‌اید از بین می‌روند.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button type="button" autoFocus onClick={() => setConfirmClose(false)} className="flex-1 py-2.5 rounded-xl bg-[#4F7CFF] text-white text-xs font-bold cursor-pointer">
                ادامه ویرایش
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmClose(false);
                  onClose();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-500/15 text-rose-300 text-xs font-bold cursor-pointer"
              >
                بستن بدون ذخیره
              </button>
            </div>
          </InlineDialog>
        )}

        <PasswordGeneratorModal
          isOpen={genTarget !== null}
          onClose={() => setGenTarget(null)}
          onApplyPassword={(genPass) => {
            if (genTarget) setValue(genTarget, genPass);
          }}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
const InlineDialog: React.FC<{ title: string; onCancel: () => void; children: React.ReactNode }> = ({ title, onCancel, children }) => (
  <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/60 rounded-2xl" onClick={onCancel}>
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-sm p-4 rounded-2xl bg-[#121A2C] border border-amber-500/40 shadow-2xl space-y-3"
      style={{ backgroundColor: 'var(--ui-surface)' }}
    >
      <h4 className="text-sm font-bold text-white flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        {title}
      </h4>
      {children}
    </div>
  </div>
);

const LegacyRow: React.FC<{ entry: LegacyView; onRemove: () => void }> = ({ entry, onRemove }) => {
  const [shown, setShown] = useState(false);
  return (
    <li className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-[#0F1524] border border-[#1F2B47]" style={inputStyle}>
      <div className="min-w-0">
        <div className="text-[11px] text-[#94A2C2]" style={labelStyle}>
          {entry.label}
        </div>
        <div className="text-xs text-white font-mono break-all whitespace-pre-wrap" dir="auto">
          {entry.secret && !shown ? '••••••••' : entry.value}
        </div>
      </div>
      <div className="flex items-center shrink-0">
        {entry.secret && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            className="p-1.5 rounded-lg text-[#94A2C2] hover:text-white cursor-pointer"
            aria-label={shown ? `پنهان کردن ${entry.label}` : `نمایش ${entry.label}`}
            aria-pressed={shown}
          >
            {shown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
        <CopyButton text={entry.value} label={entry.label} />
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`«${entry.label}» پس از ذخیره برای همیشه حذف شود؟`)) onRemove();
          }}
          className="p-1.5 rounded-lg text-[#94A2C2] hover:text-rose-400 cursor-pointer"
          aria-label={`حذف ${entry.label}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
};

const CustomFieldsEditor: React.FC<{
  fields: VaultCustomField[];
  issues: Record<string, FieldIssue>;
  showErrors: boolean;
  onChange: (f: VaultCustomField[]) => void;
}> = ({ fields, issues, showErrors, onChange }) => {
  const update = (id: string, patch: Partial<VaultCustomField>) => onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  return (
    <div className="space-y-2.5">
      <div className={labelCls} style={labelStyle}>
        فیلدهای سفارشی (اختیاری)
      </div>
      {fields.map((f, i) => {
        const issue = showErrors ? issues[`custom:${f.id}`] : undefined;
        const valueId = `cf-val-${f.id}`;
        return (
          <div key={f.id} className="p-3 rounded-xl border border-[#1F2B47] space-y-2" style={{ borderColor: 'var(--ui-border)' }}>
            <div className="grid grid-cols-[1fr_auto_auto] gap-1.5 items-end">
              <div>
                <label htmlFor={`cf-name-${f.id}`} className="block text-[11px] text-[#94A2C2] mb-1" style={labelStyle}>
                  نام فیلد {i + 1}
                </label>
                <input
                  id={`cf-name-${f.id}`}
                  value={f.label}
                  onChange={(e) => update(f.id, { label: e.target.value })}
                  aria-invalid={issue?.error && !f.label.trim() ? true : undefined}
                  placeholder="مثال: سؤال امنیتی"
                  className={`${inputCls} py-2 text-xs`}
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor={`cf-type-${f.id}`} className="block text-[11px] text-[#94A2C2] mb-1" style={labelStyle}>
                  نوع
                </label>
                <select
                  id={`cf-type-${f.id}`}
                  value={f.type}
                  onChange={(e) => update(f.id, { type: e.target.value as VaultCustomField['type'] })}
                  className={`${inputCls} py-2 text-xs cursor-pointer`}
                  style={inputStyle}
                >
                  {CUSTOM_FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => onChange(fields.filter((x) => x.id !== f.id))}
                className="p-2.5 rounded-xl text-[#94A2C2] hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                aria-label={`حذف فیلد سفارشی ${f.label || i + 1}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label htmlFor={valueId} className="block text-[11px] text-[#94A2C2] mb-1" style={labelStyle}>
                مقدار
              </label>
              {f.type === 'secret' ? (
                <SecretInput id={valueId} value={f.value} onChange={(v) => update(f.id, { value: v })} revealLabel={f.label || 'مقدار'} />
              ) : f.type === 'multiline' ? (
                <textarea id={valueId} rows={3} dir="auto" value={f.value} onChange={(e) => update(f.id, { value: e.target.value })} className={`${inputCls} resize-y`} style={inputStyle} />
              ) : f.type === 'date' ? (
                <JalaliDatePicker id={valueId} value={f.value} onChange={(v) => update(f.id, { value: v })} className={`${inputCls}`} style={inputStyle} />
              ) : (
                <input
                  id={valueId}
                  type={f.type === 'url' ? 'url' : 'text'}
                  dir={f.type === 'url' ? 'ltr' : 'auto'}
                  inputMode={f.type === 'url' ? 'url' : undefined}
                  value={f.value}
                  onChange={(e) => update(f.id, { value: e.target.value })}
                  placeholder={f.type === 'url' ? 'https://' : ''}
                  aria-invalid={issue?.error ? true : undefined}
                  className={`${inputCls} ${f.type === 'url' ? 'text-left' : ''}`}
                  style={inputStyle}
                />
              )}
              {issue?.error && (
                <p role="alert" className="mt-1 text-[11px] font-semibold text-rose-400">
                  {issue.error}
                </p>
              )}
            </div>
          </div>
        );
      })}
      <AddRowButton onClick={() => onChange([...fields, newCustomField()])}>افزودن فیلد سفارشی</AddRowButton>
    </div>
  );
};
