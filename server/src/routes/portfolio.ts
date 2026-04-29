/**
 * /api/portfolio/* — owned by B2-MD.
 *
 * Backing store: ~/.intelistock/portfolio.json
 * If the file doesn't exist, we seed it from the same mock values that
 * were in app/src/data/portfolio.ts so the UI renders identically.
 */

import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const portfolio = Router();

// ─── JSON file storage ────────────────────────────────────────────────────────

const DATA_DIR  = path.join(os.homedir(), '.intelistock');
const DATA_FILE = path.join(DATA_DIR, 'portfolio.json');

interface PortfolioStore {
  summary:   PortfolioSummary;
  holdings:  Holding[];
  allocation: {
    sector: AllocationSlice[];
    region: AllocationSlice[];
    asset:  AllocationSlice[];
  };
  trades:     Trade[];
  riskFactors: RiskFactor[];
  watchlist:  {
    KR: WatchlistEntry[];
  };
}

// ─── Local type mirrors (no cross-workspace import) ──────────────────────────

interface PortfolioSummary {
  nav: number; navFormatted: string;
  dayChange: string; dayChangePct: string;
  ytd: string; oneYear: string;
  sharpe: number; exposure: string; exposureNote: string;
  riskScore: string; riskNote: string; drawdown: string; drawdownNote: string;
}

interface Holding {
  symbol: string; name: string; weight: string;
  price: string; dayPct: string; plPct: string;
  sparkSeed: number; risk: number;
}

interface AllocationSlice { name: string; v: number }

interface Trade {
  date: string; symbol: string; side: 'BUY' | 'SELL';
  quantity: number; price: number; currency: string;
}

interface RiskFactor {
  name: string; value: number; contribution: string;
}

interface WatchlistEntry {
  code: string; name: string; change: string; seed: number; direction: 1 | -1;
}

// ─── Seed data (mirrors original mock values) ─────────────────────────────────

function buildSeedData(): PortfolioStore {
  return {
    summary: {
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
    },
    holdings: [
      { symbol: 'NVDA',      name: 'NVIDIA Corp',         weight: '12.4%', price: '$924.19',  dayPct: '+3.17', plPct: '+184%', sparkSeed: 60, risk: 3 },
      { symbol: 'AAPL',      name: 'Apple Inc',           weight: '9.8%',  price: '$184.42',  dayPct: '+0.42', plPct: '+22%',  sparkSeed: 61, risk: 2 },
      { symbol: '005930.KS', name: 'Samsung Electronics', weight: '8.1%',  price: '₩72,400',  dayPct: '+1.82', plPct: '+14%',  sparkSeed: 62, risk: 2 },
      { symbol: 'MSFT',      name: 'Microsoft',           weight: '7.5%',  price: '$418.60',  dayPct: '+0.61', plPct: '+38%',  sparkSeed: 63, risk: 2 },
      { symbol: 'TSM',       name: 'TSMC ADR',            weight: '6.4%',  price: '$148.20',  dayPct: '+2.14', plPct: '+62%',  sparkSeed: 64, risk: 4 },
      { symbol: '000660.KS', name: 'SK Hynix',            weight: '5.8%',  price: '₩214,500', dayPct: '+3.41', plPct: '+71%',  sparkSeed: 65, risk: 3 },
      { symbol: 'XOM',       name: 'Exxon Mobil',         weight: '4.0%',  price: '$118.40',  dayPct: '−0.84', plPct: '+9%',   sparkSeed: 66, risk: 3 },
      { symbol: 'META',      name: 'Meta Platforms',      weight: '3.9%',  price: '$502.10',  dayPct: '+1.10', plPct: '+44%',  sparkSeed: 67, risk: 2 },
    ],
    allocation: {
      sector: [
        { name: 'Semis',      v: 28 }, { name: 'Software',   v: 18 },
        { name: 'Korea Eq',   v: 14 }, { name: 'Energy',     v: 11 },
        { name: 'Healthcare', v:  9 }, { name: 'Cash',       v:  8 },
        { name: 'Bonds',      v:  6 }, { name: 'Crypto',     v:  6 },
      ],
      region: [
        { name: 'US',    v: 62 }, { name: 'Korea', v: 18 },
        { name: 'Taiwan',v:  8 }, { name: 'Europe',v:  6 },
        { name: 'Cash',  v:  6 },
      ],
      asset: [
        { name: 'Equities',    v: 78 }, { name: 'Cash',   v:  8 },
        { name: 'Bonds',       v:  6 }, { name: 'Crypto', v:  6 },
        { name: 'Commodities', v:  2 },
      ],
    },
    trades: [
      { date: '2024-04-15', symbol: 'NVDA',      side: 'BUY',  quantity: 10,  price: 875.00, currency: 'USD' },
      { date: '2024-04-10', symbol: 'TSM',       side: 'BUY',  quantity: 50,  price: 142.50, currency: 'USD' },
      { date: '2024-04-05', symbol: 'XOM',       side: 'SELL', quantity: 20,  price: 120.00, currency: 'USD' },
      { date: '2024-03-28', symbol: '005930.KS', side: 'BUY',  quantity: 100, price: 71200,  currency: 'KRW' },
      { date: '2024-03-20', symbol: 'META',      side: 'BUY',  quantity: 15,  price: 480.00, currency: 'USD' },
    ],
    riskFactors: [
      { name: 'Market Beta',    value:  1.18, contribution: '42%' },
      { name: 'Semis Factor',   value:  0.84, contribution: '28%' },
      { name: 'Korea FX (KRW)', value:  0.31, contribution:  '9%' },
      { name: 'Energy',         value: -0.22, contribution:  '6%' },
      { name: 'Rates Duration', value:  0.15, contribution:  '4%' },
    ],
    watchlist: {
      KR: [
        { code: '005930', name: 'Samsung',    change: '+1.82%', seed: 1, direction:  1 },
        { code: '000660', name: 'SK Hynix',   change: '+3.41%', seed: 2, direction:  1 },
        { code: '035420', name: 'Naver',      change: '-0.92%', seed: 3, direction: -1 },
        { code: '051910', name: 'LG Chem',    change: '+0.14%', seed: 4, direction:  1 },
        { code: '207940', name: 'SamsungBio', change: '-1.20%', seed: 5, direction: -1 },
      ],
    },
  };
}

// ─── Store I/O ────────────────────────────────────────────────────────────────

function readStore(): PortfolioStore {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) {
      const seed = buildSeedData();
      fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), 'utf8');
      return seed;
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as PortfolioStore;
  } catch {
    return buildSeedData();
  }
}

// ─── Equity curve generator ───────────────────────────────────────────────────

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

portfolio.get('/summary', (_req: Request, res: Response) => {
  const store = readStore();
  res.json(store.summary);
});

portfolio.get('/equity-curve', (req: Request, res: Response) => {
  const range = String(req.query.range ?? '1Y') as EquityRange;
  res.json(generateEquityCurve(range, 42));
});

portfolio.get('/allocation', (req: Request, res: Response) => {
  const by = String(req.query.by ?? 'sector') as 'sector' | 'region' | 'asset';
  const store = readStore();
  const slice = store.allocation[by] ?? store.allocation.sector;
  res.json(slice);
});

portfolio.get('/holdings', (_req: Request, res: Response) => {
  const store = readStore();
  res.json(store.holdings);
});

portfolio.get('/watchlist', (req: Request, res: Response) => {
  const region = String(req.query.region ?? 'KR').toUpperCase();
  const store = readStore();
  if (region === 'KR') {
    res.json(store.watchlist.KR);
  } else {
    res.json([]);
  }
});

portfolio.get('/trades', (_req: Request, res: Response) => {
  const store = readStore();
  res.json(store.trades);
});

portfolio.get('/risk-factors', (_req: Request, res: Response) => {
  const store = readStore();
  res.json(store.riskFactors);
});
