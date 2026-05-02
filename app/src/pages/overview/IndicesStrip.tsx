import { useNavigate } from 'react-router-dom';
import { getIndices } from '../../data/market';
import type { Index } from '../../data/types';
import { indexToProxy } from '../../lib/indexProxy';
import { useAsync } from '../../lib/useAsync';

const SKELETON_COUNT = 8;

/**
 * Display tickers used in the strip don't always match Yahoo-style index
 * symbols (e.g. "SPX" instead of "^GSPC"). The proxy lookup table in
 * `indexProxy.ts` is keyed by Yahoo symbols, so we translate here before
 * the lookup.
 */
const TICKER_ALIASES: Record<string, string> = {
  SPX:  '^GSPC',
  COMP: '^IXIC',
  INDU: '^DJI',
};

function resolveProxy(ticker: string): string | null {
  // Try the ticker as-is first (covers ^KS11, ^VIX, ^TNX), then alias.
  return indexToProxy(ticker) ?? indexToProxy(TICKER_ALIASES[ticker] ?? '');
}

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

        const proxy = resolveProxy(row.ticker);
        const tradable = proxy ?? row.ticker;
        const navigable = proxy !== null;

        // Title hint communicates the substitution so the user understands
        // why "S&P 500" lands on the SPY page.
        const tooltip = proxy
          ? `${row.label} → ${proxy} ETF`
          : `${row.label} (no tradable proxy)`;

        return (
          <button
            key={row.ticker}
            type="button"
            onClick={() => {
              if (!navigable) return; // no-op when there's no sensible proxy
              navigate('/detail/' + encodeURIComponent(tradable));
            }}
            aria-disabled={!navigable}
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              cursor: navigable ? 'pointer' : 'default',
              padding: '8px 10px',
              borderRight: !last ? '1px solid var(--hairline)' : 0,
              display: 'block',
              width: '100%',
            }}
            title={tooltip}
            aria-label={
              navigable
                ? `${row.label} ${row.price} ${row.change}, open ${proxy} detail`
                : `${row.label} ${row.price} ${row.change}, no detail available`
            }
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
