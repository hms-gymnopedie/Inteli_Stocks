import { useState } from 'react';

import { getEquityCurve } from '../../data/portfolio';
import type { Range } from '../../data/types';
import { LineChart } from '../../lib/primitives';
import { useAsync } from '../../lib/useAsync';
import { useTweaks } from '../../lib/tweaks';

const RANGES: Range[] = ['1M', '3M', '6M', 'YTD', '1Y', '5Y'];

type Benchmark = 'SP500' | 'KOSPI';
const BENCHMARKS: { id: Benchmark; label: string; pp: string }[] = [
  { id: 'SP500', label: 'S&P',   pp: '+6.2pp' },
  { id: 'KOSPI', label: 'KOSPI', pp: '+11.4pp' },
];

const RANGE_LABELS: Partial<Record<Range, string>> = {
  '1M':  'JAN W1 · W2 · W3 · W4',
  '3M':  'FEB · MAR · APR',
  '6M':  'NOV · JAN · MAR',
  'YTD': 'JAN · FEB · MAR · APR',
  '1Y':  'MAY · JUL · SEP · NOV · JAN · MAR',
  '5Y':  '2021 · 2022 · 2023 · 2024 · 2025',
};

/**
 * Derive a deterministic seed from the selected range so the visualization
 * changes when the user toggles. The data layer returns range-aware points
 * already, but `LineChart` is a procedural primitive — feeding it a stable
 * seed keeps the rendered shape consistent and varying per range.
 */
function rangeSeed(range: Range, benchmark: Benchmark): number {
  const offset = benchmark === 'KOSPI' ? 17 : 0;
  return RANGES.indexOf(range) * 7 + 42 + offset;
}

export function EquityCurve() {
  const { values } = useTweaks();
  const [range, setRange] = useState<Range>('1Y');
  const [benchmark, setBenchmark] = useState<Benchmark>('SP500');
  const { data, loading } = useAsync(() => getEquityCurve(range), [range]);

  const dimmed = loading && !data ? { opacity: 0.4 } : undefined;
  const activeBench = BENCHMARKS.find((b) => b.id === benchmark) ?? BENCHMARKS[0];

  return (
    <div className="wf-panel" style={{ padding: 12 }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="wf-label">Equity curve · {range}</div>
        <div className="row gap-2" style={{ alignItems: 'center' }}>
          <div
            className="row gap-1"
            role="tablist"
            aria-label="Equity benchmark"
          >
            {BENCHMARKS.map((b) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={benchmark === b.id}
                className={benchmark === b.id ? 'tab active' : 'tab'}
                style={{
                  padding: '3px 8px',
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.06em',
                  background: benchmark === b.id ? undefined : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setBenchmark(b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>
          <div
            className="row gap-1"
            role="tablist"
            aria-label="Equity range"
          >
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={range === r}
                className={range === r ? 'tab active' : 'tab'}
                style={{
                  padding: '3px 8px',
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.06em',
                  background: range === r ? undefined : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, ...dimmed }} aria-busy={loading}>
        <LineChart
          w={400}
          h={150}
          seed={rangeSeed(range, benchmark)}
          trend={1.2}
          grid={values.showGrid}
          area
          accentRange={[0.55, 0.7]}
        />
      </div>
      <div className="row between wf-mini" style={{ marginTop: 4 }}>
        <span>{RANGE_LABELS[range] ?? range}</span>
        <span className="muted">
          vs {activeBench.label} {activeBench.pp}
        </span>
      </div>
    </div>
  );
}
