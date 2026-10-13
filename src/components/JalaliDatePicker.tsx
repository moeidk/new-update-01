/**
 * src/components/JalaliDatePicker.tsx
 * Persian (Jalali/Shamsi) date picker. Tapping the field opens a calendar sheet instead of
 * requiring the user to type "1404/07/10" by hand. Value format stays "YYYY/MM/DD".
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronRight, ChevronLeft, X } from 'lucide-react';
import {
  getCurrentJalali,
  getJalaliMonthDays,
  getJalaliMonthName,
  getJalaliMonthStartWeekday,
  parseJalali,
} from '../utils/jalali';

interface JalaliDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

const WEEKDAY_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const pad = (n: number) => String(n).padStart(2, '0');
const format = (jy: number, jm: number, jd: number) => `${jy}/${pad(jm)}/${pad(jd)}`;

export function formatJalaliLong(value: string): string {
  const p = parseJalali(value);
  if (!p || p.jm < 1 || p.jm > 12) return value;
  return `${p.jd} ${getJalaliMonthName(p.jm)} ${p.jy}`;
}

export const JalaliDatePicker: React.FC<JalaliDatePickerProps> = ({
  value,
  onChange,
  required,
  placeholder = 'انتخاب تاریخ',
  className = '',
  style,
  id,
}) => {
  const today = getCurrentJalali();
  const selected = parseJalali(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected?.jy ?? today.jy);
  const [viewMonth, setViewMonth] = useState(selected?.jm ?? today.jm);
  const [pickYear, setPickYear] = useState(false);

  useEffect(() => {
    if (!open) return;
    const s = parseJalali(value);
    setViewYear(s?.jy ?? today.jy);
    setViewMonth(s && s.jm >= 1 && s.jm <= 12 ? s.jm : today.jm);
    setPickYear(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const shiftMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  };

  const choose = (jd: number) => {
    onChange(format(viewYear, viewMonth, jd));
    setOpen(false);
  };

  const daysInMonth = getJalaliMonthDays(viewYear, viewMonth);
  const lead = getJalaliMonthStartWeekday(viewYear, viewMonth); // 0 = شنبه
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const years = Array.from({ length: 31 }, (_, i) => today.jy - 15 + i);

  const sheet = open
    ? createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          dir="rtl"
        >
          <div
            role="dialog"
            aria-label="انتخاب تاریخ شمسی"
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:w-[340px] rounded-t-3xl sm:rounded-3xl bg-[#121A2C] border border-[#1F2B47] shadow-2xl p-4 text-white"
            style={{
              backgroundColor: 'var(--ui-surface)',
              borderColor: 'var(--ui-border)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="p-2 rounded-xl hover:bg-white/10 cursor-pointer"
                aria-label="ماه قبل"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setPickYear((v) => !v)}
                className="px-3 py-1.5 rounded-xl hover:bg-white/10 font-bold text-sm cursor-pointer"
              >
                {getJalaliMonthName(viewMonth)} {viewYear}
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="p-2 rounded-xl hover:bg-white/10 cursor-pointer"
                aria-label="ماه بعد"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>

            {pickYear ? (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-1.5 max-h-56 overflow-y-auto">
                  {years.map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => {
                        setViewYear(y);
                        setPickYear(false);
                      }}
                      className={`py-2 rounded-xl text-xs font-bold tabular-nums cursor-pointer ${
                        y === viewYear ? 'bg-[#4F7CFF] text-white' : 'hover:bg-white/10 text-[#C9D3EA]'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setViewMonth(m);
                        setPickYear(false);
                      }}
                      className={`py-2 rounded-xl text-[11px] font-bold cursor-pointer ${
                        m === viewMonth ? 'bg-[#4F7CFF]/30 text-white' : 'hover:bg-white/10 text-[#C9D3EA]'
                      }`}
                    >
                      {getJalaliMonthName(m)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {WEEKDAY_SHORT.map((d, i) => (
                    <div key={d} className={`text-center text-[11px] font-bold py-1 ${i === 6 ? 'text-rose-400' : 'text-[#94A2C2]'}`}>
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {cells.map((d, i) => {
                    if (d === null) return <div key={`e${i}`} />;
                    const isSelected = selected && selected.jy === viewYear && selected.jm === viewMonth && selected.jd === d;
                    const isToday = today.jy === viewYear && today.jm === viewMonth && today.jd === d;
                    const isFriday = i % 7 === 6;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => choose(d)}
                        className={`h-10 rounded-xl text-sm font-bold tabular-nums cursor-pointer transition ${
                          isSelected
                            ? 'bg-[#4F7CFF] text-white shadow-lg shadow-[#4F7CFF]/30'
                            : isToday
                              ? 'border border-[#38E1FF]/60 text-[#38E1FF]'
                              : isFriday
                                ? 'text-rose-300 hover:bg-white/10'
                                : 'text-white hover:bg-white/10'
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="flex items-center justify-between mt-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  onChange(today.str);
                  setOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#4F7CFF]/15 text-[#7FA0FF] text-xs font-bold hover:bg-[#4F7CFF]/25 cursor-pointer"
              >
                امروز ({today.str})
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-[#C9D3EA] cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> بستن
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        type="button"
        id={id}
        onClick={() => setOpen(true)}
        className={`w-full flex items-center justify-between gap-2 text-right cursor-pointer ${className}`}
        style={style}
        aria-haspopup="dialog"
      >
        <span className={value ? 'text-white' : 'text-[#5D6B8F]'}>
          {value ? formatJalaliLong(value) : placeholder}
        </span>
        <span className="flex items-center gap-1.5 shrink-0 text-[#94A2C2]">
          {value && <span className="font-mono text-[11px] tabular-nums" dir="ltr">{value}</span>}
          <CalendarDays className="w-4 h-4 text-[#4F7CFF]" />
        </span>
      </button>
      {/* Keeps native "required" validation working inside forms */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => {}}
          className="sr-only"
        />
      )}
      {sheet}
    </>
  );
};
