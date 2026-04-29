import { Router } from 'express';

/**
 * /api/portfolio/* — owned by B2-MD.
 * Phase 2 backing store: a single JSON file under ~/.intelistock/portfolio.json
 * (no auth yet — that's B5). Endpoints to add:
 *   GET /summary
 *   GET /equity-curve?range
 *   GET /allocation?by
 *   GET /holdings
 *   GET /watchlist?region
 *   GET /trades
 *   GET /risk-factors
 */
export const portfolio = Router();
