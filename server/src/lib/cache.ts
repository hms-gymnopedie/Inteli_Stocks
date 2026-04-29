/**
 * Tiny in-memory TTL cache.
 *
 * Usage (B2-MD):
 *   const cache = new TTLCache<Quote[]>(30_000); // 30 s TTL
 *   const data  = await cache.get('AAPL', () => fetchFromYahoo('AAPL'));
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TTLCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  /**
   * @param ttlMs  Time-to-live in milliseconds (default 30 s)
   */
  constructor(private readonly ttlMs: number = 30_000) {}

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
