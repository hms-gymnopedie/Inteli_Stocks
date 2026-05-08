/**
 * Tour step catalogues — B25.
 *
 * Each tour is an array of steps the Tour component walks the user through.
 * Selectors target `data-tour="..."` attributes on the live DOM, so adding
 * a new section to the dashboard is a matter of (1) tagging the wrapper
 * with data-tour and (2) appending a step here.
 */

import type { TourStep } from './Tour';

// ─── Per-page tours ─────────────────────────────────────────────────────────

export const TOUR_OVERVIEW: TourStep[] = [
  {
    selector: '[data-tour="ov-indices"]', route: '/overview',
    title: 'Indices strip',
    body: 'Live yahoo quotes for major indices (S&P, Nasdaq, Dow, KOSPI, KOSDAQ, VIX, US10Y, USD/KRW). Click any cell to navigate to that index\'s tradable proxy ETF (e.g. ^GSPC → SPY). Refreshes every 5 minutes via the yahoo cache.',
  },
  {
    selector: '[data-tour="ov-workspaces"]',
    title: 'Workspaces (left rail)',
    body: '6 quick-route shortcuts (Today\'s Brief / My Portfolio / Geo Risk / NVDA Detail / Leaderboard / AI Assistant). Active workspace highlights when its route is open.',
  },
  {
    selector: '[data-tour="ov-hero"]',
    title: 'HeroChart — S&P 500 intraday',
    body: 'Live yahoo OHLC. Range tabs 1D/1W/1M/3M/YTD/1Y/5Y trigger refetch (1D=5m bars, 1W=30m, longer=daily). Hover for OHLCV at any bar; click two times to pin A → B comparison anchors (chronologically ordered).',
  },
  {
    selector: '[data-tour="ov-macro"]',
    title: 'Macro Monitor',
    body: 'US10Y / USD-KRW / WTI from yahoo + CPI from FRED. Empty values show realistic seed (1,400 / +0.00%) until the first real fetch lands.',
  },
  {
    selector: '[data-tour="ov-aisignals"]',
    title: 'AI Signals (on-demand)',
    body: 'Click Generate to ask Anthropic Claude or Gemini for current market signal cards. Server persists to ~/.intelistock/ai-history.json (last 50) so cards stay populated across navigation. Token usage + estimated USD cost shown in footer.',
  },
  {
    selector: '[data-tour="ov-sentiment"]',
    title: 'Fear & Greed',
    body: 'Pulled live from CNN (production.dataviz.cnn.io). Headline gauge + 30-day trend chart with 5 zone bands (Extreme Fear 0-24 / Fear 25-44 / Neutral 45-55 / Greed 56-75 / Extreme Greed 76-100). Hover the chart for any day\'s value + zone.',
  },
  {
    selector: '[data-tour="ov-heat"]',
    title: 'Sector Heatmap',
    body: '50 well-known tickers grouped into 10 sectors (top-5 by market cap each), colored by today\'s % change from yahoo. Hover for ticker · sector · pct.',
  },
  {
    selector: '[data-tour="ov-flow"]',
    title: 'Sector Flow',
    body: '11 SPDR sector ETFs (XLK / XLE / XLF / etc.) with day return %. Sortable. Tracks rotation between sectors at a glance.',
  },
  {
    selector: '[data-tour="ov-events"]',
    title: 'Today\'s Events',
    body: 'Economic calendar from Finnhub /calendar/economic when FINNHUB_API_KEY is set; otherwise a static fallback. Filtered to US/KR/CN/EU.',
  },
  {
    selector: '[data-tour="ov-watchlist"]',
    title: 'Watchlist (KR)',
    body: 'Live yahoo quotes on .KS-suffixed Korean tickers. Add/remove via the Trades page (or directly via API).',
  },
  {
    selector: '[data-tour="ov-volume"]',
    title: 'Session Volume',
    body: 'Real S&P daily volume bars from yahoo /^GSPC historical (last 30 days). 3.9B – 6.1B range typical.',
  },
];

export const TOUR_PORTFOLIO: TourStep[] = [
  {
    selector: '[data-tour="pf-kpi"]', route: '/portfolio',
    title: 'KPI Strip',
    body: 'NAV (your baseline) + day change (Σ holding × yahoo dayPct) + YTD/1Y returns (real backtest curves) + Sharpe (annualized) + exposure (Σ holdings weight, rest = cash) + risk score (vol-bucket weighted) + max drawdown.',
  },
  {
    selector: '[data-tour="pf-equity"]',
    title: 'Equity Curve',
    body: 'Buy-and-hold backtest from your USD holdings × yahoo historicals, scaled to end at your NAV. 1D=5m intraday, 1W=30m, 1M+=daily closes. Hover crosshair + click-twice A→B comparison.',
  },
  {
    selector: '[data-tour="pf-allocation"]',
    title: 'Allocation',
    body: 'Toggle sector / region / asset. Sector reads yahoo assetProfile, region maps ticker suffix (.KS=Korea), asset uses yahoo quoteType. Cash slice always appended for any leftover (Σ weight < 100%).',
  },
  {
    selector: '[data-tour="pf-holdings"]',
    title: 'Holdings table',
    body: 'Live yahoo refresh on every read — price + dayPct + plPct (from BUY trade cost basis) + risk (volatility bucket 1-5). Sortable + filterable. + ADD opens an inline form with ticker autocomplete; ✕ deletes a row.',
  },
  {
    selector: '[data-tour="pf-trades"]',
    title: 'Trades log',
    body: 'Period chips (7D/30D/90D/All) + ticker filter. For the full add-trade form with rationale + sell triggers, jump to the Trades & Positions page.',
  },
  {
    selector: '[data-tour="pf-risk"]',
    title: 'Risk decomposition',
    body: '5 factors: Market beta (vs SPY), Rates duration (vs TLT β), Top sector concentration, FX exposure, High-vol tilt. Contribution = factor\'s share of true portfolio variance (covariance-aware).',
  },
  {
    selector: '[data-tour="pf-insights"]',
    title: 'AI Insights feed',
    body: 'On-demand AI insights tailored to your portfolio. Categories (OPP / RISK / MACRO / EARNINGS) chip-filterable. Persists in history so it survives navigation.',
  },
];

export const TOUR_POSITIONS: TourStep[] = [
  {
    selector: '[data-tour="pos-actions"]', route: '/positions',
    title: 'New Trade button',
    body: '+ New Trade opens a full form with ticker autocomplete. BUY trades require a reason and accept up to five optional sell triggers — any one fires a Slack alert when matched. ↻ Check triggers forces an immediate evaluation.',
  },
  {
    selector: '[data-tour="pos-active"]',
    title: 'Active rationales',
    body: 'Each card: ticker + entry price + live current price + P&L + held days. Trigger pills show the % distance to each target (urgent <2% glows orange). Cancel removes the rationale; the trade itself stays.',
  },
  {
    selector: '[data-tour="pos-trades"]',
    title: 'Recent trades',
    body: 'Full trade log with delete affordance. Each successful add/delete fires the Google Sheets mirror via localStore.write so your spreadsheet stays in sync.',
  },
];

export const TOUR_GEO: TourStep[] = [
  {
    selector: '[data-tour="geo-map"]', route: '/geo',
    title: 'World Risk Map',
    body: 'TopoJSON + d3-geo equal-earth projection. Heat (country fill) and pins come from Gemini grounded search (cached 6h). Drag to pan, scroll to zoom, click a pin to open the Region drawer with timeline + ETFs.',
  },
  {
    selector: '[data-tour="geo-index"]',
    title: 'Global Risk Index',
    body: 'Single 0-10 score with delta + 80-char rationale, also Gemini-grounded.',
  },
  {
    selector: '[data-tour="geo-alert"]',
    title: 'Live Alert',
    body: 'Most recent geopolitical alert with level + headline + body + suggested hedge. Streamed with 1.5-3s gap; auto-cycles through 3-5 alerts.',
  },
  {
    selector: '[data-tour="geo-layers"]',
    title: 'Layer toggles',
    body: 'Visual filters for the map (currently affects pin opacity).',
  },
  {
    selector: '[data-tour="geo-hotspots"]',
    title: 'Hotspots',
    body: '4-6 ranked regions with impact, level, and ticker exposures. Click to focus the map.',
  },
  {
    selector: '[data-tour="geo-affected"]',
    title: 'Affected portfolio',
    body: 'For each holding, scores ticker / sector / FX matches against current hotspots × level weight. Shows top 6 by weighted scenario impact. Energy holdings get +direction under Mid-East/Ukraine themes; everything else defaults to −.',
  },
  {
    selector: '[data-tour="geo-hedge"]',
    title: 'AI Hedge suggestion',
    body: 'On-demand AI hedge proposal with expected drawdown trim and concrete actions. Hydrates from history.',
  },
];

export const TOUR_DETAIL: TourStep[] = [
  {
    selector: '[data-tour="dt-header"]', route: '/detail/NVDA',
    title: 'Detail header',
    body: 'Logo (parqet.com CDN with monogram fallback) + symbol + sector + live price + day move + AI verdict pill (hydrates from /api/ai/history). + WATCHLIST adds the ticker; ⤴ TRADE opens an inline trade form.',
  },
  {
    selector: '[data-tour="dt-mainchart"]',
    title: 'Main price chart',
    body: 'Real yahoo OHLC bars now drive the chart (was synthetic before B23). Range tabs 1D-MAX. Studies (RSI / MACD / VOL) toggleable from the right.',
  },
  {
    selector: '[data-tour="dt-rsi"]',
    title: 'RSI(14)',
    body: 'Wilder RSI computed from yahoo closes; full series plotted. Latest value color: ≥70 down (overbought), ≤30 up (oversold), else accent.',
  },
  {
    selector: '[data-tour="dt-macd"]',
    title: 'MACD(12, 26, 9)',
    body: 'EMA-based MACD line + signal cross detection. Bars-since-cross indicator below.',
  },
  {
    selector: '[data-tour="dt-valuation"]',
    title: 'Valuation grid',
    body: '12 fundamental metrics from yahoo summaryDetail / financialData / defaultKeyStatistics. Hover for sector-median note where available.',
  },
  {
    selector: '[data-tour="dt-disclosures"]',
    title: 'SEC filings',
    body: 'Pulled from SEC EDGAR via /api/security/:symbol/filings. Up to 20 most recent filings. KR / non-US tickers return [] (EDGAR is US-only).',
  },
  {
    selector: '[data-tour="dt-aiguide"]',
    title: 'AI Investment Guide',
    body: 'On-demand verdict with 5-axis conviction breakdown (momentum / valuation / quality / sentiment / geo risk).',
  },
  {
    selector: '[data-tour="dt-targets"]',
    title: 'Analyst targets',
    body: 'Low / consensus / high price targets + buy/hold/sell distribution from yahoo financialData.',
  },
  {
    selector: '[data-tour="dt-peers"]',
    title: 'Peers',
    body: 'Same-sector comparables. KR / non-US falls back to a static MOCK_PEERS dictionary for known symbols.',
  },
  {
    selector: '[data-tour="dt-earnings"]',
    title: 'Earnings & guidance',
    body: 'Per-quarter bar pair (estimate vs actual, dashed orange for forward Q) + tabular history with surprise %.',
  },
  {
    selector: '[data-tour="dt-iv"]',
    title: 'Options chain mini (IV surface)',
    body: 'Real implied volatility from Finnhub option chain when FINNHUB_API_KEY is set. Heatmap rows=expiries × cols=strikes (ATM ± 30%). Without the key, falls back to a synthetic surface.',
  },
];

export const TOUR_LEADERBOARD: TourStep[] = [
  {
    selector: '[data-tour="lb-actions"]', route: '/leaderboard',
    title: 'New strategy',
    body: '+ New Strategy opens a row-based allocation builder with ticker autocomplete + weight inputs. Σ check + Normalize button. Submit triggers a real buy-and-hold backtest on yahoo historicals.',
  },
  {
    selector: '[data-tour="lb-table"]',
    title: 'Ranked table',
    body: 'Strategies sorted by total return desc. Click a row to expand its equity curve. Each row shows total / annualized return, sharpe, max DD, vs SPY benchmark, created date.',
  },
  {
    selector: '[data-tour="lb-overlay"]',
    title: 'Overlay chart',
    body: 'All strategies + SPY shown together with checkboxes to toggle visibility. 10-color palette so adjacent strategies visually separate.',
  },
];

export const TOUR_AI: TourStep[] = [
  {
    selector: '[data-tour="ai-header"]', route: '/ai-assistant',
    title: 'AI Assistant',
    body: 'Persistent history of every AI generation. ⚡ Generate All runs all 4 areas (Signals / Insights / Verdicts / Hedges) in parallel.',
  },
  {
    selector: '[data-tour="ai-tabs"]',
    title: 'Per-area tabs',
    body: '4 tabs for the 4 generators. Each tab shows a list of historical entries (newest first). + Generate {area} fires fresh generation; Re-run on each card replays it.',
  },
  {
    selector: '[data-tour="ai-usage"]',
    title: 'AI Usage panel (right)',
    body: 'Lifetime calls / tokens / estimated USD cost. Per-area breakdown bars. Last-30 calls token bar chart, color-coded by area. (est rates) badge appears when any call used preview/placeholder pricing.',
  },
];

export const TOUR_SETTINGS: TourStep[] = [
  {
    selector: '[data-tour="set-keys"]', route: '/settings',
    title: 'API Keys',
    body: 'All your provider keys in one place. Save rewrites .env at repo root + resets in-process clients so changes take effect without restart. Inputs masked.',
  },
  {
    selector: '[data-tour="set-export"]',
    title: 'Data Export',
    body: 'One-click download portfolio.json or holdings.csv.',
  },
  {
    selector: '[data-tour="set-refresh"]',
    title: 'Refresh interval',
    body: 'Sets the global polling cadence for live-data panels. Default 10 minutes; options Off / 30s / 1m / 5m / 10m / 30m / 1h.',
  },
  {
    selector: '[data-tour="set-models"]',
    title: 'AI Models',
    body: 'Pick provider + model per call. Per-1M-token pricing + ≈$/typical-call shown on each card. Active selection persists.',
  },
  {
    selector: '[data-tour="set-google"]',
    title: 'Google Drive Sync',
    body: 'OAuth installed-app flow. Connect once, then your portfolio mirrors to a Google Sheets file every time it changes (12 sheets append-only). Reset (clear + headers) wipes portfolio tabs and rewrites with fresh column headers.',
  },
  {
    selector: '[data-tour="set-tweaks"]',
    title: 'Display Tweaks',
    body: 'Chart style / map style / density / timezone / locale / currency / grid / accent color. Mirror of the corner Tweaks panel.',
  },
];

// ─── Master tour — walks the whole dashboard ──────────────────────────────

export const TOUR_MASTER: TourStep[] = [
  ...TOUR_OVERVIEW,
  ...TOUR_PORTFOLIO,
  ...TOUR_POSITIONS,
  ...TOUR_GEO,
  ...TOUR_DETAIL,
  ...TOUR_LEADERBOARD,
  ...TOUR_AI,
  ...TOUR_SETTINGS,
];

export const TOURS: Record<string, { label: string; steps: TourStep[] }> = {
  master:      { label: 'Full dashboard tour',   steps: TOUR_MASTER     },
  overview:    { label: 'Overview page',         steps: TOUR_OVERVIEW   },
  portfolio:   { label: 'Portfolio page',        steps: TOUR_PORTFOLIO  },
  positions:   { label: 'Trades & Positions',    steps: TOUR_POSITIONS  },
  geo:         { label: 'Geo Risk page',         steps: TOUR_GEO        },
  detail:      { label: 'Detail page',           steps: TOUR_DETAIL     },
  leaderboard: { label: 'Leaderboard page',      steps: TOUR_LEADERBOARD},
  ai:          { label: 'AI Assistant page',     steps: TOUR_AI         },
  settings:    { label: 'Settings page',         steps: TOUR_SETTINGS   },
};
