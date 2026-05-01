# Database Migrations

SQL migrations for the InteliStock Supabase backend (B5-AU / B5-CR).

## Applying migrations

### Option 1 — Supabase SQL editor (recommended for quick setup)

1. Open your Supabase project dashboard.
2. Navigate to **SQL Editor**.
3. Copy the contents of `001_portfolios.sql` and run it.

### Option 2 — Supabase CLI

```bash
# Install CLI if needed
npm install -g supabase

# Link to your project (run once)
supabase link --project-ref <your-project-ref>

# Push all pending migrations
supabase db push
```

## Migration files

| File | Description |
|------|-------------|
| `001_portfolios.sql` | Creates the `portfolios` table (JSONB per-user portfolio store) and enables Row Level Security. |

## Table: `portfolios`

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | `uuid` (PK) | References `auth.users(id)`. Cascade delete removes portfolio on user deletion. |
| `data` | `jsonb` | Full `PortfolioStore` object (summary, holdings, allocation, trades, riskFactors, watchlist). |
| `updated_at` | `timestamptz` | Auto-set to `now()` on insert; the server updates this on every write. |

## Environment variables required

Set these in `.env` (see `.env.example`):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=<public anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key — keep secret>
```

Without these variables the dashboard runs in **local mode** (file-backed store at `~/.intelistock/portfolio.json`, no login screen).
