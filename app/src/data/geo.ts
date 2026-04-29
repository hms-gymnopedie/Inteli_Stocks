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

// Heat map keyed by ISO 3166-1 alpha-3 (B2-MAP). Country picks below try to
// preserve the previous continent-level pattern: APAC tension belt high,
// Middle East elevated, Europe edge cases medium, Americas/Oceania low.
//
// Pins now carry both lat/lng (for the new TopoJSON map) AND legacy x/y
// viewBox coordinates (for any caller that hasn't migrated yet). The new
// WorldMap prefers lat/lng when present.
//
// Flows are expressed as [lng1, lat1, lng2, lat2] tuples — the new map
// auto-detects geographic vs viewBox flow tuples (anything within ±180 is
// treated as geographic). The previous viewBox-based tuples are preserved
// in spirit (US <-> TW, KR <-> US, IR -> UA, NG -> UA) but use real geo
// endpoints so flow lines stay pinned to the correct countries under the
// equal-earth projection.
const MOCK_RISK_MAP: RiskMapEntry = {
  heat: {
    // High — active conflict / hot tension
    UKR: 'high',
    RUS: 'high',
    ISR: 'high',
    PSE: 'high',
    TWN: 'high',
    CHN: 'high',
    SAU: 'high',
    IRN: 'high',
    // Medium — elevated risk
    KOR: 'med',
    PRK: 'med',
    IND: 'med',
    PAK: 'med',
    EGY: 'med',
    TUR: 'med',
    LBN: 'med',
    SYR: 'med',
    IRQ: 'med',
    YEM: 'med',
    NGA: 'med',
    PHL: 'med',
    VNM: 'med',
    USA: 'med',
    DEU: 'med',
    FRA: 'med',
    // Low — quiet
    JPN: 'low',
    GBR: 'low',
    CAN: 'low',
    MEX: 'low',
    BRA: 'low',
    ARG: 'low',
    AUS: 'low',
    NZL: 'low',
    IDN: 'low',
    MYS: 'low',
    THA: 'low',
    ZAF: 'low',
    GRL: 'low',
    NOR: 'low',
    SWE: 'low',
    FIN: 'low',
    ESP: 'low',
    ITA: 'low',
    POL: 'low',
    MDG: 'low',
  },
  pins: [
    { x: 490, y: 120, lng:  31,    lat: 49,    level: 'high', label: 'UA · WAR'       },
    { x: 565, y: 200, lng:  35,    lat: 32,    level: 'high', label: 'IL · CONFLICT'  },
    { x: 590, y: 215, lng:  53,    lat: 32,    level: 'med',  label: 'IR · SANCTIONS' },
    { x: 790, y: 200, lng: 121,    lat: 23.7,  level: 'high', label: 'TW · TENSION'   },
    { x: 815, y: 158, lng: 127,    lat: 37.5,  level: 'med',  label: 'KR · ELECTION'  },
    { x: 220, y: 160, lng: -95,    lat: 38,    level: 'med',  label: 'US · TARIFFS'   },
    { x: 480, y: 280, lng:   8,    lat:  9,    level: 'low',  label: 'NG · OIL'       },
  ],
  flows: [
    // (lng, lat) → (lng, lat). US ↔ TW, KR → US, IR → UA, NG → UA.
    [-95, 38, 121, 23.7],
    [127, 37.5, -95, 38],
    [ 53, 32,   31, 49  ],
    [  8,  9,   31, 49  ],
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
