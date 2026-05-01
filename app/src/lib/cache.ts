/**
 * In-memory cache for `useAsync` results.
 *
 * Survives across route navigations within a tab session (lost on full
 * reload). Keyed by `fn.toString() + JSON.stringify(deps)` so two call sites
 * that fetch the same thing share a single entry, while different deps
 * (e.g. `getOHLC('NVDA','1Y')` vs `getOHLC('AAPL','1Y')`) are isolated.
 *
 * Behaviour with useAsync:
 *   • Initial render: if a cache entry exists, the component starts with
 *     that data immediately (no skeleton flash).
 *   • Mount / deps-change: a fresh fetch runs ONLY if the cached entry is
 *     older than the active polling interval (or absent). When the user
 *     turns polling Off, any cached entry is treated as fresh forever
 *     until manual refresh.
 *   • Manual refresh: always refetches and overwrites the entry.
 *   • Polling: timer fires regardless and overwrites the entry.
 *
 * The cache is unbounded — for our ~30-50 fetcher footprint that's fine.
 * If we ever ship long-lived sessions that drift, add an LRU eviction.
 */

interface CacheEntry<T> {
  data: T;
  /** Epoch ms of the last successful fetch. */
  ts: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): CacheEntry<T> | undefined {
  return store.get(key) as CacheEntry<T> | undefined;
}

export function cacheSet<T>(key: string, data: T): void {
  store.set(key, { data, ts: Date.now() });
}

/** Drop a single key (e.g. when the user navigates to /settings → save key). */
export function cacheInvalidate(key: string): void {
  store.delete(key);
}

/** Clear everything (e.g. user logs out, or explicit "purge cache" action). */
export function cacheClear(): void {
  store.clear();
}

/** Diagnostic — number of live entries. */
export function cacheSize(): number {
  return store.size;
}
