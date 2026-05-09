/**
 * Full add/edit trade form for the Trades Log — B29.
 *
 * Differs from the legacy inline TradeForm:
 *   · supports prefilling for edit mode (initial trade + rationale)
 *   · for BUY trades, exposes the same trigger UI as /positions:
 *     reason + sell-by-date / pct-from-entry / abs-above / abs-below /
 *     trailing-from-peak. Up to one rationale per symbol; saving the form
 *     creates / updates / deletes that rationale alongside the trade.
 *
 * Auto-portfolio: server creates a holding for new BUY symbols on its own,
 * so this component only deals with trade + trigger persistence.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { type PositionRationale, type SellTrigger } from '../../data/positions';
import { getSearch } from '../../data/market';
import { getProfile } from '../../data/security';
import type { SearchResult, Trade } from '../../data/types';

export interface TradeFormFullProps {
  /** When provided, the form runs in edit mode. */
  initial?: {
    trade:     Trade;
    rationale: PositionRationale | null;
  };
  /** Persist trade + (when BUY) any sell triggers. Returns nothing on success. */
  onSave: (
    trade: Trade,
    rationaleAction:
      | { kind: 'none' }
      | { kind: 'create'; reason: string; triggers: SellTrigger[] }
      | { kind: 'update'; id: string; reason: string; triggers: SellTrigger[] }
      | { kind: 'delete'; id: string },
  ) => Promise<void>;
  onCancel: () => void;
}

export function TradeFormFull({ initial, onSave, onCancel }: TradeFormFullProps) {
  const isEdit = initial != null;
  const today  = new Date().toISOString().slice(0, 10);

  const [symbol,     setSymbol]     = useState(initial?.trade.symbol ?? '');
  const [symbolName, setSymbolName] = useState('');
  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState<SearchResult[]>([]);
  const [showRes,    setShowRes]    = useState(false);
  const [searching,  setSearching]  = useState(false);

  const [date,       setDate]       = useState(initial?.trade.date    ?? today);
  const [side,       setSide]       = useState<'BUY' | 'SELL'>(initial?.trade.side ?? 'BUY');
  const [qty,        setQty]        = useState(String(initial?.trade.quantity ?? '1'));
  const [px,         setPx]         = useState(String(initial?.trade.price    ?? ''));
  const [currency,   setCurrency]   = useState(initial?.trade.currency ?? 'USD');

  // Pre-extract any existing triggers from the rationale so the user can edit them.
  const initialT = useMemo(() => extractTriggers(initial?.rationale), [initial?.rationale]);
  const [reason,     setReason]     = useState(initial?.rationale?.reason ?? '');
  const [sellByDate, setSellByDate] = useState(initialT.sellByDate);
  const [absAbove,   setAbsAbove]   = useState(initialT.absAbove);
  const [absBelow,   setAbsBelow]   = useState(initialT.absBelow);
  const [pctBase,    setPctBase]    = useState(initialT.pctBase);
  const [trailing,   setTrailing]   = useState(initialT.trailing);

  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Debounced ticker search (only when not yet locked in).
  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      void getSearch(q)
        .then((r) => { if (!cancelled) { setResults(r.slice(0, 8)); setShowRes(true); } })
        .catch(() => { /* silent */ })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  useEffect(() => {
    if (!showRes) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setShowRes(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showRes]);

  function pickSymbol(m: SearchResult): void {
    setSymbol(m.symbol);
    setSymbolName(m.name);
    setQuery('');
    setResults([]);
    setShowRes(false);
    void getProfile(m.symbol).then((p) => {
      if (p?.price && !px) setPx(String(p.price));
      if (p?.currency)     setCurrency(p.currency);
    }).catch(() => { /* silent */ });
  }

  function clearSymbol(): void {
    if (isEdit) return; // editing keeps the symbol locked
    setSymbol(''); setSymbolName(''); setPx('');
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!symbol) { setError('pick a ticker'); return; }
    setBusy(true); setError(null);
    try {
      const tradePrice = Number(px) || 0;
      const trade: Trade = {
        date,
        symbol:   symbol.toUpperCase(),
        side,
        quantity: Number(qty)  || 0,
        price:    tradePrice,
        currency,
      };

      // Build the trigger array from the form fields.
      const triggers: SellTrigger[] = [];
      if (sellByDate.length === 10) triggers.push({ type: 'date', date: sellByDate });
      if (absAbove && Number(absAbove) > 0) triggers.push({ type: 'absoluteAbove', price: Number(absAbove) });
      if (absBelow && Number(absBelow) > 0) triggers.push({ type: 'absoluteBelow', price: Number(absBelow) });
      if (pctBase && Number.isFinite(Number(pctBase))) {
        triggers.push({ type: 'pctFromBase', basePrice: tradePrice || 1, pct: Number(pctBase) });
      }
      if (trailing && Number(trailing) < 0) {
        triggers.push({ type: 'trailingFromPeak', pct: Number(trailing), peakPrice: tradePrice || 1 });
      }

      const isBuy = side === 'BUY';
      const hasReason   = reason.trim().length > 0;
      const hasTriggers = triggers.length > 0;
      const existingId  = initial?.rationale?.id ?? null;

      // Decide rationale action — create / update / delete / none.
      type RatAction = Parameters<typeof onSave>[1];
      let action: RatAction = { kind: 'none' };

      if (isBuy && hasTriggers && hasReason) {
        if (existingId) {
          action = { kind: 'update', id: existingId, reason: reason.trim(), triggers };
        } else {
          action = { kind: 'create', reason: reason.trim(), triggers };
        }
      } else if (isBuy && existingId && (!hasTriggers || !hasReason)) {
        // User cleared all triggers / reason — drop the rationale.
        action = { kind: 'delete', id: existingId };
      } else if (!isBuy && existingId) {
        // Editing the trade to a SELL means triggers no longer apply.
        action = { kind: 'delete', id: existingId };
      }

      // Server-side validation hint: BUY + reason + no triggers is not allowed
      // (positions endpoint requires ≥1 trigger). Surface a friendly message.
      if ((action.kind === 'create' || action.kind === 'update') && action.triggers.length === 0) {
        setError('Add at least one sell trigger (or clear the reason to skip).');
        setBusy(false);
        return;
      }
      if (isBuy && hasTriggers && !hasReason) {
        setError('Add a one-line reason (why you bought) to enable triggers.');
        setBusy(false);
        return;
      }

      await onSave(trade, action);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  const cell: React.CSSProperties = {
    background: 'var(--panel-2)',
    border: '1px solid var(--hairline)',
    borderRadius: 4,
    padding: '6px 8px',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--fg)',
    outline: 'none',
    minWidth: 0,
  };

  const isBuy = side === 'BUY';

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="wf-panel"
      style={{
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        borderTop: '1px solid var(--hairline)',
        borderBottom: '1px solid var(--hairline)',
        background: 'var(--panel-2)',
      }}
    >
      <div className="row between center">
        <div className="wf-label">{isEdit ? `Edit trade · ${initial?.trade.symbol}` : '+ New Trade'}</div>
        <button type="button" className="settings-btn-link" onClick={onCancel}>✕ cancel</button>
      </div>

      <div ref={wrapRef} style={{ position: 'relative' }}>
        {symbol ? (
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', background: 'var(--panel-2)',
              border: '1px solid var(--orange)', borderRadius: 4,
              fontFamily: 'var(--font-mono)', fontSize: 12,
            }}
          >
            <span className="ticker">{symbol}</span>
            {symbolName && <span className="muted">{symbolName}</span>}
            {!isEdit && (
              <button
                type="button"
                onClick={clearSymbol}
                className="settings-btn-link"
                style={{ padding: 0 }}
                aria-label="Change symbol"
                title="Change symbol"
              >
                ✕
              </button>
            )}
          </div>
        ) : (
          <>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query && setShowRes(true)}
              placeholder="Search ticker or company name…"
              autoComplete="off"
              spellCheck={false}
              style={{ ...cell, width: '100%' }}
              aria-label="Symbol search"
            />
            {showRes && results.length > 0 && (
              <ul className="lb-alloc-results" role="listbox" style={{ left: 0, right: 0 }}>
                {results.map((m) => (
                  <li key={m.symbol}>
                    <button
                      type="button"
                      className="lb-alloc-result"
                      onMouseDown={(e) => { e.preventDefault(); pickSymbol(m); }}
                    >
                      <span className="ticker">{m.symbol}</span>
                      <span className="lb-alloc-name">{m.name}</span>
                      <span className="muted lb-alloc-exch">{m.exchange}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {showRes && !searching && query.trim() && results.length === 0 && (
              <ul className="lb-alloc-results"><li className="lb-alloc-empty">no matches</li></ul>
            )}
          </>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '120px 80px 90px 110px 70px',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <input  style={cell} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <select style={cell}             value={side} onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}>
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
        <input  style={cell} type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="qty"   required />
        <input  style={cell} type="number" min="0" step="any" value={px}  onChange={(e) => setPx(e.target.value)}  placeholder="price" required />
        <select style={cell}              value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <option>USD</option><option>KRW</option><option>EUR</option><option>JPY</option><option>GBP</option><option>HKD</option>
        </select>
      </div>

      {isBuy && (
        <>
          <textarea
            style={{ ...cell, minHeight: 56, resize: 'vertical' }}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="(optional) Why are you buying? — required only if you set sell triggers below"
          />
          <div className="wf-mini muted-2" style={{ letterSpacing: '0.04em' }}>
            SELL TRIGGERS · all optional · any one fires Slack alert
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="wf-mini muted">Sell-by date</span>
              <input style={cell} type="date" value={sellByDate} onChange={(e) => setSellByDate(e.target.value)} />
              <PresetChips presets={dateOffsetPresets()} onPick={setSellByDate} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="wf-mini muted">% from entry (positive = profit, negative = stop-loss)</span>
              <input style={cell} type="number" step="any" value={pctBase} onChange={(e) => setPctBase(e.target.value)} placeholder="±%" />
              <PresetChips
                presets={[
                  { label: '+10%', value: '10' },
                  { label: '+20%', value: '20' },
                  { label: '+30%', value: '30' },
                  { label: '−5%',  value: '-5'  },
                  { label: '−10%', value: '-10' },
                  { label: '−15%', value: '-15' },
                ]}
                onPick={setPctBase}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="wf-mini muted">Absolute price ≥</span>
              <input style={cell} type="number" min="0" step="any" value={absAbove} onChange={(e) => setAbsAbove(e.target.value)} placeholder={`above ${px || 'price'}`} />
              <PresetChips presets={pricePresets(px, [+5, +10, +20, +30])} onPick={setAbsAbove} disabled={!px} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="wf-mini muted">Absolute price ≤</span>
              <input style={cell} type="number" min="0" step="any" value={absBelow} onChange={(e) => setAbsBelow(e.target.value)} placeholder={`below ${px || 'price'}`} />
              <PresetChips presets={pricePresets(px, [-5, -10, -15, -20])} onPick={setAbsBelow} disabled={!px} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
              <span className="wf-mini muted">Trailing stop − % from peak</span>
              <input style={cell} type="number" step="any" value={trailing} onChange={(e) => setTrailing(e.target.value)} placeholder="−%" />
              <PresetChips
                presets={[
                  { label: '−5%',  value: '-5'  },
                  { label: '−10%', value: '-10' },
                  { label: '−15%', value: '-15' },
                  { label: '−20%', value: '-20' },
                ]}
                onPick={setTrailing}
              />
            </label>
          </div>
        </>
      )}

      {error && <div className="lb-form-error" role="alert">{error}</div>}

      <div className="row gap-2 center">
        <button type="submit" className="lb-btn lb-btn-primary" disabled={busy || !symbol}>
          {busy ? (isEdit ? 'Saving…' : 'Logging…') : (isEdit ? 'Save changes' : `Log ${side}`)}
        </button>
        <button type="button" className="lb-btn lb-btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

interface ExtractedTriggers {
  sellByDate: string;
  absAbove:   string;
  absBelow:   string;
  pctBase:    string;
  trailing:   string;
}

function extractTriggers(r: PositionRationale | null | undefined): ExtractedTriggers {
  const out: ExtractedTriggers = { sellByDate: '', absAbove: '', absBelow: '', pctBase: '', trailing: '' };
  if (!r) return out;
  for (const t of r.triggers) {
    switch (t.type) {
      case 'date':              out.sellByDate = t.date; break;
      case 'absoluteAbove':     out.absAbove   = String(t.price); break;
      case 'absoluteBelow':     out.absBelow   = String(t.price); break;
      case 'pctFromBase':       out.pctBase    = String(t.pct); break;
      case 'trailingFromPeak':  out.trailing   = String(t.pct); break;
    }
  }
  return out;
}

interface Preset { label: string; value: string }

function PresetChips({
  presets, onPick, disabled,
}: { presets: Preset[]; onPick: (v: string) => void; disabled?: boolean }) {
  if (presets.length === 0) return null;
  return (
    <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
      {presets.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => onPick(p.value)}
          disabled={disabled}
          className="trigger-preset-chip"
          title={`Fill with ${p.value}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function pricePresets(basePriceStr: string, pcts: number[]): Preset[] {
  const base = Number(basePriceStr);
  if (!Number.isFinite(base) || base <= 0) return [];
  return pcts.map((pct) => {
    const target = base * (1 + pct / 100);
    const value = target >= 1000 ? String(Math.round(target)) : target.toFixed(2);
    const sign = pct >= 0 ? '+' : '−';
    return { label: `${sign}${Math.abs(pct)}%`, value };
  });
}

function dateOffsetPresets(): Preset[] {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const offsets: { label: string; days?: number; months?: number; years?: number }[] = [
    { label: '+1m', months: 1 },
    { label: '+3m', months: 3 },
    { label: '+6m', months: 6 },
    { label: '+1y', years:  1 },
  ];
  return offsets.map((o) => {
    const d = new Date(today);
    if (o.days)   d.setDate(d.getDate() + o.days);
    if (o.months) d.setMonth(d.getMonth() + o.months);
    if (o.years)  d.setFullYear(d.getFullYear() + o.years);
    return { label: o.label, value: fmt(d) };
  });
}

