/**
 * /positions — buy/sell management as a first-class tab (B19).
 *
 * Layout:
 *   1. Header + "+ New Trade" button + "Check now" trigger eval
 *   2. NewTradeForm (toggleable inline panel)
 *   3. Active rationales — rich cards with current price + distance
 *   4. Recent trades table
 *   5. Closed/fired rationales
 */

import { useCallback, useEffect, useState } from 'react';

import { listPositions, type PositionRationale } from '../../data/positions';
import { NewTradeForm } from './NewTradeForm';
import { RationaleCard } from './RationaleCard';
import { RecentTrades } from './RecentTrades';

export function Positions() {
  const [items,   setItems]   = useState<PositionRationale[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy,    setBusy]    = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const list = await listPositions();
      setItems(list);
    } catch (e) {
      setMessage(`Load failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function checkNow(): Promise<void> {
    setBusy(true); setMessage(null);
    try {
      const r = await fetch('/api/positions/check', { method: 'POST' });
      const j = (await r.json()) as { fired?: number; notified?: number; total?: number };
      setMessage(`Checked ${j.total ?? 0} active positions · ${j.fired ?? 0} fired · ${j.notified ?? 0} notified.`);
      await refresh();
      setRefreshKey((n) => n + 1);
    } catch (e) {
      setMessage(`Check failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  }

  const active = (items ?? []).filter((p) => p.firedAt == null);
  const fired  = (items ?? []).filter((p) => p.firedAt != null)
                              .sort((a, b) => (b.firedAt ?? 0) - (a.firedAt ?? 0));

  return (
    <div className="settings-page">
      <header className="settings-header">
        <h1 className="settings-title">Trades & Positions</h1>
        <p className="settings-sub">
          Log buys/sells, record your thesis, and let sell triggers post a
          Slack alert when the market hits your number.
        </p>
      </header>

      <div className="row gap-2 center" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        <button
          type="button"
          className="lb-btn lb-btn-primary"
          onClick={() => setShowAdd((v) => !v)}
          aria-expanded={showAdd}
        >
          {showAdd ? '× Cancel' : '+ New Trade'}
        </button>
        <button
          type="button"
          className="lb-btn lb-btn-ghost"
          onClick={() => void checkNow()}
          disabled={busy}
          title="Re-evaluate all triggers now (cron also runs hourly during market hours)"
        >
          {busy ? 'Checking…' : '↻ Check triggers'}
        </button>
        {message && <span className="settings-msg">{message}</span>}
      </div>

      {showAdd && (
        <div style={{ marginBottom: 16 }}>
          <NewTradeForm
            onCancel={() => setShowAdd(false)}
            onSubmitted={(note) => {
              setShowAdd(false);
              setMessage(note);
              setRefreshKey((n) => n + 1);
              void refresh();
            }}
          />
        </div>
      )}

      {/* Active rationales */}
      <section className="settings-section settings-section--wide" style={{ marginBottom: 16 }}>
        <h2 className="settings-section-h">
          Active rationales · {active.length}
        </h2>
        {items === null ? (
          <div className="settings-foot">Loading…</div>
        ) : active.length === 0 ? (
          <div className="settings-foot muted">
            No active positions yet. Click <strong>+ New Trade</strong> to log a
            BUY with a reason and sell triggers.
          </div>
        ) : (
          <div className="positions-list">
            {active.map((p) => (
              <RationaleCard key={p.id} rationale={p} onChanged={() => void refresh()} />
            ))}
          </div>
        )}
      </section>

      {/* Recent trades */}
      <section className="settings-section settings-section--wide" style={{ marginBottom: 16 }}>
        <RecentTrades
          refreshKey={refreshKey}
          onRationaleChanged={() => {
            setRefreshKey((n) => n + 1);
            void refresh();
          }}
        />
      </section>

      {/* Closed / fired */}
      {fired.length > 0 && (
        <section className="settings-section settings-section--wide">
          <h2 className="settings-section-h">Closed positions · {fired.length}</h2>
          <div className="positions-list">
            {fired.map((p) => (
              <ClosedRow key={p.id} rationale={p} onChanged={() => void refresh()} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

interface ClosedRowProps { rationale: PositionRationale; onChanged: () => void }
function ClosedRow({ rationale, onChanged }: ClosedRowProps) {
  const [busy, setBusy] = useState(false);
  async function remove(): Promise<void> {
    if (!window.confirm(`Remove closed position for ${rationale.symbol}?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/positions/${encodeURIComponent(rationale.id)}`, { method: 'DELETE' });
      onChanged();
    } finally { setBusy(false); }
  }
  const t = rationale.firedTrigger;
  const desc =
    !t ? 'fired' :
    t.type === 'date' ? `by ${t.date}` :
    t.type === 'absoluteAbove'  ? `price ≥ $${t.price.toFixed(2)}` :
    t.type === 'absoluteBelow'  ? `price ≤ $${t.price.toFixed(2)}` :
    t.type === 'pctFromBase'    ? `${t.pct >= 0 ? '+' : ''}${t.pct}% from $${t.basePrice.toFixed(2)}` :
                                  `trailing ${t.pct}% from $${t.peakPrice.toFixed(2)}`;
  return (
    <div className="positions-row positions-fired">
      <div className="row between center">
        <div className="row gap-2 center">
          <span className="ticker">{rationale.symbol}</span>
          <span className="wf-mini muted">entry ${rationale.entryPrice.toFixed(2)}</span>
          <span className="wf-mini" style={{ color: 'var(--orange)' }}>✓ {desc}</span>
          <span className="wf-mini muted-2">
            {rationale.firedAt ? new Date(rationale.firedAt).toLocaleString() : ''}
          </span>
        </div>
        <button
          type="button"
          className="settings-btn-link"
          onClick={() => void remove()}
          disabled={busy}
          style={{ padding: '2px 8px', fontSize: 10 }}
        >
          remove
        </button>
      </div>
      <div className="positions-reason muted">{rationale.reason}</div>
    </div>
  );
}
