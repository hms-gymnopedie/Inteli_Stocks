/**
 * Per-holding sparkline grid + Copy-to-Portfolio control — B27-2 / B27-3
 *
 * Lazy-loads /api/sim/strategies/:id/breakdown the first time a leaderboard
 * row is expanded. Renders one card per allocation with:
 *   · sparkline (start=100 normalized adjClose)
 *   · cumulative return % from startDate → today
 *   · weight + daysHeld + first→last price line
 * Marks holdings as "no data" when the market wasn't open on startDate.
 *
 * The Copy-to-Portfolio button replicates the strategy as live trades +
 * holdings, derived from each allocation's startDate close price.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  copyStrategyToPortfolio,
  getStrategyBreakdown,
  type HoldingBreakdown,
  type StrategyBreakdown,
} from '../../data/strategies';

interface Props {
  strategyId:   string;
  strategyName: string;
}

// ─── Sparkline ─────────────────────────────────────────────────────────────────

function Spark({
  points,
  positive,
  width = 120,
  height = 36,
}: {
  points:   { ts: number; value: number }[];
  positive: boolean;
  width?:   number;
  height?:  number;
}) {
  if (!points || points.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden>
        <line
          x1={0} y1={height / 2} x2={width} y2={height / 2}
          stroke="var(--border)" strokeWidth={1} strokeDasharray="2 3"
        />
      </svg>
    );
  }
  const xs = points.map((p) => p.ts);
  const ys = points.map((p) => p.value);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xR = xMax - xMin || 1;
  const yR = yMax - yMin || 1;
  const path = points.map((p, i) => {
    const x = ((p.ts    - xMin) / xR) * width;
    const y = height - ((p.value - yMin) / yR) * height;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  const stroke = positive ? '#6fcf8a' : '#e25e5e';
  return (
    <svg width={width} height={height} aria-hidden>
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return '—';
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return `${sign}${Math.abs(pct).toFixed(2)}%`;
}

function fmtPrice(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toFixed(2);
}

// ─── Main component ────────────────────────────────────────────────────────────

export function HoldingBreakdownPanel({ strategyId, strategyName }: Props) {
  const [data,    setData]    = useState<StrategyBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getStrategyBreakdown(strategyId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [strategyId]);

  const summary = useMemo(() => {
    if (!data) return null;
    const usable = data.holdings.filter((h) => h.available && h.returnPct != null);
    if (usable.length === 0) return null;
    const weighted = usable.reduce(
      (acc, h) => acc + (h.returnPct as number) * h.weight,
      0,
    );
    const totalW = usable.reduce((a, h) => a + h.weight, 0);
    return totalW > 0 ? weighted / totalW : null;
  }, [data]);

  return (
    <div className="lb-bd-wrap">
      <div className="lb-bd-header">
        <div className="wf-label">Per-holding breakdown</div>
        <div className="lb-bd-controls">
          {summary != null && (
            <span className="wf-mini">
              weighted return:{' '}
              <span className={'wf-mono ' + (summary >= 0 ? 'up' : 'down')}>
                {fmtPct(summary)}
              </span>
            </span>
          )}
          <CopyToPortfolioButton strategyId={strategyId} strategyName={strategyName} />
        </div>
      </div>

      {loading && <div className="wf-mini lb-bd-status">Loading per-holding data…</div>}
      {error   && <div className="lb-error" role="alert">{error}</div>}

      {data && (
        <div className="lb-bd-grid">
          {data.holdings.map((h) => (
            <HoldingCard key={h.symbol} h={h} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── One card per holding ──────────────────────────────────────────────────────

function HoldingCard({ h }: { h: HoldingBreakdown }) {
  const positive = (h.returnPct ?? 0) >= 0;
  return (
    <div className={'lb-bd-card' + (h.available ? '' : ' lb-bd-card-na')}>
      <div className="lb-bd-card-top">
        <div className="lb-bd-symbol wf-mono">{h.symbol}</div>
        <div className="lb-bd-weight wf-mini">{(h.weight * 100).toFixed(1)}%</div>
      </div>
      <div className="lb-bd-spark">
        <Spark points={h.series} positive={positive} />
      </div>
      <div className="lb-bd-card-bottom">
        <div className={'lb-bd-return wf-mono ' + (h.available
          ? (positive ? 'up' : 'down')
          : 'muted')}
        >
          {h.available ? fmtPct(h.returnPct) : 'no data'}
        </div>
        {h.available ? (
          <div className="lb-bd-meta wf-mini">
            ${fmtPrice(h.firstClose)} → ${fmtPrice(h.lastClose)}
            {h.daysHeld != null && (
              <>
                {' · '}
                {h.daysHeld}d
              </>
            )}
          </div>
        ) : (
          <div className="lb-bd-meta wf-mini muted">market closed on start date</div>
        )}
      </div>
    </div>
  );
}

// ─── Copy-to-Portfolio control ────────────────────────────────────────────────

function CopyToPortfolioButton({
  strategyId,
  strategyName,
}: {
  strategyId:   string;
  strategyName: string;
}) {
  const [open,    setOpen]    = useState(false);
  const [amount,  setAmount]  = useState('100000');
  const [replace, setReplace] = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [result,  setResult]  = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const onConfirm = useCallback(async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        throw new Error('Amount must be a positive number');
      }
      const r = await copyStrategyToPortfolio(strategyId, amt, replace);
      setResult(
        `Copied ${r.addedHoldings} holding${r.addedHoldings === 1 ? '' : 's'}` +
        ` and ${r.addedTrades} trade${r.addedTrades === 1 ? '' : 's'}` +
        (r.skipped > 0 ? ` (skipped ${r.skipped} with no entry data)` : '') +
        (r.replaced ? ' — replaced existing portfolio' : ''),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [amount, replace, strategyId]);

  return (
    <div className="lb-copy-wrap">
      {!open ? (
        <button
          type="button"
          className="lb-btn lb-btn-primary lb-copy-btn"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          aria-label={`Copy "${strategyName}" to Portfolio`}
        >
          Copy to Portfolio
        </button>
      ) : (
        <div
          className="lb-copy-form"
          onClick={(e) => e.stopPropagation()}
        >
          <label className="lb-copy-row">
            <span className="wf-label">Total $</span>
            <input
              className="lb-copy-input wf-mono"
              type="number"
              min="1"
              step="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="lb-copy-row">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
              disabled={busy}
            />
            <span className="wf-mini">Replace existing portfolio</span>
          </label>
          <div className="lb-copy-actions">
            <button
              type="button"
              className="lb-btn"
              onClick={() => { setOpen(false); setResult(null); setError(null); }}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="lb-btn lb-btn-primary"
              onClick={onConfirm}
              disabled={busy}
            >
              {busy ? 'Copying…' : 'Confirm'}
            </button>
          </div>
          {result && <div className="wf-mini lb-copy-ok">{result}</div>}
          {error  && <div className="lb-error" role="alert">{error}</div>}
        </div>
      )}
    </div>
  );
}
