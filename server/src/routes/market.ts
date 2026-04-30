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
const MOCK_MACRO = [
  { key: 'US10Y',   label: 'US 10Y',   value: '—', delta: '—', seed: 11, trend:  0 },
  { key: 'CPI_YOY', label: 'CPI YoY',  value: '—', delta: '—', seed: 12, trend:  0 },
  { key: 'USD_KRW', label: 'USD/KRW',  value: '—', delta: '—', seed: 13, trend:  0 },
  { key: 'WTI',     label: 'WTI Crude',value: '—', delta: '—', seed: 14, trend:  0 },
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
 * Returns Fear & Greed mock values — CNN has no public API.
 */
market.get('/fear-greed', (_req: Request, res: Response) => {
  res.json({
    value:     62,
    label:     'Greed',
    yesterday: 58,
    oneWeek:   49,
    oneMonth:  41,
  });
});

// ─── GET /api/market/calendar?date=2024-04-28 ─────────────────────────────────

/**
 * Returns mock economic calendar events — free APIs require keys.
 */
market.get('/calendar', (_req: Request, res: Response) => {
  res.json([
    { time: '08:30', title: 'US Initial Jobless Claims', impact: 'HIGH' },
    { time: '10:00', title: 'Fed Powell · Press Q&A',    impact: 'HIGH' },
    { time: '14:30', title: 'BoK Minutes (KR)',           impact: 'MED'  },
    { time: '—',     title: 'NVDA · Earnings AMC',        impact: 'HIGH' },
  ]);
});

// ─── GET /api/market/session-volume ──────────────────────────────────────────

/**
 * Returns synthetic session volume bars.
 */
market.get('/session-volume', (_req: Request, res: Response) => {
  const bars: Array<{ ts: number; volume: number }> = [];
  const now = Date.now();
  for (let i = 0; i < 30; i++) {
    const rand = ((9 * (i + 1) * 9301 + 49297) % 233280) / 233280;
    bars.push({ ts: now - (30 - i) * 13 * 60_000, volume: 60_000_000 + rand * 80_000_000 });
  }
  res.json(bars);
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
