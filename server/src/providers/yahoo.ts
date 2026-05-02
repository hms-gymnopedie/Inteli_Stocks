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
    // yahoo-finance2 v3 deprecated `historical()` and remaps to `chart()`,
    // which validates `period2` strictly — passing undefined now fails the
    // schema. Always set both ends of the window. (B9-2)
    const rows = await yf.historical(symbol, {
      period1:  rangeToPeriod1(range),
      period2:  new Date(),
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

/** Yahoo intraday intervals supported by chart() / historical(). */
export type HistInterval = '1d' | '1m' | '2m' | '5m' | '15m' | '30m' | '60m' | '90m' | '1h';

/**
 * Like fetchHistorical, but takes an explicit [period1, period2] window
 * instead of a categorical Range. Used by the backtest engine, which needs
 * data at the user's actual startDate — not "1Y ago from today". (B9-2)
 *
 * Optional `interval` enables intraday minute bars for short ranges:
 *   '5m'   — last ~60 days of 5-minute bars (B15-2)
 *   '15m'  — same window
 *   '30m'  — same window
 *   '1d'   — daily closes (default; works for any history length)
 *
 * Yahoo restricts intraday to recent data — caller must keep period1
 * within yahoo's supported window per interval.
 */
export async function fetchHistoricalRange(
  symbol: string,
  period1: Date,
  period2: Date,
  interval: HistInterval = '1d',
) {
  const key = `historical:${symbol}:${period1.getTime()}:${period2.getTime()}:${interval}`;

  const fresh = peekTTL(_histCache, key);
  if (fresh) return fresh;

  try {
    // Daily/weekly/monthly intervals go through the typed historical()
    // path. Intraday intervals (5m/15m/30m/60m) require chart() directly —
    // yahoo-finance2's historical() schema rejects them even though it
    // would otherwise remap to chart() at runtime. Map chart's response
    // shape back to the historical() row type so callers don't care.
    let rows;
    if (interval === '1d') {
      rows = await yf.historical(symbol, { period1, period2, interval: '1d' });
    } else {
      const ch = await yf.chart(symbol, { period1, period2, interval });
      // chart().quotes shape: { date, open, high, low, close, volume, adjclose? }
      // historical() shape:   { date, open, high, low, close, adjClose, volume }
      rows = (ch.quotes ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((q: any) => ({
          date:     q.date instanceof Date ? q.date : new Date(q.date),
          open:     q.open,
          high:     q.high,
          low:      q.low,
          close:    q.close,
          adjClose: q.adjclose ?? q.adjClose ?? q.close,
          volume:   q.volume ?? 0,
        }));
    }
    pokeTTL(_histCache, key, rows);
    _lgHist.set(key, rows);
    return rows;
  } catch (err) {
    const stale = _lgHist.get(key);
    if (stale !== undefined) {
      console.warn(`[B9-2] fetchHistoricalRange: yahoo error, serving stale last-good for key="${key}"`);
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
