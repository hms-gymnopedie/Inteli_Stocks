/**
 * /leaderboard — strategy backtest leaderboard — B8-SIM
 *
 * Sections:
 *   1. Header + "+ New Strategy" toggle
 *   2. Inline NewStrategyForm (toggleable)
 *   3. Ranked table (sortable by total return desc, expandable rows for
 *      per-strategy equity curve)
 *   4. Combined chart: top-3 strategies + SPY benchmark overlay
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteStrategy as apiDeleteStrategy,
  listStrategies,
  runBacktest,
  type BacktestRequest,
  type Strategy,
} from '../../data/strategies';
import { EquityCurveChart, type ChartSeries } from './EquityCurveChart';
import { NewStrategyForm } from './NewStrategyForm';

// ─── Color palette for the overlay chart ──────────────────────────────────────

const SERIES_COLORS = [
  'var(--orange)',  // rank 1 — accent
  '#6fcf8a',        // rank 2 — up green
  '#7a93e8',        // rank 3 — neutral blue
];

const BENCHMARK_COLOR = 'var(--fg-3)';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPct(pct: number, opts: { signed?: boolean } = { signed: true }): string {
  if (!Number.isFinite(pct)) return '—';
  const sign = opts.signed === false ? '' : pct > 0 ? '+' : pct < 0 ? '−' : '';
  return `${sign}${Math.abs(pct).toFixed(2)}%`;
}

function fmtSharpe(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(2);
}

function fmtDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function deltaVsBenchmark(s: Strategy): number {
  return s.metrics.totalReturnPct - s.benchmarkMetrics.totalReturnPct;
}

function shortAllocations(allocs: Strategy['allocations']): string {
  return allocs
    .map((a) => `${a.symbol} ${(a.weight * 100).toFixed(0)}%`)
    .join(' · ');
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Leaderboard() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [showForm,   setShowForm]   = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listStrategies();
      setStrategies(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const onSubmitBacktest = useCallback(
    async (req: BacktestRequest): Promise<Strategy> => {
      const created = await runBacktest(req);
      // Optimistic insert + sort by totalReturn desc to match server order.
      setStrategies((prev) =>
        [...prev, created].sort(
          (a, b) => b.metrics.totalReturnPct - a.metrics.totalReturnPct,
        ),
      );
      return created;
    },
    [],
  );

  const onDelete = useCallback(async (id: string) => {
    const prev = strategies;
    setStrategies((s) => s.filter((x) => x.id !== id));
    if (expandedId === id) setExpandedId(null);
    try {
      await apiDeleteStrategy(id);
    } catch (e) {
      // Roll back on failure.
      setStrategies(prev);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [strategies, expandedId]);

  // Combined overlay: top-3 strategies + benchmark from rank-1 (any benchmark
  // works — they're computed for the same period, but rank-1 is freshest).
  const overlaySeries: ChartSeries[] = useMemo(() => {
    if (strategies.length === 0) return [];
    const top = strategies.slice(0, 3);
    const out: ChartSeries[] = top.map((s, i) => ({
      id:     s.id,
      label:  s.name,
      color:  SERIES_COLORS[i] ?? 'var(--fg-3)',
      points: s.equityCurve,
    }));
    const bench = top[0].benchmarkEquityCurve;
    if (bench && bench.length > 0) {
      out.push({
        id:     'spy-benchmark',
        label:  'SPY (benchmark)',
        color:  BENCHMARK_COLOR,
        dashed: true,
        points: bench,
      });
    }
    return out;
  }, [strategies]);

  return (
    <div className="settings-page lb-page">
      <header className="settings-header">
        <h1 className="settings-title">Leaderboard</h1>
        <p className="settings-sub">Backtest your strategy against SPY · buy-and-hold daily-close</p>
      </header>

      <div className="lb-toolbar">
        <button
          type="button"
          className="lb-btn lb-btn-primary"
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
        >
          {showForm ? '× Cancel' : '+ New Strategy'}
        </button>
        <span className="wf-mini lb-toolbar-count">
          {loading
            ? 'loading…'
            : `${strategies.length} strateg${strategies.length === 1 ? 'y' : 'ies'} saved`}
        </span>
      </div>

      {showForm && (
        <NewStrategyForm
          onSubmit={onSubmitBacktest}
          onClose={() => setShowForm(false)}
        />
      )}

      {error && (
        <div className="lb-error" role="alert">
          {error}
        </div>
      )}

      {/* Leaderboard table */}
      <div className="wf-panel lb-table-panel">
        <div className="lb-table-scroll">
          <table className="lb-table" aria-label="Strategy leaderboard">
            <thead>
              <tr>
                <th className="lb-th-rank">#</th>
                <th>Name</th>
                <th className="lb-th-num">Total return</th>
                <th className="lb-th-num">Annualized</th>
                <th className="lb-th-num">Sharpe</th>
                <th className="lb-th-num">Max DD</th>
                <th className="lb-th-num">vs SPY</th>
                <th className="lb-th-num">Created</th>
                <th className="lb-th-action" aria-label="Delete" />
              </tr>
            </thead>
            <tbody>
              {loading && strategies.length === 0 && (
                <tr><td colSpan={9} className="lb-row-empty">Loading…</td></tr>
              )}
              {!loading && strategies.length === 0 && (
                <tr>
                  <td colSpan={9} className="lb-row-empty">
                    No strategies yet. Click <span className="wf-mono">+ New Strategy</span> to create one.
                  </td>
                </tr>
              )}
              {strategies.map((s, idx) => {
                const isExpanded = expandedId === s.id;
                const delta = deltaVsBenchmark(s);
                return (
                  <>
                    <tr
                      key={s.id}
                      className={'lb-row' + (isExpanded ? ' lb-row-expanded' : '')}
                      onClick={() => setExpandedId((cur) => (cur === s.id ? null : s.id))}
                      tabIndex={0}
                      role="button"
                      aria-expanded={isExpanded}
                      aria-label={`${s.name} — ${fmtPct(s.metrics.totalReturnPct)}. Click to ${isExpanded ? 'collapse' : 'expand'} equity curve.`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setExpandedId((cur) => (cur === s.id ? null : s.id));
                        }
                      }}
                    >
                      <td className="lb-td-rank wf-mono">{idx + 1}</td>
                      <td className="lb-td-name">
                        <div className="lb-name-main">{s.name}</div>
                        <div className="lb-name-allocs wf-mini">{shortAllocations(s.allocations)}</div>
                      </td>
                      <td className={'lb-td-num wf-mono ' + (s.metrics.totalReturnPct >= 0 ? 'up' : 'down')}>
                        {fmtPct(s.metrics.totalReturnPct)}
                      </td>
                      <td className={'lb-td-num wf-mono ' + (s.metrics.annualizedReturnPct >= 0 ? 'up' : 'down')}>
                        {fmtPct(s.metrics.annualizedReturnPct)}
                      </td>
                      <td className="lb-td-num wf-mono">{fmtSharpe(s.metrics.sharpe)}</td>
                      <td className="lb-td-num wf-mono down">{fmtPct(s.metrics.maxDrawdownPct, { signed: false })}</td>
                      <td className={'lb-td-num wf-mono ' + (delta >= 0 ? 'up' : 'down')}>
                        {fmtPct(delta)}
                      </td>
                      <td className="lb-td-num wf-mono muted">{fmtDate(s.createdAt)}</td>
                      <td className="lb-td-action">
                        <button
                          type="button"
                          className="lb-row-delete"
                          aria-label={`Delete ${s.name}`}
                          title={`Delete ${s.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void onDelete(s.id);
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="lb-row-detail" key={`${s.id}-detail`}>
                        <td colSpan={9}>
                          <div className="lb-detail-inner">
                            <div className="lb-detail-meta">
                              <div className="wf-label">Period</div>
                              <div className="wf-mono">{s.startDate} → {s.endDate}</div>
                              <div className="wf-label" style={{ marginTop: 8 }}>Volatility (ann.)</div>
                              <div className="wf-mono">{fmtPct(s.metrics.volatilityPct, { signed: false })}</div>
                              <div className="wf-label" style={{ marginTop: 8 }}>SPY total return</div>
                              <div className={'wf-mono ' + (s.benchmarkMetrics.totalReturnPct >= 0 ? 'up' : 'down')}>
                                {fmtPct(s.benchmarkMetrics.totalReturnPct)}
                              </div>
                            </div>
                            <div className="lb-detail-chart">
                              <EquityCurveChart
                                series={[
                                  {
                                    id: s.id,
                                    label: s.name,
                                    color: 'var(--orange)',
                                    points: s.equityCurve,
                                  },
                                  ...(s.benchmarkEquityCurve.length > 0
                                    ? [{
                                        id: 'spy-bench',
                                        label: 'SPY',
                                        color: BENCHMARK_COLOR,
                                        dashed: true,
                                        points: s.benchmarkEquityCurve,
                                      }]
                                    : []),
                                ]}
                                height={160}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Combined overlay chart */}
      {strategies.length > 0 && (
        <div className="wf-panel lb-overlay-panel">
          <div className="lb-overlay-header">
            <h2 className="lb-section-h">Top {Math.min(strategies.length, 3)} vs SPY</h2>
            <span className="wf-mini">$100k initial · buy-and-hold</span>
          </div>
          <EquityCurveChart series={overlaySeries} height={220} />
        </div>
      )}
    </div>
  );
}
