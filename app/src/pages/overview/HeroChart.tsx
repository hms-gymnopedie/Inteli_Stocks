import { useEffect, useMemo, useRef, useState } from 'react';
import { getIntraday } from '../../data/market';
import type { OHLC, Range } from '../../data/types';
import { formatDateAxis } from '../../lib/format';
import { useTweaks } from '../../lib/tweaks';
import { useAsync } from '../../lib/useAsync';

const RANGES: Range[] = ['1D', '1W', '1M', '3M', 'YTD', '1Y', '5Y'];
const SYMBOL = '^GSPC';

const W     = 800;
const H     = 200;
const PAD_L = 8;
const PAD_R = 56;
const PAD_T = 14;
const PAD_B = 24;

interface Bounds { minTs: number; maxTs: number; minV: number; maxV: number }

function computeBounds(bars: OHLC[]): Bounds | null {
  if (bars.length < 2) return null;
  let minTs = Infinity, maxTs = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const b of bars) {
    if (b.ts    < minTs) minTs = b.ts;
    if (b.ts    > maxTs) maxTs = b.ts;
    if (b.low   < minV)  minV  = b.low;
    if (b.high  > maxV)  maxV  = b.high;
  }
  const span = maxV - minV;
  const padY = span === 0 ? maxV * 0.02 : span * 0.04;
  return { minTs, maxTs, minV: minV - padY, maxV: maxV + padY };
}

function buildPath(bars: OHLC[], b: Bounds): string {
  const xRange = b.maxTs - b.minTs || 1;
  const yRange = b.maxV  - b.minV  || 1;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  let d = '';
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const x = PAD_L + ((bar.ts - b.minTs) / xRange) * innerW;
    const y = PAD_T + (1 - (bar.close - b.minV) / yRange) * innerH;
    d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
  }
  return d.trim();
}

function fmtPrice(v: number): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function fmtVolumeShort(v: number): string {
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3)  return `${(v / 1e3).toFixed(1)}k`;
  return v.toLocaleString();
}

function fmtAxisDate(ts: number, range: Range): string {
  if (range === '1D') {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  // 1W/1M/3M omit the year; 6M+ include it.
  const withYear = range === 'YTD' || range === '1Y' || range === '5Y' || range === '6M' || range === 'MAX';
  return formatDateAxis(ts, { withYear });
}

function fmtTooltipDate(ts: number, range: Range): string {
  if (range === '1D') {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).toUpperCase();
  }
  return formatDateAxis(ts, { withYear: true });
}

export function HeroChart() {
  const { values } = useTweaks();
  const showGrid = values.showGrid;
  const [range, setRange] = useState<Range>('1M');
  const [symbol] = useState<string>(SYMBOL);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % RANGES.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + RANGES.length) % RANGES.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = RANGES.length - 1;
    else return;
    e.preventDefault();
    setRange(RANGES[next]);
    tabRefs.current[next]?.focus();
  };

  const { data: bars, loading } = useAsync<OHLC[]>(
    () => getIntraday(symbol, range),
    [symbol, range],
  );

  const items   = bars ?? [];
  const bounds  = useMemo(() => computeBounds(items), [items]);
  const innerW  = W - PAD_L - PAD_R;
  const innerH  = H - PAD_T - PAD_B;

  const summary = useMemo(() => {
    if (items.length === 0) return null;
    const first = items[0];
    const last  = items[items.length - 1];
    const change    = last.close - first.close;
    const changePct = first.close ? (change / first.close) * 100 : 0;
    const high = items.reduce((acc, b) => Math.max(acc, b.high), -Infinity);
    const low  = items.reduce((acc, b) => Math.min(acc, b.low),   Infinity);
    const vol  = items.reduce((acc, b) => acc + (b.volume ?? 0), 0);
    return {
      price: last.close,
      change, changePct,
      open: first.open, high, low, close: last.close,
      vol,
    };
  }, [items]);

  const isUp     = summary ? summary.change >= 0 : true;
  const lineColor = isUp ? 'var(--up)' : 'var(--down)';

  // Hover: snap to nearest bar by x. Click pins anchors A→B for comparison.
  const [hover, setHover] = useState<{ x: number; idx: number } | null>(null);
  const [pinned, setPinned] = useState<number[]>([]); // bar indices
  // Indices are tied to the current range's bars — reset when range/symbol
  // changes so pin A doesn't end up off-chart.
  useEffect(() => { setPinned([]); }, [range, symbol]);

  /** Resolve a viewport mouse event to the nearest bar index + svg-x. */
  function nearestIdx(e: React.MouseEvent<SVGSVGElement>): { idx: number; x: number } | null {
    if (!bounds || items.length < 2) return null;
    const svg  = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    if (vx < PAD_L || vx > W - PAD_R) return null;
    const tsRange = bounds.maxTs - bounds.minTs || 1;
    const targetTs = bounds.minTs + ((vx - PAD_L) / innerW) * tsRange;
    let bestIdx = 0; let bestDelta = Infinity;
    for (let i = 0; i < items.length; i++) {
      const d = Math.abs(items[i].ts - targetTs);
      if (d < bestDelta) { bestDelta = d; bestIdx = i; }
    }
    const px = PAD_L + ((items[bestIdx].ts - bounds.minTs) / tsRange) * innerW;
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
    setPinned((prev) => {
      // 0 → 1 anchor (A); 1 → 2 anchors (A+B); 2 → reset back to 1 (third
      // click starts a new comparison from this point).
      if (prev.length >= 2) return [r.idx];
      return [...prev, r.idx];
    });
  };

  const hoverBar = hover ? items[hover.idx] : null;
  const xForIdx = (idx: number): number => {
    if (!bounds) return 0;
    const tsRange = bounds.maxTs - bounds.minTs || 1;
    return PAD_L + ((items[idx].ts - bounds.minTs) / tsRange) * innerW;
  };
  const yForVal = (v: number): number => {
    if (!bounds) return 0;
    return PAD_T + (1 - (v - bounds.minV) / (bounds.maxV - bounds.minV || 1)) * innerH;
  };
  const hoverY = hoverBar && bounds ? yForVal(hoverBar.close) : 0;

  // A → B comparison metrics when 2 anchors are pinned.
  const compare = useMemo(() => {
    if (pinned.length !== 2) return null;
    const a = items[pinned[0]];
    const b = items[pinned[1]];
    if (!a || !b) return null;
    const delta = b.close - a.close;
    const pct   = a.close > 0 ? (delta / a.close) * 100 : 0;
    const days  = (b.ts - a.ts) / (24 * 3600_000);
    return { a, b, delta, pct, days };
  }, [items, pinned]);

  // X-axis ticks: 5 evenly spaced on the data domain.
  const xTicks = useMemo(() => {
    if (!bounds) return [];
    const ticks: { x: number; ts: number }[] = [];
    const TICK_COUNT = 5;
    for (let i = 0; i < TICK_COUNT; i++) {
      const frac = i / (TICK_COUNT - 1);
      ticks.push({
        x:  PAD_L + frac * innerW,
        ts: bounds.minTs + frac * (bounds.maxTs - bounds.minTs),
      });
    }
    return ticks;
  }, [bounds, innerW]);

  return (
    <div className="wf-panel" style={{ padding: 14 }}>
      <div className="row between center">
        <div>
          <div className="wf-label">Primary · S&amp;P 500 · {range}</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              marginTop: 4,
            }}
          >
            <div className="wf-num" style={{ fontSize: 32 }}>
              {summary ? fmtPrice(summary.price) : '—'}
            </div>
            <div className="wf-mono" style={{ fontSize: 13, color: lineColor }}>
              {summary
                ? `${isUp ? '+' : '−'}${Math.abs(summary.change).toFixed(2)} ` +
                  `(${isUp ? '+' : '−'}${Math.abs(summary.changePct).toFixed(2)}%)`
                : '—'}
            </div>
            <div className="muted wf-mini">
              {summary && summary.vol > 0 ? `VOL ${fmtVolumeShort(summary.vol)}` : ''}
            </div>
          </div>
        </div>
        <div className="row gap-1" role="tablist" aria-label="Time range">
          {RANGES.map((r, i) => {
            const active = r === range;
            return (
              <button
                key={r}
                ref={(el) => { tabRefs.current[i] = el; }}
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => setRange(r)}
                onKeyDown={(e) => onTabKeyDown(e, i)}
                className={'tab' + (active ? ' active' : '')}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                }}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          opacity: loading ? (bars ? 0.7 : 0.5) : 1,
          transition: 'opacity 120ms linear',
          position: 'relative',
        }}
        aria-busy={loading}
      >
        {bounds && items.length >= 2 ? (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height={H}
            preserveAspectRatio="none"
            role="img"
            aria-label={`S&P 500 ${range} chart`}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            onClick={onClick}
            style={{ cursor: 'crosshair' }}
          >
            {/* Y gridlines */}
            {showGrid && [0.25, 0.5, 0.75].map((t) => (
              <line
                key={`yg-${t}`}
                x1={PAD_L} x2={W - PAD_R}
                y1={PAD_T + t * innerH} y2={PAD_T + t * innerH}
                stroke="var(--hairline)" strokeWidth={0.5}
                strokeDasharray="2 4"
              />
            ))}
            {/* Price path */}
            <path
              d={buildPath(items, bounds)}
              fill="none"
              stroke={lineColor}
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
            />
            {/* Y-axis labels (right) */}
            <text
              x={W - PAD_R + 6} y={PAD_T + 4}
              fontSize={9} fontFamily="var(--font-mono)" fill="var(--fg-4)"
            >
              {fmtPrice(bounds.maxV)}
            </text>
            <text
              x={W - PAD_R + 6} y={H - PAD_B}
              fontSize={9} fontFamily="var(--font-mono)" fill="var(--fg-4)"
            >
              {fmtPrice(bounds.minV)}
            </text>
            {/* X-axis ticks */}
            {xTicks.map((t, i) => (
              <text
                key={i}
                x={t.x}
                y={H - 6}
                textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
                fontSize={9}
                fontFamily="var(--font-mono)"
                fill="var(--fg-4)"
              >
                {fmtAxisDate(t.ts, range)}
              </text>
            ))}
            {/* Pinned anchors A / B */}
            {pinned.map((idx, i) => {
              const bar = items[idx];
              if (!bar) return null;
              const x = xForIdx(idx);
              const y = yForVal(bar.close);
              const label = i === 0 ? 'A' : 'B';
              return (
                <g key={`pin-${idx}-${i}`} pointerEvents="none">
                  <line
                    x1={x} x2={x}
                    y1={PAD_T} y2={H - PAD_B}
                    stroke="var(--orange)"
                    strokeWidth={1}
                  />
                  <circle cx={x} cy={y} r={4} fill="var(--orange)" />
                  <rect
                    x={x - 7} y={PAD_T - 12}
                    width={14} height={12}
                    fill="var(--orange)"
                  />
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
            {/* Crosshair */}
            {hover && hoverBar && (
              <>
                <line
                  x1={hover.x} x2={hover.x}
                  y1={PAD_T} y2={H - PAD_B}
                  stroke="var(--fg-3)" strokeWidth={0.5}
                  strokeDasharray="2 2"
                  pointerEvents="none"
                />
                <line
                  x1={PAD_L} x2={W - PAD_R}
                  y1={hoverY} y2={hoverY}
                  stroke="var(--fg-3)" strokeWidth={0.5}
                  strokeDasharray="2 2"
                  pointerEvents="none"
                />
                <circle
                  cx={hover.x} cy={hoverY}
                  r={3}
                  fill={lineColor}
                  pointerEvents="none"
                />
              </>
            )}
          </svg>
        ) : (
          <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="wf-mini muted">{loading ? 'loading…' : 'no data'}</span>
          </div>
        )}
        {/* Hover tooltip pill */}
        {hover && hoverBar && (
          <div
            style={{
              position: 'absolute',
              top: 4,
              left: 'calc(' + (hover.x / W) * 100 + '%)',
              transform: 'translateX(-50%)',
              background: 'var(--panel-2)',
              border: '1px solid var(--hairline)',
              borderRadius: 4,
              padding: '6px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fg)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 1,
              lineHeight: 1.5,
            }}
          >
            <div style={{ color: 'var(--fg-3)' }}>
              {fmtTooltipDate(hoverBar.ts, range)}
            </div>
            <div>
              <span style={{ color: 'var(--fg-3)' }}>O </span>{fmtPrice(hoverBar.open)}
              <span style={{ marginLeft: 8, color: 'var(--fg-3)' }}>H </span>{fmtPrice(hoverBar.high)}
            </div>
            <div>
              <span style={{ color: 'var(--fg-3)' }}>L </span>{fmtPrice(hoverBar.low)}
              <span style={{ marginLeft: 8, color: 'var(--fg-3)' }}>C </span>
              <span style={{ color: lineColor }}>{fmtPrice(hoverBar.close)}</span>
            </div>
            {hoverBar.volume > 0 && (
              <div style={{ color: 'var(--fg-3)' }}>
                VOL {fmtVolumeShort(hoverBar.volume)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="row between" style={{ marginTop: 8 }}>
        <div className="wf-mini muted">
          {pinned.length > 0
            ? `${pinned.length === 2 ? 'A → B pinned' : 'A pinned'} · click chart again to ${pinned.length >= 2 ? 'reset' : 'pin B'}`
            : summary
              ? `${items.length} bars · click to pin a comparison anchor`
              : ''}
        </div>
        <div className="row gap-3 wf-mini">
          {summary ? (
            <>
              <span>O {fmtPrice(summary.open)}</span>
              <span>H {fmtPrice(summary.high)}</span>
              <span>L {fmtPrice(summary.low)}</span>
              <span>C {fmtPrice(summary.close)}</span>
            </>
          ) : null}
        </div>
      </div>

      {/* Pinned-anchor comparison ribbon */}
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
            <span>{fmtTooltipDate(compare.a.ts, range)}</span>
            <span style={{ color: 'var(--fg-3)' }}>{fmtPrice(compare.a.close)}</span>
            <span style={{ color: 'var(--fg-4)' }}>→</span>
            <span style={{ color: 'var(--orange)' }}>B</span>
            <span>{fmtTooltipDate(compare.b.ts, range)}</span>
            <span style={{ color: 'var(--fg-3)' }}>{fmtPrice(compare.b.close)}</span>
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
              {compare.delta >= 0 ? '+' : '−'}{Math.abs(compare.delta).toFixed(2)}
            </span>
            <span className="muted">{Math.round(compare.days)}d</span>
            <button
              type="button"
              onClick={() => setPinned([])}
              style={{
                background: 'transparent',
                border: 0,
                color: 'var(--fg-3)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 11,
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
