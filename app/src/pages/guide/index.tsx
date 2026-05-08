/**
 * /guide — Dashboard onboarding & reference (B24).
 *
 * Single-scroll comprehensive guide: what each page does, where the data
 * comes from, how often it refreshes. Sticky TOC on the left jumps to
 * any section. All anchors use a stable `id` so cross-page links work too.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTour } from '../../lib/TourContext';
import { TOURS } from '../../lib/tours';

// ─── TOC structure ──────────────────────────────────────────────────────────

interface TocSection { id: string; label: string }
interface TocGroup   { label: string; items: TocSection[] }

const TOC: TocGroup[] = [
  { label: 'Start here', items: [
    { id: 'welcome',   label: 'Welcome' },
    { id: 'setup',     label: 'Setup checklist' },
    { id: 'sources',   label: 'Data sources' },
    { id: 'cadence',   label: 'Refresh cadence' },
  ]},
  { label: 'Pages', items: [
    { id: 'page-overview',     label: 'Overview' },
    { id: 'page-portfolio',    label: 'Portfolio' },
    { id: 'page-positions',    label: 'Trades & Positions' },
    { id: 'page-geo',          label: 'Geo Risk' },
    { id: 'page-detail',       label: 'Detail (per-stock)' },
    { id: 'page-leaderboard',  label: 'Leaderboard' },
    { id: 'page-ai-assistant', label: 'AI Assistant' },
    { id: 'page-settings',     label: 'Settings' },
  ]},
  { label: 'Background services', items: [
    { id: 'svc-cron',     label: 'Cron jobs' },
    { id: 'svc-slack',    label: 'Slack alerts' },
    { id: 'svc-sheets',   label: 'Google Sheets sync' },
    { id: 'svc-positions',label: 'Sell-trigger eval' },
  ]},
  { label: 'FAQ', items: [
    { id: 'faq-mock',     label: 'Is anything still mock?' },
    { id: 'faq-cost',     label: 'How much does AI cost me?' },
    { id: 'faq-tz',       label: 'Timezone & formatting' },
  ]},
];

// ─── Page ───────────────────────────────────────────────────────────────────

export function Guide() {
  const [active, setActive] = useState<string>('welcome');

  // Highlight the TOC entry whose section is currently in viewport.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          // Pick the topmost.
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 },
    );
    document.querySelectorAll<HTMLElement>('[data-guide-section]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="guide-layout">
      {/* TOC */}
      <nav className="guide-toc" aria-label="Guide table of contents">
        {TOC.map((g) => (
          <div key={g.label} className="guide-toc-group">
            <div className="guide-toc-h">{g.label}</div>
            {g.items.map((it) => (
              <a
                key={it.id}
                href={`#${it.id}`}
                className={'guide-toc-item' + (active === it.id ? ' active' : '')}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(it.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                {it.label}
              </a>
            ))}
          </div>
        ))}
      </nav>

      {/* Main content */}
      <main className="guide-content">
        {/* === Welcome === */}
        <Section id="welcome" title="Welcome to InteliStock">
          <p>
            <strong>InteliStock</strong> is a single-tenant local stock dashboard built on a
            React + Vite frontend (port 5180) and Express + Node backend (port 3001).
            Data is real wherever a free API exists; everything that's still synthetic is
            documented below so you know exactly what's a number vs a placeholder.
          </p>
          <p>
            Run <code>npm run dev</code> from the repo root to start both services.
            The dashboard refreshes live data on a polling cadence you control in
            <Link to="/settings"> Settings</Link>.
          </p>
          <TourLauncher />
        </Section>

        {/* === Setup === */}
        <Section id="setup" title="Setup checklist">
          <p>Most of the dashboard works out-of-the-box (yahoo doesn't need a key).
          For the AI features and ancillary data, set the keys below in
          <Link to="/settings"> Settings → API Keys</Link>:</p>
          <Table headers={['Key', 'Required for', 'Where to get']} rows={[
            ['ANTHROPIC_API_KEY',     'Claude AI calls (verdict, hedge, signals, insights)',  'console.anthropic.com'],
            ['GEMINI_API_KEY',        'Gemini AI + Geo grounded + F&G fallback',              'aistudio.google.com/app/apikey (free tier)'],
            ['FRED_API_KEY',          'Macro indicators (CPI, Fed Funds rate)',               'fred.stlouisfed.org/docs/api/api_key.html'],
            ['FINNHUB_API_KEY',       'Economic calendar + option chain (IV surface)',        'finnhub.io/register (free tier 60/min)'],
            ['SLACK_WEBHOOK_URL',     'Sell-trigger + portfolio alerts to Slack',             'api.slack.com/apps → Incoming Webhooks'],
            ['GOOGLE_CLIENT_ID/SECRET','Google Sheets append-only mirror',                     'console.cloud.google.com/apis/credentials'],
          ]} />
          <p className="muted">
            Anything not configured shows a graceful fallback — the dashboard never blanks
            out, but you'll see synthetic / mock placeholders until keys are filled in.
          </p>
        </Section>

        {/* === Data sources === */}
        <Section id="sources" title="Data sources">
          <Table headers={['Source', 'What it provides', 'Free tier?']} rows={[
            ['yahoo-finance2',     'Quotes, OHLC, fundamentals, search, sectors, profiles', 'Yes (no key, ~unlimited)'],
            ['CNN F&G (unofficial)', 'Fear & Greed index headline + daily history',         'Yes (browser headers required)'],
            ['FRED',               'CPI, Fed Funds rate, macro time series',                 'Yes (key, near-unlimited)'],
            ['Finnhub',            'Economic calendar, option chain, news sentiment',        'Yes (60 req/min)'],
            ['SEC EDGAR',          'Company filings (8-K, 10-Q, etc.) for US tickers',       'Yes (User-Agent required)'],
            ['Anthropic Claude',   'AI signals/insights/verdict/hedge generation',           'Paid (token billing)'],
            ['Google Gemini',      'AI generation + Web-grounded geo & F&G fallback',        'Free tier with rate limits'],
            ['Google Sheets API',  'Append-only mirror of portfolio + AI history',           'Yes (OAuth, free quota)'],
            ['Slack Webhooks',     'Outbound alerts (sell trigger, portfolio thresholds)',   'Yes (no SDK needed)'],
          ]} />
        </Section>

        {/* === Refresh cadence === */}
        <Section id="cadence" title="Refresh cadence">
          <p>Two layers:</p>
          <ul>
            <li>
              <strong>Frontend polling</strong> — every panel using <code>useAsync</code> re-fetches at
              the interval set in <Link to="/settings">Settings → Refresh Interval</Link>.
              Default <strong>10 minutes</strong>; options Off / 30s / 1m / 5m / 10m / 30m / 1h.
              Polling pauses while the tab is hidden.
            </li>
            <li>
              <strong>Backend yahoo cache</strong> — quote calls cached <strong>5 min</strong>,
              historicals + fundamentals <strong>10 min</strong>. So even if the frontend asks
              every 30 s, yahoo only sees a real call every 5 min.
            </li>
          </ul>
          <p>Background services run on cron (see <a href="#svc-cron">Cron jobs</a>).</p>
        </Section>

        {/* === Pages: Overview === */}
        <Section id="page-overview" title="Overview" route="/overview">
          <Panel name="Indices strip (top)" source="yahoo-finance2 quote() for ^GSPC, ^IXIC, ^DJI, ^KS11, ^KQ11, ^VIX, ^TNX, KRW=X" cadence="Frontend poll · 5min yahoo cache">
            Click any index to navigate to its tradable proxy ETF (e.g. ^GSPC → SPY)
            so the Detail page can render real data — index symbols themselves don't
            have OHLC for funds.
          </Panel>
          <Panel name="Workspaces (left rail)" source="Static — six route shortcuts" cadence="—">
            Quick links to /overview, /portfolio, /geo, /detail/NVDA, /leaderboard, /ai-assistant.
          </Panel>
          <Panel name="HeroChart (center)" source="yahoo intraday OHLC for ^GSPC via /api/market/intraday" cadence="Frontend poll · 5min yahoo cache">
            Range tabs 1D/1W/1M/3M/YTD/1Y/5Y trigger refetch. 1D uses 5-min bars,
            1W uses 30-min bars, longer ranges use daily closes. Hover crosshair shows
            OHLCV at any point. Click twice to pin two anchors A/B for percent-change
            comparison (chronologically ordered regardless of click order).
          </Panel>
          <Panel name="Macro Monitor" source="yahoo (US10Y, USD/KRW, WTI) + FRED (CPI YoY)" cadence="Frontend poll · 5min yahoo / 1h FRED cache">
            FRED CPI requires <code>FRED_API_KEY</code>. Without it, falls back to a
            recent hardcoded value flagged in code.
          </Panel>
          <Panel name="AI Signals (right)" source="Anthropic Claude or Gemini (configurable)" cadence="On-demand — click Generate">
            Server-streamed SSE; results persist server-side at
            <code>~/.intelistock/ai-history.json</code> (last 50 per area) so the
            cards stay populated across navigation. Token usage + estimated cost
            shown in the footer.
          </Panel>
          <Panel name="Sentiment (Fear &amp; Greed)" source="CNN production.dataviz.cnn.io (browser headers required) → Gemini grounded → synthetic ramp" cadence="6h backend cache · 10min frontend">
            5 zone bands: Extreme Fear (0-24), Fear (25-44), Neutral (45-55),
            Greed (56-75), Extreme Greed (76-100). 30-day trend chart with hover.
            CNN's unofficial JSON is the primary source; Gemini grounded is the
            fallback for the headline; synthetic ramp the last resort.
          </Panel>
          <Panel name="Sector Heatmap" source="Static SP_CONSTITUENTS list (50 well-known tickers) × yahoo quotes" cadence="Frontend poll · 5min yahoo cache">
            10 sectors × top-5 tickers each, by market cap. Cell color = today's
            % change. Hover tooltip shows ticker · sector · pct.
          </Panel>
          <Panel name="Sector Flow" source="yahoo via /api/market/sectors (XLK/XLE/XLF/...)" cadence="Frontend poll · 5min yahoo cache">
            11 SPDR sector ETFs with day return %. Sortable by absolute or relative.
          </Panel>
          <Panel name="Watchlist" source="yahoo quote on ${code}.KS for KR codes" cadence="Frontend poll · 5min yahoo cache">
            Live Korean watchlist (Samsung, SK Hynix, etc.). Add/remove via
            <Link to="/positions"> Trades</Link> page or future watchlist UI.
          </Panel>
          <Panel name="Session Volume" source="yahoo /^GSPC historical 1M, last 30 daily volumes" cadence="Frontend poll · 10min yahoo cache">
            Real S&P 500 daily volume bars (was synthetic before B15-4).
          </Panel>
          <Panel name="Today's Events" source="Finnhub /calendar/economic when key set, else static fallback" cadence="1h backend cache · 10min frontend">
            8 events filtered to US/KR/CN/EU. Without <code>FINNHUB_API_KEY</code>
            you see a static 4-event placeholder.
          </Panel>
        </Section>

        {/* === Pages: Portfolio === */}
        <Section id="page-portfolio" title="Portfolio" route="/portfolio">
          <Panel name="KPI Strip" source="/api/portfolio/summary — recomputed live" cadence="Frontend poll · server recompute on every read">
            <ul>
              <li>NAV — your configured baseline ($1,284,420 from seed; edit by PATCH summary)</li>
              <li>Day change/% — Σ (holding weight × yahoo dayPct)</li>
              <li>YTD / 1Y — total return % from real equity-curve over those windows</li>
              <li>Sharpe — 1Y annualized (mean / σ × √252)</li>
              <li>Exposure — Σ holdings weight (rest = cash)</li>
              <li>Risk score — weighted avg of per-holding volatility bucket (1-5)</li>
              <li>Drawdown — max peak-to-trough on 1Y curve</li>
            </ul>
          </Panel>
          <Panel name="Equity Curve" source="Buy-and-hold backtest: holdings × yahoo historicals, scaled to NAV" cadence="Frontend poll · 10min yahoo cache">
            Range tabs use intraday bars for 1D/1W (5m / 30m), daily closes for
            1M+. Hover crosshair shows date + NAV. Click twice for A→B
            comparison (chronologically ordered).
          </Panel>
          <Panel name="Allocation" source="holdings × yahoo metadata" cadence="Frontend poll · 6h sector cache">
            Toggle sector / region / asset:
            <ul>
              <li>Sector — yahoo <code>assetProfile.sector</code></li>
              <li>Region — ticker suffix (.KS=Korea, no suffix=US, etc.)</li>
              <li>Asset — yahoo <code>quoteType</code> (Equities / ETFs / Crypto)</li>
            </ul>
            Cash slice always appended for any leftover (Σ weight &lt; 100%).
          </Panel>
          <Panel name="Holdings table" source="/api/portfolio/holdings — yahoo refresh per request" cadence="Frontend poll · 5min yahoo cache">
            Columns: ticker / name / weight / price (live) / day% (live) / P/L%
            (computed from BUY trades cost basis when available) / 30d trend
            sparkline / risk (volatility 1Y σ × √252 bucketed 1-5).
            <code>+ ADD</code> button + per-row delete.
          </Panel>
          <Panel name="Trades log" source="~/.intelistock/portfolio.json trades array" cadence="Append on each trade · static otherwise">
            Period chips (7D / 30D / 90D / All) + ticker filter. Use the dedicated
            <Link to="/positions"> Trades</Link> page for the full add-trade form.
          </Panel>
          <Panel name="Risk decomposition" source="computed from holdings × yahoo (returns, sectors, currencies)" cadence="1h returns cache · 6h sector cache">
            5 factors:
            <ul>
              <li>Market beta (SPY) — portfolio's daily-returns regression vs SPY</li>
              <li>Rates duration (TLT β)</li>
              <li>Top sector concentration</li>
              <li>FX exposure (largest non-USD currency)</li>
              <li>High-vol tilt (weight in σ ≥ 35% buckets)</li>
            </ul>
            <code>contribution</code> = factor's share of true portfolio variance
            (covariance-aware).
          </Panel>
          <Panel name="AI Insights feed" source="Anthropic / Gemini · history hydrated on mount" cadence="On-demand">
            Server-side history at <code>~/.intelistock/ai-history.json</code>;
            categories (OPP / RISK / MACRO / EARNINGS) chip-filtered.
          </Panel>
        </Section>

        {/* === Pages: Positions === */}
        <Section id="page-positions" title="Trades & Positions" route="/positions">
          <p>
            Buy / sell management as a first-class tab. Created via the <code>+ New
            Trade</code> form; BUY trades require a reason and accept up to five
            optional sell triggers (any one fires a Slack alert).
          </p>
          <Panel name="New Trade form" source="user input · ticker autocomplete uses yahoo search" cadence="—">
            Ticker autocomplete shows top-8 matches, fills price/currency from the
            selected ticker's yahoo profile. BUY-only sections: rationale (required)
            + 5 trigger inputs with clickable preset chips (e.g. +20% target / −10%
            stop). Triggers stored in <code>~/.intelistock/positions.json</code>.
          </Panel>
          <Panel name="Active rationales" source="positions.json + live yahoo quote" cadence="Live quote on render · cron eval hourly">
            Each card shows entry price, current price, P&L, held days, and each
            trigger as a pill with the % distance from current price to its target.
          </Panel>
          <Panel name="Recent trades / Closed positions" source="positions.json + portfolio.json trades array" cadence="Append on action">
            Closed = a sell trigger has fired. Cancel button removes a rationale
            without affecting the underlying trade.
          </Panel>
        </Section>

        {/* === Pages: Geo === */}
        <Section id="page-geo" title="Geo Risk" route="/geo">
          <Panel name="World Map" source="TopoJSON (countries-110m.json) + Gemini grounded heat/pins" cadence="6h Gemini cache">
            d3-geo equal-earth projection. Heat keyed by ISO-3 country code. Pin
            click opens <strong>Region drawer</strong> with timeline + ETFs.
            Pan / zoom / Esc to reset.
          </Panel>
          <Panel name="Global Risk Index" source="Gemini grounded (web search)" cadence="6h cache">
            Single 0-10 score with delta + 80-char rationale. Synthetic fallback
            if Gemini fails.
          </Panel>
          <Panel name="Live Alerts" source="Gemini grounded · streamed 1.5-3s gap" cadence="6h cache">
            3-5 current geopolitical alerts. Each has level + title + body + a
            suggested hedge.
          </Panel>
          <Panel name="Hotspots" source="Gemini grounded" cadence="6h cache">
            4-6 ranked regions with impact, level, and ticker exposures.
          </Panel>
          <Panel name="Affected portfolio" source="Holdings × current hotspots ticker/sector/FX match" cadence="On render · 6h sector lookup cache">
            For each holding, scores (ticker hit + sector hit + currency hit) ×
            level weight; magnitude scales with level (high: 7-15%, med: 3-7%,
            low: 1-3%). Energy holdings get direction=+1 under Mid-East / Ukraine
            themes; everything else defaults to −1.
          </Panel>
          <Panel name="AI Hedge suggestion" source="Anthropic / Gemini" cadence="On-demand">
            One concrete hedge proposal with expected drawdown trim + actions.
            Hydrates from history.
          </Panel>
          <Panel name="Layer toggles / Risk legend" source="Static" cadence="—">
            Visual filters for the map. Currently controls only opacity of pins;
            full layer logic deferred.
          </Panel>
        </Section>

        {/* === Pages: Detail === */}
        <Section id="page-detail" title="Detail (per-stock)" route="/detail/NVDA">
          <p>URL pattern: <code>/detail/&lt;TICKER&gt;</code>. Use ⌘K to search.</p>
          <Panel name="Header" source="yahoo profile + AI verdict history" cadence="5min quote · on-demand verdict">
            Logo from parqet.com CDN with monogram fallback. Verdict pill hydrates
            from <code>/api/ai/history?area=verdicts</code> matched on the current
            symbol; "no verdict" + ↻ generate when none. + WATCHLIST and ⤴ TRADE
            buttons hit B8-PF-CRUD endpoints.
          </Panel>
          <Panel name="Main chart" source="yahoo OHLC via /api/security/:symbol/ohlc?range=" cadence="10min cache">
            Range 1D-MAX, intraday for short ranges. Studies (RSI / MACD / VOL)
            toggleable. Real OHLC bars now drive the chart (was synthetic seed
            until B23).
          </Panel>
          <Panel name="RSI(14)" source="Wilder RSI computed from yahoo closes" cadence="10min cache">
            Latest value + full series plotted. Color: ≥70 down (overbought),
            ≤30 up (oversold), else accent.
          </Panel>
          <Panel name="MACD(12, 26, 9)" source="Computed from yahoo closes (EMA-based)" cadence="10min cache">
            Line + signal cross detection (bars-since-cross indicator below).
          </Panel>
          <Panel name="Valuation grid" source="yahoo summaryDetail / financialData / defaultKeyStatistics" cadence="10min cache">
            12 fundamental metrics (P/E, EPS, market cap, dividend, etc.) with
            sector-median note where available.
          </Panel>
          <Panel name="Disclosures (filings)" source="SEC EDGAR via /api/security/:symbol/filings" cadence="On-demand · 1h server cache">
            Up to 20 most recent filings. KR / non-US tickers return [] (EDGAR
            is US-only). Was inline mock until B13-D1.
          </Panel>
          <Panel name="AI Investment Guide" source="Anthropic / Gemini · history hydrated" cadence="On-demand">
            5-axis conviction breakdown (momentum / valuation / quality /
            sentiment / geo risk).
          </Panel>
          <Panel name="Analyst targets" source="yahoo financialData targets" cadence="10min cache">
            Low / consensus / high + buy/hold/sell breakdown.
          </Panel>
          <Panel name="Peers" source="yahoo via /api/security/:symbol/peers" cadence="10min cache">
            Same-sector comparables. KR / non-US falls back to static MOCK_PEERS
            for known symbols.
          </Panel>
          <Panel name="Earnings & guidance" source="yahoo earnings module" cadence="10min cache">
            Per-quarter bar pair (estimate vs actual, dashed orange for forward Q)
            + tabular history with surprise %.
          </Panel>
          <Panel name="Options chain mini (IV surface)" source="Finnhub /stock/option-chain when key set" cadence="1h cache">
            Heatmap rows = expiries × cols = strikes (ATM ± 30%). IV mapped to
            blue→white→red. Without <code>FINNHUB_API_KEY</code> falls back to a
            synthetic surface.
          </Panel>
        </Section>

        {/* === Pages: Leaderboard === */}
        <Section id="page-leaderboard" title="Leaderboard" route="/leaderboard">
          <Panel name="New Strategy form" source="User input · ticker autocomplete from yahoo" cadence="—">
            Row-based allocation builder. Each row: ticker search + weight input
            (0-1). Σ check + Normalize button to rescale to 1.0. Start date picker
            (optional end date). Submit triggers a buy-and-hold backtest on yahoo
            historicals.
          </Panel>
          <Panel name="Ranked table" source="~/.intelistock/strategies.json" cadence="Frontend poll">
            Sorted by total return desc. Click row to expand its equity curve.
            Each row shows total / annualized return, sharpe, max DD, vs SPY,
            created date.
          </Panel>
          <Panel name="Overlay chart" source="Strategy equity curves + SPY benchmark" cadence="Live on toggle">
            All strategies + SPY shown together; per-strategy checkboxes toggle
            visibility. 10-color palette so adjacent strategies visually separate.
          </Panel>
        </Section>

        {/* === Pages: AI Assistant === */}
        <Section id="page-ai-assistant" title="AI Assistant" route="/ai-assistant">
          <Panel name="Tabs" source="~/.intelistock/ai-history.json (FIFO 50 per area)" cadence="On-demand · server-persisted">
            4 areas: Signals / Insights / Verdicts / Hedges. Each entry shows
            timestamp + provider/model badge + the data + a Re-run button.
          </Panel>
          <Panel name="Generate buttons" source="Anthropic / Gemini" cadence="On-demand">
            "+ Generate {'{area}'}" fires the per-tab generator; "⚡ Generate All"
            runs all 4 in parallel. New entries auto-append to history.
          </Panel>
          <Panel name="Usage panel (right)" source="Aggregated from history × aiPricing.ts" cadence="Live on render">
            Total calls / tokens / estimated cost. Per-area breakdown bars +
            last-30 calls token bar chart colour-coded by area. (est rates) badge
            shows when any call used preview/placeholder pricing.
          </Panel>
        </Section>

        {/* === Pages: Settings === */}
        <Section id="page-settings" title="Settings" route="/settings">
          <p>All configuration in one place. Changes take effect immediately —
          no server restart needed.</p>
          <Panel name="API Keys" source=".env at repo root" cadence="Live on save">
            Inputs masked. Save rewrites <code>.env</code> + resets in-process
            provider singletons so the next call uses the new key.
          </Panel>
          <Panel name="Data Export" source="JSON / CSV download" cadence="—">
            Portfolio JSON or holdings CSV one-click export.
          </Panel>
          <Panel name="Refresh Interval" source="Tweaks store (localStorage)" cadence="—">
            Sets the global polling cadence for live-data panels.
          </Panel>
          <Panel name="AI Models" source="Provider catalogue from /api/ai/models" cadence="On mount">
            Pick provider + model per call. Active selection stored in Tweaks.
          </Panel>
          <Panel name="Google Drive Sync" source="OAuth + Sheets API" cadence="On every portfolio change · cron daily 9am ET">
            12 sheets append-only mirror (8 portfolio + 4 AI). Reset button
            wipes portfolio tabs and writes fresh column headers.
          </Panel>
          <Panel name="Display Tweaks" source="Tweaks store" cadence="—">
            Chart style / map style / density / timezone / locale / currency /
            grid / accent color.
          </Panel>
        </Section>

        {/* === Background services === */}
        <Section id="svc-cron" title="Cron jobs">
          <p>Two scheduled jobs (toggle off via <code>CRON_DAILY_SYNC=off</code> env):</p>
          <ul>
            <li>
              <strong>Daily sync</strong> · Mon-Fri 13:00 UTC (≈ 9am ET) — runs the
              Sheets mirror + posts a Slack heartbeat with NAV / day / YTD.
            </li>
            <li>
              <strong>Hourly position-check</strong> · Mon-Fri 13:00-22:00 UTC (≈ 9am-6pm ET) —
              evaluates every active position rationale, fires Slack on triggered
              ones, bumps trailing-stop peakPrice.
            </li>
          </ul>
        </Section>

        <Section id="svc-slack" title="Slack alerts">
          <p>Set <code>SLACK_WEBHOOK_URL</code> in Settings to enable. The webhook
          URL itself is the only credential needed — no Bot Token / Client ID /
          Verification Token. URL is bound to a single channel.</p>
          <p>Two alert types:</p>
          <ul>
            <li>
              <strong>Sell-trigger fired</strong> — auto from cron when a position's
              trigger matches. Includes original buy reason, entry, P&L, held days.
            </li>
            <li>
              <strong>Portfolio threshold</strong> — fires from <code>POST
              /api/alerts/portfolio</code> if day move ≥ ±2% or drawdown ≥ −8%.
            </li>
          </ul>
          <p>Test wiring: <code>curl -X POST localhost:3001/api/alerts/test</code>.</p>
        </Section>

        <Section id="svc-sheets" title="Google Sheets sync">
          <p>One-way append-only mirror; JSON stays the source of truth. Setup:</p>
          <ol>
            <li>Enable Google Sheets API at console.cloud.google.com/apis/library/sheets.googleapis.com</li>
            <li>Configure OAuth consent (External, Testing) and add yourself as test user</li>
            <li>Create OAuth Client ID (Web app), redirect URI <code>http://localhost:3001/api/google/callback</code></li>
            <li>Paste Client ID / Secret in Settings; click <strong>Connect Google</strong>; create or link a spreadsheet</li>
          </ol>
          <p>12 sheets: 8 portfolio (Summary / Holdings / Allocation × 3 / Trades /
          RiskFactors / Watchlist_KR) + 4 AI (Signals / Insights / Verdicts /
          Hedges). Every row prefixed with <code>synced_at</code> in your timezone
          (TIMEZONE env, default America/New_York) with offset.</p>
        </Section>

        <Section id="svc-positions" title="Sell-trigger eval">
          <p>For each active rationale, on each cron tick:</p>
          <ol>
            <li>Pull yahoo quote (one batch call across all unique symbols)</li>
            <li>Walk triggers in registration order — first match wins</li>
            <li>Bump <code>peakPrice</code> on trailing-stop triggers if current &gt; peak</li>
            <li>If matched: <code>firedAt</code> set + Slack message sent (idempotent)</li>
          </ol>
          <p>Trigger semantics:</p>
          <ul>
            <li><code>date</code> — fires when today ≥ date</li>
            <li><code>absoluteAbove / Below</code> — fires when price crosses</li>
            <li><code>pctFromBase</code> — fires when price is on the right side of <code>basePrice × (1 + pct/100)</code></li>
            <li><code>trailingFromPeak</code> — fires when price ≤ <code>peakPrice × (1 + pct/100)</code> (negative pct)</li>
          </ul>
          <p>Manual force-eval: <code>POST /api/positions/check</code> or the
          <Link to="/positions"> Trades</Link> page's "↻ Check triggers" button.</p>
        </Section>

        {/* === FAQ === */}
        <Section id="faq-mock" title="Is anything still mock?">
          <p>Three categories of remaining placeholders:</p>
          <ul>
            <li><strong>Fallbacks</strong> — only used when the upstream API returns
              an error. <code>MOCK_INDICES</code>, <code>MOCK_MACRO</code>,
              <code>FALLBACK_STATE</code>, etc. Invisible in the happy path.</li>
            <li><strong>Skeleton placeholders</strong> — dimmed empty rows shown for
              the 0.X seconds before <code>useAsync</code> data arrives. Replaced
              instantly when data lands.</li>
            <li><strong>Geo state</strong> — Gemini grounded is the source; if
              grounding fails to return valid JSON, the inline mock fallback
              renders so the map / hotspots panel never blanks.</li>
          </ul>
          <p>Everything visible during normal operation (with keys configured)
          is now real — see commits B16-B23 for the audit + replacement work.</p>
        </Section>

        <Section id="faq-cost" title="How much does AI cost me?">
          <p>Token-based per provider. The <Link to="/ai-assistant">AI Assistant</Link>
          panel computes lifetime cost from each call's <code>usage</code> +
          rate snapshot in <code>app/src/lib/aiPricing.ts</code> (last refreshed
          2026-05).</p>
          <p>Approximate per-call cost on default <strong>Gemini 2.5 Flash-Lite</strong>:</p>
          <ul>
            <li>Signals / Insights (~600 tok in / 400 out) → <strong>~$0.0002 / call</strong></li>
            <li>Verdict (~700 tok in / 300 out) → <strong>~$0.0002 / call</strong></li>
            <li>Hedge (~500 tok in / 250 out) → <strong>~$0.00015 / call</strong></li>
          </ul>
          <p>Switching to Claude Opus 4.7 multiplies by ~150×. The "AI Usage"
          help popover documents the formula.</p>
        </Section>

        <Section id="faq-tz" title="Timezone & formatting">
          <p>All outbound timestamps (Sheets <code>synced_at</code>, cron logs) use
          ISO 8601 with the user's timezone offset (default America/New_York →
          <code>2026-05-08T13:04:08-04:00</code>). Override via <code>TIMEZONE</code>
          env var (any IANA tz id).</p>
          <p>In-app dates use <code>formatDateAxis()</code> "NOV 01 2025" style
          for chart axes.</p>
        </Section>

        <div style={{ height: 80 }} />
      </main>
    </div>
  );
}

// ─── Tour launcher (B25) ────────────────────────────────────────────────────

function TourLauncher() {
  const { start } = useTour();
  return (
    <div className="guide-tour-launcher">
      <div className="wf-mini muted-2" style={{ marginBottom: 8, letterSpacing: '0.04em' }}>
        ▶ INTERACTIVE TOUR — see each section highlighted in context
      </div>
      <div className="row gap-1" style={{ flexWrap: 'wrap' }}>
        <button
          type="button"
          className="lb-btn lb-btn-primary"
          onClick={() => start('master')}
          title="Walk every page section start to finish"
        >
          ▶ Full dashboard tour ({TOURS.master.steps.length} steps)
        </button>
        {(['overview', 'portfolio', 'positions', 'geo', 'detail', 'leaderboard', 'ai', 'settings'] as const).map((k) => (
          <button
            key={k}
            type="button"
            className="lb-btn lb-btn-ghost"
            onClick={() => start(k)}
          >
            {TOURS[k].label} ({TOURS[k].steps.length})
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Section + Panel + Table primitives ─────────────────────────────────────

function Section({ id, title, route, children }: {
  id: string; title: string; route?: string; children: ReactNode;
}) {
  return (
    <section id={id} data-guide-section className="guide-section">
      <h2 className="guide-h2">
        {title}
        {route && (
          <Link to={route} className="guide-route-link" title={`Open ${route}`}>
            ↗ {route}
          </Link>
        )}
      </h2>
      {children}
    </section>
  );
}

interface PanelProps {
  name:     string;
  source:   string;
  cadence:  string;
  children: ReactNode;
}
function Panel({ name, source, cadence, children }: PanelProps) {
  return (
    <div className="guide-panel">
      <div className="guide-panel-h">{name}</div>
      <div className="guide-panel-meta">
        <span><strong>Source:</strong> {source}</span>
        <span><strong>Cadence:</strong> {cadence}</span>
      </div>
      <div className="guide-panel-body">{children}</div>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="guide-table-wrap">
      <table className="guide-table">
        <thead>
          <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => <td key={j}><code>{c}</code></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
