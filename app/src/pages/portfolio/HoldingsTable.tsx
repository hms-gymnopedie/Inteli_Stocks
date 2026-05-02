import { useMemo, useState, type CSSProperties } from 'react';

import {
  addHolding,
  deleteHolding,
  getHoldings,
} from '../../data/portfolio';
import type { Holding } from '../../data/types';
import { Spark } from '../../lib/primitives';
import { useAsync } from '../../lib/useAsync';

type SortKey = 'symbol' | 'name' | 'weight' | 'price' | 'dayPct' | 'plPct' | 'risk';
type SortDir = 'asc' | 'desc';

interface SortState {
  key: SortKey;
  dir: SortDir;
}

const COLUMNS: { key: SortKey | null; label: string }[] = [
  { key: 'symbol', label: 'TICKER' },
  { key: 'name',   label: 'NAME' },
  { key: 'weight', label: 'WEIGHT' },
  { key: 'price',  label: 'PRICE' },
  { key: 'dayPct', label: 'DAY %' },
  { key: 'plPct',  label: 'P/L %' },
  { key: null,     label: '30D TREND' },
  { key: 'risk',   label: 'RISK' },
  { key: null,     label: '' },
];

const GRID_TEMPLATE = '90px 1fr 70px 70px 80px 70px 90px 50px 28px';

/**
 * Strip a leading currency glyph + commas and convert the typographic minus
 * (U+2212) used in the prototype back into an ASCII `-` so the value parses
 * as a number for sort comparison.
 */
function parseNumeric(s: string): number {
  const cleaned = s
    .replace(/[$₩€¥£]/g, '')
    .replace(/,/g, '')
    .replace(/−/g, '-')
    .replace(/[%+]/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function compare(a: Holding, b: Holding, key: SortKey): number {
  switch (key) {
    case 'symbol':
    case 'name':
      return a[key].localeCompare(b[key]);
    case 'risk':
      return a.risk - b.risk;
    case 'weight':
    case 'price':
    case 'dayPct':
    case 'plPct':
      return parseNumeric(a[key]) - parseNumeric(b[key]);
    default:
      return 0;
  }
}

const SKELETON_ROWS = 8;

export function HoldingsTable() {
  const [sort, setSort] = useState<SortState>({ key: 'weight', dir: 'desc' });
  const [filter, setFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const { data, loading } = useAsync(() => getHoldings(), [refreshNonce]);

  async function onDelete(symbol: string) {
    if (!window.confirm(`Remove holding ${symbol}?`)) return;
    setBusy(true); setErr(null);
    try {
      await deleteHolding(symbol);
      setRefreshNonce((n) => n + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function onCreate(h: Holding) {
    setBusy(true); setErr(null);
    try {
      await addHolding(h);
      setShowAdd(false);
      setRefreshNonce((n) => n + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  const filteredSorted = useMemo<Holding[]>(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? data.filter(
          (h) =>
            h.symbol.toLowerCase().includes(q) ||
            h.name.toLowerCase().includes(q),
        )
      : data;
    const sorted = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === 'asc' ? sorted : sorted.reverse();
  }, [data, filter, sort]);

  const handleSort = (key: SortKey | null) => {
    if (!key) return;
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'symbol' || key === 'name' ? 'asc' : 'desc' },
    );
  };

  const headerCellStyle = (key: SortKey | null): CSSProperties => ({
    cursor: key ? 'pointer' : 'default',
    userSelect: 'none',
    color: key && sort.key === key ? 'var(--fg)' : undefined,
  });

  const rowsToRender = data ? filteredSorted : Array.from({ length: SKELETON_ROWS });
  const dimmed = loading && !data ? { opacity: 0.4 } : undefined;
  const positionCount = data?.length ?? 0;

  return (
    <div className="wf-panel" style={{ padding: 0 }}>
      <div className="row between" style={{ padding: 12, gap: 12 }}>
        <div className="wf-label">
          Holdings · {data ? `${positionCount} positions` : '— positions'}
        </div>
        <div className="row gap-2" style={{ alignItems: 'center' }}>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter ticker or name…"
            aria-label="Filter holdings"
            style={{
              background: 'var(--panel-2)',
              border: '1px solid var(--hairline)',
              borderRadius: 4,
              padding: '4px 8px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fg)',
              outline: 'none',
              width: 180,
            }}
          />
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            disabled={busy}
            className="tag"
            style={{ background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            + ADD
          </button>
          <span className="tag">EXPORT</span>
        </div>
      </div>
      {err && (
        <div className="wf-mini" style={{ color: 'var(--down)', padding: '0 12px 6px' }}>
          {err}
        </div>
      )}
      {showAdd && (
        <HoldingForm
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
        {COLUMNS.map((c) => {
          const active = c.key && sort.key === c.key;
          const arrow = active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';
          return (
            <span
              key={c.label}
              role={c.key ? 'button' : undefined}
              tabIndex={c.key ? 0 : -1}
              aria-sort={
                active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
              }
              style={headerCellStyle(c.key)}
              onClick={() => handleSort(c.key)}
              onKeyDown={(e) => {
                if (c.key && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handleSort(c.key);
                }
              }}
            >
              {c.label}
              {arrow}
            </span>
          );
        })}
      </div>
      <div style={dimmed} aria-busy={loading}>
        {data && filteredSorted.length === 0 && (
          <div
            className="dense-row"
            style={{
              gridTemplateColumns: '1fr',
              color: 'var(--fg-3)',
              fontStyle: 'italic',
            }}
          >
            <span>No holdings match “{filter}”.</span>
          </div>
        )}
        {data
          ? filteredSorted.map((r) => (
              <div
                key={r.symbol}
                className="dense-row"
                style={{ gridTemplateColumns: GRID_TEMPLATE }}
              >
                <span className="ticker">{r.symbol}</span>
                <span
                  className="muted"
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.name}
                </span>
                <span>{r.weight}</span>
                <span style={{ color: 'var(--fg)' }}>{r.price}</span>
                <span
                  style={{
                    color: r.dayPct.startsWith('+')
                      ? 'var(--up)'
                      : 'var(--down)',
                  }}
                >
                  {r.dayPct}%
                </span>
                <span
                  style={{
                    color: r.plPct.startsWith('−')
                      ? 'var(--down)'
                      : 'var(--up)',
                  }}
                >
                  {r.plPct}
                </span>
                <Spark seed={r.sparkSeed} trend={0.4} />
                <span className="tag" style={{ textAlign: 'center' }}>
                  {r.risk}/5
                </span>
                <button
                  type="button"
                  onClick={() => void onDelete(r.symbol)}
                  disabled={busy}
                  aria-label={`Remove ${r.symbol}`}
                  title={`Remove ${r.symbol}`}
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
                <span className="ticker">———</span>
                <span className="muted">———————</span>
                <span>—%</span>
                <span>—</span>
                <span>—</span>
                <span>—</span>
                <Spark seed={70 + i} trend={0} color="var(--fg-4)" />
                <span className="tag" style={{ textAlign: 'center' }}>
                  —/5
                </span>
                <span />
              </div>
            ))}
      </div>
    </div>
  );
}

// ─── Add-holding inline form ────────────────────────────────────────────────

function HoldingForm({
  onSubmit, onCancel, busy,
}: { onSubmit: (h: Holding) => void; onCancel: () => void; busy: boolean }) {
  const [symbol, setSymbol] = useState('');
  const [name,   setName]   = useState('');
  const [weight, setWeight] = useState('0%');
  const [price,  setPrice]  = useState('$0');
  const [dayPct, setDayPct] = useState('+0.00');
  const [plPct,  setPlPct]  = useState('+0%');
  const [risk,   setRisk]   = useState(2);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      symbol: symbol.trim().toUpperCase(),
      name:   name.trim(),
      weight, price, dayPct, plPct,
      sparkSeed: Math.floor(Math.random() * 1000),
      risk,
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
      <input style={cell} value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="NVDA"   required />
      <input style={cell} value={name}   onChange={(e) => setName(e.target.value)}   placeholder="NVIDIA Corp" required />
      <input style={cell} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="12.4%" />
      <input style={cell} value={price}  onChange={(e) => setPrice(e.target.value)}  placeholder="$924" />
      <input style={cell} value={dayPct} onChange={(e) => setDayPct(e.target.value)} placeholder="+3.17" />
      <input style={cell} value={plPct}  onChange={(e) => setPlPct(e.target.value)}  placeholder="+184%" />
      <span className="wf-mini muted">— spark</span>
      <input
        style={cell}
        type="number" min={1} max={5} step={1}
        value={risk}
        onChange={(e) => setRisk(Number(e.target.value))}
      />
      <div className="row gap-1">
        <button type="submit" className="tag" style={{ background: 'var(--orange)', color: '#000', border: 0, cursor: 'pointer' }} disabled={busy}>OK</button>
        <button type="button" className="tag" style={{ background: 'transparent', cursor: 'pointer' }} onClick={onCancel}>×</button>
      </div>
    </form>
  );
}
