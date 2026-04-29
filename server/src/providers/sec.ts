/**
 * SEC EDGAR provider — company tickers map + recent filings fetcher.
 *
 * Two public functions:
 *   getCompanyTickers() → Map<TICKER_UPPER, CIK_STRING>
 *   getRecentFilings(cik, limit?)  → SEC recent-filings array
 *
 * Caching:
 *   - Company-tickers JSON: module-level singleton promise (fetch once, keep forever).
 *   - Per-CIK submissions: TTLCache with 1-hour TTL.
 *
 * SEC policy: every request must carry a User-Agent header identifying the app
 * and a contact email.  We use Node 20's built-in fetch throughout.
 */

import { TTLCache } from '../lib/cache.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEC_UA = 'InteliStock dev contact@example.com';

const TICKERS_URL =
  'https://www.sec.gov/files/company_tickers.json';

const SUBMISSIONS_BASE =
  'https://data.sec.gov/submissions/CIK';

// ─── Types ────────────────────────────────────────────────────────────────────

/** One entry from SEC company_tickers.json */
interface TickerEntry {
  ticker:  string;
  cik_str: number;
  title:   string;
}

/** Shape of a single company's submissions JSON from EDGAR. */
interface SubmissionsJson {
  filings: {
    recent: {
      form:                   string[];
      filingDate:             string[];
      primaryDocDescription:  string[];
    };
  };
}

/** Raw filing row returned from getRecentFilings. */
export interface RawFiling {
  form:        string;
  filingDate:  string;  // "YYYY-MM-DD"
  description: string;
}

// ─── Company-tickers cache (one-shot module-level promise) ────────────────────

let tickersPromise: Promise<Map<string, string>> | null = null;

/**
 * Downloads and caches `https://www.sec.gov/files/company_tickers.json`.
 * Returns a Map keyed by UPPER-CASE ticker → zero-padded 10-digit CIK string.
 * The promise is memoised for the lifetime of the server process.
 */
export function getCompanyTickers(): Promise<Map<string, string>> {
  if (tickersPromise) return tickersPromise;

  tickersPromise = (async () => {
    const res = await fetch(TICKERS_URL, {
      headers: { 'User-Agent': SEC_UA },
    });

    if (!res.ok) {
      throw new Error(`SEC company_tickers fetch failed: ${res.status}`);
    }

    // The JSON is a plain object: { "0": { cik_str, ticker, title }, "1": … }
    const raw = (await res.json()) as Record<string, TickerEntry>;
    const map = new Map<string, string>();

    for (const entry of Object.values(raw)) {
      const cik  = String(entry.cik_str).padStart(10, '0');
      map.set(entry.ticker.toUpperCase(), cik);
    }

    console.log(`[SEC] company tickers loaded: ${map.size} entries`);
    return map;
  })().catch((err) => {
    // Reset so the next call retries.
    tickersPromise = null;
    throw err;
  });

  return tickersPromise;
}

// ─── Per-CIK submissions cache (1-hour TTL) ───────────────────────────────────

/** 1 hour in milliseconds */
const ONE_HOUR_MS = 60 * 60 * 1_000;

const submissionsCache = new TTLCache<RawFiling[]>(ONE_HOUR_MS);

/**
 * Fetches the most-recent N filings for the given 10-digit CIK string.
 * Results are cached for 1 hour per CIK.
 *
 * @param cik    Zero-padded 10-digit CIK string (e.g. "0001045810")
 * @param limit  Maximum number of filings to return (default 20)
 */
export async function getRecentFilings(
  cik:   string,
  limit: number = 20,
): Promise<RawFiling[]> {
  return submissionsCache.get(cik, async () => {
    const url = `${SUBMISSIONS_BASE}${cik}.json`;

    const res = await fetch(url, {
      headers: { 'User-Agent': SEC_UA },
    });

    if (!res.ok) {
      throw new Error(`SEC submissions fetch failed for CIK ${cik}: ${res.status}`);
    }

    const data = (await res.json()) as SubmissionsJson;
    const recent = data.filings?.recent;

    if (!recent) return [];

    const { form, filingDate, primaryDocDescription } = recent;
    const count = Math.min(form.length, limit);
    const filings: RawFiling[] = [];

    for (let i = 0; i < count; i++) {
      filings.push({
        form:        (form[i] ?? '').trim(),
        filingDate:  filingDate[i] ?? '',
        description: (primaryDocDescription[i] ?? '').trim(),
      });
    }

    return filings;
  });
}
