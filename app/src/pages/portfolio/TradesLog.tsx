import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import {
  addTrade,
  deleteTrade,
  getTrades,
  updateTrade,
} from '../../data/portfolio';
import {
  addPosition,
  deletePosition,
  listPositions,
  type PositionRationale,
  updatePosition,
} from '../../data/positions';
import type { Trade } from '../../data/types';
import { useAsync } from '../../lib/useAsync';
import { TradeFormFull } from './TradeFormFull';

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
  { label: 'TRG', align: 'center' },
  { label: '' },
];

const GRID_TEMPLATE = '90px 90px 60px 80px 90px 50px 38px 56px';

const SKELETON_ROWS = 5;

type FormMode =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; idx: number };

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
  const [formMode, setFormMode] = useState<FormMode>({ kind: 'closed' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const { data, loading } = useAsync(() => getTrades(), [refreshNonce]);

  // Active rationales — used to (a) badge BUY rows that have triggers, and
  // (b) prefill the trigger inputs when editing such a row.
  const [rationales, setRationales] = useState<PositionRationale[]>([]);
  useEffect(() => {
    let cancelled = false;
    void listPositions()
      .then((rs) => { if (!cancelled) setRationales(rs); })
      .catch(() => { /* silent: trigger ux degrades to "no badge" */ });
    return () => { cancelled = true; };
  }, [refreshNonce]);

  function activeRationaleForSymbol(sym: string): PositionRationale | null {
    const u = sym.toUpperCase();
    const matches = rationales.filter((r) => r.symbol.toUpperCase() === u && r.firedAt == null);
    if (matches.length === 0) return null;
    matches.sort((a, b) => b.createdAt - a.createdAt);
    return matches[0];
  }

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

  type RatAction = Parameters<typeof TradeFormFull>[0]['onSave'] extends (
    t: Trade, a: infer A,
  ) => unknown ? A : never;

  async function applyRationaleAction(
    trade: Trade,
    action: RatAction,
  ): Promise<void> {
    if (action.kind === 'create') {
      await addPosition({
        symbol:     trade.symbol,
        reason:     action.reason,
        entryPrice: trade.price,
        triggers:   action.triggers,
      });
    } else if (action.kind === 'update') {
      await updatePosition(action.id, {
        reason:     action.reason,
        entryPrice: trade.price,
        triggers:   action.triggers,
      });
    } else if (action.kind === 'delete') {
      await deletePosition(action.id);
    }
  }

  async function onCreateSubmit(trade: Trade, action: RatAction): Promise<void> {
    setBusy(true); setErr(null);
    try {
      await addTrade(trade);
      await applyRationaleAction(trade, action);
      setFormMode({ kind: 'closed' });
      setRefreshNonce((n) => n + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      throw e;
    } finally { setBusy(false); }
  }

  async function onEditSubmit(idx: number, trade: Trade, action: RatAction): Promise<void> {
    setBusy(true); setErr(null);
    try {
      await updateTrade(idx, trade);
      await applyRationaleAction(trade, action);
      setFormMode({ kind: 'closed' });
      setRefreshNonce((n) => n + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      throw e;
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

  // The trade currently being edited, if any.
  const editingTrade = formMode.kind === 'edit' && data ? data[formMode.idx] : null;

  return (
    <div className="wf-panel" data-tour="pf-trades" style={{ padding: 0 }}>
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
            onClick={() => setFormMode({ kind: 'create' })}
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
      {formMode.kind === 'create' && (
        <TradeFormFull
          onSave={onCreateSubmit}
          onCancel={() => setFormMode({ kind: 'closed' })}
        />
      )}
      {formMode.kind === 'edit' && editingTrade && (
        <TradeFormFull
          key={`edit-${formMode.idx}`}
          initial={{
            trade:     editingTrade,
            rationale: activeRationaleForSymbol(editingTrade.symbol),
          }}
          onSave={(t, a) => onEditSubmit(formMode.idx, t, a)}
          onCancel={() => setFormMode({ kind: 'closed' })}
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
          <span key={c.label || 'actions'} style={cellAlign(c.align)}>
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
          ? filtered.map((t) => {
              const origIdx = data.indexOf(t);
              const rat = t.side === 'BUY' ? activeRationaleForSymbol(t.symbol) : null;
              const triggerCount = rat ? rat.triggers.length : 0;
              return (
                <div
                  key={`${origIdx}-${t.date}-${t.symbol}`}
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
                  <span
                    style={{
                      ...cellAlign('center'),
                      color: triggerCount > 0 ? 'var(--orange)' : 'var(--fg-4)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                    }}
                    title={triggerCount > 0 ? `${triggerCount} sell trigger(s) active` : 'no triggers'}
                  >
                    {triggerCount > 0 ? `★${triggerCount}` : '—'}
                  </span>
                  <span className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => setFormMode({ kind: 'edit', idx: origIdx })}
                      disabled={busy}
                      aria-label="Edit trade"
                      title="Edit trade"
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
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(
                        origIdx,
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
                  </span>
                </div>
              );
            })
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
                <span style={cellAlign('center')}>—</span>
                <span />
              </div>
            ))}
      </div>
    </div>
  );
}
