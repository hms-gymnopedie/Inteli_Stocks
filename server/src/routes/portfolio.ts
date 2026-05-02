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
  PortfolioSummary,
  Trade,
  WatchlistEntry,
} from '../storage/types.js';

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
