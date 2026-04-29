# CLAUDE.md

This file is auto-loaded into context. Read it first.

## Project

InteliStock — stock-market intelligence dashboard. Vite + React 18 + TypeScript app under `app/`. Implemented from a Claude Design handoff (matte-black, single-orange accent, Bloomberg-density). Repo: https://github.com/hms-gymnopedie/Inteli_Stocks

## Working agreement

**Always read [PLAN.md](./PLAN.md) before starting work.** It is the living implementation plan with task IDs, status, parallel batches, agent assignments, and open decisions.

When you do work:
1. Find the matching task ID (e.g. `B1-OV`, `B2-AI`, `0-A`) in PLAN.md and flip its status to 🟡 before you begin.
2. Include the task ID in commit messages (e.g. `B1-OV: extract HeroChart component`).
3. When done, flip to ✅ and add a one-line note about decisions or trade-offs in the Notes column.
4. If a new task or batch emerges mid-work, add it to PLAN.md in the same commit.
5. Update §6 *Current state* whenever a phase changes.

If a task in PLAN.md is ambiguous, ask the user to clarify before starting; don't silently reinterpret.

## Local layout

```
app/                       # Vite + React + TS app
  src/
    App.tsx                # shell + nav + routes
    main.tsx
    styles.css             # design tokens
    lib/{primitives,tweaks}.tsx
    pages/{Overview,Portfolio,GeoRisk,Detail}.tsx
design_archive/            # original Claude Design handoff (gitignored, reference only)
PLAN.md                    # ← read this every session
README.md
```

## Commands

```bash
cd app
npm install
npm run dev      # http://localhost:5180
npm run build
npm run preview
```

## Conventions

- Don't render the prototype HTML in a browser to "check" the design — it's already a static snapshot. The plan is to recreate behaviors in real React, not screenshot the prototype.
- Pure SVG charts. No Recharts/D3-renderer libs unless PLAN.md explicitly calls for one (B2-MAP allows d3-geo).
- Single accent color via `--orange` CSS var. Don't add a second hue.
- Korean and English are both fine in code comments and commit messages, but task IDs and section headers stay English for grep-ability.
