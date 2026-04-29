// Domain types for InteliStock data layer.
// Phase 0: mock fetchers only. B2-MD will swap implementations.

// ─── Shared primitives ────────────────────────────────────────────────────────

/** Time range selector used across charts and fetchers. */
export type Range = '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y' | 'MAX';

/** Direction indicator: +1 = up, -1 = down. */
export type Direction = 1 | -1;

/** Generic risk severity level. */
export type RiskLevel = 'low' | 'med' | 'high';

/** Impact level for calendar events and filings. */
export type ImpactLevel = 'HIGH' | 'MED' | 'LOW';

// ─── Market data ──────────────────────────────────────────────────────────────

/** A single index / ticker strip entry. */
export interface Quote {
  ticker: string;
  price: string;
  change: string;
  direction: Direction;
}

/** A market index displayed in the IndicesStrip. */
export interface Index extends Quote {
  label: string;
}

/** A single OHLC candlestick bar. */
export interface OHLC {
  ts: number;       // unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Sector return item for SectorBars / SectorFlow. */
export interface SectorReturn {
  name: string;
  /** Percent return (e.g. 1.84 means +1.84%). */
  v: number;
}

/** S&P 500 constituent for HeatGrid. */
export interface Constituent {
  t: string;   // ticker symbol
  v: number;   // day percent change
}

/** Keys for macro indicators. */
export type MacroKey = 'US10Y' | 'CPI_YOY' | 'USD_KRW' | 'WTI';

/** A macro indicator card (MacroMonitor). */
export interface MacroIndicator {
  key: MacroKey;
  label: string;
  value: string;
  delta: string;
  /** Spark seed for chart rendering. */
  seed: number;
  /** Spark trend for chart rendering. */
  trend: number;
}

/** Fear & Greed gauge data. */
export interface FearGreed {
  value: number;
  label: string;
  yesterday: number;
  oneWeek: number;
  oneMonth: number;
}

/** An economic / earnings calendar event. */
export interface CalendarEvent {
  time: string;
  title: string;
  impact: ImpactLevel;
}

/** Session volume bar data (single bar). */
export interface VolumeBar {
  ts: number;   // unix ms
  volume: number;
}

/** Watchlist entry. */
export interface WatchlistEntry {
  code: string;
  name: string;
  change: string;
  /** Spark seed. */
  seed: number;
  direction: Direction;
}

/** Simple search result. */
export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

/** Portfolio summary KPIs. */
export interface PortfolioSummary {
  nav: number;
  navFormatted: string;
  dayChange: string;
  dayChangePct: string;
  ytd: string;
  oneYear: string;
  sharpe: number;
  exposure: string;
  exposureNote: string;
  riskScore: string;
  riskNote: string;
  drawdown: string;
  drawdownNote: string;
}

/** A single equity curve data point. */
export interface EquityPoint {
  ts: number;   // unix ms
  value: number;
}

/** Allocation category choice. */
export type AllocationBy = 'sector' | 'region' | 'asset';

/** A slice in the allocation bar chart. */
export interface AllocationSlice {
  name: string;
  /** Percent weight (0-100). */
  v: number;
}

/** A portfolio holding row. */
export interface Holding {
  symbol: string;
  name: string;
  weight: string;
  price: string;
  dayPct: string;
  plPct: string;
  /** Spark seed for 30-day trend. */
  sparkSeed: number;
  risk: number;
}

/** A past trade. */
export interface Trade {
  date: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  currency: string;
}

/** A risk factor decomposition entry. */
export interface RiskFactor {
  name: string;
  /** Beta / exposure value. */
  value: number;
  contribution: string;
}

// ─── Geo Risk ─────────────────────────────────────────────────────────────────

/** Region heat level for WorldMap fill. */
export type RegionHeat = Partial<Record<string, RiskLevel>>;

/** A map pin / event marker. */
export interface MapPin {
  x: number;
  y: number;
  level: RiskLevel;
  label: string;
}

/** A trade flow line between two SVG points. */
export type FlowLine = [number, number, number, number];

/** Complete risk map data passed to WorldMap. */
export interface RiskMapEntry {
  heat: RegionHeat;
  pins: MapPin[];
  flows: FlowLine[];
}

/** Global risk index. */
export interface GlobalRiskIndex {
  value: number;
  delta: number;
  period: string;
  note: string;
}

/** A geopolitical hotspot. */
export interface RiskHotspot {
  name: string;
  impact: string;
  level: RiskLevel;
  tickers: string;
}

/** A holding affected by geopolitical risk. */
export interface AffectedHolding {
  symbol: string;
  weight: string;
  scenarioPnl: string;
  direction: Direction;
}

/** A live geopolitical alert (streamed). */
export interface RiskAlert {
  id: string;
  level: RiskLevel;
  title: string;
  body: string;
  hedge: string;
}

/** A map layer toggle entry. */
export interface MapLayer {
  name: string;
  enabled: boolean;
}

// ─── Security / Detail ────────────────────────────────────────────────────────

/** Security profile (header info). */
export interface SecurityProfile {
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
  indices: string;
  price: number;
  priceFormatted: string;
  dayChange: string;
  dayChangePct: string;
  currency: string;
}

/** A fundamental metric. */
export interface Fundamental {
  label: string;
  value: string;
  /** Optional secondary note (e.g. sector median or "up"). */
  note?: string;
}

/** An SEC filing entry. */
export interface Filing {
  date: string;
  form: string;
  description: string;
  impact: RiskLevel;
}

/** Analyst price target distribution. */
export interface AnalystTarget {
  low: number;
  consensus: number;
  high: number;
  buys: number;
  holds: number;
  sells: number;
  currency: string;
}

/** A peer comparison row. */
export interface Peer {
  symbol: string;
  price: string;
  change: string;
  direction: Direction;
  /** Spark seed. */
  seed: number;
}

/** An earnings quarter entry. */
export interface Earnings {
  quarter: string;
  epsActual: number | null;
  epsEstimate: number;
  revenueActual: number | null;
  revenueEstimate: number;
}

/** IV surface data point (for options chain mini). */
export interface IVSurfacePoint {
  expiry: string;
  strike: number;
  iv: number;
}

// ─── AI ───────────────────────────────────────────────────────────────────────

/** Category tag for AI insights. */
export type AICategory = 'OPPORTUNITY' | 'RISK' | 'MACRO' | 'EARNINGS';

/** Tone for coloring insight cards. */
export type AITone = 'orange' | 'down' | 'fg';

/** An AI insight card (portfolio feed). */
export interface AIInsight {
  id: string;
  tag: AICategory;
  when: string;
  tone: AITone;
  title: string;
  body: string;
  actions: string[];
  risk: string;
  score: number;
}

/** An AI signal card (overview right panel). */
export interface AISignal {
  id: string;
  type: 'SIGNAL' | 'CAUTION' | 'INFO';
  when: string;
  body: string;
  tags: string[];
}

/** AI conviction breakdown axis. */
export interface ConvictionAxis {
  label: string;
  score: number;
  maxScore: number;
  color: 'up' | 'down' | 'accent';
}

/** Full AI investment verdict for a symbol. */
export interface AIVerdict {
  symbol: string;
  verdict: 'ACCUMULATE' | 'HOLD' | 'REDUCE' | 'AVOID';
  riskScore: number;
  convictionScore: number;
  summary: string;
  axes: ConvictionAxis[];
}

/** A hedge proposal from AI. */
export interface HedgeProposal {
  proposalId: string;
  description: string;
  expectedDrawdownTrim: string;
  actions: string[];
}
