/**
 * On-demand fetch hooks for expensive / opt-in operations (esp. LLM calls).
 *
 * Unlike `useAsync`, these:
 *   • Do NOT fire on mount.
 *   • Do NOT participate in the global refresh / polling cycle.
 *   • Do NOT cache or share with `useAsync`.
 *
 * The user clicks a Generate button → `run()` fires → a single fetch (or
 * stream) lands → state updates with `lastReceivedAt` and per-item arrival
 * timestamps. A second click cancels the previous run via a generation
 * counter (`runIdRef`) so race-y in-flight responses are dropped.
 *
 * Use these for:
 *   - AI verdict / hedge proposal (one-shot LLM JSON)
 *   - AI signals / insights stream (multi-event SSE)
 */

import { useCallback, useRef, useState } from 'react';

// ─── Single-shot ────────────────────────────────────────────────────────────

export interface OnDemandState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  /** Epoch ms of the most recent successful response, or null. */
  lastReceivedAt: number | null;
}

export interface OnDemandHandle<T> extends OnDemandState<T> {
  run: () => void;
  reset: () => void;
}

export function useOnDemand<T>(fn: () => Promise<T>): OnDemandHandle<T> {
  const [state, setState] = useState<OnDemandState<T>>({
    data: undefined,
    loading: false,
    error: undefined,
    lastReceivedAt: null,
  });
  // Newer runs invalidate older ones — prevents a slow earlier response
  // from clobbering a newer (faster) result.
  const runIdRef = useRef(0);

  const run = useCallback(() => {
    const id = ++runIdRef.current;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    fn()
      .then((data) => {
        if (id !== runIdRef.current) return;
        setState({
          data,
          loading: false,
          error: undefined,
          lastReceivedAt: Date.now(),
        });
      })
      .catch((error: Error) => {
        if (id !== runIdRef.current) return;
        setState((s) => ({ ...s, loading: false, error }));
      });
  }, [fn]);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    setState({
      data: undefined,
      loading: false,
      error: undefined,
      lastReceivedAt: null,
    });
  }, []);

  return { ...state, run, reset };
}

// ─── Streaming ──────────────────────────────────────────────────────────────

export interface OnDemandStreamItem<T> {
  data: T;
  /** Epoch ms when this specific item arrived. */
  receivedAt: number;
}

export interface OnDemandStreamHandle<T, M = unknown> {
  items: OnDemandStreamItem<T>[];
  loading: boolean;
  error: Error | undefined;
  /** Last item's `receivedAt`, or null. */
  lastReceivedAt: number | null;
  /** Stream-level metadata (e.g. AI token usage), set when the producer
   *  emits it. The producer fn receives an `onMeta` callback as its only
   *  argument; ignore it for streams that don't emit meta. */
  meta: M | null;
  run: () => void;
  reset: () => void;
}

export function useOnDemandStream<T, M = unknown>(
  fn: (onMeta?: (m: M) => void) => AsyncIterable<T>,
): OnDemandStreamHandle<T, M> {
  const [items, setItems] = useState<OnDemandStreamItem<T>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [meta, setMeta] = useState<M | null>(null);
  const runIdRef = useRef(0);

  const run = useCallback(() => {
    const id = ++runIdRef.current;
    setItems([]);
    setError(undefined);
    setMeta(null);
    setLoading(true);

    const onMeta = (m: M): void => {
      // Drop if a newer run started in the meantime.
      if (id !== runIdRef.current) return;
      setMeta(m);
    };

    (async () => {
      try {
        for await (const item of fn(onMeta)) {
          if (id !== runIdRef.current) return;
          setItems((prev) => [...prev, { data: item, receivedAt: Date.now() }]);
        }
      } catch (e) {
        if (id !== runIdRef.current) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (id === runIdRef.current) setLoading(false);
      }
    })();
  }, [fn]);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    setItems([]);
    setError(undefined);
    setMeta(null);
    setLoading(false);
  }, []);

  const lastReceivedAt =
    items.length > 0 ? items[items.length - 1].receivedAt : null;

  return { items, loading, error, lastReceivedAt, meta, run, reset };
}
