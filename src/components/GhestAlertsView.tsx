import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Check, 
  Calendar, 
  Volume2, 
  ShieldAlert, 
  Sparkles,
  X
} from 'lucide-react';
import { LoanItem, LoanInstallment, UserProfile } from '../types';
import { LoanService } from '../services/loanService';
import { getDueStatus, compareJalaliDates, getCurrentJalali } from '../utils/jalali';

interface GhestAlertsViewProps {
  currentUser: UserProfile;
  loans: LoanItem[];
  onTogglePayment: (loanId: string, installmentNumber: number, trackingCode?: string) => void;
}

export const GhestAlertsView: React.FC<GhestAlertsViewProps> = ({
  currentUser,
  loans,
  onTogglePayment,
}) => {
  const currentJalali = useMemo(() => getCurrentJalali(), []);
  const [notificationStatus, setNotificationStatus] = useState<string>(() => {
    return 'Notification' in window ? Notification.permission : 'unsupported';
  });
  const [testNotificationMsg, setTestNotificationMsg] = useState('');

  // Payment Tracking Modal
  const [payingItem, setPayingItem] = useState<{
    loanId: string;
    installmentNumber: number;
    amount: number;
    dueDate: string;
    title: string;
  } | null>(null);
  const [trackingCodeInput, setTrackingCodeInput] = useState('');

  // Categorize unpaid installments
  const alertsData = useMemo(() => {
    const overdue: { loan: LoanItem; installment: LoanInstallment; daysLate: number }[] = [];
    const today: { loan: LoanItem; installment: LoanInstallment }[] = [];
    const within3Days: { loan: LoanItem; installment: LoanInstallment; daysLeft: number }[] = [];
    const within7Days: { loan: LoanItem; installment: LoanInstallment; daysLeft: number }[] = [];
    const withinMonth: { loan: LoanItem; installment: LoanInstallment; daysLeft: number }[] = [];

    loans.forEach((loan) => {
      (loan.installments || []).forEach((inst) => {
        if (!inst.isPaid) {
          const diff = compareJalaliDates(inst.dueDate); // negative = past
          if (diff < 0) {
            overdue.push({ loan, installment: inst, daysLate: Math.abs(diff) });
          } else if (diff === 0) {
            today.push({ loan, installment: inst });
          } else if (diff <= 3) {
            within3Days.push({ loan, installment: inst, daysLeft: diff });
          } else if (diff <= 7) {
            within7Days.push({ loan, installment: inst, daysLeft: diff });
          } else if (diff <= 30) {
            withinMonth.push({ loan, installment: inst, daysLeft: diff });
          }
        }
      });
    });

    // Sort overdue by most late
    overdue.sort((a, b) => b.daysLate - a.daysLate);
    within3Days.sort((a, b) => a.daysLeft - b.daysLeft);
    within7Days.sort((a, b) => a.daysLeft - b.daysLeft);

    const totalUrgent = overdue.length + today.length + within3Days.length;

    return {
      overdue,
      today,
      within3Days,
      within7Days,
      withinMonth,
      totalUrgent,
    };
  }, [loans]);

  // Request notification permission
  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) {
      setTestNotificationMsg('مرورگر شما از اعلان‌ها پشتیبانی نمی‌کند.');
      return;
    }
    const perm = await Notification.requestPermission();
    setNotificationStatus(perm);
    if (perm === 'granted') {
      new Notification('سامانه اقساط KeepPass', {
        body: 'یادآور سررسید اقساط فعال شد! شما قبل از هر سررسید مطلع خواهید شد.',
        icon: '/favicon.ico',
      });
      setTestNotificationMsg('اعلان‌های مرورگر با موفقیت فعال شدند!');
    }
  };

  const handleConfirmPayment = () => {
    if (!payingItem) return;
    onTogglePayment(payingItem.loanId, payingItem.installmentNumber, trackingCodeInput.trim() || undefined);
    setPayingItem(null);
    setTrackingCodeInput('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div 
        className="p-5 rounded-3xl bg-[#0F1524] border border-[#1F2B47] flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Bell className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black text-white" style={{ color: 'var(--ui-text-primary)' }}>
              مرکز هشدارها و سررسیدهای اقساط
            </h1>
            <p className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>
              شناسایی هوشمند اقساط معوقه، سررسیدهای روز و یادآورهای هفتگی
            </p>
          </div>
        </div>

        {/* Browser Notification Button */}
        <div className="flex items-center gap-2">
          {notificationStatus !== 'granted' ? (
            <button
              onClick={handleEnableNotifications}
              className="py-2.5 px-3.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-2 cursor-pointer transition"
            >
              <Volume2 className="w-4 h-4" />
              <span>فعال‌سازی اعلان‌های مرورگر</span>
            </button>
          ) : (
            <div className="py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>اعلان مرورگر فعال است</span>
            </div>
          )}
        </div>
      </div>

      {testNotificationMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
          {testNotificationMsg}
        </div>
      )}

      {/* 1. OVERDUE SECTION (Critical) */}
      {alertsData.overdue.length > 0 && (
        <div className="p-6 rounded-3xl bg-red-500/10 border border-red-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-red-400 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
              اقساط معوقه (سررسید گذشته) - {alertsData.overdue.length} مورد
            </h2>
            <span className="text-xs font-bold text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full">
              اقدام فوری
            </span>
          </div>

          <div className="space-y-3">
            {alertsData.overdue.map(({ loan, installment, daysLate }) => (
              <div 
                key={`${loan.id}-${installment.number}`}
                className="p-4 rounded-2xl bg-[#0F1524] border border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>{loan.title}</span>
                    <span className="text-[10px] text-red-400 font-mono bg-red-500/20 px-2 py-0.5 rounded font-bold">
                      {daysLate} روز تاخیر!
                    </span>
                  </div>
                  <div className="text-[11px] text-[#94A2C2] flex items-center gap-2">
                    <span>قسط شماره {installment.number}</span>
                    <span>•</span>
                    <span>بانک: {loan.lender}</span>
                    <span>•</span>
                    <span className="font-mono text-red-300">تاریخ سررسید: {installment.dueDate}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  <span className="text-sm font-black text-red-400 font-mono">
                    {LoanService.formatCurrency(installment.amount)}
                  </span>
                  <button
                    onClick={() =>
                      setPayingItem({
                        loanId: loan.id,
                        installmentNumber: installment.number,
                        amount: installment.amount,
                        dueDate: installment.dueDate,
                        title: loan.title,
                      })
                    }
                    className="py-2 px-3.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-md"
                  >
                    <Check className="w-4 h-4" />
                    <span>ثبت پرداخت قسط</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. TODAY SECTION */}
      {alertsData.today.length > 0 && (
        <div className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/30 space-y-4">
          <h2 className="text-sm font-bold text-amber-300 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400 animate-spin" />
            سررسیدهای امروز ({currentJalali.fullTitle})
          </h2>

          <div className="space-y-3">
            {alertsData.today.map(({ loan, installment }) => (
              <div 
                key={`${loan.id}-${installment.number}`}
                className="p-4 rounded-2xl bg-[#0F1524] border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>{loan.title}</span>
                    <span className="text-[10px] text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded font-bold">
                      موعد پرداخت امروز
                    </span>
                  </div>
                  <div className="text-[11px] text-[#94A2C2]">
                    قسط {installment.number} • وام‌دهنده: {loan.lender}
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  <span className="text-sm font-black text-amber-300 font-mono">
                    {LoanService.formatCurrency(installment.amount)}
                  </span>
                  <button
                    onClick={() =>
                      setPayingItem({
                        loanId: loan.id,
                        installmentNumber: installment.number,
                        amount: installment.amount,
                        dueDate: installment.dueDate,
                        title: loan.title,
                      })
                    }
                    className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-md"
                  >
                    <Check className="w-4 h-4" />
                    <span>پرداخت شد</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. UPCOMING IN 3 DAYS */}
      {alertsData.within3Days.length > 0 && (
        <div 
          className="p-6 rounded-3xl bg-[#0F1524] border border-[#1F2B47] space-y-4"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          <h2 className="text-sm font-bold text-[#38E1FF] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#38E1FF]" />
            سررسیدهای ۳ روز آینده ({alertsData.within3Days.length} قسط)
          </h2>

          <div className="space-y-3">
            {alertsData.within3Days.map(({ loan, installment, daysLeft }) => (
              <div 
                key={`${loan.id}-${installment.number}`}
                className="p-3.5 rounded-xl bg-[#070A12] border border-[#1F2B47] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{ borderColor: 'var(--ui-border)' }}
              >
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white flex items-center gap-2" style={{ color: 'var(--ui-text-primary)' }}>
                    <span>{loan.title}</span>
                    <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded font-mono">
                      {daysLeft} روز باقیمانده
                    </span>
                  </div>
                  <div className="text-[11px] text-[#94A2C2]">
                    قسط {installment.number} • سررسید: {installment.dueDate} • {loan.lender}
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  <span className="text-xs font-black text-amber-300 font-mono">
                    {LoanService.formatCurrency(installment.amount)}
                  </span>
                  <button
                    onClick={() =>
                      setPayingItem({
                        loanId: loan.id,
                        installmentNumber: installment.number,
                        amount: installment.amount,
                        dueDate: installment.dueDate,
                        title: loan.title,
                      })
                    }
                    className="py-1.5 px-3 rounded-lg bg-gradient-to-r from-[#4F7CFF] to-[#6055F6] text-white text-xs font-bold hover:opacity-95 cursor-pointer"
                  >
                    ثبت پرداخت
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. UPCOMING THIS WEEK */}
      {alertsData.within7Days.length > 0 && (
        <div 
          className="p-6 rounded-3xl bg-[#0F1524] border border-[#1F2B47] space-y-4"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ color: 'var(--ui-text-primary)' }}>
            <Calendar className="w-4 h-4 text-purple-400" />
            سررسیدهای ۴ تا ۷ روز آینده ({alertsData.within7Days.length} قسط)
          </h2>

          <div className="space-y-3">
            {alertsData.within7Days.map(({ loan, installment, daysLeft }) => (
              <div 
                key={`${loan.id}-${installment.number}`}
                className="p-3.5 rounded-xl bg-[#070A12] border border-[#1F2B47] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{ borderColor: 'var(--ui-border)' }}
              >
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white flex items-center gap-2" style={{ color: 'var(--ui-text-primary)' }}>
                    <span>{loan.title}</span>
                    <span className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded font-mono">
                      {daysLeft} روز بعد
                    </span>
                  </div>
                  <div className="text-[11px] text-[#94A2C2]">
                    قسط {installment.number} • تاریخ: {installment.dueDate} • {loan.lender}
                  </div>
                </div>

                <span className="text-xs font-black text-amber-300 font-mono">
                  {LoanService.formatCurrency(installment.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All clear state */}
      {alertsData.overdue.length === 0 && alertsData.today.length === 0 && alertsData.within3Days.length === 0 && (
        <div 
          className="p-10 rounded-3xl bg-[#0F1524] border border-[#1F2B47] text-center space-y-3"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white" style={{ color: 'var(--ui-text-primary)' }}>
            هیچ قسط معوق یا فوری وجود ندارد!
          </h3>
          <p className="text-xs text-[#94A2C2] max-w-sm mx-auto">
            وضعیت بازپرداخت‌های شما عالی است و تمام اقساط تا روزهای آینده تسویه شده یا زمان کافی تا سررسید بعدی دارند.
          </p>
        </div>
      )}

      {/* Payment confirmation modal */}
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
                کد پیگیری یا شماره تراکنش:
              </label>
              <input
                type="text"
                value={trackingCodeInput}
                onChange={(e) => setTrackingCodeInput(e.target.value)}
                placeholder="مثال: ۹۸۷۶۵۴۳۲۱"
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
                تایید و ثبت
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
