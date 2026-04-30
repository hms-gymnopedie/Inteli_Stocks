/**
 * Tiny in-memory TTL cache.
 *
 * Usage (B2-MD):
 *   const cache = new TTLCache<Quote[]>(300_000); // 5 min TTL
 *   const data  = await cache.get('AAPL', () => fetchFromYahoo('AAPL'));
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TTLCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  /**
   * @param ttlMs  Time-to-live in milliseconds (default 5 min)
   */
  constructor(private readonly ttlMs: number = 300_000) {}

  /**
   * Return the cached value if it is still fresh, otherwise call `loader`,
   * store the result, and return it.
   */
  async get(key: string, loader: () => Promise<T>): Promise<T> {
    const entry = this.store.get(key);
    if (entry && Date.now() < entry.expiresAt) {
      return entry.value;
    }
    const value = await loader();
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    return value;
  }

  /** Manually invalidate a key. */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /** Invalidate all entries. */
  clear(): void {
    this.store.clear();
  }

  /** Number of live (non-expired) entries. */
  get size(): number {
    const now = Date.now();
    let count = 0;
    for (const entry of this.store.values()) {
      if (now < entry.expiresAt) count++;
    }
    return count;
  }
}

/**
 * LastGoodCache — stores the last successfully returned value for each key,
 * with no expiry. Used as a second-tier fallback behind TTLCache.
 *
 * When Yahoo is rate-limited or unreachable:
 *   1. TTLCache miss (expired)
 *   2. Yahoo call throws
 *   3. LastGoodCache returns the stale-but-valid last response
 *   4. If LastGoodCache is also empty → caller handles with a hardcoded mock
 *
 * Usage:
 *   const lgc = new LastGoodCache<Index[]>();
 *   lgc.set('indices', freshData);
 *   const stale = lgc.get('indices');  // undefined if never set
 */
export class LastGoodCache<T> {
  private readonly store = new Map<string, T>();

  /** Store a successful response. */
  set(key: string, value: T): void {
    this.store.set(key, value);
  }

  /** Retrieve the last-good value (undefined if never set). */
  get(key: string): T | undefined {
    return this.store.get(key);
  }

  /** Clear a specific key. */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /** Clear all entries. */
  clear(): void {
    this.store.clear();
  }

  /** Number of stored entries. */
  get size(): number {
    return this.store.size;
  }
}

/**
 * tryCache — convenience wrapper that:
 *   1. Returns TTLCache hit (fresh)
 *   2. On miss, calls fetcher
 *   3. On fetcher success: updates TTLCache + LastGoodCache, returns fresh
 *   4. On fetcher error: returns LastGoodCache value (stale), or throws if also empty
 *
 * @param ttlCache    Module-level TTLCache instance
 * @param lgCache     Module-level LastGoodCache instance
 * @param key         Cache key (same for both caches)
 * @param fetcher     Async data loader
 * @param logTag      Short tag for console.warn when stale is served
 */
export async function tryCache<T>(
  ttlCache: TTLCache<T>,
  lgCache: LastGoodCache<T>,
  key: string,
  fetcher: () => Promise<T>,
  logTag: string = 'tryCache',
): Promise<T> {
  // Check TTL cache first (fast path)
  const ttlEntry = (ttlCache as unknown as { store: Map<string, CacheEntry<T>> }).store.get(key);
  if (ttlEntry && Date.now() < ttlEntry.expiresAt) {
    return ttlEntry.value;
  }

  // TTL miss — try to fetch fresh data
  try {
    const fresh = await fetcher();
    // Update both caches on success
    await ttlCache.get(key, () => Promise.resolve(fresh)); // warm TTL cache
    // TTLCache.get above returns cache hit on second call — prime it directly
    (ttlCache as unknown as { store: Map<string, CacheEntry<T>> }).store.set(key, {
      value: fresh,
      expiresAt: Date.now() + (ttlCache as unknown as { ttlMs: number }).ttlMs,
    });
    lgCache.set(key, fresh);
    return fresh;
  } catch (err) {
    // Fetcher failed — serve stale if available
    const stale = lgCache.get(key);
    if (stale !== undefined) {
      console.warn(`[B2-MD2] ${logTag}: yahoo error, serving stale last-good for key="${key}"`);
      return stale;
    }
    // No stale data — re-throw so caller can use hardcoded mock
    throw err;
  }
}
