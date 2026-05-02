// Security detail fetchers — real fetch('/api/security/...') calls (B2-MD swap).
// getFilings is owned by B2-SEC and is left as its original mock body.

import type {
  AnalystTarget,
  Earnings,
  Filing,
  Fundamental,
  IVSurfacePoint,
  OHLC,
  Peer,
  Range,
  SecurityProfile,
} from './types';

// ─── Helper ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Exported fetchers ────────────────────────────────────────────────────────

/**
 * Returns security profile header data for the given symbol.
 */
export async function getProfile(symbol: string): Promise<SecurityProfile> {
  return apiFetch<SecurityProfile>(`/security/${encodeURIComponent(symbol)}/profile`);
}

/** Returns OHLC bars for the given symbol and range. */
export async function getOHLC(symbol: string, range: Range = '3M'): Promise<OHLC[]> {
  return apiFetch<OHLC[]>(`/security/${encodeURIComponent(symbol)}/ohlc?range=${range}`);
}

/**
 * Returns fundamental metrics for the given symbol.
 */
export async function getFundamentals(symbol: string): Promise<Fundamental[]> {
  return apiFetch<Fundamental[]>(`/security/${encodeURIComponent(symbol)}/fundamentals`);
}

/**
 * Returns SEC filings for the given symbol from the EDGAR-backed
 * /api/security/:symbol/filings endpoint (B2-SEC). For non-US tickers
 * (e.g. KOSPI) the backend returns []; gracefully treat any error path
 * as "no filings" so the panel still renders. (B13-D1)
 */
export async function getFilings(symbol: string): Promise<Filing[]> {
  try {
    return await apiFetch<Filing[]>(`/security/${encodeURIComponent(symbol)}/filings`);
  } catch {
    return [];
  }
}

/**
 * Returns analyst price targets for the given symbol.
 */
export async function getTargets(symbol: string): Promise<AnalystTarget | null> {
  return apiFetch<AnalystTarget | null>(`/security/${encodeURIComponent(symbol)}/targets`);
}

/**
 * Returns peer comparison rows for the given symbol.
 */
export async function getPeers(symbol: string): Promise<Peer[]> {
  return apiFetch<Peer[]>(`/security/${encodeURIComponent(symbol)}/peers`);
}

/**
 * Returns earnings history (and upcoming estimate) for the given symbol.
 */
export async function getEarnings(symbol: string): Promise<Earnings[]> {
  return apiFetch<Earnings[]>(`/security/${encodeURIComponent(symbol)}/earnings`);
}

/**
 * Returns IV surface data points for the given symbol.
 */
export async function getIVSurface(symbol: string): Promise<IVSurfacePoint[]> {
  return apiFetch<IVSurfacePoint[]>(`/security/${encodeURIComponent(symbol)}/iv-surface`);
}
