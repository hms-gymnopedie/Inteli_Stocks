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

function FGTrendChart({ points }: TrendChartProps) {
  const W = 280;
  const H = 56;
  const PAD_T = 4;
  const PAD_B = 14;
  const PAD_L = 4;
  const PAD_R = 24;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  // Domain: F&G is 0-100 by definition, no need for autoscale.
  const minV = 0;
  const maxV = 100;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

  // Build path string.
  const pts = points.map((p, i) => {
    const x = PAD_L + i * stepX;
    const y = PAD_T + (1 - (p.value - minV) / (maxV - minV)) * innerH;
    return [x, y, p] as const;
  });
  const path = pts.map(([x, y], i) => (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
  // Area path (closing back to baseline) for soft fill.
  const areaPath =
    `${path} L${pts[pts.length - 1][0].toFixed(1)} ${(H - PAD_B).toFixed(1)} L${pts[0][0].toFixed(1)} ${(H - PAD_B).toFixed(1)} Z`;

  // Hover state — show value + date for nearest point.
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
  const lineColor = lastValue >= 50 ? 'var(--up)' : 'var(--down)';

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
        {/* 50 = neutral baseline */}
        <line
          x1={PAD_L} x2={W - PAD_R}
          y1={PAD_T + 0.5 * innerH}
          y2={PAD_T + 0.5 * innerH}
          stroke="var(--hairline)"
          strokeDasharray="2 4"
          strokeWidth={0.5}
        />
        {/* Area fill */}
        <path d={areaPath} fill={lineColor} opacity={0.12} />
        {/* Trend line */}
        <path
          d={path}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
        />
        {/* Y-axis labels */}
        <text x={W - PAD_R + 4} y={PAD_T + 6}
          fontSize={8} fontFamily="var(--font-mono)" fill="var(--fg-4)"
        >100</text>
        <text x={W - PAD_R + 4} y={PAD_T + 0.5 * innerH + 3}
          fontSize={8} fontFamily="var(--font-mono)" fill="var(--fg-4)"
        >50</text>
        <text x={W - PAD_R + 4} y={H - PAD_B + 2}
          fontSize={8} fontFamily="var(--font-mono)" fill="var(--fg-4)"
        >0</text>
        {/* X-axis labels */}
        <text x={PAD_L} y={H - 2}
          fontSize={8} fontFamily="var(--font-mono)" fill="var(--fg-4)"
        >{points[0].date.slice(5)}</text>
        <text x={W - PAD_R} y={H - 2}
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
            <circle cx={hover.x} cy={hover.y} r={2.5} fill={lineColor} pointerEvents="none" />
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
            padding: '2px 6px',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--fg)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {points[hover.idx].date} · {points[hover.idx].value}
        </div>
      )}
    </div>
  );
}
