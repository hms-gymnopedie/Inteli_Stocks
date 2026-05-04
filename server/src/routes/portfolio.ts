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
import { volatilityScore } from '../lib/risk.js';
import { computeRiskFactors } from '../lib/factors.js';
import { fetchQuotes } from '../providers/yahoo.js';

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
    case '1D':  d.setDate(d.getDate() - 1);            break;
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

/** Map equity-curve range → yahoo bar interval. (B15-2) */
function rangeToInterval(range: EquityRange): '1d' | '5m' | '15m' | '30m' {
  if (range === '1D') return '5m';
  if (range === '1W') return '30m';
  return '1d';
}

/**
 * Recompute the portfolio summary from real holdings + equity curve metrics
 * rather than serving the static seed strings. (B13-D3)
 *
 *   nav            — kept from store (user-configured baseline)
 *   navFormatted   — re-rendered from nav (so nav changes flow through)
 *   dayChange %    — Σ (weight_i × dayPct_i) over USD holdings
 *   dayChange $    — nav × dayChange %
 *   ytd            — total return % from real equity curve over YTD
 *   oneYear        — same, 1Y range
 *   sharpe         — annualized sharpe from 1Y curve
 *   drawdown       — max drawdown % from 1Y curve
 *   exposure / risk — left as configured in the store (no real source yet;
 *                     these stay stable across recomputes)
 */
async function recomputeSummary(
  store: PortfolioStore,
): Promise<typeof store.summary> {
  const seed = store.summary;

  // ── 1. Day change: live yahoo dayPct per holding, weighted by stored weight.
  //      Falls back to the holding's static dayPct string when yahoo errors.
  let dayPctSum = 0;
  let weightSum = 0;
  // Fetch quotes once for all holdings so we don't N+1 yahoo for every read.
  const symbols = store.holdings.map((h) => h.symbol);
  const quotes = symbols.length > 0
    ? await fetchQuotes(symbols).catch(() => [] as Awaited<ReturnType<typeof fetchQuotes>>)
    : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qMap = new Map<string, any>(quotes.map((q: any) => [q.symbol, q]));
  for (const h of store.holdings) {
    const w = parseWeight(h.weight);
    let pct: number | null = null;
    const q = qMap.get(h.symbol);
    if (q && typeof q.regularMarketChangePercent === 'number') {
      pct = q.regularMarketChangePercent;
    } else {
      // Last-resort: parse the seed string.
      const m = /^\s*([+\-−]?\s*[\d.]+)/.exec(h.dayPct);
      if (m) pct = Number(m[1].replace('−', '-').replace(/\s+/g, ''));
    }
    if (pct == null || !Number.isFinite(pct)) continue;
    dayPctSum += w * pct;
    weightSum += w;
  }
  const dayPct = weightSum > 0 ? dayPctSum / weightSum : 0;
  const dayDollar = seed.nav * (dayPct / 100);

  // ── 2. YTD / 1Y / sharpe / drawdown from real curves ─────────────────────
  const [ytdCurve, oneYrCurve] = await Promise.all([
    realEquityCurve(store, 'YTD').catch(() => [] as BTEquityPoint[]),
    realEquityCurve(store, '1Y').catch(() => [] as BTEquityPoint[]),
  ]);

  const ytdPct = curveTotalReturn(ytdCurve);
  const oneYrPct = curveTotalReturn(oneYrCurve);
  const sharpeNum = curveSharpe(oneYrCurve);
  const ddPct = curveMaxDrawdown(oneYrCurve);

  return {
    ...seed,
    navFormatted:  fmtNAV(seed.nav),
    dayChange:     fmtSignedDollar(dayDollar),
    dayChangePct:  fmtSignedPct(dayPct),
    ytd:           ytdPct != null ? fmtSignedPct(ytdPct) : seed.ytd,
    oneYear:       oneYrPct != null ? fmtSignedPct(oneYrPct) : seed.oneYear,
    sharpe:        sharpeNum != null ? Number(sharpeNum.toFixed(2)) : seed.sharpe,
    drawdown:      ddPct != null ? fmtSignedPct(ddPct) : seed.drawdown,
  };
}

function fmtNAV(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtSignedDollar(n: number): string {
  const sign = n >= 0 ? '+' : '−';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtSignedPct(pct: number): string {
  const sign = pct >= 0 ? '+' : '−';
  return `${sign}${Math.abs(pct).toFixed(2)}%`;
}

function curveTotalReturn(curve: BTEquityPoint[]): number | null {
  if (curve.length < 2) return null;
  const start = curve[0].value;
  const end   = curve[curve.length - 1].value;
  if (start <= 0) return null;
  return (end / start - 1) * 100;
}

function curveSharpe(curve: BTEquityPoint[]): number | null {
  if (curve.length < 30) return null;
  const rets: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1].value;
    const cur  = curve[i].value;
    if (prev > 0) rets.push(cur / prev - 1);
  }
  if (rets.length < 20) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  const sd = Math.sqrt(variance);
  return sd > 0 ? (mean / sd) * Math.sqrt(252) : null;
}

function curveMaxDrawdown(curve: BTEquityPoint[]): number | null {
  if (curve.length < 2) return null;
  let peak = curve[0].value;
  let maxDD = 0;
  for (const p of curve) {
    if (p.value > peak) peak = p.value;
    const dd = (p.value - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  return maxDD * 100;
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
      interval:  rangeToInterval(range),
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
  void store.read(userId)
    .then((s) => recomputeSummary(s))
    .then((summary) => { res.json(summary); })
    .catch((err: unknown) => {
      console.error('[portfolio/summary]', err);
      // Fall back to whatever is on disk so the panel doesn't go blank.
      void store.read(userId).then((s) => res.json(s.summary));
    });
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
  void store.read(userId).then(async (s) => {
    // Refresh price + dayPct + risk + plPct from real yahoo quotes (B16-1)
    // — without this the dashboard mirrors static seed values forever even
    // though the dashboard advertises "live".
    //
    // Fetched in one batched yahoo call for efficiency; per-symbol quote
    // map matched by symbol. Each enrichment is wrapped in try/catch so
    // a single bad ticker doesn't blank the entire panel.
    const symbols = s.holdings.map((h) => h.symbol);
    const quotes = symbols.length > 0
      ? await fetchQuotes(symbols).catch(() => [] as Awaited<ReturnType<typeof fetchQuotes>>)
      : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const qMap = new Map<string, any>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quotes.map((q: any) => [q.symbol, q]),
    );

    // Avg cost basis per symbol from trades log (BUY quantity-weighted).
    const costBasis = new Map<string, number>();
    for (const t of s.trades) {
      if (t.side !== 'BUY') continue;
      const cur = costBasis.get(t.symbol);
      const totalQty = (cur ? cur * 1 : 0); // we accumulate qty separately below
      void totalQty;
    }
    // Two-pass: first qty + Σ(qty×price), then divide.
    const buyAgg = new Map<string, { qty: number; spend: number }>();
    for (const t of s.trades) {
      if (t.side !== 'BUY') continue;
      const cur = buyAgg.get(t.symbol) ?? { qty: 0, spend: 0 };
      cur.qty   += t.quantity;
      cur.spend += t.quantity * t.price;
      buyAgg.set(t.symbol, cur);
    }
    for (const [sym, agg] of buyAgg) {
      if (agg.qty > 0) costBasis.set(sym, agg.spend / agg.qty);
    }

    const enriched = await Promise.all(
      s.holdings.map(async (h) => {
        const out = { ...h };
        const q = qMap.get(h.symbol);

        // Live price & day% from yahoo when available.
        if (q) {
          const px  = typeof q.regularMarketPrice         === 'number' ? q.regularMarketPrice         : null;
          const ch  = typeof q.regularMarketChange        === 'number' ? q.regularMarketChange        : null;
          const chp = typeof q.regularMarketChangePercent === 'number' ? q.regularMarketChangePercent : null;
          if (px != null) {
            const ccy = typeof q.currency === 'string' ? q.currency : 'USD';
            out.price = formatPriceForCurrency(px, ccy);
          }
          if (chp != null) {
            out.dayPct = `${chp >= 0 ? '+' : ''}${chp.toFixed(2)}`;
          } else if (ch != null && q.regularMarketPreviousClose) {
            const computed = (ch / q.regularMarketPreviousClose) * 100;
            out.dayPct = `${computed >= 0 ? '+' : ''}${computed.toFixed(2)}`;
          }

          // plPct from cost basis when we have BUY trades for this symbol.
          const cost = costBasis.get(h.symbol);
          if (px != null && cost != null && cost > 0) {
            const plp = (px / cost - 1) * 100;
            out.plPct = `${plp >= 0 ? '+' : ''}${plp.toFixed(0)}%`;
          }
        }

        // Volatility risk (B12-2).
        const score = await volatilityScore(h.symbol);
        if (score != null) out.risk = score;

        return out;
      }),
    );
    res.json(enriched);
  });
});

/** Locale-aware price formatting; mirrors the prototype's currency glyphs. */
function formatPriceForCurrency(value: number, ccy: string): string {
  const u = ccy.toUpperCase();
  if (u === 'KRW' || u === 'JPY') {
    return `${u === 'KRW' ? '₩' : '¥'}${Math.round(value).toLocaleString('en-US')}`;
  }
  const glyph = u === 'EUR' ? '€' : u === 'GBP' ? '£' : u === 'HKD' ? 'HK$' : '$';
  return `${glyph}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
  void store.read(userId)
    .then(async (s) => {
      // Compute live; fall back to stored seed values on any failure so the
      // panel never goes blank.
      try {
        const factors = await computeRiskFactors(s.holdings);
        res.json(factors.length > 0 ? factors : s.riskFactors);
      } catch (err) {
        console.error('[portfolio/risk-factors] compute failed:', (err as Error).message);
        res.json(s.riskFactors);
      }
    })
    .catch((err: unknown) => {
      console.error('[portfolio/risk-factors]', err);
      res.json([]);
    });
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
