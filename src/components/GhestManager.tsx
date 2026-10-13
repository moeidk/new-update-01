import { JalaliDatePicker } from './JalaliDatePicker';
import { getCurrentJalali } from '../utils/jalali';
import React, { useState, useMemo, useEffect } from 'react';
import { 
  CreditCard, 
  Plus, 
  Search, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Sparkles, 
  TrendingUp, 
  Calculator, 
  Trash2, 
  Edit3, 
  ChevronDown, 
  ChevronUp, 
  X, 
  FileText, 
  ShieldCheck, 
  Check, 
  Percent, 
  Download, 
  Upload,
  UserCheck
} from 'lucide-react';
import { LoanItem, LoanInstallment, UserProfile } from '../types';
import { LoanService } from '../services/loanService';
import { FormattedNumberInput } from './FormattedNumberInput';

interface GhestManagerProps {
  currentUser: UserProfile;
  loans: LoanItem[];
  setLoans: React.Dispatch<React.SetStateAction<LoanItem[]>>;
  onOpenVaultTab?: () => void;
  openAddModalSignal?: boolean;
  onAddModalSignalHandled?: () => void;
  initialNewLoanData?: {
    totalAmount: number;
    interestRate: number;
    totalInstallments: number;
    installmentAmount: number;
  } | null;
  onClearInitialNewLoanData?: () => void;
}

export const GhestManager: React.FC<GhestManagerProps> = ({ 
  currentUser, 
  loans, 
  setLoans, 
  onOpenVaultTab,
  openAddModalSignal,
  onAddModalSignalHandled,
  initialNewLoanData,
  onClearInitialNewLoanData,
}) => {
  const username = currentUser.username;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'near-due'>('all');
  const [amortizationViewMode, setAmortizationViewMode] = useState<'cards' | 'table'>('table');
  
  // Expanded loan details
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanItem | null>(null);

  // Handle external modal trigger from Dashboard or other views
  useEffect(() => {
    if (openAddModalSignal) {
      handleOpenAddModal();
      onAddModalSignalHandled?.();
    }
  }, [openAddModalSignal]);

  // Handle transferred loan from Calculator
  useEffect(() => {
    if (initialNewLoanData) {
      setEditingLoan(null);
      setFormTitle('وام بانکی جدید');
      setFormLender('بانک');
      setFormTotalAmount(initialNewLoanData.totalAmount);
      setFormTotalInstallments(initialNewLoanData.totalInstallments);
      setFormInstallmentAmount(initialNewLoanData.installmentAmount);
      setFormDueDay(10);
      setFormInterestRate(initialNewLoanData.interestRate);
      setFormStartDate('1403/08/10');
      setFormNotes('');
      setIsAddModalOpen(true);
      onClearInitialNewLoanData?.();
    }
  }, [initialNewLoanData]);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');

  // Payment Tracking Modal
  const [payingInstallment, setPayingInstallment] = useState<{
    loanId: string;
    installmentNumber: number;
    amount: number;
    dueDate: string;
  } | null>(null);
  const [trackingCodeInput, setTrackingCodeInput] = useState('');

  // New/Edit Loan Form State
  const [formTitle, setFormTitle] = useState('');
  const [formLender, setFormLender] = useState('');
  const [formTotalAmount, setFormTotalAmount] = useState<number>(20000000);
  const [formTotalInstallments, setFormTotalInstallments] = useState<number>(12);
  const [formInstallmentAmount, setFormInstallmentAmount] = useState<number>(1850000);
  const [formDueDay, setFormDueDay] = useState<number>(10);
  const [formInterestRate, setFormInterestRate] = useState<number>(0);
  const [formStartDate, setFormStartDate] = useState(() => getCurrentJalali().str);
  const [formNotes, setFormNotes] = useState('');

  // Loan Calculator State
  const [calcAmount, setCalcAmount] = useState<number>(50000000);
  const [calcRate, setCalcRate] = useState<number>(23);
  const [calcMonths, setCalcMonths] = useState<number>(12);

  const calcResult = useMemo(() => {
    return LoanService.calculateLoanFormula(calcAmount, calcRate, calcMonths);
  }, [calcAmount, calcRate, calcMonths]);

  // Overall Statistics
  const stats = useMemo(() => {
    let totalDebt = 0;
    let totalPaid = 0;
    let thisMonthDue = 0;
    let totalInstallmentsCount = 0;
    let paidInstallmentsCount = 0;

    loans.forEach((loan) => {
      totalDebt += loan.totalAmount;
      const paid = (loan.paidInstallments || 0) * loan.installmentAmount;
      totalPaid += paid;
      totalInstallmentsCount += loan.totalInstallments;
      paidInstallmentsCount += (loan.paidInstallments || 0);

      const nextUnpaid = (loan.installments || []).find((inst) => !inst.isPaid);
      if (nextUnpaid && loan.status === 'active') {
        thisMonthDue += nextUnpaid.amount;
      }
    });

    const percent = totalDebt > 0 ? Math.round((totalPaid / totalDebt) * 100) : 0;
    const remaining = Math.max(0, totalDebt - totalPaid);

    return {
      totalDebt,
      totalPaid,
      remaining,
      thisMonthDue,
      percent,
      totalInstallmentsCount,
      paidInstallmentsCount,
      activeLoansCount: loans.filter((l) => l.status === 'active').length,
    };
  }, [loans]);

  // Filtered Loans
  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      const matchSearch =
        loan.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loan.lender.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (loan.notes && loan.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;

      if (statusFilter === 'active') return loan.status === 'active';
      if (statusFilter === 'completed') return loan.status === 'completed';
      if (statusFilter === 'near-due') {
        return loan.status === 'active' && (loan.installments || []).some((i) => !i.isPaid);
      }
      return true;
    });
  }, [loans, searchQuery, statusFilter]);

  // Open Add/Edit Modal
  const handleOpenAddModal = (loan?: LoanItem) => {
    if (loan) {
      setEditingLoan(loan);
      setFormTitle(loan.title);
      setFormLender(loan.lender);
      setFormTotalAmount(loan.totalAmount);
      setFormTotalInstallments(loan.totalInstallments);
      setFormInstallmentAmount(loan.installmentAmount);
      setFormDueDay(loan.dueDay);
      setFormInterestRate(loan.interestRate || 0);
      setFormStartDate(loan.startDate || getCurrentJalali().str);
      setFormNotes(loan.notes || '');
    } else {
      setEditingLoan(null);
      setFormTitle('');
      setFormLender('');
      setFormTotalAmount(20000000);
      setFormTotalInstallments(12);
      setFormInstallmentAmount(1850000);
      setFormDueDay(getCurrentJalali().jd);
      setFormInterestRate(0);
      setFormStartDate(getCurrentJalali().str);
      setFormNotes('');
    }
    setIsAddModalOpen(true);
  };

  // Auto calculate installment when total amount or installments change in modal
  const handleAutoCalcInForm = () => {
    if (formTotalAmount > 0 && formTotalInstallments > 0) {
      const res = LoanService.calculateLoanFormula(formTotalAmount, formInterestRate, formTotalInstallments);
      setFormInstallmentAmount(res.monthlyPayment);
    }
  };

  // Save Loan
  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const id = editingLoan ? editingLoan.id : `loan-${Date.now()}`;
    let installments: LoanInstallment[] = [];

    if (editingLoan && editingLoan.installments && editingLoan.installments.length === formTotalInstallments) {
      installments = editingLoan.installments.map((inst) => ({
        ...inst,
        amount: formInstallmentAmount,
      }));
    } else {
      installments = LoanService.generateInstallmentsSchedule(
        formStartDate,
        formTotalInstallments,
        formInstallmentAmount,
        formDueDay
      );
    }

    const paidCount = installments.filter((i) => i.isPaid).length;

    const newLoan: LoanItem = {
      id,
      title: formTitle.trim(),
      lender: formLender.trim() || 'بانک / موسسه',
      totalAmount: formTotalAmount,
      installmentAmount: formInstallmentAmount,
      totalInstallments: formTotalInstallments,
      paidInstallments: paidCount,
      interestRate: formInterestRate,
      startDate: formStartDate,
      dueDay: formDueDay,
      status: paidCount >= formTotalInstallments ? 'completed' : 'active',
      notes: formNotes.trim(),
      installments,
      createdAt: editingLoan ? editingLoan.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = LoanService.saveLoanItem(username, newLoan);
    setLoans(updated);
    setIsAddModalOpen(false);
    setExpandedLoanId(id);
  };

  // Delete Loan
  const handleDeleteLoan = (id: string) => {
    if (window.confirm('آیا از حذف این وام و تمام اقساط آن مطمئن هستید؟ این عملیات غیرقابل بازگشت است.')) {
      const updated = LoanService.deleteLoanItem(username, id);
      setLoans(updated);
      if (expandedLoanId === id) setExpandedLoanId(null);
    }
  };

  // Submit Installment Payment with Tracking Code
  const handleConfirmInstallmentPayment = () => {
    if (!payingInstallment) return;
    const updated = LoanService.toggleInstallmentPaid(
      username,
      payingInstallment.loanId,
      payingInstallment.installmentNumber,
      trackingCodeInput.trim() || undefined
    );
    setLoans(updated);
    setPayingInstallment(null);
    setTrackingCodeInput('');
  };

  // Toggle Installment Payment directly if already paid
  const handleToggleOrPay = (loanId: string, inst: LoanInstallment) => {
    if (inst.isPaid) {
      // Toggle back to unpaid
      const updated = LoanService.toggleInstallmentPaid(username, loanId, inst.number);
      setLoans(updated);
    } else {
      // Open quick modal to confirm payment and optional tracking code
      setPayingInstallment({
        loanId,
        installmentNumber: inst.number,
        amount: inst.amount,
        dueDate: inst.dueDate,
      });
      setTrackingCodeInput('');
    }
  };

  // Export JSON
  const handleDownloadJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(loans, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `ghest-loans-${username}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          LoanService.saveLoans(username, parsed);
          setLoans(parsed);
          setBackupMsg('اطلاعات با موفقیت بازیابی شد.');
          setTimeout(() => setBackupMsg(''), 3000);
        } else {
          setBackupMsg('فرمت فایل نامعتبر است.');
        }
      } catch {
        setBackupMsg('خطا در خواندن فایل.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Banner - Fully native & integrated with current user's vault */}
      <div 
        className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-[#121A2C] via-[#162238] to-[#121A2C] border border-[#1F2B47] shadow-xl flex flex-col md:flex-row items-center justify-between gap-4"
        style={{ borderColor: 'var(--ui-border)', backgroundColor: 'var(--ui-surface)' }}
      >
        <div className="flex items-center gap-3.5 text-right w-full md:w-auto">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0EA5E9] to-[#38E1FF] border border-white/20 p-1 flex items-center justify-center text-white shrink-0 shadow-lg shadow-[#0EA5E9]/20">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-base sm:text-lg text-white">
                مدیریت اقساط و وام‌ها
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                اختصاصی {currentUser.displayName || currentUser.username}
              </span>
            </div>
            <p className="text-xs text-[#94A2C2] mt-1" style={{ color: 'var(--ui-text-secondary)' }}>
              ثبت وام‌ها، برنامه زمان‌بندی اقساط ماهانه، ثبت کدرهگیری پرداخت و محاسبه سود بانکی به صورت کاملاً مستقل
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={() => setIsCalculatorOpen(true)}
            className="py-2.5 px-3.5 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-[#38E1FF] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
          >
            <Calculator className="w-4 h-4" />
            <span>محاسبه‌گر وام</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBackupModalOpen(true)}
            className="py-2.5 px-3.5 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-[#94A2C2] hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
          >
            <Download className="w-4 h-4" />
            <span>پشتیبان‌گیری</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#8A5CFF] text-white text-xs font-bold shadow-lg shadow-[#4F7CFF]/20 hover:opacity-95 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت وام جدید</span>
          </button>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Debt */}
        <div 
          className="p-4 rounded-2xl bg-[#121A2C] border border-[#1F2B47] shadow-sm relative overflow-hidden"
          style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
        >
          <div className="flex items-center justify-between text-xs text-[#94A2C2] mb-1" style={{ color: 'var(--ui-text-secondary)' }}>
            <span>کل مبلغ وام‌ها</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-white mt-1">
            {LoanService.formatCurrency(stats.totalDebt)}
          </div>
          <div className="text-[11px] text-[#5D6B8F] mt-1 flex items-center gap-1">
            <span>{LoanService.formatNumber(stats.activeLoansCount)} وام فعال</span>
          </div>
        </div>

        {/* Card 2: Remaining Debt */}
        <div 
          className="p-4 rounded-2xl bg-[#121A2C] border border-[#1F2B47] shadow-sm relative overflow-hidden"
          style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
        >
          <div className="flex items-center justify-between text-xs text-[#94A2C2] mb-1" style={{ color: 'var(--ui-text-secondary)' }}>
            <span>مانده بدهی</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-amber-400 mt-1">
            {LoanService.formatCurrency(stats.remaining)}
          </div>
          <div className="text-[11px] text-[#5D6B8F] mt-1 flex items-center gap-1">
            <span>{LoanService.formatNumber(stats.totalInstallmentsCount - stats.paidInstallmentsCount)} قسط باقی‌مانده</span>
          </div>
        </div>

        {/* Card 3: Paid amount & Progress */}
        <div 
          className="p-4 rounded-2xl bg-[#121A2C] border border-[#1F2B47] shadow-sm relative overflow-hidden"
          style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
        >
          <div className="flex items-center justify-between text-xs text-[#94A2C2] mb-1" style={{ color: 'var(--ui-text-secondary)' }}>
            <span>پرداخت‌شده ({stats.percent}٪)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-400 mt-1">
            {LoanService.formatCurrency(stats.totalPaid)}
          </div>
          <div className="w-full bg-[#1F2B47] h-1.5 rounded-full mt-2 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-[#38E1FF] h-full rounded-full transition-all duration-500"
              style={{ width: `${stats.percent}%` }}
            />
          </div>
        </div>

        {/* Card 4: This Month Due */}
        <div 
          className="p-4 rounded-2xl bg-[#121A2C] border border-[#1F2B47] shadow-sm relative overflow-hidden"
          style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
        >
          <div className="flex items-center justify-between text-xs text-[#94A2C2] mb-1" style={{ color: 'var(--ui-text-secondary)' }}>
            <span>قسط سررسید ماه جاری</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-[#38E1FF] mt-1">
            {LoanService.formatCurrency(stats.thisMonthDue)}
          </div>
          <div className="text-[11px] text-[#5D6B8F] mt-1 flex items-center gap-1">
            <span>مجموع اقساط نزدیک</span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در عنوان وام، بانک، توضیحات..."
            className="w-full bg-[#121A2C] border border-[#1F2B47] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF] transition"
            style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          />
          <Search className="w-4 h-4 text-[#5D6B8F] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#4F7CFF] text-white shadow-md'
                : 'bg-[#121A2C] text-[#94A2C2] hover:text-white border border-[#1F2B47]'
            }`}
            style={{ backgroundColor: statusFilter === 'all' ? undefined : 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          >
            همه ({loans.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-[#4F7CFF] text-white shadow-md'
                : 'bg-[#121A2C] text-[#94A2C2] hover:text-white border border-[#1F2B47]'
            }`}
            style={{ backgroundColor: statusFilter === 'active' ? undefined : 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          >
            در حال پرداخت
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('near-due')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'near-due'
                ? 'bg-[#4F7CFF] text-white shadow-md'
                : 'bg-[#121A2C] text-[#94A2C2] hover:text-white border border-[#1F2B47]'
            }`}
            style={{ backgroundColor: statusFilter === 'near-due' ? undefined : 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          >
            دارای قسط سررسید
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'completed'
                ? 'bg-[#4F7CFF] text-white shadow-md'
                : 'bg-[#121A2C] text-[#94A2C2] hover:text-white border border-[#1F2B47]'
            }`}
            style={{ backgroundColor: statusFilter === 'completed' ? undefined : 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          >
            تسویه‌شده
          </button>
        </div>
      </div>

      {/* Loans List */}
      {filteredLoans.length === 0 ? (
        <div 
          className="p-12 text-center rounded-3xl bg-[#121A2C] border border-[#1F2B47] space-y-4 shadow-sm"
          style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
        >
          <div className="w-16 h-16 rounded-2xl bg-[#0F1524] border border-[#1F2B47] mx-auto flex items-center justify-center text-[#94A2C2]">
            <CreditCard className="w-8 h-8 opacity-60" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">هیچ وامی برای کاربر {currentUser.displayName || currentUser.username} یافت نشد</h3>
            <p className="text-xs text-[#94A2C2] mt-1" style={{ color: 'var(--ui-text-secondary)' }}>
              با کلیک روی «ثبت وام جدید» اولین قسط یا تسهیلات خود را اضافه کنید.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#8A5CFF] text-white text-xs font-bold shadow-lg hover:opacity-95 transition cursor-pointer"
          >
            + ثبت اولین وام
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLoans.map((loan) => {
            const isExpanded = expandedLoanId === loan.id;
            const progress = loan.totalInstallments > 0
              ? Math.round(((loan.paidInstallments || 0) / loan.totalInstallments) * 100)
              : 0;
            const remainingCount = Math.max(0, loan.totalInstallments - (loan.paidInstallments || 0));

            return (
              <div
                key={loan.id}
                className="rounded-3xl bg-[#121A2C] border border-[#1F2B47] shadow-sm overflow-hidden transition"
                style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
              >
                {/* Main Card Header */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md ${
                      loan.status === 'completed'
                        ? 'bg-gradient-to-tr from-emerald-600 to-emerald-400'
                        : 'bg-gradient-to-tr from-[#4F7CFF] to-[#38E1FF]'
                    }`}>
                      {loan.status === 'completed' ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <CreditCard className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-sm sm:text-base text-white">
                          {loan.title}
                        </h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          loan.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}>
                          {loan.status === 'completed' ? 'تسویه شده' : 'در حال پرداخت'}
                        </span>
                        {loan.interestRate !== undefined && loan.interestRate > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            سود {loan.interestRate}٪
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#94A2C2] mt-1" style={{ color: 'var(--ui-text-secondary)' }}>
                        <span>طرف حساب: <strong className="text-white">{loan.lender}</strong></span>
                        <span className="hidden sm:inline">•</span>
                        <span className="whitespace-nowrap">هر قسط: <strong className="text-white tabular-nums">{LoanService.formatCurrency(loan.installmentAmount)}</strong></span>
                        <span className="hidden sm:inline">•</span>
                        <span>سررسید: هر ماه روز {LoanService.formatNumber(loan.dueDay)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Stats & Expand Toggle */}
                  <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-[#1F2B47]" style={{ borderColor: 'var(--ui-border)' }}>
                    <div className="text-right min-w-0">
                      <div className="text-xs text-[#94A2C2] whitespace-nowrap" style={{ color: 'var(--ui-text-secondary)' }}>
                        پیشرفت: {LoanService.formatNumber(loan.paidInstallments || 0)} از {LoanService.formatNumber(loan.totalInstallments)} قسط
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-24 sm:w-32 bg-[#1F2B47] h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              loan.status === 'completed' ? 'bg-emerald-400' : 'bg-gradient-to-r from-[#4F7CFF] to-[#38E1FF]'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-white">{progress}٪</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenAddModal(loan)}
                        className="p-2 rounded-xl bg-[#0F1524] hover:bg-[#182239] text-[#94A2C2] hover:text-white transition cursor-pointer"
                        title="ویرایش وام"
                        style={{ backgroundColor: 'var(--ui-surface-subtle)' }}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLoan(loan.id)}
                        className="p-2 rounded-xl bg-[#0F1524] hover:bg-rose-500/20 text-[#94A2C2] hover:text-rose-400 transition cursor-pointer"
                        title="حذف وام"
                        style={{ backgroundColor: 'var(--ui-surface-subtle)' }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)}
                        className="py-2 px-3 rounded-xl bg-[#0F1524] hover:bg-[#182239] text-[#38E1FF] text-xs font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        style={{ backgroundColor: 'var(--ui-surface-subtle)' }}
                      >
                        <span>{isExpanded ? 'بستن' : 'اقساط'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Section: Installments Amortization List */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-[#1F2B47] bg-[#0C1220]/60 space-y-4" style={{ borderColor: 'var(--ui-border)' }}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="text-[#94A2C2] flex items-center gap-2" style={{ color: 'var(--ui-text-secondary)' }}>
                        <Calendar className="w-4 h-4 text-[#4F7CFF]" />
                        <span>جدول سررسید اقساط ماهانه ({loan.totalInstallments} قسط):</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1 bg-[#070A12] p-1 rounded-xl border border-[#1F2B47] shrink-0">
                          <button
                            type="button"
                            onClick={() => setAmortizationViewMode('table')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                              amortizationViewMode === 'table' ? 'bg-[#4F7CFF] text-white' : 'text-[#94A2C2] hover:text-white'
                            }`}
                          >
                            جدول اقساط
                          </button>
                          <button
                            type="button"
                            onClick={() => setAmortizationViewMode('cards')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                              amortizationViewMode === 'cards' ? 'bg-[#4F7CFF] text-white' : 'text-[#94A2C2] hover:text-white'
                            }`}
                          >
                            نمای کارتی
                          </button>
                        </div>
                        <span className="text-[#94A2C2] whitespace-nowrap">باقی‌مانده: <strong className="text-white tabular-nums">{LoanService.formatCurrency(remainingCount * loan.installmentAmount)}</strong></span>
                      </div>
                    </div>

                    {loan.notes && (
                      <div className="p-3 rounded-xl bg-[#121A2C] border border-[#1F2B47] text-xs text-[#94A2C2] flex items-start gap-2" style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}>
                        <FileText className="w-4 h-4 text-[#38E1FF] shrink-0 mt-0.5" />
                        <span>{loan.notes}</span>
                      </div>
                    )}

                    {/* View 1: Detailed Table View */}
                    {amortizationViewMode === 'table' ? (
                      <>
                      {/* Mobile: compact rows that always fit the screen */}
                      <div className="sm:hidden rounded-2xl border border-[#1F2B47] bg-[#070A12]/60 divide-y divide-[#1F2B47]/50 overflow-hidden" style={{ borderColor: 'var(--ui-border)' }}>
                        {(loan.installments || []).map((inst) => (
                          <div key={inst.number} className={`flex items-center gap-3 px-3 py-2.5 ${inst.isPaid ? 'bg-emerald-500/[0.04]' : ''}`}>
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold tabular-nums shrink-0 ${
                              inst.isPaid ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-white'
                            }`}>
                              {inst.number}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-bold text-white tabular-nums whitespace-nowrap">
                                {LoanService.formatCurrency(inst.amount)}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] mt-0.5 whitespace-nowrap">
                                <span className="font-mono text-[#38E1FF] tabular-nums">{inst.dueDate}</span>
                                <span className={`px-1.5 py-px rounded-full text-[10px] font-bold ${
                                  inst.isPaid ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-300 bg-amber-500/10'
                                }`}>
                                  {inst.isPaid ? 'پرداخت شده' : 'در انتظار'}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleOrPay(loan.id, inst)}
                              className={`shrink-0 py-1.5 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                                inst.isPaid
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-[#4F7CFF] text-white'
                              }`}
                            >
                              {inst.isPaid ? <Check className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                              <span>{inst.isPaid ? 'لغو' : 'پرداخت'}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="hidden sm:block overflow-x-auto rounded-2xl border border-[#1F2B47] bg-[#070A12]/60">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="border-b border-[#1F2B47] text-[#94A2C2] bg-white/[0.02]">
                              <th className="py-2.5 px-3">#</th>
                              <th className="py-2.5 px-3">سررسید</th>
                              <th className="py-2.5 px-3">مبلغ قسط</th>
                              <th className="py-2.5 px-3 hidden md:table-cell">سهم اصل</th>
                              <th className="py-2.5 px-3 hidden md:table-cell">سهم سود</th>
                              <th className="py-2.5 px-3 hidden sm:table-cell">مانده</th>
                              <th className="py-2.5 px-3">وضعیت</th>
                              <th className="py-2.5 px-3 text-left">عملیات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1F2B47]/40 font-mono">
                            {(loan.installments || []).map((inst) => (
                              <tr key={inst.number} className={`hover:bg-white/[0.02] ${inst.isPaid ? 'bg-emerald-500/[0.03]' : ''}`}>
                                <td className="py-2.5 px-3 text-white font-bold">{inst.number}</td>
                                <td className="py-2.5 px-3 text-[#38E1FF]">{inst.dueDate}</td>
                                <td className="py-2.5 px-3 font-bold text-white">{LoanService.formatCurrency(inst.amount)}</td>
                                <td className="py-2.5 px-3 text-emerald-400 hidden md:table-cell">
                                  {LoanService.formatCurrency(inst.principalPart || Math.round(loan.totalAmount / loan.totalInstallments))}
                                </td>
                                <td className="py-2.5 px-3 text-amber-300 hidden md:table-cell">
                                  {LoanService.formatCurrency(inst.interestPart || 0)}
                                </td>
                                <td className="py-2.5 px-3 text-[#94A2C2] hidden sm:table-cell">
                                  {LoanService.formatCurrency(inst.remainingBalance || 0)}
                                </td>
                                <td className="py-2.5 px-3 font-sans">
                                  {inst.isPaid ? (
                                    <span className="whitespace-nowrap text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                      پرداخت شده {inst.trackingCode ? `(${inst.trackingCode})` : ''}
                                    </span>
                                  ) : (
                                    <span className="whitespace-nowrap text-[10px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                      در انتظار
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-left font-sans">
                                  <div className="flex items-center gap-1.5 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleOrPay(loan.id, inst)}
                                      className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                                        inst.isPaid
                                          ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                          : 'bg-[#4F7CFF] text-white hover:bg-[#3E65DC]'
                                      }`}
                                    >
                                      {inst.isPaid ? <Check className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                                      <span>{inst.isPaid ? 'لغو' : 'پرداخت'}</span>
                                    </button>

                                    {!inst.isPaid && inst.number > 1 && (
                                      <button
                                        type="button"
                                        title={`تسویه همه اقساط تا قسط ${inst.number}`}
                                        onClick={() => {
                                          if (window.confirm(`آیا می‌خواهید تمام اقساط تا قسط شماره ${inst.number} به عنوان پرداخت‌شده ثبت شوند؟`)) {
                                            const updated = LoanService.payUpToInstallment(username, loan.id, inst.number);
                                            setLoans(updated);
                                          }
                                        }}
                                        className="py-1 px-2 rounded-lg text-[10px] text-[#94A2C2] hover:text-white bg-white/5 hover:bg-white/10 transition cursor-pointer"
                                      >
                                        تا اینجا
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      </>
                    ) : (
                      /* View 2: Cards Grid View */
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {(loan.installments || []).map((inst) => (
                        <div
                          key={inst.number}
                          className={`p-3 rounded-2xl border transition flex items-center justify-between ${
                            inst.isPaid
                              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                              : 'bg-[#121A2C] border-[#1F2B47] text-white'
                          }`}
                          style={{
                            backgroundColor: inst.isPaid ? undefined : 'var(--ui-surface)',
                            borderColor: inst.isPaid ? undefined : 'var(--ui-border)',
                          }}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs">
                                قسط {LoanService.formatNumber(inst.number)}
                              </span>
                              <span className="text-[11px] font-mono opacity-80">
                                {inst.dueDate}
                              </span>
                            </div>
                            <div className="text-xs font-black">
                              {LoanService.formatCurrency(inst.amount)}
                            </div>
                            {inst.isPaid && inst.trackingCode && (
                              <div className="text-[10px] text-emerald-400 font-mono">
                                پیگیری: {inst.trackingCode}
                              </div>
                            )}
                            {inst.isPaid && inst.paidAt && (
                              <div className="text-[10px] opacity-70">
                                پرداخت: {inst.paidAt}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleOrPay(loan.id, inst)}
                            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
                              inst.isPaid
                                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40'
                                : 'bg-[#4F7CFF] hover:bg-[#3d65dc] text-white shadow-[#4F7CFF]/20'
                            }`}
                          >
                            {inst.isPaid ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>پرداخت شده</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>ثبت پرداخت</span>
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal 1: Add / Edit Loan */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div 
            className="w-full max-w-lg rounded-3xl bg-[#121A2C] border border-[#1F2B47] shadow-2xl p-6 text-right overflow-y-auto max-h-[90vh]"
            style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#1F2B47]" style={{ borderColor: 'var(--ui-border)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#4F7CFF] to-[#38E1FF] flex items-center justify-center text-white">
                  <CreditCard className="w-4 h-4" />
                </div>
                <h3 className="font-black text-sm text-white">
                  {editingLoan ? 'ویرایش اطلاعات وام' : 'ثبت وام و اقساط جدید'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-[#94A2C2] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLoan} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                  عنوان وام یا خرید اقساطی *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="مثال: خرید لپ‌تاپ دیجی‌پی، وام قرض‌الحسنه مهر..."
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                  طرف حساب یا بانک وام‌دهنده
                </label>
                <input
                  type="text"
                  value={formLender}
                  onChange={(e) => setFormLender(e.target.value)}
                  placeholder="مثال: بانک تجارت، اسنپ‌پی، بستگان..."
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                    کل مبلغ وام (تومان) *
                  </label>
                  <FormattedNumberInput
                    value={formTotalAmount}
                    onChange={(val) => setFormTotalAmount(val)}
                    placeholder="مثال: 50,000,000"
                    unitLabel="تومان"
                    className="bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                    نرخ سود سالانه (٪)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formInterestRate}
                    onChange={(e) => setFormInterestRate(Number(e.target.value))}
                    placeholder="۰ برای قرض‌الحسنه"
                    className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                    تعداد کل اقساط (ماه) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={360}
                    value={formTotalInstallments}
                    onChange={(e) => setFormTotalInstallments(Number(e.target.value))}
                    className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#94A2C2]">
                      مبلغ هر قسط (تومان) *
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoCalcInForm}
                      className="text-[10px] text-[#38E1FF] hover:underline"
                    >
                      محاسبه خودکار
                    </button>
                  </div>
                  <FormattedNumberInput
                    value={formInstallmentAmount}
                    onChange={(val) => setFormInstallmentAmount(val)}
                    placeholder="مثال: 3,500,000"
                    unitLabel="تومان"
                    className="bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                    تاریخ شروع اولین قسط
                  </label>
                  <JalaliDatePicker
                    value={formStartDate}
                    onChange={(v) => {
                      setFormStartDate(v);
                      // Due day follows the first installment's day of month
                      const d = parseInt(v.split('/')[2], 10);
                      if (d >= 1 && d <= 31) setFormDueDay(d);
                    }}
                    className="bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                    روز سررسید در ماه
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={formDueDay}
                    onChange={(e) => setFormDueDay(Number(e.target.value))}
                    className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                  توضیحات و شماره شبا / پیگیری
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="یادداشت‌های اختصاصی، شماره حساب یا شبا برای پرداخت..."
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl bg-[#0F1524] hover:bg-[#182239] text-[#94A2C2] text-xs font-bold transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#8A5CFF] text-white text-xs font-bold shadow-lg shadow-[#4F7CFF]/20 hover:opacity-95 transition cursor-pointer"
                >
                  {editingLoan ? 'ذخیره تغییرات' : 'ثبت و ایجاد اقساط'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Banking Loan Calculator */}
      {isCalculatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div 
            className="w-full max-w-md rounded-3xl bg-[#121A2C] border border-[#1F2B47] shadow-2xl p-6 text-right"
            style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#1F2B47]" style={{ borderColor: 'var(--ui-border)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#38E1FF] to-[#4F7CFF] flex items-center justify-center text-white">
                  <Calculator className="w-4 h-4" />
                </div>
                <h3 className="font-black text-sm text-white">محاسبه‌گر اقساط و سود بانکی</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCalculatorOpen(false)}
                className="p-1 rounded-lg text-[#94A2C2] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                  مبلغ وام (تومان):
                </label>
                <FormattedNumberInput
                  value={calcAmount}
                  onChange={(val) => setCalcAmount(val)}
                  placeholder="مثال: 50,000,000"
                  unitLabel="تومان"
                  className="bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                  نرخ سود سالانه: {calcRate}٪ (برای قرض‌الحسنه ۰ یا ۴ درصد وارد کنید)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={calcRate}
                  onChange={(e) => setCalcRate(Number(e.target.value))}
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                  مدت بازپرداخت (ماه): {calcMonths} ماه
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={calcMonths}
                  onChange={(e) => setCalcMonths(Number(e.target.value))}
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2 text-xs text-white"
                />
              </div>

              {/* Result Box */}
              <div className="p-4 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#94A2C2]">مبلغ هر قسط ماهانه:</span>
                  <span className="font-black text-sm text-[#38E1FF]">
                    {LoanService.formatCurrency(calcResult.monthlyPayment)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#94A2C2]">کل سود پرداختی:</span>
                  <span className="font-bold text-amber-400">
                    {LoanService.formatCurrency(calcResult.totalInterest)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-[#1F2B47]">
                  <span className="text-[#94A2C2]">کل بازپرداخت (اصل + سود):</span>
                  <span className="font-black text-white">
                    {LoanService.formatCurrency(calcResult.totalRepayment)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setFormTotalAmount(calcAmount);
                  setFormInterestRate(calcRate);
                  setFormTotalInstallments(calcMonths);
                  setFormInstallmentAmount(calcResult.monthlyPayment);
                  setIsCalculatorOpen(false);
                  setIsAddModalOpen(true);
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#8A5CFF] text-white text-xs font-bold transition hover:opacity-95 cursor-pointer"
              >
                انتقال مقادیر به فرم ثبت وام جدید
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Payment Tracking Confirmation */}
      {payingInstallment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div 
            className="w-full max-w-sm rounded-3xl bg-[#121A2C] border border-[#1F2B47] shadow-2xl p-6 text-right"
            style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1F2B47]" style={{ borderColor: 'var(--ui-border)' }}>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>ثبت پرداخت قسط {LoanService.formatNumber(payingInstallment.installmentNumber)}</span>
              </h3>
              <button
                type="button"
                onClick={() => setPayingInstallment(null)}
                className="p-1 rounded-lg text-[#94A2C2] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-xl bg-[#0F1524] text-xs space-y-1">
                <div className="flex justify-between text-[#94A2C2]">
                  <span>مبلغ قسط:</span>
                  <span className="font-bold text-white">{LoanService.formatCurrency(payingInstallment.amount)}</span>
                </div>
                <div className="flex justify-between text-[#94A2C2]">
                  <span>سررسید:</span>
                  <span className="font-mono text-white">{payingInstallment.dueDate}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                  کد رهگیری یا شماره ارجاع بانکی (اختیاری)
                </label>
                <input
                  type="text"
                  value={trackingCodeInput}
                  onChange={(e) => setTrackingCodeInput(e.target.value)}
                  placeholder="مثال: 98124508"
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayingInstallment(null)}
                  className="py-2 px-3.5 rounded-xl bg-[#0F1524] text-[#94A2C2] text-xs font-bold"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleConfirmInstallmentPayment}
                  className="py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 transition cursor-pointer"
                >
                  تایید و ثبت پرداخت
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Backup / Export / Import JSON */}
      {isBackupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div 
            className="w-full max-w-md rounded-3xl bg-[#121A2C] border border-[#1F2B47] shadow-2xl p-6 text-right"
            style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#1F2B47]" style={{ borderColor: 'var(--ui-border)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#4F7CFF] to-[#38E1FF] flex items-center justify-center text-white">
                  <Download className="w-4 h-4" />
                </div>
                <h3 className="font-black text-sm text-white">پشتیبان‌گیری اقساط و وام‌ها</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(false)}
                className="p-1 rounded-lg text-[#94A2C2] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <p className="text-[#94A2C2]">
                می‌توانید اطلاعات وام‌ها و وضعیت پرداخت اقساط حساب <strong className="text-white">{currentUser.username}</strong> را در قالب فایل JSON دانلود کنید یا از روی فایل نسخه پشتیبان بازیابی نمایید.
              </p>

              {backupMsg && (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold">
                  {backupMsg}
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadJSON}
                  className="w-full py-3 px-4 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#38E1FF]" />
                  <span>دانلود فایل پشتیبان اقساط (JSON)</span>
                </button>

                <label className="w-full py-3 px-4 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-white font-bold flex items-center justify-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4 text-[#4F7CFF]" />
                  <span>بازیابی از فایل پشتیبان JSON</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJSON}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
