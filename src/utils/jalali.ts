/**
 * Pure Persian / Jalali Calendar Algorithm & Utilities
 * High-precision algorithm for converting Gregorian dates to Jalali and handling Persian calendar logic.
 */

// Number of days in Jalali months: Farvardin to Shahrivar (31), Mehr to Bahman (30), Esfand (29 or 30 in leap year)
const JALALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

const PERSIAN_WEEKDAYS = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
];

export function isJalaliLeapYear(jy: number): boolean {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  let jp = breaks[0];
  let jump = 0;
  if (jy < jp || jy >= breaks[breaks.length - 1]) return false;
  for (let i = 1; i < breaks.length; i++) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    jp = jm;
  }
  let n = jy - jp;
  if (jump - n < 6) n = n - jump + (Math.floor((jump + 4) / 33) * 33);
  // Same rule as jalaali-js: leap when mod(mod(n + 1, 33) - 1, 4) === 0
  let leap = (((n + 1) % 33) - 1) % 4;
  if (leap === -1) leap = 4;
  return leap === 0;
}

export function getJalaliMonthDays(jy: number, jm: number): number {
  if (jm >= 1 && jm <= 6) return 31;
  if (jm >= 7 && jm <= 11) return 30;
  if (jm === 12) return isJalaliLeapYear(jy) ? 30 : 29;
  return 30;
}

export function gregorianToJalali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  let jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return { jy, jm, jd };
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): Date {
  // Standard Jalali → Gregorian conversion (inverse of gregorianToJalali above).
  // The previous implementation returned dates around the year 5825, which broke weekdays
  // in the calendar and any date arithmetic built on it.
  const jy2 = jy + 1595;
  let days =
    -355668 +
    365 * jy2 +
    Math.floor(jy2 / 33) * 8 +
    Math.floor(((jy2 % 33) + 3) / 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    days--;
    gy += 100 * Math.floor(days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const isLeap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const monthDays = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 12 && gd > monthDays[gm]) {
    gd -= monthDays[gm];
    gm++;
  }
  return new Date(gy, gm, gd);
}

/**
 * Get current Jalali date object
 */
export function getCurrentJalali(): { jy: number; jm: number; jd: number; str: string; fullTitle: string } {
  const now = new Date();
  const j = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const str = `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
  const dayName = getPersianDayOfWeek(now.getDay());
  const monthName = JALALI_MONTH_NAMES[j.jm - 1];
  const fullTitle = `${dayName} ${j.jd} ${monthName} ${j.jy}`;
  return { ...j, str, fullTitle };
}

/**
 * Get day of week name in Persian (0=Sunday to 6=Saturday)
 */
export function getPersianDayOfWeek(gregorianDay: number): string {
  // In JS: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // In Iran: Saturday is index 0
  const mapping: { [key: number]: string } = {
    6: 'شنبه',
    0: 'یکشنبه',
    1: 'دوشنبه',
    2: 'سه‌شنبه',
    3: 'چهارشنبه',
    4: 'پنج‌شنبه',
    5: 'جمعه',
  };
  return mapping[gregorianDay] || 'شنبه';
}

/**
 * First day of a Jalali month in Persian weekday index (0=شنبه, ..., 6=جمعه)
 */
export function getJalaliMonthStartWeekday(jy: number, jm: number): number {
  const gDate = jalaliToGregorian(jy, jm, 1);
  const jsDay = gDate.getDay(); // 0 is Sunday, 6 is Saturday
  // Convert JS Day to Persian (Saturday = 0, Sunday = 1, ..., Friday = 6)
  return (jsDay + 1) % 7;
}

export function getJalaliMonthName(jm: number): string {
  return JALALI_MONTH_NAMES[jm - 1] || '';
}

/**
 * Parse a standard Jalali date string "1403/07/15"
 */
export function parseJalali(dateStr: string): { jy: number; jm: number; jd: number } | null {
  if (!dateStr) return null;
  const parts = dateStr.split(/[/.-]/).map((p) => parseInt(p, 10));
  if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return { jy: parts[0], jm: parts[1], jd: parts[2] };
  }
  return null;
}

/**
 * Calculate difference in days between two Jalali dates (target - base)
 * Negative means target is before base (overdue!)
 */
export function compareJalaliDates(targetStr: string, baseStr?: string): number {
  const target = parseJalali(targetStr);
  if (!target) return 0;
  
  let baseObj: { jy: number; jm: number; jd: number };
  if (baseStr) {
    const parsed = parseJalali(baseStr);
    baseObj = parsed || getCurrentJalali();
  } else {
    baseObj = getCurrentJalali();
  }

  const gTarget = jalaliToGregorian(target.jy, target.jm, target.jd);
  const gBase = jalaliToGregorian(baseObj.jy, baseObj.jm, baseObj.jd);

  const diffTime = gTarget.getTime() - gBase.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Status categorization for installment due date:
 * - 'overdue': Due date has passed and unpaid (< 0 days)
 * - 'today': Due today (0 days)
 * - 'upcoming-3d': Due in 1 to 3 days
 * - 'upcoming-7d': Due in 4 to 7 days
 * - 'upcoming-month': Due within 30 days
 * - 'far': Beyond 30 days
 */
export function getDueStatus(dueDateStr: string): 'overdue' | 'today' | 'upcoming-3d' | 'upcoming-7d' | 'upcoming-month' | 'far' {
  const diffDays = compareJalaliDates(dueDateStr);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays <= 3) return 'upcoming-3d';
  if (diffDays <= 7) return 'upcoming-7d';
  if (diffDays <= 30) return 'upcoming-month';
  return 'far';
}
