/**
 * Volatility-based risk score — B12-2.
 *
 * Replaces the hardcoded seed risk values with a real, defensible 1–5
 * score derived from each symbol's annualized return volatility over the
 * trailing year. Failures (yahoo error, too few bars) fall back to the
 * caller's existing risk value, so the UI never ends up blank.
 *
 *   Bucket           Annualised σ        Typical examples
 *   1 (defensive)    < 15%               TLT, KO, utilities ETFs
 *   2 (low-vol)      15–25%              SPY, AAPL, JNJ, large blue chips
 *   3 (market)       25–35%              QQQ, MSFT, market-typical equity
 *   4 (above-mkt)    35–50%              NVDA, semi sector, cyclical leaders
 *   5 (high-vol)     ≥ 50%               TSLA, leveraged ETFs, single-name conc.
 *
 * 1-hour TTL so a single page load doesn't refetch historicals.
 */

import { fetchHistorical } from '../providers/yahoo.js';
import { TTLCache } from './cache.js';

const _scoreCache = new TTLCache<number>(60 * 60 * 1000);

const TRADING_DAYS_YEAR = 252;

/** Bucket annualized σ (decimal, e.g. 0.42 = 42%) into a 1–5 score. */
export function bucketVolatility(annualizedSigma: number): number {
  if (!Number.isFinite(annualizedSigma) || annualizedSigma <= 0) return 3;
  if (annualizedSigma < 0.15) return 1;
  if (annualizedSigma < 0.25) return 2;
  if (annualizedSigma < 0.35) return 3;
  if (annualizedSigma < 0.50) return 4;
  return 5;
}

/**
 * Returns the 1–5 risk score for a symbol, or null when the historical
 * fetch fails / produces too few bars to be meaningful.
 */
export async function volatilityScore(symbol: string): Promise<number | null> {
  return _scoreCache.get(symbol, async () => {
    const rows = await fetchHistorical(symbol, '1Y');
    if (!Array.isArray(rows) || rows.length < 30) return 3;
    // Daily simple returns.
    const closes: number[] = [];
    for (const r of rows) {
      const c = typeof r.close === 'number' ? r.close
              : typeof r.adjClose === 'number' ? r.adjClose
              : NaN;
      if (Number.isFinite(c)) closes.push(c);
    }
    if (closes.length < 30) return 3;
    const rets: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const prev = closes[i - 1];
      if (prev > 0) rets.push(closes[i] / prev - 1);
    }
    if (rets.length < 20) return 3;
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
    const sigma = Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_YEAR);
    return bucketVolatility(sigma);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }).catch(() => null) as Promise<number | null>;
}
