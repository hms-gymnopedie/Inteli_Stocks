/**
 * NewStrategyForm — row-based allocation builder. (B11-6)
 *
 * Each allocation is one row: a ticker search input (autocomplete from
 * /api/market/search) + a weight slider/number. Click a search match to
 * lock in the symbol; "+ Add" adds another row; "× Remove" drops one.
 * "Normalize" button rescales weights so they sum to exactly 1.
 *
 * Submission is async — the parent provides the runBacktest call so this
 * component stays unaware of the API surface.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { getSearch } from '../../data/market';
import type { SearchResult } from '../../data/types';
import type { Allocation, BacktestRequest, Strategy } from '../../data/strategies';

interface Props {
  onSubmit: (req: BacktestRequest) => Promise<Strategy>;
  onClose:  () => void;
}

interface Row {
  /** Stable React key. */
  key:    string;
  /** Locked-in ticker, or empty string while user is searching. */
  symbol: string;
  /** Human-readable name from the search match (display only). */
  name:   string;
  /** Free-text query while searching; cleared when a match is locked. */
  query:  string;
  /** Allocation weight in [0, 1]. */
  weight: number;
}

let _kctr = 0;
const newKey = () => `r${++_kctr}`;

const PRESET: Row[] = [
  { key: newKey(), symbol: 'AAPL', name: 'Apple Inc.',         query: '', weight: 0.4 },
  { key: newKey(), symbol: 'MSFT', name: 'Microsoft Corp.',    query: '', weight: 0.3 },
  { key: newKey(), symbol: 'NVDA', name: 'NVIDIA Corp.',       query: '', weight: 0.3 },
];

function defaultStartDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export function NewStrategyForm({ onSubmit, onClose }: Props) {
  const [name,        setName]        = useState('');
  const [rows,        setRows]        = useState<Row[]>(PRESET);
  const [startDate,   setStartDate]   = useState(defaultStartDate());
  const [endDate,     setEndDate]     = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const sum = useMemo(() => rows.reduce((acc, r) => acc + (r.weight || 0), 0), [rows]);
  const allReady = rows.every((r) => r.symbol.trim().length > 0 && r.weight > 0);
  const sumOk = rows.length > 0 && Math.abs(sum - 1) <= 0.01;
  const dupSymbols = useMemo(() => {
    const seen = new Set<string>();
    const dups: string[] = [];
    for (const r of rows) {
      if (!r.symbol) continue;
      if (seen.has(r.symbol.toUpperCase())) dups.push(r.symbol);
      seen.add(r.symbol.toUpperCase());
    }
    return dups;
  }, [rows]);

  const canSubmit =
    !submitting &&
    name.trim().length > 0 &&
    allReady &&
    sumOk &&
    dupSymbols.length === 0 &&
    startDate.length === 10;

  function patchRow(key: string, patch: Partial<Row>): void {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow(): void {
    setRows((rs) => [...rs, { key: newKey(), symbol: '', name: '', query: '', weight: 0 }]);
  }

  function removeRow(key: string): void {
    setRows((rs) => rs.filter((r) => r.key !== key));
  }

  function normalize(): void {
    const s = rows.reduce((acc, r) => acc + (r.weight || 0), 0);
    if (s <= 0) return;
    setRows((rs) => rs.map((r) => ({
      ...r,
      weight: Number(((r.weight / s)).toFixed(4)),
    })));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const allocations: Allocation[] = rows.map((r) => ({
        symbol: r.symbol.trim().toUpperCase(),
        weight: r.weight,
      }));
      await onSubmit({
        name:        name.trim(),
        allocations,
        startDate,
        endDate:     endDate || undefined,
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="lb-form wf-panel" onSubmit={handleSubmit} aria-label="New strategy">
      <div className="lb-form-header">
        <h2 className="lb-form-title">New Strategy</h2>
        <button
          type="button"
          className="lb-form-close"
          aria-label="Close form"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="lb-form-grid">
        <label className="lb-form-field">
          <span className="wf-label">Strategy name</span>
          <input
            type="text"
            className="lb-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Big-3 Tech 40/30/30"
            required
            aria-required
          />
        </label>

        <div className="lb-form-field lb-form-field--wide">
          <span className="wf-label">
            Allocations <span className="muted">— search ticker, set weight (0–1)</span>
          </span>
          <div className="lb-alloc-rows">
            {rows.map((r) => (
              <AllocRow
                key={r.key}
                row={r}
                onChange={(patch) => patchRow(r.key, patch)}
                onRemove={() => removeRow(r.key)}
                canRemove={rows.length > 1}
              />
            ))}
          </div>
          <div className="lb-form-sumrow">
            <button type="button" className="lb-btn lb-btn-ghost" onClick={addRow}>
              + Add row
            </button>
            <button
              type="button"
              className="lb-btn lb-btn-ghost"
              onClick={normalize}
              disabled={sum <= 0 || sumOk}
              title="Rescale weights so they sum to 1.0"
            >
              Normalize
            </button>
            <span className="wf-mini">
              {rows.length} symbol{rows.length === 1 ? '' : 's'}
            </span>
            <span className={'wf-mono ' + (sumOk ? 'up' : 'lb-form-warn')}>
              Σ = {sum.toFixed(3)}{sumOk ? '' : ' — must be ≈ 1.000'}
            </span>
            {dupSymbols.length > 0 && (
              <span className="lb-form-warn">duplicate: {dupSymbols.join(', ')}</span>
            )}
          </div>
        </div>

        <label className="lb-form-field">
          <span className="wf-label">Start date</span>
          <input
            type="date"
            className="lb-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            aria-required
            max={new Date().toISOString().slice(0, 10)}
          />
        </label>

        <label className="lb-form-field">
          <span className="wf-label">End date <span className="muted">(optional)</span></span>
          <input
            type="date"
            className="lb-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            max={new Date().toISOString().slice(0, 10)}
          />
        </label>
      </div>

      {serverError && (
        <div className="lb-form-error" role="alert">
          {serverError}
        </div>
      )}

      <div className="lb-form-actions">
        <button
          type="button"
          className="lb-btn lb-btn-ghost"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="lb-btn lb-btn-primary"
          disabled={!canSubmit}
          aria-busy={submitting}
        >
          {submitting ? 'Running…' : 'Run backtest'}
        </button>
      </div>
    </form>
  );
}

// ─── One allocation row: search + weight + remove ───────────────────────────

interface AllocRowProps {
  row: Row;
  onChange: (patch: Partial<Row>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function AllocRow({ row, onChange, onRemove, canRemove }: AllocRowProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Debounced search.
  useEffect(() => {
    const q = row.query.trim();
    if (!q) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      void getSearch(q)
        .then((r) => { if (!cancelled) { setResults(r.slice(0, 8)); setShowResults(true); } })
        .catch(() => { /* swallow */ })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [row.query]);

  // Close dropdown on outside click.
  useEffect(() => {
    if (!showResults) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showResults]);

  function selectMatch(m: SearchResult): void {
    onChange({ symbol: m.symbol, name: m.name, query: '' });
    setResults([]);
    setShowResults(false);
    inputRef.current?.blur();
  }

  function clearSymbol(): void {
    onChange({ symbol: '', name: '', query: '' });
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div ref={wrapRef} className="lb-alloc-row">
      <div className="lb-alloc-search">
        {row.symbol ? (
          // Locked: show symbol + name + clear button.
          <div className="lb-alloc-locked">
            <span className="ticker">{row.symbol}</span>
            <span className="lb-alloc-name muted">{row.name}</span>
            <button
              type="button"
              onClick={clearSymbol}
              aria-label={`Change ${row.symbol}`}
              className="lb-alloc-clear"
              title="Change symbol"
            >
              ✕
            </button>
          </div>
        ) : (
          // Searching.
          <>
            <input
              ref={inputRef}
              type="text"
              className="lb-input"
              value={row.query}
              onChange={(e) => onChange({ query: e.target.value })}
              onFocus={() => row.query && setShowResults(true)}
              placeholder="Search ticker or company name…"
              autoComplete="off"
              spellCheck={false}
              aria-label="Symbol search"
            />
            {showResults && results.length > 0 && (
              <ul className="lb-alloc-results" role="listbox">
                {results.map((m) => (
                  <li key={m.symbol} role="option" aria-selected={false}>
                    <button
                      type="button"
                      className="lb-alloc-result"
                      onMouseDown={(e) => { e.preventDefault(); selectMatch(m); }}
                    >
                      <span className="ticker">{m.symbol}</span>
                      <span className="lb-alloc-name">{m.name}</span>
                      <span className="muted lb-alloc-exch">{m.exchange}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {showResults && !searching && row.query.trim() && results.length === 0 && (
              <ul className="lb-alloc-results">
                <li className="lb-alloc-empty">no matches</li>
              </ul>
            )}
          </>
        )}
      </div>

      <input
        type="number"
        className="lb-input lb-alloc-weight"
        min="0" max="1" step="0.01"
        value={row.weight}
        onChange={(e) => onChange({ weight: Number(e.target.value) })}
        placeholder="0.0"
        aria-label="Weight (0-1)"
      />

      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="lb-alloc-remove"
          aria-label="Remove row"
          title="Remove row"
        >
          ×
        </button>
      )}
    </div>
  );
}
