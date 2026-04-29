/**
 * yahoo.ts — thin wrapper around yahoo-finance2 with TTLCache.
 *
 * All external yahoo calls go through here so:
 *  - cache keys are consistent
 *  - error handling is centralised
 *  - routes stay thin
 */

import YahooFinance from 'yahoo-finance2';
import { TTLCache } from '../lib/cache.js';

// ─── Caches ───────────────────────────────────────────────────────────────────

const quoteCache      = new TTLCache<ReturnType<typeof YahooFinance.prototype.quote>>(30_000);
const historicalCache = new TTLCache<Awaited<ReturnType<typeof YahooFinance.prototype.historical>>>(60_000);
const summaryCache    = new TTLCache<Awaited<ReturnType<typeof YahooFinance.prototype.quoteSummary>>>(60_000);
const searchCache     = new TTLCache<Awaited<ReturnType<typeof YahooFinance.prototype.search>>>(30_000);

// Suppress noisy validation warnings from yahoo-finance2
const yf = new YahooFinance({ validation: { logErrors: false, logOptionsErrors: false } });

// ─── Symbol lookup tables ──────────────────────────────────────────────────────

/**
 * Maps our internal display tickers → Yahoo Finance symbols.
 * Used by getIndices() and macro endpoints.
 */
export const INDEX_SYMBOLS: Record<string, string> = {
  SPX:    '^GSPC',
  COMP:   '^IXIC',
  INDU:   '^DJI',
  KOSPI:  '^KS11',
  KOSDAQ: '^KQ11',
  VIX:    '^VIX',
  DXY:    'DX-Y.NYB',
  TNX:    '^TNX',
  BTC:    'BTC-USD',
};

/** 11 SPDR sector ETFs. */
export const SECTOR_ETFS = ['XLK', 'XLE', 'XLF', 'XLV', 'XLY', 'XLI', 'XLP', 'XLB', 'XLU', 'XLRE', 'XLC'];

/** Maps sector ETF ticker → human-readable name. */
export const SECTOR_ETF_NAMES: Record<string, string> = {
  XLK:  'Technology',
  XLE:  'Energy',
  XLF:  'Financials',
  XLV:  'Health Care',
  XLY:  'Consumer Discr.',
  XLI:  'Industrials',
  XLP:  'Consumer Staples',
  XLB:  'Materials',
  XLU:  'Utilities',
  XLRE: 'Real Estate',
  XLC:  'Communication',
};

/** Maps our MacroKey → yahoo ticker. */
export const MACRO_SYMBOLS: Record<string, string> = {
  US10Y:   '^TNX',
  USD_KRW: 'KRW=X',
  WTI:     'CL=F',
};

// ─── Range → period helpers ───────────────────────────────────────────────────

type Range = '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y' | 'MAX';

function rangeToPeriod1(range: Range): Date {
  const now = new Date();
  switch (range) {
    case '1D':  return new Date(now.getTime() - 1 * 24 * 3600_000);
    case '1W':  return new Date(now.getTime() - 7 * 24 * 3600_000);
    case '1M':  return new Date(now.setMonth(now.getMonth() - 1));
    case '3M':  return new Date(now.setMonth(now.getMonth() - 3));
    case '6M':  return new Date(now.setMonth(now.getMonth() - 6));
    case '1Y':  return new Date(now.setFullYear(now.getFullYear() - 1));
    case '5Y':  return new Date(now.setFullYear(now.getFullYear() - 5));
    case 'YTD': return new Date(now.getFullYear(), 0, 1);
    case 'MAX': return new Date('2000-01-01');
    default:    return new Date(now.setFullYear(now.getFullYear() - 1));
  }
}

function rangeToInterval(range: Range): '1d' | '1wk' | '1mo' {
  switch (range) {
    case '5Y': return '1wk';
    case 'MAX': return '1mo';
    default:    return '1d';
  }
}

// ─── Exported helpers ──────────────────────────────────────────────────────────

/**
 * Fetch quotes for one or more symbols, with caching.
 * Returns array of raw QuoteEquity objects from yahoo-finance2.
 */
export async function getQuotes(symbols: string[]): Promise<Awaited<ReturnType<typeof yf.quote>>[]> {
  const key = `quotes:${symbols.sort().join(',')}`;
  // TTLCache is generic – for arrays we need a single-element cache per call.
  // Wrapping the array as a single cache entry is fine.
  const cache = new TTLCache<Awaited<ReturnType<typeof yf.quote>>[]>(30_000);
  return cache.get(key, async () => {
    if (symbols.length === 1) {
      const q = await yf.quote(symbols[0]);
      return [q] as Awaited<ReturnType<typeof yf.quote>>[];
    }
    const qs = await yf.quote(symbols);
    return (Array.isArray(qs) ? qs : [qs]) as Awaited<ReturnType<typeof yf.quote>>[];
  });
}

// Module-level quote cache (shared across calls)
const _quotesCache = new TTLCache<Awaited<ReturnType<typeof yf.quote>>[]>(30_000);

/**
 * Fetch quotes with a shared module-level cache instance.
 */
export async function fetchQuotes(symbols: string[]): Promise<Awaited<ReturnType<typeof yf.quote>>[]> {
  const key = `quotes:${[...symbols].sort().join(',')}`;
  return _quotesCache.get(key, async () => {
    const result = await yf.quote(symbols);
    return (Array.isArray(result) ? result : [result]) as Awaited<ReturnType<typeof yf.quote>>[];
  });
}

/**
 * Fetch OHLC historical data for a symbol and range.
 */
export async function fetchHistorical(symbol: string, range: Range) {
  const key = `historical:${symbol}:${range}`;
  return historicalCache.get(key, () =>
    yf.historical(symbol, {
      period1:  rangeToPeriod1(range),
      interval: rangeToInterval(range),
    })
  );
}

// Valid module names as a union literal — matches QuoteSummaryModules from yahoo-finance2.
type QSModule =
  | 'assetProfile' | 'calendarEvents' | 'defaultKeyStatistics' | 'earnings'
  | 'earningsHistory' | 'earningsTrend' | 'financialData' | 'price'
  | 'quoteType' | 'recommendationTrend' | 'summaryDetail' | 'summaryProfile'
  | 'upgradeDowngradeHistory' | 'secFilings' | 'majorHoldersBreakdown';

/**
 * Fetch quoteSummary modules for a symbol.
 */
export async function fetchQuoteSummary(
  symbol: string,
  modules: QSModule[]
): Promise<Awaited<ReturnType<typeof yf.quoteSummary>>> {
  const key = `summary:${symbol}:${[...modules].sort().join(',')}`;
  return summaryCache.get(key, () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yf.quoteSummary(symbol, { modules: modules as any })
  );
}

/**
 * Symbol search.
 */
export async function fetchSearch(query: string): Promise<Awaited<ReturnType<typeof yf.search>>> {
  const key = `search:${query.toLowerCase()}`;
  return searchCache.get(key, () => yf.search(query));
}

/**
 * Format a number as a price string (simple, no locale).
 * For the Index strip which expects pre-formatted strings.
 */
export function formatNum(n: number | undefined | null, decimals = 2): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Format a percent change (e.g. 0.0317 → '+3.17%').
 */
export function formatPct(n: number | undefined | null): string {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${(n * 100).toFixed(2)}%`;
}

/**
 * Derive direction from a number.
 */
export function dir(n: number | undefined | null): 1 | -1 {
  return (n ?? 0) >= 0 ? 1 : -1;
}
