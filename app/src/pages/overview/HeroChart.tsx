import { useRef, useState } from 'react';
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
  const [range, setRange] = useState<Range>('1W');
  const [symbol] = useState<string>(SYMBOL);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Arrow-key navigation per WAI-ARIA Authoring Practices for tabs:
  // Left/Right move + activate the previous/next tab and focus it,
  // Home/End jump to first/last. Tab itself enters/exits the tablist
  // (only the selected tab is reachable via Tab, others are tabindex=-1).
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

  // Drive the chart from the data layer. Both `symbol` and `range` are in the
  // deps so changing either triggers `getIntraday(symbol, range)` re-fetch
  // (B8-OV-CHART). Header values stay byte-identical to the prototype loaded
  // state — the mock OHLC generator is synthetic and not pre-aggregated for
  // SPX. When B2-MD swaps in real data, header derivation can move into this
  // hook too.
  const { data: bars, loading } = useAsync<OHLC[]>(
    () => getIntraday(symbol, range),
    [symbol, range],
  );

  return (
    <div className="wf-panel" style={{ padding: 14 }}>
      <div className="row between center">
        <div>
          <div className="wf-label">Primary · S&amp;P 500 · Intraday</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              marginTop: 4,
            }}
          >
            <div className="wf-num" style={{ fontSize: 32 }}>
              5,247.<span className="muted">18</span>
            </div>
            <div className="up wf-mono" style={{ fontSize: 13 }}>
              +22.04 (+0.42%)
            </div>
            <div className="muted wf-mini">VOL 2.41B</div>
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
          // Skeleton-like dim on first load (no bars yet) AND a softer dim
          // during background refetches when range/symbol changes.
          opacity: loading ? (bars ? 0.7 : 0.5) : 1,
          transition: 'opacity 120ms linear',
        }}
        aria-busy={loading}
      >
        {values.chartStyle === 'candle' ? (
          <CandleChart w={800} h={180} count={62} seed={3} />
        ) : (
          <LineChart
            w={800}
            h={180}
            seed={3}
            trend={0.6}
            grid={showGrid}
            dashedTarget
            accent
            area={values.chartStyle === 'area'}
            accentRange={[0.62, 0.78]}
            strokeWidth={1.4}
          />
        )}
      </div>
      <div className="row between" style={{ marginTop: 8 }}>
        <div className="wf-mini">
          09:30 · 11:00 · 13:00 · 15:00 · 16:00
        </div>
        <div className="row gap-3 wf-mini">
          <span>O 5,225.14</span>
          <span>H 5,251.02</span>
          <span>L 5,219.88</span>
          <span>C 5,247.18</span>
        </div>
      </div>
    </div>
  );
}
