/**
 * Telegram Notification & Bot Integration Service
 * Allows sending due alerts for loans, installments, domains and hosting renewals
 * via Telegram Bot API with token & chat ID.
 */
import { TelegramSettings, LoanItem, HostingDomainItem } from '../types';
import { compareJalaliDates, getCurrentJalali } from '../utils/jalali';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { SecureStore } from './secureStore';

const TELEGRAM_STORAGE_PREFIX = 'keeppass_telegram_user_';

export class TelegramService {
  private static getKey(username: string): string {
    return `${TELEGRAM_STORAGE_PREFIX}${username.trim().toLowerCase()}`;
  }

  /**
   * Retrieve saved Telegram settings for user
   */
  static getSettings(username: string): TelegramSettings {
    const raw = SecureStore.getItem(this.getKey(username));
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // fallback
      }
    }

    return {
      enabled: false,
      botToken: '',
      chatId: '',
      alertDaysBefore: 3,
      notifyHour: 9,
      sendLoansAlerts: true,
      sendHostAlerts: true,
      autoCheckEnabled: false,
    };
  }

  /**
   * Save Telegram settings
   */
  static saveSettings(username: string, settings: TelegramSettings): void {
    SecureStore.setItem(this.getKey(username), JSON.stringify(settings));
  }

  /**
   * Send a test message to verify Bot Token and Chat ID
   */
  static async testConnection(botToken: string, chatId: string): Promise<{ success: boolean; message: string }> {
    const cleanToken = botToken.trim();
    const cleanChatId = chatId.trim();

    if (!cleanToken || !cleanChatId) {
      return { success: false, message: 'لطفاً توکن ربات و شناسه چت (Chat ID) را وارد نمایید.' };
    }

    const testText = `🤖 <b>اتصال سامانه KeepPass & Ghest به تلگرام با موفقیت برقرار شد!</b>\n\n📅 تاریخ شمسی: <code>${getCurrentJalali().fullTitle}</code>\n🔔 هشدارهای سررسید اقساط و هاست‌ها از این پس به این چت ارسال خواهند شد.\n\n✨ <i>KeepPass Vault & Financial Manager</i>`;

    return this.sendMessage(cleanToken, cleanChatId, testText);
  }

  /**
   * Core message sender - tries the Cloudflare Worker proxy first (avoiding CORS/firewalls),
   * then falls back to direct browser fetch if server route is unavailable.
   */
  static async sendMessage(botToken: string, chatId: string, text: string): Promise<{ success: boolean; message: string }> {
    const cleanToken = botToken.trim();
    const cleanChatId = chatId.trim();

    if (!cleanToken || !cleanChatId) {
      return { success: false, message: 'توکن ربات یا شناسه چت خالی است.' };
    }

    // 1. Try server-side proxy
    try {
      const serverRes = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: cleanToken,
          chatId: cleanChatId,
          text: text,
          parseMode: 'HTML',
        }),
      });

      if (serverRes.ok) {
        const data = await serverRes.json();
        if (data.ok || data.success) {
          return { success: true, message: 'پیام با موفقیت به تلگرام ارسال شد.' };
        } else {
          return { success: false, message: data.description || data.error || 'خطا در پاسخ ربات تلگرام.' };
        }
      }
    } catch {
      // Continue to direct fallback
    }

    // 2. Client-side fallback to direct Telegram Bot API
    try {
      const directUrl = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
      const directRes = await fetch(directUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: text,
          parse_mode: 'HTML',
        }),
      });

      const resData = await directRes.json();
      if (resData.ok) {
        return { success: true, message: 'پیام با موفقیت به تلگرام ارسال شد.' };
      } else {
        return { success: false, message: resData.description || 'خطا در ارسال پیام تلگرام.' };
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'خطای شبکه';
      return { 
        success: false, 
        message: `خطا در برقراری ارتباط با سرور تلگرام: ${errMsg}. لطفاً از اتصال اینترنت یا فعال بودن فیلترشکن خود اطمینان حاصل کنید.` 
      };
    }
  }

  /**
   * Send a single hosting domain renewal notification
   */
  static async sendHostingAlert(settings: TelegramSettings, item: HostingDomainItem): Promise<{ success: boolean; message: string }> {
    if (!settings.botToken || !settings.chatId) {
      return { success: false, message: 'تنظیمات ربات تلگرام پیکربندی نشده است.' };
    }

    const diffDays = compareJalaliDates(item.renewalDate);
    const statusText = diffDays < 0 
      ? `🚨 <b>منقضی شده (${Math.abs(diffDays)} روز قبل)</b>` 
      : diffDays === 0 
      ? `⚠️ <b>امروز موعد تمدید است!</b>` 
      : `⏳ <b>${diffDays} روز تا سررسید تمدید</b>`;

    const text = `🌐 <b>هشدار سررسید سرویس اینترنتی / هاست</b>\n\n` +
      `📌 <b>عنوان / دامنه:</b> <code>${item.name}</code>\n` +
      `🏷 <b>نوع سرویس:</b> ${item.type === 'domain' ? 'دامنه اینترنتی' : item.type === 'host' ? 'هاست میزبانی' : item.type === 'vps' ? 'سرور ابری / VPS' : 'گواهی امنیتی'}\n` +
      `🏢 <b>ثبت‌کننده / شرکت:</b> ${item.provider}\n` +
      `📅 <b>تاریخ سررسید:</b> <code>${item.renewalDate}</code>\n` +
      `💰 <b>هزینه تمدید:</b> <code>${formatCurrency(item.cost)}</code>\n` +
      `🔄 <b>وضعیت:</b> ${statusText}\n` +
      (item.dnsOrIp ? `🌐 <b>IP / نیم‌سرور:</b> <code>${item.dnsOrIp}</code>\n` : '') +
      (item.loginUrl ? `🔗 <b>پنل مدیریت:</b> ${item.loginUrl}\n` : '') +
      (item.notes ? `📝 <b>یادداشت:</b> ${item.notes}\n` : '') +
      `\n🔐 <i>KeepPass & Ghest Manager</i>`;

    return this.sendMessage(settings.botToken, settings.chatId, text);
  }

  /**
   * Generates and sends a comprehensive alert report of upcoming loans and hosting items
   */
  static async sendDueAlertsSummary(
    settings: TelegramSettings,
    loans: LoanItem[],
    hostings: HostingDomainItem[]
  ): Promise<{ success: boolean; message: string; count: number }> {
    if (!settings.botToken || !settings.chatId) {
      return { success: false, message: 'توکن ربات و شناسه چت تنظیم نشده است.', count: 0 };
    }

    const thresholdDays = settings.alertDaysBefore || 3;
    const dueInstallments: { loanTitle: string; lender: string; instNumber: number; amount: number; dueDate: string; diffDays: number }[] = [];
    const dueHostings: { item: HostingDomainItem; diffDays: number }[] = [];

    // 1. Collect loan installments
    if (settings.sendLoansAlerts) {
      loans.forEach((loan) => {
        (loan.installments || []).forEach((inst) => {
          if (!inst.isPaid) {
            const diff = compareJalaliDates(inst.dueDate);
            if (diff <= thresholdDays) {
              dueInstallments.push({
                loanTitle: loan.title,
                lender: loan.lender,
                instNumber: inst.number,
                amount: inst.amount,
                dueDate: inst.dueDate,
                diffDays: diff,
              });
            }
          }
        });
      });
    }

    // 2. Collect hosting items
    if (settings.sendHostAlerts) {
      hostings.forEach((h) => {
        const diff = compareJalaliDates(h.renewalDate);
        if (diff <= thresholdDays) {
          dueHostings.push({ item: h, diffDays: diff });
        }
      });
    }

    const totalCount = dueInstallments.length + dueHostings.length;
    if (totalCount === 0) {
      return { 
        success: true, 
        message: `هیچ سررسیدی برای ${thresholdDays} روز آینده یافت نشد. تمامی اقساط و هاست‌ها به‌روز هستند!`, 
        count: 0 
      };
    }

    // 3. Compose rich message
    let msg = `🔔 <b>گزارش سررسیدهای فوری KeepPass & Ghest</b>\n` +
      `📅 تاریخ امروز: <code>${getCurrentJalali().fullTitle}</code>\n` +
      `🎯 بازه هشدار: سررسیدهای تا ${thresholdDays} روز آینده\n\n`;

    if (dueInstallments.length > 0) {
      msg += `💳 <b>اقساط نیازمند پرداخت (${formatNumber(dueInstallments.length)} قسط):</b>\n`;
      dueInstallments.forEach((it, i) => {
        const status = it.diffDays < 0 ? `🚨 معوقه (${Math.abs(it.diffDays)} روز)` : it.diffDays === 0 ? `⚠️ امروز!` : `⏳ ${it.diffDays} روز دیگر`;
        msg += `${i + 1}. <b>${it.loanTitle}</b> (${it.lender})\n` +
          `   • قسط شماره: <code>${it.instNumber}</code>\n` +
          `   • مبلغ: <code>${formatCurrency(it.amount)}</code>\n` +
          `   • سررسید: <code>${it.dueDate}</code> (${status})\n\n`;
      });
    }

    if (dueHostings.length > 0) {
      msg += `🌐 <b>هاست و دامنه‌های در موعد تمدید (${formatNumber(dueHostings.length)} مورد):</b>\n`;
      dueHostings.forEach((dh, i) => {
        const status = dh.diffDays < 0 ? `🚨 منقضی` : dh.diffDays === 0 ? `⚠️ سررسید امروز` : `⏳ ${dh.diffDays} روز دیگر`;
        msg += `${i + 1}. <b>${dh.item.name}</b> (${dh.item.provider})\n` +
          `   • تاریخ تمدید: <code>${dh.item.renewalDate}</code> (${status})\n` +
          `   • هزینه: <code>${formatCurrency(dh.item.cost)}</code>\n\n`;
      });
    }

    msg += `📊 <i>تعداد کل سررسیدهای نیازمند اقدام: ${formatNumber(totalCount)} مورد</i>\n` +
      `🔐 <i>سامانه امنیتی KeepPass Vault</i>`;

    const res = await this.sendMessage(settings.botToken, settings.chatId, msg);
    return { ...res, count: totalCount };
  }
}
