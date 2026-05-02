import { useMemo, useState, type CSSProperties } from 'react';

import { addTrade, deleteTrade, getTrades } from '../../data/portfolio';
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
  { label: '' },
];

const GRID_TEMPLATE = '90px 90px 60px 80px 90px 50px 28px';

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
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const { data, loading } = useAsync(() => getTrades(), [refreshNonce]);

  async function onDelete(idx: number, label: string) {
    if (!window.confirm(`Remove trade: ${label}?`)) return;
    setBusy(true); setErr(null);
    try {
      await deleteTrade(idx);
      setRefreshNonce((n) => n + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function onCreate(t: Trade) {
    setBusy(true); setErr(null);
    try {
      await addTrade(t);
      setShowAdd(false);
      setRefreshNonce((n) => n + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

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
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            disabled={busy}
            className="tag"
            style={{ background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            + ADD TRADE
          </button>
        </div>
      </div>
      {err && (
        <div className="wf-mini" style={{ color: 'var(--down)', padding: '0 12px 6px' }}>
          {err}
        </div>
      )}
      {showAdd && (
        <TradeForm
          onSubmit={onCreate}
          onCancel={() => setShowAdd(false)}
          busy={busy}
        />
      )}

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
                <button
                  type="button"
                  onClick={() => void onDelete(
                    // Compute original-array index (filter may differ from data order).
                    data.indexOf(t),
                    `${t.date} ${t.side} ${t.quantity} ${t.symbol}`,
                  )}
                  disabled={busy}
                  aria-label="Remove trade"
                  title="Remove trade"
                  style={{
                    background: 'transparent',
                    border: 0,
                    color: 'var(--fg-4)',
                    cursor: 'pointer',
                    padding: 0,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                  }}
                >
                  ✕
                </button>
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
                <span />
              </div>
            ))}
      </div>
    </div>
  );
}

// ─── Add-trade inline form ──────────────────────────────────────────────────

function TradeForm({
  onSubmit, onCancel, busy,
}: { onSubmit: (t: Trade) => void; onCancel: () => void; busy: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date,     setDate]     = useState(today);
  const [symbol,   setSymbol]   = useState('');
  const [side,     setSide]     = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('1');
  const [price,    setPrice]    = useState('');
  const [currency, setCurrency] = useState('USD');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      date,
      symbol: symbol.trim().toUpperCase(),
      side,
      quantity: Number(quantity) || 0,
      price:    Number(price) || 0,
      currency,
    });
  };

  const cell: React.CSSProperties = {
    background: 'var(--panel-2)',
    border: '1px solid var(--hairline)',
    borderRadius: 4,
    padding: '4px 8px',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--fg)',
    outline: 'none',
    minWidth: 0,
  };

  return (
    <form
      onSubmit={submit}
      style={{
        display: 'grid',
        gridTemplateColumns: GRID_TEMPLATE,
        gap: 6,
        padding: '8px 12px',
        borderTop: '1px solid var(--hairline)',
        borderBottom: '1px solid var(--hairline)',
        background: 'var(--panel-2)',
        alignItems: 'center',
      }}
    >
      <input style={cell} type="date"    value={date}     onChange={(e) => setDate(e.target.value)}     required />
      <input style={cell}                value={symbol}   onChange={(e) => setSymbol(e.target.value)}   placeholder="NVDA" required />
      <select style={cell}              value={side}     onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}>
        <option value="BUY">BUY</option>
        <option value="SELL">SELL</option>
      </select>
      <input style={cell} type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
      <input style={cell} type="number" min="0" step="any" value={price}    onChange={(e) => setPrice(e.target.value)} placeholder="900" required />
      <select style={cell}              value={currency} onChange={(e) => setCurrency(e.target.value)}>
        <option>USD</option><option>KRW</option><option>EUR</option><option>JPY</option>
      </select>
      <div className="row gap-1">
        <button type="submit" className="tag" style={{ background: 'var(--orange)', color: '#000', border: 0, cursor: 'pointer' }} disabled={busy}>OK</button>
        <button type="button" className="tag" style={{ background: 'transparent', cursor: 'pointer' }} onClick={onCancel}>×</button>
      </div>
    </form>
  );
}
