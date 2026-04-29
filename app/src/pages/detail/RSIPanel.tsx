import { useMemo } from 'react';

import { getOHLC } from '../../data/security';
import type { OHLC } from '../../data/types';
import { LineChart } from '../../lib/primitives';
import { useTweaks } from '../../lib/tweaks';
import { useAsync } from '../../lib/useAsync';

interface RSIPanelProps {
  symbol: string;
}

const PERIOD = 14;

/**
 * Standard Wilder RSI(14) over OHLC closes.
 * Returns the array of RSI values (length = bars.length, leading bars = NaN).
 */
function computeRSI(bars: OHLC[], period = PERIOD): number[] {
  const out: number[] = new Array(bars.length).fill(NaN);
  if (bars.length <= period) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = bars[i].close - bars[i - 1].close;
    if (diff >= 0) gainSum += diff;
    else lossSum -= diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] =
    avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < bars.length; i++) {
    const diff = bars[i].close - bars[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] =
      avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function RSIPanel({ symbol }: RSIPanelProps) {
  const { values } = useTweaks();
  // Use the same default 3M range as MainChart so the indicator is roughly
  // in sync. B4 will lift the range up to a shared store.
  const { data: bars, loading } = useAsync(
    () => getOHLC(symbol, '3M'),
    [symbol],
  );

  const latestRSI = useMemo(() => {
    if (!bars || bars.length === 0) return null;
    const rsi = computeRSI(bars);
    for (let i = rsi.length - 1; i >= 0; i--) {
      if (Number.isFinite(rsi[i])) return rsi[i];
    }
    return null;
  }, [bars]);

  // Use the symbol/seed pair the LineChart primitive expects. Until we
  // implement a real RSI line plot, derive a chart seed from the symbol so
  // different symbols look distinct.
  const seed = useMemo(() => {
    let s = 20;
    for (const c of symbol) s += c.charCodeAt(0);
    return s;
  }, [symbol]);

  const dimmed = loading && !bars ? { opacity: 0.4 } : undefined;
  const rsiClass =
    latestRSI === null
      ? 'muted'
      : latestRSI >= 70
        ? 'down'
        : latestRSI <= 30
          ? 'up'
          : 'accent';

  return (
    <div className="wf-panel" style={{ padding: 12 }} aria-busy={loading}>
      <div className="row between">
        <div className="wf-label">RSI ({PERIOD})</div>
        <div className={`wf-mono ${rsiClass}`}>
          {latestRSI !== null ? latestRSI.toFixed(1) : '—'}
        </div>
      </div>
      <div style={{ marginTop: 8, ...dimmed }}>
        <LineChart
          w={400}
          h={70}
          seed={seed}
          grid={values.showGrid}
          trend={0.4}
          stroke="var(--orange)"
        />
      </div>
      <div className="row between wf-mini" style={{ marginTop: 4 }}>
        <span>30 oversold</span>
        <span>70 overbought</span>
      </div>
    </div>
  );
}
