/**
 * Small accessible building blocks for the vault item form (same look as the existing form).
 */
import React, { useId, useState } from 'react';
import { Eye, EyeOff, X, Plus, ChevronDown, Copy, Check } from 'lucide-react';

export const inputCls =
  'w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF] focus:ring-1 focus:ring-[#4F7CFF] transition';
export const inputStyle: React.CSSProperties = { backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' };
export const labelCls = 'block text-xs font-semibold text-[#94A2C2] mb-1.5';
export const labelStyle: React.CSSProperties = { color: 'var(--ui-text-secondary)' };

interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  warning?: string;
  labelAction?: React.ReactNode;
  children: React.ReactNode;
}

/** Label + control + hint/error, wired with aria-describedby. */
export const FieldShell: React.FC<FieldShellProps> = ({ id, label, required, hint, error, warning, labelAction, children }) => (
  <div data-field={id}>
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-[#94A2C2]" style={labelStyle}>
        {label}
        {required && <span className="text-rose-400 mr-0.5" aria-hidden="true"> *</span>}
      </label>
      {labelAction}
    </div>
    {children}
    {hint && !error && (
      <p id={`${id}-hint`} className="mt-1 text-[11px] text-[#5D6B8F]">
        {hint}
      </p>
    )}
    {error && (
      <p id={`${id}-error`} role="alert" className="mt-1 text-[11px] font-semibold text-rose-400">
        {error}
      </p>
    )}
    {!error && warning && (
      <p id={`${id}-warning`} className="mt-1 text-[11px] text-amber-300">
        {warning}
      </p>
    )}
  </div>
);

export const describedBy = (id: string, error?: string, warning?: string, hint?: string) =>
  [error ? `${id}-error` : '', !error && warning ? `${id}-warning` : '', hint && !error ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;

interface SecretInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string;
  onChange: (v: string) => void;
  revealLabel?: string;
}

/** Masked input with an accessible show/hide button. The value is never altered. */
export const SecretInput: React.FC<SecretInputProps> = ({ value, onChange, revealLabel = 'رمز', className = '', ...rest }) => {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        {...rest}
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir="ltr"
        autoComplete="new-password"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className={`${inputCls} text-left font-mono pr-11 ${className}`}
        style={inputStyle}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#94A2C2] hover:text-white cursor-pointer"
        aria-label={shown ? `پنهان کردن ${revealLabel}` : `نمایش ${revealLabel}`}
        aria-pressed={shown}
        title={shown ? 'پنهان کردن' : 'نمایش'}
      >
        {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};

/** Multi-line secret (e.g. recovery codes): hidden until the user asks to show it. */
export const SecretTextarea: React.FC<{ id: string; value: string; onChange: (v: string) => void; label: string; ariaDescribedBy?: string }> = ({
  id,
  value,
  onChange,
  label,
  ariaDescribedBy,
}) => {
  const [shown, setShown] = useState(!value);
  const lines = value.split('\n').filter((l) => l.trim()).length;
  return (
    <div className="space-y-1.5">
      {shown ? (
        <textarea
          id={id}
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir="ltr"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={ariaDescribedBy}
          className={`${inputCls} font-mono text-left resize-y`}
          style={inputStyle}
        />
      ) : (
        <div id={id} tabIndex={-1} className={`${inputCls} text-[#94A2C2] font-mono`} style={inputStyle}>
          {'•'.repeat(10)} <span className="font-sans text-[11px]">({lines} مورد ذخیره شده)</span>
        </div>
      )}
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-pressed={shown}
        aria-controls={id}
        className="text-[11px] text-[#38E1FF] hover:underline cursor-pointer flex items-center gap-1"
      >
        {shown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        {shown ? `پنهان کردن ${label}` : `نمایش و ویرایش ${label}`}
      </button>
    </div>
  );
};

/** Tags as removable chips; Enter, comma or «،» adds. Pasting "a، b, c" adds all. */
export const TagInput: React.FC<{ tags: string[]; onChange: (t: string[]) => void }> = ({ tags, onChange }) => {
  const id = useId();
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const parts = raw.split(/[,،]/).map((t) => t.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...tags];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setDraft('');
  };
  return (
    <div>
      <label htmlFor={id} className={labelCls} style={labelStyle}>
        برچسب‌ها (اختیاری)
      </label>
      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-[#1F2B47] bg-[#0F1524]" style={inputStyle}>
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-lg bg-[#4F7CFF]/15 text-[#AFC2FF] text-xs">
            {t}
            <button
              type="button"
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="p-0.5 rounded hover:bg-white/10 cursor-pointer"
              aria-label={`حذف برچسب ${t}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (/[,،]/.test(v)) add(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && !draft && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => add(draft)}
          placeholder={tags.length ? 'برچسب دیگر…' : 'مثال: شخصی، کاری'}
          className="flex-1 min-w-[8rem] bg-transparent text-xs text-white placeholder-[#5D6B8F] focus:outline-none py-1"
          aria-describedby={`${id}-hint`}
        />
      </div>
      <p id={`${id}-hint`} className="mt-1 text-[11px] text-[#5D6B8F]">
        با Enter یا ویرگول اضافه کنید.
      </p>
    </div>
  );
};

/** Collapsible group with a real button (keyboard + screen reader friendly). */
export const Collapsible: React.FC<{ title: string; badge?: string; open: boolean; onToggle: () => void; children: React.ReactNode; tone?: 'default' | 'amber' }> = ({
  title,
  badge,
  open,
  onToggle,
  children,
  tone = 'default',
}) => {
  const id = useId();
  return (
    <div className={`rounded-xl border ${tone === 'amber' ? 'border-amber-500/30' : 'border-[#1F2B47]'}`} style={tone === 'amber' ? undefined : { borderColor: 'var(--ui-border)' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={id}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-3 text-xs font-bold text-white cursor-pointer rounded-xl hover:bg-white/[0.03]"
      >
        <span className="flex items-center gap-2">
          {title}
          {badge && <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${tone === 'amber' ? 'bg-amber-500/15 text-amber-300' : 'bg-white/5 text-[#94A2C2]'}`}>{badge}</span>}
        </span>
        <ChevronDown className={`w-4 h-4 text-[#94A2C2] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={id} className="px-3.5 pb-3.5 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
};

/** Copy button with a short "copied" state. */
export const CopyButton: React.FC<{ text: string; label: string; onCopied?: () => void; className?: string }> = ({ text, label, onCopied, className = '' }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          /* clipboard unavailable */
        }
        setDone(true);
        onCopied?.();
        window.setTimeout(() => setDone(false), 1500);
      }}
      className={`p-1.5 rounded-lg text-[#94A2C2] hover:text-[#38E1FF] cursor-pointer ${className}`}
      aria-label={`کپی ${label}`}
      title={`کپی ${label}`}
    >
      {done ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

export const AddRowButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button type="button" onClick={onClick} className="text-xs text-[#38E1FF] hover:underline flex items-center gap-1 cursor-pointer">
    <Plus className="w-3.5 h-3.5" />
    {children}
  </button>
);
