/**
 * Full new-trade form for the standalone /positions page (B19).
 *
 * Differs from the Detail-page TradeChip by including ticker search up
 * front (the page isn't scoped to a single symbol). For BUY trades the
 * rationale + sell triggers section is required; SELL trades collapse
 * to just the core fields.
 */

import { useEffect, useRef, useState } from 'react';

import { addTrade } from '../../data/portfolio';
import { addPosition, type SellTrigger } from '../../data/positions';
import { getSearch } from '../../data/market';
import { getProfile } from '../../data/security';
import type { SearchResult, Trade } from '../../data/types';

interface Props {
  onSubmitted: (note: string) => void;
  onCancel:    () => void;
}

export function NewTradeForm({ onSubmitted, onCancel }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const [symbol,    setSymbol]    = useState('');
  const [symbolName,setSymbolName]= useState('');
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState<SearchResult[]>([]);
  const [showRes,   setShowRes]   = useState(false);
  const [searching, setSearching] = useState(false);

  const [date,      setDate]      = useState(today);
  const [side,      setSide]      = useState<'BUY' | 'SELL'>('BUY');
  const [qty,       setQty]       = useState('1');
  const [px,        setPx]        = useState('');
  const [currency,  setCurrency]  = useState('USD');

  const [reason,     setReason]     = useState('');
  const [sellByDate, setSellByDate] = useState('');
  const [absAbove,   setAbsAbove]   = useState('');
  const [absBelow,   setAbsBelow]   = useState('');
  const [pctBase,    setPctBase]    = useState('');
  const [trailing,   setTrailing]   = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Debounced search.
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

  // Close dropdown on outside click.
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
    // Auto-fill price + currency from quote.
    void getProfile(m.symbol).then((p) => {
      if (p?.price && !px) setPx(String(p.price));
      if (p?.currency)     setCurrency(p.currency);
    }).catch(() => { /* silent */ });
  }

  function clearSymbol(): void {
    setSymbol(''); setSymbolName(''); setPx('');
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!symbol) { setError('pick a ticker'); return; }
    if (side === 'BUY' && !reason.trim()) { setError('reason required for BUY'); return; }
    setBusy(true); setError(null);
    try {
      const trade: Trade = {
        date, symbol, side,
        quantity: Number(qty) || 0,
        price:    Number(px) || 0,
        currency,
      };
      await addTrade(trade);

      if (side === 'BUY') {
        const triggers: SellTrigger[] = [];
        if (sellByDate.length === 10) triggers.push({ type: 'date', date: sellByDate });
        if (absAbove && Number(absAbove) > 0) triggers.push({ type: 'absoluteAbove', price: Number(absAbove) });
        if (absBelow && Number(absBelow) > 0) triggers.push({ type: 'absoluteBelow', price: Number(absBelow) });
        if (pctBase && Number.isFinite(Number(pctBase))) {
          triggers.push({ type: 'pctFromBase', basePrice: trade.price, pct: Number(pctBase) });
        }
        if (trailing && Number(trailing) < 0) {
          triggers.push({ type: 'trailingFromPeak', pct: Number(trailing), peakPrice: trade.price });
        }
        await addPosition({
          symbol, reason: reason.trim(), entryPrice: trade.price, triggers,
        });
        onSubmitted(`Logged BUY ${qty} ${symbol} + ${triggers.length} sell trigger${triggers.length === 1 ? '' : 's'} registered.`);
      } else {
        onSubmitted(`Logged SELL ${qty} ${symbol}.`);
      }
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
      style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div className="row between center">
        <div className="wf-label">+ New Trade</div>
        <button type="button" className="settings-btn-link" onClick={onCancel}>✕ cancel</button>
      </div>

      {/* Ticker search / locked symbol */}
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
            <span className="muted">{symbolName}</span>
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

      {/* Trade core fields */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '120px 80px 90px 110px 70px',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <input  style={cell} type="date"   value={date} onChange={(e) => setDate(e.target.value)} required />
        <select style={cell}                value={side} onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}>
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
        <input  style={cell} type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="qty" required />
        <input  style={cell} type="number" min="0" step="any" value={px}  onChange={(e) => setPx(e.target.value)}  placeholder="price"  required />
        <select style={cell}                value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <option>USD</option><option>KRW</option><option>EUR</option><option>JPY</option><option>GBP</option><option>HKD</option>
        </select>
      </div>

      {/* BUY-only rationale + triggers */}
      {isBuy && (
        <>
          <textarea
            style={{ ...cell, minHeight: 64, resize: 'vertical' }}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you buying? (required) — e.g. 'FY26 capex unchanged + bottoming after correction'"
            required
          />
          <div className="wf-mini muted-2" style={{ letterSpacing: '0.04em' }}>
            SELL TRIGGERS · all optional · any one fires Slack alert
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="wf-mini muted">Sell-by date</span>
              <input style={cell} type="date" value={sellByDate} onChange={(e) => setSellByDate(e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="wf-mini muted">% from entry (e.g. 20 = +20% target / −10 = stop)</span>
              <input style={cell} type="number" step="any" value={pctBase} onChange={(e) => setPctBase(e.target.value)} placeholder="±%" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="wf-mini muted">Absolute price ≥</span>
              <input style={cell} type="number" min="0" step="any" value={absAbove} onChange={(e) => setAbsAbove(e.target.value)} placeholder={`above ${px || 'price'}`} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="wf-mini muted">Absolute price ≤</span>
              <input style={cell} type="number" min="0" step="any" value={absBelow} onChange={(e) => setAbsBelow(e.target.value)} placeholder={`below ${px || 'price'}`} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2, gridColumn: '1 / -1' }}>
              <span className="wf-mini muted">Trailing stop − % from peak (negative number, e.g. −10)</span>
              <input style={cell} type="number" step="any" value={trailing} onChange={(e) => setTrailing(e.target.value)} placeholder="−%" />
            </label>
          </div>
        </>
      )}

      {error && <div className="lb-form-error" role="alert">{error}</div>}

      <div className="row gap-2 center">
        <button type="submit" className="lb-btn lb-btn-primary" disabled={busy || !symbol}>
          {busy ? 'Logging…' : `Log ${side}`}
        </button>
        <button type="button" className="lb-btn lb-btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
