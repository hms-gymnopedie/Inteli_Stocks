/**
 * Recent trades table for /positions (B19).
 *
 * Shares the data layer with portfolio's TradesLog but renders simpler
 * (no period chips / ticker filter — those belong in /portfolio's
 * dedicated trades widget). Adds a delete-row affordance so the user
 * can correct mistakes.
 */

import { useState, type CSSProperties } from 'react';

import { deleteTrade, getTrades } from '../../data/portfolio';
import type { Trade } from '../../data/types';
import { useAsync } from '../../lib/useAsync';

const COLUMNS: { label: string; align?: 'right' | 'center' }[] = [
  { label: 'DATE' },
  { label: 'TICKER' },
  { label: 'SIDE', align: 'center' },
  { label: 'QTY', align: 'right' },
  { label: 'PRICE', align: 'right' },
  { label: 'CCY', align: 'center' },
  { label: '' },
];
const GRID_TEMPLATE = '90px 90px 60px 80px 90px 50px 28px';

export function RecentTrades({ refreshKey }: { refreshKey: number }) {
  const [busy, setBusy] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const { data, loading } = useAsync<Trade[]>(() => getTrades(), [refreshKey, refreshNonce]);

  async function onDelete(idx: number, label: string) {
    if (!window.confirm(`Remove trade: ${label}?`)) return;
    setBusy(true);
    try {
      await deleteTrade(idx);
      setRefreshNonce((n) => n + 1);
    } finally { setBusy(false); }
  }

  const align = (a?: 'right' | 'center'): CSSProperties => ({ textAlign: a ?? 'left' });
  const dimmed = loading && !data ? { opacity: 0.4 } : undefined;
  const rows = data ?? [];

  return (
    <div className="wf-panel" style={{ padding: 0 }}>
      <div className="row between" style={{ padding: 12 }}>
        <div className="wf-label">Recent trades · {rows.length}</div>
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
          <span key={c.label} style={align(c.align)}>{c.label}</span>
        ))}
      </div>
      <div style={dimmed} aria-busy={loading}>
        {data && rows.length === 0 && (
          <div
            className="dense-row"
            style={{ gridTemplateColumns: '1fr', color: 'var(--fg-3)', fontStyle: 'italic' }}
          >
            <span>No trades yet.</span>
          </div>
        )}
        {rows.map((t, i) => (
          <div
            key={`${t.date}-${t.symbol}-${i}`}
            className="dense-row"
            style={{ gridTemplateColumns: GRID_TEMPLATE }}
          >
            <span className="muted">{t.date}</span>
            <span className="ticker">{t.symbol}</span>
            <span style={{ ...align('center'), color: t.side === 'BUY' ? 'var(--up)' : 'var(--down)' }}>
              {t.side}
            </span>
            <span style={align('right')}>{t.quantity.toLocaleString()}</span>
            <span style={{ ...align('right'), color: 'var(--fg)' }}>
              {t.currency === 'KRW' || t.currency === 'JPY'
                ? Math.round(t.price).toLocaleString()
                : t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="muted-2" style={align('center')}>{t.currency}</span>
            <button
              type="button"
              onClick={() => void onDelete(i, `${t.date} ${t.side} ${t.quantity} ${t.symbol}`)}
              disabled={busy}
              aria-label="Remove trade"
              title="Remove trade"
              style={{
                background: 'transparent', border: 0,
                color: 'var(--fg-4)', cursor: 'pointer',
                padding: 0, fontFamily: 'var(--font-mono)', fontSize: 12,
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
