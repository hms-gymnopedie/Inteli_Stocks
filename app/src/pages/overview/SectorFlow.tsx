import { useMemo, useState } from 'react';
import { getSectorReturns } from '../../data/market';
import type { Range, SectorReturn } from '../../data/types';
import { SectorBars } from '../../lib/primitives';
import { useAsync } from '../../lib/useAsync';

type SortMode = 'absolute' | 'relative';

const RANGE: Range = '1D';
const SKELETON_ITEMS: SectorReturn[] = Array.from({ length: 8 }, () => ({
  name: '—',
  v: 0,
}));

export function SectorFlow() {
  const [sort, setSort] = useState<SortMode>('absolute');
  const { data, loading } = useAsync<SectorReturn[]>(
    () => getSectorReturns(RANGE),
    [],
  );

  // 'absolute' = preserve fetch order (matches the prototype's loaded layout).
  // 'relative' = sort by signed value descending (most positive first).
  const items = useMemo(() => {
    if (!data) return SKELETON_ITEMS;
    if (sort === 'absolute') return data;
    return [...data].sort((a, b) => b.v - a.v);
  }, [data, sort]);

  return (
    <div className="wf-panel" style={{ padding: 12 }}>
      <div className="row between center">
        <div className="wf-label">Sector flow · Today</div>
        <div className="row gap-1" role="tablist" aria-label="Sort mode">
          <button
            type="button"
            role="tab"
            aria-selected={sort === 'absolute'}
            onClick={() => setSort('absolute')}
            className={'tab' + (sort === 'absolute' ? ' active' : '')}
            style={{
              padding: '3px 8px',
              fontSize: 10,
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
            }}
          >
            ABS
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sort === 'relative'}
            onClick={() => setSort('relative')}
            className={'tab' + (sort === 'relative' ? ' active' : '')}
            style={{
              padding: '3px 8px',
              fontSize: 10,
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
            }}
          >
            REL
          </button>
        </div>
      </div>
      <div
        style={{
          marginTop: 10,
          opacity: loading && !data ? 0.4 : 1,
          transition: 'opacity 120ms linear',
        }}
        aria-busy={loading}
      >
        <SectorBars items={items} />
      </div>
    </div>
  );
}
