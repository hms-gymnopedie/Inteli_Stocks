/**
 * EquityCurveChart — pure SVG line chart for backtest equity curves.
 *
 * Multi-series overlay: each series gets a stable color (orange for the
 * leader, hairline gradient for others, fg-3 dashed for SPY benchmark).
 * Series are normalized to a shared x-domain (min ts → max ts) and
 * y-domain (min value → max value across all series) so visual
 * comparisons make sense.
 *
 * No third-party chart libs (PLAN.md forbids Recharts/D3-renderer).
 */

import { useMemo, useRef, useState } from 'react';
import type { EquityPoint } from '../../data/strategies';

export interface ChartSeries {
  id:        string;
  label:     string;
  /** CSS color or var(...). Falls back to var(--fg-3). */
  color?:    string;
  /** Render with a dashed stroke (used for SPY benchmark). */
  dashed?:   boolean;
  points:    EquityPoint[];
}

interface Props {
  series:  ChartSeries[];
  height?: number;
  /** Show the y-axis "+x.x%" labels at the right edge. Default: true. */
  showAxis?: boolean;
  /** Caption shown above the chart. Optional. */
  caption?:  string;
  /** Suppress the inline color legend below the chart. Default: false. */
  hideLegend?: boolean;
}

const PAD_L = 8;
const PAD_R = 56;
const PAD_T = 14;
const PAD_B = 22;

interface Bounds { minTs: number; maxTs: number; minV: number; maxV: number }

function computeBounds(series: ChartSeries[]): Bounds | null {
  let minTs = Infinity, maxTs = -Infinity;
  let minV  = Infinity, maxV  = -Infinity;
  let count = 0;
  for (const s of series) {
    for (const p of s.points) {
      if (p.ts < minTs) minTs = p.ts;
      if (p.ts > maxTs) maxTs = p.ts;
      if (p.value < minV) minV = p.value;
      if (p.value > maxV) maxV = p.value;
      count++;
    }
  }
  if (count < 2 || !Number.isFinite(minTs) || !Number.isFinite(maxTs)) return null;
  // Pad y-domain so the strongest line never grazes the top edge.
  const span = maxV - minV;
  const padY = span === 0 ? maxV * 0.02 : span * 0.04;
  return { minTs, maxTs, minV: minV - padY, maxV: maxV + padY };
}

function buildPath(
  points: EquityPoint[],
  b: Bounds,
  w: number,
  h: number,
): string {
  if (points.length < 2) return '';
  const xRange = b.maxTs - b.minTs || 1;
  const yRange = b.maxV  - b.minV  || 1;
  const innerW = w - PAD_L - PAD_R;
  const innerH = h - PAD_T - PAD_B;
  let d = '';
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const x = PAD_L + ((p.ts - b.minTs) / xRange) * innerW;
    const y = PAD_T + (1 - (p.value - b.minV) / yRange) * innerH;
    d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
  }
  return d.trim();
}

function fmtDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function fmtPct(pct: number): string {
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

/** Total-return % vs first point in this series. */
function totalReturnPct(pts: EquityPoint[]): number {
  if (pts.length < 2) return 0;
  return (pts[pts.length - 1].value / pts[0].value - 1) * 100;
}

export function EquityCurveChart({
  series,
  height   = 180,
  showAxis = true,
  caption,
  hideLegend = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  // Width is responsive — sized by the parent. We use a viewBox so the SVG
  // scales without re-rendering on every resize.
  const W = 800;
  const H = height;

  const bounds = useMemo(() => computeBounds(series), [series]);

  const [hover, setHover] = useState<{ x: number; ts: number } | null>(null);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!bounds) return;
    const svg  = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    // Convert client-x to viewBox-x.
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    if (vx < PAD_L || vx > W - PAD_R) { setHover(null); return; }
    const innerW = W - PAD_L - PAD_R;
    const tsRange = bounds.maxTs - bounds.minTs || 1;
    const ts = bounds.minTs + ((vx - PAD_L) / innerW) * tsRange;
    setHover({ x: vx, ts });
  };

  if (!bounds || series.length === 0) {
    return (
      <div className="lb-empty-chart" style={{ height }} aria-label="No equity-curve data">
        <span className="wf-mini">no data to plot</span>
      </div>
    );
  }

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  return (
    <div className="lb-chart-wrap" ref={wrapRef}>
      {caption && <div className="wf-label" style={{ marginBottom: 6 }}>{caption}</div>}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label="Equity curve overlay"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* Horizontal gridlines (4 divisions) */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD_T + t * innerH;
          return (
            <line
              key={`grid-${t}`}
              x1={PAD_L} x2={W - PAD_R}
              y1={y}     y2={y}
              stroke="var(--hairline)"
              strokeDasharray={t === 0 || t === 1 ? '' : '2 4'}
              strokeWidth={0.5}
            />
          );
        })}

        {/* Data series */}
        {series.map((s) => {
          const d     = buildPath(s.points, bounds, W, H);
          const color = s.color ?? 'var(--fg-3)';
          return (
            <path
              key={s.id}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={1.4}
              strokeDasharray={s.dashed ? '4 4' : ''}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* Y-axis labels (right side) */}
        {showAxis && (
          <>
            <text
              x={W - PAD_R + 6} y={PAD_T + 4}
              fontSize={9} fontFamily="var(--font-mono)" fill="var(--fg-4)"
            >
              {fmtPct(((bounds.maxV / series[0].points[0].value) - 1) * 100)}
            </text>
            <text
              x={W - PAD_R + 6} y={H - PAD_B}
              fontSize={9} fontFamily="var(--font-mono)" fill="var(--fg-4)"
            >
              {fmtPct(((bounds.minV / series[0].points[0].value) - 1) * 100)}
            </text>
          </>
        )}

        {/* X-axis date labels */}
        <text
          x={PAD_L} y={H - 4}
          fontSize={9} fontFamily="var(--font-mono)" fill="var(--fg-4)"
        >
          {fmtDate(bounds.minTs)}
        </text>
        <text
          x={W - PAD_R} y={H - 4}
          textAnchor="end"
          fontSize={9} fontFamily="var(--font-mono)" fill="var(--fg-4)"
        >
          {fmtDate(bounds.maxTs)}
        </text>

        {/* Crosshair */}
        {hover && (
          <line
            x1={hover.x} x2={hover.x}
            y1={PAD_T}   y2={H - PAD_B}
            stroke="var(--fg-3)"
            strokeWidth={0.5}
            strokeDasharray="2 2"
            pointerEvents="none"
          />
        )}
      </svg>

      {/* Legend */}
      {!hideLegend && <div className="lb-chart-legend">
        {series.map((s) => {
          const ret = totalReturnPct(s.points);
          return (
            <div key={s.id} className="lb-chart-legend-item">
              <span
                className="lb-chart-swatch"
                style={{
                  background: s.color ?? 'var(--fg-3)',
                  borderStyle: s.dashed ? 'dashed' : 'solid',
                }}
              />
              <span className="lb-chart-legend-label">{s.label}</span>
              <span
                className={'wf-mono ' + (ret >= 0 ? 'up' : 'down')}
                style={{ fontSize: 10 }}
              >
                {fmtPct(ret)}
              </span>
            </div>
          );
        })}
      </div>}
    </div>
  );
}
