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

// ─── Helper ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
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
