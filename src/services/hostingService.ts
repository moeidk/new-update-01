/**
 * Hosting, Domains & Cloud Services Persistence and Calculation Service
 * Fully isolated per user.
 */
import { HostingDomainItem, HostingType } from '../types';
import { compareJalaliDates, parseJalali, getCurrentJalali } from '../utils/jalali';

const HOSTING_STORAGE_PREFIX = 'keeppass_hosting_user_';

export class HostingService {
  private static getKey(username: string): string {
    return `${HOSTING_STORAGE_PREFIX}${username.trim().toLowerCase()}`;
  }

  /**
   * Retrieve all hosting & domain items for a specific user
   */
  static getHostingItems(username: string): HostingDomainItem[] {
    const key = this.getKey(username);
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed: HostingDomainItem[] = JSON.parse(raw);
        // Clean out any previously seeded sample items
        const cleaned = parsed.filter(
          (it) => !it.id.startsWith('sample-') &&
                  it.name !== 'siteirdood.ir' &&
                  it.name !== 'هاست ابری پرسرعت cPanel' &&
                  it.name !== 'سرور ابری آلمان Hetzner CX21'
        );
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(key, JSON.stringify(cleaned));
        }
        return this.updateStatuses(cleaned);
      } catch {
        return [];
      }
    }

    return [];
  }

  /**
   * Save or update a hosting/domain item
   */
  static saveHostingItem(username: string, itemData: Partial<HostingDomainItem>): HostingDomainItem[] {
    const items = this.getHostingItems(username);
    const now = new Date().toISOString();
    let updated: HostingDomainItem[];

    if (itemData.id) {
      updated = items.map((it) =>
        it.id === itemData.id
          ? ({ ...it, ...itemData, updatedAt: now } as HostingDomainItem)
          : it
      );
    } else {
      const newItem: HostingDomainItem = {
        id: `host-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: itemData.name || 'سرویس بدون عنوان',
        type: itemData.type || 'domain',
        provider: itemData.provider || 'سایر',
        renewalDate: itemData.renewalDate || getCurrentJalali().str,
        cost: itemData.cost || 0,
        period: itemData.period || 'yearly',
        autoRenew: itemData.autoRenew ?? false,
        dnsOrIp: itemData.dnsOrIp || '',
        loginUrl: itemData.loginUrl || '',
        notes: itemData.notes || '',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      updated = [newItem, ...items];
    }

    const final = this.updateStatuses(updated);
    localStorage.setItem(this.getKey(username), JSON.stringify(final));
    return final;
  }

  /**
   * Delete an item by ID
   */
  static deleteHostingItem(username: string, id: string): HostingDomainItem[] {
    const items = this.getHostingItems(username);
    const filtered = items.filter((it) => it.id !== id);
    localStorage.setItem(this.getKey(username), JSON.stringify(filtered));
    return filtered;
  }

  /**
   * One-click "Renewed" action: advances the Jalali renewal date to next period
   */
  static renewHostingItem(username: string, id: string): HostingDomainItem[] {
    const items = this.getHostingItems(username);
    const updated = items.map((it) => {
      if (it.id !== id) return it;

      const parsed = parseJalali(it.renewalDate);
      let nextDateStr = it.renewalDate;

      if (parsed) {
        if (it.period === 'monthly') {
          let nextM = parsed.jm + 1;
          let nextY = parsed.jy;
          if (nextM > 12) {
            nextM = 1;
            nextY += 1;
          }
          nextDateStr = `${nextY}/${String(nextM).padStart(2, '0')}/${String(parsed.jd).padStart(2, '0')}`;
        } else if (it.period === 'multi-year') {
          nextDateStr = `${parsed.jy + 2}/${String(parsed.jm).padStart(2, '0')}/${String(parsed.jd).padStart(2, '0')}`;
        } else {
          // Yearly
          nextDateStr = `${parsed.jy + 1}/${String(parsed.jm).padStart(2, '0')}/${String(parsed.jd).padStart(2, '0')}`;
        }
      }

      return {
        ...it,
        renewalDate: nextDateStr,
        status: 'active' as const,
        updatedAt: new Date().toISOString(),
      };
    });

    const final = this.updateStatuses(updated);
    localStorage.setItem(this.getKey(username), JSON.stringify(final));
    return final;
  }

  /**
   * Recalculates 'active' | 'expiring' | 'expired' based on today's Jalali date
   */
  private static updateStatuses(items: HostingDomainItem[]): HostingDomainItem[] {
    return items.map((it) => {
      const diffDays = compareJalaliDates(it.renewalDate);
      let status: 'active' | 'expiring' | 'expired' = 'active';

      if (diffDays < 0) {
        status = 'expired';
      } else if (diffDays <= 30) {
        status = 'expiring';
      }

      return { ...it, status };
    });
  }

  /**
   * Computes aggregate metrics for hosting dashboard
   */
  static getStats(items: HostingDomainItem[]) {
    let totalCount = items.length;
    let expiringCount = 0;
    let expiredCount = 0;
    let activeCount = 0;
    let totalCost = 0;

    items.forEach((it) => {
      totalCost += it.cost || 0;
      if (it.status === 'expired') expiredCount++;
      else if (it.status === 'expiring') expiringCount++;
      else activeCount++;
    });

    return {
      totalCount,
      expiringCount,
      expiredCount,
      activeCount,
      totalCost,
    };
  }

  /**
   * Export hosting services to CSV
   */
  static exportToCSV(items: HostingDomainItem[]): string {
    const headers = ['عنوان/دامنه', 'نوع سرویس', 'ارائه‌دهنده', 'تاریخ سررسید', 'هزینه تمدید (تومان)', 'دوره', 'تمدید خودکار', 'آدرس/IP', 'وضعیت', 'یادداشت'];
    const rows = items.map((it) => [
      `"${it.name}"`,
      `"${it.type}"`,
      `"${it.provider}"`,
      it.renewalDate,
      it.cost,
      it.period,
      it.autoRenew ? 'بله' : 'خیر',
      `"${it.dnsOrIp || ''}"`,
      `"${it.status === 'expired' ? 'منقضی شده' : it.status === 'expiring' ? 'نزدیک سررسید' : 'فعال'}"`,
      `"${(it.notes || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Initial sample items for new users (Clean empty)
   */
  private static getInitialSampleItems(_username?: string): HostingDomainItem[] {
    return [];
  }
}
