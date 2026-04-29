# InteliStock

Stock-market intelligence dashboard for active traders — US (S&P, Nasdaq) and Korea (KOSPI, KOSDAQ), macro indicators, geopolitical risk map, sector flow, individual security deep-dive, and AI-driven insight panels.

Implemented from a Claude Design handoff (matte black, single-orange accent, Bloomberg-density).

## Stack

- Vite + React 18 + TypeScript
- react-router-dom for screen navigation
- Pure SVG charts/map (no external chart lib)

## Getting started

```bash
cd app
npm install
npm run dev      # http://localhost:5180
npm run build    # production build to app/dist
npm run preview  # preview the production build
```

## Project layout

```
app/
  src/
    App.tsx               # shell + top nav + routes
    main.tsx              # entry
    styles.css            # design tokens & primitives
    lib/
      primitives.tsx      # LineChart, CandleChart, BarChart, SectorBars,
                          # HeatGrid, Gauge, Spark, WorldMap
      tweaks.tsx          # global tweaks context + side panel
    pages/
      Overview.tsx        # A1 — Terminal Bloomberg overview
      Portfolio.tsx       # A2 — Portfolio + AI insights feed
      GeoRisk.tsx         # B1 — Geopolitical risk map
      Detail.tsx          # C1 — Security deep-dive (NVDA)
```

## Screens

| Route        | Screen                              |
|--------------|-------------------------------------|
| `/overview`  | Indices, sector heatmap, macro, AI signals |
| `/portfolio` | NAV, equity curve, holdings, AI feed |
| `/geo`       | World risk map, hotspots, hedge proposal |
| `/detail`    | Single security: chart, RSI/MACD, valuation, AI verdict |

The Tweaks FAB (bottom-right) controls chart style, grid, map style, layout density, and accent color globally.
