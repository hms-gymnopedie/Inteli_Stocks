import { useNavigate } from 'react-router-dom';
import { getIndices } from '../../data/market';
import type { Index } from '../../data/types';
import { useAsync } from '../../lib/useAsync';

const SKELETON_COUNT = 8;

export function IndicesStrip() {
  const { data, loading } = useAsync<Index[]>(getIndices, []);
  const navigate = useNavigate();

  const items: (Index | null)[] = data
    ? data
    : Array.from({ length: SKELETON_COUNT }, () => null);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${items.length || SKELETON_COUNT}, 1fr)`,
        borderBottom: '1px solid var(--hairline)',
      }}
    >
      {items.map((row, i) => {
        const last = i === items.length - 1;
        if (!row) {
          return (
            <div
              key={`skeleton-${i}`}
              style={{
                padding: '8px 10px',
                borderRight: !last ? '1px solid var(--hairline)' : 0,
                opacity: 0.4,
              }}
              aria-busy={loading}
            >
              <div className="wf-mini">—</div>
              <div
                className="wf-mono"
                style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 2 }}
              >
                —
              </div>
              <div className="wf-mono" style={{ fontSize: 10, color: 'var(--fg-4)' }}>
                —
              </div>
            </div>
          );
        }
        return (
          <button
            key={row.ticker}
            type="button"
            onClick={() =>
              navigate('/detail/' + encodeURIComponent(row.ticker))
            }
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              cursor: 'pointer',
              padding: '8px 10px',
              borderRight: !last ? '1px solid var(--hairline)' : 0,
              display: 'block',
              width: '100%',
            }}
            title={`Open ${row.label} detail`}
            aria-label={`${row.label} ${row.price} ${row.change}, open detail`}
          >
            <div className="wf-mini">{row.label}</div>
            <div
              className="wf-mono"
              style={{ fontSize: 13, color: 'var(--fg)', marginTop: 2 }}
            >
              {row.price}
            </div>
            <div
              className="wf-mono"
              style={{
                fontSize: 10,
                color: row.direction > 0 ? 'var(--up)' : 'var(--down)',
              }}
            >
              {row.change}
            </div>
          </button>
        );
      })}
    </div>
  );
}
