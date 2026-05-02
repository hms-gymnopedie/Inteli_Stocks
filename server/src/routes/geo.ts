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
import { fetchQuoteSummary } from '../providers/yahoo.js';
import { TTLCache } from '../lib/cache.js';

export const geo = Router();

// ─── Types (mirror app/src/data/types.ts) ────────────────────────────────────

type RiskLevel = 'low' | 'med' | 'high';

interface MapPin {
  x: number; y: number; level: RiskLevel; label: string; value?: number; lat?: number; lng?: number;
}
type FlowLine = [number, number, number, number];
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
interface RegionETF { symbol: string; dayPct: string; direction: 1 | -1; }
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
  flows: [],
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

const FALLBACK_REGION: RegionDetail = {
  label: '—',
  events: [
    { date: '2026-04-30', headline: 'Recent geopolitical activity (no live source)' },
  ],
  etfs: [
    { symbol: 'EWZ', dayPct: '+0.0%', direction: 1 },
  ],
};

// ─── Endpoints ───────────────────────────────────────────────────────────────

geo.get('/state', async (_req: Request, res: Response) => {
  if (!grounded.isConfigured()) {
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
  "flows": [],                                               // empty for now
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

  res.json(result ?? FALLBACK_STATE);
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

geo.get('/region/:label', async (req: Request, res: Response) => {
  const label = String(req.params.label);
  if (!grounded.isConfigured()) {
    res.json({ ...FALLBACK_REGION, label });
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
    ...                          // 3-5 related ETFs / instruments
  ]
}

Output ONLY the JSON object.`,
  });

  res.json(result ?? { ...FALLBACK_REGION, label });
});
