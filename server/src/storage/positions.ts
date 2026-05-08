/**
 * Position rationale storage — B18.
 *
 * Each entry is a "I bought X because Y; alert me when Z" record. Sell
 * triggers are evaluated by jobs/cron.ts every market hour and fire a
 * Slack notification on match.
 *
 * File: ~/.intelistock/positions.json (atomic tmp+rename writes).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA_DIR  = path.join(os.homedir(), '.intelistock');
const DATA_FILE = path.join(DATA_DIR, 'positions.json');
const TMP_FILE  = path.join(DATA_DIR, 'positions.json.tmp');

// ─── Types ──────────────────────────────────────────────────────────────────

export type SellTrigger =
  | { type: 'date';             date: string }
  | { type: 'absoluteAbove';    price: number }
  | { type: 'absoluteBelow';    price: number }
  | { type: 'pctFromBase';      basePrice: number; pct: number }
  | { type: 'trailingFromPeak'; pct: number; peakPrice: number };

export interface PositionRationale {
  id:           string;
  symbol:       string;
  reason:       string;
  /** Price at the time of rationale creation. Used to seed pctFromBase /
   *  trailingFromPeak triggers when the user doesn't override. */
  entryPrice:   number;
  createdAt:    number;
  triggers:     SellTrigger[];
  /** Epoch ms when any trigger fired. null while still active. */
  firedAt:      number | null;
  /** The trigger that fired. */
  firedTrigger: SellTrigger | null;
  /** Whether a Slack message was sent (idempotency). */
  notified:     boolean;
}

interface PositionsFile {
  rationales: PositionRationale[];
}

// ─── IO ──────────────────────────────────────────────────────────────────────

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

let _cache: PositionsFile | null = null;

function load(): PositionsFile {
  if (_cache) return _cache;
  try {
    if (!fs.existsSync(DATA_FILE)) {
      _cache = { rationales: [] };
      return _cache;
    }
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as Partial<PositionsFile>;
    _cache = { rationales: Array.isArray(raw.rationales) ? raw.rationales : [] };
    return _cache;
  } catch {
    _cache = { rationales: [] };
    return _cache;
  }
}

function persist(): void {
  if (!_cache) return;
  ensureDir();
  fs.writeFileSync(TMP_FILE, JSON.stringify(_cache, null, 2), 'utf8');
  fs.renameSync(TMP_FILE, DATA_FILE);
}

let _idCtr = 0;
function genId(): string {
  _idCtr = (_idCtr + 1) % 1_000_000;
  return `p-${Date.now().toString(36)}-${_idCtr.toString(36)}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function listRationales(): PositionRationale[] {
  return load().rationales;
}

export function listActive(): PositionRationale[] {
  return load().rationales.filter((r) => r.firedAt == null);
}

export function getRationale(id: string): PositionRationale | undefined {
  return load().rationales.find((r) => r.id === id);
}

export interface CreateRationaleInput {
  symbol:     string;
  reason:     string;
  entryPrice: number;
  triggers:   SellTrigger[];
}

export function addRationale(input: CreateRationaleInput): PositionRationale {
  const r: PositionRationale = {
    id:           genId(),
    symbol:       input.symbol.toUpperCase(),
    reason:       input.reason.trim(),
    entryPrice:   input.entryPrice,
    createdAt:    Date.now(),
    triggers:     input.triggers,
    firedAt:      null,
    firedTrigger: null,
    notified:     false,
  };
  load().rationales.push(r);
  persist();
  return r;
}

export function deleteRationale(id: string): boolean {
  const f = load();
  const before = f.rationales.length;
  f.rationales = f.rationales.filter((r) => r.id !== id);
  const removed = f.rationales.length < before;
  if (removed) persist();
  return removed;
}

export function markFired(id: string, trigger: SellTrigger): void {
  const r = getRationale(id);
  if (!r) return;
  r.firedAt = Date.now();
  r.firedTrigger = trigger;
  r.notified = true;
  persist();
}

/** Bump trailing peak for one position (no-op if not active). */
export function updatePeak(id: string, newPeak: number): void {
  const r = getRationale(id);
  if (!r || r.firedAt != null) return;
  let dirty = false;
  for (const t of r.triggers) {
    if (t.type === 'trailingFromPeak' && newPeak > t.peakPrice) {
      t.peakPrice = newPeak;
      dirty = true;
    }
  }
  if (dirty) persist();
}
