/**
 * Storage interface for portfolio data — B5-CR
 *
 * Both `local.ts` and `supabase.ts` implement this same interface so the
 * route handlers in `routes/portfolio.ts` need no knowledge of the backing
 * store.
 */

// ─── Domain types (mirrors the shapes in routes/portfolio.ts) ────────────────

export interface PortfolioSummary {
  nav: number; navFormatted: string;
  dayChange: string; dayChangePct: string;
  ytd: string; oneYear: string;
  sharpe: number; exposure: string; exposureNote: string;
  riskScore: string; riskNote: string; drawdown: string; drawdownNote: string;
}

export interface Holding {
  symbol: string; name: string; weight: string;
  price: string; dayPct: string; plPct: string;
  sparkSeed: number; risk: number;
}

export interface AllocationSlice { name: string; v: number }

export interface Trade {
  date: string; symbol: string; side: 'BUY' | 'SELL';
  quantity: number; price: number; currency: string;
}

export interface RiskFactor {
  name: string; value: number; contribution: string;
}

export interface WatchlistEntry {
  code: string; name: string; change: string; seed: number; direction: 1 | -1;
}

export interface PortfolioStore {
  summary:    PortfolioSummary;
  holdings:   Holding[];
  allocation: {
    sector: AllocationSlice[];
    region: AllocationSlice[];
    asset:  AllocationSlice[];
  };
  trades:      Trade[];
  riskFactors: RiskFactor[];
  watchlist:   { KR: WatchlistEntry[] };
}

// ─── Storage interface ───────────────────────────────────────────────────────

/** Read the full portfolio store for the given context. */
export interface PortfolioStorage {
  /**
   * Read the portfolio store.
   * @param userId — null in local mode (file-backed); UUID string in Supabase mode.
   */
  read(userId: string | null): Promise<PortfolioStore>;

  /**
   * Write the full portfolio store.
   * @param userId — null in local mode; UUID string in Supabase mode.
   * @param data   — the store to persist.
   */
  write(userId: string | null, data: PortfolioStore): Promise<void>;
}
