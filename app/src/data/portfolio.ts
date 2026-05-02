// Portfolio fetchers — real fetch('/api/portfolio/...') calls (B2-MD swap).
// Backing store: server reads/seeds from ~/.intelistock/portfolio.json.

import type {
  AllocationBy,
  AllocationSlice,
  EquityPoint,
  Holding,
  PortfolioSummary,
  Range,
  RiskFactor,
  Trade,
  WatchlistEntry,
} from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

async function apiSend<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const init: RequestInit = {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body:    body !== undefined ? JSON.stringify(body) : undefined,
  };
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`API ${method} ${path} → ${res.status} ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Exported fetchers ────────────────────────────────────────────────────────

/** Returns the portfolio summary KPI header data. */
export async function getSummary(): Promise<PortfolioSummary> {
  return apiFetch<PortfolioSummary>('/portfolio/summary');
}

/** Returns equity curve data points for the given time range. */
export async function getEquityCurve(range: Range = '1Y'): Promise<EquityPoint[]> {
  return apiFetch<EquityPoint[]>(`/portfolio/equity-curve?range=${range}`);
}

/**
 * Returns allocation slices grouped by the chosen dimension.
 * Supported: 'sector' | 'region' | 'asset'.
 */
export async function getAllocation(by: AllocationBy = 'sector'): Promise<AllocationSlice[]> {
  return apiFetch<AllocationSlice[]>(`/portfolio/allocation?by=${by}`);
}

/** Returns the full list of portfolio holdings. */
export async function getHoldings(): Promise<Holding[]> {
  return apiFetch<Holding[]>('/portfolio/holdings');
}

/**
 * Returns watchlist entries for the given region.
 * Delegates to portfolio watchlist endpoint.
 */
export async function getWatchlist(region: string): Promise<WatchlistEntry[]> {
  return apiFetch<WatchlistEntry[]>(`/portfolio/watchlist?region=${encodeURIComponent(region)}`);
}

/** Returns trade history for the portfolio. */
export async function getTrades(): Promise<Trade[]> {
  return apiFetch<Trade[]>('/portfolio/trades');
}

/** Returns risk factor decomposition (beta/sector/geo exposures). */
export async function getRiskFactors(): Promise<RiskFactor[]> {
  return apiFetch<RiskFactor[]>('/portfolio/risk-factors');
}

// ─── Mutations — B8-PF-CRUD ─────────────────────────────────────────────────
//
// Every successful mutation triggers the local-file write on the server,
// which in turn fires the Google Sheets mirror (B5-GS). UIs that consume
// these helpers don't need to know about either side effect.

/** Append a new trade to the top of the trades list. */
export async function addTrade(t: Trade): Promise<Trade> {
  return apiSend<Trade>('/portfolio/trades', 'POST', t);
}

/** Remove the trade at the given array index (0-based). */
export async function deleteTrade(idx: number): Promise<void> {
  await apiSend<void>(`/portfolio/trades/${idx}`, 'DELETE');
}

/** Add a holding. Errors with `symbol_exists` (409) on duplicate symbol. */
export async function addHolding(h: Holding): Promise<Holding> {
  return apiSend<Holding>('/portfolio/holdings', 'POST', h);
}

/** Patch (or upsert) a holding. Match is case-insensitive on symbol. */
export async function updateHolding(symbol: string, patch: Partial<Holding>): Promise<Holding> {
  return apiSend<Holding>(`/portfolio/holdings/${encodeURIComponent(symbol)}`, 'PUT', patch);
}

/** Remove a holding by symbol (case-insensitive). */
export async function deleteHolding(symbol: string): Promise<void> {
  await apiSend<void>(`/portfolio/holdings/${encodeURIComponent(symbol)}`, 'DELETE');
}

/** Patch top-level summary KPIs (NAV, day change, sharpe, etc.). */
export async function patchSummary(patch: Partial<PortfolioSummary>): Promise<PortfolioSummary> {
  return apiSend<PortfolioSummary>('/portfolio/summary', 'PATCH', patch);
}

/** Add a Korean-watchlist entry. Errors with `code_exists` (409) on duplicate code. */
export async function addWatchlist(entry: WatchlistEntry): Promise<WatchlistEntry> {
  return apiSend<WatchlistEntry>('/portfolio/watchlist/KR', 'POST', entry);
}

/** Remove a Korean-watchlist entry by code. */
export async function deleteWatchlist(code: string): Promise<void> {
  await apiSend<void>(`/portfolio/watchlist/KR/${encodeURIComponent(code)}`, 'DELETE');
}
