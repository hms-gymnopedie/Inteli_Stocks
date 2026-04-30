import { describe, expect, it } from 'vitest';
import {
  formatBp,
  formatChange,
  formatCurrency,
  formatDateShort,
  formatPct,
  formatPrice,
  formatRange,
  formatTime,
  formatVol,
  formatWeight,
} from './format';
import type { Range } from '../data/types';

/**
 * Unit tests for `lib/format.ts` (Task B4-UT).
 *
 * Pure formatters — deterministic, no I/O. Intl-dependent assertions
 * normalise narrow-no-break-space (U+202F) → regular space so that the suite
 * stays portable across ICU versions (Node 18 emits "$" + U+00A0, Node 20+
 * emits U+202F in some currency styles).
 */

const MINUS = '−'; // U+2212 typographic minus, what format.ts uses
const HYPHEN = '-';     // U+002D ASCII hyphen, what `typographic: false` emits

/** Replace narrow-no-break-space + non-breaking-space with a regular space. */
const norm = (s: string): string => s.replace(/[  ]/g, ' ');

// ---------------------------------------------------------------------------
// formatPrice
// ---------------------------------------------------------------------------

describe('formatPrice', () => {
  it('formats a bare number with thousands separators (no currency)', () => {
    expect(formatPrice(5247.18)).toBe('5,247.18');
  });

  it('clamps to 2 decimals by default', () => {
    expect(formatPrice(1)).toBe('1.00');
    expect(formatPrice(1234567.891)).toBe('1,234,567.89');
  });

  it('prefixes "$" for USD with 2 decimals', () => {
    // Currency formatting may use a normal space or U+00A0/U+202F between symbol
    // and number depending on ICU; pin via regex after normalising.
    expect(norm(formatPrice(924.19, { currency: 'USD' }))).toMatch(/^\$\s?924\.19$/);
  });

  it('auto-zeros decimals for KRW', () => {
    expect(norm(formatPrice(72400, { currency: 'KRW' }))).toMatch(/^₩\s?72,400$/);
  });

  it('auto-zeros decimals for JPY', () => {
    expect(norm(formatPrice(1000, { currency: 'JPY' }))).toMatch(/^¥\s?1,000$/);
  });

  it('explicit decimals override currency default', () => {
    // KRW would normally drop decimals, but caller can force.
    const out = norm(formatPrice(1234.56, { currency: 'KRW', decimals: 2 }));
    expect(out).toMatch(/^₩\s?1,234\.56$/);
  });

  it('explicit decimals override default 2 for bare numbers', () => {
    expect(formatPrice(1.23456, { decimals: 4 })).toBe('1.2346');
    expect(formatPrice(1.2, { decimals: 0 })).toBe('1');
  });

  it('groups thousands differently per locale', () => {
    // ko-KR groups by 3 like en-US for >=1000 (Korean grouping is 1,000s).
    // Check it produces a comma-separated string with two decimals.
    expect(norm(formatPrice(5247.18, { locale: 'ko-KR' }))).toMatch(/^5,247\.18$/);
    // de-DE uses "." for thousands and "," for decimal — proves locale switching works.
    const de = norm(formatPrice(1234.56, { locale: 'de-DE' }));
    expect(de).toMatch(/1\.234,56/);
  });

  it('renders negatives readably with a minus marker', () => {
    // The output should contain the digits and the currency symbol; the minus
    // can be either ASCII "-" or parens depending on locale, but Node's en-US
    // currency uses leading "-".
    const out = norm(formatPrice(-100, { currency: 'USD' }));
    expect(out).toMatch(/^-\$\s?100\.00$/);
  });

  it('formats zero and very small values correctly', () => {
    expect(formatPrice(0)).toBe('0.00');
    expect(formatPrice(0.001, { decimals: 3 })).toBe('0.001');
  });
});

// ---------------------------------------------------------------------------
// formatPct
// ---------------------------------------------------------------------------

describe('formatPct', () => {
  it('signs positive values with a plus by default', () => {
    expect(formatPct(0.42)).toBe('+0.42%');
    expect(formatPct(2.18)).toBe('+2.18%');
  });

  it('uses typographic minus (U+2212) for negatives by default', () => {
    expect(formatPct(-3.10)).toBe(`${MINUS}3.10%`);
    expect(formatPct(-3.10).charAt(0).codePointAt(0)).toBe(0x2212);
  });

  it('omits sign for zero', () => {
    expect(formatPct(0)).toBe('0.00%');
    // No leading "+"/"-"/"−"
    expect(formatPct(0).startsWith('+')).toBe(false);
    expect(formatPct(0).startsWith(MINUS)).toBe(false);
    expect(formatPct(0).startsWith(HYPHEN)).toBe(false);
  });

  it('respects signed: false', () => {
    expect(formatPct(2.18, { signed: false })).toBe('2.18%');
    // Negatives still get the minus marker — `signed` only controls "+".
    expect(formatPct(-2.18, { signed: false })).toBe(`${MINUS}2.18%`);
  });

  it('honours decimals override', () => {
    expect(formatPct(1.234, { decimals: 3 })).toBe('+1.234%');
    expect(formatPct(1, { decimals: 0 })).toBe('+1%');
    expect(formatPct(-0.5, { decimals: 1 })).toBe(`${MINUS}0.5%`);
  });

  it('typographic: false uses ASCII hyphen for negatives', () => {
    expect(formatPct(-1, { typographic: false })).toBe('-1.00%');
    expect(formatPct(-1, { typographic: false }).charAt(0)).toBe(HYPHEN);
  });

  it('typographic toggle does not affect positive sign', () => {
    expect(formatPct(1, { typographic: false })).toBe('+1.00%');
  });
});

// ---------------------------------------------------------------------------
// formatBp
// ---------------------------------------------------------------------------

describe('formatBp', () => {
  it('signs positive bp with plus and one decimal default', () => {
    expect(formatBp(2.1)).toBe('+2.1bp');
    expect(formatBp(0.1)).toBe('+0.1bp');
  });

  it('uses typographic minus for negative bp', () => {
    expect(formatBp(-15)).toBe(`${MINUS}15.0bp`);
    expect(formatBp(-15).charAt(0).codePointAt(0)).toBe(0x2212);
  });

  it('honours decimals override', () => {
    expect(formatBp(2.15, { decimals: 2 })).toBe('+2.15bp');
    expect(formatBp(2, { decimals: 0 })).toBe('+2bp');
    expect(formatBp(-7.5, { decimals: 0 })).toBe(`${MINUS}8bp`); // toFixed rounds half-to-even? Actually toFixed rounds half-away-from-zero in V8
  });

  it('signed: false drops plus marker', () => {
    expect(formatBp(2.1, { signed: false })).toBe('2.1bp');
  });

  it('typographic: false uses ASCII hyphen', () => {
    expect(formatBp(-2.1, { typographic: false })).toBe('-2.1bp');
  });

  it('zero is unsigned', () => {
    expect(formatBp(0)).toBe('0.0bp');
  });
});

// ---------------------------------------------------------------------------
// formatVol
// ---------------------------------------------------------------------------

describe('formatVol', () => {
  it('uses T suffix for trillions', () => {
    expect(formatVol(1.5e12)).toBe('1.50T');
    expect(formatVol(1e12)).toBe('1.00T');
  });

  it('uses B suffix for billions', () => {
    expect(formatVol(2_410_000_000)).toBe('2.41B');
    expect(formatVol(1e9)).toBe('1.00B');
  });

  it('uses M suffix for millions', () => {
    expect(formatVol(56_200_000)).toBe('56.20M');
    expect(formatVol(1e6)).toBe('1.00M');
  });

  it('uses K suffix for thousands', () => {
    expect(formatVol(1_234)).toBe('1.23K');
    expect(formatVol(1000)).toBe('1.00K');
  });

  it('returns plain number string under 1000', () => {
    expect(formatVol(123)).toBe('123.00');
    expect(formatVol(0)).toBe('0.00');
    expect(formatVol(999)).toBe('999.00');
  });

  it('prefixes typographic minus for negatives', () => {
    expect(formatVol(-1_500_000)).toBe(`${MINUS}1.50M`);
    expect(formatVol(-1_500_000).charAt(0).codePointAt(0)).toBe(0x2212);
    expect(formatVol(-50)).toBe(`${MINUS}50.00`);
  });

  it('honours decimals override', () => {
    expect(formatVol(2_410_000_000, { decimals: 1 })).toBe('2.4B');
    expect(formatVol(2_410_000_000, { decimals: 0 })).toBe('2B');
    expect(formatVol(1_234_567, { decimals: 3 })).toBe('1.235M');
  });

  it('boundary values pick the correct bucket', () => {
    // exactly 1e3 -> K
    expect(formatVol(1e3)).toBe('1.00K');
    // exactly 1e6 -> M
    expect(formatVol(1e6)).toBe('1.00M');
    // exactly 1e9 -> B
    expect(formatVol(1e9)).toBe('1.00B');
    // just under 1e3 -> plain
    expect(formatVol(999.99)).toBe('999.99');
  });
});

// ---------------------------------------------------------------------------
// formatTime
// ---------------------------------------------------------------------------

describe('formatTime', () => {
  it('formats epoch ms 0 in UTC as 00:00:00', () => {
    expect(formatTime(0, { timeZone: 'UTC' })).toBe('00:00:00');
  });

  it('appends abbreviation when supplied', () => {
    expect(formatTime(0, { timeZone: 'UTC', abbreviation: 'UTC' })).toBe('00:00:00 UTC');
    // NY at the same instant is the prior day at 19:00 (EST is UTC-5; DST aside,
    // epoch 0 is 1970-01-01 which is non-DST so 19:00:00 NY).
    expect(formatTime(0, { timeZone: 'America/New_York', abbreviation: 'NY' })).toBe('19:00:00 NY');
  });

  it('drops seconds when seconds: false', () => {
    const out = formatTime(0, { timeZone: 'UTC', seconds: false });
    expect(out).toBe('00:00');
    expect(out).not.toMatch(/:\d\d:\d\d/);
  });

  it('drops seconds with abbreviation', () => {
    expect(formatTime(0, { timeZone: 'UTC', abbreviation: 'UTC', seconds: false })).toBe('00:00 UTC');
  });

  it('accepts ISO string input', () => {
    expect(formatTime('1970-01-01T00:00:00Z', { timeZone: 'UTC' })).toBe('00:00:00');
  });

  it('accepts Date input', () => {
    expect(formatTime(new Date(0), { timeZone: 'UTC' })).toBe('00:00:00');
  });

  it('accepts numeric ms input', () => {
    // 2026-04-30T13:42:18Z — pin via regex pattern, not specific tz output.
    const ms = Date.UTC(2026, 3, 30, 13, 42, 18);
    expect(formatTime(ms, { timeZone: 'UTC' })).toBe('13:42:18');
  });

  it('uses 24-hour clock (no AM/PM)', () => {
    // 13:00 UTC must render as "13:00:..", not "01:00:..".
    const ms = Date.UTC(2026, 3, 30, 13, 0, 0);
    expect(formatTime(ms, { timeZone: 'UTC' })).toMatch(/^13:00:00$/);
  });

  it('respects KST timezone', () => {
    // 13:42:18Z = 22:42:18 KST.
    const ms = Date.UTC(2026, 3, 30, 13, 42, 18);
    expect(formatTime(ms, { timeZone: 'Asia/Seoul', abbreviation: 'KST', seconds: false })).toBe('22:42 KST');
  });
});

// ---------------------------------------------------------------------------
// formatDateShort
// ---------------------------------------------------------------------------

describe('formatDateShort', () => {
  it('renders day + uppercase short month in UTC', () => {
    expect(formatDateShort(new Date('2026-04-26T00:00:00Z'), { timeZone: 'UTC' })).toBe('26 APR');
  });

  it('uppercases the month and trims any trailing dot', () => {
    // 2026-12-01 — December, "DEC". en-US "month: short" sometimes appends a
    // dot in other locales but never in en-US. Verify there is no trailing dot.
    const out = formatDateShort(new Date('2026-12-01T00:00:00Z'), { timeZone: 'UTC' });
    expect(out).toBe('01 DEC');
    expect(out.endsWith('.')).toBe(false);
  });

  it('respects timezone boundary at midnight UTC', () => {
    // 2026-04-26T00:00:00Z is 2026-04-25T20:00:00 in NY → "25 APR".
    expect(formatDateShort(new Date('2026-04-26T00:00:00Z'), { timeZone: 'America/New_York' })).toBe('25 APR');
  });

  it('accepts ISO string', () => {
    expect(formatDateShort('2026-01-15T12:00:00Z', { timeZone: 'UTC' })).toBe('15 JAN');
  });

  it('accepts numeric ms input', () => {
    const ms = Date.UTC(2026, 6, 4, 0, 0, 0); // 2026-07-04
    expect(formatDateShort(ms, { timeZone: 'UTC' })).toBe('04 JUL');
  });

  it('produces a result for every English short month', () => {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    for (let m = 0; m < 12; m++) {
      const ms = Date.UTC(2026, m, 15, 12, 0, 0);
      expect(formatDateShort(ms, { timeZone: 'UTC' })).toBe(`15 ${months[m]}`);
    }
  });
});

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------

describe('formatCurrency', () => {
  it('matches formatPrice(value, { currency }) for USD', () => {
    expect(formatCurrency(924.19, 'USD')).toBe(formatPrice(924.19, { currency: 'USD' }));
  });

  it('matches formatPrice(value, { currency }) for KRW', () => {
    expect(formatCurrency(72400, 'KRW')).toBe(formatPrice(72400, { currency: 'KRW' }));
  });

  it('threads decimals through to formatPrice', () => {
    expect(formatCurrency(1.2345, 'USD', { decimals: 4 })).toBe(
      formatPrice(1.2345, { currency: 'USD', decimals: 4 }),
    );
  });

  it('threads locale through to formatPrice', () => {
    expect(formatCurrency(1234.56, 'USD', { locale: 'de-DE' })).toBe(
      formatPrice(1234.56, { currency: 'USD', locale: 'de-DE' }),
    );
  });
});

// ---------------------------------------------------------------------------
// formatRange
// ---------------------------------------------------------------------------

describe('formatRange', () => {
  it('passes through every Range union variant', () => {
    const ranges: Range[] = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'MAX'];
    for (const r of ranges) {
      expect(formatRange(r)).toBe(r);
    }
  });

  it('returns the literal value (centralisation hook)', () => {
    expect(formatRange('3M')).toBe('3M');
    expect(formatRange('YTD')).toBe('YTD');
    expect(formatRange('MAX')).toBe('MAX');
  });
});

// ---------------------------------------------------------------------------
// formatChange
// ---------------------------------------------------------------------------

describe('formatChange', () => {
  it('formats positive abs and pct with plus signs', () => {
    expect(formatChange(22.04, 0.42)).toBe('+22.04 (+0.42%)');
  });

  it('uses typographic minus for both halves on negatives', () => {
    expect(formatChange(-5.12, -0.31)).toBe(`${MINUS}5.12 (${MINUS}0.31%)`);
  });

  it('handles mixed-sign abs/pct independently', () => {
    expect(formatChange(-1, 2)).toBe(`${MINUS}1.00 (+2.00%)`);
    expect(formatChange(3, -1.5)).toBe(`+3.00 (${MINUS}1.50%)`);
  });

  it('honours decimals override on both halves', () => {
    expect(formatChange(22.04, 0.42, { decimals: 1 })).toBe('+22.0 (+0.4%)');
    expect(formatChange(22.04, 0.42, { decimals: 3 })).toBe('+22.040 (+0.420%)');
  });

  it('typographic: false uses ASCII hyphen on both halves', () => {
    expect(formatChange(-5.12, -0.31, { typographic: false })).toBe('-5.12 (-0.31%)');
  });

  it('zero abs/pct is unsigned', () => {
    // signOf(0,...) returns ''. abs(0).toFixed(2) = '0.00'.
    expect(formatChange(0, 0)).toBe('0.00 (0.00%)');
  });
});

// ---------------------------------------------------------------------------
// formatWeight
// ---------------------------------------------------------------------------

describe('formatWeight', () => {
  it('formats with one decimal by default', () => {
    expect(formatWeight(12.4)).toBe('12.4%');
    expect(formatWeight(0)).toBe('0.0%');
    expect(formatWeight(100)).toBe('100.0%');
  });

  it('honours decimals override', () => {
    expect(formatWeight(12.4, { decimals: 0 })).toBe('12%');
    expect(formatWeight(12.456, { decimals: 2 })).toBe('12.46%');
    expect(formatWeight(12.4, { decimals: 3 })).toBe('12.400%');
  });

  it('does not sign positive values (allocations are unsigned)', () => {
    const out = formatWeight(12.4);
    expect(out.startsWith('+')).toBe(false);
    expect(out.startsWith(MINUS)).toBe(false);
  });

  it('passes negatives through with ASCII hyphen (toFixed default)', () => {
    // formatWeight does not transform sign — relies on toFixed for negatives.
    // This documents current behaviour: leading "-" is the JS-native ASCII one.
    expect(formatWeight(-5.5)).toBe('-5.5%');
  });
});
