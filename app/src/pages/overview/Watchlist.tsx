import { getWatchlist } from '../../data/portfolio';
import type { WatchlistEntry } from '../../data/types';
import { Spark } from '../../lib/primitives';
import { useAsync } from '../../lib/useAsync';

const SKELETON_ROWS = 5;

export function Watchlist() {
  const { data, loading } = useAsync<WatchlistEntry[]>(
    () => getWatchlist('KR'),
    [],
  );

  const rows: (WatchlistEntry | null)[] = data
    ? data
    : Array.from({ length: SKELETON_ROWS }, () => null);

  return (
    <div>
      <div className="wf-label">Watchlist · Korea</div>
      <div style={{ marginTop: 8 }} aria-busy={loading}>
        {rows.map((row, i) =>
          row ? (
            <div
              key={row.code}
              className="row between"
              style={{
                padding: '5px 0',
                borderBottom: '1px solid var(--hairline)',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div>
                <div style={{ color: 'var(--fg)' }}>{row.code}</div>
                <div className="muted" style={{ fontSize: 9 }}>
                  {row.name}
                </div>
              </div>
              <Spark
                seed={row.seed}
                trend={row.direction}
                color={row.direction > 0 ? 'var(--up)' : 'var(--down)'}
              />
              <div
                style={{
                  color: row.direction > 0 ? 'var(--up)' : 'var(--down)',
                  minWidth: 50,
                  textAlign: 'right',
                }}
              >
                {row.change}
              </div>
            </div>
          ) : (
            <div
              key={`sk-${i}`}
              className="row between"
              style={{
                padding: '5px 0',
                borderBottom: '1px solid var(--hairline)',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                opacity: 0.4,
              }}
            >
              <div>
                <div style={{ color: 'var(--fg-3)' }}>—</div>
                <div className="muted" style={{ fontSize: 9 }}>
                  —
                </div>
              </div>
              <span style={{ color: 'var(--fg-4)' }}>—</span>
              <div style={{ color: 'var(--fg-4)', minWidth: 50, textAlign: 'right' }}>
                —
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
