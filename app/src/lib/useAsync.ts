import { useEffect, useState, useSyncExternalStore, type DependencyList } from 'react';
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
 * Cancellation safe; supports background polling at the user-configured
 * Settings.refreshInterval (default 10 min). Skips polling while the tab is
 * hidden so we don't burn API quota on a backgrounded window.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: DependencyList = [],
  { poll = true }: UseAsyncOpts = {},
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: undefined,
    loading: true,
    error: undefined,
  });
  const globalInterval = useGlobalRefreshInterval();
  const manualTick     = useManualRefreshTick();
  const intervalMs =
    poll === false ? 0
    : typeof poll === 'number' ? poll
    : globalInterval;
  // Manual refresh applies even when poll is false — explicit user intent.
  // (Static-data fetchers will refetch when the user presses Refresh, which
  // is the expected behaviour.)

  useEffect(() => {
    let cancelled = false;

    function run(showLoading: boolean): void {
      if (showLoading) {
        setState((s) => ({ ...s, loading: true, error: undefined }));
      }
      fn()
        .then((data) => {
          if (!cancelled) setState({ data, loading: false, error: undefined });
        })
        .catch((error: Error) => {
          if (!cancelled) setState((s) => ({ ...s, loading: false, error }));
        });
    }

    run(true);

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
  }, [...deps, intervalMs, manualTick]);

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
