# InteliStock

Local-first stock-market intelligence dashboard with AI, backtesting, and geo-risk monitoring.

US (S&P 500, Nasdaq) and Korea (KOSPI, KOSDAQ), macro indicators, geopolitical risk map, sector flow, individual security deep-dive, AI insight panels, strategy backtester, and portfolio CRUD — all running on your machine.

---

## Quick start (Docker)

```bash
cp .env.example .env          # add API keys for optional features (see below)
docker compose up --build     # first run builds images (~2 min)
```

Open http://localhost:5180. The app works immediately without any keys (yahoo-finance2 is key-free). Add keys in `.env` to unlock AI features and other integrations.

---

## Manual setup (dev)

Requires Node 22+.

**App (Vite SPA — port 5180):**
```bash
cd app
npm install
npm run dev
```

**Server (Express — port 3001):**
```bash
cd server
npm install
npm run dev
```

Or run both from repo root:
```bash
npm install        # installs all workspaces
npm run dev        # concurrently starts Vite + Express
```

---

## Optional features

| Env var | What it unlocks | Where to get |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI signals, verdicts, hedge proposals, insights (Anthropic provider) | https://console.anthropic.com/keys |
| `GEMINI_API_KEY` | AI features via Gemini; geo-risk grounded search (Fear & Greed, hotspots) | https://aistudio.google.com/app/apikey |
| `SUPABASE_URL` + `SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` | Multi-user auth + cloud-backed portfolio storage (otherwise local-file mode) | https://supabase.com → Settings → API |
| `FRED_API_KEY` | Live CPI and Fed Funds Rate (fallback: mock values) | https://fred.stlouisfed.org/docs/api/api_key.html |
| `FINNHUB_API_KEY` | Economic calendar events + options IV surface (fallback: mock) | https://finnhub.io/register |
| `SLACK_WEBHOOK_URL` | Sell-trigger alert delivery to a Slack channel | https://api.slack.com/apps → Incoming Webhooks |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Google Sheets append-only mirror of portfolio writes | GCP Console → APIs & Credentials → OAuth 2.0 Client |
| `CRON_DAILY_SYNC=off` | Disables the hourly background sync job | — |
| `PORT` | Override Express port (default: 3001) | — |
| `TIMEZONE` | IANA timezone for timestamps (default: `America/New_York`) | — |

See `.env.example` for setup notes on each key.

---

## Storage

In local mode (no Supabase), all state is stored as JSON files under `~/.intelistock/` (or `/data/intelistock/` inside Docker, mounted as a named volume so data survives container restarts):

| File | Contents |
|---|---|
| `portfolio.json` | Holdings, trades, watchlist, summary KPIs |
| `positions.json` | Buy-rationale + sell triggers per holding |
| `strategies.json` | Backtest strategy definitions and results |
| `ai-history.json` | Per-area AI response history (FIFO 50/area) |
| `geo-index-trail.json` | Global Risk Index time-series trail |
| `storage.json` | Google Sheets spreadsheet metadata |
| `google-token.json` | Google OAuth2 refresh token |

---

## Architecture

- **app/** — Vite + React 18 + TypeScript SPA; pure SVG charts (no Recharts/D3 renderer); react-router-dom for routing; served on port 5180 (dev) / port 80 via nginx (Docker)
- **server/** — Express + tsx (ESM); all external API calls proxied here; results cached in-memory with TTL; listening on port 3001
- **yahoo-finance2** — key-free Node package for quotes, OHLC, fundamentals, earnings, search, sector ETFs, indices; 30–600s TTL cache with last-good-value fallback
- **Gemini** (`@google/genai`) — AI provider + web-grounded search for Fear & Greed and geopolitical hotspots; configurable in Tweaks panel
- **Anthropic** (`@anthropic-ai/sdk`) — AI provider with prompt caching on system prompts; configurable in Tweaks panel
- **FRED** — CPI and Fed Funds Rate via free API key; 1h TTL cache; mock fallback when unconfigured
- **SEC EDGAR** — Filing metadata via public API (no key required, User-Agent header set); ticker→CIK mapped once per process lifetime
- **Supabase** — Optional multi-user auth (JWT validation server-side) and cloud portfolio storage; graceful degrade to local-file mode when unconfigured
- **Slack** — Outbound webhook for sell-trigger alerts; fire-and-forget; no-op when unconfigured
- **Google Sheets** — OAuth2 append-only mirror; 12 tabs (8 portfolio + 4 AI); local JSON is source of truth

---

## Project layout

```
app/                    # Vite + React SPA
  src/
    App.tsx             # shell, nav, routes
    styles.css          # design tokens (--orange accent, matte-black theme)
    lib/
      primitives.tsx    # LineChart, CandleChart, BarChart, HeatGrid, Gauge, Spark
      tweaks.tsx        # global Tweaks context (density, accent, AI provider)
      WorldMap/         # TopoJSON + d3-geo SVG map with zoom/pan/pin-click
    pages/
      overview/         # Indices strip, hero chart, sector heatmap, macro, AI signals
      portfolio/        # KPIs, equity curve, allocation, holdings, trades, AI feed
      geo/              # World map, hotspots, region drawer, AI hedge suggestion
      detail/           # Security header, OHLC+RSI+MACD, fundamentals, AI verdict
      ai-assistant/     # Tabbed AI history (signals / insights / verdicts / hedges)
      leaderboard/      # Backtest strategy rankings with equity curve overlay
      settings/         # Supabase keys, Google Sheets link, theme

server/
  src/
    index.ts            # Express app bootstrap, route registration, cron start
    routes/             # One file per domain: market, security, portfolio, ai, ...
    providers/          # yahoo, anthropic, gemini, fred, finnhub, sec, slack, google, supabase
    storage/            # local.ts (file), supabase.ts (cloud), strategies, positions, ai-history
    lib/                # backtest engine, cache TTL helper, risk/factors

PLAN.md                 # Living implementation plan — read before starting work
.env.example            # All optional env vars with comments
docker-compose.yml      # One-command self-hosting
```

---

## Screens

| Route | Screen |
|---|---|
| `/overview` | Indices strip, hero chart, sector heatmap, macro monitor, AI signals, sentiment gauge |
| `/portfolio` | NAV KPIs, equity curve, allocation, holdings table, trades log, AI insights feed |
| `/geo` | World risk map, hotspots, region drawer, geo risk index, AI hedge suggestion |
| `/detail/:symbol` | Chart + RSI/MACD, valuation, filings, analyst targets, earnings, options IV, AI verdict |
| `/ai-assistant` | Persistent AI history tabbed by area (signals / insights / verdicts / hedges) |
| `/leaderboard` | Backtest strategy ranker with per-holding breakdown and copy-to-portfolio |
| `/settings` | API key management, Google Sheets sync, theme/display tweaks |
