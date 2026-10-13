/**
 * Unified English Numerals & Financial Formatters
 * Formats all financial amounts, numbers, card numbers and inputs with English digits (0-9)
 * and 3-digit comma separators (e.g. 1,000,000).
 */

const PERSIAN_ARABIC_DIGITS: { [key: string]: string } = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

/**
 * Converts any Persian or Arabic digits to English digits
 */
export function toEnglishDigits(input: string | number): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  return str.replace(/[۰-۹٠-٩]/g, (char) => PERSIAN_ARABIC_DIGITS[char] || char);
}

/**
 * Formats a number with English digits and standard 3-digit comma grouping (e.g. 1,250,000)
 */
export function formatNumber(val: number | string): string {
  if (val === null || val === undefined || val === '') return '0';
  const num = typeof val === 'number' ? val : parseFormattedNumber(val);
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Formats currency amount in Tomans with English digits and commas (e.g. "1,250,000 تومان")
 */
export function formatCurrency(amount: number | string): string {
  return `${formatNumber(amount)} تومان`;
}

/**
 * Parse an input string with commas or Persian numerals to a pure JS number
 */
export function parseFormattedNumber(val: string | number): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const englishStr = toEnglishDigits(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(englishStr);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Live input formatter: takes an input string as the user types,
 * strips non-numeric characters, converts Persian digits to English,
 * and inserts 3-digit commas.
 */
export function formatNumberInputLive(raw: string): string {
  if (!raw) return '';
  const cleaned = toEnglishDigits(raw).replace(/[^0-9]/g, '');
  if (!cleaned) return '';
  return new Intl.NumberFormat('en-US').format(parseInt(cleaned, 10));
}

/**
 * Format banking card number with space grouping in English digits: "6037 9975 1234 5678"
 */
export function formatCardNumber(card: string): string {
  if (!card) return '';
  const clean = toEnglishDigits(card).replace(/[^0-9]/g, '').slice(0, 16);
  return clean.replace(/(\d{4})/g, '$1 ').trim();
}
