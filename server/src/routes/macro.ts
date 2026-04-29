import { Router, type Request, type Response } from 'express';
import { isConfigured, getCPI, getFedFunds } from '../providers/fred.js';

/**
 * /api/macro/* — B2-FRED
 *
 * All endpoints require FRED_API_KEY to be set.  When the key is absent,
 * every endpoint responds 503 with { ok: false, reason: 'fred_not_configured' }
 * so the frontend (or B2-MD's macro fan-out) can fall back to mock values.
 *
 * Endpoints:
 *   GET /cpi        — latest CPI YoY with delta and asOf date
 *   GET /fed-funds  — latest effective federal funds rate
 */

export const macro = Router();

// ---- Guard middleware -------------------------------------------------------

/**
 * If FRED_API_KEY is not set, short-circuit every request on this router with
 * a 503 so callers know to use their mock/fallback path.
 */
macro.use((_req: Request, res: Response, next: () => void) => {
  if (!isConfigured()) {
    res.status(503).json({ ok: false, reason: 'fred_not_configured' });
    return;
  }
  next();
});

// ---- GET /cpi ---------------------------------------------------------------

/**
 * Returns the latest year-over-year CPI percentage.
 *
 * Response (200):
 * {
 *   ok: true,
 *   data: { value: 3.47, label: "CPI YoY", delta: -0.12, asOf: "2025-03-01" }
 * }
 *
 * Response (503) when FRED_API_KEY is not set:
 * { ok: false, reason: "fred_not_configured" }
 *
 * Response (502) when FRED upstream call fails:
 * { ok: false, reason: "upstream_error", message: "..." }
 */
macro.get('/cpi', async (_req: Request, res: Response) => {
  try {
    const data = await getCPI();
    res.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[macro/cpi] upstream error:', message);
    res.status(502).json({ ok: false, reason: 'upstream_error', message });
  }
});

// ---- GET /fed-funds ---------------------------------------------------------

/**
 * Returns the latest effective federal funds rate.
 *
 * Response (200):
 * {
 *   ok: true,
 *   data: { value: 5.33, label: "Fed Funds Rate", asOf: "2025-03-01" }
 * }
 *
 * Response (503) when FRED_API_KEY is not set:
 * { ok: false, reason: "fred_not_configured" }
 *
 * Response (502) when FRED upstream call fails:
 * { ok: false, reason: "upstream_error", message: "..." }
 */
macro.get('/fed-funds', async (_req: Request, res: Response) => {
  try {
    const data = await getFedFunds();
    res.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[macro/fed-funds] upstream error:', message);
    res.status(502).json({ ok: false, reason: 'upstream_error', message });
  }
});
