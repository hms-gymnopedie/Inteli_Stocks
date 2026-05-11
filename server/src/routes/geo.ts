/**
 * /api/geo/* — Gemini-grounded geopolitical risk data — B13-E6.
 *
 * Endpoints:
 *   GET /state             Full geo state (heat / hotspots / alerts / global
 *                          index / layers) in one shot — cached 6 h.
 *   GET /region/:label     Per-region timeline + related ETFs — cached 6 h.
 *
 * No free public API offers structured geopolitical risk data, so we ask
 * Gemini with web-search grounding for current events and parse the JSON
 * response. When GEMINI_API_KEY is missing we fall back to the existing
 * inline mocks (preserved here for graceful degrade).
 */

import { Router, type Request, type Response } from 'express';
import * as grounded from '../providers/gemini-grounded.js';
import { localStore } from '../storage/local.js';
import { fetchQuotes, fetchQuoteSummary } from '../providers/yahoo.js';
import { TTLCache } from '../lib/cache.js';
import {
  listSnapshots,
  snapshotIndex,
  type IndexSnapshot,
} from '../storage/geoIndex.js';

export const geo = Router();

// ─── Types (mirror app/src/data/types.ts) ────────────────────────────────────

type RiskLevel = 'low' | 'med' | 'high';

interface MapPin {
  x: number; y: number; level: RiskLevel; label: string; value?: number; lat?: number; lng?: number;
}
// FlowLine: [lng1, lat1, lng2, lat2, levelOpt?] — final number is level
// encoded as 1 (low) / 2 (med) / 3 (high); omitted means "med" colored.
// Width / color picked by the renderer from this level. Stays
// backwards-compatible with the legacy 4-tuple shape.
type FlowLine = [number, number, number, number] | [number, number, number, number, number];
interface RiskMapEntry {
  heat: Record<string, RiskLevel>;
  pins: MapPin[];
  flows: FlowLine[];
}
interface GlobalRiskIndex {
  value: number;
  delta: number;
  period: string;
  note: string;
}
interface RiskHotspot {
  name: string; impact: string; level: RiskLevel; tickers: string;
}
interface RiskAlert {
  id: string; level: RiskLevel; title: string; body: string; hedge: string;
}
interface MapLayer { name: string; enabled: boolean; }
interface RegionEvent { date: string; headline: string; }
interface RegionETF {
  symbol:   string;
  dayPct:   string;            // formatted, with sign
  direction: 1 | -1;
  currency?: string;           // yahoo currency code (USD/KRW/JPY/…)
  price?:    number;           // live regularMarketPrice
  name?:     string;           // short/long name
}
interface RegionDetail { label: string; events: RegionEvent[]; etfs: RegionETF[]; }

interface GeoState {
  heat:        Record<string, RiskLevel>;
  pins:        MapPin[];
  flows:       FlowLine[];
  hotspots:    RiskHotspot[];
  alerts:      RiskAlert[];
  layers:      MapLayer[];
  globalIndex: GlobalRiskIndex;
}

// ─── Fallback mocks (unchanged from frontend originals) ──────────────────────

const FALLBACK_STATE: GeoState = {
  heat: {
    UKR: 'high', RUS: 'high', ISR: 'high', PSE: 'high', IRN: 'high',
    TWN: 'high', CHN: 'med',  KOR: 'med',  USA: 'low',  GBR: 'low',
    DEU: 'low',  FRA: 'low',  JPN: 'low',  IND: 'med',  NGA: 'med',
  },
  pins: [
    { x: 525, y: 175, level: 'high', label: 'UA · WAR',     value: 7, lat: 50.45, lng: 30.52 },
    { x: 580, y: 220, level: 'high', label: 'IL · CONFLICT', value: 5, lat: 31.78, lng: 35.22 },
    { x: 615, y: 215, level: 'high', label: 'IR · TENSION',  value: 4, lat: 35.69, lng: 51.39 },
    { x: 800, y: 240, level: 'high', label: 'TW · TENSION',  value: 6, lat: 23.69, lng: 120.96 },
    { x: 815, y: 220, level: 'med',  label: 'KR · NK RISK',  value: 3, lat: 37.56, lng: 126.99 },
    { x: 245, y: 235, level: 'low',  label: 'US · ELECTION', value: 2, lat: 38.90, lng: -77.04 },
    { x: 555, y: 295, level: 'med',  label: 'NG · ENERGY',   value: 3, lat: 9.08,  lng: 8.68  },
  ],
  // 5-tuple flows: [fromLng, fromLat, toLng, toLat, level(1|2|3)]
  flows: [
    [-95,    38,    121,    23.7,  3], // US → TW (semis supply chain)
    [127,    37.5,  -95,    38,    2], // KR → US (memory exports)
    [ 53,    32,    31,     49,    3], // IR → UA (military/proxy)
    [  8.68,  9.08, 31,     49,    1], // NG → UA (energy substitution)
    [ 35.22, 31.78, 53,     32,    2], // IL → IR
  ],
  hotspots: [
    { name: 'TW Strait', impact: 'Semis supply 40% global', level: 'high', tickers: 'TSM, ASML, NVDA, AMD' },
    { name: 'Red Sea',   impact: 'Oil + container shipping', level: 'high', tickers: 'MAERSK, COSCO, XOM' },
    { name: 'Ukraine',   impact: 'Grain + energy',           level: 'high', tickers: 'WEAT, TTF=F, BG' },
    { name: 'Iran',      impact: 'Crude futures',            level: 'med',  tickers: 'CL=F, BP, SHEL' },
    { name: 'Korea',     impact: 'Memory + display',         level: 'med',  tickers: '005930.KS, 000660.KS' },
  ],
  alerts: [
    { id: 'a1', level: 'high', title: 'Taiwan Strait — PLA exercises', body: 'PLA Eastern Theater Command announces island encirclement drills.', hedge: 'Trim semi-cap exposure' },
    { id: 'a2', level: 'med',  title: 'Korean Peninsula — missile test', body: 'DPRK fires short-range ballistic missile into Sea of Japan.', hedge: 'Watch KOSPI futures' },
    { id: 'a3', level: 'high', title: 'Ukraine — energy infrastructure', body: 'Strikes on energy grid ahead of winter heating demand.',  hedge: 'TTF=F long, EUR/USD short' },
  ],
  layers: [
    { name: 'WAR / CONFLICT',  enabled: true  },
    { name: 'TRADE TENSION',   enabled: true  },
    { name: 'SUPPLY CHAIN',    enabled: false },
    { name: 'POLITICAL RISK',  enabled: false },
  ],
  globalIndex: {
    value: 6.4, delta: 0.3, period: '24H', note: 'TW exercises + UA strikes',
  },
};

/**
 * Per-ISO-2 region fallback details. Server uses these when Gemini is
 * not configured or returns nothing, so the drawer always has real
 * events + relevant ETFs instead of a single placeholder row.
 * Yahoo enrichment in enrichRegionETFs() overlays live dayPct/currency
 * on top of these symbols.
 */
const FALLBACK_REGION_DETAIL: Record<string, Omit<RegionDetail, 'label'>> = {
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
  CN: {
    events: [
      { date: '26 APR', headline: 'PBoC drains liquidity via reverse repo; yuan steady' },
      { date: '22 APR', headline: 'Property sector measures expanded to 30 more cities' },
      { date: '18 APR', headline: 'Q1 GDP +5.3% YoY beats consensus; retail sales lag' },
      { date: '12 APR', headline: 'US-China commerce talks resume; tariff threat eased' },
    ],
    etfs: [
      { symbol: 'FXI',  dayPct: '−0.3%', direction: -1 },
      { symbol: 'KWEB', dayPct: '+0.8%', direction:  1 },
      { symbol: 'MCHI', dayPct: '+0.4%', direction:  1 },
      { symbol: 'EWH',  dayPct: '+0.2%', direction:  1 },
    ],
  },
};

const FALLBACK_REGION_GENERIC: Omit<RegionDetail, 'label'> = {
  events: [
    { date: 'TODAY', headline: 'No detailed timeline on file for this region — showing market proxies.' },
  ],
  etfs: [
    { symbol: 'SPY', dayPct: '+0.0%', direction: 1 },
    { symbol: 'GLD', dayPct: '+0.0%', direction: 1 },
    { symbol: 'TLT', dayPct: '+0.0%', direction: 1 },
  ],
};

/** Look up the per-region template by ISO-2 prefix (e.g. "TW · TENSION" → "TW"). */
function regionFallbackFor(label: string): RegionDetail {
  const key = label.split('·')[0]?.trim().toUpperCase() ?? '';
  const entry = FALLBACK_REGION_DETAIL[key] ?? FALLBACK_REGION_GENERIC;
  return { label, ...entry };
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

geo.get('/state', async (_req: Request, res: Response) => {
  if (!grounded.isConfigured()) {
    snapshotIndex(FALLBACK_STATE.globalIndex.value, FALLBACK_STATE.globalIndex.note);
    res.json(FALLBACK_STATE);
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const result = await grounded.askJSON<GeoState>({
    cacheKey:   `geo-state:${today}`,
    cacheTtlMs: 6 * 60 * 60 * 1000,
    maxOutputTokens: 2048,
    prompt: `Today is ${today}. Search the web for the current state of major geopolitical
risks affecting global markets, then return a SINGLE JSON object with this
exact shape, no markdown fences or commentary:

{
  "heat": { "<ISO-3>": "low"|"med"|"high", ... },          // 10-15 countries
  "pins": [
    { "x":0,"y":0,"level":"low"|"med"|"high","label":"CC · TOPIC","value":<1-9>,"lat":<deg>,"lng":<deg> },
    ...                                                     // 5-10 pins
  ],
  "flows": [
    [<fromLng>, <fromLat>, <toLng>, <toLat>, <level 1|2|3>], // 3-6 lines
    ...                                                     // economic / supply-chain / military links between hotspot countries; level: 1=watch 2=tension 3=crisis
  ],
  "hotspots": [
    { "name":"<region>", "impact":"<≤60 char description>", "level":"low|med|high", "tickers":"AAA, BBB, CCC" },
    ...                                                     // 4-6 hotspots
  ],
  "alerts": [
    { "id":"a1", "level":"low|med|high", "title":"<≤60 char>", "body":"<1-2 sentences>", "hedge":"<short hedge action>" },
    ...                                                     // 3-5 alerts
  ],
  "layers": [
    { "name":"WAR / CONFLICT","enabled":true },
    { "name":"TRADE TENSION","enabled":true },
    { "name":"SUPPLY CHAIN","enabled":false },
    { "name":"POLITICAL RISK","enabled":false }
  ],
  "globalIndex": { "value":<0-10>, "delta":<signed>, "period":"24H", "note":"<≤80 char rationale>" }
}

Pin x/y are SVG viewBox coords on a 1000×500 equal-earth projection — use
lat/lng as the source of truth and approximate x/y from the projection.
Use ISO 3166-1 alpha-3 country codes for "heat" keys (UKR, ISR, TWN, etc.).
Keep tickers comma-separated and uppercase. Output ONLY the JSON object.`,
  });

  const state = result ?? FALLBACK_STATE;
  // Append a snapshot of the global risk index so /index-trail can render
  // a sparkline of where it's been over the last 1D/1W/1M. Throttled to
  // 6h gaps inside snapshotIndex(), matching the Gemini cache TTL.
  snapshotIndex(state.globalIndex.value, state.globalIndex.note);
  res.json(state);
});

// ─── /index-trail — sparkline data for GlobalRiskIndex ───────────────────────

const TRAIL_WINDOWS_MS: Record<string, number> = {
  '1D':  24 * 60 * 60 * 1000,
  '1W':   7 * 24 * 60 * 60 * 1000,
  '1M':  30 * 24 * 60 * 60 * 1000,
};

geo.get('/index-trail', (req: Request, res: Response): void => {
  const range = String(req.query.range ?? '1W').toUpperCase();
  const windowMs = TRAIL_WINDOWS_MS[range] ?? TRAIL_WINDOWS_MS['1W'];
  const snapshots: IndexSnapshot[] = listSnapshots(windowMs);
  res.json({ range, snapshots });
});

// ─── /affected — Holdings exposed to current geo hotspots ──────────────────

interface AffectedHolding {
  symbol: string;
  weight: string;
  scenarioPnl: string;
  direction: 1 | -1;
}

const _sectorCache = new TTLCache<string>(6 * 60 * 60 * 1000);

async function lookupSector(symbol: string): Promise<string> {
  return _sectorCache.get(symbol, async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = (await fetchQuoteSummary(symbol, ['assetProfile'])) as any;
      return (typeof r?.assetProfile?.sector === 'string' && r.assetProfile.sector.trim())
        ? r.assetProfile.sector
        : '';
    } catch {
      return '';
    }
  });
}

function detectCurrency(symbol: string): string {
  const u = symbol.toUpperCase();
  if (u.endsWith('.KS') || u.endsWith('.KQ')) return 'KRW';
  if (u.endsWith('.T'))                       return 'JPY';
  if (u.endsWith('.HK'))                      return 'HKD';
  if (u.endsWith('.L'))                       return 'GBP';
  if (u.endsWith('.TO'))                      return 'CAD';
  if (u.endsWith('.AX'))                      return 'AUD';
  return 'USD';
}

/**
 * Pulls the current geo state, then matches each user holding against
 * hotspot tickers / sector keywords / region currency. Each match yields
 * an AffectedHolding row whose scenarioPnl scales with hotspot level
 * (low: ±1-3%, med: ±3-7%, high: ±7-15%) and direction defaults to -1
 * (geopolitical events typically hurt exposed names).
 *
 * Returns top 6 by absolute weight × |scenario| so the panel surfaces the
 * highest-conviction lines.
 */
geo.get('/affected', async (_req: Request, res: Response) => {
  try {
    const store = await localStore.read(null);
    const usd = store.holdings.filter((h) => h.weight && parseFloat(h.weight) > 0);
    if (usd.length === 0) { res.json([]); return; }

    // Pull geo state from the same Gemini-grounded cache; if the cache
    // miss / parse fail returned no hotspots, use FALLBACK_STATE so the
    // affected panel still computes against current geopolitical themes.
    const today = new Date().toISOString().slice(0, 10);
    type Hotspot = { name: string; level: 'low' | 'med' | 'high'; tickers: string };
    const state = await grounded.askJSON<{ hotspots: Hotspot[] }>({
      cacheKey: `geo-state:${today}`,
      cacheTtlMs: 6 * 60 * 60 * 1000,
      prompt: 'no-op (cached)',
    });
    const hotspots: Hotspot[] = state?.hotspots && state.hotspots.length > 0
      ? state.hotspots
      : FALLBACK_STATE.hotspots;
    if (hotspots.length === 0) { res.json([]); return; }

    // Pull sector for each holding.
    const enriched = await Promise.all(usd.map(async (h) => ({
      symbol:   h.symbol,
      weight:   h.weight,
      currency: detectCurrency(h.symbol),
      sector:   await lookupSector(h.symbol),
    })));

    // Score each holding × hotspot pair. The strongest match per holding
    // becomes its row.
    const out: AffectedHolding[] = [];
    for (const h of enriched) {
      let bestScore = 0;
      let bestLevel: 'low' | 'med' | 'high' = 'low';
      for (const hs of hotspots) {
        const tickerHit = hs.tickers
          .split(/[\s,]+/)
          .map((t) => t.trim().toUpperCase())
          .some((t) => t && h.symbol.toUpperCase().includes(t));
        const sectorHit = (() => {
          const s = h.sector.toLowerCase();
          const n = hs.name.toLowerCase();
          if (!s) return false;
          // Cross-reference: hotspot name vs sector keyword.
          if (s.includes('technology')   && /(semi|tech|tw|ai|chip)/.test(n)) return true;
          if (s.includes('energy')       && /(red sea|iran|ukraine|crude|oil)/.test(n)) return true;
          if (s.includes('financial')    && /trade tension/.test(n)) return true;
          return false;
        })();
        const fxHit = (h.currency === 'KRW' && /korea|kr/i.test(hs.name))
                   || (h.currency === 'EUR' && /(eu|ukraine)/i.test(hs.name));

        let score = 0;
        if (tickerHit) score += 3;
        if (sectorHit) score += 2;
        if (fxHit)     score += 1;

        const levelWeight = hs.level === 'high' ? 3 : hs.level === 'med' ? 2 : 1;
        const total = score * levelWeight;
        if (total > bestScore) {
          bestScore = total;
          bestLevel = hs.level;
        }
      }
      if (bestScore === 0) continue;
      // Scenario P&L scales with level. Negative by default (geopolitical
      // shock hurts exposed names); rare positive cases (e.g. energy on
      // Mid-East tension) handled by future heuristics.
      const magnitude = bestLevel === 'high' ? 8 + (bestScore % 5) * 1.4
                      : bestLevel === 'med'  ? 4 + (bestScore % 3) * 1.0
                      :                        2 + (bestScore % 2) * 0.6;
      // Energy sector under Mid-East / Ukraine tension is typically positive.
      const isEnergyUp = h.sector.toLowerCase().includes('energy');
      const direction: 1 | -1 = isEnergyUp ? 1 : -1;
      const sign = direction > 0 ? '+' : '−';
      out.push({
        symbol:      h.symbol,
        weight:      h.weight,
        scenarioPnl: `${sign}${magnitude.toFixed(1)}%`,
        direction,
      });
    }

    // Sort by |scenario| × parsed weight, take top 6.
    const ranked = out
      .map((a) => {
        const w = parseFloat(a.weight) || 0;
        const m = Math.abs(parseFloat(a.scenarioPnl)) || 0;
        return { row: a, score: w * m };
      })
      .sort((x, y) => y.score - x.score)
      .slice(0, 6)
      .map((x) => x.row);
    res.json(ranked);
  } catch (err) {
    console.error('[geo/affected]', err);
    res.json([]);
  }
});

/**
 * Overwrite the model-supplied dayPct/direction with live yahoo quotes so
 * the drawer always shows current numbers — Gemini's price hint is best
 * thought of as a yesterday's snapshot.
 * Adds currency + name + live price too.
 */
async function enrichRegionETFs(detail: RegionDetail): Promise<RegionDetail> {
  if (!Array.isArray(detail.etfs) || detail.etfs.length === 0) return detail;
  const symbols = detail.etfs.map((e) => e.symbol).filter(Boolean);
  if (symbols.length === 0) return detail;
  let quotes: Awaited<ReturnType<typeof fetchQuotes>> = [];
  try {
    quotes = await fetchQuotes(symbols);
  } catch {
    // Best-effort — if yahoo errors, leave the model-supplied values.
    return detail;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qMap = new Map<string, any>(quotes.map((q: any) => [String(q?.symbol).toUpperCase(), q]));
  const enriched: RegionETF[] = detail.etfs.map((e) => {
    const q = qMap.get(e.symbol.toUpperCase());
    if (!q) return e;
    const chp = typeof q.regularMarketChangePercent === 'number'
      ? q.regularMarketChangePercent
      : null;
    const px = typeof q.regularMarketPrice === 'number'
      ? q.regularMarketPrice
      : undefined;
    const dayPct = chp != null
      ? `${chp >= 0 ? '+' : '−'}${Math.abs(chp).toFixed(2)}%`
      : e.dayPct;
    const direction: 1 | -1 = chp != null
      ? (chp >= 0 ? 1 : -1)
      : (e.direction ?? 1);
    return {
      symbol:   e.symbol,
      dayPct,
      direction,
      price:    px,
      currency: typeof q.currency === 'string' ? q.currency : undefined,
      name:     (q.shortName ?? q.longName) || undefined,
    };
  });
  return { ...detail, etfs: enriched };
}

geo.get('/region/:label', async (req: Request, res: Response) => {
  const label = String(req.params.label);
  if (!grounded.isConfigured()) {
    res.json(await enrichRegionETFs(regionFallbackFor(label)));
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const result = await grounded.askJSON<RegionDetail>({
    cacheKey:   `geo-region:${label}:${today}`,
    cacheTtlMs: 6 * 60 * 60 * 1000,
    maxOutputTokens: 1024,
    prompt: `Today is ${today}. Search the web for current events relevant to the geopolitical
hotspot labeled "${label}" (this is a ticker-style code like "UA · WAR" or
"TW · TENSION"). Return a JSON object with this exact shape, no markdown:

{
  "label": "${label}",
  "events": [
    { "date":"YYYY-MM-DD", "headline":"<≤90 char headline>" },
    ...                          // 3-5 most recent events
  ],
  "etfs": [
    { "symbol":"<TICKER>", "dayPct":"<+1.2% or −0.4%>", "direction":1|-1 },
    ...                          // 3-5 related ETFs / instruments — yahoo-tradable, not OTC
  ]
}

Output ONLY the JSON object.`,
  });

  // If Gemini didn't return anything useful (timeout / parse fail / sparse
  // events) fall back to the per-ISO-2 template so the drawer never lands
  // with just one placeholder row.
  const merged: RegionDetail = (() => {
    if (!result) return regionFallbackFor(label);
    const tpl = regionFallbackFor(label);
    return {
      label,
      events: (Array.isArray(result.events) && result.events.length > 0) ? result.events : tpl.events,
      etfs:   (Array.isArray(result.etfs)   && result.etfs.length   > 0) ? result.etfs   : tpl.etfs,
    };
  })();
  res.json(await enrichRegionETFs(merged));
});
