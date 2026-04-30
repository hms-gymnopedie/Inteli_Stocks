import { getEarnings } from '../../data/security';
import type { Earnings } from '../../data/types';
import { useAsync } from '../../lib/useAsync';

interface EarningsGuidanceProps {
  /**
   * Symbol to fetch earnings for. Optional with `'NVDA'` default to keep
   * the section rendering identically to AIInvestmentGuide before B4-RT
   * settled prop-drilling.
   */
  symbol?: string;
}

const SKELETON_ROWS = 4;

const GRID_TEMPLATE = '90px 70px 70px 70px';

/**
 * Format a quarter label. Yahoo returns ISO dates ("2025-04-30") for the
 * forward estimate row and short labels ("4q2024") for history. Normalise
 * to a compact "QyYY" form (e.g. "1q25") and pass-through anything that
 * doesn't fit either pattern (e.g. "Next Q").
 */
function formatQuarter(q: string): string {
  const isoMatch = /^(\d{4})-(\d{2})-\d{2}$/.exec(q);
  if (isoMatch) {
    const year = isoMatch[1].slice(2);
    const month = parseInt(isoMatch[2], 10);
    const quarter = Math.ceil(month / 3);
    return `${quarter}q${year}`;
  }
  const yahooMatch = /^([1-4])q(\d{4})$/i.exec(q);
  if (yahooMatch) {
    return `${yahooMatch[1]}q${yahooMatch[2].slice(2)}`;
  }
  return q;
}

/** Surprise % (actual vs estimate). Returns null when actual is missing. */
function surprisePct(actual: number | null, estimate: number): number | null {
  if (actual == null || estimate === 0) return null;
  return ((actual - estimate) / Math.abs(estimate)) * 100;
}

export function EarningsGuidance({ symbol = 'NVDA' }: EarningsGuidanceProps) {
  const { data, loading } = useAsync(() => getEarnings(symbol), [symbol]);

  // Visual scale for the bar pair: anchor to max abs estimate so the bars
  // stay comparable across rows. 1 unit = 1 EPS × scale px.
  const maxEps =
    data && data.length > 0
      ? Math.max(
          ...data.map((e) =>
            Math.max(Math.abs(e.epsEstimate), Math.abs(e.epsActual ?? 0)),
          ),
          0.1,
        )
      : 1;
  const BAR_SCALE = 30 / maxEps; // 30px max bar height

  const rows = data ?? [];
  const dimmed = loading && !data ? { opacity: 0.4 } : undefined;

  return (
    <div className="wf-panel" style={{ padding: 12 }} aria-busy={loading}>
      <div className="row between">
        <div className="wf-label">Earnings &amp; guidance · {symbol}</div>
        <div className="wf-mini muted-2">EPS · est vs actual</div>
      </div>

      {/* Bar pair visualization */}
      {data && rows.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'flex-end',
            gap: 12,
            height: 70,
            marginTop: 12,
            paddingBottom: 6,
            borderBottom: '1px solid var(--hairline)',
            ...dimmed,
          }}
          role="img"
          aria-label="Quarterly EPS estimate vs actual bars"
        >
          {rows.map((r, i) => {
            const estH = Math.abs(r.epsEstimate) * BAR_SCALE;
            const actH =
              r.epsActual != null
                ? Math.abs(r.epsActual) * BAR_SCALE
                : null;
            const beat =
              r.epsActual != null && r.epsActual > r.epsEstimate;
            return (
              <div
                key={`${r.quarter}-${i}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 3,
                    height: 50,
                  }}
                >
                  <div
                    title={`Estimate ${r.epsEstimate.toFixed(2)}`}
                    style={{
                      width: 8,
                      height: estH,
                      background: 'var(--fg-3)',
                      borderRadius: 1,
                    }}
                  />
                  {actH != null ? (
                    <div
                      title={`Actual ${r.epsActual?.toFixed(2)}`}
                      style={{
                        width: 8,
                        height: actH,
                        background: beat ? 'var(--up)' : 'var(--down)',
                        borderRadius: 1,
                      }}
                    />
                  ) : (
                    <div
                      title="Forward estimate"
                      style={{
                        width: 8,
                        height: estH,
                        background: 'transparent',
                        border: '1px dashed var(--orange)',
                        borderRadius: 1,
                      }}
                    />
                  )}
                </div>
                <div
                  className="wf-mono muted-2"
                  style={{ fontSize: 8, letterSpacing: '0.06em' }}
                >
                  {formatQuarter(r.quarter)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabular fallback (always rendered as the primary text view) */}
      <div
        className="dense-row"
        style={{
          gridTemplateColumns: GRID_TEMPLATE,
          color: 'var(--fg-3)',
          marginTop: 8,
          padding: '6px 0',
        }}
      >
        <span>QUARTER</span>
        <span style={{ textAlign: 'right' }}>EST</span>
        <span style={{ textAlign: 'right' }}>ACTUAL</span>
        <span style={{ textAlign: 'right' }}>SURPRISE</span>
      </div>

      <div style={dimmed}>
        {data && rows.length === 0 && (
          <div
            className="dense-row"
            style={{
              gridTemplateColumns: '1fr',
              color: 'var(--fg-3)',
              fontStyle: 'italic',
            }}
          >
            <span>No earnings on record for {symbol}.</span>
          </div>
        )}
        {data
          ? rows.map((r, i) => {
              const surp = surprisePct(r.epsActual, r.epsEstimate);
              const beat = surp != null && surp >= 0;
              return (
                <div
                  key={`${r.quarter}-${i}`}
                  className="dense-row"
                  style={{
                    gridTemplateColumns: GRID_TEMPLATE,
                    padding: '6px 0',
                  }}
                >
                  <span className="muted">{formatQuarter(r.quarter)}</span>
                  <span style={{ textAlign: 'right' }}>
                    {r.epsEstimate.toFixed(2)}
                  </span>
                  <span
                    style={{
                      textAlign: 'right',
                      color: r.epsActual != null ? 'var(--fg)' : 'var(--fg-4)',
                    }}
                  >
                    {r.epsActual != null ? r.epsActual.toFixed(2) : '—'}
                  </span>
                  <span
                    style={{
                      textAlign: 'right',
                      color:
                        surp == null
                          ? 'var(--fg-4)'
                          : beat
                            ? 'var(--up)'
                            : 'var(--down)',
                    }}
                  >
                    {surp == null
                      ? '—'
                      : `${beat ? '+' : ''}${surp.toFixed(1)}%`}
                  </span>
                </div>
              );
            })
          : Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <div
                key={i}
                className="dense-row"
                style={{
                  gridTemplateColumns: GRID_TEMPLATE,
                  padding: '6px 0',
                  color: 'var(--fg-4)',
                }}
              >
                <span>———</span>
                <span style={{ textAlign: 'right' }}>—</span>
                <span style={{ textAlign: 'right' }}>—</span>
                <span style={{ textAlign: 'right' }}>—</span>
              </div>
            ))}
      </div>
    </div>
  );
}
