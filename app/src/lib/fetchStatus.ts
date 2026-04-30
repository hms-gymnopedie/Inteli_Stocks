/**
 * Global fetch & SSE telemetry — single source of truth for the topbar
 * "수신상태" indicator.
 *
 * Tracks:
 *   • pending — current in-flight requests (REST + SSE)
 *   • completed — total successful responses since session start
 *   • errors — total errored responses
 *   • lastError / lastSuccess — recent activity for the tooltip
 *
 * Wires itself in two places:
 *   1. Patches `window.fetch` once on module import to count every `/api/*`
 *      request without needing each call site to opt in.
 *   2. `registerStream(label)` lets `consumeSSE` (EventSource) participate too.
 */

import { useSyncExternalStore } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FetchKind = 'rest' | 'sse';

export interface InflightEntry {
  id: number;
  kind: FetchKind;
  label: string;
  startedAt: number;
}

export interface RecentEvent {
  at: number;
  ok: boolean;
  label: string;
  detail?: string;
}

export interface FetchStatus {
  pending: number;
  inflight: InflightEntry[];
  /** Total successful responses (REST 2xx + SSE 'done' or first chunk). */
  completed: number;
  /** Total errored responses (network failure, 4xx, 5xx, SSE error). */
  errors: number;
  lastSuccess: RecentEvent | null;
  lastError: RecentEvent | null;
  /** Cumulative request count since module load (for "n loaded" display). */
  total: number;
}

// ─── Store ───────────────────────────────────────────────────────────────────

const NULL_STATUS: FetchStatus = {
  pending:    0,
  inflight:   [],
  completed:  0,
  errors:     0,
  lastSuccess: null,
  lastError:   null,
  total:      0,
};

let state: FetchStatus = NULL_STATUS;
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function setState(patch: Partial<FetchStatus>): void {
  // Keep arrays referentially stable when not changed.
  state = { ...state, ...patch };
  emit();
}

// ─── Public lifecycle: REST ──────────────────────────────────────────────────

function startEntry(kind: FetchKind, label: string): InflightEntry {
  const entry: InflightEntry = {
    id:        nextId++,
    kind,
    label,
    startedAt: Date.now(),
  };
  setState({
    inflight: [...state.inflight, entry],
    pending:  state.pending + 1,
    total:    state.total + 1,
  });
  return entry;
}

function completeEntry(entry: InflightEntry, ok: boolean, detail?: string): void {
  const inflight = state.inflight.filter((e) => e.id !== entry.id);
  const event: RecentEvent = {
    at:    Date.now(),
    ok,
    label: entry.label,
    detail,
  };
  setState({
    inflight,
    pending:    Math.max(0, state.pending - 1),
    completed:  ok ? state.completed + 1 : state.completed,
    errors:     ok ? state.errors          : state.errors + 1,
    lastSuccess: ok ? event : state.lastSuccess,
    lastError:   ok ? state.lastError : event,
  });
}

// ─── Public lifecycle: SSE (used by consumeSSE) ──────────────────────────────

export interface StreamHandle {
  /** Call once when first event arrives (or right after connect succeeds). */
  ok: (detail?: string) => void;
  /** Call on error. */
  error: (detail?: string) => void;
  /** Call on stream end (success or error already reported via ok/error). */
  done: () => void;
}

export function registerStream(label: string): StreamHandle {
  const entry = startEntry('sse', label);
  let settled = false;
  return {
    ok: (detail) => {
      if (settled) return;
      // Don't decrement inflight on first chunk — keep stream as "pending"
      // until done(). But mark a successful event for the tooltip.
      setState({
        completed:   state.completed + 1,
        total:       state.total,           // already counted at start
        lastSuccess: { at: Date.now(), ok: true, label: entry.label, detail },
      });
    },
    error: (detail) => {
      if (settled) return;
      settled = true;
      completeEntry(entry, false, detail);
    },
    done: () => {
      if (settled) return;
      settled = true;
      completeEntry(entry, true);
    },
  };
}

// ─── React subscription ──────────────────────────────────────────────────────

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): FetchStatus {
  return state;
}

export function useFetchStatus(): FetchStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ─── Global fetch patch ──────────────────────────────────────────────────────

/** Friendly label from a URL or RequestInfo. */
function labelFor(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL)      return input.pathname + input.search;
  return input.url ?? String(input);
}

function isApiUrl(label: string): boolean {
  // Cover relative `/api/...`, absolute `http://host/api/...`, and any URL
  // that happens to include `/api/` as a path segment.
  return /(^|\/)api\//.test(label);
}

/**
 * Patches window.fetch ONCE so every `/api/*` REST call is counted without
 * each call site opting in. Idempotent — calling it again is a no-op.
 */
function installFetchPatch(): void {
  if (typeof window === 'undefined') return;
  // Use a marker so HMR / re-imports don't double-wrap.
  const w = window as Window & { __intelistockFetchPatched?: boolean };
  if (w.__intelistockFetchPatched) return;
  w.__intelistockFetchPatched = true;

  const orig = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const label = labelFor(input);
    if (!isApiUrl(label) || init?.method === 'HEAD') {
      // Skip non-API fetches and HEAD probes (HEAD is used by streamSignals
      // to test 503 before opening EventSource — not worth showing).
      return orig(input, init);
    }
    const entry = startEntry('rest', label);
    try {
      const res = await orig(input, init);
      completeEntry(entry, res.ok, `${res.status}`);
      return res;
    } catch (e) {
      completeEntry(entry, false, e instanceof Error ? e.message : String(e));
      throw e;
    }
  };
}

installFetchPatch();
