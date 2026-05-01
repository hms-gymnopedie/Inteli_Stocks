// WorldMap zoom/pan helpers (B2-MAP-2).
//
// The primitive applies a single SVG `<g transform="translate(tx, ty) scale(s)">`
// wrapper around the country paths + flows + pins. State here is just three
// numbers describing that transform — keeping the math pure so the helpers can
// be unit-tested without React.
//
// Coordinate system:
//   - The SVG viewBox is fixed at `viewboxW × viewboxH` (matches the renderer).
//   - `tx`, `ty` are in viewBox units, applied BEFORE `scale`, so a positive
//     `tx` shifts content right by that many viewBox units regardless of zoom.
//   - The transform formula is therefore: screen_xy = (content_xy * scale) + (tx, ty)
//     when written in the "scale, then translate" order, but because SVG
//     applies `transform="translate(tx,ty) scale(s)"` left-to-right, the
//     content is FIRST translated (by tx/ty in original units) THEN scaled.
//     To keep behavior intuitive (drag deltas = pixel movement on screen) we
//     interpret tx/ty as POST-scale screen offsets. The renderer composes the
//     matrix in that order: `translate(tx,ty) scale(s)` where the meaning of
//     translate is "shift the already-scaled content by (tx, ty) viewBox
//     units". A drag of `dx` viewBox-px adds exactly `dx` to `tx`.
//
// Bounds:
//   - Scale: clamped to `[MIN_SCALE, MAX_SCALE]`.
//   - Pan:   loosely clamped so the map can't be dragged completely off-screen.
//     We allow the content to move by at most `(scale - 1)` viewBox dimensions
//     in each axis, which lets you push the edge of a zoomed-in map flush with
//     the viewport edge but no further. At scale=1 this reduces to no panning,
//     which matches the spec ("when scale === 1 and tx === ty === 0, behavior
//     is identical to today").

export const MIN_SCALE = 1;
export const MAX_SCALE = 8;

/** Wheel-tick → scale multiplier sensitivity. Smaller = slower zoom. */
export const WHEEL_SENSITIVITY = 0.001;

/** Per-keystroke zoom factor for `+`/`-`/`=`. */
export const ZOOM_KEY_STEP = 1.2;

/** Per-keystroke pan distance (viewBox-px) for arrow keys at scale=1. */
export const ZOOM_PAN_KEY_STEP = 40;

export interface ZoomTransform {
  /** X translation in viewBox units, post-scale. */
  tx: number;
  /** Y translation in viewBox units, post-scale. */
  ty: number;
  /** Scale factor, clamped to [MIN_SCALE, MAX_SCALE]. */
  scale: number;
}

export const IDENTITY_TRANSFORM: ZoomTransform = { tx: 0, ty: 0, scale: 1 };

export function clampScale(s: number): number {
  if (!Number.isFinite(s)) return MIN_SCALE;
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
}

/**
 * Clamp a translation pair so the zoomed-in content can be panned to the
 * viewport edge but not beyond. `viewboxW`/`viewboxH` are the SVG viewBox
 * dimensions (not screen pixels — but the ratio is what matters).
 */
export function clampPan(
  tx: number,
  ty: number,
  scale: number,
  viewboxW: number,
  viewboxH: number,
): { tx: number; ty: number } {
  const s = clampScale(scale);
  // At s=1, no panning is possible. At s=8, the content overflows the viewBox
  // by 7×, so we allow tx ∈ [-(s-1)·W, 0] and ty ∈ [-(s-1)·H, 0]. Tx/ty here
  // are post-scale offsets, so the bound is symmetric: when content is at
  // (tx=0, ty=0) and scale>1, the top-left of the (1×) content is at the
  // top-left of the viewport, but the bottom-right extends beyond — pulling
  // tx/ty negative shifts the content up-left to expose the bottom-right.
  const maxOffsetX = (s - 1) * viewboxW;
  const maxOffsetY = (s - 1) * viewboxH;
  return {
    tx: Math.max(-maxOffsetX, Math.min(0, tx)),
    ty: Math.max(-maxOffsetY, Math.min(0, ty)),
  };
}

/**
 * Apply a wheel event to a transform, zooming centered on the given point
 * (in viewBox coordinates). Positive `deltaY` (typical scroll-down) zooms out;
 * negative zooms in. Returns the new transform.
 */
export function applyWheelZoom(
  prev: ZoomTransform,
  deltaY: number,
  centerX: number,
  centerY: number,
  viewboxW: number,
  viewboxH: number,
): ZoomTransform {
  const factor = 1 - deltaY * WHEEL_SENSITIVITY;
  return applyZoomAt(prev, factor, centerX, centerY, viewboxW, viewboxH);
}

/**
 * Multiply the current scale by `factor`, holding the point (cx, cy) fixed.
 * The math: we want the viewBox point under (cx, cy) — which is
 * `((cx - tx) / scale, (cy - ty) / scale)` — to remain under the same screen
 * point after the new scale. Solving for the new tx/ty:
 *   newTx = cx - ((cx - tx) / scale) * newScale
 *   newTy = cy - ((cy - ty) / scale) * newScale
 */
export function applyZoomAt(
  prev: ZoomTransform,
  factor: number,
  cx: number,
  cy: number,
  viewboxW: number,
  viewboxH: number,
): ZoomTransform {
  const newScale = clampScale(prev.scale * factor);
  if (newScale === prev.scale) return prev;
  const ratio = newScale / prev.scale;
  const newTx = cx - (cx - prev.tx) * ratio;
  const newTy = cy - (cy - prev.ty) * ratio;
  const clamped = clampPan(newTx, newTy, newScale, viewboxW, viewboxH);
  return { tx: clamped.tx, ty: clamped.ty, scale: newScale };
}

/**
 * Apply a pan delta (viewBox-px). Used for both mouse drag and arrow-key pan.
 */
export function applyPan(
  prev: ZoomTransform,
  dx: number,
  dy: number,
  viewboxW: number,
  viewboxH: number,
): ZoomTransform {
  const next = clampPan(prev.tx + dx, prev.ty + dy, prev.scale, viewboxW, viewboxH);
  return { tx: next.tx, ty: next.ty, scale: prev.scale };
}

/**
 * Compute the SVG `transform` attribute string for the wrapper `<g>`.
 * Returns `undefined` when the transform is identity, so we can skip the
 * attribute entirely (matches "no transform when scale=1, tx=ty=0").
 */
export function transformString(t: ZoomTransform): string | undefined {
  if (t.scale === 1 && t.tx === 0 && t.ty === 0) return undefined;
  return `translate(${t.tx} ${t.ty}) scale(${t.scale})`;
}

/** Squared distance between two touch points. Used for pinch-zoom math. */
export function touchDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/** Midpoint of two touch points. */
export function touchMidpoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
