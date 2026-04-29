import { Router } from 'express';

/**
 * /api/macro/* — owned by B2-FRED. Calls providers/fred.ts.
 * If FRED_API_KEY is unset, endpoints should respond 503
 * with {ok:false, reason:'fred_not_configured'} so the frontend
 * can fall back to mock values gracefully.
 *
 * Endpoints to add:
 *   GET /cpi
 *   GET /fed-funds
 *   (extensible to any FRED series)
 */
export const macro = Router();
