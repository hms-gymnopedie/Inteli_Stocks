import { getSPConstituents } from '../../data/market';
import type { Constituent } from '../../data/types';
import { HeatGrid } from '../../lib/primitives';
import { useAsync } from '../../lib/useAsync';

// 24 placeholder cells — same count as the loaded heatmap.
// HeatGrid keys by array index, so duplicate `t` values are fine.
const SKELETON_CELLS: Constituent[] = Array.from({ length: 24 }, () => ({
  t: '—',
  v: 0,
}));

export function SectorHeat() {
  const { data, loading } = useAsync<Constituent[]>(getSPConstituents, []);
  const cells = data ?? SKELETON_CELLS;

  return (
    <div className="wf-panel" style={{ padding: 12 }}>
      <div className="row between">
        <div className="wf-label">S&amp;P 500 · Sector heatmap</div>
        <div className="wf-mini">SESSION</div>
      </div>
      <div
        style={{
          marginTop: 10,
          opacity: loading && !data ? 0.4 : 1,
          transition: 'opacity 120ms linear',
        }}
        aria-busy={loading}
      >
        <HeatGrid cols={6} cells={cells} />
      </div>
    </div>
  );
}
