/**
 * backtest.ts — pure buy-and-hold equity curve + metrics — B8-SIM
 *
 * Given a list of (symbol, weight) allocations and a date range, fetches each
 * symbol's daily-close series via the existing Yahoo wrapper and produces:
 *   - aligned equity curve (start = $100k, all weights deployed at startDate)
 *   - summary metrics (totalReturnPct, annualizedReturnPct, maxDrawdownPct,
 *     sharpe, volatilityPct)
 *   - SPY benchmark of the same shape for the same period
 *
 * Scope guards (from task brief, not knobs):
 *   - buy-and-hold ONLY (no rebalancing)
 *   - no transaction costs / slippage / dividends / fractional-share tracking
 *   - $100k initial portfolio value
 *   - daily closes, weekday alignment via union-of-trading-days
 *
 * Caching: 1 hour TTL on each (symbol, startDate, endDate) historical fetch
 * (separate from the yahoo wrapper's 10 min cache because we slice by exact
 * date range here).
 */

import { fetchHistorical } from '../providers/yahoo.js';
import { TTLCache } from './cache.js';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface Allocation {
  symbol: string;
  weight: number;
}

export interface EquityPoint {
  ts:    number;
  value: number;
}

export interface StrategyMetrics {
  totalReturnPct:      number;
  annualizedReturnPct: number;
  maxDrawdownPct:      number;
  sharpe:              number;
  volatilityPct:       number;
}

export interface BacktestRequest {
  allocations: Allocation[];
  startDate:   string;   // ISO date 'YYYY-MM-DD'
  endDate?:    string;   // ISO date 'YYYY-MM-DD' (default: today)
}

export interface BacktestResult {
  allocations:           Allocation[];
  startDate:             string;
  endDate:               string;
  equityCurve:           EquityPoint[];
  metrics:               StrategyMetrics;
  benchmarkEquityCurve:  EquityPoint[];
  benchmarkMetrics:      StrategyMetrics;
}

// ─── Cache (1 h) ──────────────────────────────────────────────────────────────

interface DailyClose { ts: number; close: number }

const _historicalCache = new TTLCache<DailyClose[]>(60 * 60 * 1000);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INITIAL_VALUE      = 100_000;
const TRADING_DAYS_YEAR  = 252;
const MIN_BARS           = 2;

function toIsoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDay(s: string): Date {
  // Anchor at UTC noon to avoid edge timezone flips.
  return new Date(`${s}T12:00:00Z`);
}

/**
 * Pick the widest yahoo range bucket that covers [startDate, endDate].
 * The yahoo wrapper expects a categorical Range, not arbitrary period1.
 */
type YahooRange = '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y' | 'MAX';
function rangeForSpan(startMs: number, endMs: number): YahooRange {
  const days = (endMs - startMs) / (24 * 3600_000);
  if (days <= 31)   return '1M';
  if (days <= 92)   return '3M';
  if (days <= 183)  return '6M';
  if (days <= 366)  return '1Y';
  if (days <= 5*366) return '5Y';
  return 'MAX';
}

/** Validate + auto-normalize allocation weights. */
function normalizeAllocations(input: Allocation[]): Allocation[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('allocations must be a non-empty array');
  }
  for (const a of input) {
    if (typeof a.symbol !== 'string' || a.symbol.trim() === '') {
      throw new Error('every allocation must have a non-empty symbol');
    }
    if (typeof a.weight !== 'number' || !Number.isFinite(a.weight) || a.weight <= 0) {
      throw new Error(`weight for ${a.symbol} must be a positive finite number`);
    }
  }
  const sum = input.reduce((acc, a) => acc + a.weight, 0);
  if (Math.abs(sum - 1) > 0.01) {
    throw new Error(
      `weights must sum to 1.0 (got ${sum.toFixed(4)}). Auto-normalization only applies when within 1% of 1.0.`,
    );
  }
  // Auto-normalize so the math below is clean.
  return input.map((a) => ({ symbol: a.symbol.trim().toUpperCase(), weight: a.weight / sum }));
}

/**
 * Fetch a daily-close series for one symbol in [startDate, endDate], cached.
 * Throws on any yahoo error (caller decides whether to bail the whole backtest).
 */
async function fetchSeries(
  symbol: string,
  startMs: number,
  endMs: number,
): Promise<DailyClose[]> {
  const key = `series:${symbol}:${startMs}:${endMs}`;
  return _historicalCache.get(key, async () => {
    const range = rangeForSpan(startMs, endMs);
    const rows  = await fetchHistorical(symbol, range);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(`no historical data for ${symbol}`);
    }
    const series: DailyClose[] = [];
    for (const r of rows) {
      const ts    = (r.date instanceof Date ? r.date : new Date(r.date as unknown as string)).getTime();
      const close = typeof r.close === 'number' ? r.close
                  : typeof r.adjClose === 'number' ? r.adjClose
                  : NaN;
      if (!Number.isFinite(close) || !Number.isFinite(ts)) continue;
      if (ts < startMs - 24*3600_000) continue; // tolerate one weekend lookback
      if (ts > endMs   + 24*3600_000) continue;
      series.push({ ts, close });
    }
    series.sort((a, b) => a.ts - b.ts);
    if (series.length < MIN_BARS) {
      throw new Error(`${symbol} has fewer than ${MIN_BARS} usable bars in range`);
    }
    return series;
  });
}

/** Day-bucket key (UTC) so series from different timezones still align. */
function dayBucket(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/**
 * Build a portfolio equity curve from per-symbol series.
 * Steps:
 *   1. Index each series by UTC-day key → close.
 *   2. Take the union of all days appearing in any series.
 *   3. For each day, look up each symbol's most-recent close (forward-fill).
 *      Skip the day until every symbol has at least one close.
 *   4. Compute portfolio value = Σ (shares_i × close_i) where
 *         shares_i = (initialValue × weight_i) / firstClose_i.
 */
function buildPortfolioCurve(
  allocations: Allocation[],
  series: Record<string, DailyClose[]>,
): EquityPoint[] {
  // Build per-symbol day → close map.
  const byDay: Record<string, Map<string, number>> = {};
  const allDaysSet = new Set<string>();
  for (const a of allocations) {
    const map = new Map<string, number>();
    for (const p of series[a.symbol]) {
      const k = dayBucket(p.ts);
      // last-write-wins (sorted ascending → final intra-day close kept)
      map.set(k, p.close);
      allDaysSet.add(k);
    }
    byDay[a.symbol] = map;
  }
  const allDays = [...allDaysSet].sort();

  // Forward-fill scan: for each day, ensure every symbol has a most-recent close.
  const lastSeen: Record<string, number | undefined> = {};
  let firstCloses: Record<string, number> | null = null;
  const curve: EquityPoint[] = [];

  for (const day of allDays) {
    for (const a of allocations) {
      const c = byDay[a.symbol].get(day);
      if (c !== undefined) lastSeen[a.symbol] = c;
    }
    // Need a close for every symbol before we can mark the buy-in.
    const ready = allocations.every((a) => lastSeen[a.symbol] !== undefined);
    if (!ready) continue;

    if (firstCloses === null) {
      firstCloses = {};
      for (const a of allocations) firstCloses[a.symbol] = lastSeen[a.symbol]!;
    }

    let value = 0;
    for (const a of allocations) {
      const shares = (INITIAL_VALUE * a.weight) / firstCloses[a.symbol];
      value += shares * (lastSeen[a.symbol] as number);
    }
    // ts at UTC noon for the bucket day (stable, irrespective of source TZ).
    curve.push({ ts: parseDay(day).getTime(), value });
  }

  if (curve.length < MIN_BARS) {
    throw new Error('not enough overlapping trading days for the chosen period');
  }
  return curve;
}

// ─── Metric calculators ───────────────────────────────────────────────────────

function metricsFromCurve(curve: EquityPoint[]): StrategyMetrics {
  if (curve.length < MIN_BARS) {
    return {
      totalReturnPct: 0, annualizedReturnPct: 0,
      maxDrawdownPct: 0, sharpe: 0, volatilityPct: 0,
    };
  }

  const start = curve[0].value;
  const end   = curve[curve.length - 1].value;
  const totalReturnPct = (end / start - 1) * 100;

  const days = (curve[curve.length - 1].ts - curve[0].ts) / (24 * 3600_000);
  const years = Math.max(days / 365.25, 1 / 365.25);
  const annualizedReturnPct = (Math.pow(end / start, 1 / years) - 1) * 100;

  // Daily simple returns.
  const dailyRet: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1].value;
    const cur  = curve[i].value;
    if (prev > 0) dailyRet.push(cur / prev - 1);
  }

  const mean    = dailyRet.reduce((a, b) => a + b, 0) / Math.max(dailyRet.length, 1);
  const variance = dailyRet.length > 1
    ? dailyRet.reduce((a, b) => a + (b - mean) ** 2, 0) / (dailyRet.length - 1)
    : 0;
  const stdDaily = Math.sqrt(variance);
  const volatilityPct = stdDaily * Math.sqrt(TRADING_DAYS_YEAR) * 100;
  const sharpe = stdDaily > 0
    ? (mean / stdDaily) * Math.sqrt(TRADING_DAYS_YEAR)
    : 0;

  // Max drawdown.
  let peak = curve[0].value;
  let maxDD = 0;
  for (const p of curve) {
    if (p.value > peak) peak = p.value;
    const dd = (p.value - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  const maxDrawdownPct = maxDD * 100;

  return {
    totalReturnPct:      round2(totalReturnPct),
    annualizedReturnPct: round2(annualizedReturnPct),
    maxDrawdownPct:      round2(maxDrawdownPct),
    sharpe:              round2(sharpe),
    volatilityPct:       round2(volatilityPct),
  };
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

// ─── Public entry point ──────────────────────────────────────────────────────

const BENCHMARK_SYMBOL = 'SPY';

/**
 * Run a buy-and-hold backtest. Throws on:
 *   - invalid allocations (sum-to-1, empty list, non-positive weights)
 *   - any symbol's data fetch failing
 *   - insufficient overlapping trading days
 */
export async function runBacktest(req: BacktestRequest): Promise<BacktestResult> {
  const allocations = normalizeAllocations(req.allocations);
  const startDate   = req.startDate;
  const endDate     = req.endDate ?? toIsoDay(new Date());
  const startMs     = parseDay(startDate).getTime();
  const endMs       = parseDay(endDate).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    throw new Error(`invalid date range: ${startDate} → ${endDate}`);
  }

  // Fetch all symbol histories in parallel. Any failure aborts the backtest.
  const symbols = allocations.map((a) => a.symbol);
  const seriesArr = await Promise.all(
    symbols.map(async (sym) => {
      try {
        return await fetchSeries(sym, startMs, endMs);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`failed to fetch ${sym}: ${msg}`);
      }
    }),
  );
  const series: Record<string, DailyClose[]> = {};
  symbols.forEach((s, i) => { series[s] = seriesArr[i]; });

  const equityCurve = buildPortfolioCurve(allocations, series);
  const metrics     = metricsFromCurve(equityCurve);

  // Benchmark — same period, single-symbol SPY at 100% weight.
  let benchmarkEquityCurve: EquityPoint[] = [];
  let benchmarkMetrics: StrategyMetrics = {
    totalReturnPct: 0, annualizedReturnPct: 0,
    maxDrawdownPct: 0, sharpe: 0, volatilityPct: 0,
  };
  try {
    const spy = await fetchSeries(BENCHMARK_SYMBOL, startMs, endMs);
    benchmarkEquityCurve = buildPortfolioCurve(
      [{ symbol: BENCHMARK_SYMBOL, weight: 1 }],
      { [BENCHMARK_SYMBOL]: spy },
    );
    benchmarkMetrics = metricsFromCurve(benchmarkEquityCurve);
  } catch (e) {
    // Benchmark failure is non-fatal — caller still gets the strategy result
    // with empty SPY series. Frontend handles the missing benchmark gracefully.
    console.warn('[backtest] SPY benchmark unavailable:',
      e instanceof Error ? e.message : String(e));
  }

  return {
    allocations,
    startDate,
    endDate,
    equityCurve,
    metrics,
    benchmarkEquityCurve,
    benchmarkMetrics,
  };
}
