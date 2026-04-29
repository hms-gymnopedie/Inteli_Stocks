import { useMemo } from 'react';

function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function buildPath(pts: number[][]) {
  return pts
    .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
    .join(' ');
}

export function generateSeries(opts: {
  count?: number;
  w?: number;
  h?: number;
  seed?: number;
  trend?: number;
  vol?: number;
  pad?: number;
}) {
  const {
    count = 60,
    w = 400,
    h = 80,
    seed = 1,
    trend = 0.4,
    vol = 1,
    pad = 4,
  } = opts;
  const r = seededRand(seed);
  const ys: number[] = [];
  let v = 0.5;
  for (let i = 0; i < count; i++) {
    v += (r() - 0.5) * 0.18 * vol + trend * 0.005;
    v = Math.max(0.05, Math.min(0.95, v));
    ys.push(v);
  }
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  return ys.map((y, i) => [
    pad + (i / (count - 1)) * (w - pad * 2),
    pad + (1 - (y - min) / span) * (h - pad * 2),
  ]);
}

// ---------- LINE CHART ----------

interface LineChartProps {
  w?: number;
  h?: number;
  seed?: number;
  trend?: number;
  vol?: number;
  stroke?: string;
  strokeWidth?: number;
  accent?: boolean;
  area?: boolean;
  grid?: boolean;
  dashedTarget?: boolean;
  label?: string;
  accentRange?: [number, number] | null;
}

export function LineChart({
  w = 400,
  h = 80,
  seed = 1,
  trend = 0.3,
  vol = 1,
  stroke = 'var(--fg)',
  strokeWidth = 1.2,
  accent = false,
  area = false,
  grid = false,
  dashedTarget = false,
  label,
  accentRange = null,
}: LineChartProps) {
  const pts = useMemo(
    () => generateSeries({ w, h, seed, trend, vol }),
    [w, h, seed, trend, vol],
  );
  const accentPts = useMemo(
    () =>
      accent
        ? generateSeries({ w, h, seed: seed + 99, trend: -0.2, vol: 0.7 })
        : null,
    [w, h, seed, accent],
  );
  const path = buildPath(pts);
  const accentPath = accentPts ? buildPath(accentPts) : null;
  const areaPath = `${path} L${pts[pts.length - 1][0]},${h} L${pts[0][0]},${h} Z`;

  const gradientId = `area-grad-${seed}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      preserveAspectRatio="none"
    >
      {grid && (
        <g stroke="var(--hairline)" strokeWidth={0.5} opacity={0.6}>
          {[0.25, 0.5, 0.75].map((y, i) => (
            <line
              key={i}
              x1={0}
              x2={w}
              y1={h * y}
              y2={h * y}
              strokeDasharray="2 4"
            />
          ))}
        </g>
      )}
      {dashedTarget && (
        <line
          x1={0}
          x2={w}
          y1={h * 0.35}
          y2={h * 0.35}
          stroke="var(--fg-4)"
          strokeWidth={0.7}
          strokeDasharray="3 4"
        />
      )}
      {accentRange && (
        <rect
          x={accentRange[0] * w}
          y={0}
          width={(accentRange[1] - accentRange[0]) * w}
          height={h}
          fill="var(--orange-glow)"
        />
      )}
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--fg)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--fg)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={areaPath} fill={`url(#${gradientId})`} opacity={0.4} />}
      {accentPath && (
        <path
          d={accentPath}
          fill="none"
          stroke="var(--orange)"
          strokeWidth={strokeWidth}
          opacity={0.9}
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {label && (
        <text
          x={w - 6}
          y={12}
          textAnchor="end"
          fontSize={9}
          fontFamily="var(--font-mono)"
          fill="var(--fg-3)"
        >
          {label}
        </text>
      )}
    </svg>
  );
}

// ---------- CANDLES ----------

export function CandleChart({
  w = 400,
  h = 100,
  count = 50,
  seed = 5,
}: {
  w?: number;
  h?: number;
  count?: number;
  seed?: number;
}) {
  const candles = useMemo(() => {
    const r = seededRand(seed);
    const out: { open: number; close: number; hi: number; lo: number }[] = [];
    let v = 0.5;
    for (let i = 0; i < count; i++) {
      const open = v;
      v += (r() - 0.5) * 0.1;
      v = Math.max(0.1, Math.min(0.9, v));
      const close = v;
      const hi = Math.max(open, close) + r() * 0.05;
      const lo = Math.min(open, close) - r() * 0.05;
      out.push({ open, close, hi, lo });
    }
    return out;
  }, [count, seed]);
  const cw = (w - 8) / count;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      preserveAspectRatio="none"
    >
      {candles.map((c, i) => {
        const x = 4 + i * cw + cw / 2;
        const yO = (1 - c.open) * h;
        const yC = (1 - c.close) * h;
        const yH = (1 - c.hi) * h;
        const yL = (1 - c.lo) * h;
        const up = c.close >= c.open;
        const color = up ? 'var(--up)' : 'var(--down)';
        return (
          <g key={i} stroke={color} fill={color}>
            <line x1={x} x2={x} y1={yH} y2={yL} strokeWidth={0.6} />
            <rect
              x={x - cw * 0.32}
              y={Math.min(yO, yC)}
              width={cw * 0.64}
              height={Math.abs(yO - yC) || 1}
              fillOpacity={up ? 0.85 : 1}
            />
          </g>
        );
      })}
    </svg>
  );
}

// ---------- BARS ----------

export function BarChart({
  w = 400,
  h = 60,
  count = 30,
  seed = 7,
  accent = false,
}: {
  w?: number;
  h?: number;
  count?: number;
  seed?: number;
  accent?: boolean;
}) {
  const bars = useMemo(() => {
    const r = seededRand(seed);
    return Array.from({ length: count }, () => r());
  }, [count, seed]);
  const cw = (w - 4) / count;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      preserveAspectRatio="none"
    >
      {bars.map((b, i) => {
        const x = 2 + i * cw;
        const bh = b * (h - 4);
        const isAccent = accent && (i % 7 === 3 || i % 7 === 4);
        return (
          <rect
            key={i}
            x={x}
            y={h - bh - 2}
            width={cw * 0.7}
            height={bh}
            fill={isAccent ? 'var(--orange)' : 'var(--fg-3)'}
            opacity={isAccent ? 0.95 : 0.55}
          />
        );
      })}
    </svg>
  );
}

// ---------- DIVERGING SECTOR BARS ----------

export function SectorBars({
  items,
}: {
  items: { name: string; v: number }[];
}) {
  const max = Math.max(...items.map((i) => Math.abs(i.v)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((it, i) => {
        const pct = (Math.abs(it.v) / max) * 50;
        const positive = it.v >= 0;
        return (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr 56px',
              alignItems: 'center',
              gap: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
            }}
          >
            <div
              className="muted"
              style={{
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {it.name}
            </div>
            <div
              style={{
                position: 'relative',
                height: 10,
                background: 'transparent',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: 'var(--hairline)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 1,
                  bottom: 1,
                  ...(positive ? { left: '50%' } : { right: '50%' }),
                  width: `${pct}%`,
                  background: positive ? 'var(--up)' : 'var(--down)',
                  opacity: 0.7,
                }}
              />
            </div>
            <div
              style={{
                textAlign: 'right',
                color: positive ? 'var(--up)' : 'var(--down)',
              }}
            >
              {positive ? '+' : ''}
              {it.v.toFixed(2)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- HEAT GRID ----------

export function HeatGrid({
  cells,
  cols = 6,
}: {
  cells: { t: string; v: number }[];
  cols?: number;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 2,
      }}
    >
      {cells.map((c, i) => {
        const a = Math.min(1, Math.abs(c.v) / 4);
        const bg =
          c.v >= 0
            ? `rgba(111, 207, 138, ${0.1 + a * 0.55})`
            : `rgba(226, 94, 94, ${0.1 + a * 0.55})`;
        return (
          <div
            key={i}
            style={{
              background: bg,
              padding: '8px 6px',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid rgba(255,255,255,0.04)',
              minHeight: 44,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--fg)',
                letterSpacing: '0.04em',
              }}
            >
              {c.t}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--fg-2)',
                marginTop: 'auto',
              }}
            >
              {c.v >= 0 ? '+' : ''}
              {c.v.toFixed(2)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- GAUGE ----------

export function Gauge({
  value = 62,
  label = 'Greed',
}: {
  value?: number;
  label?: string;
}) {
  const r = 50;
  const cx = 60;
  const cy = 56;
  const start = Math.PI;
  const end = 2 * Math.PI;
  const ang = start + (value / 100) * (end - start);
  const tx = cx + r * Math.cos(ang);
  const ty = cy + r * Math.sin(ang);
  return (
    <svg viewBox="0 0 120 70" width="100%" height={80}>
      <defs>
        <linearGradient id="gauge-grad" x1="0" x2="1">
          <stop offset="0%" stopColor="#E25E5E" />
          <stop offset="50%" stopColor="#E8702A" />
          <stop offset="100%" stopColor="#6FCF8A" />
        </linearGradient>
      </defs>
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke="var(--hairline-2)"
        strokeWidth={6}
        fill="none"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke="url(#gauge-grad)"
        strokeWidth={6}
        fill="none"
        strokeDasharray={`${(value / 100) * Math.PI * r} ${Math.PI * r}`}
      />
      <circle cx={tx} cy={ty} r={3.5} fill="#fff" />
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        fontSize={18}
        fontFamily="var(--font-sans)"
        fontWeight={200}
        fill="var(--fg)"
      >
        {value}
      </text>
      <text
        x={cx}
        y={cy + 6}
        textAnchor="middle"
        fontSize={8}
        fontFamily="var(--font-mono)"
        letterSpacing={2}
        fill="var(--fg-3)"
      >
        {label.toUpperCase()}
      </text>
    </svg>
  );
}

// ---------- SPARK ----------

export function Spark({
  w = 80,
  h = 22,
  seed = 1,
  trend = 0,
  color = 'var(--fg-2)',
}: {
  w?: number;
  h?: number;
  seed?: number;
  trend?: number;
  color?: string;
}) {
  const pts = useMemo(
    () => generateSeries({ w, h, seed, trend, vol: 0.8, pad: 2, count: 30 }),
    [w, h, seed, trend],
  );
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
      <path d={buildPath(pts)} stroke={color} strokeWidth={1} fill="none" />
    </svg>
  );
}

// ---------- WORLD MAP ----------
//
// The hand-drawn SVG WorldMap was replaced in B2-MAP by a real TopoJSON-based
// component under `./WorldMap` (using d3-geo + topojson-client + world-atlas).
// We re-export it here to preserve the existing import path
// `import { WorldMap } from '../../lib/primitives'` for any caller that has
// not migrated yet. New code should import directly from `./WorldMap`.
export { WorldMap } from './WorldMap';
