/**
 * Recent trades table for /positions (B19, B29-2).
 *
 * Each row is clickable / has a ✎ button — opens an inline TradeFormFull
 * prefilled with the trade and any active rationale's reason + triggers,
 * so the user can edit a sell-by-date or stop-loss without hopping to
 * /portfolio. (B29-2)
 */

import { useEffect, useState, type CSSProperties } from 'react';

import { deleteTrade, getTrades, updateTrade } from '../../data/portfolio';
import {
  addPosition,
  deletePosition,
  listPositions,
  type PositionRationale,
  updatePosition,
} from '../../data/positions';
import type { Trade } from '../../data/types';
import { useAsync } from '../../lib/useAsync';
import { TradeFormFull } from '../portfolio/TradeFormFull';

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

interface Props {
  refreshKey: number;
  /** Called after the row's rationale is mutated, so the parent page can
   *  re-fetch its active rationales list. */
  onRationaleChanged?: () => void;
}

export function RecentTrades({ refreshKey, onRationaleChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const { data, loading } = useAsync<Trade[]>(
    () => getTrades(),
    [refreshKey, refreshNonce],
  );

  const [rationales, setRationales] = useState<PositionRationale[]>([]);
  useEffect(() => {
    let cancelled = false;
    void listPositions()
      .then((rs) => { if (!cancelled) setRationales(rs); })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [refreshKey, refreshNonce]);

  function activeRationaleForSymbol(sym: string): PositionRationale | null {
    const u = sym.toUpperCase();
    const matches = rationales.filter((r) => r.symbol.toUpperCase() === u && r.firedAt == null);
    if (matches.length === 0) return null;
    matches.sort((a, b) => b.createdAt - a.createdAt);
    return matches[0];
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

  async function onEditSubmit(idx: number, trade: Trade, action: RatAction): Promise<void> {
    setBusy(true); setErr(null);
    try {
      await updateTrade(idx, trade);
      await applyRationaleAction(trade, action);
      setEditIdx(null);
      setRefreshNonce((n) => n + 1);
      onRationaleChanged?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      throw e;
    } finally { setBusy(false); }
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

  const align = (a?: 'right' | 'center'): CSSProperties => ({ textAlign: a ?? 'left' });
  const dimmed = loading && !data ? { opacity: 0.4 } : undefined;
  const rows = data ?? [];

  const editingTrade = editIdx != null && data ? data[editIdx] : null;

  return (
    <div className="wf-panel" style={{ padding: 0 }}>
      <div className="row between" style={{ padding: 12 }}>
        <div className="wf-label">Recent trades · {rows.length}</div>
        <span className="wf-mini muted-2">click a row to edit triggers</span>
      </div>
      {err && (
        <div className="wf-mini" style={{ color: 'var(--down)', padding: '0 12px 6px' }}>
          {err}
        </div>
      )}
      {editIdx != null && editingTrade && (
        <TradeFormFull
          key={`edit-${editIdx}`}
          initial={{
            trade:     editingTrade,
            rationale: activeRationaleForSymbol(editingTrade.symbol),
          }}
          onSave={(t, a) => onEditSubmit(editIdx, t, a)}
          onCancel={() => setEditIdx(null)}
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
          <span key={c.label || 'actions'} style={align(c.align)}>{c.label}</span>
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
        {rows.map((t, i) => {
          const rat = t.side === 'BUY' ? activeRationaleForSymbol(t.symbol) : null;
          const triggerCount = rat ? rat.triggers.length : 0;
          const isEditing = editIdx === i;
          return (
            <div
              key={`${t.date}-${t.symbol}-${i}`}
              className="dense-row dense-row-hover"
              role="button"
              tabIndex={0}
              onClick={() => setEditIdx(isEditing ? null : i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setEditIdx(isEditing ? null : i);
                }
              }}
              style={{
                gridTemplateColumns: GRID_TEMPLATE,
                cursor: 'pointer',
                background: isEditing ? 'var(--panel-2)' : undefined,
              }}
              aria-label={`Edit trade ${t.symbol} ${t.date}`}
              aria-expanded={isEditing}
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
              <span
                style={{
                  ...align('center'),
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
                  onClick={(e) => { e.stopPropagation(); setEditIdx(isEditing ? null : i); }}
                  disabled={busy}
                  aria-label="Edit trade"
                  title="Edit trade"
                  style={{
                    background: 'transparent', border: 0,
                    color: 'var(--fg-4)', cursor: 'pointer',
                    padding: 0, fontFamily: 'var(--font-mono)', fontSize: 12,
                  }}
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onDelete(i, `${t.date} ${t.side} ${t.quantity} ${t.symbol}`);
                  }}
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
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
