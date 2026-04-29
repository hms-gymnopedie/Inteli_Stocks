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

/** Returns S&P 500 heatmap constituents with day % change. */
export async function getSPConstituents(): Promise<Constituent[]> {
  return apiFetch<Constituent[]>('/market/sp-constituents');
}

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
