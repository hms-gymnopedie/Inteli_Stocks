import { useState } from 'react';

import { getAllocation } from '../../data/portfolio';
import type { AllocationBy, AllocationSlice } from '../../data/types';
import { SectorBars } from '../../lib/primitives';
import { useAsync } from '../../lib/useAsync';

const TOGGLES: { id: AllocationBy; label: string }[] = [
  { id: 'sector', label: 'SECTOR' },
  { id: 'region', label: 'REGION' },
  { id: 'asset',  label: 'ASSET'  },
];

interface AllocationProps {
  /**
   * Drill-in callback wired up from the parent (`index.tsx`). Fired when a
   * slice is clicked — the parent decides whether to scroll the holdings
   * table, open a side panel, etc.
   */
  onSliceClick?: (slice: AllocationSlice, by: AllocationBy) => void;
}

/** Skeleton bars rendered while the allocation fetch is in flight. */
const SKELETON: AllocationSlice[] = [
  { name: '——', v: 30 },
  { name: '——', v: 22 },
  { name: '——', v: 14 },
  { name: '——', v:  9 },
  { name: '——', v:  6 },
];

export function Allocation({ onSliceClick }: AllocationProps) {
  const [by, setBy] = useState<AllocationBy>('sector');
  const { data, loading } = useAsync(() => getAllocation(by), [by]);

  const items = data ?? SKELETON;
  const dimmed = loading && !data ? { opacity: 0.4 } : undefined;

  return (
    <div className="wf-panel" style={{ padding: 12 }}>
      <div className="row between">
        <div className="wf-label">Allocation</div>
        <div
          className="row gap-1"
          role="tablist"
          aria-label="Allocation grouping"
        >
          {TOGGLES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={by === t.id}
              className={by === t.id ? 'tab active' : 'tab'}
              style={{
                padding: '3px 8px',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.06em',
                background: by === t.id ? undefined : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
              onClick={() => setBy(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div
        style={{ marginTop: 10, ...dimmed }}
        aria-busy={loading}
      >
        {onSliceClick ? (
          // Wrap each row in a clickable shell. The drill target is the
          // top-most index.tsx, which decides what to do (e.g. scroll
          // HoldingsTable into view filtered by sector).
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {items.map((slice) => (
              <button
                key={slice.name}
                type="button"
                onClick={() => onSliceClick(slice, by)}
                title={`Drill into ${slice.name}`}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'inherit',
                }}
              >
                <SectorBars items={[slice]} />
              </button>
            ))}
          </div>
        ) : (
          <SectorBars items={items} />
        )}
      </div>
    </div>
  );
}
