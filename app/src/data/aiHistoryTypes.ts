/**
 * Frontend mirror of `server/src/storage/ai-history.ts` — B8-AI-TAB.
 *
 * Kept in a separate file (not `types.ts`) to avoid file-edit collisions
 * with parallel agents. Imports `AIUsage` from the canonical types.
 */

import type { AIUsage } from './types';

export type Area = 'signals' | 'insights' | 'verdicts' | 'hedges';

/** A single row of the per-area history list returned by GET /api/ai/history. */
export interface HistoryEntry {
  id:        string;
  /** epoch ms — when the generation finished server-side. */
  createdAt: number;
  provider:  string;
  model:     string;
  usage:     AIUsage;
  /** Shape varies by area. Use `as` casts in the consumer to narrow. */
  data:      unknown;
  /** Set on `verdicts` entries. */
  symbol?:   string;
  /** Set on `hedges` entries. */
  exposure?: string;
}

/** Full GET /api/ai/history response (no `?area=` filter). */
export interface AIHistory {
  signals:  HistoryEntry[];
  insights: HistoryEntry[];
  verdicts: HistoryEntry[];
  hedges:   HistoryEntry[];
}

/** Response shape when GET /api/ai/history is called WITH `?area=`. */
export interface AIHistoryAreaResponse {
  area:    Area;
  entries: HistoryEntry[];
}
