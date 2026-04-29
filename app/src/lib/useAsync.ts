import { useEffect, useState, type DependencyList } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
}

/**
 * Minimal Promise→React-state adapter for the data layer's async fetchers.
 * Cancellation safe: stale fetches are dropped if the component unmounts or
 * deps change. For B2-MD's polling/streaming we'll likely swap this for
 * TanStack Query — keep call sites simple so the swap is mechanical.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: DependencyList = [],
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: undefined,
    loading: true,
    error: undefined,
  });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    fn()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: undefined });
      })
      .catch((error: Error) => {
        if (!cancelled)
          setState((s) => ({ ...s, loading: false, error }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

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
