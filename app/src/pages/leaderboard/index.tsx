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

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
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

// Distinguishable palette derived from a categorical color scheme — each
// pair has very different hue + lightness so adjacent strategies don't
// blur together. Cycles past 10 strategies; rare in practice.
const SERIES_COLORS = [
  'var(--orange)',  // 1 — accent
  '#6fcf8a',        // 2 — green
  '#7a93e8',        // 3 — blue
  '#e25e5e',        // 4 — red
  '#c178e8',        // 5 — purple
  '#e8c66f',        // 6 — yellow
  '#5fd8d8',        // 7 — cyan
  '#e8866f',        // 8 — coral
  '#aee86f',        // 9 — lime
  '#e86fb8',        // 10 — pink
];

const BENCHMARK_COLOR = '#bdbdbd'; // light grey — visible against dark bg, distinct from any series color

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
  // Visibility set: strategy ids included in the overlay chart. Default-on
  // for every strategy; user can toggle via checkbox in the legend.
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [showSpy, setShowSpy] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listStrategies();
      setStrategies(list);
      // Newly-loaded strategies default to visible so the overlay shows
      // everything until the user opts out.
      setVisible(new Set(list.map((s) => s.id)));
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
      setStrategies((prev) =>
        [...prev, created].sort(
          (a, b) => b.metrics.totalReturnPct - a.metrics.totalReturnPct,
        ),
      );
      setVisible((prev) => new Set(prev).add(created.id));
      return created;
    },
    [],
  );

  const toggleVisible = useCallback((id: string) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

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

  // Combined overlay: every strategy by default, toggleable via checkboxes.
  // Color index is locked to leaderboard rank so the legend swatch matches
  // the row colour even if the user hides intermediate ranks.
  const overlaySeries: ChartSeries[] = useMemo(() => {
    if (strategies.length === 0) return [];
    const out: ChartSeries[] = [];
    strategies.forEach((s, i) => {
      if (!visible.has(s.id)) return;
      out.push({
        id:     s.id,
        label:  s.name,
        color:  SERIES_COLORS[i % SERIES_COLORS.length],
        points: s.equityCurve,
      });
    });
    const bench = strategies[0]?.benchmarkEquityCurve;
    if (showSpy && bench && bench.length > 0) {
      out.push({
        id:     'spy-benchmark',
        label:  'SPY (benchmark)',
        color:  BENCHMARK_COLOR,
        dashed: true,
        points: bench,
      });
    }
    return out;
  }, [strategies, visible, showSpy]);

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
                  <Fragment key={s.id}>
                    <tr
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
                      <tr className="lb-row-detail">
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
                  </Fragment>
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
            <h2 className="lb-section-h">All strategies overlay</h2>
            <span className="wf-mini">$100k initial · buy-and-hold · toggle below</span>
          </div>
          <EquityCurveChart series={overlaySeries} height={260} hideLegend />
          <div className="lb-overlay-toggles" role="group" aria-label="Toggle visibility">
            {strategies.map((s, i) => {
              const checked = visible.has(s.id);
              const color = SERIES_COLORS[i % SERIES_COLORS.length];
              return (
                <label key={s.id} className="lb-overlay-toggle">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleVisible(s.id)}
                  />
                  <span
                    className="lb-overlay-swatch"
                    style={{ background: color }}
                    aria-hidden
                  />
                  <span className="lb-overlay-label">{s.name}</span>
                  <span
                    className={'wf-mono ' + (s.metrics.totalReturnPct >= 0 ? 'up' : 'down')}
                  >
                    {fmtPct(s.metrics.totalReturnPct)}
                  </span>
                </label>
              );
            })}
            {strategies[0]?.benchmarkEquityCurve.length > 0 && (
              <label className="lb-overlay-toggle">
                <input
                  type="checkbox"
                  checked={showSpy}
                  onChange={() => setShowSpy((v) => !v)}
                />
                <span
                  className="lb-overlay-swatch lb-overlay-swatch-dashed"
                  style={{ background: BENCHMARK_COLOR }}
                  aria-hidden
                />
                <span className="lb-overlay-label">SPY (benchmark)</span>
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
