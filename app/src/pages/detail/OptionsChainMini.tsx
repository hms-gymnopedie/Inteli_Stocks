import { useMemo } from 'react';

import { getIVSurface } from '../../data/security';
import type { IVSurfacePoint } from '../../data/types';
import { useAsync } from '../../lib/useAsync';

interface OptionsChainMiniProps {
  /**
   * Symbol to fetch the IV surface for. Optional with `'NVDA'` default to
   * keep the component composable when used outside the Detail route.
   */
  symbol?: string;
}

interface SurfaceShape {
  expiries: string[];
  strikes: number[];
  /** map[expiryIndex][strikeIndex] = iv (0..1). undefined when missing. */
  cells: (number | undefined)[][];
  ivMin: number;
  ivMax: number;
}

/**
 * Build a regular row=expiry × col=strike grid from the IVSurface flat list.
 * Strikes are sorted ascending; expiries kept in API order (already chronological).
 */
function buildSurface(points: IVSurfacePoint[]): SurfaceShape {
  const expiries: string[] = [];
  const strikeSet = new Set<number>();
  for (const p of points) {
    if (!expiries.includes(p.expiry)) expiries.push(p.expiry);
    strikeSet.add(p.strike);
  }
  const strikes = [...strikeSet].sort((a, b) => a - b);
  const cells: (number | undefined)[][] = expiries.map(() =>
    new Array<number | undefined>(strikes.length).fill(undefined),
  );
  let ivMin = Infinity;
  let ivMax = -Infinity;
  for (const p of points) {
    const ei = expiries.indexOf(p.expiry);
    const si = strikes.indexOf(p.strike);
    if (ei >= 0 && si >= 0) {
      cells[ei][si] = p.iv;
      if (p.iv < ivMin) ivMin = p.iv;
      if (p.iv > ivMax) ivMax = p.iv;
    }
  }
  if (!Number.isFinite(ivMin)) ivMin = 0;
  if (!Number.isFinite(ivMax)) ivMax = 1;
  return { expiries, strikes, cells, ivMin, ivMax };
}

/**
 * Blue → white → red gradient. `t` is normalized 0..1 with 0.5 = midpoint.
 * Returns an `rgb(...)` string.
 */
function ivColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped < 0.5) {
    // Blue → white
    const k = clamped / 0.5;
    const r = Math.round(91  + (245 - 91)  * k);
    const g = Math.round(138 + (245 - 138) * k);
    const b = Math.round(203 + (245 - 203) * k);
    return `rgb(${r}, ${g}, ${b})`;
  }
  // White → red
  const k = (clamped - 0.5) / 0.5;
  const r = Math.round(245 + (226 - 245) * k);
  const g = Math.round(245 + (94  - 245) * k);
  const b = Math.round(245 + (94  - 245) * k);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Format expiry "2025-05-30" → "30 MAY". */
function formatExpiry(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${m[3]} ${months[parseInt(m[2], 10) - 1] ?? ''}`;
}

/** Pick the strike closest to ATM (median strike) for highlight. */
function atmIndex(strikes: number[]): number {
  if (strikes.length === 0) return -1;
  return Math.floor(strikes.length / 2);
}

export function OptionsChainMini({ symbol = 'NVDA' }: OptionsChainMiniProps) {
  const { data, loading } = useAsync(() => getIVSurface(symbol), [symbol]);

  const surface = useMemo<SurfaceShape | null>(
    () => (data ? buildSurface(data) : null),
    [data],
  );

  const dimmed = loading && !data ? { opacity: 0.4 } : undefined;
  const atm = surface ? atmIndex(surface.strikes) : -1;

  return (
    <div className="wf-panel" style={{ padding: 12 }} aria-busy={loading}>
      <div className="row between">
        <div className="wf-label">Options chain · IV surface · {symbol}</div>
        <div className="wf-mini muted-2">
          {surface
            ? `${(surface.ivMin * 100).toFixed(0)}–${(surface.ivMax * 100).toFixed(0)}% iv`
            : '— iv'}
        </div>
      </div>

      {surface && surface.expiries.length > 0 ? (
        <div
          style={{
            marginTop: 10,
            display: 'grid',
            gridTemplateColumns: `60px repeat(${surface.strikes.length}, 1fr)`,
            gap: 2,
            ...dimmed,
          }}
          role="table"
          aria-label="Implied volatility surface"
        >
          {/* Header row: blank corner + strike columns */}
          <span />
          {surface.strikes.map((s, si) => (
            <span
              key={s}
              role="columnheader"
              className="wf-mono muted-2"
              style={{
                fontSize: 8,
                textAlign: 'center',
                letterSpacing: '0.04em',
                color: si === atm ? 'var(--orange)' : undefined,
              }}
            >
              {s}
            </span>
          ))}

          {/* Body rows */}
          {surface.expiries.map((exp, ei) => (
            <Row
              key={exp}
              expiry={exp}
              cells={surface.cells[ei]}
              ivMin={surface.ivMin}
              ivMax={surface.ivMax}
              atm={atm}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            marginTop: 10,
            display: 'grid',
            gridTemplateColumns: '60px repeat(7, 1fr)',
            gap: 2,
            ...dimmed,
          }}
        >
          <span />
          {Array.from({ length: 7 }).map((_, i) => (
            <span
              key={i}
              className="wf-mono muted-2"
              style={{ fontSize: 8, textAlign: 'center' }}
            >
              —
            </span>
          ))}
          {Array.from({ length: 3 }).map((_, ei) => (
            <Row
              key={ei}
              expiry=""
              cells={Array.from({ length: 7 }, () => undefined)}
              ivMin={0}
              ivMax={1}
              atm={-1}
              skeleton
            />
          ))}
        </div>
      )}

      {/* Legend */}
      {surface && surface.expiries.length > 0 && (
        <div
          className="row gap-2"
          style={{
            marginTop: 10,
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          <span className="wf-mini muted-2">LOW</span>
          <div
            style={{
              width: 80,
              height: 6,
              borderRadius: 1,
              background: `linear-gradient(to right, ${ivColor(0)}, ${ivColor(0.5)}, ${ivColor(1)})`,
            }}
          />
          <span className="wf-mini muted-2">HIGH</span>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  expiry: string;
  cells: (number | undefined)[];
  ivMin: number;
  ivMax: number;
  atm: number;
  skeleton?: boolean;
}

function Row({ expiry, cells, ivMin, ivMax, atm, skeleton }: RowProps) {
  const range = Math.max(0.001, ivMax - ivMin);
  return (
    <>
      <span
        role="rowheader"
        className="wf-mono"
        style={{
          fontSize: 9,
          color: 'var(--fg-3)',
          letterSpacing: '0.04em',
          padding: '0 4px',
          alignSelf: 'center',
        }}
      >
        {expiry ? formatExpiry(expiry) : '———'}
      </span>
      {cells.map((iv, si) => {
        const t = iv != null ? (iv - ivMin) / range : 0;
        const bg = skeleton ? 'var(--panel-2)' : iv != null ? ivColor(t) : 'var(--panel-2)';
        const isAtm = si === atm;
        return (
          <div
            key={si}
            role="cell"
            title={iv != null ? `${(iv * 100).toFixed(1)}%` : '—'}
            style={{
              height: 22,
              background: bg,
              border: isAtm
                ? '1px solid var(--orange)'
                : '1px solid var(--hairline)',
              borderRadius: 2,
              fontFamily: 'var(--font-mono)',
              fontSize: 8,
              color:
                iv != null && (iv - ivMin) / range > 0.35 && (iv - ivMin) / range < 0.65
                  ? '#0b0b0c'
                  : '#0b0b0c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {iv != null && !skeleton ? `${Math.round(iv * 100)}` : ''}
          </div>
        );
      })}
    </>
  );
}
