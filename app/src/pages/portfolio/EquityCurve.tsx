import { useEffect, useMemo, useState } from 'react';

import { getEquityCurve } from '../../data/portfolio';
import type { EquityPoint, Range } from '../../data/types';
import { formatDateAxis } from '../../lib/format';
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
  // Year shown for ranges spanning 6M+; shorter ranges fit cleaner without it.
  const withYear = range === 'YTD' || range === '1Y' || range === '5Y' || range === '6M' || range === 'MAX';
  return formatDateAxis(ts, { withYear });
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
  const [pinned, setPinned] = useState<number[]>([]);
  useEffect(() => { setPinned([]); }, [range]);

  function nearestIdx(e: React.MouseEvent<SVGSVGElement>): { idx: number; x: number } | null {
    if (!bounds || points.length < 2) return null;
    const svg  = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    if (vx < PAD_L || vx > W - PAD_R) return null;
    const tsRange = bounds.maxTs - bounds.minTs || 1;
    const targetTs = bounds.minTs + ((vx - PAD_L) / innerW) * tsRange;
    let bestIdx = 0; let bestDelta = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].ts - targetTs);
      if (d < bestDelta) { bestDelta = d; bestIdx = i; }
    }
    const px = PAD_L + ((points[bestIdx].ts - bounds.minTs) / tsRange) * innerW;
    return { idx: bestIdx, x: px };
  }

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = nearestIdx(e);
    if (!r) { setHover(null); return; }
    setHover({ x: r.x, idx: r.idx });
  };

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = nearestIdx(e);
    if (!r) return;
    setPinned((prev) => prev.length >= 2 ? [r.idx] : [...prev, r.idx]);
  };

  const xForIdx = (idx: number): number => {
    if (!bounds) return 0;
    const tsRange = bounds.maxTs - bounds.minTs || 1;
    return PAD_L + ((points[idx].ts - bounds.minTs) / tsRange) * innerW;
  };
  const yForVal = (v: number): number => {
    if (!bounds) return 0;
    return PAD_T + (1 - (v - bounds.minV) / (bounds.maxV - bounds.minV || 1)) * innerH;
  };

  const compare = useMemo(() => {
    if (pinned.length !== 2) return null;
    const a = points[pinned[0]];
    const b = points[pinned[1]];
    if (!a || !b) return null;
    const delta = b.value - a.value;
    const pct = a.value > 0 ? (delta / a.value) * 100 : 0;
    const days = (b.ts - a.ts) / (24 * 3600_000);
    return { a, b, delta, pct, days };
  }, [points, pinned]);

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
            onClick={onClick}
            role="img"
            aria-label={`Equity curve ${range}`}
            style={{ cursor: 'crosshair' }}
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
            {/* Pinned anchors A / B */}
            {pinned.map((idx, i) => {
              const pt = points[idx];
              if (!pt) return null;
              const x = xForIdx(idx);
              const y = yForVal(pt.value);
              const label = i === 0 ? 'A' : 'B';
              return (
                <g key={`pin-${idx}-${i}`} pointerEvents="none">
                  <line
                    x1={x} x2={x}
                    y1={PAD_T} y2={H - PAD_B}
                    stroke="var(--orange)" strokeWidth={1}
                  />
                  <circle cx={x} cy={y} r={4} fill="var(--orange)" />
                  <rect x={x - 7} y={PAD_T - 12} width={14} height={12} fill="var(--orange)" />
                  <text
                    x={x} y={PAD_T - 3}
                    textAnchor="middle"
                    fontSize={9}
                    fontFamily="var(--font-mono)"
                    fill="#000"
                    fontWeight={700}
                  >
                    {label}
                  </text>
                </g>
              );
            })}
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
      {compare && (
        <div
          className="row between"
          style={{
            marginTop: 8,
            padding: '8px 10px',
            background: 'var(--panel-2)',
            border: '1px solid var(--orange)',
            borderRadius: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}
          role="status"
        >
          <div className="row gap-3 center" style={{ flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--orange)' }}>A</span>
            <span>{fmtDateShort(compare.a.ts, range)}</span>
            <span style={{ color: 'var(--fg-3)' }}>{fmtUSD(compare.a.value)}</span>
            <span style={{ color: 'var(--fg-4)' }}>→</span>
            <span style={{ color: 'var(--orange)' }}>B</span>
            <span>{fmtDateShort(compare.b.ts, range)}</span>
            <span style={{ color: 'var(--fg-3)' }}>{fmtUSD(compare.b.value)}</span>
          </div>
          <div className="row gap-3 center">
            <span
              style={{
                color: compare.pct >= 0 ? 'var(--up)' : 'var(--down)',
                fontWeight: 600,
              }}
            >
              {compare.pct >= 0 ? '+' : '−'}{Math.abs(compare.pct).toFixed(2)}%
            </span>
            <span style={{ color: compare.delta >= 0 ? 'var(--up)' : 'var(--down)' }}>
              {compare.delta >= 0 ? '+' : '−'}{fmtUSD(Math.abs(compare.delta))}
            </span>
            <span className="muted">{Math.round(compare.days)}d</span>
            <button
              type="button"
              onClick={() => setPinned([])}
              style={{
                background: 'transparent', border: 0,
                color: 'var(--fg-3)', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 11,
              }}
              aria-label="Clear pinned anchors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
