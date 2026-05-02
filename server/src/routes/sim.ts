/**
 * /api/sim/* — strategy backtest + leaderboard — B8-SIM
 *
 * Endpoints:
 *   POST   /backtest             run a backtest, persist, return the strategy
 *   GET    /strategies           list all (sorted by totalReturnPct desc)
 *   GET    /strategies/:id       fetch one
 *   DELETE /strategies/:id       remove one
 *
 * Storage: ~/.intelistock/strategies.json (single-user, file-backed).
 * The route handlers are stateless — all state lives in storage/strategies.ts.
 *
 * Auth: not gated by requireAuth (mounted at top level in index.ts) so the
 * leaderboard works in local mode without Supabase. If/when multi-user
 * support is needed, this can move behind requireAuth like /api/portfolio.
 */

import { Router, type Request, type Response } from 'express';
import { runBacktest } from '../lib/backtest.js';
import {
  addStrategy,
  deleteStrategy,
  getStrategy,
  listStrategies,
  type Strategy,
} from '../storage/strategies.js';

export const sim = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function badRequest(res: Response, msg: string): void {
  res.status(400).json({ error: msg });
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

interface BacktestBody {
  name?:        unknown;
  allocations?: unknown;
  startDate?:   unknown;
  endDate?:     unknown;
}

sim.post('/backtest', async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as BacktestBody;
  const name        = typeof body.name      === 'string' ? body.name.trim()      : '';
  const startDate   = typeof body.startDate === 'string' ? body.startDate.trim() : '';
  const endDate     = typeof body.endDate   === 'string' ? body.endDate.trim()   : undefined;
  const allocations = Array.isArray(body.allocations) ? body.allocations : null;

  if (!name)                     { badRequest(res, 'name is required'); return; }
  if (!startDate)                { badRequest(res, 'startDate is required (YYYY-MM-DD)'); return; }
  if (!allocations || allocations.length === 0) {
    badRequest(res, 'allocations is required (non-empty array of {symbol, weight})');
    return;
  }

  // Coerce + shape-check each allocation up front so the engine errors are
  // about market data, not request shape.
  const shaped = [];
  for (const a of allocations) {
    if (typeof a !== 'object' || a === null) {
      badRequest(res, 'each allocation must be an object {symbol, weight}');
      return;
    }
    const obj = a as { symbol?: unknown; weight?: unknown };
    if (typeof obj.symbol !== 'string' || obj.symbol.trim() === '') {
      badRequest(res, 'each allocation must have a non-empty symbol string'); return;
    }
    const w = typeof obj.weight === 'number' ? obj.weight : Number(obj.weight);
    if (!Number.isFinite(w) || w <= 0) {
      badRequest(res, `weight for ${obj.symbol} must be a positive number`); return;
    }
    shaped.push({ symbol: obj.symbol.trim().toUpperCase(), weight: w });
  }

  try {
    const result = await runBacktest({
      allocations: shaped,
      startDate,
      endDate,
    });
    const persisted: Strategy = addStrategy({
      name,
      allocations:           result.allocations,
      startDate:             result.startDate,
      endDate:               result.endDate,
      metrics:               result.metrics,
      equityCurve:           result.equityCurve,
      benchmarkMetrics:      result.benchmarkMetrics,
      benchmarkEquityCurve:  result.benchmarkEquityCurve,
    });
    res.json(persisted);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

sim.get('/strategies', (_req: Request, res: Response): void => {
  const all = listStrategies();
  all.sort((a, b) => b.metrics.totalReturnPct - a.metrics.totalReturnPct);
  res.json(all);
});

sim.get('/strategies/:id', (req: Request, res: Response): void => {
  const id = String(req.params.id ?? '');
  const s = getStrategy(id);
  if (!s) { res.status(404).json({ error: 'strategy not found' }); return; }
  res.json(s);
});

sim.delete('/strategies/:id', (req: Request, res: Response): void => {
  const id = String(req.params.id ?? '');
  const ok = deleteStrategy(id);
  if (!ok) { res.status(404).json({ error: 'strategy not found' }); return; }
  res.status(204).end();
});
