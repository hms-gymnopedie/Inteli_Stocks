/**
 * strategies.ts — JSON file-backed CRUD for backtested strategies — B8-SIM
 *
 * Storage path: ~/.intelistock/strategies.json
 * Schema: { strategies: Strategy[] }
 *
 * Each strategy is the persisted output of /api/sim/backtest plus a small
 * envelope (id, name, createdAt). Records are immutable after creation —
 * re-running a backtest creates a new record (the user can delete the old
 * one). This keeps the leaderboard reproducible.
 *
 * Writes are atomic (tmp-file + rename) so a crash mid-write can't truncate
 * the JSON file.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import type {
  Allocation,
  EquityPoint,
  StrategyMetrics,
} from '../lib/backtest.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Strategy {
  id:                    string;
  name:                  string;
  createdAt:             number;
  allocations:           Allocation[];
  startDate:             string;
  endDate:               string;
  metrics:               StrategyMetrics;
  equityCurve:           EquityPoint[];
  benchmarkMetrics:      StrategyMetrics;
  benchmarkEquityCurve:  EquityPoint[];
}

interface StrategiesFile {
  strategies: Strategy[];
}

// ─── Paths ────────────────────────────────────────────────────────────────────

const DATA_DIR  = path.join(os.homedir(), '.intelistock');
const DATA_FILE = path.join(DATA_DIR, 'strategies.json');

// ─── ID generator ─────────────────────────────────────────────────────────────

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const ID_LEN      = 10;

/** nanoid-style URL-safe short ID. ~52 bits of entropy at length 10. */
function shortId(): string {
  const bytes = crypto.randomBytes(ID_LEN);
  let out = '';
  for (let i = 0; i < ID_LEN; i++) {
    out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  }
  return out;
}

// ─── File I/O ─────────────────────────────────────────────────────────────────

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readFile(): StrategiesFile {
  try {
    ensureDir();
    if (!fs.existsSync(DATA_FILE)) return { strategies: [] };
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StrategiesFile>;
    return { strategies: Array.isArray(parsed.strategies) ? parsed.strategies : [] };
  } catch (err) {
    console.error('[strategies] read failed:', err);
    return { strategies: [] };
  }
}

function writeFile(data: StrategiesFile): void {
  try {
    ensureDir();
    const tmp = `${DATA_FILE}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.error('[strategies] write failed:', err);
    throw err;
  }
}

// ─── Public CRUD ──────────────────────────────────────────────────────────────

/** List all strategies (caller decides ordering). */
export function listStrategies(): Strategy[] {
  return readFile().strategies;
}

/**
 * Append a new strategy, generating id + createdAt.
 * Returns the persisted record (with id/createdAt populated).
 */
export function addStrategy(
  s: Omit<Strategy, 'id' | 'createdAt'>,
): Strategy {
  const file = readFile();
  const record: Strategy = {
    ...s,
    id:        shortId(),
    createdAt: Date.now(),
  };
  file.strategies.push(record);
  writeFile(file);
  return record;
}

export function getStrategy(id: string): Strategy | null {
  const file = readFile();
  return file.strategies.find((s) => s.id === id) ?? null;
}

/** Returns true if a record was deleted, false if id was not found. */
export function deleteStrategy(id: string): boolean {
  const file = readFile();
  const before = file.strategies.length;
  file.strategies = file.strategies.filter((s) => s.id !== id);
  if (file.strategies.length === before) return false;
  writeFile(file);
  return true;
}

export function clearAll(): void {
  writeFile({ strategies: [] });
}
