// Geo risk mock fetchers.
// Data lifted verbatim from GeoRisk.tsx hardcoded arrays.
// streamAlerts is an AsyncIterable generator that yields mock alerts with a
// 1500–3000ms gap between yields, then ends (finite cycle).

import type {
  AffectedHolding,
  GlobalRiskIndex,
  MapLayer,
  RegionDetail,
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

interface GeoState {
  heat: Record<string, 'low' | 'med' | 'high'>;
  pins: typeof MOCK_RISK_MAP.pins;
  flows: typeof MOCK_RISK_MAP.flows;
  hotspots: RiskHotspot[];
  alerts: RiskAlert[];
  layers: MapLayer[];
  globalIndex: GlobalRiskIndex;
}

/** Cached state promise so the four getRiskMap/getHotspots/etc. fetchers
 *  share a single backend call per page load. */
let _statePromise: Promise<GeoState> | null = null;
function fetchState(): Promise<GeoState> {
  if (_statePromise) return _statePromise;
  _statePromise = fetch('/api/geo/state')
    .then(async (r) => {
      if (!r.ok) throw new Error(`/api/geo/state ${r.status}`);
      return r.json() as Promise<GeoState>;
    })
    .catch((err) => {
      console.warn('[geo] backend fetch failed, falling back to inline mocks:', err);
      return {
        heat: MOCK_RISK_MAP.heat as Record<string, 'low' | 'med' | 'high'>,
        pins: MOCK_RISK_MAP.pins,
        flows: MOCK_RISK_MAP.flows,
        hotspots: MOCK_HOTSPOTS,
        alerts: MOCK_ALERTS,
        layers: MOCK_LAYERS,
        globalIndex: MOCK_GLOBAL_INDEX,
      };
    });
  return _statePromise;
}

/** Returns the full risk map data (heat, pins, flows) for WorldMap. */
export async function getRiskMap(): Promise<RiskMapEntry> {
  const s = await fetchState();
  return { heat: s.heat, pins: s.pins, flows: s.flows };
}

/** Returns the global risk index (value, delta, note). */
export async function getGlobalIndex(): Promise<GlobalRiskIndex> {
  const s = await fetchState();
  return s.globalIndex;
}

/** Returns active geopolitical hotspots ranked by impact. */
export async function getHotspots(): Promise<RiskHotspot[]> {
  const s = await fetchState();
  return s.hotspots;
}

/**
 * Returns portfolio holdings affected by geo risk scenarios.
 * Mock-only — no real source. Reserved for multi-portfolio support in B5.
 */
export async function getAffected(_portfolioId: string): Promise<AffectedHolding[]> {
  await delay();
  return MOCK_AFFECTED;
}

/** Returns the current map layer toggle configuration. */
export async function getLayers(): Promise<MapLayer[]> {
  const s = await fetchState();
  return s.layers;
}

// Region detail keyed by ISO-2 prefix in the pin label (e.g. "TW · TENSION"
// → key "TW"). Used by `getRegionDetail(label)` for the slide-in drawer.
const MOCK_REGION_DETAIL: Record<string, Omit<RegionDetail, 'label'>> = {
  UA: {
    events: [
      { date: '26 APR', headline: 'Drone strikes hit Black Sea grain port; wheat futures +2.4%' },
      { date: '24 APR', headline: 'EU pledges €4.2B additional military aid package' },
      { date: '21 APR', headline: 'Front-line shifts near Donetsk; gas pipeline corridor at risk' },
      { date: '17 APR', headline: 'IMF disburses $880M tranche; UAH stabilises vs USD' },
    ],
    etfs: [
      { symbol: 'WEAT', dayPct: '+2.4%', direction:  1 },
      { symbol: 'XOP',  dayPct: '+1.1%', direction:  1 },
      { symbol: 'EZU',  dayPct: '−0.6%', direction: -1 },
      { symbol: 'GLD',  dayPct: '+0.4%', direction:  1 },
    ],
  },
  IL: {
    events: [
      { date: '27 APR', headline: 'Cross-border exchanges; Brent +1.8% on supply concern' },
      { date: '23 APR', headline: 'US Navy redeploys carrier group to Eastern Med' },
      { date: '19 APR', headline: 'Tel Aviv tech IPO pipeline deferred Q3' },
      { date: '12 APR', headline: 'Shipping insurance premium for Eilat route +35%' },
    ],
    etfs: [
      { symbol: 'EIS',  dayPct: '−1.4%', direction: -1 },
      { symbol: 'XLE',  dayPct: '+1.1%', direction:  1 },
      { symbol: 'USO',  dayPct: '+1.8%', direction:  1 },
      { symbol: 'ITA',  dayPct: '+0.5%', direction:  1 },
    ],
  },
  IR: {
    events: [
      { date: '25 APR', headline: 'New US sanctions target petrochemical exports' },
      { date: '20 APR', headline: 'Strait of Hormuz transit slows; tanker rates +12%' },
      { date: '15 APR', headline: 'Crude exports to Asia drop to 6-month low' },
      { date: '08 APR', headline: 'IAEA inspectors regain limited access' },
    ],
    etfs: [
      { symbol: 'USO',  dayPct: '+1.8%', direction:  1 },
      { symbol: 'BNO',  dayPct: '+2.1%', direction:  1 },
      { symbol: 'XLE',  dayPct: '+1.1%', direction:  1 },
      { symbol: 'GLD',  dayPct: '+0.4%', direction:  1 },
    ],
  },
  TW: {
    events: [
      { date: '28 APR', headline: 'PLA exercises in Taiwan Strait expanded to 72hr window' },
      { date: '24 APR', headline: 'TSMC reports record N3 yield; capex guidance unchanged' },
      { date: '20 APR', headline: 'US ships 2nd $500M arms package; semis ETF flows positive' },
      { date: '14 APR', headline: 'Cable repair operation resumes after 11-day outage' },
    ],
    etfs: [
      { symbol: 'EWT',  dayPct: '−1.1%', direction: -1 },
      { symbol: 'SOXX', dayPct: '−0.8%', direction: -1 },
      { symbol: 'SMH',  dayPct: '−0.6%', direction: -1 },
      { symbol: 'FXI',  dayPct: '−0.3%', direction: -1 },
    ],
  },
  KR: {
    events: [
      { date: '26 APR', headline: 'BoK holds base rate at 3.50%; KRW recovers 0.4%' },
      { date: '22 APR', headline: 'Samsung Electronics earnings beat; HBM demand robust' },
      { date: '18 APR', headline: 'National Assembly election results; market neutral' },
      { date: '11 APR', headline: 'Cross-border tension uptick; defence stocks rally' },
    ],
    etfs: [
      { symbol: 'EWY',  dayPct: '+0.6%', direction:  1 },
      { symbol: 'SOXX', dayPct: '−0.8%', direction: -1 },
      { symbol: 'KORU', dayPct: '+1.7%', direction:  1 },
      { symbol: 'SMH',  dayPct: '−0.6%', direction: -1 },
    ],
  },
  US: {
    events: [
      { date: '27 APR', headline: 'White House previews tariff hikes on EV imports; auto-suppliers mixed' },
      { date: '24 APR', headline: 'Fed minutes signal patience; 10Y yield −4bp' },
      { date: '20 APR', headline: 'NVDA-led semis squeeze; Nasdaq +1.4% intraday reversal' },
      { date: '15 APR', headline: 'Q1 GDP advance estimate +2.1% annualised' },
    ],
    etfs: [
      { symbol: 'SPY',  dayPct: '+0.3%', direction:  1 },
      { symbol: 'QQQ',  dayPct: '+0.5%', direction:  1 },
      { symbol: 'XLI',  dayPct: '−0.2%', direction: -1 },
      { symbol: 'TLT',  dayPct: '+0.4%', direction:  1 },
    ],
  },
  NG: {
    events: [
      { date: '25 APR', headline: 'Niger Delta production resumes; Bonny Light differential −$0.8' },
      { date: '20 APR', headline: 'CBN holds rate at 24.75%; NGN volatility easing' },
      { date: '14 APR', headline: 'Dangote refinery imports first cargo of US WTI' },
      { date: '07 APR', headline: 'Pipeline sabotage incident — short-lived 80kbpd outage' },
    ],
    etfs: [
      { symbol: 'NGE',  dayPct: '−0.4%', direction: -1 },
      { symbol: 'XOP',  dayPct: '+1.1%', direction:  1 },
      { symbol: 'AFK',  dayPct: '−0.2%', direction: -1 },
      { symbol: 'USO',  dayPct: '+1.8%', direction:  1 },
    ],
  },
};

/**
 * Returns short event timeline + related ETFs for a given pin label.
 * The lookup uses the label's ISO-2 prefix (everything before " · "), so
 * "TW · TENSION" maps to MOCK_REGION_DETAIL.TW.
 *
 * Falls back to a generic placeholder when no entry matches — callers can
 * still render the drawer header (label + level chip) without breaking.
 */
export async function getRegionDetail(label: string): Promise<RegionDetail> {
  try {
    const r = await fetch(`/api/geo/region/${encodeURIComponent(label)}`);
    if (r.ok) return (await r.json()) as RegionDetail;
  } catch {
    /* fall through to mock */
  }
  const key = label.split('·')[0]?.trim().toUpperCase() ?? '';
  const entry = MOCK_REGION_DETAIL[key];
  if (entry) return { label, ...entry };
  return {
    label,
    events: [{ date: 'TODAY', headline: 'No timeline entries yet for this region.' }],
    etfs: [],
  };
}

/**
 * Streams live geo risk alerts as an AsyncIterable.
 * Yields each alert with a 1500–3000ms inter-yield gap, then ends.
 * B2-MD will replace this with a WebSocket or SSE connection.
 */
export async function* streamAlerts(): AsyncIterable<RiskAlert> {
  // Pull current alerts from the cached geo state (Gemini-grounded), then
  // emit them with a small gap so the LiveAlertCard "feels" like a stream.
  // Falls back to the inline mock array on backend failure.
  let alerts: RiskAlert[];
  try {
    const s = await fetchState();
    alerts = s.alerts.length > 0 ? s.alerts : MOCK_ALERTS;
  } catch {
    alerts = MOCK_ALERTS;
  }
  for (const alert of alerts) {
    const gap = 1500 + Math.random() * 1500;
    await new Promise<void>((r) => setTimeout(r, gap));
    yield alert;
  }
}
