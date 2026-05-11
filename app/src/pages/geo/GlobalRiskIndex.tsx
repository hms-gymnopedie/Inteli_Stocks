import { useCallback, useState } from 'react';
import { getGlobalIndex, getIndexTrail } from '../../data/geo';
import type {
  GeoIndexSnapshot,
  GeoIndexTrail,
  GlobalRiskIndex as GlobalRiskIndexData,
} from '../../data/types';
import { useAsync } from '../../lib/useAsync';

type TrailRange = '1D' | '1W' | '1M';

const RANGES: TrailRange[] = ['1D', '1W', '1M'];

// Small inline sparkline. Mirrors the Spark pattern in
// pages/leaderboard/HoldingBreakdown.tsx — pure SVG, no chart libs.
function Spark({
  points,
  width = 100,
  height = 24,
}: {
  points: GeoIndexSnapshot[];
  width?: number;
  height?: number;
}) {
  if (!points || points.length < 2) {
    return (
      <div className="wf-mini" style={{ width, height, lineHeight: `${height}px` }}>
        Building history…
      </div>
    );
  }
  const ys = points.map((p) => p.value);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yR = yMax - yMin || 1;
  const xR = points.length - 1 || 1;
  const path = points
    .map((p, i) => {
      const x = (i / xR) * width;
      const y = height - ((p.value - yMin) / yR) * height;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} aria-hidden>
      <path
        d={path}
        fill="none"
        stroke="var(--orange)"
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GlobalRiskIndex() {
  const { data, loading } = useAsync<GlobalRiskIndexData>(getGlobalIndex, []);

  const [range, setRange] = useState<TrailRange>('1W');
  const fetchTrail = useCallback(() => getIndexTrail(range), [range]);
  const { data: trail } = useAsync<GeoIndexTrail>(fetchTrail, [range]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        left: 14,
        display: 'flex',
        gap: 8,
      }}
    >
      <div
        className="wf-panel" data-tour="geo-index"
        style={{
          padding: '8px 12px',
          backdropFilter: 'blur(8px)',
          background: 'rgba(20,20,22,0.7)',
          opacity: loading && !data ? 0.5 : 1,
          transition: 'opacity 200ms ease',
        }}
        aria-busy={loading && !data}
      >
        <div className="wf-mini">GLOBAL RISK INDEX</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
          }}
        >
          <div className="wf-num accent" style={{ fontSize: 28 }}>
            {data ? data.value : '—'}
            <span className="muted-2" style={{ fontSize: 14 }}>
              /100
            </span>
          </div>
          <div className="wf-mono down" style={{ fontSize: 11 }}>
            {data
              ? `${data.delta >= 0 ? '+' : '−'}${Math.abs(data.delta)} ${data.period}`
              : '—'}
          </div>
          <div
            style={{ display: 'flex', gap: 4, marginLeft: 4 }}
            role="tablist"
            aria-label="Risk index trail range"
          >
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={range === r}
                className={'chip' + (range === r ? ' active' : '')}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 2 }}>
          <Spark points={trail?.snapshots ?? []} />
        </div>
        <div className="wf-mini">{data ? data.note : '—'}</div>
      </div>
    </div>
  );
}
