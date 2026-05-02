import { useMemo } from 'react';
import { getSPConstituents } from '../../data/market';
import type { Constituent } from '../../data/types';
import { useAsync } from '../../lib/useAsync';

// Display order for sectors — semis stays adjacent to tech because
// the user reading the heatmap thinks of them as paired.
const SECTOR_ORDER = [
  'Tech',
  'Semis',
  'Software',
  'Communication',
  'Financials',
  'Healthcare',
  'Energy',
  'Industrials',
  'Cons. Disc.',
  'Cons. Staples',
] as const;

const UNGROUPED = 'Other';

// 50 placeholder cells (10 sectors × 5 tickers) — same shape as the loaded
// heatmap so the skeleton doesn't reflow when data lands.
const SKELETON_CELLS: Constituent[] = SECTOR_ORDER.flatMap((s) =>
  Array.from({ length: 5 }, () => ({ t: '—', v: 0, sector: s })),
);

/** Background color for a cell, mirroring the previous HeatGrid heuristic. */
function cellBg(v: number): string {
  const a = Math.min(1, Math.abs(v) / 4);
  return v >= 0
    ? `rgba(111, 207, 138, ${0.1 + a * 0.55})`
    : `rgba(226, 94, 94, ${0.1 + a * 0.55})`;
}

interface SectorBlock {
  name: string;
  cells: Constituent[];
}

/** Groups constituents by sector, preserving SECTOR_ORDER for known sectors
 *  and appending any unknowns at the end (under "Other"). */
function groupBySector(cells: Constituent[]): SectorBlock[] {
  const buckets = new Map<string, Constituent[]>();
  for (const c of cells) {
    const key = c.sector ?? UNGROUPED;
    const arr = buckets.get(key);
    if (arr) arr.push(c);
    else buckets.set(key, [c]);
  }
  const blocks: SectorBlock[] = [];
  for (const name of SECTOR_ORDER) {
    const list = buckets.get(name);
    if (list && list.length > 0) blocks.push({ name, cells: list });
  }
  // Append any sectors not in the known order at the bottom.
  for (const [name, list] of buckets) {
    if (!(SECTOR_ORDER as readonly string[]).includes(name)) {
      blocks.push({ name, cells: list });
    }
  }
  return blocks;
}

export function SectorHeat() {
  const { data, loading } = useAsync<Constituent[]>(getSPConstituents, []);
  const cells = data ?? SKELETON_CELLS;
  const blocks = useMemo(() => groupBySector(cells), [cells]);

  return (
    <div className="wf-panel" style={{ padding: 12 }}>
      <div className="row between">
        <div>
          <div className="wf-label">S&amp;P 500 · Sector heatmap</div>
          <div className="wf-mini muted-2" style={{ marginTop: 2 }}>
            top 5 by market cap per sector · day % change
          </div>
        </div>
        <div className="wf-mini">SESSION</div>
      </div>
      <div
        style={{
          marginTop: 10,
          opacity: loading && !data ? 0.4 : 1,
          transition: 'opacity 120ms linear',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
        aria-busy={loading}
      >
        {blocks.map((block) => (
          <div
            key={block.name}
            style={{
              display: 'grid',
              gridTemplateColumns: '78px 1fr',
              alignItems: 'stretch',
              gap: 6,
            }}
          >
            <div
              className="wf-mini"
              style={{
                display: 'flex',
                alignItems: 'center',
                color: 'var(--fg-3)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                paddingRight: 4,
              }}
              title={`${block.name} · ${block.cells.length} tickers`}
            >
              {block.name}
            </div>
            <div
              role="row"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.max(block.cells.length, 1)}, 1fr)`,
                gap: 2,
              }}
            >
              {block.cells.map((c, i) => (
                <div
                  key={`${block.name}-${c.t}-${i}`}
                  role="gridcell"
                  title={`${c.t} · ${block.name} · ${c.v >= 0 ? '+' : ''}${c.v.toFixed(2)}%`}
                  style={{
                    background: cellBg(c.v),
                    padding: '6px 6px',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid rgba(255,255,255,0.04)',
                    minHeight: 40,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--fg)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {c.t}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      color: 'var(--fg-2)',
                      marginTop: 'auto',
                    }}
                  >
                    {c.v >= 0 ? '+' : ''}
                    {c.v.toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
