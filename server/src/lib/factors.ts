/**
 * Real factor exposure decomposition — replaces the static seed riskFactors
 * array with values computed from each holding's actual returns + sector +
 * currency. (Risk decomposition real)
 *
 * Five factors, ordered by typical importance:
 *   1. Market beta (regression vs SPY)              — systematic equity risk
 *   2. Rates duration (regression vs TLT)            — bond/duration sensitivity
 *   3. Top sector concentration                      — single largest GICS sector
 *   4. FX exposure (largest non-USD currency)        — derived from ticker suffix
 *   5. High-vol tilt                                 — weight in risk-bucket 4–5 names
 *
 * For beta-based factors, `value` = portfolio beta and `contribution` =
 * factor's share of total portfolio variance (capped at 100% to avoid
 * negative residual artifacts in undiversified single-stock cases).
 *
 * For weight-based factors, `value` = the raw weight (0–1) and
 * `contribution` = same as a percentage. Caller's frontend renders
 * `contribution` strings like "42%" verbatim.
 *
 * Cached at the route level for ~1 h via the existing TTLCache infrastructure.
 */

import type { Holding } from '../storage/types.js';
import { fetchHistoricalRange, fetchQuoteSummary } from '../providers/yahoo.js';
import { volatilityScore } from './risk.js';
import { TTLCache } from './cache.js';

interface RiskFactor {
  name: string;
  value: number;
  contribution: string;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

const _retsCache    = new TTLCache<number[]>(ONE_HOUR_MS);
const _sectorCache  = new TTLCache<string>(6 * ONE_HOUR_MS);

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseWeight(s: string): number {
  const m = /^\s*([\d.]+)\s*%/.exec(s);
  return m ? parseFloat(m[1]) / 100 : 0;
}

function detectCurrency(symbol: string): string {
  const u = symbol.toUpperCase();
  if (u.endsWith('.KS') || u.endsWith('.KQ')) return 'KRW';
  if (u.endsWith('.T'))                       return 'JPY';
  if (u.endsWith('.HK'))                      return 'HKD';
  if (u.endsWith('.L'))                       return 'GBP';
  if (u.endsWith('.TO'))                      return 'CAD';
  if (u.endsWith('.AX'))                      return 'AUD';
  if (u.endsWith('.DE') || u.endsWith('.PA') || u.endsWith('.AS')) return 'EUR';
  return 'USD';
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function variance(rs: number[]): number {
  if (rs.length < 2) return 0;
  const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
  return rs.reduce((a, b) => a + (b - mean) ** 2, 0) / (rs.length - 1);
}

function covariance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let mA = 0, mB = 0;
  for (let i = 0; i < n; i++) { mA += a[i]; mB += b[i]; }
  mA /= n; mB /= n;
  let acc = 0;
  for (let i = 0; i < n; i++) acc += (a[i] - mA) * (b[i] - mB);
  return acc / (n - 1);
}

/** Linear regression β: cov(stock, market) / var(market). */
function beta(stockReturns: number[], marketReturns: number[]): number {
  const n = Math.min(stockReturns.length, marketReturns.length);
  if (n < 30) return 0;
  const a = stockReturns.slice(-n);
  const b = marketReturns.slice(-n);
  const v = variance(b);
  if (v <= 0) return 0;
  return covariance(a, b) / v;
}

// ─── Data fetchers (cached) ─────────────────────────────────────────────────

async function dailyReturns(symbol: string): Promise<number[]> {
  return _retsCache.get(symbol, async () => {
    const today = new Date();
    const yearAgo = new Date(today.getTime() - 365 * 24 * 3600_000);
    const rows = await fetchHistoricalRange(symbol, yearAgo, today);
    if (!Array.isArray(rows) || rows.length < 30) return [];
    const closes: number[] = [];
    for (const r of rows) {
      const c = typeof r.close === 'number' ? r.close
              : typeof r.adjClose === 'number' ? r.adjClose
              : NaN;
      if (Number.isFinite(c)) closes.push(c);
    }
    const rets: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const prev = closes[i - 1];
      if (prev > 0) rets.push(closes[i] / prev - 1);
    }
    return rets;
  }).catch(() => [] as number[]);
}

async function sectorOf(symbol: string): Promise<string> {
  return _sectorCache.get(symbol, async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = (await fetchQuoteSummary(symbol, ['assetProfile'])) as any;
      const sec = r?.assetProfile?.sector;
      return typeof sec === 'string' && sec.trim() ? sec : 'Unknown';
    } catch {
      return 'Unknown';
    }
  });
}

// ─── Public entry point ─────────────────────────────────────────────────────

export async function computeRiskFactors(holdings: Holding[]): Promise<RiskFactor[]> {
  const items = holdings
    .map((h) => ({ symbol: h.symbol, weight: parseWeight(h.weight) }))
    .filter((a) => a.weight > 0);
  if (items.length === 0) return [];
  const totalW = items.reduce((acc, a) => acc + a.weight, 0);
  const norm = items.map((a) => ({ ...a, weight: a.weight / totalW }));

  // Pull per-symbol returns + sector + currency in parallel.
  const data = await Promise.all(norm.map(async (a) => ({
    symbol:   a.symbol,
    weight:   a.weight,
    returns:  await dailyReturns(a.symbol),
    sector:   await sectorOf(a.symbol),
    currency: detectCurrency(a.symbol),
  })));

  // Benchmarks for beta regressions.
  const [spyRets, tltRets] = await Promise.all([
    dailyReturns('SPY'),
    dailyReturns('TLT'),
  ]);

  // Build the real portfolio daily-returns series so variance contribution
  // accounts for correlations (a sum of w²·var ignores covariance and ends
  // up understating portfolio risk for highly-correlated books — the prior
  // implementation hit that and capped Market β at 100% for any tech-heavy
  // holding set).
  const portReturns: number[] = (() => {
    const usable = data.filter((a) => a.returns.length >= 30);
    if (usable.length === 0) return [];
    const T = Math.min(...usable.map((a) => a.returns.length));
    const series: number[] = [];
    for (let t = 0; t < T; t++) {
      let v = 0;
      for (const a of usable) v += a.weight * a.returns[a.returns.length - T + t];
      series.push(v);
    }
    return series;
  })();
  const portVar = variance(portReturns);

  const factors: RiskFactor[] = [];

  // ── 1. Market beta (SPY) ────────────────────────────────────────────────
  if (spyRets.length >= 30 && portVar > 0) {
    const portBeta = beta(portReturns, spyRets);
    const marketContrib = (portBeta * portBeta * variance(spyRets)) / portVar;
    factors.push({
      name: 'Market beta (SPY)',
      value: round2(portBeta),
      contribution: `${Math.round(Math.min(1, Math.max(0, marketContrib)) * 100)}%`,
    });
  }

  // ── 2. Rates duration (TLT regression) ─────────────────────────────────
  if (tltRets.length >= 30 && portVar > 0) {
    const portTLT = beta(portReturns, tltRets);
    const tltContrib = (portTLT * portTLT * variance(tltRets)) / portVar;
    factors.push({
      name: 'Rates duration (TLT β)',
      value: round2(portTLT),
      contribution: `${Math.round(Math.min(1, Math.max(0, tltContrib)) * 100)}%`,
    });
  }

  // ── 3. Top sector concentration ────────────────────────────────────────
  const sectorWeights: Record<string, number> = {};
  for (const a of data) {
    sectorWeights[a.sector] = (sectorWeights[a.sector] ?? 0) + a.weight;
  }
  const sectorTop = Object.entries(sectorWeights)
    .filter(([k]) => k !== 'Unknown')
    .sort((a, b) => b[1] - a[1])[0];
  if (sectorTop) {
    factors.push({
      name: `Sector · ${sectorTop[0]}`,
      value: round2(sectorTop[1]),
      contribution: `${Math.round(sectorTop[1] * 100)}%`,
    });
  }

  // ── 4. FX exposure (largest non-USD currency) ──────────────────────────
  const ccyWeights: Record<string, number> = {};
  for (const a of data) {
    ccyWeights[a.currency] = (ccyWeights[a.currency] ?? 0) + a.weight;
  }
  const fxTop = Object.entries(ccyWeights)
    .filter(([k]) => k !== 'USD')
    .sort((a, b) => b[1] - a[1])[0];
  if (fxTop && fxTop[1] > 0) {
    factors.push({
      name: `FX · ${fxTop[0]}`,
      value: round2(fxTop[1]),
      contribution: `${Math.round(fxTop[1] * 100)}%`,
    });
  }

  // ── 5. High-vol tilt (weight in σ-buckets 4-5) ─────────────────────────
  let highVolWeight = 0;
  await Promise.all(data.map(async (a) => {
    const score = await volatilityScore(a.symbol);
    if (score != null && score >= 4) highVolWeight += a.weight;
  }));
  factors.push({
    name: 'High-vol tilt (σ ≥ 35%)',
    value: round2(highVolWeight),
    contribution: `${Math.round(highVolWeight * 100)}%`,
  });

  return factors;
}
