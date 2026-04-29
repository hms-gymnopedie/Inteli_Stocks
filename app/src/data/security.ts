// Security detail mock fetchers.
// Data lifted verbatim from Detail.tsx hardcoded arrays (NVDA).
// B2-MD will replace these bodies with yahoo-finance2 + SEC EDGAR calls.

import type {
  AnalystTarget,
  Earnings,
  Filing,
  Fundamental,
  IVSurfacePoint,
  OHLC,
  Peer,
  Range,
  SecurityProfile,
} from './types';

// ─── Helper ───────────────────────────────────────────────────────────────────

function delay(): Promise<void> {
  return new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
}

// ─── Mock datasets (NVDA) ─────────────────────────────────────────────────────

const MOCK_PROFILE_NVDA: SecurityProfile = {
  symbol:        'NVDA',
  name:          'NVIDIA Corp',
  sector:        'SEMIS',
  exchange:      'NASDAQ',
  indices:       'S&P 500 · Nasdaq 100 · MSCI World',
  price:         924.19,
  priceFormatted:'$924.19',
  dayChange:     '+$28.41',
  dayChangePct:  '+3.17%',
  currency:      'USD',
};

const MOCK_FUNDAMENTALS_NVDA: Fundamental[] = [
  { label: 'MKT CAP',    value: '$2.31T'              },
  { label: 'P/E',        value: '74.1',  note: 'sector 28.4' },
  { label: 'P/S',        value: '36.2'                },
  { label: 'REV YoY',    value: '+265%', note: 'up'          },
  { label: 'NET MARGIN', value: '54.2%'               },
  { label: 'DIV YIELD',  value: '0.02%'               },
  { label: '52W RANGE',  value: '$280 — $974'         },
  { label: 'BETA',       value: '1.74'                },
  { label: 'SHORT %',    value: '1.20%'               },
  { label: 'EPS (TTM)',  value: '$11.93'              },
  { label: 'FCF',        value: '$26.9B'              },
  { label: 'DEBT/EQ',    value: '0.36'                },
];

const MOCK_FILINGS_NVDA: Filing[] = [
  { date: '26 APR', form: '8-K',  description: 'Material Definitive Agreement · supply contract', impact: 'high' },
  { date: '18 APR', form: '4',    description: 'Insider sale · CFO · 12,000 shares',               impact: 'med'  },
  { date: '09 APR', form: '10-Q', description: 'Quarterly Report · Q1 FY25',                       impact: 'high' },
  { date: '02 APR', form: '8-K',  description: 'Press release · GTC keynote summary',              impact: 'low'  },
  { date: '28 MAR', form: '13G',  description: 'Vanguard 5.1% holding update',                     impact: 'low'  },
];

const MOCK_TARGETS_NVDA: AnalystTarget = {
  low:       720,
  consensus: 1040,
  high:      1200,
  buys:      38,
  holds:     7,
  sells:     1,
  currency:  'USD',
};

const MOCK_PEERS_NVDA: Peer[] = [
  { symbol: 'AMD',  price: '$162.4', change: '+1.84%', direction:  1, seed: 31 },
  { symbol: 'TSM',  price: '$148.2', change: '+2.14%', direction:  1, seed: 32 },
  { symbol: 'INTC', price: ' $34.1', change: '−0.62%', direction: -1, seed: 33 },
  { symbol: 'ASML', price: '$928.5', change: '+1.10%', direction:  1, seed: 34 },
];

const MOCK_EARNINGS_NVDA: Earnings[] = [
  { quarter: 'Q4 FY24', epsActual: 5.16,  epsEstimate: 4.84,  revenueActual: 22_100, revenueEstimate: 20_420 },
  { quarter: 'Q3 FY24', epsActual: 4.02,  epsEstimate: 3.65,  revenueActual: 18_120, revenueEstimate: 16_090 },
  { quarter: 'Q2 FY24', epsActual: 2.70,  epsEstimate: 2.04,  revenueActual: 13_510, revenueEstimate: 11_040 },
  { quarter: 'Q1 FY24', epsActual: 1.09,  epsEstimate: 0.92,  revenueActual:  7_190, revenueEstimate:  6_520 },
  { quarter: 'Q1 FY25', epsActual: null,  epsEstimate: 5.55,  revenueActual: null,   revenueEstimate: 24_600 },
];

// ─── OHLC generation ──────────────────────────────────────────────────────────

function generateOHLC(symbol: string, range: Range): OHLC[] {
  const barCounts: Partial<Record<Range, number>> = {
    '1D':  78,
    '1W':  35,
    '1M':  22,
    '3M':  65,
    '6M':  130,
    '1Y':  253,
    '5Y':  260,
    'YTD': 83,
    'MAX': 520,
  };
  const count = barCounts[range] ?? 62;
  const seed  = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const bars: OHLC[] = [];
  let price = 860 + (seed % 80);
  const now = Date.now();
  const msPerBar = 5 * 60_000;

  for (let i = 0; i < count; i++) {
    const rand = ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280;
    const move = (rand - 0.48) * 18;
    const open  = price;
    const close = price + move;
    const high  = Math.max(open, close) + Math.abs(move) * 0.25;
    const low   = Math.min(open, close) - Math.abs(move) * 0.25;
    bars.push({ ts: now - (count - i) * msPerBar, open, high, low, close, volume: 30_000_000 + rand * 40_000_000 });
    price = close;
  }
  return bars;
}

// ─── IV surface generation ────────────────────────────────────────────────────

function generateIVSurface(symbol: string): IVSurfacePoint[] {
  const expiries = ['2024-05-17', '2024-06-21', '2024-09-20'];
  const strikes  = [800, 850, 900, 950, 1000, 1050, 1100];
  const points: IVSurfacePoint[] = [];
  const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  expiries.forEach((expiry, ei) => {
    strikes.forEach((strike, si) => {
      const rand = ((seed * (ei * 10 + si + 1) * 9301 + 49297) % 233280) / 233280;
      // Skew: lower strikes have higher IV
      const skew = (1000 - strike) * 0.0003;
      const iv   = 0.45 + rand * 0.25 + skew + ei * 0.03;
      points.push({ expiry, strike, iv: Math.round(iv * 1000) / 1000 });
    });
  });
  return points;
}

// ─── Exported fetchers ────────────────────────────────────────────────────────

/**
 * Returns security profile header data for the given symbol.
 * Mock only has full data for NVDA; other symbols get a minimal placeholder.
 */
export async function getProfile(symbol: string): Promise<SecurityProfile> {
  await delay();
  if (symbol === 'NVDA') return MOCK_PROFILE_NVDA;
  // Minimal placeholder for other symbols — B2-MD fills in real data.
  return {
    symbol,
    name:          symbol,
    sector:        'N/A',
    exchange:      'N/A',
    indices:       '',
    price:         0,
    priceFormatted:'—',
    dayChange:     '—',
    dayChangePct:  '—',
    currency:      'USD',
  };
}

/** Returns OHLC bars for the given symbol and range. */
export async function getOHLC(symbol: string, range: Range = '3M'): Promise<OHLC[]> {
  await delay();
  return generateOHLC(symbol, range);
}

/**
 * Returns fundamental metrics for the given symbol.
 * Mock only has full data for NVDA.
 */
export async function getFundamentals(symbol: string): Promise<Fundamental[]> {
  await delay();
  if (symbol === 'NVDA') return MOCK_FUNDAMENTALS_NVDA;
  return [];
}

/**
 * Returns SEC filings for the given symbol.
 * Mock only has data for NVDA.
 */
export async function getFilings(symbol: string): Promise<Filing[]> {
  await delay();
  if (symbol === 'NVDA') return MOCK_FILINGS_NVDA;
  return [];
}

/**
 * Returns analyst price targets for the given symbol.
 * Mock only has data for NVDA.
 */
export async function getTargets(symbol: string): Promise<AnalystTarget | null> {
  await delay();
  if (symbol === 'NVDA') return MOCK_TARGETS_NVDA;
  return null;
}

/**
 * Returns peer comparison rows for the given symbol.
 * Mock only has data for NVDA.
 */
export async function getPeers(symbol: string): Promise<Peer[]> {
  await delay();
  if (symbol === 'NVDA') return MOCK_PEERS_NVDA;
  return [];
}

/**
 * Returns earnings history (and upcoming estimate) for the given symbol.
 * Mock only has data for NVDA.
 */
export async function getEarnings(symbol: string): Promise<Earnings[]> {
  await delay();
  if (symbol === 'NVDA') return MOCK_EARNINGS_NVDA;
  return [];
}

/**
 * Returns IV surface data points for the given symbol.
 * Synthetic for all symbols in Phase 0.
 */
export async function getIVSurface(symbol: string): Promise<IVSurfacePoint[]> {
  await delay();
  return generateIVSurface(symbol);
}
