// Portfolio mock fetchers.
// Data lifted verbatim from Portfolio.tsx hardcoded arrays.
// B2-MD will swap these bodies with real broker/exchange API calls.

import type {
  AllocationBy,
  AllocationSlice,
  EquityPoint,
  Holding,
  PortfolioSummary,
  Range,
  RiskFactor,
  Trade,
  WatchlistEntry,
} from './types';

// ─── Helper ───────────────────────────────────────────────────────────────────

function delay(): Promise<void> {
  return new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
}

// ─── Mock datasets ────────────────────────────────────────────────────────────

const MOCK_SUMMARY: PortfolioSummary = {
  nav:            1_284_420,
  navFormatted:   '$1,284,420',
  dayChange:      '+$27,318',
  dayChangePct:   '+2.18%',
  ytd:            '+18.4%',
  oneYear:        '+34.2%',
  sharpe:         1.81,
  exposure:       '92%',
  exposureNote:   'cash 8%',
  riskScore:      '3.2/5',
  riskNote:       'moderate-aggr',
  drawdown:       '−4.1%',
  drawdownNote:   'from peak',
};

const MOCK_HOLDINGS: Holding[] = [
  { symbol: 'NVDA',       name: 'NVIDIA Corp',           weight: '12.4%', price: '$924.19',   dayPct: '+3.17', plPct: '+184%', sparkSeed: 60, risk: 3 },
  { symbol: 'AAPL',       name: 'Apple Inc',             weight: '9.8%',  price: '$184.42',   dayPct: '+0.42', plPct: '+22%',  sparkSeed: 61, risk: 2 },
  { symbol: '005930.KS',  name: 'Samsung Electronics',   weight: '8.1%',  price: '₩72,400',   dayPct: '+1.82', plPct: '+14%',  sparkSeed: 62, risk: 2 },
  { symbol: 'MSFT',       name: 'Microsoft',             weight: '7.5%',  price: '$418.60',   dayPct: '+0.61', plPct: '+38%',  sparkSeed: 63, risk: 2 },
  { symbol: 'TSM',        name: 'TSMC ADR',              weight: '6.4%',  price: '$148.20',   dayPct: '+2.14', plPct: '+62%',  sparkSeed: 64, risk: 4 },
  { symbol: '000660.KS',  name: 'SK Hynix',              weight: '5.8%',  price: '₩214,500',  dayPct: '+3.41', plPct: '+71%',  sparkSeed: 65, risk: 3 },
  { symbol: 'XOM',        name: 'Exxon Mobil',           weight: '4.0%',  price: '$118.40',   dayPct: '−0.84', plPct: '+9%',   sparkSeed: 66, risk: 3 },
  { symbol: 'META',       name: 'Meta Platforms',        weight: '3.9%',  price: '$502.10',   dayPct: '+1.10', plPct: '+44%',  sparkSeed: 67, risk: 2 },
];

const MOCK_ALLOCATION_SECTOR: AllocationSlice[] = [
  { name: 'Semis',     v: 28 },
  { name: 'Software',  v: 18 },
  { name: 'Korea Eq',  v: 14 },
  { name: 'Energy',    v: 11 },
  { name: 'Healthcare',v:  9 },
  { name: 'Cash',      v:  8 },
  { name: 'Bonds',     v:  6 },
  { name: 'Crypto',    v:  6 },
];

const MOCK_ALLOCATION_REGION: AllocationSlice[] = [
  { name: 'US',        v: 62 },
  { name: 'Korea',     v: 18 },
  { name: 'Taiwan',    v:  8 },
  { name: 'Europe',    v:  6 },
  { name: 'Cash',      v:  6 },
];

const MOCK_ALLOCATION_ASSET: AllocationSlice[] = [
  { name: 'Equities',  v: 78 },
  { name: 'Cash',      v:  8 },
  { name: 'Bonds',     v:  6 },
  { name: 'Crypto',    v:  6 },
  { name: 'Commodities', v: 2 },
];

const MOCK_TRADES: Trade[] = [
  { date: '2024-04-15', symbol: 'NVDA',      side: 'BUY',  quantity: 10,  price: 875.00, currency: 'USD' },
  { date: '2024-04-10', symbol: 'TSM',       side: 'BUY',  quantity: 50,  price: 142.50, currency: 'USD' },
  { date: '2024-04-05', symbol: 'XOM',       side: 'SELL', quantity: 20,  price: 120.00, currency: 'USD' },
  { date: '2024-03-28', symbol: '005930.KS', side: 'BUY',  quantity: 100, price: 71200,  currency: 'KRW' },
  { date: '2024-03-20', symbol: 'META',      side: 'BUY',  quantity: 15,  price: 480.00, currency: 'USD' },
];

const MOCK_RISK_FACTORS: RiskFactor[] = [
  { name: 'Market Beta',    value:  1.18, contribution: '42%' },
  { name: 'Semis Factor',   value:  0.84, contribution: '28%' },
  { name: 'Korea FX (KRW)', value:  0.31, contribution:  '9%' },
  { name: 'Energy',         value: -0.22, contribution:  '6%' },
  { name: 'Rates Duration', value:  0.15, contribution:  '4%' },
];

// ─── Equity curve generation ──────────────────────────────────────────────────

function generateEquityCurve(range: Range, seed: number): EquityPoint[] {
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
  const count = barCounts[range] ?? 253;
  const points: EquityPoint[] = [];
  let value = 900_000;
  const now = Date.now();
  const msPerBar = (365 * 24 * 3600_000) / 253; // roughly 1 trading day
  for (let i = 0; i < count; i++) {
    const rand = ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280;
    value = value * (1 + (rand - 0.44) * 0.018);
    points.push({ ts: now - (count - i) * msPerBar, value });
  }
  return points;
}

// ─── Exported fetchers ────────────────────────────────────────────────────────

/** Returns the portfolio summary KPI header data. */
export async function getSummary(): Promise<PortfolioSummary> {
  await delay();
  return MOCK_SUMMARY;
}

/** Returns equity curve data points for the given time range. */
export async function getEquityCurve(range: Range = '1Y'): Promise<EquityPoint[]> {
  await delay();
  return generateEquityCurve(range, 42);
}

/**
 * Returns allocation slices grouped by the chosen dimension.
 * Supported: 'sector' | 'region' | 'asset'.
 */
export async function getAllocation(by: AllocationBy = 'sector'): Promise<AllocationSlice[]> {
  await delay();
  switch (by) {
    case 'region': return MOCK_ALLOCATION_REGION;
    case 'asset':  return MOCK_ALLOCATION_ASSET;
    default:       return MOCK_ALLOCATION_SECTOR;
  }
}

/** Returns the full list of portfolio holdings. */
export async function getHoldings(): Promise<Holding[]> {
  await delay();
  return MOCK_HOLDINGS;
}

/**
 * Returns watchlist entries for the given region.
 * Delegates to market.getWatchlist for consistency; kept here for portfolioId scoping.
 */
export async function getWatchlist(region: string): Promise<WatchlistEntry[]> {
  await delay();
  // Korean watchlist — same data as market.getWatchlist('KR')
  if (region === 'KR') {
    return [
      { code: '005930', name: 'Samsung',    change: '+1.82%', seed: 1, direction:  1 },
      { code: '000660', name: 'SK Hynix',   change: '+3.41%', seed: 2, direction:  1 },
      { code: '035420', name: 'Naver',      change: '-0.92%', seed: 3, direction: -1 },
      { code: '051910', name: 'LG Chem',    change: '+0.14%', seed: 4, direction:  1 },
      { code: '207940', name: 'SamsungBio', change: '-1.20%', seed: 5, direction: -1 },
    ];
  }
  return [];
}

/** Returns trade history for the portfolio. */
export async function getTrades(): Promise<Trade[]> {
  await delay();
  return MOCK_TRADES;
}

/** Returns risk factor decomposition (beta/sector/geo exposures). */
export async function getRiskFactors(): Promise<RiskFactor[]> {
  await delay();
  return MOCK_RISK_FACTORS;
}
