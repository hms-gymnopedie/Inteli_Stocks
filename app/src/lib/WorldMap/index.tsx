// WorldMap — TopoJSON + d3-geo reimplementation of the previous hand-drawn
// SVG world map (B2-MAP). Same component name and import surface as the old
// `lib/primitives` export so callers don't change.
//
// Inputs:
//   - `pins`:   event markers. Prefer (lat, lng); falls back to legacy (x, y)
//               which is treated as a percent of the SVG viewBox. The cluster
//               number rendered inside the pin is `value` if set, else
//               4/2/1 based on `level`.
//   - `heat`:   region tint. Keys are ISO 3166-1 alpha-3 codes (USA/KOR/...).
//               Unknown keys are silently ignored. The legacy continent-slug
//               keys still pass type-checks (any string is allowed) but won't
//               match any country, so they render as the base color.
//   - `flows`:  decorative flow lines between two map points. Each tuple is
//               `[a, b, c, d]` where (a, b) and (c, d) are either (lng, lat)
//               geographic coordinates OR legacy (x, y) viewBox values. We
//               auto-detect: any |coord| > VIEWBOX_W counts as legacy xy;
//               otherwise we project as lng/lat.
//
// Visual contract (must match the prototype):
//   ocean         #1A1B1D
//   country base  #2E3033
//   country edge  rgba(0,0,0,0.4) @ 0.4px
//   heat          high  rgba(226, 94, 94, 0.22)
//                 med   rgba(232,112, 42, 0.18)
//                 low   rgba(111,207,138, 0.10)
//   pin           #C97A3A circle + halo + white number + grey label
//
// Projection: geoEqualEarth — modern equal-area projection that minimizes the
// pole-stretching that plagues Mercator while staying visually familiar. We
// fit it once to the viewBox via `fitSize`.

import { useMemo } from 'react';
import { geoEqualEarth, geoPath } from 'd3-geo';
import type { GeoProjection } from 'd3-geo';

import type { MapPin, RegionHeat, FlowLine } from '../../data/types';
import { COUNTRIES, iso3 } from './data';

// ─── Visual constants ─────────────────────────────────────────────────────────

const VIEWBOX_W = 1000;
const VIEWBOX_H = 500;

const OCEAN_FILL = '#1A1B1D';
const COUNTRY_FILL = '#2E3033';
const COUNTRY_STROKE = 'rgba(0,0,0,0.4)';

const HEAT_FILL: Record<string, string> = {
  high: 'rgba(226, 94, 94, 0.22)',
  med: 'rgba(232, 112, 42, 0.18)',
  low: 'rgba(111, 207, 138, 0.10)',
};

const PIN_FILL = '#C97A3A';

// ─── Static labels (preserved from the prototype for visual continuity) ──────

const OCEAN_LABELS: { x: number; y: number; t: string; s: number }[] = [
  { x: 60, y: 220, t: 'NORTH', s: 11 },
  { x: 60, y: 235, t: 'PACIFIC', s: 11 },
  { x: 60, y: 250, t: 'OCEAN', s: 11 },
  { x: 380, y: 280, t: 'ATLANTIC', s: 11 },
  { x: 380, y: 295, t: 'OCEAN', s: 11 },
  { x: 670, y: 320, t: 'INDIAN', s: 11 },
  { x: 670, y: 335, t: 'OCEAN', s: 11 },
  { x: 880, y: 220, t: 'PACIFIC', s: 11 },
];

/** Place labels keyed by lat/lng so they follow the projection. */
const PLACE_LABELS: { lng: number; lat: number; t: string; s: number }[] = [
  { lng: -98, lat: 39, t: 'United States', s: 7.5 },
  { lng: -106, lat: 56, t: 'Canada', s: 7.5 },
  { lng: -102, lat: 23, t: 'Mexico', s: 7 },
  { lng: -53, lat: -10, t: 'Brazil', s: 7.5 },
  { lng: -64, lat: -38, t: 'Argentina', s: 7 },
  { lng: 10, lat: 50, t: 'Europe', s: 7.5 },
  { lng: 22, lat: 4, t: 'Africa', s: 7.5 },
  { lng: 45, lat: 24, t: 'Saudi Arabia', s: 7 },
  { lng: 100, lat: 62, t: 'Russia', s: 7.5 },
  { lng: 105, lat: 35, t: 'China', s: 7.5 },
  { lng: 79, lat: 22, t: 'India', s: 7 },
  { lng: 127.5, lat: 36, t: 'Korea', s: 7 },
  { lng: 138, lat: 36, t: 'Japan', s: 7 },
  { lng: 134, lat: -25, t: 'Australia', s: 7.5 },
  { lng: 108, lat: 14, t: 'Vietnam', s: 6.5 },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface WorldMapProps {
  pins?: MapPin[];
  /** Heat tint by ISO 3166-1 alpha-3 country code (`USA`, `KOR`, ...). */
  heat?: RegionHeat | Record<string, string>;
  /**
   * Flow lines. Each `[a, b, c, d]` is interpreted as (lng, lat) → (lng, lat)
   * by default; legacy viewBox coordinates are auto-detected when any value
   * exceeds 180 (lng/lat valid range), keeping older callers working.
   */
  flows?: FlowLine[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Decide whether a flow tuple looks like geographic (lng/lat) or legacy (x/y). */
function isGeographic(flow: FlowLine): boolean {
  return flow.every((v) => Math.abs(v) <= 180);
}

/** Project a pin to (x, y) viewBox coordinates. */
function projectPin(p: MapPin, projection: GeoProjection): [number, number] {
  if (typeof p.lng === 'number' && typeof p.lat === 'number') {
    const projected = projection([p.lng, p.lat]);
    if (projected) return projected;
  }
  // Legacy fallback: treat x/y as viewBox values directly. Scale them in case
  // someone supplied 0..100 percentages instead of 0..1000 viewBox units.
  const x = p.x > 1 ? p.x : p.x * VIEWBOX_W;
  const y = p.y > 1 ? p.y : p.y * VIEWBOX_H;
  return [x, y];
}

/** Cluster size in px from the pin's value or level. */
function pinRadius(p: MapPin): number {
  const v = p.value ?? 0;
  if (v > 5000) return 22;
  if (v > 1500) return 18;
  if (v > 500) return 15;
  return 12;
}

/** Number rendered inside the pin (value, or count derived from risk level). */
function pinNumber(p: MapPin): number {
  if (typeof p.value === 'number') return p.value;
  if (p.level === 'high') return 4;
  if (p.level === 'med') return 2;
  return 1;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WorldMap({ pins = [], heat = {}, flows = [] }: WorldMapProps) {
  // Build the projection + path generator once. Re-fit only if the COUNTRIES
  // collection changes (it doesn't — it's a module-level constant).
  const { projection, pathGen } = useMemo(() => {
    const proj = geoEqualEarth().fitSize([VIEWBOX_W, VIEWBOX_H], COUNTRIES);
    return { projection: proj, pathGen: geoPath(proj) };
  }, []);

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      style={{ display: 'block' }}
      role="img"
      aria-label="Geopolitical risk world map"
    >
      <defs>
        <radialGradient id="map-vignette" cx="50%" cy="50%" r="75%">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
        </radialGradient>
      </defs>

      {/* Ocean */}
      <rect width={VIEWBOX_W} height={VIEWBOX_H} fill={OCEAN_FILL} />

      {/* Ocean labels (static viewBox positions — they don't need to project) */}
      <g
        fill="rgba(255,255,255,0.18)"
        fontFamily="Inter, sans-serif"
        fontWeight={300}
        letterSpacing="0.18em"
        textAnchor="start"
      >
        {OCEAN_LABELS.map((l, i) => (
          <text key={i} x={l.x} y={l.y} fontSize={l.s}>
            {l.t}
          </text>
        ))}
      </g>

      {/* Countries — base + heat overlay */}
      <g>
        {COUNTRIES.features.map((f, i) => {
          const d = pathGen(f) ?? '';
          if (!d) return null;
          const code = iso3(f);
          const level = code ? heat[code] : undefined;
          const heatFill = level ? HEAT_FILL[level] : null;
          return (
            <g key={code ?? i}>
              <path
                d={d}
                fill={COUNTRY_FILL}
                stroke={COUNTRY_STROKE}
                strokeWidth={0.4}
                strokeLinejoin="round"
              />
              {heatFill && <path d={d} fill={heatFill} />}
            </g>
          );
        })}
      </g>

      {/* Place labels — projected so they stay anchored to actual geography */}
      <g
        fill="rgba(220, 220, 225, 0.55)"
        fontFamily="Inter, sans-serif"
        fontWeight={400}
        textAnchor="middle"
      >
        {PLACE_LABELS.map((l, i) => {
          const xy = projection([l.lng, l.lat]);
          if (!xy) return null;
          return (
            <text key={i} x={xy[0]} y={xy[1]} fontSize={l.s}>
              {l.t}
            </text>
          );
        })}
      </g>

      {/* Trade flow lines */}
      <g>
        {flows.map((f, i) => {
          const geo = isGeographic(f);
          const a = geo ? projection([f[0], f[1]]) : [f[0], f[1]];
          const b = geo ? projection([f[2], f[3]]) : [f[2], f[3]];
          if (!a || !b) return null;
          const mx = (a[0] + b[0]) / 2;
          const my = (a[1] + b[1]) / 2 - 50;
          return (
            <path
              key={i}
              d={`M ${a[0]} ${a[1]} Q ${mx} ${my}, ${b[0]} ${b[1]}`}
              stroke="rgba(232, 112, 42, 0.5)"
              strokeWidth={1}
              fill="none"
              strokeDasharray="3 4"
            />
          );
        })}
      </g>

      {/* Event pins */}
      <g>
        {pins.map((p, i) => {
          const [x, y] = projectPin(p, projection);
          const r = pinRadius(p);
          const num = pinNumber(p);
          return (
            <g key={i} transform={`translate(${x} ${y})`}>
              <circle r={r + 6} fill={PIN_FILL} opacity={0.18} />
              <circle
                r={r}
                fill={PIN_FILL}
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
                {num.toLocaleString()}
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
      </g>

      {/* Vignette */}
      <rect
        width={VIEWBOX_W}
        height={VIEWBOX_H}
        fill="url(#map-vignette)"
        pointerEvents="none"
      />

      {/* Scale bar */}
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
