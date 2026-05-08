import { useState } from 'react';

import { getFearGreed } from '../../data/market';
import type { FearGreed } from '../../data/types';
import { Gauge } from '../../lib/primitives';
import { useAsync } from '../../lib/useAsync';

/** Skeleton placeholder used while the fetch is in flight. */
const SKELETON: FearGreed = {
  value:     0,
  label:     '——',
  yesterday: 0,
  oneWeek:   0,
  oneMonth:  0,
};

export function Sentiment() {
  const { data, loading } = useAsync<FearGreed>(getFearGreed, []);
  const fg = data ?? SKELETON;
  const dimmed = loading && !data ? { opacity: 0.4 } : undefined;

  return (
    <div>
      <div className="wf-label">Market sentiment</div>
      <div
        className="wf-panel-flat"
        style={{ padding: 10, marginTop: 8, ...dimmed }}
        aria-busy={loading}
      >
        <Gauge value={fg.value} label={fg.label} />
        <div className="row between wf-mini" style={{ marginTop: 6 }}>
          <span>YESTERDAY {fg.yesterday}</span>
          <span>1W {fg.oneWeek}</span>
          <span>1M {fg.oneMonth}</span>
        </div>
        {fg.daily && fg.daily.length >= 2 && <FGTrendChart points={fg.daily} />}
      </div>
    </div>
  );
}

// ─── Daily F&G trend mini chart (B21) ──────────────────────────────────────

interface TrendChartProps { points: { date: string; value: number }[] }

/**
 * F&G zone definitions per CNN's published cuts. Each band gets a
 * faint background fill on the chart and a label on the right axis.
 * Lower bound is inclusive, upper bound is exclusive of the next band.
 */
const FG_ZONES = [
  { lo:  0, hi: 25,  label: 'EXTREME FEAR',  short: 'EF', fill: 'rgba(226, 94, 94, 0.18)' },
  { lo: 25, hi: 45,  label: 'FEAR',          short: 'F',  fill: 'rgba(226, 94, 94, 0.10)' },
  { lo: 45, hi: 56,  label: 'NEUTRAL',       short: 'N',  fill: 'rgba(255, 255, 255, 0.05)' },
  { lo: 56, hi: 76,  label: 'GREED',         short: 'G',  fill: 'rgba(111, 207, 138, 0.10)' },
  { lo: 76, hi: 101, label: 'EXTREME GREED', short: 'EG', fill: 'rgba(111, 207, 138, 0.18)' },
] as const;

function zoneFor(v: number): string {
  for (const z of FG_ZONES) if (v >= z.lo && v < z.hi) return z.label;
  return 'NEUTRAL';
}

function FGTrendChart({ points }: TrendChartProps) {
  const W = 280;
  const H = 130;          // taller — was 56; gives the line room to breathe (B22)
  const PAD_T = 4;
  const PAD_B = 16;
  const PAD_L = 4;
  const PAD_R = 56;       // wider gutter for zone labels
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  // Domain locked to the F&G 0-100 range.
  const minV = 0;
  const maxV = 100;
  const yFor = (v: number): number =>
    PAD_T + (1 - (v - minV) / (maxV - minV)) * innerH;

  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

  const pts = points.map((p, i) => {
    const x = PAD_L + i * stepX;
    const y = yFor(p.value);
    return [x, y, p] as const;
  });
  const path = pts.map(([x, y], i) => (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
  const areaPath =
    `${path} L${pts[pts.length - 1][0].toFixed(1)} ${(H - PAD_B).toFixed(1)} L${pts[0][0].toFixed(1)} ${(H - PAD_B).toFixed(1)} Z`;

  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);

  const onMove = (e: React.MouseEvent<SVGSVGElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    if (vx < PAD_L || vx > W - PAD_R) { setHover(null); return; }
    let bestIdx = 0; let bestDelta = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.abs(pts[i][0] - vx);
      if (d < bestDelta) { bestDelta = d; bestIdx = i; }
    }
    setHover({ idx: bestIdx, x: pts[bestIdx][0], y: pts[bestIdx][1] });
  };

  const last = pts[pts.length - 1];
  const lastValue = last[2].value;
  const lineColor = lastValue >= 56 ? 'var(--up)' : lastValue < 45 ? 'var(--down)' : 'var(--fg-2)';

  return (
    <div style={{ marginTop: 8, position: 'relative' }}>
      <div className="wf-mini muted-2" style={{ marginBottom: 2 }}>
        30-DAY TREND
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Fear & Greed 30-day trend"
        style={{ cursor: 'crosshair' }}
      >
        {/* Zone bands — drawn first so the line + dots paint on top. */}
        {FG_ZONES.map((z) => {
          const yTop    = yFor(z.hi - 1);    // hi is exclusive boundary
          const yBottom = yFor(z.lo);
          const h = yBottom - yTop;
          if (h <= 0) return null;
          return (
            <g key={z.label}>
              <rect
                x={PAD_L} y={yTop}
                width={innerW} height={h}
                fill={z.fill}
              />
              {/* Boundary line at the top of each band (skip the very top) */}
              {z.hi !== 101 && (
                <line
                  x1={PAD_L} x2={W - PAD_R}
                  y1={yTop} y2={yTop}
                  stroke="var(--hairline)"
                  strokeDasharray="2 4"
                  strokeWidth={0.5}
                />
              )}
              {/* Right-edge zone label, vertically centered in the band. */}
              <text
                x={W - PAD_R + 4}
                y={(yTop + yBottom) / 2 + 3}
                fontSize={7.5}
                fontFamily="var(--font-mono)"
                fill="var(--fg-3)"
                letterSpacing="0.04em"
              >
                {z.label}
              </text>
            </g>
          );
        })}

        {/* Area fill (line color, fainter so zones still read through) */}
        <path d={areaPath} fill={lineColor} opacity={0.16} />
        {/* Trend line */}
        <path
          d={path}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.4}
          vectorEffect="non-scaling-stroke"
        />

        {/* Numeric Y-axis ticks at each zone boundary */}
        {[0, 25, 45, 56, 76, 100].map((v) => (
          <text
            key={v}
            x={W - PAD_R - 2}
            y={yFor(v) + 3}
            textAnchor="end"
            fontSize={7}
            fontFamily="var(--font-mono)"
            fill="var(--fg-4)"
          >
            {v}
          </text>
        ))}

        {/* X-axis labels */}
        <text x={PAD_L} y={H - 4}
          fontSize={8} fontFamily="var(--font-mono)" fill="var(--fg-4)"
        >{points[0].date.slice(5)}</text>
        <text x={W - PAD_R} y={H - 4}
          textAnchor="end"
          fontSize={8} fontFamily="var(--font-mono)" fill="var(--fg-4)"
        >{points[points.length - 1].date.slice(5)}</text>

        {/* Hover crosshair + dot */}
        {hover && (
          <>
            <line
              x1={hover.x} x2={hover.x}
              y1={PAD_T} y2={H - PAD_B}
              stroke="var(--fg-3)"
              strokeDasharray="2 2"
              strokeWidth={0.5}
              pointerEvents="none"
            />
            <circle cx={hover.x} cy={hover.y} r={3} fill={lineColor} pointerEvents="none" />
          </>
        )}
      </svg>
      {hover && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 'calc(' + (hover.x / W) * 100 + '%)',
            transform: 'translateX(-50%)',
            background: 'var(--panel-2)',
            border: '1px solid var(--hairline)',
            borderRadius: 3,
            padding: '3px 7px',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--fg)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            lineHeight: 1.4,
          }}
        >
          <div>{points[hover.idx].date} · {points[hover.idx].value}</div>
          <div className="muted" style={{ fontSize: 8 }}>
            {zoneFor(points[hover.idx].value)}
          </div>
        </div>
      )}
    </div>
  );
}
