/**
 * FRED (St. Louis Fed) data provider — B2-FRED
 *
 * Wraps the FRED REST API: https://fred.stlouisfed.org/docs/api/fred/
 * All functions require FRED_API_KEY to be set in the environment.
 * Use `isConfigured()` to guard callers and return 503 when the key is absent.
 *
 * Cache: 1-hour TTL (FRED series update monthly, hourly refresh is generous)
 */

import { TTLCache } from '../lib/cache.js';

// ---- Types ------------------------------------------------------------------

/** Shape returned by /api/macro/cpi */
export interface CPIResult {
  value: number;     // YoY CPI percentage, e.g. 3.47
  label: string;     // 'CPI YoY'
  delta: number;     // change vs previous month's YoY (percentage points)
  asOf: string;      // ISO 8601 date of latest observation
}

/** Shape returned by /api/macro/fed-funds */
export interface FedFundsResult {
  value: number;     // latest effective federal funds rate, e.g. 5.33
  label: string;     // 'Fed Funds Rate'
  asOf: string;      // ISO 8601 date of latest observation
}

/** Raw observation object returned by the FRED API */
interface FREDObservation {
  date: string;      // 'YYYY-MM-DD'
  value: string;     // numeric string, or '.' when missing
}

interface FREDResponse {
  observations: FREDObservation[];
}

// ---- Constants --------------------------------------------------------------

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

// Series IDs
const SERIES_CPI       = 'CPIAUCSL'; // CPI for All Urban Consumers, monthly SA
const SERIES_FEDFUNDS  = 'FEDFUNDS'; // Effective Federal Funds Rate, monthly

// 1-hour TTL — FRED series are updated monthly, so hourly polling is fine.
const ONE_HOUR_MS = 60 * 60 * 1000;

// Separate caches keyed by series ID to avoid cross-series eviction
const cpiCache      = new TTLCache<CPIResult>(ONE_HOUR_MS);
const fedFundsCache = new TTLCache<FedFundsResult>(ONE_HOUR_MS);

// ---- Helpers ----------------------------------------------------------------

/** Returns true when a FRED API key is present in the environment. */
export function isConfigured(): boolean {
  return Boolean(process.env.FRED_API_KEY?.trim());
}

/** Drop cached responses so the next getCPI / getFedFunds call re-fetches
 *  with the (possibly newly-set) FRED_API_KEY. Called by /api/settings/keys
 *  PUT after rewriting .env. */
export function reset(): void {
  cpiCache.clear();
  fedFundsCache.clear();
}

/**
 * Fetch up to `limit` observations for a FRED series, sorted descending
 * (most recent first).
 *
 * Throws if the HTTP request fails or the FRED API returns an error body.
 */
async function fetchObservations(
  seriesId: string,
  limit: number,
): Promise<FREDObservation[]> {
  const key = process.env.FRED_API_KEY!.trim();
  const url =
    `${FRED_BASE}` +
    `?series_id=${seriesId}` +
    `&api_key=${key}` +
    `&file_type=json` +
    `&sort_order=desc` +
    `&limit=${limit}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `FRED API error: ${res.status} ${res.statusText} for series ${seriesId}`,
    );
  }

  const body = (await res.json()) as FREDResponse;
  if (!Array.isArray(body.observations)) {
    throw new Error(`FRED API unexpected response shape for series ${seriesId}`);
  }

  // Filter out placeholder '.' values (FRED uses '.' for unreleased data)
  return body.observations.filter((o) => o.value !== '.');
}

// ---- Public API -------------------------------------------------------------

/**
 * getCPI() — returns the latest year-over-year CPI change.
 *
 * Fetches 13 monthly CPIAUCSL observations (desc order).
 * YoY = (obs[0] / obs[12] - 1) * 100
 * delta = current YoY minus previous-month's YoY (obs[0]/obs[1] derived)
 */
export async function getCPI(): Promise<CPIResult> {
  return cpiCache.get(SERIES_CPI, async () => {
    const obs = await fetchObservations(SERIES_CPI, 14); // 14 to compute delta

    if (obs.length < 13) {
      throw new Error('FRED CPIAUCSL: not enough observations to compute YoY');
    }

    // obs is descending: obs[0] = latest, obs[12] = 12 months ago
    const latest     = parseFloat(obs[0].value);
    const twelveAgo  = parseFloat(obs[12].value);
    const oneMonthAgo = parseFloat(obs[1].value);   // second-most-recent
    const thirteenAgo = obs.length >= 14 ? parseFloat(obs[13].value) : NaN;

    const yoy     = (latest / twelveAgo - 1) * 100;
    const prevYoy = !isNaN(thirteenAgo)
      ? (oneMonthAgo / thirteenAgo - 1) * 100
      : yoy; // fallback: delta = 0 when we can't compute prev
    const delta   = yoy - prevYoy;

    return {
      value: parseFloat(yoy.toFixed(2)),
      label: 'CPI YoY',
      delta: parseFloat(delta.toFixed(2)),
      asOf:  obs[0].date,
    };
  });
}

/**
 * getFedFunds() — returns the latest effective federal funds rate.
 *
 * Fetches only the most recent FEDFUNDS observation.
 */
export async function getFedFunds(): Promise<FedFundsResult> {
  return fedFundsCache.get(SERIES_FEDFUNDS, async () => {
    const obs = await fetchObservations(SERIES_FEDFUNDS, 1);

    if (obs.length === 0) {
      throw new Error('FRED FEDFUNDS: no observations returned');
    }

    return {
      value: parseFloat(parseFloat(obs[0].value).toFixed(2)),
      label: 'Fed Funds Rate',
      asOf:  obs[0].date,
    };
  });
}
