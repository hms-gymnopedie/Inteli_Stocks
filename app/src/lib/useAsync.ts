import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DependencyList,
} from 'react';
import { cacheGet, cacheSet } from './cache';
import {
  getManualRefreshTick,
  getRefreshInterval,
  subscribeRefresh,
} from './refreshInterval';

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
}

export interface UseAsyncOpts {
  /**
   * Polling behaviour:
   *   true  (default) — refetch every Settings.refreshInterval ms.
   *   false           — fetch once, no polling (use for static data:
   *                     filings, peers, profile, ivSurface, etc.).
   *   number          — explicit override in ms.
   */
  poll?: boolean | number;
}

function useGlobalRefreshInterval(): number {
  return useSyncExternalStore(
    subscribeRefresh,
    getRefreshInterval,
    getRefreshInterval,
  );
}

function useManualRefreshTick(): number {
  return useSyncExternalStore(
    subscribeRefresh,
    getManualRefreshTick,
    getManualRefreshTick,
  );
}

/**
 * Minimal Promise→React-state adapter for the data layer's async fetchers.
 *
 * Three optimisations layered on top of the basic fetch:
 *   1. **In-memory cache** keyed by `fn.toString()+JSON.stringify(deps)` —
 *      survives navigation within the tab. Initial render hydrates from
 *      the cache so revisiting a page never shows skeletons again.
 *   2. **Fresh-cache skip** — if the cached entry is younger than the
 *      polling interval (or polling is Off and any cache exists), the
 *      mount-time fetch is skipped entirely. Polling and manual refresh
 *      still fire on schedule.
 *   3. **Background refresh** — when a fetch fires while data is already
 *      on screen, the loading flag stays false so the UI doesn't flicker.
 *
 * Cancellation-safe; pauses polling while the tab is hidden.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: DependencyList = [],
  { poll = true }: UseAsyncOpts = {},
): AsyncState<T> {
  const globalInterval = useGlobalRefreshInterval();
  const manualTick     = useManualRefreshTick();
  const intervalMs =
    poll === false ? 0
    : typeof poll === 'number' ? poll
    : globalInterval;
  // Manual refresh applies even when poll is false — explicit user intent.
  // (Static-data fetchers will refetch when the user presses Refresh, which
  // is the expected behaviour.)

  // Stable cache key. fn.toString() captures the call-site source (incl.
  // any inline literals like the macro-keys array). deps cover the closure
  // bindings (symbol, range, etc.). Together they uniquely identify a fetch.
  const cacheKey = useMemo(
    () => `${fn.toString()}|${JSON.stringify(deps)}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, ...deps],
  );

  // Initial state hydrates from cache when present — revisiting a page
  // shows the prior data instantly with no skeleton flash.
  const [state, setState] = useState<AsyncState<T>>(() => {
    const c = cacheGet<T>(cacheKey);
    return c
      ? { data: c.data, loading: false, error: undefined }
      : { data: undefined, loading: true, error: undefined };
  });

  // Track manualTick across renders so we can detect "user just clicked
  // Refresh" inside the effect and force a fetch even when cache is fresh.
  const lastManualTick = useRef(manualTick);

  useEffect(() => {
    let cancelled = false;

    function run(showLoading: boolean): void {
      if (showLoading) {
        setState((s) => ({ ...s, loading: true, error: undefined }));
      }
      fn()
        .then((data) => {
          if (cancelled) return;
          cacheSet(cacheKey, data);
          setState({ data, loading: false, error: undefined });
        })
        .catch((error: Error) => {
          if (!cancelled) setState((s) => ({ ...s, loading: false, error }));
        });
    }

    const isManualRefresh = manualTick > lastManualTick.current;
    lastManualTick.current = manualTick;

    const cached = cacheGet<T>(cacheKey);
    const ageMs  = cached ? Date.now() - cached.ts : Infinity;
    // Cache is "fresh" when polling is off (treat as fresh forever) OR when
    // it's younger than one interval. Either skips the mount-time fetch.
    const fresh =
      cached !== undefined && (intervalMs === 0 || ageMs < intervalMs);

    if (isManualRefresh || !fresh) {
      run(cached === undefined);
    }

    if (intervalMs <= 0) {
      return () => { cancelled = true; };
    }

    let timer: ReturnType<typeof setInterval> | null = null;

    function start(): void {
      if (timer != null) return;
      timer = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        run(false); // background refresh — keep last data visible
      }, intervalMs);
    }
    function stop(): void {
      if (timer != null) { clearInterval(timer); timer = null; }
    }

    function onVisibility(): void {
      if (typeof document === 'undefined') return;
      if (document.hidden) stop();
      else                 start();
    }

    start();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      cancelled = true;
      stop();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, intervalMs, manualTick]);

  return state;
}

/**
 * Adapter for AsyncIterable streams (geo alerts, AI signals/insights).
 * Accumulates yielded items into a state array. Resets when deps change.
 */
export function useAsyncStream<T>(
  fn: () => AsyncIterable<T>,
  deps: DependencyList = [],
): T[] {
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    let cancelled = false;
    setItems([]);
    (async () => {
      try {
        for await (const item of fn()) {
          if (cancelled) return;
          setItems((prev) => [...prev, item]);
        }
      } catch {
        // streams may be cancelled by deps changing — ignore
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return items;
}
