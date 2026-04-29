import { getFundamentals } from '../../data/security';
import type { Fundamental } from '../../data/types';
import { useAsync } from '../../lib/useAsync';

interface ValuationGridProps {
  symbol: string;
}

const COLS = 6;
const SKELETON_CELLS = 12;

/**
 * 6×2 grid of fundamental metrics (MKT CAP, P/E, P/S, etc).
 *
 * The `Fundamental` type has an optional `note?: string`. The convention from
 * the original prototype is:
 *   - `note === 'up'`  → tint the value green (positive change indicator)
 *   - any other string → render the note as a small dimmed line under the value
 *                        (e.g. "sector 28.4")
 *   - undefined        → no extra line, no tint
 * Always guard with `m.note ?? ''` / explicit `m.note !== undefined` checks —
 * never index into `note` without a guard.
 */
export function ValuationGrid({ symbol }: ValuationGridProps) {
  const { data, loading } = useAsync(() => getFundamentals(symbol), [symbol]);

  const cells = data ?? [];
  const dimmed = loading && !data ? { opacity: 0.4 } : undefined;

  return (
    <div className="wf-panel" style={{ padding: 12 }} aria-busy={loading}>
      <div className="row between">
        <div className="wf-label">Valuation · Fundamentals</div>
        <div className="wf-mini muted-2">FY24 · TTM</div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gap: 12,
          marginTop: 10,
          ...dimmed,
        }}
      >
        {data
          ? cells.map((m, i) => <Cell key={m.label} m={m} index={i} />)
          : Array.from({ length: SKELETON_CELLS }).map((_, i) => (
              <SkeletonCell key={i} index={i} />
            ))}
      </div>
    </div>
  );
}

function Cell({ m, index }: { m: Fundamental; index: number }) {
  const isUp = m.note === 'up';
  const note = m.note ?? '';
  const showNoteText = note.length > 0 && note !== 'up';
  return (
    <div
      style={{
        borderTop: index >= COLS ? '1px solid var(--hairline)' : 0,
        paddingTop: index >= COLS ? 10 : 0,
      }}
    >
      <div className="wf-mini">{m.label}</div>
      <div
        className={`wf-num ${isUp ? 'up' : ''}`}
        style={{ fontSize: 16, marginTop: 2 }}
      >
        {m.value}
      </div>
      {showNoteText && <div className="wf-mini muted-2">{note}</div>}
    </div>
  );
}

function SkeletonCell({ index }: { index: number }) {
  return (
    <div
      style={{
        borderTop: index >= COLS ? '1px solid var(--hairline)' : 0,
        paddingTop: index >= COLS ? 10 : 0,
      }}
    >
      <div className="wf-mini">———</div>
      <div
        className="wf-num"
        style={{ fontSize: 16, marginTop: 2, color: 'var(--fg-4)' }}
      >
        —
      </div>
    </div>
  );
}
