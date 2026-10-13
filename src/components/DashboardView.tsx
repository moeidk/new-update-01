import React, { useMemo } from 'react';
import { 
  CreditCard, 
  ShieldCheck, 
  Plus, 
  Calendar, 
  TrendingUp, 
  Calculator, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  ChevronLeft,
  Sparkles,
  Lock,
  Wallet,
  PiggyBank,
  Globe,
  Send
} from 'lucide-react';
import { LoanItem, VaultItem, UserProfile, SidebarNavView, HostingDomainItem } from '../types';
import { LoanService } from '../services/loanService';
import { getCurrentJalali, getDueStatus, compareJalaliDates } from '../utils/jalali';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface DashboardViewProps {
  currentUser: UserProfile;
  loans: LoanItem[];
  vaultItems: VaultItem[];
  hostingItems?: HostingDomainItem[];
  onNavigate: (view: SidebarNavView) => void;
  onOpenAddLoan: () => void;
  onOpenAddVaultItem: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  loans,
  vaultItems,
  hostingItems = [],
  onNavigate,
  onOpenAddLoan,
  onOpenAddVaultItem,
}) => {
  const jalaliNow = useMemo(() => getCurrentJalali(), []);

  // Compute Loan Stats
  const loanStats = useMemo(() => {
    let totalDebt = 0;
    let totalPaid = 0;
    let thisMonthDue = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let urgentUpcomingCount = 0;

    loans.forEach((loan) => {
      totalDebt += loan.totalAmount;
      const paid = (loan.paidInstallments || 0) * loan.installmentAmount;
      totalPaid += paid;

      (loan.installments || []).forEach((inst) => {
        if (!inst.isPaid) {
          const status = getDueStatus(inst.dueDate);
          if (status === 'overdue') {
            overdueCount++;
            overdueAmount += inst.amount;
          } else if (status === 'today' || status === 'upcoming-3d' || status === 'upcoming-7d') {
            urgentUpcomingCount++;
          }
          if (status === 'today' || status === 'upcoming-month') {
            thisMonthDue += inst.amount;
          }
        }
      });
    });

    const percent = totalDebt > 0 ? Math.round((totalPaid / totalDebt) * 100) : 0;
    const remaining = Math.max(0, totalDebt - totalPaid);

    return {
      totalDebt,
      totalPaid,
      remaining,
      thisMonthDue,
      percent,
      overdueCount,
      overdueAmount,
      urgentUpcomingCount,
      activeLoansCount: loans.filter((l) => l.status === 'active').length,
    };
  }, [loans]);

  // Compute Next 5 Upcoming Installments
  const upcomingInstallments = useMemo(() => {
    const list: {
      loanId: string;
      loanTitle: string;
      lender: string;
      number: number;
      dueDate: string;
      amount: number;
      status: string;
    }[] = [];

    loans.forEach((loan) => {
      (loan.installments || []).forEach((inst) => {
        if (!inst.isPaid) {
          const status = getDueStatus(inst.dueDate);
          list.push({
            loanId: loan.id,
            loanTitle: loan.title,
            lender: loan.lender,
            number: inst.number,
            dueDate: inst.dueDate,
            amount: inst.amount,
            status,
          });
        }
      });
    });

    // Sort by due date ascending
    list.sort((a, b) => compareJalaliDates(a.dueDate, b.dueDate));
    return list.slice(0, 5);
  }, [loans]);

  // Vault stats
  const vaultStats = useMemo(() => {
    return {
      total: vaultItems.length,
      logins: vaultItems.filter((i) => i.category === 'login').length,
      banks: vaultItems.filter((i) => i.category === 'bank').length,
      favorites: vaultItems.filter((i) => i.isFavorite).length,
    };
  }, [vaultItems]);

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner with Jalali Date */}
      <div 
        className="rounded-3xl p-6 relative overflow-hidden bg-gradient-to-r from-[#0F1524] via-[#121A30] to-[#1C1838] border border-[#1F2B47] shadow-xl"
        style={{ borderColor: 'var(--ui-border)' }}
      >
        <div className="absolute top-0 left-0 w-80 h-80 bg-[#4F7CFF]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#38E1FF] mb-1.5">
              <Calendar className="w-4 h-4" />
              <span>{jalaliNow.fullTitle}</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white" style={{ color: 'var(--ui-text-primary)' }}>
              سلام، {currentUser.displayName || currentUser.username} عزیز 👋
            </h1>
            <p className="text-xs text-[#94A2C2] mt-1" style={{ color: 'var(--ui-text-secondary)' }}>
              به پنل جامع مدیریت اقساط و گاوصندوق امن خود خوش آمدید. کلیه داده‌ها به صورت مجزا برای حساب شما ذخیره شده‌اند.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={onOpenAddLoan}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#6055F6] text-white text-xs font-bold hover:opacity-95 shadow-lg shadow-[#4F7CFF]/20 flex items-center gap-1.5 cursor-pointer transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>وام جدید</span>
            </button>
            <button
              onClick={onOpenAddVaultItem}
              className="py-2.5 px-4 rounded-xl bg-[#0F1524] hover:bg-[#1A233A] border border-[#1F2B47] text-[#38E1FF] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition active:scale-95"
              style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>ثبت رمز / کارت</span>
            </button>
          </div>
        </div>
      </div>

      {/* Critical Overdue / Near-Due Alert Banner */}
      {(loanStats.overdueCount > 0 || loanStats.urgentUpcomingCount > 0) && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-400 animate-bounce" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-300">
                {loanStats.overdueCount > 0 ? (
                  <>توجه: شما <span className="font-mono text-red-400 font-black">{loanStats.overdueCount}</span> قسط معوقه با مبلغ {LoanService.formatCurrency(loanStats.overdueAmount)} دارید!</>
                ) : (
                  <>شما <span className="font-mono font-black">{loanStats.urgentUpcomingCount}</span> قسط با سررسید نزدیک در روزهای آینده دارید.</>
                )}
              </div>
              <div className="text-[11px] text-[#94A2C2] mt-0.5">
                جهت جلوگیری از جریمه دیرکرد، لیست سررسیدها را بررسی کنید.
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigate('alerts')}
            className="py-1.5 px-3 rounded-lg bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition cursor-pointer shrink-0"
          >
            بررسی سررسیدها
          </button>
        </div>
      )}

      {/* Key Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Debt */}
        <div 
          className="p-5 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-2"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>کل تعهدات و بدهی</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <div className="text-lg md:text-xl font-black text-white" style={{ color: 'var(--ui-text-primary)' }}>
            {LoanService.formatCurrency(loanStats.totalDebt)}
          </div>
          <div className="text-[11px] text-[#94A2C2]">
            از مجموع <span className="font-bold text-white" style={{ color: 'var(--ui-text-primary)' }}>{loanStats.activeLoansCount}</span> وام فعال
          </div>
        </div>

        {/* Total Paid */}
        <div 
          className="p-5 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-2"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>مجموع مبالغ پرداخت‌شده</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="text-lg md:text-xl font-black text-emerald-400">
            {LoanService.formatCurrency(loanStats.totalPaid)}
          </div>
          <div className="text-[11px] text-[#94A2C2]">
            تسویه موفق تاکنون
          </div>
        </div>

        {/* Remaining Debt */}
        <div 
          className="p-5 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-2"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>مانده کل بدهی</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-purple-400" />
            </div>
          </div>
          <div className="text-lg md:text-xl font-black text-purple-400">
            {LoanService.formatCurrency(loanStats.remaining)}
          </div>
          <div className="text-[11px] text-[#94A2C2]">
            مبلغ باقیمانده تا تسویه کامل
          </div>
        </div>

        {/* Due This Month */}
        <div 
          className="p-5 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-2"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>سررسید ماه جاری</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="text-lg md:text-xl font-black text-amber-400">
            {LoanService.formatCurrency(loanStats.thisMonthDue)}
          </div>
          <div className="text-[11px] text-[#94A2C2]">
            تعهدات پرداخت در ۳۰ روز
          </div>
        </div>
      </div>

      {/* Progress Bar of Overall Settlement */}
      <div 
        className="p-5 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-3"
        style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-white flex items-center gap-1.5" style={{ color: 'var(--ui-text-primary)' }}>
            <TrendingUp className="w-4 h-4 text-[#4F7CFF]" />
            پیشرفت کلی تسویه بدهی‌ها
          </span>
          <span className="font-mono font-bold text-[#38E1FF] text-sm">
            {loanStats.percent}٪ تسویه شده
          </span>
        </div>
        <div className="w-full h-3 rounded-full bg-[#182239] overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#4F7CFF] via-[#38E1FF] to-emerald-400 transition-all duration-500 rounded-full"
            style={{ width: `${loanStats.percent}%` }}
          />
        </div>
      </div>

      {/* Dual Section: Next Due Installments & Vault Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next Upcoming Due Installments */}
        <div 
          className="p-5 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-4"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ color: 'var(--ui-text-primary)' }}>
              <Clock className="w-4 h-4 text-amber-400" />
              سررسیدهای پیش‌رو
            </h2>
            <button
              onClick={() => onNavigate('calendar')}
              className="text-xs text-[#38E1FF] hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <span>مشاهده تقویم</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {upcomingInstallments.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#94A2C2]">
              هیچ قسط سررسید نشده‌ای یافت نشد. تبریک، تمامی اقساط تسویه هستند!
            </div>
          ) : (
            <div className="space-y-2.5">
              {upcomingInstallments.map((item, idx) => (
                <div
                  key={`${item.loanId}-${item.number}-${idx}`}
                  className="p-3 rounded-xl bg-[#070A12] border border-[#1F2B47] flex items-center justify-between"
                  style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
                >
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-white flex items-center gap-2" style={{ color: 'var(--ui-text-primary)' }}>
                      <span>{item.loanTitle}</span>
                      <span className="text-[10px] text-[#94A2C2] bg-white/5 px-2 py-0.5 rounded-md">
                        قسط {item.number}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#94A2C2] flex items-center gap-2">
                      <span>بانک: {item.lender}</span>
                      <span>•</span>
                      <span className="font-mono text-[#38E1FF]">سررسید: {item.dueDate}</span>
                    </div>
                  </div>

                  <div className="text-left space-y-1">
                    <div className="text-xs font-bold text-amber-300 font-mono">
                      {LoanService.formatCurrency(item.amount)}
                    </div>
                    <div>
                      {item.status === 'overdue' && (
                        <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                          معوق
                        </span>
                      )}
                      {item.status === 'today' && (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 animate-pulse">
                          سررسید امروز
                        </span>
                      )}
                      {item.status === 'upcoming-3d' && (
                        <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                          تا ۳ روز
                        </span>
                      )}
                      {item.status === 'upcoming-7d' && (
                        <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                          این هفته
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vault Status & Shortcut */}
        <div 
          className="p-5 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-4"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ color: 'var(--ui-text-primary)' }}>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              گاوصندوق رمزها و حساب‌ها
            </h2>
            <button
              onClick={() => onNavigate('vault')}
              className="text-xs text-[#38E1FF] hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <span>ورود به گاوصندوق</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#070A12] border border-[#1F2B47] space-y-1" style={{ borderColor: 'var(--ui-border)' }}>
              <span className="text-[11px] text-[#94A2C2]">کل موارد ذخیره شده</span>
              <div className="text-lg font-black text-white font-mono" style={{ color: 'var(--ui-text-primary)' }}>
                {vaultStats.total}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#070A12] border border-[#1F2B47] space-y-1" style={{ borderColor: 'var(--ui-border)' }}>
              <span className="text-[11px] text-[#94A2C2]">کارت‌های بانکی شتاب</span>
              <div className="text-lg font-black text-blue-400 font-mono">
                {vaultStats.banks}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#070A12] border border-[#1F2B47] space-y-1" style={{ borderColor: 'var(--ui-border)' }}>
              <span className="text-[11px] text-[#94A2C2]">رمزهای ورود و سایت‌ها</span>
              <div className="text-lg font-black text-purple-400 font-mono">
                {vaultStats.logins}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#070A12] border border-[#1F2B47] space-y-1" style={{ borderColor: 'var(--ui-border)' }}>
              <span className="text-[11px] text-[#94A2C2]">علاقه‌مندی‌ها</span>
              <div className="text-lg font-black text-amber-400 font-mono">
                {vaultStats.favorites}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <span>گاوصندوق با کلید رمزنگاری مجزا برای کاربر «{currentUser.username}» محافظت می‌شود.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
