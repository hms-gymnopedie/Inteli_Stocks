/**
 * NewStrategyForm — inline panel for submitting a new backtest.
 *
 * Allocations are entered as free-form text (one allocation per line OR
 * comma-separated, both `SYMBOL:weight` and `SYMBOL weight` accepted).
 * The running weight sum is shown live with a warning when not ≈1.0.
 *
 * Submission is async — the parent provides the runBacktest call so this
 * component stays unaware of the API surface (easier to test).
 */

import { useMemo, useState } from 'react';
import type { Allocation, BacktestRequest, Strategy } from '../../data/strategies';

interface Props {
  /** Called with the form payload when the user clicks Run. */
  onSubmit: (req: BacktestRequest) => Promise<Strategy>;
  /** Closes the form (parent toggles visibility). */
  onClose:  () => void;
}

interface ParsedLine {
  symbol: string;
  weight: number;
}

/** Parse free-form allocation text → list of {symbol, weight}. */
function parseAllocations(raw: string): { rows: ParsedLine[]; error: string | null } {
  const tokens = raw
    .split(/[\n,]+/g)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    return { rows: [], error: 'enter at least one allocation' };
  }
  const rows: ParsedLine[] = [];
  for (const t of tokens) {
    // Accept "SYMBOL:weight" or "SYMBOL weight" (single space).
    const m = t.match(/^([A-Za-z0-9.\-^=]+)\s*[:\s]\s*([0-9]*\.?[0-9]+)$/);
    if (!m) {
      return { rows: [], error: `couldn't parse "${t}" — expected SYMBOL:weight` };
    }
    const symbol = m[1].toUpperCase();
    const weight = Number(m[2]);
    if (!Number.isFinite(weight) || weight <= 0) {
      return { rows: [], error: `weight for ${symbol} must be a positive number` };
    }
    rows.push({ symbol, weight });
  }
  // Reject duplicate symbols (server would too, but fail fast in the UI).
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.symbol)) return { rows: [], error: `duplicate symbol: ${r.symbol}` };
    seen.add(r.symbol);
  }
  return { rows, error: null };
}

/** Default end date = today; default start = 1 year ago. */
function defaultStartDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

const PRESET = 'AAPL:0.4, MSFT:0.3, NVDA:0.3';

export function NewStrategyForm({ onSubmit, onClose }: Props) {
  const [name,        setName]        = useState('');
  const [allocText,   setAllocText]   = useState(PRESET);
  const [startDate,   setStartDate]   = useState(defaultStartDate());
  const [endDate,     setEndDate]     = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const parsed = useMemo(() => parseAllocations(allocText), [allocText]);
  const sum = parsed.rows.reduce((a, r) => a + r.weight, 0);
  const sumOk = parsed.rows.length > 0 && Math.abs(sum - 1) <= 0.01;

  const canSubmit =
    !submitting &&
    name.trim().length > 0 &&
    parsed.error === null &&
    sumOk &&
    startDate.length === 10;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const req: BacktestRequest = {
        name:        name.trim(),
        allocations: parsed.rows as Allocation[],
        startDate,
        endDate:     endDate || undefined,
      };
      await onSubmit(req);
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

        <label className="lb-form-field lb-form-field--wide">
          <span className="wf-label">
            Allocations <span className="muted">— one per line or comma-separated, e.g. AAPL:0.4, MSFT:0.3, NVDA:0.3</span>
          </span>
          <textarea
            className="lb-textarea"
            value={allocText}
            onChange={(e) => setAllocText(e.target.value)}
            rows={4}
            spellCheck={false}
            aria-required
          />
          <div className="lb-form-sumrow">
            {parsed.error ? (
              <span className="lb-form-warn">{parsed.error}</span>
            ) : (
              <>
                <span className="wf-mini">{parsed.rows.length} symbol{parsed.rows.length === 1 ? '' : 's'}</span>
                <span className={'wf-mono ' + (sumOk ? 'up' : 'lb-form-warn')}>
                  Σ = {sum.toFixed(3)}
                  {sumOk ? '' : ' — must be ≈ 1.000'}
                </span>
              </>
            )}
          </div>
        </label>

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
