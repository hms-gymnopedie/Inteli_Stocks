import { useMemo, useState, type CSSProperties } from 'react';

import { getTrades } from '../../data/portfolio';
import type { Trade } from '../../data/types';
import { useAsync } from '../../lib/useAsync';

type Period = '7D' | '30D' | '90D' | 'All';

const PERIODS: Period[] = ['7D', '30D', '90D', 'All'];

const PERIOD_DAYS: Record<Period, number | null> = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
  All: null,
};

const COLUMNS: { label: string; align?: 'right' | 'center' }[] = [
  { label: 'DATE' },
  { label: 'TICKER' },
  { label: 'SIDE', align: 'center' },
  { label: 'QTY', align: 'right' },
  { label: 'PRICE', align: 'right' },
  { label: 'CCY', align: 'center' },
];

const GRID_TEMPLATE = '90px 90px 60px 80px 90px 50px';

const SKELETON_ROWS = 5;

/** Lenient YYYY-MM-DD parser; falls back to Date.parse. */
function parseDate(s: string): number {
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function formatPrice(p: number, ccy: string): string {
  if (ccy === 'KRW' || ccy === 'JPY') return Math.round(p).toLocaleString();
  return p.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function TradesLog() {
  const [period, setPeriod] = useState<Period>('30D');
  const [symbolFilter, setSymbolFilter] = useState('');
  const { data, loading } = useAsync(() => getTrades(), []);

  const filtered = useMemo<Trade[]>(() => {
    if (!data) return [];
    const days = PERIOD_DAYS[period];
    const cutoff =
      days != null ? Date.now() - days * 24 * 60 * 60 * 1000 : null;
    const q = symbolFilter.trim().toLowerCase();
    return data.filter((t) => {
      if (cutoff != null && parseDate(t.date) < cutoff) return false;
      if (q && !t.symbol.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, period, symbolFilter]);

  const dimmed = loading && !data ? { opacity: 0.4 } : undefined;

  const cellAlign = (align?: 'right' | 'center'): CSSProperties => ({
    textAlign: align ?? 'left',
  });

  return (
    <div className="wf-panel" style={{ padding: 0 }}>
      <div className="row between" style={{ padding: 12, gap: 12, flexWrap: 'wrap' }}>
        <div className="wf-label">
          Trades log · {data ? `${filtered.length} of ${data.length}` : '—'}
        </div>
        <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="row gap-1" role="tablist" aria-label="Period filter">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={period === p}
                className={`chip${period === p ? ' active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            placeholder="Filter ticker…"
            aria-label="Filter trades by ticker"
            style={{
              background: 'var(--panel-2)',
              border: '1px solid var(--hairline)',
              borderRadius: 4,
              padding: '4px 8px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fg)',
              outline: 'none',
              width: 140,
            }}
          />
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
        {COLUMNS.map((c) => (
          <span key={c.label} style={cellAlign(c.align)}>
            {c.label}
          </span>
        ))}
      </div>

      <div style={dimmed} aria-busy={loading}>
        {data && filtered.length === 0 && (
          <div
            className="dense-row"
            style={{
              gridTemplateColumns: '1fr',
              color: 'var(--fg-3)',
              fontStyle: 'italic',
            }}
          >
            <span>No trades match.</span>
          </div>
        )}
        {data
          ? filtered.map((t, i) => (
              <div
                key={`${t.date}-${t.symbol}-${i}`}
                className="dense-row"
                style={{ gridTemplateColumns: GRID_TEMPLATE }}
              >
                <span className="muted">{t.date}</span>
                <span className="ticker">{t.symbol}</span>
                <span
                  style={{
                    ...cellAlign('center'),
                    color: t.side === 'BUY' ? 'var(--up)' : 'var(--down)',
                  }}
                >
                  {t.side}
                </span>
                <span style={cellAlign('right')}>
                  {t.quantity.toLocaleString()}
                </span>
                <span style={{ ...cellAlign('right'), color: 'var(--fg)' }}>
                  {formatPrice(t.price, t.currency)}
                </span>
                <span className="muted-2" style={cellAlign('center')}>
                  {t.currency}
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
                <span>———</span>
                <span className="ticker">———</span>
                <span style={cellAlign('center')}>—</span>
                <span style={cellAlign('right')}>—</span>
                <span style={cellAlign('right')}>—</span>
                <span style={cellAlign('center')}>—</span>
              </div>
            ))}
      </div>
    </div>
  );
}
