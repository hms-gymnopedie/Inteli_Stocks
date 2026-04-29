import { useMemo } from 'react';

import { getOHLC } from '../../data/security';
import type { OHLC } from '../../data/types';
import { LineChart } from '../../lib/primitives';
import { useTweaks } from '../../lib/tweaks';
import { useAsync } from '../../lib/useAsync';

interface MACDPanelProps {
  symbol: string;
}

const FAST = 12;
const SLOW = 26;
const SIGNAL = 9;

function ema(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length === 0) return out;
  const k = 2 / (period + 1);
  // Seed with simple average over the first `period` values, then run the
  // recursive form. If we have fewer values than `period`, we still seed with
  // whatever we have so the first valid index is min(period - 1, length - 1).
  const seedLen = Math.min(period, values.length);
  let sum = 0;
  for (let i = 0; i < seedLen; i++) sum += values[i];
  let prev = sum / seedLen;
  out[seedLen - 1] = prev;
  for (let i = seedLen; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

interface MacdResult {
  macd: number;
  signal: number;
  histogram: number;
  /** Number of bars since the last signal-line cross (positive = up cross). */
  barsSinceCross: number;
}

function computeMacd(bars: OHLC[]): MacdResult | null {
  if (bars.length < SLOW + SIGNAL) return null;
  const closes = bars.map((b) => b.close);
  const fastE = ema(closes, FAST);
  const slowE = ema(closes, SLOW);
  const macdLine = closes.map((_, i) => {
    const f = fastE[i];
    const s = slowE[i];
    return Number.isFinite(f) && Number.isFinite(s) ? f - s : NaN;
  });
  // Drop leading NaNs for signal seeding.
  const macdValid: number[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (Number.isFinite(macdLine[i])) macdValid.push(macdLine[i]);
  }
  if (macdValid.length < SIGNAL) return null;
  const signalE = ema(macdValid, SIGNAL);

  // Histogram = MACD − signal, aligned to the tail.
  const tail = macdValid.length - 1;
  const macd = macdValid[tail];
  const signal = signalE[tail];
  const histogram = macd - signal;

  // Find last cross by walking backwards through aligned MACD/signal.
  let barsSinceCross = 0;
  let lastSign: 1 | -1 | 0 = histogram > 0 ? 1 : histogram < 0 ? -1 : 0;
  for (let i = tail - 1; i >= 0; i--) {
    const h = macdValid[i] - signalE[i];
    const sign: 1 | -1 | 0 = h > 0 ? 1 : h < 0 ? -1 : 0;
    if (sign !== 0 && lastSign !== 0 && sign !== lastSign) break;
    if (sign !== 0) lastSign = sign;
    barsSinceCross++;
  }

  return {
    macd,
    signal,
    histogram,
    barsSinceCross: histogram >= 0 ? barsSinceCross : -barsSinceCross,
  };
}

export function MACDPanel({ symbol }: MACDPanelProps) {
  const { values } = useTweaks();
  const { data: bars, loading } = useAsync(
    () => getOHLC(symbol, '3M'),
    [symbol],
  );

  const result = useMemo(() => (bars ? computeMacd(bars) : null), [bars]);

  // Per-symbol seed so the synthetic chart shifts with the symbol.
  const seed = useMemo(() => {
    let s = 21;
    for (const c of symbol) s += c.charCodeAt(0);
    return s;
  }, [symbol]);

  const dimmed = loading && !bars ? { opacity: 0.4 } : undefined;
  const macdClass =
    result === null ? 'muted' : result.macd >= 0 ? 'up' : 'down';
  const macdValue =
    result === null
      ? '—'
      : `${result.macd >= 0 ? '+' : '−'}${Math.abs(result.macd).toFixed(2)}`;
  const histLabel =
    result === null
      ? 'HIST —'
      : `HIST ${result.histogram >= 0 ? '+' : '−'}${Math.abs(
          result.histogram,
        ).toFixed(2)}`;
  const crossLabel =
    result === null
      ? 'SIGNAL · —'
      : result.barsSinceCross >= 0
        ? `SIGNAL ↑ CROSS · ${Math.abs(result.barsSinceCross)}D AGO`
        : `SIGNAL ↓ CROSS · ${Math.abs(result.barsSinceCross)}D AGO`;

  return (
    <div className="wf-panel" style={{ padding: 12 }} aria-busy={loading}>
      <div className="row between">
        <div className="wf-label">
          MACD ({FAST},{SLOW},{SIGNAL})
        </div>
        <div className={`wf-mono ${macdClass}`}>{macdValue}</div>
      </div>
      <div style={{ marginTop: 8, ...dimmed }}>
        <LineChart
          w={400}
          h={70}
          seed={seed}
          grid={values.showGrid}
          trend={0.2}
          accent
        />
      </div>
      <div className="row between wf-mini" style={{ marginTop: 4 }}>
        <span>{crossLabel}</span>
        <span>{histLabel}</span>
      </div>
    </div>
  );
}
