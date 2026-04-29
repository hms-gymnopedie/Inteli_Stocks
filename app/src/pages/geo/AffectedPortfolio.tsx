import { getAffected } from '../../data/geo';
import type { AffectedHolding } from '../../data/types';
import { useAsync } from '../../lib/useAsync';

const SKELETON_COUNT = 4;

export function AffectedPortfolio() {
  const { data, loading } = useAsync<AffectedHolding[]>(
    () => getAffected('default'),
    [],
  );

  const items: (AffectedHolding | null)[] =
    data && data.length > 0
      ? data
      : Array.from({ length: SKELETON_COUNT }, () => null);

  return (
    <div
      style={{
        padding: 14,
        borderBottom: '1px solid var(--hairline)',
        opacity: loading && !data ? 0.5 : 1,
        transition: 'opacity 200ms ease',
      }}
      aria-busy={loading && !data}
    >
      <div className="wf-label">Affected · Your portfolio</div>
      <div style={{ marginTop: 8 }}>
        {items.map((h, i) => {
          if (!h) {
            return (
              <div
                key={`skeleton-${i}`}
                className="row between"
                style={{
                  padding: '6px 0',
                  borderBottom: '1px solid var(--hairline)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  opacity: 0.4,
                }}
              >
                <span className="ticker">—</span>
                <span className="muted">w —</span>
                <span className="muted">—</span>
              </div>
            );
          }
          return (
            <div
              key={h.symbol}
              className="row between"
              style={{
                padding: '6px 0',
                borderBottom: '1px solid var(--hairline)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
              }}
            >
              <span className="ticker">{h.symbol}</span>
              <span className="muted">w {h.weight}</span>
              <span
                style={{
                  color: h.direction > 0 ? 'var(--up)' : 'var(--down)',
                }}
              >
                {h.scenarioPnl}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
