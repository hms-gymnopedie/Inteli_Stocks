import { Router } from 'express';

/**
 * /api/market/* — owned by B2-MD.
 * Endpoints to add:
 *   GET /indices             → quote(['^GSPC','^IXIC','^DJI','^KS11','^VIX','DX-Y.NYB','^TNX','BTC-USD'])
 *   GET /intraday?symbol&range
 *   GET /sp-constituents
 *   GET /sectors?range
 *   GET /macro?keys=...      → mixes yahoo (10Y, FX, WTI) + delegates CPI to providers/fred
 *   GET /calendar?date
 *   GET /fear-greed
 *   GET /session-volume
 *   GET /search?q
 */
export const market = Router();
