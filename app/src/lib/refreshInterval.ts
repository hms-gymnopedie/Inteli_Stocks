/**
 * Global refresh-interval store + manual-refresh tick.
 *
 * Single source of truth for "how often should useAsync re-fetch live data?"
 * and "did the user just press the Refresh button?"
 * - Tweaks (`refreshInterval`) writes here on change.
 * - The topbar Refresh button calls `triggerManualRefresh()`.
 * - useAsync subscribes via useSyncExternalStore and re-fetches when either
 *   the interval changes or the manual tick increments.
 *
 * Default: 10 min (600 000 ms). Setting it to 0 disables polling entirely
 * (the manual tick still works).
 */

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

let intervalMs: number = DEFAULT_INTERVAL_MS;
let manualTick: number = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function getRefreshInterval(): number {
  return intervalMs;
}

export function getManualRefreshTick(): number {
  return manualTick;
}

export function setRefreshInterval(ms: number): void {
  const next = Math.max(0, Math.floor(ms || 0));
  if (next === intervalMs) return;
  intervalMs = next;
  emit();
}

/**
 * Bump the manual-refresh counter — every component using useAsync (without
 * `poll: false`) re-fetches once. Used by the topbar Refresh button.
 */
export function triggerManualRefresh(): void {
  manualTick += 1;
  emit();
}

export function subscribeRefresh(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
