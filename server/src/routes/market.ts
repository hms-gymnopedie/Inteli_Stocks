import { Router, type Request, type Response } from 'express';
import {
  INDEX_SYMBOLS,
  SECTOR_ETFS,
  SECTOR_ETF_NAMES,
  MACRO_SYMBOLS,
  fetchQuotes,
  fetchHistorical,
  fetchSearch,
  formatNum,
  formatPct,
  dir,
} from '../providers/yahoo.js';
import * as finnhub from '../providers/finnhub.js';
import * as grounded from '../providers/gemini-grounded.js';
import { fetchCNNFearGreed } from '../providers/cnnFearGreed.js';

/**
 * /api/market/* — owned by B2-MD.
 */
export const market = Router();

// ─── Types (mirrors app/src/data/types.ts) ────────────────────────────────────
// We don't import from the app; we duplicate the minimal shape needed server-side.

interface Index {
  ticker: string;
  label: string;
  price: string;
  change: string;
  direction: 1 | -1;
}

interface OHLC {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SectorReturn {
  name: string;
  v: number;
}

// ─── Hardcoded mock data (B2-MD2 fallbacks) ───────────────────────────────────

/**
 * Minimal mock indices — shown when Yahoo is rate-limited and no last-good cache.
 * Prices are seed values from app/src/data/market.ts TICKER_STRIP.
 */
const MOCK_INDICES: Index[] = [
  { ticker: 'SPX',    label: 'S&P 500',  price: '5,248.49',  change: '—',   direction:  1 },
  { ticker: 'COMP',   label: 'NASDAQ',   price: '16,384.47', change: '—',   direction:  1 },
  { ticker: 'INDU',   label: 'DOW',      price: '39,127.14', change: '—',   direction:  1 },
  { ticker: '^KS11',  label: 'KOSPI',    price: '2,692.06',  change: '—',   direction:  1 },
  { ticker: '^VIX',   label: 'VIX',      price: '13.67',     change: '—',   direction: -1 },
  { ticker: 'DXY',    label: 'DXY',      price: '104.32',    change: '—',   direction: -1 },
  { ticker: '^TNX',   label: '10Y UST',  price: '4.348%',    change: '—',   direction: -1 },
  { ticker: 'BTC',    label: 'BTC',      price: '70,287.20', change: '—',   direction:  1 },
];

/**
 * Minimal mock sectors — 11 SPDR ETFs with zero day-change.
 */
const MOCK_SECTORS: SectorReturn[] = [
  { name: 'Technology',        v: 0 },
  { name: 'Energy',            v: 0 },
  { name: 'Financials',        v: 0 },
  { name: 'Health Care',       v: 0 },
  { name: 'Consumer Discr.',   v: 0 },
  { name: 'Industrials',       v: 0 },
  { name: 'Consumer Staples',  v: 0 },
  { name: 'Materials',         v: 0 },
  { name: 'Utilities',         v: 0 },
  { name: 'Real Estate',       v: 0 },
  { name: 'Communication',     v: 0 },
];

/**
 * Minimal mock macro indicators.
 */
// Realistic seed values so the dashboard never shows em-dashes during the
// brief window before yahoo first responds (B8-MACRO-FX).
const MOCK_MACRO = [
  { key: 'US10Y',   label: 'US 10Y',    value: '4.350',  delta: '+0.0bp',  seed: 11, trend:  0.1 },
  { key: 'CPI_YOY', label: 'CPI YoY',   value: '3.20%',  delta: '−0.10',   seed: 12, trend: -0.3 },
  { key: 'USD_KRW', label: 'USD/KRW',   value: '1,400',  delta: '+0.00%',  seed: 13, trend:  0.4 },
  { key: 'WTI',     label: 'WTI Crude', value: '$78.40', delta: '+0.00%',  seed: 14, trend: -0.2 },
];

// ─── GET /api/market/indices ──────────────────────────────────────────────────

/**
 * Returns the 8-entry ticker strip.
 * Yahoo symbols: ^GSPC ^IXIC ^DJI ^KS11 ^VIX DX-Y.NYB ^TNX BTC-USD
 * B2-MD2: on error returns MOCK_INDICES (200, not 500).
 */
market.get('/indices', async (_req: Request, res: Response) => {
  try {
    const yahooSymbols = Object.values(INDEX_SYMBOLS);
    const quotes = await fetchQuotes(yahooSymbols);

    // Map of yahoo symbol → quote for easy lookup
    const qMap = new Map(quotes.map((q) => [q.symbol, q]));

    const displayOrder: Array<{ ticker: string; label: string; yahooSym: string }> = [
      { ticker: 'SPX',    label: 'S&P 500',  yahooSym: '^GSPC'     },
      { ticker: 'COMP',   label: 'NASDAQ',   yahooSym: '^IXIC'     },
      { ticker: 'INDU',   label: 'DOW',      yahooSym: '^DJI'      },
      { ticker: '^KS11',  label: 'KOSPI',    yahooSym: '^KS11'     },
      { ticker: '^VIX',   label: 'VIX',      yahooSym: '^VIX'      },
      { ticker: 'DXY',    label: 'DXY',      yahooSym: 'DX-Y.NYB'  },
      { ticker: '^TNX',   label: '10Y UST',  yahooSym: '^TNX'      },
      { ticker: 'BTC',    label: 'BTC',      yahooSym: 'BTC-USD'   },
    ];

    const result: Index[] = displayOrder.map(({ ticker, label, yahooSym }) => {
      const q = qMap.get(yahooSym);
      const price = q?.regularMarketPrice ?? null;
      const pctChange = q?.regularMarketChangePercent ?? null;

      // Special formatting for TNX (yield displayed as %)
      let priceStr: string;
      if (yahooSym === '^TNX') {
        priceStr = price != null ? `${price.toFixed(3)}%` : '—';
      } else {
        priceStr = price != null ? formatNum(price, price < 10 ? 4 : 2) : '—';
      }

      return {
        ticker,
        label,
        price: priceStr,
        change: formatPct(pctChange != null ? pctChange / 100 : null),
        direction: dir(pctChange),
      };
    });

    res.json(result);
  } catch (err) {
    console.error('[B2-MD2] /indices fallback triggered:', (err as Error).message);
    res.json(MOCK_INDICES);
  }
});

// ─── GET /api/market/intraday?symbol=SPX&range=1D ─────────────────────────────

/**
 * Returns OHLC bars for a symbol and range.
 * Accepts Yahoo symbols directly (e.g. ^GSPC) or our display tickers.
 * Falls back to mock bars on error.
 */
market.get('/intraday', async (req: Request, res: Response) => {
  const rawSymbol = String(req.query.symbol ?? 'SPX');
  const range = String(req.query.range ?? '1Y') as
    | '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y' | 'MAX';

  // Resolve display ticker → yahoo symbol if needed
  const yahooSymbol = INDEX_SYMBOLS[rawSymbol] ?? rawSymbol;

  try {
    const rows = await fetchHistorical(yahooSymbol, range);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bars: OHLC[] = (rows as any[])
      .filter((r) => r.open != null)
      .map((r) => ({
        ts:     (r.date as Date).getTime(),
        open:   r.open as number,
        high:   r.high as number,
        low:    r.low as number,
        close:  r.close as number,
        volume: (r.volume as number | undefined) ?? 0,
      }));
    res.json(bars);
  } catch (err) {
    console.error('[B2-MD2] /intraday fallback triggered:', yahooSymbol, (err as Error).message);
    // Return synthetic bars as fallback so the UI doesn't break
    res.json(generateMockBars(rawSymbol, range));
  }
});

// ─── GET /api/market/sectors?range=1D ─────────────────────────────────────────

/**
 * Returns sector returns derived from 11 SPDR ETF day-change %.
 * B2-MD2: on error returns MOCK_SECTORS (200, not 500).
 */
market.get('/sectors', async (_req: Request, res: Response) => {
  try {
    const quotes = await fetchQuotes(SECTOR_ETFS);
    const qMap = new Map(quotes.map((q) => [q.symbol, q]));

    const result: SectorReturn[] = SECTOR_ETFS.map((etf) => {
      const q = qMap.get(etf);
      const pctChange = q?.regularMarketChangePercent ?? 0;
      return {
        name: SECTOR_ETF_NAMES[etf] ?? etf,
        v:    Math.round(pctChange * 100) / 100, // 2 decimal places
      };
    });

    res.json(result);
  } catch (err) {
    console.error('[B2-MD2] /sectors fallback triggered:', (err as Error).message);
    res.json(MOCK_SECTORS);
  }
});

// ─── GET /api/market/macro?keys=US10Y,CPI_YOY,USD_KRW,WTI ────────────────────

/**
 * Macro indicators. Yahoo handles US10Y, USD_KRW, WTI.
 * CPI_YOY is delegated to providers/fred.ts via dynamic import with fallback.
 * B2-MD2: on error returns MOCK_MACRO (200, not 500).
 */
market.get('/macro', async (req: Request, res: Response) => {
  const keyParam = String(req.query.keys ?? 'US10Y,CPI_YOY,USD_KRW,WTI');
  const keys = keyParam.split(',').map((k) => k.trim()).filter(Boolean) as
    ('US10Y' | 'CPI_YOY' | 'USD_KRW' | 'WTI')[];

  const activeKeys = keys.length > 0 ? keys : (['US10Y', 'CPI_YOY', 'USD_KRW', 'WTI'] as const);

  try {
    // Fetch Yahoo-backed indicators in parallel
    const yahooKeys = (['US10Y', 'USD_KRW', 'WTI'] as const).filter((k) => activeKeys.includes(k));
    const yahooSymbols = yahooKeys.map((k) => MACRO_SYMBOLS[k]);

    const [quotes, cpiData] = await Promise.all([
      yahooSymbols.length > 0 ? fetchQuotes(yahooSymbols) : Promise.resolve([]),
      // CPI — try FRED provider; fall back to mock
      activeKeys.includes('CPI_YOY')
        ? import('../providers/fred.js')
            .then((m) => (m as { getCPI?: () => Promise<unknown> }).getCPI?.())
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    const qMap = new Map(quotes.map((q) => [q.symbol, q]));

    interface MacroIndicator {
      key: string; label: string; value: string;
      delta: string; seed: number; trend: number;
    }

    const results: MacroIndicator[] = [];

    for (const key of activeKeys) {
      if (key === 'CPI_YOY') {
        if (cpiData && typeof cpiData === 'object' && 'value' in cpiData) {
          results.push(cpiData as MacroIndicator);
        } else {
          // Hardcoded CPI fallback as specified
          results.push({ key: 'CPI_YOY', label: 'CPI YoY', value: '3.20%', delta: '−0.10', seed: 12, trend: -0.3 });
        }
        continue;
      }

      const yahooSym = MACRO_SYMBOLS[key];
      const q = qMap.get(yahooSym);
      const price = q?.regularMarketPrice ?? null;
      const change = q?.regularMarketChange ?? null;
      const pctChange = q?.regularMarketChangePercent ?? null;

      let label: string = key;
      let valueStr = '—';
      let deltaStr = '—';
      let trend = 0;
      let seed = 11;

      if (key === 'US10Y') {
        label = 'US 10Y';
        valueStr = price != null ? price.toFixed(3) : '—';
        // Express change in bp (1 bp = 0.01%)
        deltaStr = change != null ? `${change >= 0 ? '+' : ''}${(change * 100).toFixed(1)}bp` : '—';
        trend = pctChange != null ? (pctChange > 0 ? 0.5 : -0.5) : 0;
        seed = 11;
      } else if (key === 'USD_KRW') {
        label = 'USD/KRW' as string;
        valueStr = price != null ? price.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '—';
        deltaStr = pctChange != null ? `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%` : '—';
        trend = pctChange != null ? (pctChange > 0 ? 0.4 : -0.4) : 0;
        seed = 13;
      } else if (key === 'WTI') {
        label = 'WTI Crude' as string;
        valueStr = price != null ? `$${price.toFixed(2)}` : '—';
        deltaStr = pctChange != null ? `${pctChange >= 0 ? '' : '−'}${Math.abs(pctChange).toFixed(2)}%` : '—';
        trend = pctChange != null ? (pctChange > 0 ? -0.5 : 0.5) : 0;
        seed = 14;
      }

      results.push({ key, label, value: valueStr, delta: deltaStr, seed, trend });
    }

    res.json(results);
  } catch (err) {
    console.error('[B2-MD2] /macro fallback triggered:', (err as Error).message);
    // Return only the keys that were requested
    const fallback = MOCK_MACRO.filter((m) => (activeKeys as readonly string[]).includes(m.key));
    res.json(fallback.length > 0 ? fallback : MOCK_MACRO);
  }
});

// ─── GET /api/market/sp-constituents ─────────────────────────────────────────

/**
 * Returns 24 static S&P 500 constituents (mock values — scraping not in Phase 2 scope).
 */
market.get('/sp-constituents', (_req: Request, res: Response) => {
  res.json([
    { t: 'AAPL',  v:  1.4 },
    { t: 'MSFT',  v:  0.8 },
    { t: 'NVDA',  v:  3.2 },
    { t: 'GOOG',  v: -0.4 },
    { t: 'AMZN',  v:  0.9 },
    { t: 'META',  v:  1.1 },
    { t: 'JPM',   v:  0.3 },
    { t: 'BAC',   v: -0.6 },
    { t: 'V',     v:  0.2 },
    { t: 'XOM',   v: -1.2 },
    { t: 'CVX',   v: -0.9 },
    { t: 'PFE',   v:  1.6 },
    { t: 'TSLA',  v: -2.3 },
    { t: 'UNH',   v:  0.4 },
    { t: 'HD',    v: -0.2 },
    { t: 'COST',  v:  0.7 },
    { t: 'WMT',   v:  0.1 },
    { t: 'KO',    v: -0.3 },
    { t: 'NKE',   v:  1.9 },
    { t: 'BA',    v: -3.6 },
    { t: 'DIS',   v:  0.5 },
    { t: 'NFLX',  v:  2.4 },
    { t: 'CRM',   v:  1.0 },
    { t: 'ORCL',  v: -0.7 },
  ]);
});

// ─── GET /api/market/fear-greed ───────────────────────────────────────────────

/**
 * Fear & Greed Index. Three-tier source ladder:
 *
 *   1. CNN's unofficial JSON endpoint (production.dataviz.cnn.io) —
 *      authoritative, includes ~3y of daily history. Browser-like headers
 *      required to bypass UA gating.
 *   2. Gemini grounded search — fallback for headline values when CNN
 *      blocks us (rate-limit / cloudflare / VPN).
 *   3. Synthetic ramp — fallback for the daily array when neither above
 *      delivers it.
 *
 * Cached 6h via the providers' own TTL caches; this handler stitches results.
 */
market.get('/fear-greed', async (_req: Request, res: Response) => {
  // Synthetic daily ramp for the fallback so the chart isn't flat.
  const fallbackDaily = (() => {
    const out: { date: string; value: number }[] = [];
    const today = new Date();
    const seed = [41, 39, 42, 45, 47, 44, 46, 48, 50, 52, 49, 51, 53, 55, 54,
                  56, 53, 55, 58, 56, 59, 57, 60, 58, 61, 59, 60, 58, 60, 62];
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - (29 - i));
      out.push({ date: d.toISOString().slice(0, 10), value: seed[i] });
    }
    return out;
  })();

  const FALLBACK = {
    value:     62,
    label:     'Greed',
    yesterday: 58,
    oneWeek:   49,
    oneMonth:  41,
    daily:     fallbackDaily,
  };

  // 1. CNN direct — primary source.
  try {
    const cnn = await fetchCNNFearGreed();
    if (Number.isFinite(cnn.value) && cnn.daily.length > 0) {
      res.json(cnn);
      return;
    }
  } catch (err) {
    console.warn('[market/fear-greed] CNN direct failed:', (err as Error).message);
  }

  // 2. Gemini grounded — fallback for headline.
  const today = new Date().toISOString().slice(0, 10);
  const result = await grounded.askJSON<{
    value: number; label: string; yesterday: number; oneWeek: number; oneMonth: number;
    daily?: { date: string; value: number }[];
  }>({
    cacheKey:   `fear-greed:${today}`,
    cacheTtlMs: 6 * 60 * 60 * 1000, // 6h — F&G updates daily
    maxOutputTokens: 2048,
    prompt: `Look up the CURRENT CNN Fear & Greed Index (money.cnn.com/data/fear-and-greed/ or equivalent).
Return a single JSON object with these exact fields, no markdown fences:
{
  "value":     <integer 0-100, current score>,
  "label":     <one of: "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed">,
  "yesterday": <integer 0-100, score 1 day ago>,
  "oneWeek":   <integer 0-100, score 1 week ago>,
  "oneMonth":  <integer 0-100, score 1 month ago>,
  "daily": [
    { "date": "YYYY-MM-DD", "value": <integer 0-100> },
    ...                      // last 30 trading days, oldest first → newest last
  ]
}
"daily" must contain ~30 entries spanning the past month, with the most
recent entry's value matching "value". Output ONLY the JSON object.`,
  });

  if (result && Number.isFinite(result.value)) {
    // Backfill daily if Gemini didn't include it.
    const out = {
      ...result,
      daily: Array.isArray(result.daily) && result.daily.length > 0
        ? result.daily
        : fallbackDaily,
    };
    res.json(out);
  } else {
    res.json(FALLBACK);
  }
});

// ─── GET /api/market/vix ──────────────────────────────────────────────────────

/**
 * VIX index — headline + 30-day daily history.
 * Headline: yahoo /^VIX quote (regularMarketPrice + change%).
 * Daily:    yahoo historical 1M, last 30 daily closes.
 *
 * Response:
 *   { value, change, changePct, daily: [{date, value}, ...] }
 *
 * Cached via the yahoo wrapper's TTL (5min quote / 10min hist).
 */
market.get('/vix', async (_req: Request, res: Response) => {
  try {
    const [quotes, hist] = await Promise.all([
      fetchQuotes(['^VIX']).catch(() => [] as Awaited<ReturnType<typeof fetchQuotes>>),
      fetchHistorical('^VIX', '1M').catch(() => [] as Awaited<ReturnType<typeof fetchHistorical>>),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q: any = quotes[0];
    const value      = q && typeof q.regularMarketPrice === 'number'         ? q.regularMarketPrice         : null;
    const change     = q && typeof q.regularMarketChange === 'number'        ? q.regularMarketChange        : null;
    const changePct  = q && typeof q.regularMarketChangePercent === 'number' ? q.regularMarketChangePercent : null;

    interface HistRow { date: Date | string; close: number }
    const daily = (hist as HistRow[]).slice(-30).map((r) => ({
      date:  (r.date instanceof Date ? r.date : new Date(r.date)).toISOString().slice(0, 10),
      value: typeof r.close === 'number' ? Math.round(r.close * 100) / 100 : 0,
    })).filter((p) => p.value > 0);

    if (value == null && daily.length === 0) {
      // yahoo down — synthetic fallback so the chart still renders.
      const today = new Date();
      const fallback = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(today); d.setDate(d.getDate() - (29 - i));
        return { date: d.toISOString().slice(0, 10), value: 18 + Math.sin(i / 4) * 4 };
      });
      res.json({ value: 18.5, change: 0, changePct: 0, daily: fallback });
      return;
    }
    res.json({
      value:     value ?? (daily.at(-1)?.value ?? 18),
      change:    change ?? 0,
      changePct: changePct ?? 0,
      daily,
    });
  } catch (err) {
    console.error('[market/vix]', err);
    res.json({ value: 18.5, change: 0, changePct: 0, daily: [] });
  }
});

// ─── GET /api/market/calendar?date=2024-04-28 ─────────────────────────────────

/**
 * Economic calendar events. Uses Finnhub /calendar/economic when
 * FINNHUB_API_KEY is set (B13-E2); otherwise falls back to a static
 * mock so the panel never goes blank.
 */
market.get('/calendar', async (_req: Request, res: Response) => {
  if (!finnhub.isConfigured()) {
    res.json(MOCK_CALENDAR);
    return;
  }
  try {
    const events = await finnhub.getEconomicCalendar();
    // Map Finnhub shape → frontend CalendarEvent ({time, title, impact}).
    const out = events
      .filter((e) => e.country === 'US' || e.country === 'KR' || e.country === 'CN' || e.country === 'EU')
      .slice(0, 8)
      .map((e) => ({
        // Finnhub's `time` is the ISO datetime — show 'HH:MM' when it has
        // one, else fall back to the date.
        time: extractHHMM(e.time),
        title: `${e.country} · ${e.event}`,
        impact: (e.impact >= 3 ? 'HIGH' : e.impact === 2 ? 'MED' : 'LOW') as 'HIGH' | 'MED' | 'LOW',
      }));
    res.json(out.length > 0 ? out : MOCK_CALENDAR);
  } catch (err) {
    console.error('[market/calendar] finnhub failed, falling back to mock:', (err as Error).message);
    res.json(MOCK_CALENDAR);
  }
});

const MOCK_CALENDAR = [
  { time: '08:30', title: 'US · Initial Jobless Claims', impact: 'HIGH' },
  { time: '10:00', title: 'US · Fed Powell — Press Q&A', impact: 'HIGH' },
  { time: '14:30', title: 'KR · BoK Minutes',            impact: 'MED'  },
  { time: '—',     title: 'NVDA · Earnings AMC',         impact: 'HIGH' },
];

function extractHHMM(iso: string): string {
  // Finnhub format: '2026-05-02 08:30:00' or just '2026-05-02'.
  const m = /(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}` : '—';
}

// ─── GET /api/market/session-volume ──────────────────────────────────────────

/**
 * Real session volume derived from yahoo intraday bars (B13-E4). Aggregates
 * the volume field from S&P 500 daily/intraday data — falls back to a
 * synthetic profile when the historical fetch fails.
 */
market.get('/session-volume', async (_req: Request, res: Response) => {
  try {
    const rows = await fetchHistorical('^GSPC', '1M');
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('no rows');
    // Take the last 30 bars and emit { ts, volume } pairs. Real series.
    const recent = rows.slice(-30);
    const bars = recent.map((r) => ({
      ts: (r.date instanceof Date ? r.date : new Date(r.date as unknown as string)).getTime(),
      volume: typeof r.volume === 'number' ? r.volume : 0,
    }));
    res.json(bars);
  } catch (err) {
    console.error('[market/session-volume] fallback to mock:', (err as Error).message);
    const bars: Array<{ ts: number; volume: number }> = [];
    const now = Date.now();
    for (let i = 0; i < 30; i++) {
      const rand = ((9 * (i + 1) * 9301 + 49297) % 233280) / 233280;
      bars.push({ ts: now - (30 - i) * 13 * 60_000, volume: 60_000_000 + rand * 80_000_000 });
    }
    res.json(bars);
  }
});

// ─── GET /api/market/search?q=nvidia ──────────────────────────────────────────

/**
 * Searches Yahoo Finance for matching symbols.
 * B2-MD2: on error returns [] (200, not 500).
 */
market.get('/search', async (req: Request, res: Response) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) {
    res.json([]);
    return;
  }
  try {
    const data = await fetchSearch(q);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = ((data as any).quotes ?? [])
      .slice(0, 10)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => ({
        symbol:   item.symbol ?? '',
        name:     item.shortname ?? item.longname ?? item.symbol ?? '',
        exchange: item.exchange ?? item.exchDisp ?? '',
      }));
    res.json(results);
  } catch (err) {
    console.error('[B2-MD2] /search fallback triggered:', q, (err as Error).message);
    res.json([]);
  }
});

// ─── Mock bar generator (fallback for intraday) ───────────────────────────────

function generateMockBars(symbol: string, _range: string): OHLC[] {
  const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const bars: OHLC[] = [];
  let price = 5200 + (seed % 400);
  const now = Date.now();
  for (let i = 0; i < 62; i++) {
    const rand = ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280;
    const move = (rand - 0.5) * 30;
    const open  = price;
    const close = price + move;
    const high  = Math.max(open, close) + Math.abs(move) * 0.3;
    const low   = Math.min(open, close) - Math.abs(move) * 0.3;
    bars.push({ ts: now - (62 - i) * 5 * 60_000, open, high, low, close, volume: 40_000_000 + rand * 20_000_000 });
    price = close;
  }
  return bars;
}
