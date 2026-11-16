import { CurrencyCode } from '../types/aqar';

export interface DisplayFormatPrefs {
  calendarType: 'gregorian' | 'hijri' | 'both';
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD';
  numerals: 'en' | 'ar';
}

const DISPLAY_PREFS_KEY = 'aqarplus_display_prefs_v1';

function readStoredDisplayPrefs(): DisplayFormatPrefs {
  const defaults: DisplayFormatPrefs = {
    calendarType: 'both',
    dateFormat: 'DD/MM/YYYY',
    numerals: 'en',
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(DISPLAY_PREFS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<DisplayFormatPrefs>;
    return {
      calendarType: parsed.calendarType === 'gregorian' || parsed.calendarType === 'hijri' || parsed.calendarType === 'both' ? parsed.calendarType : 'both',
      dateFormat: parsed.dateFormat === 'YYYY-MM-DD' ? 'YYYY-MM-DD' : 'DD/MM/YYYY',
      numerals: parsed.numerals === 'ar' ? 'ar' : 'en',
    };
  } catch {
    return defaults;
  }
}

let activeDisplayPrefs: DisplayFormatPrefs = readStoredDisplayPrefs();

export function getDisplayFormatPrefs(): DisplayFormatPrefs {
  return activeDisplayPrefs;
}

export function setDisplayFormatPrefs(next: Partial<DisplayFormatPrefs>): DisplayFormatPrefs {
  activeDisplayPrefs = {
    ...activeDisplayPrefs,
    ...next,
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(DISPLAY_PREFS_KEY, JSON.stringify(activeDisplayPrefs));
    } catch {
      // ignore storage errors
    }
  }
  return activeDisplayPrefs;
}

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function localizeDigits(value: string | number, numerals: 'en' | 'ar' = activeDisplayPrefs.numerals): string {
  const str = String(value ?? '');
  if (numerals === 'ar') {
    return str.replace(/\d/g, (d) => ARABIC_INDIC_DIGITS[Number(d)] ?? d);
  }
  return str.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC_DIGITS.indexOf(d)));
}

export const DEFAULT_CURRENCY_RATES_TO_SAR: Record<CurrencyCode, number> = {
  SAR: 1,
  AED: 1.021,
  USD: 3.75,
  EGP: 0.077,
  KWD: 12.22,
};

export const CURRENCY_META: Record<CurrencyCode, { code: CurrencyCode; labelAr: string; labelEn: string; symbolAr: string; symbolEn: string }> = {
  SAR: { code: 'SAR', labelAr: 'ريال سعودي (ر.س)', labelEn: 'Saudi Riyal (SAR)', symbolAr: 'ر.س', symbolEn: 'SAR' },
  AED: { code: 'AED', labelAr: 'درهم إماراتي (د.إ)', labelEn: 'UAE Dirham (AED)', symbolAr: 'د.إ', symbolEn: 'AED' },
  USD: { code: 'USD', labelAr: 'دولار أمريكي ($)', labelEn: 'US Dollar (USD)', symbolAr: '$', symbolEn: 'USD' },
  EGP: { code: 'EGP', labelAr: 'جنيه مصري (ج.م)', labelEn: 'Egyptian Pound (EGP)', symbolAr: 'ج.م', symbolEn: 'EGP' },
  KWD: { code: 'KWD', labelAr: 'دينار كويتي (د.ك)', labelEn: 'Kuwaiti Dinar (KWD)', symbolAr: 'د.ك', symbolEn: 'KWD' },
};

export function convertCurrency(
  amount: number,
  from: CurrencyCode = 'SAR',
  to: CurrencyCode = 'SAR',
  ratesToSar: Partial<Record<CurrencyCode, number>> = DEFAULT_CURRENCY_RATES_TO_SAR
): number {
  if (from === to) return Math.round(amount * 100) / 100;
  const fromRate = ratesToSar[from] ?? DEFAULT_CURRENCY_RATES_TO_SAR[from] ?? 1;
  const toRate = ratesToSar[to] ?? DEFAULT_CURRENCY_RATES_TO_SAR[to] ?? 1;
  const inSar = amount * fromRate;
  return Math.round((inSar / toRate) * 100) / 100;
}

export function formatCurrency(amount: number, currency: CurrencyCode = 'SAR', lang: 'ar' | 'en' = 'ar'): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  const localized = localizeDigits(formatted, activeDisplayPrefs.numerals);
  const meta = CURRENCY_META[currency] || CURRENCY_META.SAR;
  return lang === 'ar' ? `${localized} ${meta.symbolAr}` : `${meta.symbolEn} ${localized}`;
}

export function formatSar(amount: number, lang: 'ar' | 'en' = 'ar', currency: CurrencyCode = 'SAR'): string {
  return formatCurrency(amount, currency, lang);
}

function formatNumericParts(
  year: string,
  month: string,
  day: string,
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD',
  numerals: 'en' | 'ar'
): string {
  const raw = dateFormat === 'YYYY-MM-DD' ? `${year}-${month}-${day}` : `${day}/${month}/${year}`;
  return localizeDigits(raw, numerals);
}

export function formatGregorian(
  iso: string,
  _lang: 'ar' | 'en' = 'ar',
  overridePrefs?: Partial<DisplayFormatPrefs>
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const prefs = { ...activeDisplayPrefs, ...overridePrefs };
  const year = String(d.getFullYear());
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return formatNumericParts(year, month, day, prefs.dateFormat, prefs.numerals);
}

export function formatHijri(iso: string, overridePrefs?: Partial<DisplayFormatPrefs> & { numeric?: boolean }): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const prefs = { ...activeDisplayPrefs, ...overridePrefs };
  try {
    if (overridePrefs?.numeric) {
      const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(d);
      const y = parts.find((p) => p.type === 'year')?.value || '';
      const m = parts.find((p) => p.type === 'month')?.value || '';
      const day = parts.find((p) => p.type === 'day')?.value || '';
      if (y && m && day) {
        return `${formatNumericParts(y, m, day, prefs.dateFormat, prefs.numerals)} هـ`;
      }
    }
    const text = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
    return localizeDigits(text, prefs.numerals);
  } catch {
    return '';
  }
}

export function formatDisplayDate(
  iso: string,
  lang: 'ar' | 'en' = 'ar',
  overridePrefs?: Partial<DisplayFormatPrefs> & { verboseHijri?: boolean }
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const prefs = { ...activeDisplayPrefs, ...overridePrefs };
  const greg = formatGregorian(iso, lang, prefs);
  const hijriText = formatHijri(iso, prefs);
  const hijriNumeric = formatHijri(iso, { ...prefs, numeric: true });
  const hijriStr = overridePrefs?.verboseHijri ? `${hijriText} (${hijriNumeric})` : hijriNumeric || hijriText;

  if (prefs.calendarType === 'gregorian') {
    return lang === 'ar' ? `${greg} م` : greg;
  }
  if (prefs.calendarType === 'hijri') {
    return hijriStr || greg;
  }
  return lang === 'ar'
    ? `${greg} م · ${overridePrefs?.verboseHijri ? hijriText : hijriNumeric || hijriText}`
    : `${greg} · ${hijriNumeric || hijriText}`;
}

export function formatDateTime(
  iso: string,
  lang: 'ar' | 'en' = 'ar',
  overridePrefs?: Partial<DisplayFormatPrefs>
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const prefs = { ...activeDisplayPrefs, ...overridePrefs };
  const datePart = formatDisplayDate(iso, lang, prefs);
  const timeRaw = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  const timePart = localizeDigits(timeRaw, prefs.numerals);
  return `${datePart} · ${timePart}`;
}

export function numberToArabicWords(num: number): string {
  const n = Math.floor(Math.abs(num));
  if (n === 0) return 'صفر ريال سعودي';

  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  function convertUnder1000(val: number): string {
    if (val === 0) return '';
    const h = Math.floor(val / 100);
    const rem = val % 100;
    const parts: string[] = [];
    if (h > 0) parts.push(hundreds[h]);
    if (rem > 0) {
      if (rem < 10) parts.push(ones[rem]);
      else if (rem < 20) parts.push(teens[rem - 10]);
      else {
        const u = rem % 10;
        const t = Math.floor(rem / 10);
        if (u > 0) parts.push(`${ones[u]} و${tens[t]}`);
        else parts.push(tens[t]);
      }
    }
    return parts.join(' و');
  }

  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const segments: string[] = [];

  if (thousands > 0) {
    if (thousands === 1) segments.push('ألف');
    else if (thousands === 2) segments.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) segments.push(`${convertUnder1000(thousands)} آلاف`);
    else segments.push(`${convertUnder1000(thousands)} ألف`);
  }
  if (rest > 0) {
    segments.push(convertUnder1000(rest));
  }

  return `فقط ${segments.join(' و')} ريال سعودي لا غير`;
}

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (val: string | number) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csvContent =
    '\uFEFF' + [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function generateQrCells(seed: string, size = 11): boolean[][] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Corner finder patterns
      const inTopLeft = r < 3 && c < 3;
      const inTopRight = r < 3 && c >= size - 3;
      const inBottomLeft = r >= size - 3 && c < 3;
      if (inTopLeft || inTopRight || inBottomLeft) {
        grid[r][c] = !(r === 1 && c === 1) && !(r === 1 && c === size - 2) && !(r === size - 2 && c === 1);
      } else {
        h ^= (r * 31 + c * 17) & 0xff;
        h = Math.imul(h, 16777619);
        grid[r][c] = (h >>> 0) % 3 !== 0;
      }
    }
  }
  return grid;
}
