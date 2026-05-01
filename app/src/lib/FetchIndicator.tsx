/**
 * FetchIndicator — topbar widget showing live REST + SSE activity.
 *
 * Reads `useFetchStatus()` (see fetchStatus.ts).
 *
 * States:
 *   - LOADING (pending > 0)        — pulsing orange dot, count of in-flight
 *   - ERR     (lastError recent)   — red dot, error count
 *   - LIVE    (recent ok response) — green dot, ok count
 *   - IDLE    (no activity yet)    — dim gray dot, "Waiting"
 *
 * Click to expand → popover listing recent fetches (endpoint + status +
 * fixed timestamp) and currently in-flight requests. Esc / outside click
 * closes the popover. The label uses the absolute receipt time (e.g.
 * "@ 21:23:45 NY") rather than a rolling "(3s ago)" so the number stays
 * fixed once a fetch lands.
 */

import { useEffect, useRef, useState } from 'react';
import { useFetchStatus, type RecentEvent } from './fetchStatus';
import { triggerManualRefresh } from './refreshInterval';
import { useTweaks } from './tweaks';
import { formatTime } from './format';

function shortLabel(label: string): string {
  // "/api/market/indices" → "market/indices"
  // "SSE /api/ai/signals" → "ai/signals"
  return label
    .replace(/^SSE\s+/, '')
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^\/?api\//, '');
}

function tzAbbreviation(tz: string): string {
  if (tz === 'America/New_York') return 'NY';
  if (tz === 'Asia/Seoul')       return 'KST';
  if (tz === 'Europe/London')    return 'LDN';
  return 'UTC';
}

export function FetchIndicator() {
  const status = useFetchStatus();
  const { pending, completed, errors, lastError, lastSuccess, total, recent, inflight } = status;
  const { values } = useTweaks();
  const tz = values.timezone || 'America/New_York';
  const tzAbbrev = tzAbbreviation(tz);

  // Popover open/close state. The chip itself is the trigger.
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  // Close on Escape and on outside click.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false);
    }
    function onPointer(e: MouseEvent): void {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  // Determine state. ERR sticks for ~5 s after the last error, unless
  // something successful has happened more recently.
  const now = Date.now();
  const errorAge   = lastError   ? Math.floor((now - lastError.at)   / 1000) : null;
  const successAge = lastSuccess ? Math.floor((now - lastSuccess.at) / 1000) : null;
  const errorRecent =
    errorAge != null &&
    errorAge < 5 &&
    (successAge == null || (lastError && lastSuccess && lastError.at > lastSuccess.at));

  let state: 'loading' | 'err' | 'live' | 'idle';
  let dotColor: string;
  let label: string;

  // Fixed-timestamp suffix (no rolling "Xs ago") sourced from last receipt.
  const lastReceivedTime =
    lastSuccess
      ? formatTime(lastSuccess.at, { timeZone: tz, abbreviation: tzAbbrev })
      : null;
  const lastErrorTime =
    lastError
      ? formatTime(lastError.at, { timeZone: tz, abbreviation: tzAbbrev })
      : null;

  if (pending > 0) {
    state = 'loading';
    dotColor = 'var(--orange)';
    label = lastReceivedTime
      ? `Fetching ${pending} · last ${lastReceivedTime}`
      : `Fetching ${pending}`;
  } else if (errorRecent) {
    state = 'err';
    dotColor = 'var(--down)';
    label = lastErrorTime
      ? `${errors === 1 ? 'Error' : `Errors ${errors}`} @ ${lastErrorTime}`
      : (errors === 1 ? 'Error' : `Errors ${errors}`);
  } else if (lastReceivedTime) {
    state = 'live';
    dotColor = 'var(--up)';
    label = `Live · ${completed} ok @ ${lastReceivedTime}`;
  } else {
    state = 'idle';
    dotColor = 'var(--fg-4)';
    label = 'Waiting';
  }

  return (
    <span ref={wrapperRef} className="fetch-indicator-wrap">
      <button
        type="button"
        className={`fetch-indicator ${state}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Data ${state}, ${pending} pending, ${errors} errors, ${completed} ok. Click for details.`}
      >
        <span
          className="fetch-indicator-dot"
          style={{ background: dotColor }}
          data-pulsing={state === 'loading' ? 'true' : undefined}
        />
        <span className="fetch-indicator-label">{label}</span>
      </button>

      {open && (
        <FetchPopover
          recent={recent}
          inflight={inflight}
          totals={{ pending, completed, errors, total }}
          tz={tz}
          tzAbbrev={tzAbbrev}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

interface PopoverProps {
  recent: RecentEvent[];
  inflight: { id: number; kind: string; label: string; startedAt: number }[];
  totals: { pending: number; completed: number; errors: number; total: number };
  tz: string;
  tzAbbrev: string;
  onClose: () => void;
}

function FetchPopover({ recent, inflight, totals, tz, tzAbbrev, onClose }: PopoverProps) {
  return (
    <div
      className="fetch-popover"
      role="dialog"
      aria-label="Recent network activity"
    >
      <div className="fetch-popover-head">
        <div className="fetch-popover-title">Recent activity</div>
        <button
          type="button"
          className="fetch-popover-close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="fetch-popover-totals">
        <span><span className="dot up"   /> {totals.completed} ok</span>
        <span><span className="dot down" /> {totals.errors} err</span>
        <span><span className="dot live" /> {totals.pending} pending</span>
        <span className="muted">total {totals.total}</span>
      </div>

      {inflight.length > 0 && (
        <>
          <div className="fetch-popover-section-h">In flight</div>
          <ul className="fetch-popover-list">
            {inflight.map((e) => (
              <li key={e.id} className="fetch-popover-row pending">
                <span className="fetch-popover-time">
                  {formatTime(e.startedAt, { timeZone: tz, abbreviation: tzAbbrev })}
                </span>
                <span className="fetch-popover-method">{e.kind === 'sse' ? 'SSE' : 'GET'}</span>
                <span className="fetch-popover-label" title={e.label}>{shortLabel(e.label)}</span>
                <span className="fetch-popover-status">…</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="fetch-popover-section-h">
        Last {Math.min(recent.length, 30)} {recent.length === 0 ? 'events' : recent.length === 1 ? 'event' : 'events'}
      </div>
      {recent.length === 0 ? (
        <div className="fetch-popover-empty">No requests yet.</div>
      ) : (
        <ul className="fetch-popover-list">
          {recent.map((e, i) => (
            <li
              key={`${e.at}-${e.label}-${i}`}
              className={`fetch-popover-row ${e.ok ? 'ok' : 'err'}`}
            >
              <span className="fetch-popover-time">
                {formatTime(e.at, { timeZone: tz, abbreviation: tzAbbrev })}
              </span>
              <span className="fetch-popover-method">
                {e.label.startsWith('SSE') ? 'SSE' : 'GET'}
              </span>
              <span className="fetch-popover-label" title={e.label}>
                {shortLabel(e.label)}
              </span>
              <span className="fetch-popover-status">{e.detail ?? (e.ok ? '200' : 'err')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Topbar manual-refresh button. One click bumps a global counter that every
 * `useAsync` watches and re-fires its fetcher in response. Disabled while
 * any request is already in flight to prevent click-storms.
 */
export function RefreshButton() {
  const { pending } = useFetchStatus();
  const busy = pending > 0;
  return (
    <button
      type="button"
      className="refresh-btn"
      onClick={triggerManualRefresh}
      disabled={busy}
      aria-label="Refresh all data"
      title={busy ? 'Refreshing…' : 'Refresh all data now'}
    >
      <span
        className="refresh-btn-icon"
        aria-hidden="true"
        data-spinning={busy ? 'true' : undefined}
      >
        ↻
      </span>
      <span className="refresh-btn-label">Refresh</span>
    </button>
  );
}

/**
 * Live-updating clock matching the prototype's "NY 09:42:18 · 26 APR".
 * Honors the user's selected timezone from Tweaks.
 */
export function LiveClock() {
  const { values } = useTweaks();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const tz = values.timezone || 'America/New_York';
  const tzAbbrev = tzAbbreviation(tz);
  const time = formatTime(now, { timeZone: tz, abbreviation: tzAbbrev });
  const date = new Intl.DateTimeFormat('en-US', {
    day:      '2-digit',
    month:    'short',
    timeZone: tz,
  })
    .format(new Date(now))
    .toUpperCase()
    .replace('.', '');
  return <span>{`${time} · ${date}`}</span>;
}
