/**
 * Seed data factory — B5-CR
 *
 * Returns the same mock portfolio values that were originally hardcoded in
 * routes/portfolio.ts. Extracted here so both local.ts and supabase.ts can
 * call it when a user's portfolio row / file doesn't exist yet.
 */

import type { PortfolioStore } from './types.js';

export function buildSeedData(): PortfolioStore {
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
        { name: 'US',     v: 62 }, { name: 'Korea', v: 18 },
        { name: 'Taiwan', v:  8 }, { name: 'Europe', v:  6 },
        { name: 'Cash',   v:  6 },
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
