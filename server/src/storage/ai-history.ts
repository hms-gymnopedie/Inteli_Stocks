/**
 * Persistent AI history — B8-AI-TAB
 *
 * Stores the last N AI generations per area in
 * `~/.intelistock/ai-history.json` so the per-page AI cards (Overview /
 * Portfolio / Detail / Geo) can hydrate from prior calls instead of going
 * blank when the user navigates away. Also feeds the `/ai-assistant` tab.
 *
 * Source-of-truth model: this file is purely a cache/history sink. Every
 * successful generation in `routes/ai.ts` calls one of the `append*`
 * helpers fire-and-forget, alongside the existing Google-Sheets mirror.
 *
 * Capacity: each list is capped at MAX_PER_AREA (50) with FIFO drop of the
 * oldest entries — keeps the JSON small and bounded.
 *
 * Atomic writes: write to a tmp file then `rename` so a crash mid-write
 * never leaves a partial JSON on disk.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AIUsage } from '../providers/registry.js';

// ─── Disk layout ────────────────────────────────────────────────────────────

const DATA_DIR  = path.join(os.homedir(), '.intelistock');
const DATA_FILE = path.join(DATA_DIR, 'ai-history.json');
const TMP_FILE  = path.join(DATA_DIR, 'ai-history.json.tmp');

const MAX_PER_AREA = 50;

// ─── Types ──────────────────────────────────────────────────────────────────

export type Area = 'signals' | 'insights' | 'verdicts' | 'hedges';

export interface HistoryMeta {
  provider: string;
  model:    string;
  usage:    AIUsage;
}

export interface HistoryEntry {
  id:        string;
  createdAt: number;          // epoch ms
  provider:  string;
  model:     string;
  usage:     AIUsage;
  data:      unknown;          // shape varies by area
  symbol?:   string;           // verdicts
  exposure?: string;           // hedges
}

export interface AIHistoryFile {
  signals:  HistoryEntry[];
  insights: HistoryEntry[];
  verdicts: HistoryEntry[];
  hedges:   HistoryEntry[];
}

// ─── In-memory mirror + IO ──────────────────────────────────────────────────

function emptyHistory(): AIHistoryFile {
  return { signals: [], insights: [], verdicts: [], hedges: [] };
}

let cache: AIHistoryFile | null = null;

function load(): AIHistoryFile {
  if (cache) return cache;
  try {
    if (!fs.existsSync(DATA_DIR))  fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) {
      cache = emptyHistory();
      return cache;
    }
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as Partial<AIHistoryFile>;
    cache = {
      signals:  Array.isArray(raw.signals)  ? raw.signals  : [],
      insights: Array.isArray(raw.insights) ? raw.insights : [],
      verdicts: Array.isArray(raw.verdicts) ? raw.verdicts : [],
      hedges:   Array.isArray(raw.hedges)   ? raw.hedges   : [],
    };
    return cache;
  } catch (err) {
    console.error('[ai-history] load failed, resetting:', err);
    cache = emptyHistory();
    return cache;
  }
}

function persist(): void {
  if (!cache) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(TMP_FILE, JSON.stringify(cache, null, 2), 'utf8');
    fs.renameSync(TMP_FILE, DATA_FILE);
  } catch (err) {
    console.error('[ai-history] persist failed:', err);
  }
}

function pushEntry(area: Area, entry: HistoryEntry): void {
  const h = load();
  h[area].push(entry);
  // FIFO cap — drop oldest first.
  while (h[area].length > MAX_PER_AREA) h[area].shift();
  persist();
}

// ─── Id generator ───────────────────────────────────────────────────────────

let counter = 0;
function genId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

// ─── Public append helpers ──────────────────────────────────────────────────

/** Append a batch of signals as a single history entry. */
export function appendSignals(items: unknown[], meta: HistoryMeta): void {
  pushEntry('signals', {
    id:        genId('sig'),
    createdAt: Date.now(),
    provider:  meta.provider,
    model:     meta.model,
    usage:     meta.usage,
    data:      items,
  });
}

/** Append a batch of insights as a single history entry. */
export function appendInsights(items: unknown[], meta: HistoryMeta): void {
  pushEntry('insights', {
    id:        genId('ins'),
    createdAt: Date.now(),
    provider:  meta.provider,
    model:     meta.model,
    usage:     meta.usage,
    data:      items,
  });
}

/** Append a single verdict (per-symbol). */
export function appendVerdict(verdict: { symbol: string } & Record<string, unknown>, meta: HistoryMeta): void {
  pushEntry('verdicts', {
    id:        genId('vrd'),
    createdAt: Date.now(),
    provider:  meta.provider,
    model:     meta.model,
    usage:     meta.usage,
    data:      verdict,
    symbol:    typeof verdict.symbol === 'string' ? verdict.symbol : undefined,
  });
}

/** Append a single hedge proposal (per-exposure). */
export function appendHedge(hedge: unknown, exposure: string, meta: HistoryMeta): void {
  pushEntry('hedges', {
    id:        genId('hdg'),
    createdAt: Date.now(),
    provider:  meta.provider,
    model:     meta.model,
    usage:     meta.usage,
    data:      hedge,
    exposure,
  });
}

// ─── Read helpers ───────────────────────────────────────────────────────────

/**
 * Returns the full history file (newest entries last) or, when `area` is
 * given, the entries for that single area. `limit` truncates to the most
 * recent N entries.
 */
export function readHistory(): AIHistoryFile;
export function readHistory(area: Area, limit?: number): HistoryEntry[];
export function readHistory(area?: Area, limit?: number): AIHistoryFile | HistoryEntry[] {
  const h = load();
  if (!area) {
    if (typeof limit !== 'number') return h;
    return {
      signals:  h.signals.slice(-limit),
      insights: h.insights.slice(-limit),
      verdicts: h.verdicts.slice(-limit),
      hedges:   h.hedges.slice(-limit),
    };
  }
  const list = h[area];
  return typeof limit === 'number' ? list.slice(-limit) : list;
}

/** Empty one area (used by DELETE /history/:area). */
export function clearArea(area: Area): void {
  const h = load();
  h[area] = [];
  persist();
}
