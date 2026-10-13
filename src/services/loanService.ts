/**
 * Loan & Installment Management Service (Ghest Manager)
 * Fully native & integrated with the user's isolated vault storage (No external server or GitHub dependencies)
 */

import { LoanItem, LoanInstallment } from '../types';
import { StorageService } from './storage';
import { parseJalali } from '../utils/jalali';

export class LoanService {
  /**
   * Retrieves all saved loans for a specific user
   */
  static getLoans(username: string): LoanItem[] {
    if (!username) return [];
    return StorageService.getLoansForUser(username);
  }

  /**
   * Saves updated loans list for a specific user
   */
  static saveLoans(username: string, loans: LoanItem[]): void {
    if (!username) return;
    StorageService.saveLoansForUser(username, loans);
  }

  /**
   * Adds or updates a loan item for a user
   */
  static saveLoanItem(username: string, item: LoanItem): LoanItem[] {
    const list = this.getLoans(username);
    
    // Auto-compute amortization schedule if missing or count changed
    if (!item.installments || item.installments.length !== item.totalInstallments) {
      item.installments = this.generateInstallmentsSchedule(
        item.startDate,
        item.totalInstallments,
        item.installmentAmount,
        item.dueDay,
        item.totalAmount,
        item.interestRate || 0
      );
    }

    const existingIndex = list.findIndex((l) => l.id === item.id);
    if (existingIndex >= 0) {
      // Preserve paid status if editing
      const existing = list[existingIndex];
      if (existing.installments && item.installments) {
        item.installments = item.installments.map((inst, idx) => {
          const oldInst = existing.installments?.[idx];
          if (oldInst) {
            return {
              ...inst,
              isPaid: oldInst.isPaid,
              paidAt: oldInst.paidAt,
              trackingCode: oldInst.trackingCode,
              notes: oldInst.notes || inst.notes,
            };
          }
          return inst;
        });
      }
      item.paidInstallments = (item.installments || []).filter((i) => i.isPaid).length;
      list[existingIndex] = { ...item, updatedAt: new Date().toISOString() };
    } else {
      item.paidInstallments = (item.installments || []).filter((i) => i.isPaid).length;
      list.unshift(item);
    }

    this.saveLoans(username, list);
    return list;
  }

  /**
   * Deletes a loan by ID for a user
   */
  static deleteLoanItem(username: string, id: string): LoanItem[] {
    const list = this.getLoans(username).filter((l) => l.id !== id);
    this.saveLoans(username, list);
    return list;
  }

  /**
   * Toggles payment status of a specific installment
   */
  static toggleInstallmentPaid(
    username: string,
    loanId: string,
    installmentNumber: number,
    trackingCode?: string,
    notes?: string
  ): LoanItem[] {
    const list = this.getLoans(username);
    const loan = list.find((l) => l.id === loanId);
    if (!loan) return list;

    if (!loan.installments || loan.installments.length === 0) {
      loan.installments = this.generateInstallmentsSchedule(
        loan.startDate,
        loan.totalInstallments,
        loan.installmentAmount,
        loan.dueDay,
        loan.totalAmount,
        loan.interestRate || 0
      );
    }

    const inst = loan.installments.find((i) => i.number === installmentNumber);
    if (inst) {
      const willBePaid = !inst.isPaid;
      inst.isPaid = willBePaid;
      if (willBePaid) {
        inst.paidAt = new Date().toLocaleDateString('fa-IR');
        if (trackingCode) inst.trackingCode = trackingCode;
        if (notes) inst.notes = notes;
      } else {
        inst.paidAt = undefined;
        inst.trackingCode = undefined;
      }
    }

    // Recalculate paidInstallments count
    loan.paidInstallments = loan.installments.filter((i) => i.isPaid).length;

    if (loan.paidInstallments >= loan.totalInstallments) {
      loan.status = 'completed';
    } else if (loan.status === 'completed' && loan.paidInstallments < loan.totalInstallments) {
      loan.status = 'active';
    }

    loan.updatedAt = new Date().toISOString();
    this.saveLoans(username, list);
    return list;
  }

  /**
   * Mark all installments up to a given number as paid
   */
  static payUpToInstallment(username: string, loanId: string, targetNumber: number): LoanItem[] {
    const list = this.getLoans(username);
    const loan = list.find((l) => l.id === loanId);
    if (!loan || !loan.installments) return list;

    const todayPersian = new Date().toLocaleDateString('fa-IR');
    loan.installments.forEach((inst) => {
      if (inst.number <= targetNumber) {
        inst.isPaid = true;
        if (!inst.paidAt) inst.paidAt = todayPersian;
      }
    });

    loan.paidInstallments = loan.installments.filter((i) => i.isPaid).length;
    if (loan.paidInstallments >= loan.totalInstallments) {
      loan.status = 'completed';
    }
    loan.updatedAt = new Date().toISOString();
    this.saveLoans(username, list);
    return list;
  }

  /**
   * Generates a monthly schedule with detailed amortization (principal, interest, remaining balance)
   */
  static generateInstallmentsSchedule(
    startDateStr: string,
    count: number,
    amount: number,
    dueDay: number,
    principalTotal?: number,
    annualInterestRate: number = 0
  ): LoanInstallment[] {
    const schedule: LoanInstallment[] = [];
    let startYear = 1403;
    let startMonth = 1;

    // Parse Jalali date like "1403/07/15"
    const parsed = parseJalali(startDateStr);
    if (parsed) {
      startYear = parsed.jy;
      startMonth = parsed.jm;
    }

    let remainingBalance = principalTotal || (amount * count);
    const monthlyRate = (annualInterestRate > 0) ? (annualInterestRate / 12 / 100) : 0;

    for (let i = 1; i <= count; i++) {
      let currentMonth = startMonth + i - 1;
      let currentYear = startYear;

      while (currentMonth > 12) {
        currentMonth -= 12;
        currentYear += 1;
      }

      const formattedMonth = String(currentMonth).padStart(2, '0');
      const formattedDay = String(dueDay || 10).padStart(2, '0');
      const dueDate = `${currentYear}/${formattedMonth}/${formattedDay}`;

      // Amortization calculation
      let interestPart = 0;
      let principalPart = amount;

      if (monthlyRate > 0 && remainingBalance > 0) {
        interestPart = Math.round(remainingBalance * monthlyRate);
        principalPart = Math.max(0, amount - interestPart);
        remainingBalance = Math.max(0, remainingBalance - principalPart);
      } else {
        principalPart = Math.round((principalTotal || (amount * count)) / count);
        interestPart = 0;
        remainingBalance = Math.max(0, remainingBalance - principalPart);
      }

      schedule.push({
        number: i,
        dueDate,
        amount,
        isPaid: false,
        principalPart,
        interestPart,
        remainingBalance,
      });
    }

    return schedule;
  }

  /**
   * Iranian standard banking loan installment formula (Central Bank of Iran)
   */
  static calculateLoanFormula(
    totalAmount: number,
    interestRatePercent: number,
    monthsCount: number
  ): {
    monthlyPayment: number;
    totalInterest: number;
    totalRepayment: number;
  } {
    if (monthsCount <= 0 || totalAmount <= 0) {
      return { monthlyPayment: 0, totalInterest: 0, totalRepayment: 0 };
    }

    if (interestRatePercent <= 0) {
      // Qarz-al-Hasaneh (0% interest, only principal)
      const monthlyPayment = Math.round(totalAmount / monthsCount);
      return {
        monthlyPayment,
        totalInterest: 0,
        totalRepayment: totalAmount,
      };
    }

    // Standard Central Bank of Iran annuity formula:
    // P = [A * r * (1+r)^n] / [(1+r)^n - 1]
    // where r = (annual rate / 12) / 100
    const monthlyRate = interestRatePercent / 12 / 100;
    const factor = Math.pow(1 + monthlyRate, monthsCount);
    const monthlyPayment = Math.round((totalAmount * monthlyRate * factor) / (factor - 1));
    const totalRepayment = monthlyPayment * monthsCount;
    const totalInterest = Math.max(0, totalRepayment - totalAmount);

    return {
      monthlyPayment,
      totalInterest,
      totalRepayment,
    };
  }

  /**
   * Format numbers to Tomans with commas and English digits
   */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US').format(amount || 0) + ' تومان';
  }

  /**
   * Format standard English numbers with commas
   */
  static formatNumber(val: number): string {
    return new Intl.NumberFormat('en-US').format(val || 0);
  }

  /**
   * Export loans to standard CSV
   */
  static exportLoansToCSV(loans: LoanItem[]): string {
    const headers = ['عنوان وام', 'وام‌دهنده/بانک', 'مبلغ کل (تومان)', 'مبلغ قسط', 'تعداد کل اقساط', 'اقساط پرداخت شده', 'درصد سود', 'روز سررسید', 'وضعیت', 'یادداشت'];
    const rows = loans.map((l) => [
      `"${l.title}"`,
      `"${l.lender}"`,
      l.totalAmount,
      l.installmentAmount,
      l.totalInstallments,
      l.paidInstallments,
      l.interestRate || 0,
      l.dueDay,
      `"${l.status === 'active' ? 'در حال پرداخت' : l.status === 'completed' ? 'تسویه شده' : 'متوقف'}"`,
      `"${(l.notes || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
