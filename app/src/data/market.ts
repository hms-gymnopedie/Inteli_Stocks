// Market data fetchers — real fetch('/api/market/...') calls (B2-MD swap).
// getFearGreed, getSPConstituents, getCalendar, getSessionVolume call the backend
// which returns mock values server-side (no free public APIs available).

import type {
  CalendarEvent,
  Constituent,
  FearGreed,
  Index,
  MacroIndicator,
  MacroKey,
  OHLC,
  Range,
  SearchResult,
  SectorReturn,
  VolumeBar,
  WatchlistEntry,
} from './types';

// ─── Helper ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Exported fetchers ────────────────────────────────────────────────────────

/** Returns the ticker strip indices (S&P, NASDAQ, DOW, KOSPI, VIX, DXY, 10Y, BTC). */
export async function getIndices(): Promise<Index[]> {
  return apiFetch<Index[]>('/market/indices');
}

/**
 * Returns OHLC bars for a given symbol and range.
 */
export async function getIntraday(symbol: string, range: Range): Promise<OHLC[]> {
  return apiFetch<OHLC[]>(`/market/intraday?symbol=${encodeURIComponent(symbol)}&range=${range}`);
}

/**
 * Returns ~50 well-known S&P 500 constituents with day % change AND a
 * sector label so the SectorHeat grid can group by sector (B8-OV-HEAT).
 *
 * Bypasses the backend mock (which returns 24 tickers without sectors)
 * because client-side grouping needs the sector field. The day pct
 * values are seed numbers — when B2-MD-3 adds a real constituents
 * fetcher with sector data this should swap back to apiFetch.
 */
export async function getSPConstituents(): Promise<Constituent[]> {
  return SP_CONSTITUENTS;
}

/** 50-ticker constituents data with sector labels (B8-OV-HEAT). */
const SP_CONSTITUENTS: Constituent[] = [
  // Tech (5)
  { t: 'AAPL',  v:  1.4, sector: 'Tech' },
  { t: 'MSFT',  v:  0.8, sector: 'Tech' },
  { t: 'GOOGL', v: -0.4, sector: 'Tech' },
  { t: 'AMZN',  v:  0.9, sector: 'Tech' },
  { t: 'META',  v:  1.1, sector: 'Tech' },
  // Semis (5)
  { t: 'NVDA',  v:  3.2, sector: 'Semis' },
  { t: 'AMD',   v:  2.1, sector: 'Semis' },
  { t: 'TSM',   v:  1.5, sector: 'Semis' },
  { t: 'AVGO',  v:  0.6, sector: 'Semis' },
  { t: 'INTC',  v: -1.3, sector: 'Semis' },
  // Software (5)
  { t: 'ORCL',  v: -0.7, sector: 'Software' },
  { t: 'CRM',   v:  1.0, sector: 'Software' },
  { t: 'ADBE',  v:  0.5, sector: 'Software' },
  { t: 'NOW',   v:  1.7, sector: 'Software' },
  { t: 'INTU',  v:  0.3, sector: 'Software' },
  // Communication (5)
  { t: 'NFLX',  v:  2.4, sector: 'Communication' },
  { t: 'DIS',   v:  0.5, sector: 'Communication' },
  { t: 'T',     v: -0.2, sector: 'Communication' },
  { t: 'VZ',    v: -0.1, sector: 'Communication' },
  { t: 'CMCSA', v:  0.4, sector: 'Communication' },
  // Financials (5)
  { t: 'JPM',   v:  0.3, sector: 'Financials' },
  { t: 'BAC',   v: -0.6, sector: 'Financials' },
  { t: 'GS',    v:  0.9, sector: 'Financials' },
  { t: 'V',     v:  0.2, sector: 'Financials' },
  { t: 'MA',    v:  0.4, sector: 'Financials' },
  // Healthcare (5)
  { t: 'UNH',   v:  0.4, sector: 'Healthcare' },
  { t: 'JNJ',   v: -0.3, sector: 'Healthcare' },
  { t: 'LLY',   v:  2.6, sector: 'Healthcare' },
  { t: 'PFE',   v:  1.6, sector: 'Healthcare' },
  { t: 'ABBV',  v:  0.7, sector: 'Healthcare' },
  // Energy (5)
  { t: 'XOM',   v: -1.2, sector: 'Energy' },
  { t: 'CVX',   v: -0.9, sector: 'Energy' },
  { t: 'COP',   v: -1.4, sector: 'Energy' },
  { t: 'SLB',   v: -0.6, sector: 'Energy' },
  { t: 'EOG',   v: -1.0, sector: 'Energy' },
  // Industrials (5)
  { t: 'GE',    v:  0.8, sector: 'Industrials' },
  { t: 'CAT',   v: -0.4, sector: 'Industrials' },
  { t: 'BA',    v: -3.6, sector: 'Industrials' },
  { t: 'HON',   v:  0.2, sector: 'Industrials' },
  { t: 'UPS',   v: -0.8, sector: 'Industrials' },
  // Cons. Disc. (5)
  { t: 'HD',    v: -0.2, sector: 'Cons. Disc.' },
  { t: 'NKE',   v:  1.9, sector: 'Cons. Disc.' },
  { t: 'MCD',   v:  0.3, sector: 'Cons. Disc.' },
  { t: 'SBUX',  v: -0.5, sector: 'Cons. Disc.' },
  { t: 'LOW',   v:  0.1, sector: 'Cons. Disc.' },
  // Cons. Staples (5)
  { t: 'WMT',   v:  0.1, sector: 'Cons. Staples' },
  { t: 'COST',  v:  0.7, sector: 'Cons. Staples' },
  { t: 'PG',    v:  0.2, sector: 'Cons. Staples' },
  { t: 'KO',    v: -0.3, sector: 'Cons. Staples' },
  { t: 'PEP',   v:  0.4, sector: 'Cons. Staples' },
];

/**
 * Returns sector returns for the requested range.
 */
export async function getSectorReturns(range: Range = '1D'): Promise<SectorReturn[]> {
  return apiFetch<SectorReturn[]>(`/market/sectors?range=${range}`);
}

/**
 * Returns macro indicator values for the requested keys.
 * If `keys` is empty or undefined, returns all four indicators.
 */
export async function getMacro(keys?: MacroKey[]): Promise<MacroIndicator[]> {
  const q = keys && keys.length > 0 ? `?keys=${keys.join(',')}` : '';
  return apiFetch<MacroIndicator[]>(`/market/macro${q}`);
}

/**
 * Returns today's key economic/earnings calendar events.
 */
export async function getCalendar(_date: string): Promise<CalendarEvent[]> {
  return apiFetch<CalendarEvent[]>('/market/calendar');
}

/** Returns Fear & Greed gauge data including yesterday/1W/1M trail. */
export async function getFearGreed(): Promise<FearGreed> {
  return apiFetch<FearGreed>('/market/fear-greed');
}

/**
 * Returns session volume bars.
 */
export async function getSessionVolume(): Promise<VolumeBar[]> {
  return apiFetch<VolumeBar[]>('/market/session-volume');
}

/**
 * Returns watchlist entries for a given region.
 * Watchlist is portfolio-scoped — delegates to portfolio endpoint.
 */
export async function getWatchlist(region: string): Promise<WatchlistEntry[]> {
  return apiFetch<WatchlistEntry[]>(`/portfolio/watchlist?region=${encodeURIComponent(region)}`);
}

/** Returns symbol search results matching the query string. */
export async function getSearch(q: string): Promise<SearchResult[]> {
  return apiFetch<SearchResult[]>(`/market/search?q=${encodeURIComponent(q)}`);
}
