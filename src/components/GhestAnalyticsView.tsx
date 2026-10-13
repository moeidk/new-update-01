import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  PieChart, 
  BarChart3, 
  Download, 
  Printer, 
  Calendar, 
  CreditCard, 
  Wallet, 
  CheckCircle2, 
  Clock, 
  Percent, 
  FileSpreadsheet,
  ArrowUpRight
} from 'lucide-react';
import { LoanItem, UserProfile } from '../types';
import { LoanService } from '../services/loanService';
import { getCurrentJalali, getJalaliMonthName, parseJalali } from '../utils/jalali';

interface GhestAnalyticsViewProps {
  currentUser: UserProfile;
  loans: LoanItem[];
}

export const GhestAnalyticsView: React.FC<GhestAnalyticsViewProps> = ({
  currentUser,
  loans,
}) => {
  const currentJalali = useMemo(() => getCurrentJalali(), []);

  // Overall Financial Calculations
  const metrics = useMemo(() => {
    let totalDebt = 0;
    let totalPaid = 0;
    let totalPrincipal = 0;
    let totalInterest = 0;

    loans.forEach((loan) => {
      totalDebt += loan.totalAmount;
      const paid = (loan.paidInstallments || 0) * loan.installmentAmount;
      totalPaid += paid;
      totalPrincipal += loan.totalAmount;
      if (loan.totalInterest) {
        totalInterest += loan.totalInterest;
      } else if (loan.interestRate && loan.interestRate > 0) {
        const calc = LoanService.calculateLoanFormula(loan.totalAmount, loan.interestRate, loan.totalInstallments);
        totalInterest += calc.totalInterest;
      }
    });

    const remaining = Math.max(0, totalDebt - totalPaid);
    const progressPercent = totalDebt > 0 ? Math.round((totalPaid / totalDebt) * 100) : 0;

    return {
      totalDebt,
      totalPaid,
      remaining,
      totalPrincipal,
      totalInterest,
      progressPercent,
      activeLoansCount: loans.filter((l) => l.status === 'active').length,
      completedLoansCount: loans.filter((l) => l.status === 'completed').length,
    };
  }, [loans]);

  // Breakdown by Lender (Bank / Institution)
  const lenderBreakdown = useMemo(() => {
    const map: { [lender: string]: { totalAmount: number; count: number; paidAmount: number } } = {};

    loans.forEach((loan) => {
      const key = loan.lender.trim() || 'نامشخص';
      if (!map[key]) {
        map[key] = { totalAmount: 0, count: 0, paidAmount: 0 };
      }
      map[key].totalAmount += loan.totalAmount;
      map[key].count += 1;
      map[key].paidAmount += (loan.paidInstallments || 0) * loan.installmentAmount;
    });

    const total = Object.values(map).reduce((acc, curr) => acc + curr.totalAmount, 0);

    return Object.entries(map).map(([lender, data]) => ({
      lender,
      totalAmount: data.totalAmount,
      count: data.count,
      paidAmount: data.paidAmount,
      sharePercent: total > 0 ? Math.round((data.totalAmount / total) * 100) : 0,
    })).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [loans]);

  // 12-Month Upcoming Cashflow Projection
  const monthlyProjection = useMemo(() => {
    const list: {
      year: number;
      month: number;
      monthName: string;
      label: string;
      amount: number;
      count: number;
    }[] = [];

    let curY = currentJalali.jy;
    let curM = currentJalali.jm;

    for (let i = 0; i < 12; i++) {
      let m = curM + i;
      let y = curY;
      while (m > 12) {
        m -= 12;
        y += 1;
      }

      const monthName = getJalaliMonthName(m);
      const label = `${monthName} ${y}`;

      let amount = 0;
      let count = 0;

      loans.forEach((loan) => {
        (loan.installments || []).forEach((inst) => {
          if (!inst.isPaid) {
            const p = parseJalali(inst.dueDate);
            if (p && p.jy === y && p.jm === m) {
              amount += inst.amount;
              count++;
            }
          }
        });
      });

      list.push({ year: y, month: m, monthName, label, amount, count });
    }

    const maxAmount = Math.max(...list.map((x) => x.amount), 1);
    return { list, maxAmount };
  }, [loans, currentJalali]);

  // Export CSV Action
  const handleExportCSV = () => {
    const csv = LoanService.exportLoansToCSV(loans);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ghest_Loans_Report_${currentUser.username}_${currentJalali.str.replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print Report Action
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div 
        className="p-5 rounded-3xl bg-[#0F1524] border border-[#1F2B47] flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black text-white" style={{ color: 'var(--ui-text-primary)' }}>
              گزارش‌ها و تحلیل مالی تعهدات
            </h1>
            <p className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>
              تحلیل جریان نقدینگی، سهم بانک‌ها، نسبت اصل و سود و پیش‌بینی ۱۲ ماهه
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="py-2.5 px-3.5 rounded-xl bg-[#070A12] hover:bg-[#151D2F] border border-[#1F2B47] text-xs font-bold text-[#38E1FF] flex items-center gap-2 cursor-pointer transition shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>خروجی اکسل (CSV)</span>
          </button>

          <button
            onClick={handlePrint}
            className="py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#6055F6] text-white text-xs font-bold flex items-center gap-2 cursor-pointer hover:opacity-95 transition shadow-lg shadow-[#4F7CFF]/20"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ گزارش مالی</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          className="p-5 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-1.5"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          <div className="flex items-center justify-between text-xs text-[#94A2C2]">
            <span>کل بدهی و تسهیلات</span>
            <Wallet className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-lg md:text-xl font-black text-white font-mono" style={{ color: 'var(--ui-text-primary)' }}>
            {LoanService.formatCurrency(metrics.totalDebt)}
          </div>
          <div className="text-[11px] text-[#94A2C2]">
            {metrics.activeLoansCount} وام در جریان
          </div>
        </div>

        <div 
          className="p-5 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-1.5"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          <div className="flex items-center justify-between text-xs text-[#94A2C2]">
            <span>کل مبلغ تسویه شده</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg md:text-xl font-black text-emerald-400 font-mono">
            {LoanService.formatCurrency(metrics.totalPaid)}
          </div>
          <div className="text-[11px] text-emerald-400/80">
            {metrics.progressPercent}٪ از تعهدات
          </div>
        </div>

        <div 
          className="p-5 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-1.5"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          <div className="flex items-center justify-between text-xs text-[#94A2C2]">
            <span>مانده بازپرداخت</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg md:text-xl font-black text-purple-400 font-mono">
            {LoanService.formatCurrency(metrics.remaining)}
          </div>
          <div className="text-[11px] text-[#94A2C2]">
            تعهدات باقیمانده
          </div>
        </div>

        <div 
          className="p-5 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-1.5"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          <div className="flex items-center justify-between text-xs text-[#94A2C2]">
            <span>کل سود تخمینی وام‌ها</span>
            <Percent className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg md:text-xl font-black text-amber-300 font-mono">
            {LoanService.formatCurrency(metrics.totalInterest)}
          </div>
          <div className="text-[11px] text-[#94A2C2]">
            هزینه مالی تسهیلات
          </div>
        </div>
      </div>

      {/* 12-Month Upcoming Cashflow Projection Chart */}
      <div 
        className="p-6 rounded-3xl bg-[#0F1524] border border-[#1F2B47] space-y-5"
        style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ color: 'var(--ui-text-primary)' }}>
              <BarChart3 className="w-4 h-4 text-[#38E1FF]" />
              پیش‌بینی بار مالی و جریان نقدی ۱۲ ماه آینده
            </h2>
            <p className="text-xs text-[#94A2C2] mt-0.5">
              مجموع مبالغ اقساط سررسید شونده در هر ماه شمسی پیش‌رو
            </p>
          </div>
        </div>

        {/* Visual Bar Chart */}
        <div className="pt-6 pb-2">
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 md:gap-3 items-end h-56 border-b border-[#1F2B47] pb-3">
            {monthlyProjection.list.map((item, idx) => {
              const heightPercent = monthlyProjection.maxAmount > 0 
                ? Math.max(item.amount > 0 ? 8 : 2, Math.round((item.amount / monthlyProjection.maxAmount) * 100))
                : 2;

              return (
                <div key={idx} className="flex flex-col items-center h-full justify-end group">
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-black/90 text-white px-2 py-1 rounded shadow-lg whitespace-nowrap mb-1 z-20 pointer-events-none">
                    <div>{item.label}</div>
                    <div className="font-mono text-amber-300 font-bold">{LoanService.formatCurrency(item.amount)}</div>
                    <div className="text-[9px] text-[#94A2C2]">{item.count} قسط</div>
                  </div>

                  {/* Bar */}
                  <div 
                    className="w-full max-w-[28px] rounded-t-lg transition-all duration-500 bg-gradient-to-t from-[#4F7CFF] to-[#38E1FF] group-hover:from-[#6055F6] group-hover:to-[#38E1FF] group-hover:scale-105"
                    style={{ 
                      height: `${heightPercent}%`,
                      opacity: item.amount > 0 ? 1 : 0.2,
                    }}
                  />

                  {/* Month Label */}
                  <div className="text-[10px] md:text-[11px] text-[#94A2C2] mt-2 font-medium truncate w-full text-center">
                    {item.monthName.slice(0, 3)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lender Distribution Breakdown */}
      <div 
        className="p-6 rounded-3xl bg-[#0F1524] border border-[#1F2B47] space-y-4"
        style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ color: 'var(--ui-text-primary)' }}>
            <PieChart className="w-4 h-4 text-purple-400" />
            سهم بانک‌ها و وام‌دهندگان از کل تعهدات
          </h2>
          <span className="text-xs text-[#94A2C2]">
            {lenderBreakdown.length} وام‌دهنده
          </span>
        </div>

        {lenderBreakdown.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#94A2C2]">
            هیچ وامی برای تحلیل موجود نیست.
          </div>
        ) : (
          <div className="space-y-3">
            {lenderBreakdown.map((item, idx) => (
              <div 
                key={idx}
                className="p-3.5 rounded-xl bg-[#070A12] border border-[#1F2B47] space-y-2"
                style={{ borderColor: 'var(--ui-border)' }}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#4F7CFF]" />
                    <span className="font-bold text-white" style={{ color: 'var(--ui-text-primary)' }}>
                      {item.lender}
                    </span>
                    <span className="text-[10px] text-[#94A2C2] bg-white/5 px-2 py-0.5 rounded">
                      {item.count} فقره وام
                    </span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="font-bold text-white ml-2" style={{ color: 'var(--ui-text-primary)' }}>
                      {LoanService.formatCurrency(item.totalAmount)}
                    </span>
                    <span className="text-xs font-bold text-[#38E1FF]">({item.sharePercent}٪)</span>
                  </div>
                </div>

                {/* Share Progress Bar */}
                <div className="w-full h-2 rounded-full bg-[#182239] overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#4F7CFF] to-[#38E1FF] rounded-full transition-all duration-500"
                    style={{ width: `${item.sharePercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
