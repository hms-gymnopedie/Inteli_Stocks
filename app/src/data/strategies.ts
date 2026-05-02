/**
 * /api/sim/* fetch wrappers + types — B8-SIM
 *
 * Mirrors the server-side shapes in `server/src/lib/backtest.ts` and
 * `server/src/storage/strategies.ts`. Frontend imports only from this file.
 */

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface Allocation {
  symbol: string;
  weight: number;
}

export interface EquityPoint {
  ts:    number;
  value: number;
}

export interface StrategyMetrics {
  totalReturnPct:      number;
  annualizedReturnPct: number;
  maxDrawdownPct:      number;
  sharpe:              number;
  volatilityPct:       number;
}

export interface Strategy {
  id:                    string;
  name:                  string;
  createdAt:             number;
  allocations:           Allocation[];
  startDate:             string;
  endDate:               string;
  metrics:               StrategyMetrics;
  equityCurve:           EquityPoint[];
  benchmarkMetrics:      StrategyMetrics;
  benchmarkEquityCurve:  EquityPoint[];
}

export interface BacktestRequest {
  name:        string;
  allocations: Allocation[];
  startDate:   string;
  endDate?:    string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ApiError { error: string }

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as Partial<ApiError>;
      if (body && typeof body.error === 'string') detail = body.error;
    } catch {
      // body wasn't JSON — keep status code only
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a buy-and-hold backtest. Server validates weights sum to ≈1.0, fetches
 * Yahoo historicals for each symbol, computes equity curve + metrics, computes
 * SPY benchmark, and persists the result. Returns the freshly-saved strategy.
 *
 * Throws with a server-provided message on validation or data errors.
 */
export async function runBacktest(req: BacktestRequest): Promise<Strategy> {
  return apiJson<Strategy>('/sim/backtest', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(req),
  });
}

/** List all persisted strategies, sorted by total return descending. */
export async function listStrategies(): Promise<Strategy[]> {
  return apiJson<Strategy[]>('/sim/strategies');
}

/** Fetch one persisted strategy by id. */
export async function getStrategy(id: string): Promise<Strategy> {
  return apiJson<Strategy>(`/sim/strategies/${encodeURIComponent(id)}`);
}

/** Delete one persisted strategy by id. Resolves on 204. */
export async function deleteStrategy(id: string): Promise<void> {
  const res = await fetch(`/api/sim/strategies/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`failed to delete strategy: HTTP ${res.status}`);
  }
}
