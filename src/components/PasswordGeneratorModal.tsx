import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  Copy, 
  Check, 
  RefreshCw, 
  X, 
  ShieldCheck, 
  Sliders, 
  Sparkles 
} from 'lucide-react';
import { CryptoService } from '../services/crypto';

interface PasswordGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPassword?: (password: string) => void;
}

export const PasswordGeneratorModal: React.FC<PasswordGeneratorModalProps> = ({
  isOpen,
  onClose,
  onApplyPassword,
}) => {
  const [length, setLength] = useState(16);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [avoidAmbiguous, setAvoidAmbiguous] = useState(true);

  const [generatedPass, setGeneratedPass] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const generate = () => {
    const pass = CryptoService.generatePassword({
      length,
      useUpper,
      useLower,
      useNumbers,
      useSymbols,
      avoidAmbiguous,
    });
    setGeneratedPass(pass);
    setIsCopied(false);
  };

  useEffect(() => {
    if (isOpen) {
      generate();
    }
  }, [isOpen, length, useUpper, useLower, useNumbers, useSymbols, avoidAmbiguous]);

  if (!isOpen) return null;

  const strength = CryptoService.evaluateStrength(generatedPass);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedPass);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Fallback
      setIsCopied(true);
    }
  };

  const handleApply = () => {
    if (onApplyPassword) {
      onApplyPassword(generatedPass);
    }
    onClose();
  };

  const applyPreset = (preset: 'super' | 'readable' | 'pin') => {
    if (preset === 'super') {
      setLength(20);
      setUseUpper(true);
      setUseLower(true);
      setUseNumbers(true);
      setUseSymbols(true);
      setAvoidAmbiguous(true);
    } else if (preset === 'readable') {
      setLength(14);
      setUseUpper(true);
      setUseLower(true);
      setUseNumbers(true);
      setUseSymbols(false);
      setAvoidAmbiguous(true);
    } else if (preset === 'pin') {
      setLength(6);
      setUseUpper(false);
      setUseLower(false);
      setUseNumbers(true);
      setUseSymbols(false);
      setAvoidAmbiguous(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
      }}
    >
      <div 
        className="w-full max-w-md bg-[#121A2C] border border-[#1F2B47] text-[#E7EDFA] rounded-2xl p-6 shadow-2xl relative my-auto max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-2rem)] overflow-y-auto"
        style={{
          backgroundColor: 'var(--ui-surface)',
          borderColor: 'var(--ui-border)',
          color: 'var(--ui-text)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1F2B47]" style={{ borderColor: 'var(--ui-border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#4F7CFF] to-[#8A5CFF] flex items-center justify-center text-white">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">تولیدکننده رمز عبور قدرتمند</h3>
              <p className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>تولید کلیدهای غیرقابل هک با تصادفی‌سازی کریپتو</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#94A2C2] hover:text-white hover:bg-[#182239] transition"
            style={{ color: 'var(--ui-text-secondary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Display Password Box */}
        <div className="mt-5 p-4 rounded-xl bg-[#0F1524] border border-[#1F2B47] relative" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-base sm:text-lg font-bold tracking-wider text-emerald-400 break-all select-all text-left dir-ltr">
              {generatedPass}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={generate}
                className="p-2 rounded-lg text-[#94A2C2] hover:text-white hover:bg-[#1F2B47] transition cursor-pointer"
                title="تولید مجدد"
                style={{ color: 'var(--ui-text-secondary)' }}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="p-2 rounded-lg bg-[#4F7CFF]/15 hover:bg-[#4F7CFF]/25 text-[#4F7CFF] transition cursor-pointer"
                title="کپی کردن"
              >
                {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Strength Meter Bar */}
          <div className="mt-3 pt-3 border-t border-[#1F2B47]/60 flex items-center justify-between text-xs" style={{ borderColor: 'var(--ui-border)' }}>
            <span className="text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>سطح امنیت:</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 rounded-full bg-[#1F2B47] overflow-hidden" style={{ backgroundColor: 'var(--ui-border)' }}>
                <div 
                  className={`h-full transition-all duration-300 ${
                    strength.level === 'weak' ? 'bg-rose-500' :
                    strength.level === 'medium' ? 'bg-amber-500' :
                    strength.level === 'strong' ? 'bg-blue-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${strength.score}%` }}
                />
              </div>
              <span className={`font-bold ${strength.color}`}>{strength.label}</span>
            </div>
          </div>
        </div>

        {/* Presets */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => applyPreset('super')}
            className="flex-1 py-1.5 px-2 rounded-lg bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-xs text-white font-medium transition cursor-pointer"
            style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
          >
            فوق‌العاده امن (۲۰)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('readable')}
            className="flex-1 py-1.5 px-2 rounded-lg bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-xs text-white font-medium transition cursor-pointer"
            style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
          >
            حروف و ارقام (۱۴)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('pin')}
            className="flex-1 py-1.5 px-2 rounded-lg bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-xs text-white font-medium transition cursor-pointer"
            style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
          >
            پین عددی (۶)
          </button>
        </div>

        {/* Sliders & Checkboxes */}
        <div className="mt-5 space-y-3.5">
          {/* Length Slider */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>طول رمز:</span>
              <span className="font-mono font-bold text-white px-2 py-0.5 rounded bg-[#0F1524] border border-[#1F2B47]" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
                {length} کاراکتر
              </span>
            </div>
            <input
              type="range"
              min={6}
              max={36}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="w-full accent-[#4F7CFF] cursor-pointer"
            />
          </div>

          {/* Options Toggles */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex items-center gap-2 p-2 rounded-lg bg-[#0F1524] border border-[#1F2B47] cursor-pointer" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
              <input
                type="checkbox"
                checked={useUpper}
                onChange={(e) => setUseUpper(e.target.checked)}
                className="accent-[#4F7CFF] rounded"
              />
              <span>حروف بزرگ (A-Z)</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-lg bg-[#0F1524] border border-[#1F2B47] cursor-pointer" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
              <input
                type="checkbox"
                checked={useLower}
                onChange={(e) => setUseLower(e.target.checked)}
                className="accent-[#4F7CFF] rounded"
              />
              <span>حروف کوچک (a-z)</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-lg bg-[#0F1524] border border-[#1F2B47] cursor-pointer" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
              <input
                type="checkbox"
                checked={useNumbers}
                onChange={(e) => setUseNumbers(e.target.checked)}
                className="accent-[#4F7CFF] rounded"
              />
              <span>اعداد (0-9)</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-lg bg-[#0F1524] border border-[#1F2B47] cursor-pointer" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
              <input
                type="checkbox"
                checked={useSymbols}
                onChange={(e) => setUseSymbols(e.target.checked)}
                className="accent-[#4F7CFF] rounded"
              />
              <span>علائم خاص (!@#$)</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center gap-2.5">
          {onApplyPassword && (
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#8A5CFF] text-white font-bold text-xs shadow-lg shadow-[#4F7CFF]/20 hover:opacity-95 transition cursor-pointer"
            >
              استفاده از این رمز در فیلد
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-white font-medium text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
            style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {isCopied ? 'کپی شد!' : 'کپی در کلیپ‌بورد'}
          </button>
        </div>
      </div>
    </div>
  );
};
