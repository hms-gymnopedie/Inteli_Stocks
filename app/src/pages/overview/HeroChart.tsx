import { useMemo, useRef, useState } from 'react';
import { getIntraday } from '../../data/market';
import type { OHLC, Range } from '../../data/types';
import { CandleChart, LineChart } from '../../lib/primitives';
import { useTweaks } from '../../lib/tweaks';
import { useAsync } from '../../lib/useAsync';

const RANGES: Range[] = ['1D', '1W', '1M', '3M', 'YTD', '1Y', '5Y'];
const SYMBOL = '^GSPC';

export function HeroChart() {
  const { values } = useTweaks();
  const showGrid = values.showGrid;
  const [range, setRange] = useState<Range>('1M');
  const [symbol] = useState<string>(SYMBOL);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // WAI-ARIA tablist keyboard nav (Left/Right move + activate, Home/End jump).
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

  // Drive header KPIs and chart series from the live bars (B9-1).
  const header = useMemo(() => {
    if (!bars || bars.length === 0) return null;
    const first = bars[0];
    const last  = bars[bars.length - 1];
    const change    = last.close - first.close;
    const changePct = (change / first.close) * 100;
    const sumVol    = bars.reduce((acc, b) => acc + (b.volume ?? 0), 0);
    return {
      price:     last.close,
      change,
      changePct,
      open:      first.open,
      high:      bars.reduce((acc, b) => Math.max(acc, b.high), -Infinity),
      low:       bars.reduce((acc, b) => Math.min(acc, b.low),   Infinity),
      close:     last.close,
      volumeSum: sumVol,
      lastTs:    last.ts,
    };
  }, [bars]);

  const closes = useMemo(
    () => (bars ? bars.map((b) => b.close) : null),
    [bars],
  );

  const upColor = header && header.change >= 0 ? 'var(--up)' : 'var(--down)';
  const sign = header
    ? header.change >= 0 ? '+' : '−'
    : '+';

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
              {header
                ? header.price.toLocaleString('en-US', { maximumFractionDigits: 2 })
                : '—'}
            </div>
            <div className="wf-mono" style={{ fontSize: 13, color: upColor }}>
              {header
                ? `${sign}${Math.abs(header.change).toFixed(2)} (${sign}${Math.abs(header.changePct).toFixed(2)}%)`
                : '—'}
            </div>
            <div className="muted wf-mini">
              {header && header.volumeSum > 0
                ? `VOL ${formatVolumeShort(header.volumeSum)}`
                : ''}
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
        }}
        aria-busy={loading}
      >
        {values.chartStyle === 'candle' ? (
          <CandleChart w={800} h={180} count={Math.min(bars?.length ?? 62, 120)} seed={3} />
        ) : (
          <LineChart
            w={800}
            h={180}
            data={closes}
            grid={showGrid}
            area={values.chartStyle === 'area'}
            stroke={header && header.change >= 0 ? 'var(--up)' : 'var(--down)'}
            strokeWidth={1.4}
          />
        )}
      </div>
      <div className="row between" style={{ marginTop: 8 }}>
        <div className="wf-mini muted">
          {header
            ? new Date(header.lastTs).toLocaleString(undefined, {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })
            : ''}
        </div>
        <div className="row gap-3 wf-mini">
          {header ? (
            <>
              <span>O {header.open.toFixed(2)}</span>
              <span>H {header.high.toFixed(2)}</span>
              <span>L {header.low.toFixed(2)}</span>
              <span>C {header.close.toFixed(2)}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatVolumeShort(v: number): string {
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `${(v / 1e6).toFixed(2)}M`;
  return v.toLocaleString();
}
