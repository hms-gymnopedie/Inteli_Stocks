/**
 * Global refresh-interval store.
 *
 * Single source of truth for "how often should useAsync re-fetch live data?"
 * - Tweaks (`refreshInterval`) writes here on change.
 * - useAsync subscribes via useSyncExternalStore and re-arms its timer.
 *
 * Default: 10 min (600 000 ms). Setting it to 0 disables polling entirely.
 */

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

let intervalMs: number = DEFAULT_INTERVAL_MS;
const listeners = new Set<() => void>();

export function getRefreshInterval(): number {
  return intervalMs;
}

export function setRefreshInterval(ms: number): void {
  const next = Math.max(0, Math.floor(ms || 0));
  if (next === intervalMs) return;
  intervalMs = next;
  for (const l of listeners) l();
}

export function subscribeRefresh(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
