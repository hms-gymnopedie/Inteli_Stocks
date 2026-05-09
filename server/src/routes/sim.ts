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
import { fetchHistoricalRange, fetchQuotes } from '../providers/yahoo.js';
import { localStore } from '../storage/local.js';
import type { Holding, Trade } from '../storage/types.js';

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

// ─── GET /strategies/:id/breakdown — per-holding sparklines + return ────────

interface HoldingBreakdown {
  symbol:      string;
  weight:      number;            // 0-1
  available:   boolean;            // false when no bars in window
  firstClose:  number | null;
  firstDate:   string | null;
  lastClose:   number | null;
  lastDate:    string | null;
  returnPct:   number | null;
  daysHeld:    number | null;
  series:      { ts: number; value: number }[];  // normalized to start=100
}

sim.get('/strategies/:id/breakdown', async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id ?? '');
  const s = getStrategy(id);
  if (!s) { res.status(404).json({ error: 'strategy not found' }); return; }

  const startDate = s.startDate;
  const endDate   = s.endDate ?? new Date().toISOString().slice(0, 10);
  const period1   = new Date(`${startDate}T12:00:00Z`);
  const period2   = new Date(`${endDate}T12:00:00Z`);

  const breakdowns: HoldingBreakdown[] = await Promise.all(
    s.allocations.map(async (a): Promise<HoldingBreakdown> => {
      try {
        const rows = await fetchHistoricalRange(a.symbol, period1, period2, '1d');
        if (!Array.isArray(rows) || rows.length === 0) {
          return { symbol: a.symbol, weight: a.weight, available: false,
                   firstClose: null, firstDate: null, lastClose: null,
                   lastDate: null, returnPct: null, daysHeld: null, series: [] };
        }
        // Map raw rows → adjClose-preferred series so splits don't show.
        type Row = { date: Date | string; close?: number; adjClose?: number };
        const closes: { ts: number; close: number; date: string }[] = [];
        for (const r of rows as Row[]) {
          const c = typeof r.adjClose === 'number' ? r.adjClose
                  : typeof r.close === 'number'    ? r.close
                  : NaN;
          if (!Number.isFinite(c)) continue;
          const d = r.date instanceof Date ? r.date : new Date(r.date as string);
          closes.push({ ts: d.getTime(), close: c, date: d.toISOString().slice(0, 10) });
        }
        if (closes.length < 2) {
          return { symbol: a.symbol, weight: a.weight, available: false,
                   firstClose: null, firstDate: null, lastClose: null,
                   lastDate: null, returnPct: null, daysHeld: null, series: [] };
        }
        closes.sort((x, y) => x.ts - y.ts);
        const first = closes[0];
        const last  = closes[closes.length - 1];
        const returnPct = (last.close / first.close - 1) * 100;
        const daysHeld  = (last.ts - first.ts) / (24 * 3600_000);
        // Normalize each point to start=100 for sparkline display.
        const series = closes.map((p) => ({
          ts:    p.ts,
          value: (p.close / first.close) * 100,
        }));
        return {
          symbol:     a.symbol,
          weight:     a.weight,
          available:  true,
          firstClose: first.close,
          firstDate:  first.date,
          lastClose:  last.close,
          lastDate:   last.date,
          returnPct:  Number(returnPct.toFixed(2)),
          daysHeld:   Math.round(daysHeld),
          series,
        };
      } catch {
        return { symbol: a.symbol, weight: a.weight, available: false,
                 firstClose: null, firstDate: null, lastClose: null,
                 lastDate: null, returnPct: null, daysHeld: null, series: [] };
      }
    }),
  );

  res.json({ id, name: s.name, startDate, endDate, holdings: breakdowns });
});

// ─── POST /strategies/:id/copy-to-portfolio — replicate as live portfolio ───

interface CopyBody {
  amount?:  unknown;   // total dollar amount; default 100_000
  replace?: unknown;   // if true, wipe existing holdings + trades first
}

sim.post('/strategies/:id/copy-to-portfolio', async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id ?? '');
  const s = getStrategy(id);
  if (!s) { res.status(404).json({ error: 'strategy not found' }); return; }

  const body = (req.body ?? {}) as CopyBody;
  const amountIn = typeof body.amount === 'number' ? body.amount : Number(body.amount ?? 100_000);
  const amount = Number.isFinite(amountIn) && amountIn > 0 ? amountIn : 100_000;
  const replace = body.replace === true;

  const startDate = s.startDate;
  const period1   = new Date(`${startDate}T12:00:00Z`);
  const period2   = new Date(`${startDate}T18:00:00Z`); // small window — we just need that day's close

  // Pull current quotes for name + currency.
  const quotes = await fetchQuotes(s.allocations.map((a) => a.symbol))
    .catch(() => [] as Awaited<ReturnType<typeof fetchQuotes>>);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qMap = new Map<string, any>(quotes.map((q: any) => [q.symbol, q]));

  // Resolve the entry price for each holding (close on startDate or first
  // available trading day after).
  const entries = await Promise.all(
    s.allocations.map(async (a) => {
      try {
        // Widen the window until we get a bar — markets may be closed on startDate.
        const wide = new Date(period1.getTime() + 14 * 24 * 3600_000);
        const rows = await fetchHistoricalRange(a.symbol, period1, wide, '1d');
        type Row = { date: Date | string; close?: number; adjClose?: number };
        const first = (rows as Row[]).find((r) => Number.isFinite(r.close as number) || Number.isFinite(r.adjClose as number));
        if (!first) return null;
        const px = typeof first.adjClose === 'number' ? first.adjClose
                 : typeof first.close === 'number'    ? first.close
                 : NaN;
        if (!Number.isFinite(px)) return null;
        const d = first.date instanceof Date ? first.date : new Date(first.date as string);
        return { symbol: a.symbol, weight: a.weight, price: px, date: d.toISOString().slice(0, 10) };
      } catch {
        return null;
      }
    }),
  );

  const usable = entries.filter((e): e is NonNullable<typeof e> => e != null);
  if (usable.length === 0) {
    res.status(400).json({ error: 'no usable historical entry prices for any allocation' });
    return;
  }

  // Build trades + holdings.
  const trades: Trade[] = [];
  const holdings: Holding[] = [];
  for (const e of usable) {
    const q = qMap.get(e.symbol);
    const name     = q?.shortName ?? q?.longName ?? e.symbol;
    const currency = (q?.currency as string | undefined) ?? 'USD';
    const dollars  = amount * e.weight;
    const qty      = Math.round((dollars / e.price) * 10000) / 10000;
    if (qty <= 0) continue;
    trades.push({
      date:     e.date,
      symbol:   e.symbol,
      side:     'BUY',
      quantity: qty,
      price:    Number(e.price.toFixed(2)),
      currency,
    });
    holdings.push({
      symbol:    e.symbol,
      name:      String(name),
      weight:    `${(e.weight * 100).toFixed(1)}%`,
      // price/dayPct/plPct overwritten on every /holdings GET via B16-1.
      price:     `$${e.price.toFixed(2)}`,
      dayPct:    '+0.00',
      plPct:     '+0%',
      sparkSeed: Math.floor(Math.random() * 1000),
      risk:      3,
    });
  }

  // Apply to local store. (Supabase mode users would need separate handling
  // but for now this matches the rest of /api/portfolio's local-only writes.)
  const store = await localStore.read(null);
  if (replace) {
    store.holdings = holdings;
    store.trades   = trades;
  } else {
    // Append. Trades just concat. Holdings deduped by symbol — strategy wins.
    const existingSyms = new Set(holdings.map((h) => h.symbol.toUpperCase()));
    store.holdings = [
      ...store.holdings.filter((h) => !existingSyms.has(h.symbol.toUpperCase())),
      ...holdings,
    ];
    store.trades = [...trades, ...store.trades];
  }
  await localStore.write(null, store);

  res.json({
    ok:           true,
    addedTrades:  trades.length,
    addedHoldings: holdings.length,
    skipped:      s.allocations.length - usable.length,
    replaced:     replace,
  });
});
