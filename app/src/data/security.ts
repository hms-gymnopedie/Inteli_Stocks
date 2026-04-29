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
 * Returns SEC filings for the given symbol.
 * B2-SEC owns this function body — kept as mock until B2-SEC swaps it.
 */
export async function getFilings(symbol: string): Promise<Filing[]> {
  // B2-SEC will replace this body. Mock kept intentionally.
  return new Promise((r) => setTimeout(r, 50 + Math.random() * 100)).then(() => {
    const MOCK_FILINGS_NVDA: Filing[] = [
      { date: '26 APR', form: '8-K',  description: 'Material Definitive Agreement · supply contract', impact: 'high' },
      { date: '18 APR', form: '4',    description: 'Insider sale · CFO · 12,000 shares',               impact: 'med'  },
      { date: '09 APR', form: '10-Q', description: 'Quarterly Report · Q1 FY25',                       impact: 'high' },
      { date: '02 APR', form: '8-K',  description: 'Press release · GTC keynote summary',              impact: 'low'  },
      { date: '28 MAR', form: '13G',  description: 'Vanguard 5.1% holding update',                     impact: 'low'  },
    ];
    if (symbol === 'NVDA') return MOCK_FILINGS_NVDA;
    return [] as Filing[];
  });
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
