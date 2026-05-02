import { useMemo, useState } from 'react';

import { getEquityCurve } from '../../data/portfolio';
import type { EquityPoint, Range } from '../../data/types';
import { useAsync } from '../../lib/useAsync';
import { useTweaks } from '../../lib/tweaks';

const RANGES: Range[] = ['1M', '3M', '6M', 'YTD', '1Y', '5Y'];

const PAD_L = 8;
const PAD_R = 56;
const PAD_T = 12;
const PAD_B = 22;

interface Bounds { minTs: number; maxTs: number; minV: number; maxV: number }

function computeBounds(points: EquityPoint[]): Bounds | null {
  if (points.length < 2) return null;
  let minTs = Infinity, maxTs = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const p of points) {
    if (p.ts    < minTs) minTs = p.ts;
    if (p.ts    > maxTs) maxTs = p.ts;
    if (p.value < minV)  minV  = p.value;
    if (p.value > maxV)  maxV  = p.value;
  }
  const span = maxV - minV;
  const padY = span === 0 ? maxV * 0.02 : span * 0.04;
  return { minTs, maxTs, minV: minV - padY, maxV: maxV + padY };
}

function buildPath(points: EquityPoint[], b: Bounds, w: number, h: number): string {
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

function fmtUSD(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

function fmtDateShort(ts: number, range: Range): string {
  const d = new Date(ts);
  if (range === '5Y' || range === '1Y' || range === 'YTD') {
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function EquityCurve() {
  const { values } = useTweaks();
  const [range, setRange] = useState<Range>('1Y');
  const { data, loading } = useAsync(() => getEquityCurve(range), [range]);

  const points = data ?? [];
  const bounds = useMemo(() => computeBounds(points), [points]);

  const W = 800;
  const H = 180;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const [hover, setHover] = useState<{ x: number; idx: number } | null>(null);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!bounds || points.length < 2) return;
    const svg  = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    if (vx < PAD_L || vx > W - PAD_R) { setHover(null); return; }
    // Find nearest point by x.
    const tsRange = bounds.maxTs - bounds.minTs || 1;
    const targetTs = bounds.minTs + ((vx - PAD_L) / innerW) * tsRange;
    let bestIdx = 0; let bestDelta = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].ts - targetTs);
      if (d < bestDelta) { bestDelta = d; bestIdx = i; }
    }
    const px = PAD_L + ((points[bestIdx].ts - bounds.minTs) / tsRange) * innerW;
    setHover({ x: px, idx: bestIdx });
  };

  const dimmed = loading && !data ? { opacity: 0.4 } : undefined;
  const startVal = points[0]?.value ?? 0;
  const endVal   = points.at(-1)?.value ?? 0;
  const totalPct = startVal > 0 ? (endVal / startVal - 1) * 100 : 0;
  const isUp = totalPct >= 0;
  const pathColor = isUp ? 'var(--up)' : 'var(--down)';

  const hoverPt = hover ? points[hover.idx] : null;
  const hoverY = hover && hoverPt && bounds
    ? PAD_T + (1 - (hoverPt.value - bounds.minV) / (bounds.maxV - bounds.minV || 1)) * innerH
    : 0;

  return (
    <div className="wf-panel" style={{ padding: 12 }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="wf-label">Equity curve · {range}</div>
          <div className="row gap-2 center" style={{ marginTop: 4 }}>
            <span className="wf-num" style={{ fontSize: 18 }}>{fmtUSD(endVal)}</span>
            <span
              className="wf-mono"
              style={{ fontSize: 11, color: pathColor }}
            >
              {isUp ? '+' : '−'}{Math.abs(totalPct).toFixed(2)}%
            </span>
          </div>
        </div>
        <div
          className="row gap-1"
          role="tablist"
          aria-label="Equity range"
        >
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={range === r}
              className={range === r ? 'tab active' : 'tab'}
              style={{
                padding: '3px 8px',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.06em',
                background: range === r ? undefined : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 10, ...dimmed, position: 'relative' }} aria-busy={loading}>
        {bounds && points.length >= 2 ? (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height={H}
            preserveAspectRatio="none"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            role="img"
            aria-label={`Equity curve ${range}`}
          >
            {/* Gridlines (4 horizontal divisions). */}
            {values.showGrid && [0.25, 0.5, 0.75].map((t) => (
              <line
                key={t}
                x1={PAD_L} x2={W - PAD_R}
                y1={PAD_T + t * innerH} y2={PAD_T + t * innerH}
                stroke="var(--hairline)" strokeWidth={0.5}
                strokeDasharray="2 4"
              />
            ))}
            <path
              d={buildPath(points, bounds, W, H)}
              fill="none"
              stroke={pathColor}
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
            />
            {/* Y axis labels. */}
            <text
              x={W - PAD_R + 6} y={PAD_T + 4}
              fontSize={9} fontFamily="var(--font-mono)" fill="var(--fg-4)"
            >
              {fmtUSD(bounds.maxV)}
            </text>
            <text
              x={W - PAD_R + 6} y={H - PAD_B}
              fontSize={9} fontFamily="var(--font-mono)" fill="var(--fg-4)"
            >
              {fmtUSD(bounds.minV)}
            </text>
            {/* X axis labels. */}
            <text
              x={PAD_L} y={H - 4}
              fontSize={9} fontFamily="var(--font-mono)" fill="var(--fg-4)"
            >
              {fmtDateShort(bounds.minTs, range)}
            </text>
            <text
              x={W - PAD_R} y={H - 4}
              textAnchor="end"
              fontSize={9} fontFamily="var(--font-mono)" fill="var(--fg-4)"
            >
              {fmtDateShort(bounds.maxTs, range)}
            </text>
            {/* Crosshair + dot. */}
            {hover && hoverPt && (
              <>
                <line
                  x1={hover.x} x2={hover.x}
                  y1={PAD_T} y2={H - PAD_B}
                  stroke="var(--fg-3)"
                  strokeWidth={0.5}
                  strokeDasharray="2 2"
                  pointerEvents="none"
                />
                <circle
                  cx={hover.x} cy={hoverY}
                  r={3}
                  fill={pathColor}
                  pointerEvents="none"
                />
              </>
            )}
          </svg>
        ) : (
          <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="wf-mini muted">no data</span>
          </div>
        )}
        {/* Hover info pill */}
        {hover && hoverPt && (
          <div
            style={{
              position: 'absolute',
              top: 4,
              left: 'calc(' + (hover.x / W) * 100 + '%)',
              transform: 'translateX(-50%)',
              background: 'var(--panel-2)',
              border: '1px solid var(--hairline)',
              borderRadius: 4,
              padding: '4px 8px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fg)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 1,
            }}
          >
            {fmtDateShort(hoverPt.ts, range)} · {fmtUSD(hoverPt.value)}
          </div>
        )}
      </div>
    </div>
  );
}
