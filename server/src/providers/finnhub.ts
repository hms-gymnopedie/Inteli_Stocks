/**
 * Finnhub provider — B13-E1.
 *
 * Adds a second market-data source for the gaps yahoo-finance2 doesn't
 * cover well: economic calendar, option chains, news sentiment.
 * Free tier: 60 calls/min. Endpoints used:
 *   - GET /calendar/economic         (E2 — economic events)
 *   - GET /stock/option-chain        (E3 — IV surface)
 *
 * isConfigured() guards all callers; routes return mock fallback when false.
 */

import { TTLCache } from '../lib/cache.js';

// ─── Public types ────────────────────────────────────────────────────────────

/** One row of /calendar/economic — Finnhub-flavoured. */
export interface FinnhubEconomicEvent {
  /** ISO date like '2026-05-02' (no time component on the daily API). */
  time: string;
  country: string;
  /** 1=low, 2=med, 3=high — Finnhub's own scale. */
  impact: number;
  event: string;
  actual?: number | null;
  estimate?: number | null;
  prev?: number | null;
  unit?: string;
}

/** One option chain point — Finnhub-flavoured. */
export interface FinnhubOption {
  expirationDate: string;     // 'YYYY-MM-DD'
  contractName:   string;
  strike:         number;
  contractSize:   number;
  type:           'call' | 'put';
  /** Implied volatility in decimal (0.42 = 42%). */
  impliedVolatility?: number;
  /** Last trade price. */
  lastPrice?: number;
  bid?: number;
  ask?: number;
  volume?: number;
  openInterest?: number;
  inTheMoney?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const ONE_HOUR_MS  = 60 * 60 * 1000;

// One cache per logical query so eviction doesn't cross-contaminate.
const _calendarCache = new TTLCache<FinnhubEconomicEvent[]>(ONE_HOUR_MS);
const _optionsCache  = new TTLCache<FinnhubOption[]>(ONE_HOUR_MS);

// ─── Configuration ───────────────────────────────────────────────────────────

export function isConfigured(): boolean {
  return Boolean(process.env.FINNHUB_API_KEY?.trim());
}

export function reset(): void {
  _calendarCache.clear();
  _optionsCache.clear();
}

function token(): string {
  const k = process.env.FINNHUB_API_KEY?.trim();
  if (!k) throw new Error('Finnhub provider requested but FINNHUB_API_KEY is not set');
  return k;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, token: token() }).toString();
  const url = `${FINNHUB_BASE}${path}?${qs}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Finnhub ${path}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch economic events between [from, to] (ISO 'YYYY-MM-DD'). Defaults to
 * a 7-day window centered on today. Cached per (from,to) for 1 hour.
 */
export async function getEconomicCalendar(
  from?: string,
  to?: string,
): Promise<FinnhubEconomicEvent[]> {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const f = from ?? fmt(new Date(today.getTime() - 1 * 24 * 3600_000));
  const t = to   ?? fmt(new Date(today.getTime() + 6 * 24 * 3600_000));
  const key = `${f}:${t}`;
  return _calendarCache.get(key, async () => {
    interface Resp { economicCalendar?: FinnhubEconomicEvent[] }
    const data = await get<Resp>('/calendar/economic', { from: f, to: t });
    return Array.isArray(data.economicCalendar) ? data.economicCalendar : [];
  });
}

/**
 * Fetch the option chain for a symbol. Finnhub returns one row per contract;
 * the caller (iv-surface route) buckets by expiry × strike to build the
 * surface. Cached per symbol for 1 hour.
 */
export async function getOptionChain(symbol: string): Promise<FinnhubOption[]> {
  const key = `oc:${symbol}`;
  return _optionsCache.get(key, async () => {
    interface OptionData { options?: { expirationDate: string; options: { CALL?: FinnhubOption[]; PUT?: FinnhubOption[] } }[] }
    const data = await get<OptionData>('/stock/option-chain', { symbol });
    const out: FinnhubOption[] = [];
    for (const exp of data.options ?? []) {
      const expirationDate = exp.expirationDate;
      const calls = exp.options?.CALL ?? [];
      const puts  = exp.options?.PUT  ?? [];
      for (const c of calls) out.push({ ...c, expirationDate, type: 'call' });
      for (const p of puts)  out.push({ ...p, expirationDate, type: 'put'  });
    }
    return out;
  });
}
