/**
 * FetchIndicator — small topbar widget showing live REST + SSE activity.
 *
 * Consumed from `useFetchStatus()` (see fetchStatus.ts). The status is
 * derived rather than held: the widget recomputes from `pending`,
 * `errors`, and `lastSuccess.at` every render.
 *
 * States:
 *   - LOADING (pending > 0)        — pulsing orange dot, count of requests
 *   - ERR     (lastError recent)   — red dot, hover for detail
 *   - LIVE    (recent ok response) — solid green dot
 *   - IDLE    (no activity yet)    — dim gray dot, "—"
 */

import { useEffect, useState } from 'react';
import { useFetchStatus } from './fetchStatus';
import { useTweaks } from './tweaks';
import { formatTime } from './format';

function ageSeconds(now: number, then: number | null): number | null {
  if (then == null) return null;
  return Math.max(0, Math.floor((now - then) / 1000));
}

function shortLabel(label: string): string {
  // "/api/market/indices" → "market/indices"
  // "SSE /api/ai/signals" → "ai/signals"
  return label.replace(/^\/?api\//, '').replace(/^SSE\s+\/?api\//, '');
}

export function FetchIndicator() {
  const { pending, completed, errors, lastError, lastSuccess, total } =
    useFetchStatus();
  const { values } = useTweaks();

  // Tick every second so "12s ago" stays accurate without each event
  // forcing a render.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Determine state. ERR sticks around for ~5 s after the last error,
  // unless something successful has happened more recently.
  const errorAge   = ageSeconds(now, lastError?.at   ?? null);
  const successAge = ageSeconds(now, lastSuccess?.at ?? null);
  const errorRecent =
    errorAge != null &&
    errorAge < 5 &&
    (successAge == null || (lastError && lastSuccess && lastError.at > lastSuccess.at));

  let state: 'loading' | 'err' | 'live' | 'idle';
  let dotColor: string;
  let label: string;

  if (pending > 0) {
    // Currently making N network calls — pulsing orange.
    state = 'loading';
    dotColor = 'var(--orange)';
    label = `Fetching ${pending}`;
  } else if (errorRecent) {
    // The most recent activity (within the last 5 s) was an error.
    state = 'err';
    dotColor = 'var(--down)';
    label = errors === 1 ? `Error` : `Errors ${errors}`;
  } else if (successAge != null) {
    // No requests in flight; we have at least one prior success → live & idle.
    state = 'live';
    dotColor = 'var(--up)';
    label = `Live · ${completed} ok`;
  } else {
    // No activity yet (right after page load before the first fetch lands).
    state = 'idle';
    dotColor = 'var(--fg-4)';
    label = 'Waiting';
  }

  // Tooltip — last activity summary.
  const lastEvent = lastError && lastSuccess
    ? lastError.at > lastSuccess.at ? lastError : lastSuccess
    : (lastError ?? lastSuccess);
  const lastAge = lastEvent ? ageSeconds(now, lastEvent.at) : null;
  const tooltip = [
    `pending ${pending}`,
    `ok ${completed}`,
    `err ${errors}`,
    `total ${total}`,
    lastEvent
      ? `last ${lastEvent.ok ? 'ok' : 'err'}: ${shortLabel(lastEvent.label)}${
          lastEvent.detail ? ` (${lastEvent.detail})` : ''
        } · ${lastAge}s ago`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <span
      className={`fetch-indicator ${state}`}
      title={tooltip}
      role="status"
      aria-live="polite"
      aria-label={`Data ${state}, ${pending} pending, ${errors} errors, ${completed} ok`}
    >
      <span
        className="fetch-indicator-dot"
        style={{ background: dotColor }}
        data-pulsing={state === 'loading' ? 'true' : undefined}
      />
      <span className="fetch-indicator-label">{label}</span>
    </span>
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
  const tzAbbrev =
    tz === 'America/New_York' ? 'NY'
    : tz === 'Asia/Seoul'      ? 'KST'
    : tz === 'Europe/London'   ? 'LDN'
    : 'UTC';
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
