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

// ---------- WORLD MAP (Mapbox-dark style with orange cluster pins) ----------

interface WorldMapProps {
  pins?: { x: number; y: number; level?: string; label?: string; value?: number }[];
  heat?: Record<string, string>;
  flows?: number[][];
}

export function WorldMap({
  pins = [],
  heat = {},
  flows = [],
}: WorldMapProps) {
  const continents: Record<string, string> = {
    namerica:
      'M 75 95 L 110 78 L 145 70 L 180 68 L 215 72 L 250 80 L 280 92 L 295 110 L 305 132 L 298 150 L 285 165 L 270 178 L 252 190 L 240 205 L 230 222 L 222 240 L 210 252 L 195 258 L 180 252 L 168 240 L 156 224 L 145 208 L 132 190 L 120 172 L 108 154 L 96 136 L 86 118 L 78 105 Z',
    greenland:
      'M 312 70 L 340 68 L 350 80 L 345 95 L 325 100 L 314 88 Z',
    camerica:
      'M 222 240 L 245 238 L 258 248 L 250 260 L 235 262 L 224 254 Z',
    samerica:
      'M 235 262 L 268 258 L 285 268 L 295 285 L 302 308 L 305 332 L 302 358 L 290 385 L 275 410 L 258 432 L 245 448 L 232 442 L 224 422 L 218 398 L 215 372 L 215 345 L 220 318 L 226 292 Z',
    europe:
      'M 442 105 L 470 96 L 495 92 L 518 95 L 535 102 L 545 115 L 540 128 L 525 138 L 508 142 L 490 145 L 472 142 L 458 135 L 446 124 L 438 114 Z',
    uk: 'M 422 108 L 432 104 L 438 118 L 432 130 L 422 128 Z',
    scand: 'M 488 78 L 510 70 L 525 78 L 520 92 L 505 95 L 492 92 Z',
    africa:
      'M 458 158 L 490 152 L 522 158 L 545 175 L 562 198 L 575 225 L 580 255 L 575 285 L 565 315 L 550 342 L 530 365 L 508 380 L 488 382 L 470 372 L 455 355 L 445 332 L 438 305 L 435 275 L 438 245 L 444 215 L 450 188 Z',
    arabia:
      'M 545 175 L 575 172 L 595 188 L 600 210 L 585 222 L 565 218 L 552 205 L 545 192 Z',
    asia:
      'M 545 102 L 580 92 L 620 88 L 660 86 L 705 88 L 745 95 L 780 105 L 808 118 L 832 135 L 848 155 L 852 175 L 845 192 L 825 205 L 800 210 L 770 208 L 738 205 L 705 200 L 672 198 L 640 195 L 612 188 L 588 180 L 568 168 L 552 152 L 542 132 L 540 115 Z',
    india:
      'M 660 198 L 695 198 L 710 218 L 712 245 L 700 268 L 685 280 L 672 272 L 663 252 L 658 228 Z',
    seasia:
      'M 740 205 L 775 215 L 795 230 L 810 250 L 808 270 L 790 282 L 770 282 L 750 270 L 740 252 L 738 232 Z',
    indonesia1:
      'M 760 295 L 790 300 L 815 305 L 830 312 L 820 320 L 798 320 L 775 316 L 760 308 Z',
    indonesia2:
      'M 832 318 L 858 322 L 870 332 L 855 340 L 838 336 Z',
    philippines: 'M 815 235 L 825 240 L 828 258 L 818 268 L 810 252 Z',
    australia:
      'M 805 350 L 858 345 L 895 358 L 912 380 L 905 405 L 875 418 L 838 418 L 808 408 L 795 388 L 798 368 Z',
    nz: 'M 932 410 L 945 412 L 948 425 L 942 432 L 932 428 Z',
    japan: 'M 838 130 L 855 128 L 866 145 L 858 165 L 845 168 L 836 152 Z',
    korea: 'M 808 145 L 822 145 L 825 165 L 815 170 L 808 158 Z',
    madagascar: 'M 590 320 L 600 328 L 605 348 L 595 360 L 588 348 Z',
  };

  const oceanLabels = [
    { x: 60, y: 220, t: 'NORTH', s: 11 },
    { x: 60, y: 235, t: 'PACIFIC', s: 11 },
    { x: 60, y: 250, t: 'OCEAN', s: 11 },
    { x: 380, y: 280, t: 'ATLANTIC', s: 11 },
    { x: 380, y: 295, t: 'OCEAN', s: 11 },
    { x: 670, y: 320, t: 'INDIAN', s: 11 },
    { x: 670, y: 335, t: 'OCEAN', s: 11 },
    { x: 880, y: 220, t: 'PACIFIC', s: 11 },
  ];

  const placeLabels = [
    { x: 175, y: 130, t: 'United States', s: 7.5 },
    { x: 200, y: 100, t: 'Canada', s: 7.5 },
    { x: 250, y: 260, t: 'Mexico', s: 7 },
    { x: 270, y: 360, t: 'Brazil', s: 7.5 },
    { x: 250, y: 410, t: 'Argentina', s: 7 },
    { x: 480, y: 120, t: 'Europe', s: 7.5 },
    { x: 500, y: 280, t: 'Africa', s: 7.5 },
    { x: 575, y: 200, t: 'Saudi Arabia', s: 7 },
    { x: 670, y: 130, t: 'Russia', s: 7.5 },
    { x: 710, y: 175, t: 'China', s: 7.5 },
    { x: 685, y: 245, t: 'India', s: 7 },
    { x: 815, y: 158, t: 'Korea', s: 7 },
    { x: 850, y: 145, t: 'Japan', s: 7 },
    { x: 845, y: 380, t: 'Australia', s: 7.5 },
    { x: 770, y: 245, t: 'Vietnam', s: 6.5 },
  ];

  const heatColor = (level?: string) => {
    if (level === 'high') return 'rgba(226, 94, 94, 0.22)';
    if (level === 'med') return 'rgba(232, 112, 42, 0.18)';
    if (level === 'low') return 'rgba(111, 207, 138, 0.10)';
    return null;
  };

  return (
    <svg
      viewBox="0 0 1000 500"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      style={{ display: 'block' }}
    >
      <defs>
        <radialGradient id="map-vignette" cx="50%" cy="50%" r="75%">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
        </radialGradient>
      </defs>

      <rect width={1000} height={500} fill="#1A1B1D" />

      <g
        fill="rgba(255,255,255,0.18)"
        fontFamily="Inter, sans-serif"
        fontWeight={300}
        letterSpacing="0.18em"
        textAnchor="start"
      >
        {oceanLabels.map((l, i) => (
          <text key={i} x={l.x} y={l.y} fontSize={l.s}>
            {l.t}
          </text>
        ))}
      </g>

      {Object.entries(continents).map(([k, d]) => {
        const baseKey = k.replace(/[12]$/, '');
        const heatFill = heatColor(heat[baseKey]);
        return (
          <g key={k}>
            <path
              d={d}
              fill="#2E3033"
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={0.4}
              strokeLinejoin="round"
            />
            {heatFill && <path d={d} fill={heatFill} />}
          </g>
        );
      })}

      <g
        fill="rgba(220, 220, 225, 0.55)"
        fontFamily="Inter, sans-serif"
        fontWeight={400}
        textAnchor="middle"
      >
        {placeLabels.map((l, i) => (
          <text key={i} x={l.x} y={l.y} fontSize={l.s}>
            {l.t}
          </text>
        ))}
      </g>

      {flows.map((f, i) => {
        const mx = (f[0] + f[2]) / 2;
        const my = (f[1] + f[3]) / 2 - 50;
        return (
          <path
            key={i}
            d={`M ${f[0]} ${f[1]} Q ${mx} ${my}, ${f[2]} ${f[3]}`}
            stroke="rgba(232, 112, 42, 0.5)"
            strokeWidth={1}
            fill="none"
            strokeDasharray="3 4"
          />
        );
      })}

      {pins.map((p, i) => {
        const r =
          (p.value ?? 0) > 5000
            ? 22
            : (p.value ?? 0) > 1500
              ? 18
              : (p.value ?? 0) > 500
                ? 15
                : 12;
        const num =
          p.value ??
          (p.level === 'high' ? 4 : p.level === 'med' ? 2 : 1);
        const fill = '#C97A3A';
        return (
          <g key={i} transform={`translate(${p.x} ${p.y})`}>
            <circle r={r + 6} fill={fill} opacity={0.18} />
            <circle
              r={r}
              fill={fill}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={0.6}
            />
            <text
              textAnchor="middle"
              y={3.5}
              fontSize={r > 18 ? 11 : r > 14 ? 10 : 9}
              fontFamily="Inter, sans-serif"
              fontWeight={500}
              fill="#fff"
            >
              {typeof num === 'number' ? num.toLocaleString() : num}
            </text>
            {p.label && (
              <text
                textAnchor="middle"
                y={r + 14}
                fontSize={7}
                fontFamily="Inter, sans-serif"
                fill="rgba(220,220,225,0.7)"
                letterSpacing="0.04em"
              >
                {p.label}
              </text>
            )}
          </g>
        );
      })}

      <rect
        width={1000}
        height={500}
        fill="url(#map-vignette)"
        pointerEvents="none"
      />

      <g transform="translate(20 20)">
        <rect
          width={80}
          height={14}
          rx={2}
          fill="rgba(0,0,0,0.6)"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={0.5}
        />
        <text
          x={40}
          y={10}
          textAnchor="middle"
          fontSize={8}
          fontFamily="Inter, sans-serif"
          fill="rgba(255,255,255,0.7)"
        >
          1000 km
        </text>
      </g>
    </svg>
  );
}
