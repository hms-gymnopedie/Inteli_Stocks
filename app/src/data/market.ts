// Market data mock fetchers.
// All functions return a Promise that resolves after a small simulated delay.
// Data lifted verbatim from Overview.tsx hardcoded arrays.
// B2-MD will replace these bodies with real yahoo-finance2 / FRED calls.

import type {
  CalendarEvent,
  Constituent,
  FearGreed,
  Index,
  MacroIndicator,
  MacroKey,
  OHLC,
  Range,
  SearchResult,
  SectorReturn,
  VolumeBar,
  WatchlistEntry,
} from './types';

// ─── Helper ───────────────────────────────────────────────────────────────────

function delay(): Promise<void> {
  return new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
}

// ─── Mock datasets ────────────────────────────────────────────────────────────

const MOCK_INDICES: Index[] = [
  { ticker: 'SPX',   label: 'S&P 500',  price: '5,247.18', change: '+0.42%',  direction: 1  },
  { ticker: 'COMP',  label: 'NASDAQ',   price: '16,492.7', change: '+0.71%',  direction: 1  },
  { ticker: 'INDU',  label: 'DOW',      price: '39,218.5', change: '-0.08%',  direction: -1 },
  { ticker: '^KS11', label: 'KOSPI',    price: '2,710.3',  change: '+1.24%',  direction: 1  },
  { ticker: '^VIX',  label: 'VIX',      price: '14.82',    change: '-3.10%',  direction: -1 },
  { ticker: 'DXY',   label: 'DXY',      price: '104.12',   change: '+0.18%',  direction: 1  },
  { ticker: '^TNX',  label: '10Y UST',  price: '4.412%',   change: '+2.1bp',  direction: 1  },
  { ticker: 'BTC',   label: 'BTC',      price: '67,420',   change: '-1.84%',  direction: -1 },
];

const MOCK_SECTOR_RETURNS_1D: SectorReturn[] = [
  { name: 'Tech',          v:  1.84 },
  { name: 'Semis',         v:  3.21 },
  { name: 'Energy',        v: -1.08 },
  { name: 'Financials',    v:  0.32 },
  { name: 'Healthcare',    v:  0.71 },
  { name: 'Discretionary', v: -0.44 },
  { name: 'Materials',     v: -0.22 },
  { name: 'Utilities',     v:  0.08 },
];

const MOCK_CONSTITUENTS: Constituent[] = [
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
];

const MOCK_MACRO: MacroIndicator[] = [
  { key: 'US10Y',   label: 'US 10Y',    value: '4.412',   delta: '+2.1bp', seed: 11, trend:  0.5 },
  { key: 'CPI_YOY', label: 'CPI YoY',   value: '3.20%',   delta: '−0.10', seed: 12, trend: -0.3 },
  { key: 'USD_KRW', label: 'USD/KRW',   value: '1,378.4', delta: '+0.42%', seed: 13, trend:  0.4 },
  { key: 'WTI',     label: 'WTI Crude', value: '$78.42',  delta: '−1.18%', seed: 14, trend: -0.5 },
];

const MOCK_CALENDAR: CalendarEvent[] = [
  { time: '08:30', title: 'US Initial Jobless Claims', impact: 'HIGH' },
  { time: '10:00', title: 'Fed Powell · Press Q&A',    impact: 'HIGH' },
  { time: '14:30', title: 'BoK Minutes (KR)',           impact: 'MED'  },
  { time: '—',     title: 'NVDA · Earnings AMC',        impact: 'HIGH' },
];

const MOCK_FEAR_GREED: FearGreed = {
  value:     62,
  label:     'Greed',
  yesterday: 58,
  oneWeek:   49,
  oneMonth:  41,
};

const MOCK_KR_WATCHLIST: WatchlistEntry[] = [
  { code: '005930', name: 'Samsung',    change: '+1.82%', seed: 1, direction:  1 },
  { code: '000660', name: 'SK Hynix',   change: '+3.41%', seed: 2, direction:  1 },
  { code: '035420', name: 'Naver',      change: '-0.92%', seed: 3, direction: -1 },
  { code: '051910', name: 'LG Chem',    change: '+0.14%', seed: 4, direction:  1 },
  { code: '207940', name: 'SamsungBio', change: '-1.20%', seed: 5, direction: -1 },
];

// ─── Exported fetchers ────────────────────────────────────────────────────────

/** Returns the ticker strip indices (S&P, NASDAQ, DOW, KOSPI, VIX, DXY, 10Y, BTC). */
export async function getIndices(): Promise<Index[]> {
  await delay();
  return MOCK_INDICES;
}

/**
 * Returns intraday (or multi-day) OHLC bars for a given symbol and range.
 * Mock generates deterministic-ish bars from a seed derived from the symbol.
 */
export async function getIntraday(symbol: string, _range: Range): Promise<OHLC[]> {
  await delay();
  // Generate 62 synthetic OHLC bars. Seed from symbol char codes for determinism.
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

/** Returns S&P 500 heatmap constituents with day % change. */
export async function getSPConstituents(): Promise<Constituent[]> {
  await delay();
  return MOCK_CONSTITUENTS;
}

/**
 * Returns sector returns for the requested range.
 * Mock only has 1D data; other ranges return the same values scaled slightly.
 */
export async function getSectorReturns(_range: Range = '1D'): Promise<SectorReturn[]> {
  await delay();
  return MOCK_SECTOR_RETURNS_1D;
}

/**
 * Returns macro indicator values for the requested keys.
 * If `keys` is empty or undefined, returns all four indicators.
 */
export async function getMacro(keys?: MacroKey[]): Promise<MacroIndicator[]> {
  await delay();
  if (!keys || keys.length === 0) return MOCK_MACRO;
  return MOCK_MACRO.filter((m) => keys.includes(m.key));
}

/**
 * Returns today's key economic/earnings calendar events.
 * The `date` parameter is accepted for future real-data compatibility.
 */
export async function getCalendar(_date: string): Promise<CalendarEvent[]> {
  await delay();
  return MOCK_CALENDAR;
}

/** Returns Fear & Greed gauge data including yesterday/1W/1M trail. */
export async function getFearGreed(): Promise<FearGreed> {
  await delay();
  return MOCK_FEAR_GREED;
}

/**
 * Returns session volume bars (30 bars representing the trading session).
 * Mock produces synthetic volume data.
 */
export async function getSessionVolume(): Promise<VolumeBar[]> {
  await delay();
  const bars: VolumeBar[] = [];
  const now = Date.now();
  for (let i = 0; i < 30; i++) {
    const rand = ((9 * (i + 1) * 9301 + 49297) % 233280) / 233280;
    bars.push({ ts: now - (30 - i) * 13 * 60_000, volume: 60_000_000 + rand * 80_000_000 });
  }
  return bars;
}

/**
 * Returns watchlist entries for a given region.
 * Mock only has Korean watchlist data; other regions return an empty array.
 */
export async function getWatchlist(region: string): Promise<WatchlistEntry[]> {
  await delay();
  if (region === 'KR') return MOCK_KR_WATCHLIST;
  return [];
}

/** Returns symbol search results matching the query string. */
export async function getSearch(_q: string): Promise<SearchResult[]> {
  await delay();
  // Mock returns a small fixed set; B2-MD will call yahoo search API.
  return [
    { symbol: 'NVDA',       name: 'NVIDIA Corp',           exchange: 'NASDAQ' },
    { symbol: 'AAPL',       name: 'Apple Inc',              exchange: 'NASDAQ' },
    { symbol: '005930.KS',  name: 'Samsung Electronics',    exchange: 'KRX'    },
  ];
}
