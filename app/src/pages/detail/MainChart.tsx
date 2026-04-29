import { useMemo, useState } from 'react';

import { getOHLC } from '../../data/security';
import type { Range } from '../../data/types';
import { formatVol } from '../../lib/format';
import { BarChart, CandleChart, LineChart } from '../../lib/primitives';
import { useTweaks } from '../../lib/tweaks';
import { useAsync } from '../../lib/useAsync';

export type StudyKey = 'RSI' | 'MACD' | 'VOL';

interface MainChartProps {
  symbol: string;
  /**
   * Set of currently-enabled studies. Owned by the page shell so RSI/MACD
   * panel visibility can be lifted up. Defaults to all-on if not provided.
   */
  studies?: Set<StudyKey>;
  onToggleStudy?: (key: StudyKey) => void;
}

const RANGES: Range[] = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'MAX'];
const STUDY_KEYS: StudyKey[] = ['RSI', 'MACD', 'VOL'];

const DEFAULT_STUDIES: Set<StudyKey> = new Set(['RSI', 'MACD', 'VOL']);

export function MainChart({
  symbol,
  studies = DEFAULT_STUDIES,
  onToggleStudy,
}: MainChartProps) {
  const { values } = useTweaks();
  const [range, setRange] = useState<Range>('3M');
  const { data: bars, loading } = useAsync(
    () => getOHLC(symbol, range),
    [symbol, range],
  );

  // Aggregate volume for the displayed window — formatted with K/M/B/T suffix.
  const totalVolume = useMemo(() => {
    if (!bars) return null;
    return bars.reduce((sum, b) => sum + b.volume, 0);
  }, [bars]);

  // Pre-compute a per-bar seed offset so the synthetic chart shifts when
  // range changes. Real OHLC plot is deferred to B2-MD when bars become
  // real; until then keep using the primitives' synthetic series so visual
  // density tracks the range tab.
  const chartSeed = useMemo(() => 11 + range.length * 3, [range]);
  const showVol = studies.has('VOL');
  const dimmed = loading && !bars ? { opacity: 0.4 } : undefined;

  return (
    <div className="wf-panel" style={{ padding: 14 }} aria-busy={loading}>
      <div className="row between">
        <div className="row gap-2" role="tablist" aria-label="Time range">
          {RANGES.map((t) => {
            const active = t === range;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRange(t)}
                className={'tab' + (active ? ' active' : '')}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: 'inherit',
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
        <div className="row gap-2">
          {STUDY_KEYS.map((s) => {
            const active = studies.has(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={active}
                onClick={() => onToggleStudy?.(s)}
                className="tag"
                style={{
                  background: 'transparent',
                  cursor: onToggleStudy ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                  color: active ? 'var(--fg)' : 'var(--fg-4)',
                  borderColor: active ? 'var(--fg-3)' : 'var(--hairline)',
                }}
              >
                {s}
              </button>
            );
          })}
          <span
            className="tag"
            style={{
              color: 'var(--orange)',
              borderColor: 'var(--orange)',
            }}
          >
            + ADD
          </span>
        </div>
      </div>
      <div style={{ marginTop: 10, ...dimmed }}>
        {values.chartStyle === 'candle' ? (
          <CandleChart w={800} h={200} count={62} seed={chartSeed} />
        ) : (
          <LineChart
            w={800}
            h={200}
            seed={chartSeed}
            trend={0.5}
            grid={values.showGrid}
            area={values.chartStyle === 'area'}
            strokeWidth={1.4}
          />
        )}
      </div>
      {showVol && (
        <>
          <hr className="wf-divider" style={{ margin: '8px 0' }} />
          <div style={{ height: 50, ...dimmed }}>
            <BarChart w={800} h={50} count={62} seed={chartSeed + 4} accent />
          </div>
        </>
      )}
      <div className="row between wf-mini" style={{ marginTop: 6 }}>
        <span>{range} · {bars ? `${bars.length} bars` : '— bars'}</span>
        <span>
          VOL ·{' '}
          {totalVolume !== null
            ? `${formatVol(totalVolume, { decimals: 1 })} shares`
            : '—'}
        </span>
      </div>
    </div>
  );
}
