import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Check, 
  X, 
  CreditCard,
  DollarSign,
  TrendingDown
} from 'lucide-react';
import { LoanItem, LoanInstallment, UserProfile } from '../types';
import { LoanService } from '../services/loanService';
import { 
  getCurrentJalali, 
  getJalaliMonthDays, 
  getJalaliMonthStartWeekday, 
  getJalaliMonthName, 
  parseJalali, 
  getDueStatus 
} from '../utils/jalali';

interface GhestCalendarViewProps {
  currentUser: UserProfile;
  loans: LoanItem[];
  onTogglePayment: (loanId: string, installmentNumber: number, trackingCode?: string) => void;
}

const PERSIAN_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const PERSIAN_DAY_FULL = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

export const GhestCalendarView: React.FC<GhestCalendarViewProps> = ({
  currentUser,
  loans,
  onTogglePayment,
}) => {
  const currentJalali = useMemo(() => getCurrentJalali(), []);
  
  const [selectedYear, setSelectedYear] = useState<number>(currentJalali.jy);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentJalali.jm);
  const [selectedDayModal, setSelectedDayModal] = useState<number | null>(null);
  
  // Payment tracking modal for quick payment inside calendar
  const [payingItem, setPayingItem] = useState<{
    loanId: string;
    installmentNumber: number;
    amount: number;
    dueDate: string;
    title: string;
  } | null>(null);
  const [trackingCodeInput, setTrackingCodeInput] = useState('');

  // Handle Month Navigation
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  // Days in selected Jalali month
  const totalDaysInMonth = useMemo(() => {
    return getJalaliMonthDays(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  // Start weekday (0=شنبه, ..., 6=جمعه)
  const startWeekday = useMemo(() => {
    return getJalaliMonthStartWeekday(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  // Map of installments in this month keyed by day (1..31)
  const monthInstallmentsByDay = useMemo(() => {
    const map: {
      [day: number]: {
        loanId: string;
        loanTitle: string;
        lender: string;
        installment: LoanInstallment;
      }[];
    } = {};

    loans.forEach((loan) => {
      (loan.installments || []).forEach((inst) => {
        const parsed = parseJalali(inst.dueDate);
        if (parsed && parsed.jy === selectedYear && parsed.jm === selectedMonth) {
          const d = parsed.jd;
          if (!map[d]) map[d] = [];
          map[d].push({
            loanId: loan.id,
            loanTitle: loan.title,
            lender: loan.lender,
            installment: inst,
          });
        }
      });
    });

    return map;
  }, [loans, selectedYear, selectedMonth]);

  // Month Statistics
  const monthStats = useMemo(() => {
    let totalDue = 0;
    let paidAmount = 0;
    let totalCount = 0;
    let paidCount = 0;

    Object.values(monthInstallmentsByDay).forEach((items) => {
      items.forEach(({ installment }) => {
        totalCount++;
        totalDue += installment.amount;
        if (installment.isPaid) {
          paidCount++;
          paidAmount += installment.amount;
        }
      });
    });

    return {
      totalDue,
      paidAmount,
      remainingAmount: Math.max(0, totalDue - paidAmount),
      totalCount,
      paidCount,
      percent: totalDue > 0 ? Math.round((paidAmount / totalDue) * 100) : 0,
    };
  }, [monthInstallmentsByDay]);

  // Confirm payment
  const handleConfirmPayment = () => {
    if (!payingItem) return;
    onTogglePayment(payingItem.loanId, payingItem.installmentNumber, trackingCodeInput.trim() || undefined);
    setPayingItem(null);
    setTrackingCodeInput('');
  };

  const selectedDayItems = selectedDayModal ? (monthInstallmentsByDay[selectedDayModal] || []) : [];

  return (
    <div className="space-y-6">
      {/* Header & Month Navigation */}
      <div 
        className="p-5 rounded-3xl bg-[#0F1524] border border-[#1F2B47] flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#4F7CFF]/15 border border-[#4F7CFF]/30 flex items-center justify-center">
            <CalendarIcon className="w-6 h-6 text-[#38E1FF]" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black text-white" style={{ color: 'var(--ui-text-primary)' }}>
              گاهشمار و تقویم اقساط
            </h1>
            <p className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>
              نمایش ماهانه سررسیدها بر روی تقویم رسمی شمسی
            </p>
          </div>
        </div>

        {/* Month Selector Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-xl bg-[#070A12] border border-[#1F2B47] text-[#94A2C2] hover:text-white cursor-pointer transition"
            title="ماه قبل"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="px-4 py-2 rounded-xl bg-[#070A12] border border-[#1F2B47] text-sm font-black text-white text-center min-w-[140px]" style={{ color: 'var(--ui-text-primary)' }}>
            <span>{getJalaliMonthName(selectedMonth)}</span>
            <span className="text-[#38E1FF] mr-2 font-mono">{selectedYear}</span>
          </div>

          <button
            onClick={handleNextMonth}
            className="p-2 rounded-xl bg-[#070A12] border border-[#1F2B47] text-[#94A2C2] hover:text-white cursor-pointer transition"
            title="ماه بعد"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              setSelectedYear(currentJalali.jy);
              setSelectedMonth(currentJalali.jm);
            }}
            className="py-2 px-3 rounded-xl bg-[#4F7CFF]/15 hover:bg-[#4F7CFF]/25 border border-[#4F7CFF]/30 text-xs font-bold text-[#38E1FF] cursor-pointer transition"
          >
            ماه جاری
          </button>
        </div>
      </div>

      {/* Monthly Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div 
          className="p-4 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-1"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          <span className="text-xs text-[#94A2C2]">تعداد اقساط این ماه</span>
          <div className="text-base md:text-lg font-black text-white font-mono" style={{ color: 'var(--ui-text-primary)' }}>
            {monthStats.paidCount} از {monthStats.totalCount} قسط
          </div>
        </div>

        <div 
          className="p-4 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-1"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          <span className="text-xs text-[#94A2C2]">کل سررسید ماه</span>
          <div className="text-base md:text-lg font-black text-amber-300 font-mono">
            {LoanService.formatCurrency(monthStats.totalDue)}
          </div>
        </div>

        <div 
          className="p-4 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-1"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          <span className="text-xs text-[#94A2C2]">پرداخت شده این ماه</span>
          <div className="text-base md:text-lg font-black text-emerald-400 font-mono">
            {LoanService.formatCurrency(monthStats.paidAmount)}
          </div>
        </div>

        <div 
          className="p-4 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-1"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          <span className="text-xs text-[#94A2C2]">مانده ماه</span>
          <div className="text-base md:text-lg font-black text-purple-400 font-mono">
            {LoanService.formatCurrency(monthStats.remainingAmount)}
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div 
        className="p-4 md:p-6 rounded-3xl bg-[#0F1524] border border-[#1F2B47] space-y-3"
        style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
      >
        {/* Day Header Row */}
        <div className="grid grid-cols-7 gap-1 md:gap-2 text-center text-xs font-bold text-[#94A2C2] pb-2 border-b border-[#1F2B47]">
          {PERSIAN_DAYS.map((d, idx) => (
            <div key={idx} className={idx === 6 ? 'text-red-400' : ''}>
              <span className="hidden md:inline">{PERSIAN_DAY_FULL[idx]}</span>
              <span className="md:hidden">{d}</span>
            </div>
          ))}
        </div>

        {/* Days Cells Grid */}
        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {/* Empty cells before 1st of month */}
          {Array.from({ length: startWeekday }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[70px] md:min-h-[90px] rounded-xl bg-white/[0.01] border border-transparent opacity-20" />
          ))}

          {/* Days in Month */}
          {Array.from({ length: totalDaysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const isToday =
              currentJalali.jy === selectedYear &&
              currentJalali.jm === selectedMonth &&
              currentJalali.jd === dayNum;

            const dayItems = monthInstallmentsByDay[dayNum] || [];
            const hasInstallments = dayItems.length > 0;
            const hasUnpaid = dayItems.some((x) => !x.installment.isPaid);
            const allPaid = hasInstallments && !hasUnpaid;

            return (
              <div
                key={`day-${dayNum}`}
                onClick={() => hasInstallments && setSelectedDayModal(dayNum)}
                className={`min-h-[70px] md:min-h-[90px] p-1.5 md:p-2 rounded-xl border flex flex-col justify-between transition ${
                  hasInstallments ? 'cursor-pointer hover:border-[#4F7CFF]' : 'cursor-default'
                } ${
                  isToday 
                    ? 'border-[#38E1FF] bg-[#38E1FF]/10 shadow-md shadow-[#38E1FF]/10' 
                    : hasInstallments 
                      ? hasUnpaid 
                        ? 'border-amber-500/30 bg-amber-500/5' 
                        : 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-[#1F2B47]/60 bg-[#070A12]/50 hover:bg-[#070A12]'
                }`}
                style={{
                  backgroundColor: isToday ? undefined : hasInstallments ? undefined : 'var(--ui-surface)',
                  borderColor: isToday ? undefined : undefined,
                }}
              >
                {/* Day Number and Badges */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs md:text-sm font-bold font-mono ${
                    isToday ? 'text-[#38E1FF] font-black' : 'text-white'
                  }`} style={{ color: isToday ? undefined : 'var(--ui-text-primary)' }}>
                    {dayNum}
                  </span>
                  {isToday && (
                    <span className="text-[9px] px-1 py-0.2 rounded-md bg-[#38E1FF] text-black font-bold">
                      امروز
                    </span>
                  )}
                </div>

                {/* Installments in day indicator */}
                {hasInstallments ? (
                  <div className="space-y-1 mt-1">
                    {dayItems.slice(0, 2).map((item, idx) => (
                      <div
                        key={idx}
                        className={`text-[9px] md:text-[10px] truncate px-1 py-0.5 rounded font-medium flex items-center gap-1 ${
                          item.installment.isPaid
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                        title={`${item.loanTitle}: ${LoanService.formatCurrency(item.installment.amount)}`}
                      >
                        {item.installment.isPaid ? (
                          <CheckCircle2 className="w-2.5 h-2.5 shrink-0 text-emerald-400" />
                        ) : (
                          <Clock className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                        )}
                        <span className="truncate">{item.loanTitle}</span>
                      </div>
                    ))}
                    {dayItems.length > 2 && (
                      <div className="text-[9px] text-[#94A2C2] text-center font-bold">
                        +{dayItems.length - 2} قسط دیگر
                      </div>
                    )}
                  </div>
                ) : (
                  <div />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Month Installments Table Listing */}
      <div 
        className="p-5 rounded-3xl bg-[#0F1524] border border-[#1F2B47] space-y-4"
        style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
      >
        <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ color: 'var(--ui-text-primary)' }}>
          <Clock className="w-4 h-4 text-[#4F7CFF]" />
          فهرست سررسیدهای {getJalaliMonthName(selectedMonth)} {selectedYear}
        </h2>

        {Object.keys(monthInstallmentsByDay).length === 0 ? (
          <div className="py-6 text-center text-xs text-[#94A2C2]">
            در این ماه هیچ قسطی ثبت نشده است.
          </div>
        ) : (
          <div className="space-y-2.5">
            {Object.entries(monthInstallmentsByDay)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([day, items]) => (
                <div key={day} className="space-y-2">
                  <div className="text-xs font-bold text-[#38E1FF] flex items-center gap-1.5 pt-1">
                    <span>{day} {getJalaliMonthName(selectedMonth)}:</span>
                  </div>
                  {items.map(({ loanId, loanTitle, lender, installment }) => (
                    <div
                      key={`${loanId}-${installment.number}`}
                      className="p-3 rounded-xl bg-[#070A12] border border-[#1F2B47] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-white flex items-center gap-2" style={{ color: 'var(--ui-text-primary)' }}>
                          <span>{loanTitle}</span>
                          <span className="text-[10px] text-[#94A2C2] bg-white/5 px-2 py-0.5 rounded">
                            قسط شماره {installment.number}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#94A2C2] flex items-center gap-2">
                          <span>وام‌دهنده: {lender}</span>
                          {installment.trackingCode && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-emerald-400">کد رهگیری: {installment.trackingCode}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 justify-between sm:justify-end">
                        <span className="text-xs font-black text-amber-300 font-mono">
                          {LoanService.formatCurrency(installment.amount)}
                        </span>

                        <button
                          onClick={() => {
                            if (installment.isPaid) {
                              onTogglePayment(loanId, installment.number);
                            } else {
                              setPayingItem({
                                loanId,
                                installmentNumber: installment.number,
                                amount: installment.amount,
                                dueDate: installment.dueDate,
                                title: loanTitle,
                              });
                            }
                          }}
                          className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                            installment.isPaid
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                              : 'bg-gradient-to-r from-[#4F7CFF] to-[#6055F6] text-white hover:opacity-95'
                          }`}
                        >
                          {installment.isPaid ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>پرداخت شده</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>ثبت پرداخت</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Selected Day Modal Drawer */}
      {selectedDayModal !== null && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div 
            className="w-full max-w-md p-6 rounded-3xl bg-[#0F1524] border border-[#1F2B47] space-y-4 shadow-2xl"
            style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1F2B47]">
              <div>
                <h3 className="text-sm font-bold text-white" style={{ color: 'var(--ui-text-primary)' }}>
                  اقساط {selectedDayModal} {getJalaliMonthName(selectedMonth)} {selectedYear}
                </h3>
                <span className="text-xs text-[#94A2C2]">
                  {selectedDayItems.length} سررسید در این روز
                </span>
              </div>
              <button
                onClick={() => setSelectedDayModal(null)}
                className="p-1 rounded-lg text-[#94A2C2] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {selectedDayItems.map(({ loanId, loanTitle, lender, installment }) => (
                <div 
                  key={`${loanId}-${installment.number}`}
                  className="p-3.5 rounded-xl bg-[#070A12] border border-[#1F2B47] space-y-2.5"
                  style={{ borderColor: 'var(--ui-border)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white" style={{ color: 'var(--ui-text-primary)' }}>
                      {loanTitle}
                    </span>
                    <span className="text-xs font-mono font-black text-amber-300">
                      {LoanService.formatCurrency(installment.amount)}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#94A2C2]">
                    قسط شماره {installment.number} • وام‌دهنده: {lender}
                  </div>

                  <button
                    onClick={() => {
                      if (installment.isPaid) {
                        onTogglePayment(loanId, installment.number);
                      } else {
                        setPayingItem({
                          loanId,
                          installmentNumber: installment.number,
                          amount: installment.amount,
                          dueDate: installment.dueDate,
                          title: loanTitle,
                        });
                      }
                    }}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      installment.isPaid
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-[#4F7CFF] text-white hover:bg-[#3D64D6]'
                    }`}
                  >
                    {installment.isPaid ? 'تغییر به پرداخت‌نشده' : 'ثبت پرداخت سریع'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Pay Modal with Tracking Code */}
      {payingItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div 
            className="w-full max-w-sm p-6 rounded-3xl bg-[#0F1524] border border-[#1F2B47] space-y-4 shadow-2xl"
            style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2" style={{ color: 'var(--ui-text-primary)' }}>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ثبت پرداخت قسط
              </h3>
              <button onClick={() => setPayingItem(null)} className="text-[#94A2C2] hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-white/5 space-y-1 text-xs">
              <div className="text-white font-bold">{payingItem.title} - قسط {payingItem.installmentNumber}</div>
              <div className="text-amber-300 font-mono font-bold">{LoanService.formatCurrency(payingItem.amount)}</div>
              <div className="text-[11px] text-[#94A2C2]">سررسید: {payingItem.dueDate}</div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                کد پیگیری / شماره ارجاع پرداخت (اختیاری):
              </label>
              <input
                type="text"
                value={trackingCodeInput}
                onChange={(e) => setTrackingCodeInput(e.target.value)}
                placeholder="مثال: ۱۲۳۴۵۶ یا ارجاع بانکی"
                className="w-full bg-[#070A12] border border-[#1F2B47] rounded-xl px-3 py-2.5 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                dir="ltr"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#6055F6] text-white text-xs font-bold hover:opacity-95 transition cursor-pointer"
              >
                تایید و ثبت پرداخت
              </button>
              <button
                type="button"
                onClick={() => setPayingItem(null)}
                className="py-2.5 px-3 rounded-xl bg-white/5 text-[#94A2C2] text-xs font-bold hover:text-white cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
