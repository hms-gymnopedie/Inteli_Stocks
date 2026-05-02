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
import type {
  Holding,
  PortfolioStorage,
  PortfolioStore,
  PortfolioSummary,
  Trade,
  WatchlistEntry,
} from '../storage/types.js';
import { runBacktest, type EquityPoint as BTEquityPoint } from '../lib/backtest.js';

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

// ─── Real equity curve from holdings × historical prices — B11-4 ─────────────

type EquityRange = '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y' | 'MAX';

/** "12.4%" → 0.124 ; falls back to 0 on bad input. */
function parseWeight(s: string): number {
  const m = /^\s*([\d.]+)\s*%/.exec(s);
  return m ? parseFloat(m[1]) / 100 : 0;
}

/** Best-effort detection that a holding is USD-priced (the backtest engine
 *  ignores currency conversion, so we restrict to USD names to keep the
 *  shape of the curve honest). */
function isUSDPriced(h: Holding): boolean {
  const p = (h.price ?? '').trim();
  return p.startsWith('$') || p.startsWith('-$');
}

function rangeToStartDate(range: EquityRange): string {
  const today = new Date();
  const d = new Date(today);
  switch (range) {
    // Daily-close backtest → '1D' degenerate; promote to 1W for a usable curve.
    case '1D':
    case '1W':  d.setDate(d.getDate() - 7);            break;
    case '1M':  d.setMonth(d.getMonth() - 1);          break;
    case '3M':  d.setMonth(d.getMonth() - 3);          break;
    case '6M':  d.setMonth(d.getMonth() - 6);          break;
    case 'YTD': return new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
    case '1Y':  d.setFullYear(d.getFullYear() - 1);    break;
    case '5Y':  d.setFullYear(d.getFullYear() - 5);    break;
    case 'MAX': d.setFullYear(d.getFullYear() - 10);   break;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Build a buy-and-hold equity curve for the user's current USD holdings,
 * scaled to end at their actual NAV. Returns [] when no usable holdings or
 * when the underlying backtest fails — frontend shows "no data" rather than
 * fabricated numbers.
 */
async function realEquityCurve(
  store: PortfolioStore,
  range: EquityRange,
): Promise<BTEquityPoint[]> {
  const usd = store.holdings.filter(isUSDPriced);
  if (usd.length === 0) return [];

  const raw = usd.map((h) => ({ symbol: h.symbol, weight: parseWeight(h.weight) }))
                 .filter((a) => a.weight > 0);
  const sum = raw.reduce((acc, a) => acc + a.weight, 0);
  if (sum <= 0) return [];
  const allocations = raw.map((a) => ({ symbol: a.symbol, weight: a.weight / sum }));

  try {
    const result = await runBacktest({
      allocations,
      startDate: rangeToStartDate(range),
      endDate:   new Date().toISOString().slice(0, 10),
    });
    if (result.equityCurve.length === 0) return [];
    // Scale so the curve ENDS at the user's reported NAV — keeps the chart
    // anchored to the real number while preserving the simulated shape.
    const navTarget = store.summary.nav;
    const lastValue = result.equityCurve[result.equityCurve.length - 1].value;
    const k = lastValue > 0 ? navTarget / lastValue : 1;
    return result.equityCurve.map((p) => ({ ts: p.ts, value: p.value * k }));
  } catch (err) {
    console.warn('[portfolio/equity-curve] backtest failed:', (err as Error).message);
    return [];
  }
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

portfolio.get('/summary', (req: Request, res: Response): void => {
  const store  = storeFor(req);
  const userId = req.user?.id ?? null;
  void store.read(userId).then((s) => { res.json(s.summary); });
});

portfolio.get('/equity-curve', (req: Request, res: Response): void => {
  const range = String(req.query.range ?? '1Y') as EquityRange;
  const store  = storeFor(req);
  const userId = req.user?.id ?? null;
  void store.read(userId)
    .then((s) => realEquityCurve(s, range))
    .then((curve) => res.json(curve))
    .catch((err: unknown) => {
      console.error('[portfolio/equity-curve]', err);
      res.json([]);
    });
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

// ─── Mutation endpoints — B8-PF-CRUD ─────────────────────────────────────────
//
// Each handler reads the full store, mutates one slice, and writes the whole
// thing back. localStore.write() fires the Google Sheets mirror as a side
// effect (B5-GS), so every mutation appends a fresh snapshot block to the
// user's spreadsheet automatically.

function isString(v: unknown): v is string {
  return typeof v === 'string';
}
function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function validTrade(b: unknown): b is Trade {
  if (!b || typeof b !== 'object') return false;
  const t = b as Partial<Trade>;
  return (
    isString(t.date) && isString(t.symbol) &&
    (t.side === 'BUY' || t.side === 'SELL') &&
    isNumber(t.quantity) && isNumber(t.price) && isString(t.currency)
  );
}

function validHolding(b: unknown): b is Holding {
  if (!b || typeof b !== 'object') return false;
  const h = b as Partial<Holding>;
  return (
    isString(h.symbol) && isString(h.name) && isString(h.weight) &&
    isString(h.price) && isString(h.dayPct) && isString(h.plPct) &&
    isNumber(h.sparkSeed) && isNumber(h.risk)
  );
}

function validWatchlistEntry(b: unknown): b is WatchlistEntry {
  if (!b || typeof b !== 'object') return false;
  const w = b as Partial<WatchlistEntry>;
  return (
    isString(w.code) && isString(w.name) && isString(w.change) &&
    isNumber(w.seed) && (w.direction === 1 || w.direction === -1)
  );
}

// Trades ----------------------------------------------------------------------

portfolio.post('/trades', (req: Request, res: Response): void => {
  if (!validTrade(req.body)) {
    res.status(400).json({ ok: false, reason: 'invalid_trade' });
    return;
  }
  const store  = storeFor(req);
  const userId = req.user?.id ?? null;
  void store.read(userId).then(async (s) => {
    s.trades = [req.body as Trade, ...s.trades];
    await store.write(userId, s);
    res.status(201).json(req.body);
  });
});

portfolio.delete('/trades/:idx', (req: Request, res: Response): void => {
  const idx = Number(req.params.idx);
  if (!Number.isInteger(idx) || idx < 0) {
    res.status(400).json({ ok: false, reason: 'invalid_index' });
    return;
  }
  const store  = storeFor(req);
  const userId = req.user?.id ?? null;
  void store.read(userId).then(async (s) => {
    if (idx >= s.trades.length) {
      res.status(404).json({ ok: false, reason: 'not_found' });
      return;
    }
    s.trades.splice(idx, 1);
    await store.write(userId, s);
    res.status(204).end();
  });
});

// Holdings --------------------------------------------------------------------

portfolio.post('/holdings', (req: Request, res: Response): void => {
  if (!validHolding(req.body)) {
    res.status(400).json({ ok: false, reason: 'invalid_holding' });
    return;
  }
  const store  = storeFor(req);
  const userId = req.user?.id ?? null;
  void store.read(userId).then(async (s) => {
    const h = req.body as Holding;
    const existing = s.holdings.findIndex(
      (x) => x.symbol.toUpperCase() === h.symbol.toUpperCase(),
    );
    if (existing >= 0) {
      res.status(409).json({ ok: false, reason: 'symbol_exists' });
      return;
    }
    s.holdings = [...s.holdings, h];
    await store.write(userId, s);
    res.status(201).json(h);
  });
});

portfolio.put('/holdings/:symbol', (req: Request, res: Response): void => {
  const symbol = String(req.params.symbol).toUpperCase();
  const body = (req.body ?? {}) as Partial<Holding>;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ ok: false, reason: 'invalid_patch' });
    return;
  }
  const store  = storeFor(req);
  const userId = req.user?.id ?? null;
  void store.read(userId).then(async (s) => {
    const idx = s.holdings.findIndex((h) => h.symbol.toUpperCase() === symbol);
    if (idx < 0) {
      // Upsert: if symbol field is present in body, treat as create.
      if (validHolding(body)) {
        s.holdings = [...s.holdings, body as Holding];
        await store.write(userId, s);
        res.status(201).json(body);
        return;
      }
      res.status(404).json({ ok: false, reason: 'not_found' });
      return;
    }
    s.holdings[idx] = { ...s.holdings[idx], ...body, symbol: s.holdings[idx].symbol };
    await store.write(userId, s);
    res.json(s.holdings[idx]);
  });
});

portfolio.delete('/holdings/:symbol', (req: Request, res: Response): void => {
  const symbol = String(req.params.symbol).toUpperCase();
  const store  = storeFor(req);
  const userId = req.user?.id ?? null;
  void store.read(userId).then(async (s) => {
    const before = s.holdings.length;
    s.holdings = s.holdings.filter((h) => h.symbol.toUpperCase() !== symbol);
    if (s.holdings.length === before) {
      res.status(404).json({ ok: false, reason: 'not_found' });
      return;
    }
    await store.write(userId, s);
    res.status(204).end();
  });
});

// Summary ---------------------------------------------------------------------

portfolio.patch('/summary', (req: Request, res: Response): void => {
  const body = (req.body ?? {}) as Partial<PortfolioSummary>;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ ok: false, reason: 'invalid_patch' });
    return;
  }
  const store  = storeFor(req);
  const userId = req.user?.id ?? null;
  void store.read(userId).then(async (s) => {
    s.summary = { ...s.summary, ...body };
    await store.write(userId, s);
    res.json(s.summary);
  });
});

// Watchlist KR ----------------------------------------------------------------

portfolio.post('/watchlist/KR', (req: Request, res: Response): void => {
  if (!validWatchlistEntry(req.body)) {
    res.status(400).json({ ok: false, reason: 'invalid_watchlist_entry' });
    return;
  }
  const store  = storeFor(req);
  const userId = req.user?.id ?? null;
  void store.read(userId).then(async (s) => {
    const entry = req.body as WatchlistEntry;
    if (s.watchlist.KR.some((w) => w.code === entry.code)) {
      res.status(409).json({ ok: false, reason: 'code_exists' });
      return;
    }
    s.watchlist.KR = [...s.watchlist.KR, entry];
    await store.write(userId, s);
    res.status(201).json(entry);
  });
});

portfolio.delete('/watchlist/KR/:code', (req: Request, res: Response): void => {
  const code = String(req.params.code);
  const store  = storeFor(req);
  const userId = req.user?.id ?? null;
  void store.read(userId).then(async (s) => {
    const before = s.watchlist.KR.length;
    s.watchlist.KR = s.watchlist.KR.filter((w) => w.code !== code);
    if (s.watchlist.KR.length === before) {
      res.status(404).json({ ok: false, reason: 'not_found' });
      return;
    }
    await store.write(userId, s);
    res.status(204).end();
  });
});
