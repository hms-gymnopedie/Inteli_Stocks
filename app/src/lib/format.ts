// Pure formatters used across the dashboard.
// Match the visual style of the prototype: typographic minus (U+2212),
// signed percentages, K/M/B/T volume suffixes, locale-aware currency.

import type { Range } from '../data/types';

/** Typographic minus sign (U+2212) — matches the prototype's visual style. */
const MINUS = '−';

interface SignOpts {
  /** Prepend "+" / "−" to non-zero values. Default: true. */
  signed?: boolean;
  /** Use the typographic minus (U+2212) instead of ASCII "-". Default: true. */
  typographic?: boolean;
}

interface DecimalsOpts {
  /** Number of fraction digits. */
  decimals?: number;
}

interface LocaleOpts {
  /** BCP 47 locale tag. Default: 'en-US'. */
  locale?: string;
}

function signOf(value: number, signed: boolean, typographic: boolean): string {
  if (value > 0) return signed ? '+' : '';
  if (value < 0) return typographic ? MINUS : '-';
  return '';
}

/**
 * Format a price/value with thousands separators.
 * Currency-prefixed when `currency` is provided ("$1,234.56" / "₩72,400").
 *
 * @example formatPrice(5247.18)              // "5,247.18"
 * @example formatPrice(924.19, { currency: 'USD' })   // "$924.19"
 * @example formatPrice(72400, { currency: 'KRW', decimals: 0 })  // "₩72,400"
 */
export function formatPrice(
  value: number,
  opts: { currency?: string; decimals?: number } & LocaleOpts = {},
): string {
  const { currency, locale = 'en-US', decimals } = opts;
  const inferDecimals = decimals ?? (currency === 'KRW' || currency === 'JPY' ? 0 : 2);
  const fmtOpts: Intl.NumberFormatOptions = {
    minimumFractionDigits: inferDecimals,
    maximumFractionDigits: inferDecimals,
  };
  if (currency) {
    fmtOpts.style = 'currency';
    fmtOpts.currency = currency;
  }
  return new Intl.NumberFormat(locale, fmtOpts).format(value);
}

/**
 * Format a percentage. Defaults to signed with two decimals.
 *
 * @example formatPct(0.42)                  // "+0.42%"
 * @example formatPct(-3.10)                 // "−3.10%"
 * @example formatPct(2.18, { signed: false }) // "2.18%"
 */
export function formatPct(
  value: number,
  opts: SignOpts & DecimalsOpts = {},
): string {
  const { signed = true, decimals = 2, typographic = true } = opts;
  return `${signOf(value, signed, typographic)}${Math.abs(value).toFixed(decimals)}%`;
}

/**
 * Format basis points. "+2.1bp", "−15.0bp", "0.0bp".
 *
 * @example formatBp(2.1)   // "+2.1bp"
 * @example formatBp(-15)   // "−15.0bp"
 */
export function formatBp(
  value: number,
  opts: SignOpts & DecimalsOpts = {},
): string {
  const { signed = true, decimals = 1, typographic = true } = opts;
  return `${signOf(value, signed, typographic)}${Math.abs(value).toFixed(decimals)}bp`;
}

/**
 * Format a volume / count with K/M/B/T suffix.
 *
 * @example formatVol(2_410_000_000)  // "2.41B"
 * @example formatVol(56_200_000)     // "56.2M"
 * @example formatVol(1_234)          // "1.23K"
 */
export function formatVol(n: number, opts: DecimalsOpts = {}): string {
  const { decimals = 2 } = opts;
  const abs = Math.abs(n);
  const sign = n < 0 ? MINUS : '';
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(decimals)}T`;
  if (abs >= 1e9)  return `${sign}${(abs / 1e9).toFixed(decimals)}B`;
  if (abs >= 1e6)  return `${sign}${(abs / 1e6).toFixed(decimals)}M`;
  if (abs >= 1e3)  return `${sign}${(abs / 1e3).toFixed(decimals)}K`;
  return `${sign}${abs.toFixed(decimals)}`;
}

/**
 * Format a timestamp in a given timezone.
 * Defaults to NY time HH:mm:ss with optional appended TZ abbreviation.
 *
 * @example formatTime(Date.now(), { timeZone: 'America/New_York', abbreviation: 'NY' })
 *   // "09:42:18 NY"
 * @example formatTime(Date.now(), { timeZone: 'Asia/Seoul', abbreviation: 'KST', seconds: false })
 *   // "22:42 KST"
 */
export function formatTime(
  iso: string | number | Date,
  opts: {
    timeZone?: string;
    abbreviation?: string;
    seconds?: boolean;
  } & LocaleOpts = {},
): string {
  const {
    timeZone = 'America/New_York',
    locale = 'en-US',
    abbreviation,
    seconds = true,
  } = opts;
  const fmt = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
    hour12: false,
  });
  const time = fmt.format(new Date(iso));
  return abbreviation ? `${time} ${abbreviation}` : time;
}

/**
 * Format a date as "26 APR" (day + uppercase short month).
 * Used in calendars, filings, headers.
 *
 * @example formatDateShort(new Date('2026-04-26'))   // "26 APR"
 */
export function formatDateShort(
  date: string | number | Date,
  opts: { timeZone?: string } & LocaleOpts = {},
): string {
  const { timeZone, locale = 'en-US' } = opts;
  const d = new Date(date);
  const day = new Intl.DateTimeFormat(locale, { day: '2-digit', timeZone }).format(d);
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone })
    .format(d)
    .toUpperCase();
  return `${day} ${month}`;
}

/**
 * Bloomberg-style chart date axis: "NOV 01 2025" — uppercase 3-letter
 * month, zero-padded day, 4-digit year. Year is omitted when `withYear`
 * is false (e.g. intraday axes inside a single day). (B11-1)
 *
 * @example formatDateAxis(new Date('2025-11-01'))           // "NOV 01 2025"
 * @example formatDateAxis(new Date('2025-11-01'), { withYear: false }) // "NOV 01"
 */
export function formatDateAxis(
  date: string | number | Date,
  opts: { withYear?: boolean; timeZone?: string } & LocaleOpts = {},
): string {
  const { withYear = true, timeZone, locale = 'en-US' } = opts;
  const d = new Date(date);
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone })
    .format(d)
    .toUpperCase();
  const day = new Intl.DateTimeFormat(locale, { day: '2-digit', timeZone }).format(d);
  if (!withYear) return `${month} ${day}`;
  const year = new Intl.DateTimeFormat(locale, { year: 'numeric', timeZone }).format(d);
  return `${month} ${day} ${year}`;
}

/**
 * Format a currency-coded value. Identical to `formatPrice` with a currency,
 * but reads cleaner at call sites that always have a currency code.
 *
 * @example formatCurrency(924.19, 'USD')  // "$924.19"
 * @example formatCurrency(72400, 'KRW')   // "₩72,400"
 */
export function formatCurrency(
  value: number,
  code: string,
  opts: DecimalsOpts & LocaleOpts = {},
): string {
  return formatPrice(value, { ...opts, currency: code });
}

/**
 * Pass-through for chart range labels. Centralised so we can later vary by
 * locale (e.g. "1년" in Korean) without touching call sites.
 *
 * @example formatRange('3M')   // "3M"
 */
export function formatRange(range: Range): string {
  return range;
}

/**
 * Combined absolute + percent change "+22.04 (+0.42%)".
 *
 * @example formatChange(22.04, 0.42)        // "+22.04 (+0.42%)"
 * @example formatChange(-5.12, -0.31, { decimals: 2 })  // "−5.12 (−0.31%)"
 */
export function formatChange(
  abs: number,
  pct: number,
  opts: DecimalsOpts & { typographic?: boolean } = {},
): string {
  const { decimals = 2, typographic = true } = opts;
  const absSign = signOf(abs, true, typographic);
  const absStr = `${absSign}${Math.abs(abs).toFixed(decimals)}`;
  return `${absStr} (${formatPct(pct, { decimals, typographic })})`;
}

/**
 * Format weight / allocation percent (no sign, fixed decimals).
 *
 * @example formatWeight(12.4)   // "12.4%"
 */
export function formatWeight(value: number, opts: DecimalsOpts = {}): string {
  const { decimals = 1 } = opts;
  return `${value.toFixed(decimals)}%`;
}
