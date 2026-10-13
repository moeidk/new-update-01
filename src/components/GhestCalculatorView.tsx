import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  CreditCard, 
  Percent, 
  Calendar, 
  ArrowLeft, 
  Plus, 
  TrendingUp, 
  CheckCircle2, 
  Sparkles,
  Info
} from 'lucide-react';
import { LoanService } from '../services/loanService';
import { FormattedNumberInput } from './FormattedNumberInput';

interface GhestCalculatorViewProps {
  onTransferToNewLoan: (data: {
    totalAmount: number;
    interestRate: number;
    totalInstallments: number;
    installmentAmount: number;
  }) => void;
}

export const GhestCalculatorView: React.FC<GhestCalculatorViewProps> = ({
  onTransferToNewLoan,
}) => {
  const [amount, setAmount] = useState<number>(50000000); // 50 million tomans
  const [rate, setRate] = useState<number>(23); // 23% CBI
  const [months, setMonths] = useState<number>(24); // 24 months

  // Preset suggestions
  const presetAmounts = [20000000, 50000000, 100000000, 200000000, 500000000];
  const presetMonths = [6, 12, 18, 24, 36, 48, 60];
  const presetRates = [0, 4, 18, 23];

  const result = useMemo(() => {
    return LoanService.calculateLoanFormula(amount, rate, months);
  }, [amount, rate, months]);

  // Preview first 6 amortization schedule items
  const schedulePreview = useMemo(() => {
    return LoanService.generateInstallmentsSchedule(
      '1403/01/01',
      Math.min(months, 12),
      result.monthlyPayment,
      10,
      amount,
      rate
    );
  }, [amount, rate, months, result.monthlyPayment]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div 
        className="p-5 rounded-3xl bg-[#0F1524] border border-[#1F2B47] flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#38E1FF]/15 border border-[#38E1FF]/30 flex items-center justify-center">
            <Calculator className="w-6 h-6 text-[#38E1FF]" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black text-white" style={{ color: 'var(--ui-text-primary)' }}>
              ماشین‌حساب هوشمند تسهیلات و وام بانکی
            </h1>
            <p className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>
              محاسبه اقساط بر اساس فرمول رسمی بانک مرکزی ایران با تحلیل اصل و سود
            </p>
          </div>
        </div>

        <button
          onClick={() =>
            onTransferToNewLoan({
              totalAmount: amount,
              interestRate: rate,
              totalInstallments: months,
              installmentAmount: result.monthlyPayment,
            })
          }
          className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#6055F6] text-white text-xs font-bold hover:opacity-95 shadow-lg shadow-[#4F7CFF]/20 flex items-center gap-2 cursor-pointer transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت به عنوان وام جدید</span>
        </button>
      </div>

      {/* Main Grid: Inputs vs Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Inputs Panel (7 Cols) */}
        <div 
          className="lg:col-span-7 p-6 rounded-3xl bg-[#0F1524] border border-[#1F2B47] space-y-6"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          {/* Amount input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-2" style={{ color: 'var(--ui-text-primary)' }}>
                <CreditCard className="w-4 h-4 text-[#4F7CFF]" />
                مبلغ اصل وام (تومان):
              </label>
              <span className="text-sm font-black text-[#38E1FF] font-mono">
                {LoanService.formatCurrency(amount)}
              </span>
            </div>
            <FormattedNumberInput
              value={amount}
              onChange={(val) => setAmount(val)}
              placeholder="مثال: 100,000,000"
              unitLabel="تومان"
              className="w-full bg-[#070A12] border border-[#1F2B47] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-[#4F7CFF]"
            />
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {presetAmounts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(p)}
                  className={`py-1 px-2.5 rounded-lg text-[11px] font-mono font-medium transition cursor-pointer ${
                    amount === p ? 'bg-[#4F7CFF] text-white' : 'bg-white/5 text-[#94A2C2] hover:text-white'
                  }`}
                >
                  {p / 1000000} م.ت
                </button>
              ))}
            </div>
          </div>

          {/* Interest Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-2" style={{ color: 'var(--ui-text-primary)' }}>
                <Percent className="w-4 h-4 text-amber-400" />
                نرخ سود سالانه (درصد):
              </label>
              <span className="text-sm font-black text-amber-400 font-mono">
                {rate}٪ {rate === 0 ? '(قرض‌الحسنه بدون کارمزد)' : rate === 4 ? '(قرض‌الحسنه بانک‌ها)' : ''}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={35}
              step={0.5}
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value))}
              className="w-full accent-[#4F7CFF] cursor-pointer"
            />
            {/* Quick Rates */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {presetRates.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRate(r)}
                  className={`py-1 px-2.5 rounded-lg text-[11px] font-mono font-medium transition cursor-pointer ${
                    rate === r ? 'bg-amber-500 text-black font-bold' : 'bg-white/5 text-[#94A2C2] hover:text-white'
                  }`}
                >
                  {r === 0 ? '۰٪ (بدون سود)' : r === 4 ? '۴٪ قرض‌الحسنه' : `${r}٪`}
                </button>
              ))}
            </div>
          </div>

          {/* Repayment Months */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-2" style={{ color: 'var(--ui-text-primary)' }}>
                <Calendar className="w-4 h-4 text-purple-400" />
                مدت بازپرداخت (تعداد ماه‌ها):
              </label>
              <span className="text-sm font-black text-purple-400 font-mono">
                {months} ماه ({Math.round(months / 12 * 10) / 10} سال)
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={120}
              step={1}
              value={months}
              onChange={(e) => setMonths(parseInt(e.target.value, 10))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            {/* Quick Months */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {presetMonths.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  className={`py-1 px-2.5 rounded-lg text-[11px] font-mono font-medium transition cursor-pointer ${
                    months === m ? 'bg-purple-600 text-white font-bold' : 'bg-white/5 text-[#94A2C2] hover:text-white'
                  }`}
                >
                  {m} ماه
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Results Panel (5 Cols) */}
        <div 
          className="lg:col-span-5 p-6 rounded-3xl bg-[#0F1524] border border-[#1F2B47] flex flex-col justify-between space-y-6"
          style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
        >
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ color: 'var(--ui-text-primary)' }}>
              <Sparkles className="w-4 h-4 text-amber-400" />
              خلاصه محاسبات مالی
            </h2>

            {/* Monthly Payment Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#4F7CFF]/15 to-purple-600/15 border border-[#4F7CFF]/30 space-y-1">
              <span className="text-xs text-[#94A2C2]">مبلغ هر قسط ماهانه:</span>
              <div className="text-xl md:text-2xl font-black text-[#38E1FF] font-mono">
                {LoanService.formatCurrency(result.monthlyPayment)}
              </div>
            </div>

            {/* Total Interest Card */}
            <div className="p-4 rounded-2xl bg-[#070A12] border border-[#1F2B47] space-y-1" style={{ borderColor: 'var(--ui-border)' }}>
              <span className="text-xs text-[#94A2C2]">کل سود پرداختی به بانک:</span>
              <div className="text-lg font-black text-amber-300 font-mono">
                {LoanService.formatCurrency(result.totalInterest)}
              </div>
            </div>

            {/* Total Repayment Card */}
            <div className="p-4 rounded-2xl bg-[#070A12] border border-[#1F2B47] space-y-1" style={{ borderColor: 'var(--ui-border)' }}>
              <span className="text-xs text-[#94A2C2]">کل مبلغ بازپرداخت (اصل + سود):</span>
              <div className="text-lg font-black text-white font-mono" style={{ color: 'var(--ui-text-primary)' }}>
                {LoanService.formatCurrency(result.totalRepayment)}
              </div>
            </div>
          </div>

          <button
            onClick={() =>
              onTransferToNewLoan({
                totalAmount: amount,
                interestRate: rate,
                totalInstallments: months,
                installmentAmount: result.monthlyPayment,
              })
            }
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#6055F6] text-white text-xs font-bold hover:opacity-95 shadow-xl shadow-[#4F7CFF]/20 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
          >
            <span>انتقال به ثبت وام جدید</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Amortization Schedule Table Preview */}
      <div 
        className="p-6 rounded-3xl bg-[#0F1524] border border-[#1F2B47] space-y-4"
        style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white" style={{ color: 'var(--ui-text-primary)' }}>
              پیش‌نمایش جدول استهلاک اقساط
            </h3>
            <span className="text-xs text-[#94A2C2]">
              تفکیک سهم اصل و سود در هر قسط برای {schedulePreview.length} قسط نخست
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[#1F2B47] text-[#94A2C2]">
                <th className="py-2.5 px-3">شماره قسط</th>
                <th className="py-2.5 px-3">مبلغ قسط</th>
                <th className="py-2.5 px-3">سهم اصل وام</th>
                <th className="py-2.5 px-3">سهم سود</th>
                <th className="py-2.5 px-3">مانده بدهی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2B47]/50 font-mono">
              {schedulePreview.map((item) => (
                <tr key={item.number} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-3 text-white font-bold">{item.number}</td>
                  <td className="py-2.5 px-3 text-[#38E1FF]">{LoanService.formatCurrency(item.amount)}</td>
                  <td className="py-2.5 px-3 text-emerald-400">{LoanService.formatCurrency(item.principalPart || 0)}</td>
                  <td className="py-2.5 px-3 text-amber-300">{LoanService.formatCurrency(item.interestPart || 0)}</td>
                  <td className="py-2.5 px-3 text-[#94A2C2]">{LoanService.formatCurrency(item.remainingBalance || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
