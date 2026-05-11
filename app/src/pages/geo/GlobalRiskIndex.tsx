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
  const [open,  setOpen]  = useState(false);
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
          padding: open ? '8px 12px' : '6px 10px',
          backdropFilter: 'blur(8px)',
          background: 'rgba(20,20,22,0.7)',
          opacity: loading && !data ? 0.5 : 1,
          transition: 'opacity 200ms ease, padding 150ms ease',
        }}
        aria-busy={loading && !data}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="geo-index-body"
          style={{
            all: 'unset', cursor: 'pointer', width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div className="row gap-2" style={{ alignItems: 'baseline' }}>
            <span className="wf-mini">GLOBAL RISK INDEX</span>
            <span className="wf-num accent" style={{ fontSize: open ? 28 : 16, transition: 'font-size 150ms ease' }}>
              {data ? data.value : '—'}
              <span className="muted-2" style={{ fontSize: open ? 14 : 10 }}>/100</span>
            </span>
            {!open && (
              <span className="wf-mono down" style={{ fontSize: 10 }}>
                {data ? `${data.delta >= 0 ? '+' : '−'}${Math.abs(data.delta)}` : '—'}
              </span>
            )}
          </div>
          <span style={{
            display: 'inline-block',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
            color: 'var(--fg-3)', fontSize: 10,
          }}>▾</span>
        </button>
        {open && (
          <div id="geo-index-body" style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div className="wf-mono down" style={{ fontSize: 11 }}>
                {data
                  ? `${data.delta >= 0 ? '+' : '−'}${Math.abs(data.delta)} ${data.period}`
                  : '—'}
              </div>
              <div
                style={{ display: 'flex', gap: 4 }}
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
            <div style={{ marginTop: 4 }}>
              <Spark points={trail?.snapshots ?? []} />
            </div>
            <div className="wf-mini">{data ? data.note : '—'}</div>
          </div>
        )}
      </div>
    </div>
  );
}
