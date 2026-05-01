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
//
// B2-MAP-2 — interaction additions:
//   - `onPinClick` prop: each pin renders as a focusable `<g role="button">`
//     with click + Enter/Space support and an `aria-label` describing the
//     region.
//   - `interactive` prop (default true): enables wheel zoom, pointer drag,
//     touch pinch, keyboard shortcuts (Arrow* / +/- / 0), and a corner reset
//     button overlay. When the transform is identity (scale=1, tx=ty=0) the
//     SVG output is byte-identical to the pre-B2-MAP-2 renderer.
//   - Zoom/pan math is factored into ./zoom.ts for unit testability.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { geoEqualEarth, geoPath } from 'd3-geo';
import type { GeoProjection } from 'd3-geo';

import type { MapPin, RegionHeat, FlowLine } from '../../data/types';
import { COUNTRIES, iso3 } from './data';
import {
  applyPan,
  applyZoomAt,
  applyWheelZoom,
  clampScale,
  IDENTITY_TRANSFORM,
  ZOOM_KEY_STEP,
  ZOOM_PAN_KEY_STEP,
  type ZoomTransform,
} from './zoom';

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
  /**
   * B2-MAP-2 — pin click handler. When set, each pin renders as a focusable
   * `<g role="button">` with click + Enter/Space activation and an
   * `aria-label`. When omitted, pins remain decorative.
   */
  onPinClick?: (pin: MapPin) => void;
  /**
   * B2-MAP-2 — opt out of zoom/pan/keyboard handlers. Default `true`. When
   * `false`, the SVG is fully static and matches the pre-B2-MAP-2 visual
   * output exactly.
   */
  interactive?: boolean;
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

export function WorldMap({
  pins = [],
  heat = {},
  flows = [],
  onPinClick,
  interactive = true,
}: WorldMapProps) {
  // Build the projection + path generator once. Re-fit only if the COUNTRIES
  // collection changes (it doesn't — it's a module-level constant).
  const { projection, pathGen } = useMemo(() => {
    const proj = geoEqualEarth().fitSize([VIEWBOX_W, VIEWBOX_H], COUNTRIES);
    return { projection: proj, pathGen: geoPath(proj) };
  }, []);

  // ─── Zoom / pan state ──────────────────────────────────────────────────────
  const [transform, setTransform] = useState<ZoomTransform>(IDENTITY_TRANSFORM);
  const svgRef = useRef<SVGSVGElement | null>(null);
  /** Active mouse/pen drag, captured to the SVG via Pointer Capture. */
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
  } | null>(null);
  /** Active two-finger pinch state. */
  const pinchStateRef = useRef<{
    pinchStart: number;
    center: { x: number; y: number };
    startScale: number;
  } | null>(null);

  const reset = useCallback(() => setTransform(IDENTITY_TRANSFORM), []);

  /**
   * Convert client (mouse/touch) coordinates to viewBox-space, accounting for
   * `preserveAspectRatio="xMidYMid slice"` (the SVG fills the container,
   * cropping the longer axis). The rendered scale is `max(rect.w / vb.w,
   * rect.h / vb.h)`; we undo the resulting centering offset on the cropped
   * axis. Used by wheel and pinch handlers to zoom centered on the cursor /
   * pinch midpoint.
   */
  const clientToViewBox = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: VIEWBOX_W / 2, y: VIEWBOX_H / 2 };
      const rect = svg.getBoundingClientRect();
      const sx = rect.width / VIEWBOX_W;
      const sy = rect.height / VIEWBOX_H;
      const renderScale = Math.max(sx, sy);
      const renderedW = VIEWBOX_W * renderScale;
      const renderedH = VIEWBOX_H * renderScale;
      const offsetX = (rect.width - renderedW) / 2;
      const offsetY = (rect.height - renderedH) / 2;
      return {
        x: (clientX - rect.left - offsetX) / renderScale,
        y: (clientY - rect.top - offsetY) / renderScale,
      };
    },
    [],
  );

  // ─── Wheel zoom ────────────────────────────────────────────────────────────
  // Attach as a non-passive native listener so `preventDefault()` actually
  // stops page scrolling — React's synthetic wheel handler is registered as
  // passive in Chrome.
  useEffect(() => {
    if (!interactive) return;
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y } = clientToViewBox(e.clientX, e.clientY);
      setTransform((prev) =>
        applyWheelZoom(prev, e.deltaY, x, y, VIEWBOX_W, VIEWBOX_H),
      );
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [interactive, clientToViewBox]);

  // ─── Mouse / pen drag pan ──────────────────────────────────────────────────
  const onPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (!interactive) return;
      // If the pointerdown landed on a pin, let the pin's `<g role="button">`
      // handle the click — bail out of drag start.
      const target = e.target as Element | null;
      if (target && target.closest('[data-pin="true"]')) return;
      // Touch is handled by the touch handlers (so we can detect 2-finger
      // pinch). Skip the synthesized pointer events.
      if (e.pointerType === 'touch') return;
      // Only primary mouse button.
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      svgRef.current?.setPointerCapture(e.pointerId);
      dragStateRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startTx: transform.tx,
        startTy: transform.ty,
      };
    },
    [interactive, transform.tx, transform.ty],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const svg = svgRef.current;
      if (!svg) return;
      // Convert client-px delta to viewBox units using the rendered scale,
      // so dragging by N pixels moves the map by N pixels regardless of zoom.
      const rect = svg.getBoundingClientRect();
      const renderScale = Math.max(rect.width / VIEWBOX_W, rect.height / VIEWBOX_H);
      const dxView = (e.clientX - drag.startX) / renderScale;
      const dyView = (e.clientY - drag.startY) / renderScale;
      setTransform((prev) =>
        applyPan(
          // Re-base from drag-start so successive moves don't compound.
          { tx: drag.startTx, ty: drag.startTy, scale: prev.scale },
          dxView,
          dyView,
          VIEWBOX_W,
          VIEWBOX_H,
        ),
      );
    },
    [],
  );

  const onPointerUp = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragStateRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      dragStateRef.current = null;
      try {
        svgRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture may have already been released — non-fatal.
      }
    }
  }, []);

  // ─── Touch: 1-finger pan + 2-finger pinch ─────────────────────────────────
  const onTouchStart = useCallback(
    (e: ReactTouchEvent<SVGSVGElement>) => {
      if (!interactive) return;
      if (e.touches.length === 2) {
        const [t1, t2] = [e.touches[0], e.touches[1]];
        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        const dist = Math.hypot(dx, dy);
        const midClient = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
        pinchStateRef.current = {
          pinchStart: dist,
          center: clientToViewBox(midClient.x, midClient.y),
          startScale: transform.scale,
        };
      } else if (e.touches.length === 1) {
        const target = e.target as Element | null;
        if (target && target.closest('[data-pin="true"]')) return;
        const t = e.touches[0];
        dragStateRef.current = {
          pointerId: -1,
          startX: t.clientX,
          startY: t.clientY,
          startTx: transform.tx,
          startTy: transform.ty,
        };
      }
    },
    [interactive, clientToViewBox, transform.scale, transform.tx, transform.ty],
  );

  const onTouchMove = useCallback(
    (e: ReactTouchEvent<SVGSVGElement>) => {
      if (!interactive) return;
      const pinch = pinchStateRef.current;
      if (e.touches.length === 2 && pinch) {
        e.preventDefault();
        const [t1, t2] = [e.touches[0], e.touches[1]];
        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        const dist = Math.hypot(dx, dy);
        const factor = dist / pinch.pinchStart;
        const targetScale = clampScale(pinch.startScale * factor);
        setTransform((prev) =>
          applyZoomAt(
            prev,
            targetScale / prev.scale,
            pinch.center.x,
            pinch.center.y,
            VIEWBOX_W,
            VIEWBOX_H,
          ),
        );
      } else if (
        e.touches.length === 1 &&
        dragStateRef.current?.pointerId === -1
      ) {
        e.preventDefault();
        const drag = dragStateRef.current;
        const t = e.touches[0];
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const renderScale = Math.max(
          rect.width / VIEWBOX_W,
          rect.height / VIEWBOX_H,
        );
        const dxView = (t.clientX - drag.startX) / renderScale;
        const dyView = (t.clientY - drag.startY) / renderScale;
        setTransform((prev) =>
          applyPan(
            { tx: drag.startTx, ty: drag.startTy, scale: prev.scale },
            dxView,
            dyView,
            VIEWBOX_W,
            VIEWBOX_H,
          ),
        );
      }
    },
    [interactive],
  );

  const onTouchEnd = useCallback((e: ReactTouchEvent<SVGSVGElement>) => {
    if (e.touches.length < 2) {
      pinchStateRef.current = null;
    }
    if (e.touches.length === 0) {
      dragStateRef.current = null;
    }
  }, []);

  // ─── Keyboard shortcuts (when SVG is focused) ─────────────────────────────
  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<SVGSVGElement>) => {
      if (!interactive) return;
      // Defer to the pin handler when a pin has focus (Enter/Space activate
      // the pin, not pan/zoom).
      const tgt = e.target as Element | null;
      if (tgt && tgt.closest('[data-pin="true"]')) return;

      const cx = VIEWBOX_W / 2;
      const cy = VIEWBOX_H / 2;
      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          setTransform((prev) =>
            applyZoomAt(prev, ZOOM_KEY_STEP, cx, cy, VIEWBOX_W, VIEWBOX_H),
          );
          break;
        case '-':
        case '_':
          e.preventDefault();
          setTransform((prev) =>
            applyZoomAt(prev, 1 / ZOOM_KEY_STEP, cx, cy, VIEWBOX_W, VIEWBOX_H),
          );
          break;
        case '0':
          e.preventDefault();
          reset();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setTransform((prev) =>
            applyPan(prev, ZOOM_PAN_KEY_STEP, 0, VIEWBOX_W, VIEWBOX_H),
          );
          break;
        case 'ArrowRight':
          e.preventDefault();
          setTransform((prev) =>
            applyPan(prev, -ZOOM_PAN_KEY_STEP, 0, VIEWBOX_W, VIEWBOX_H),
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setTransform((prev) =>
            applyPan(prev, 0, ZOOM_PAN_KEY_STEP, VIEWBOX_W, VIEWBOX_H),
          );
          break;
        case 'ArrowDown':
          e.preventDefault();
          setTransform((prev) =>
            applyPan(prev, 0, -ZOOM_PAN_KEY_STEP, VIEWBOX_W, VIEWBOX_H),
          );
          break;
      }
    },
    [interactive, reset],
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  const isIdentity =
    transform.scale === 1 && transform.tx === 0 && transform.ty === 0;
  const transformAttr = isIdentity
    ? undefined
    : `translate(${transform.tx} ${transform.ty}) scale(${transform.scale})`;

  return (
    <div
      className="worldmap-root"
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        style={{
          display: 'block',
          touchAction: interactive ? 'none' : 'auto',
          cursor: interactive ? 'grab' : 'default',
        }}
        role="img"
        aria-label="Geopolitical risk world map"
        tabIndex={interactive ? 0 : -1}
        onPointerDown={interactive ? onPointerDown : undefined}
        onPointerMove={interactive ? onPointerMove : undefined}
        onPointerUp={interactive ? onPointerUp : undefined}
        onPointerCancel={interactive ? onPointerUp : undefined}
        onTouchStart={interactive ? onTouchStart : undefined}
        onTouchMove={interactive ? onTouchMove : undefined}
        onTouchEnd={interactive ? onTouchEnd : undefined}
        onKeyDown={interactive ? onKeyDown : undefined}
      >
        <defs>
          <radialGradient id="map-vignette" cx="50%" cy="50%" r="75%">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
          </radialGradient>
          <clipPath id="worldmap-clip">
            <rect width={VIEWBOX_W} height={VIEWBOX_H} />
          </clipPath>
        </defs>

        {/* Ocean — outside the zoom layer so it always fills the viewBox. */}
        <rect width={VIEWBOX_W} height={VIEWBOX_H} fill={OCEAN_FILL} />

        {/* Zoomable layer: countries, place labels, flows, pins all share
            the same transform so they stay aligned. Clipped to the viewBox
            so scaled-up content doesn't bleed past the SVG bounds. */}
        <g transform={transformAttr} clipPath="url(#worldmap-clip)">
          {/* Ocean labels — inside the zoom layer so they pan/zoom with the map. */}
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

          {/* Event pins — clickable + keyboard-activatable when `onPinClick`
              is supplied. The wrapping `<g>` is the focusable element. */}
          <g>
            {pins.map((p, i) => {
              const [x, y] = projectPin(p, projection);
              const r = pinRadius(p);
              const num = pinNumber(p);
              const clickable = !!onPinClick;
              const ariaLabel = `${p.label}${
                p.level ? ` — ${p.level} risk` : ''
              }`;
              return (
                <g
                  key={`${p.label}-${i}`}
                  data-pin="true"
                  transform={`translate(${x} ${y})`}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : -1}
                  aria-label={clickable ? ariaLabel : undefined}
                  onClick={
                    clickable
                      ? (e) => {
                          e.stopPropagation();
                          onPinClick?.(p);
                        }
                      : undefined
                  }
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            onPinClick?.(p);
                          }
                        }
                      : undefined
                  }
                  style={{
                    cursor: clickable ? 'pointer' : 'default',
                    outline: 'none',
                  }}
                >
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
                    pointerEvents="none"
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
                      pointerEvents="none"
                    >
                      {p.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </g>

        {/* Vignette — outside the zoom layer so the dark edge stays glued to
            the viewport regardless of zoom. */}
        <rect
          width={VIEWBOX_W}
          height={VIEWBOX_H}
          fill="url(#map-vignette)"
          pointerEvents="none"
        />

        {/* Scale bar — outside the zoom layer so it stays readable. */}
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

      {/* Reset zoom/pan button — only visible when off-identity. Sits in the
          top-right corner of the map area. */}
      {interactive && !isIdentity && (
        <button
          type="button"
          className="worldmap-reset"
          onClick={reset}
          aria-label="Reset map zoom and pan"
          title="Reset zoom (0)"
        >
          <span aria-hidden="true">⌖</span>
        </button>
      )}
    </div>
  );
}
