import { useMemo, useState, type CSSProperties } from 'react';

import { getHoldings } from '../../data/portfolio';
import type { Holding } from '../../data/types';
import { Spark } from '../../lib/primitives';
import { useAsync } from '../../lib/useAsync';

type SortKey = 'symbol' | 'name' | 'weight' | 'price' | 'dayPct' | 'plPct' | 'risk';
type SortDir = 'asc' | 'desc';

interface SortState {
  key: SortKey;
  dir: SortDir;
}

const COLUMNS: { key: SortKey | null; label: string }[] = [
  { key: 'symbol', label: 'TICKER' },
  { key: 'name',   label: 'NAME' },
  { key: 'weight', label: 'WEIGHT' },
  { key: 'price',  label: 'PRICE' },
  { key: 'dayPct', label: 'DAY %' },
  { key: 'plPct',  label: 'P/L %' },
  { key: null,     label: '30D TREND' },
  { key: 'risk',   label: 'RISK' },
];

const GRID_TEMPLATE = '90px 1fr 70px 70px 80px 70px 90px 50px';

/**
 * Strip a leading currency glyph + commas and convert the typographic minus
 * (U+2212) used in the prototype back into an ASCII `-` so the value parses
 * as a number for sort comparison.
 */
function parseNumeric(s: string): number {
  const cleaned = s
    .replace(/[$₩€¥£]/g, '')
    .replace(/,/g, '')
    .replace(/−/g, '-')
    .replace(/[%+]/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function compare(a: Holding, b: Holding, key: SortKey): number {
  switch (key) {
    case 'symbol':
    case 'name':
      return a[key].localeCompare(b[key]);
    case 'risk':
      return a.risk - b.risk;
    case 'weight':
    case 'price':
    case 'dayPct':
    case 'plPct':
      return parseNumeric(a[key]) - parseNumeric(b[key]);
    default:
      return 0;
  }
}

const SKELETON_ROWS = 8;

export function HoldingsTable() {
  const [sort, setSort] = useState<SortState>({ key: 'weight', dir: 'desc' });
  const [filter, setFilter] = useState('');
  const { data, loading } = useAsync(() => getHoldings(), []);

  const filteredSorted = useMemo<Holding[]>(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? data.filter(
          (h) =>
            h.symbol.toLowerCase().includes(q) ||
            h.name.toLowerCase().includes(q),
        )
      : data;
    const sorted = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === 'asc' ? sorted : sorted.reverse();
  }, [data, filter, sort]);

  const handleSort = (key: SortKey | null) => {
    if (!key) return;
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'symbol' || key === 'name' ? 'asc' : 'desc' },
    );
  };

  const headerCellStyle = (key: SortKey | null): CSSProperties => ({
    cursor: key ? 'pointer' : 'default',
    userSelect: 'none',
    color: key && sort.key === key ? 'var(--fg)' : undefined,
  });

  const rowsToRender = data ? filteredSorted : Array.from({ length: SKELETON_ROWS });
  const dimmed = loading && !data ? { opacity: 0.4 } : undefined;
  const positionCount = data?.length ?? 0;

  return (
    <div className="wf-panel" style={{ padding: 0 }}>
      <div className="row between" style={{ padding: 12, gap: 12 }}>
        <div className="wf-label">
          Holdings · {data ? `${positionCount} positions` : '— positions'}
        </div>
        <div className="row gap-2" style={{ alignItems: 'center' }}>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter ticker or name…"
            aria-label="Filter holdings"
            style={{
              background: 'var(--panel-2)',
              border: '1px solid var(--hairline)',
              borderRadius: 4,
              padding: '4px 8px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fg)',
              outline: 'none',
              width: 180,
            }}
          />
          <span className="tag">EXPORT</span>
        </div>
      </div>
      <div
        className="dense-row"
        style={{
          gridTemplateColumns: GRID_TEMPLATE,
          color: 'var(--fg-3)',
          borderTop: '1px solid var(--hairline)',
        }}
      >
        {COLUMNS.map((c) => {
          const active = c.key && sort.key === c.key;
          const arrow = active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';
          return (
            <span
              key={c.label}
              role={c.key ? 'button' : undefined}
              tabIndex={c.key ? 0 : -1}
              aria-sort={
                active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
              }
              style={headerCellStyle(c.key)}
              onClick={() => handleSort(c.key)}
              onKeyDown={(e) => {
                if (c.key && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handleSort(c.key);
                }
              }}
            >
              {c.label}
              {arrow}
            </span>
          );
        })}
      </div>
      <div style={dimmed} aria-busy={loading}>
        {data && filteredSorted.length === 0 && (
          <div
            className="dense-row"
            style={{
              gridTemplateColumns: '1fr',
              color: 'var(--fg-3)',
              fontStyle: 'italic',
            }}
          >
            <span>No holdings match “{filter}”.</span>
          </div>
        )}
        {data
          ? filteredSorted.map((r) => (
              <div
                key={r.symbol}
                className="dense-row"
                style={{ gridTemplateColumns: GRID_TEMPLATE }}
              >
                <span className="ticker">{r.symbol}</span>
                <span
                  className="muted"
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.name}
                </span>
                <span>{r.weight}</span>
                <span style={{ color: 'var(--fg)' }}>{r.price}</span>
                <span
                  style={{
                    color: r.dayPct.startsWith('+')
                      ? 'var(--up)'
                      : 'var(--down)',
                  }}
                >
                  {r.dayPct}%
                </span>
                <span
                  style={{
                    color: r.plPct.startsWith('−')
                      ? 'var(--down)'
                      : 'var(--up)',
                  }}
                >
                  {r.plPct}
                </span>
                <Spark seed={r.sparkSeed} trend={0.4} />
                <span className="tag" style={{ textAlign: 'center' }}>
                  {r.risk}/5
                </span>
              </div>
            ))
          : Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <div
                key={i}
                className="dense-row"
                style={{
                  gridTemplateColumns: GRID_TEMPLATE,
                  color: 'var(--fg-4)',
                }}
              >
                <span className="ticker">———</span>
                <span className="muted">———————</span>
                <span>—%</span>
                <span>—</span>
                <span>—</span>
                <span>—</span>
                <Spark seed={70 + i} trend={0} color="var(--fg-4)" />
                <span className="tag" style={{ textAlign: 'center' }}>
                  —/5
                </span>
              </div>
            ))}
      </div>
    </div>
  );
}
