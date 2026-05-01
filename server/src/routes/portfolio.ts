/**
 * /api/portfolio/* — B2-MD (original) + B5-CR (Supabase dual-mode refactor)
 *
 * Storage strategy (determined per-request via req.user):
 *   req.user === null  → local mode  → ~/.intelistock/portfolio.json
 *   req.user !== null  → Supabase mode → portfolios table keyed by user_id
 *
 * The `requireAuth` middleware (mounted in index.ts) populates req.user before
 * these handlers run. In local mode it sets req.user=null (no-op pass-through),
 * so existing behaviour is fully preserved.
 *
 * The equity-curve endpoint is stateless (generated from a seed) and stays
 * read-only for now — it is not stored per-user.
 */

import { Router, type Request, type Response } from 'express';
import * as supabaseProvider from '../providers/supabase.js';
import { localStore }    from '../storage/local.js';
import { supabaseStore } from '../storage/supabase.js';
import type { PortfolioStorage } from '../storage/types.js';

export const portfolio = Router();

// ─── Storage selector ─────────────────────────────────────────────────────────

/**
 * Returns the correct storage backend for this request.
 * - Local mode  (req.user === null, Supabase not configured): localStore
 * - Supabase mode (req.user is set, Supabase configured):     supabaseStore
 *
 * If Supabase is configured but req.user is null (unauthenticated request that
 * somehow passed the middleware), we still fall back to localStore so the
 * response isn't empty.
 */
function storeFor(req: Request): PortfolioStorage {
  if (supabaseProvider.isConfigured() && req.user !== null) {
    return supabaseStore;
  }
  return localStore;
}

// ─── Equity curve generator (stateless, unchanged from B2-MD) ────────────────

type EquityRange = '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y' | 'MAX';
interface EquityPoint { ts: number; value: number }

function generateEquityCurve(range: EquityRange, seed: number): EquityPoint[] {
  const barCounts: Partial<Record<EquityRange, number>> = {
    '1D': 78, '1W': 35, '1M': 22, '3M': 65, '6M': 130,
    '1Y': 253, '5Y': 260, 'YTD': 83, 'MAX': 520,
  };
  const count = barCounts[range] ?? 253;
  const points: EquityPoint[] = [];
  let value = 900_000;
  const now = Date.now();
  const msPerBar = (365 * 24 * 3600_000) / 253;
  for (let i = 0; i < count; i++) {
    const rand = ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280;
    value = value * (1 + (rand - 0.44) * 0.018);
    points.push({ ts: now - (count - i) * msPerBar, value });
  }
  return points;
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

portfolio.get('/summary', (req: Request, res: Response): void => {
  const store  = storeFor(req);
  const userId = req.user?.id ?? null;
  void store.read(userId).then((s) => { res.json(s.summary); });
});

portfolio.get('/equity-curve', (req: Request, res: Response): void => {
  const range = String(req.query.range ?? '1Y') as EquityRange;
  res.json(generateEquityCurve(range, 42));
});

portfolio.get('/allocation', (req: Request, res: Response): void => {
  const by    = String(req.query.by ?? 'sector') as 'sector' | 'region' | 'asset';
  const store  = storeFor(req);
  const userId = req.user?.id ?? null;
  void store.read(userId).then((s) => {
    res.json(s.allocation[by] ?? s.allocation.sector);
  });
});

portfolio.get('/holdings', (req: Request, res: Response): void => {
  const store  = storeFor(req);
  const userId = req.user?.id ?? null;
  void store.read(userId).then((s) => { res.json(s.holdings); });
});

portfolio.get('/watchlist', (req: Request, res: Response): void => {
  const region = String(req.query.region ?? 'KR').toUpperCase();
  const store  = storeFor(req);
  const userId = req.user?.id ?? null;
  void store.read(userId).then((s) => {
    if (region === 'KR') {
      res.json(s.watchlist.KR);
    } else {
      res.json([]);
    }
  });
});

portfolio.get('/trades', (req: Request, res: Response): void => {
  const store  = storeFor(req);
  const userId = req.user?.id ?? null;
  void store.read(userId).then((s) => { res.json(s.trades); });
});

portfolio.get('/risk-factors', (req: Request, res: Response): void => {
  const store  = storeFor(req);
  const userId = req.user?.id ?? null;
  void store.read(userId).then((s) => { res.json(s.riskFactors); });
});
