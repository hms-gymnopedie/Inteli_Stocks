import { useMemo, useState } from 'react';
import { getHotspots } from '../../data/geo';
import type { RiskHotspot, RiskLevel } from '../../data/types';
import { useAsync } from '../../lib/useAsync';

type SortKey = 'impact' | 'level' | 'region';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'impact', label: 'Impact' },
  { value: 'level',  label: 'Level'  },
  { value: 'region', label: 'Region' },
];

const LEVEL_RANK: Record<RiskLevel, number> = { high: 0, med: 1, low: 2 };

/** Best-effort numeric extraction from "Semis · 32% impact" → 32. */
function parseImpact(impact: string): number {
  const match = impact.match(/(-?\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

const SKELETON_COUNT = 5;

export function Hotspots() {
  const { data, loading } = useAsync<RiskHotspot[]>(getHotspots, []);
  const [sortKey, setSortKey] = useState<SortKey>('impact');

  const sorted = useMemo<RiskHotspot[]>(() => {
    if (!data) return [];
    const list = [...data];
    switch (sortKey) {
      case 'impact':
        return list.sort((a, b) => parseImpact(b.impact) - parseImpact(a.impact));
      case 'level':
        return list.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);
      case 'region':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return list;
    }
  }, [data, sortKey]);

  const items: (RiskHotspot | null)[] =
    sorted.length > 0
      ? sorted
      : Array.from({ length: SKELETON_COUNT }, () => null);

  return (
    <div
      style={{
        padding: 14,
        borderBottom: '1px solid var(--hairline)',
      }}
    >
      <div className="row between" style={{ alignItems: 'center' }}>
        <div className="wf-label">Active hotspots · Ranked impact</div>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          aria-label="Sort hotspots"
          style={{
            all: 'unset',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.08em',
            color: 'var(--fg-3)',
            textTransform: 'uppercase',
            border: '1px solid var(--hairline)',
            padding: '2px 6px',
            borderRadius: 2,
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              SORT · {o.label.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
      <div
        style={{
          marginTop: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          opacity: loading && sorted.length === 0 ? 0.5 : 1,
          transition: 'opacity 200ms ease',
        }}
        aria-busy={loading && sorted.length === 0}
      >
        {items.map((r, i) => {
          if (!r) {
            return (
              <div
                key={`skeleton-${i}`}
                className="wf-panel-flat"
                style={{ padding: 10, opacity: 0.4 }}
              >
                <div className="row between">
                  <div className="wf-mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                    —
                  </div>
                  <span
                    className="tag"
                    style={{ color: 'var(--fg-3)', borderColor: 'var(--hairline)' }}
                  >
                    —
                  </span>
                </div>
                <div className="wf-mini muted" style={{ marginTop: 4 }}>
                  —
                </div>
                <div
                  className="wf-mono muted-2"
                  style={{ fontSize: 9, marginTop: 4, letterSpacing: '0.08em' }}
                >
                  —
                </div>
              </div>
            );
          }
          return (
            <div
              key={r.name}
              className="wf-panel-flat"
              style={{ padding: 10 }}
            >
              <div className="row between">
                <div
                  className="wf-mono"
                  style={{ fontSize: 11, color: 'var(--fg)' }}
                >
                  {r.name}
                </div>
                <span
                  className="tag"
                  style={{
                    color:
                      r.level === 'high' ? 'var(--down)' : 'var(--orange)',
                    borderColor:
                      r.level === 'high' ? 'var(--down)' : 'var(--orange)',
                  }}
                >
                  {r.level.toUpperCase()}
                </span>
              </div>
              <div className="wf-mini muted" style={{ marginTop: 4 }}>
                {r.impact}
              </div>
              <div
                className="wf-mono muted-2"
                style={{
                  fontSize: 9,
                  marginTop: 4,
                  letterSpacing: '0.08em',
                }}
              >
                {r.tickers}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
