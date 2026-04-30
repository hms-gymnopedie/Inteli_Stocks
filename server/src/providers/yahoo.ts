/**
 * yahoo.ts — thin wrapper around yahoo-finance2 with TTLCache + LastGoodCache fallback.
 *
 * All external yahoo calls go through here so:
 *  - cache keys are consistent
 *  - error handling is centralised (last-good fallback before throwing)
 *  - routes stay thin
 *
 * B2-MD2: bumped TTLs (quotes/search 300 s, historical/summary 600 s),
 *         added per-function LastGoodCache so stale data is served on yahoo errors.
 */

import YahooFinance from 'yahoo-finance2';
import { TTLCache, LastGoodCache } from '../lib/cache.js';

// ─── TTL constants ─────────────────────────────────────────────────────────────

/** 5 min: quotes + search (light, high call rate) */
const QUOTES_TTL   = 300_000;
/** 10 min: historical OHLC + quoteSummary (heavy, low call rate) */
const HISTORY_TTL  = 600_000;

// ─── Caches ───────────────────────────────────────────────────────────────────

const _quotesCache   = new TTLCache<Awaited<ReturnType<typeof yf.quote>>[]>(QUOTES_TTL);
const _lgQuotes      = new LastGoodCache<Awaited<ReturnType<typeof yf.quote>>[]>();

const _histCache     = new TTLCache<Awaited<ReturnType<typeof yf.historical>>>(HISTORY_TTL);
const _lgHist        = new LastGoodCache<Awaited<ReturnType<typeof yf.historical>>>();

const _summaryCache  = new TTLCache<Awaited<ReturnType<typeof yf.quoteSummary>>>(HISTORY_TTL);
const _lgSummary     = new LastGoodCache<Awaited<ReturnType<typeof yf.quoteSummary>>>();

const _searchCache   = new TTLCache<Awaited<ReturnType<typeof yf.search>>>(QUOTES_TTL);
const _lgSearch      = new LastGoodCache<Awaited<ReturnType<typeof yf.search>>>();

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
  const ts = Date.now();
  const d  = new Date(ts); // fresh copy each time — avoid mutation bugs
  switch (range) {
    case '1D':  return new Date(ts - 1 * 24 * 3600_000);
    case '1W':  return new Date(ts - 7 * 24 * 3600_000);
    case '1M':  { const t = new Date(ts); t.setMonth(t.getMonth() - 1); return t; }
    case '3M':  { const t = new Date(ts); t.setMonth(t.getMonth() - 3); return t; }
    case '6M':  { const t = new Date(ts); t.setMonth(t.getMonth() - 6); return t; }
    case '1Y':  { const t = new Date(ts); t.setFullYear(t.getFullYear() - 1); return t; }
    case '5Y':  { const t = new Date(ts); t.setFullYear(t.getFullYear() - 5); return t; }
    case 'YTD': return new Date(d.getFullYear(), 0, 1);
    case 'MAX': return new Date('2000-01-01');
    default:    { const t = new Date(ts); t.setFullYear(t.getFullYear() - 1); return t; }
  }
}

function rangeToInterval(range: Range): '1d' | '1wk' | '1mo' {
  switch (range) {
    case '5Y': return '1wk';
    case 'MAX': return '1mo';
    default:    return '1d';
  }
}

// ─── Internal TTL-cache helpers ───────────────────────────────────────────────

/**
 * Reads from a TTLCache without calling the loader.
 * Returns undefined if the key is missing or expired.
 */
function peekTTL<T>(cache: TTLCache<T>, key: string): T | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const store = (cache as any).store as Map<string, { value: T; expiresAt: number }>;
  const entry = store.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.value;
  return undefined;
}

/**
 * Writes directly into a TTLCache store (bypasses the loader API).
 */
function pokeTTL<T>(cache: TTLCache<T>, key: string, value: T): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const store = (cache as any).store as Map<string, { value: T; expiresAt: number }>;
  const ttlMs = (cache as unknown as { ttlMs: number }).ttlMs;
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// ─── Exported helpers ──────────────────────────────────────────────────────────

/**
 * Fetch quotes for one or more symbols, with TTL + last-good fallback.
 * On Yahoo error: serves stale last-good if available, otherwise throws.
 */
export async function fetchQuotes(symbols: string[]): Promise<Awaited<ReturnType<typeof yf.quote>>[]> {
  const key = `quotes:${[...symbols].sort().join(',')}`;

  // Check TTL cache first
  const fresh = peekTTL(_quotesCache, key);
  if (fresh) return fresh;

  // Attempt to fetch from Yahoo
  try {
    const result = await yf.quote(symbols);
    const quotes = (Array.isArray(result) ? result : [result]) as Awaited<ReturnType<typeof yf.quote>>[];
    pokeTTL(_quotesCache, key, quotes);
    _lgQuotes.set(key, quotes);
    return quotes;
  } catch (err) {
    const stale = _lgQuotes.get(key);
    if (stale !== undefined) {
      console.warn(`[B2-MD2] fetchQuotes: yahoo error, serving stale last-good for key="${key}"`);
      return stale;
    }
    throw err;
  }
}

/**
 * Fetch OHLC historical data for a symbol and range, with TTL + last-good fallback.
 */
export async function fetchHistorical(symbol: string, range: Range) {
  const key = `historical:${symbol}:${range}`;

  const fresh = peekTTL(_histCache, key);
  if (fresh) return fresh;

  try {
    const rows = await yf.historical(symbol, {
      period1:  rangeToPeriod1(range),
      interval: rangeToInterval(range),
    });
    pokeTTL(_histCache, key, rows);
    _lgHist.set(key, rows);
    return rows;
  } catch (err) {
    const stale = _lgHist.get(key);
    if (stale !== undefined) {
      console.warn(`[B2-MD2] fetchHistorical: yahoo error, serving stale last-good for key="${key}"`);
      return stale;
    }
    throw err;
  }
}

// Valid module names as a union literal — matches QuoteSummaryModules from yahoo-finance2.
type QSModule =
  | 'assetProfile' | 'calendarEvents' | 'defaultKeyStatistics' | 'earnings'
  | 'earningsHistory' | 'earningsTrend' | 'financialData' | 'price'
  | 'quoteType' | 'recommendationTrend' | 'summaryDetail' | 'summaryProfile'
  | 'upgradeDowngradeHistory' | 'secFilings' | 'majorHoldersBreakdown';

/**
 * Fetch quoteSummary modules for a symbol, with TTL + last-good fallback.
 */
export async function fetchQuoteSummary(
  symbol: string,
  modules: QSModule[]
): Promise<Awaited<ReturnType<typeof yf.quoteSummary>>> {
  const key = `summary:${symbol}:${[...modules].sort().join(',')}`;

  const fresh = peekTTL(_summaryCache, key);
  if (fresh) return fresh;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await yf.quoteSummary(symbol, { modules: modules as any });
    pokeTTL(_summaryCache, key, result);
    _lgSummary.set(key, result);
    return result;
  } catch (err) {
    const stale = _lgSummary.get(key);
    if (stale !== undefined) {
      console.warn(`[B2-MD2] fetchQuoteSummary: yahoo error, serving stale last-good for key="${key}"`);
      return stale;
    }
    throw err;
  }
}

/**
 * Symbol search, with TTL + last-good fallback.
 */
export async function fetchSearch(query: string): Promise<Awaited<ReturnType<typeof yf.search>>> {
  const key = `search:${query.toLowerCase()}`;

  const fresh = peekTTL(_searchCache, key);
  if (fresh) return fresh;

  try {
    const result = await yf.search(query);
    pokeTTL(_searchCache, key, result);
    _lgSearch.set(key, result);
    return result;
  } catch (err) {
    const stale = _lgSearch.get(key);
    if (stale !== undefined) {
      console.warn(`[B2-MD2] fetchSearch: yahoo error, serving stale last-good for key="${key}"`);
      return stale;
    }
    throw err;
  }
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
