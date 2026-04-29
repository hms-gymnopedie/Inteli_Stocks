import { Router } from 'express';

/**
 * /api/security/* — most endpoints owned by B2-MD; /:symbol/filings owned by B2-SEC.
 * Endpoints to add:
 *   GET /:symbol/profile
 *   GET /:symbol/ohlc?range
 *   GET /:symbol/fundamentals
 *   GET /:symbol/targets
 *   GET /:symbol/peers
 *   GET /:symbol/earnings
 *   GET /:symbol/iv-surface
 *   GET /:symbol/filings    ← B2-SEC (uses providers/sec.ts)
 */
export const security = Router();
