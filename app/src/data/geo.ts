// Geo risk mock fetchers.
// Data lifted verbatim from GeoRisk.tsx hardcoded arrays.
// streamAlerts is an AsyncIterable generator that yields mock alerts with a
// 1500–3000ms gap between yields, then ends (finite cycle).

import type {
  AffectedHolding,
  GlobalRiskIndex,
  MapLayer,
  RiskAlert,
  RiskHotspot,
  RiskMapEntry,
} from './types';

// ─── Helper ───────────────────────────────────────────────────────────────────

function delay(): Promise<void> {
  return new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
}

// ─── Mock datasets ────────────────────────────────────────────────────────────

const MOCK_RISK_MAP: RiskMapEntry = {
  heat: {
    namerica:    'low',
    europe:      'med',
    africa:      'med',
    asia:        'high',
    india:       'med',
    seasia:      'med',
    samerica:    'low',
    australia:   'low',
    arabia:      'high',
    korea:       'med',
    japan:       'low',
    uk:          'low',
    indonesia:   'low',
    camerica:    'low',
    nz:          'low',
    philippines: 'med',
    greenland:   'low',
    scand:       'low',
    madagascar:  'low',
  },
  pins: [
    { x: 490, y: 120, level: 'high', label: 'UA · WAR'       },
    { x: 565, y: 200, level: 'high', label: 'IL · CONFLICT'  },
    { x: 590, y: 215, level: 'med',  label: 'IR · SANCTIONS' },
    { x: 790, y: 200, level: 'high', label: 'TW · TENSION'   },
    { x: 815, y: 158, level: 'med',  label: 'KR · ELECTION'  },
    { x: 220, y: 160, level: 'med',  label: 'US · TARIFFS'   },
    { x: 480, y: 280, level: 'low',  label: 'NG · OIL'       },
  ],
  flows: [
    [220, 160, 790, 200],
    [815, 158, 220, 160],
    [590, 215, 490, 120],
    [480, 280, 490, 120],
  ],
};

const MOCK_GLOBAL_INDEX: GlobalRiskIndex = {
  value:  71,
  delta:  4,
  period: '24H',
  note:   'ELEVATED · ASIA-PACIFIC LEADING',
};

const MOCK_HOTSPOTS: RiskHotspot[] = [
  { name: 'Taiwan Strait',   impact: 'Semis · 32% impact',  level: 'high', tickers: 'NVDA TSM ASML'      },
  { name: 'Russia-Ukraine',  impact: 'Energy · 18% impact', level: 'high', tickers: 'XOM CVX BP'         },
  { name: 'Middle East',     impact: 'Crude · 14% impact',  level: 'med',  tickers: 'WTI BRENT'          },
  { name: 'Korea Peninsula', impact: 'KRW · 6% impact',     level: 'med',  tickers: 'KOSPI USDKRW'       },
  { name: 'US-China Tariffs',impact: 'Tech · 9% impact',    level: 'med',  tickers: 'AAPL TSLA'          },
];

const MOCK_AFFECTED: AffectedHolding[] = [
  { symbol: 'NVDA',      weight: '12.4%', scenarioPnl: '−4.2%', direction: -1 },
  { symbol: 'TSM',       weight: ' 8.1%', scenarioPnl: '−6.8%', direction: -1 },
  { symbol: 'XOM',       weight: ' 4.0%', scenarioPnl: '+2.1%', direction:  1 },
  { symbol: '005930.KS', weight: ' 6.3%', scenarioPnl: '−1.4%', direction: -1 },
];

const MOCK_LAYERS: MapLayer[] = [
  { name: 'Country risk heatmap',    enabled: true  },
  { name: 'Conflict / event pins',   enabled: true  },
  { name: 'Trade flow lines',        enabled: true  },
  { name: 'Energy & commodity sites',enabled: false },
  { name: 'Sanction zones',          enabled: false },
  { name: 'Shipping lanes',          enabled: false },
];

const MOCK_ALERTS: RiskAlert[] = [
  {
    id:    'alert-tw-001',
    level: 'high',
    title: 'Taiwan Strait · naval activity escalation',
    body:  'Semi supply-chain exposure: TSM, ASML, NVDA. Estimated revenue drag if disruption: −6.4% (Q3).',
    hedge: 'HEDGE · SOXX PUT',
  },
  {
    id:    'alert-me-002',
    level: 'med',
    title: 'Middle East · oil supply route pressure',
    body:  'Hormuz shipping traffic down 8% week-over-week. WTI premium widening; XOM/CVX may see tailwind.',
    hedge: 'HEDGE · USO CALL',
  },
  {
    id:    'alert-kr-003',
    level: 'med',
    title: 'Korea Peninsula · cross-border tension uptick',
    body:  'USDKRW rose 0.6% on heightened rhetoric. Samsung Electronics & SK Hynix at near-term FX risk.',
    hedge: 'HEDGE · KRW PUT',
  },
];

// ─── Exported fetchers ────────────────────────────────────────────────────────

/** Returns the full risk map data (heat, pins, flows) for WorldMap. */
export async function getRiskMap(): Promise<RiskMapEntry> {
  await delay();
  return MOCK_RISK_MAP;
}

/** Returns the global risk index (value, delta, note). */
export async function getGlobalIndex(): Promise<GlobalRiskIndex> {
  await delay();
  return MOCK_GLOBAL_INDEX;
}

/** Returns active geopolitical hotspots ranked by impact. */
export async function getHotspots(): Promise<RiskHotspot[]> {
  await delay();
  return MOCK_HOTSPOTS;
}

/**
 * Returns portfolio holdings affected by geo risk scenarios.
 * The `portfolioId` parameter is reserved for multi-portfolio support in B5.
 */
export async function getAffected(_portfolioId: string): Promise<AffectedHolding[]> {
  await delay();
  return MOCK_AFFECTED;
}

/** Returns the current map layer toggle configuration. */
export async function getLayers(): Promise<MapLayer[]> {
  await delay();
  return MOCK_LAYERS;
}

/**
 * Streams live geo risk alerts as an AsyncIterable.
 * Yields each alert with a 1500–3000ms inter-yield gap, then ends.
 * B2-MD will replace this with a WebSocket or SSE connection.
 */
export async function* streamAlerts(): AsyncIterable<RiskAlert> {
  for (const alert of MOCK_ALERTS) {
    const gap = 1500 + Math.random() * 1500;
    await new Promise<void>((r) => setTimeout(r, gap));
    yield alert;
  }
}
