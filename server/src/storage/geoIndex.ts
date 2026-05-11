/**
 * Geo risk index trail storage — B31-2.
 *
 * The /api/geo/state endpoint returns a single `globalIndex.value` per
 * call (cached 6h via Gemini-grounded). We snapshot that value here every
 * time /state is hit (throttled so we keep ≤4 snapshots / day) so a small
 * sparkline of where the risk number has been over the last 1D / 1W / 1M
 * can render in the UI.
 *
 * File: ~/.intelistock/geo-index-trail.json
 * Trimmed to the most-recent 90 days (≈360 snapshots) on every write.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA_DIR  = path.join(os.homedir(), '.intelistock');
const DATA_FILE = path.join(DATA_DIR, 'geo-index-trail.json');
const TMP_FILE  = path.join(DATA_DIR, 'geo-index-trail.json.tmp');

const MIN_GAP_MS  = 6 * 60 * 60 * 1000;          // 6h between snapshots
const MAX_AGE_MS  = 90 * 24 * 60 * 60 * 1000;    // keep 90 days
const MAX_POINTS  = 400;                          // hard cap

export interface IndexSnapshot {
  ts:    number;   // epoch ms
  value: number;   // 0-100
  note?: string;   // optional one-liner rationale at snapshot time
}

interface TrailFile {
  snapshots: IndexSnapshot[];
}

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(): TrailFile {
  try {
    if (!fs.existsSync(DATA_FILE)) return { snapshots: [] };
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as Partial<TrailFile>;
    return { snapshots: Array.isArray(raw.snapshots) ? raw.snapshots : [] };
  } catch {
    return { snapshots: [] };
  }
}

function persist(f: TrailFile): void {
  ensureDir();
  fs.writeFileSync(TMP_FILE, JSON.stringify(f, null, 2), 'utf8');
  fs.renameSync(TMP_FILE, DATA_FILE);
}

/**
 * Record a new snapshot, but only if the last snapshot is older than
 * `MIN_GAP_MS`. Returns true when a new row was actually written.
 */
export function snapshotIndex(value: number, note?: string): boolean {
  if (!Number.isFinite(value)) return false;
  const now = Date.now();
  const f = load();
  const last = f.snapshots[f.snapshots.length - 1];
  if (last && now - last.ts < MIN_GAP_MS) return false;
  f.snapshots.push({ ts: now, value, note });
  // Trim old + cap.
  f.snapshots = f.snapshots.filter((s) => now - s.ts <= MAX_AGE_MS);
  if (f.snapshots.length > MAX_POINTS) {
    f.snapshots = f.snapshots.slice(-MAX_POINTS);
  }
  persist(f);
  return true;
}

/** Read all snapshots within `windowMs` of now (oldest → newest). */
export function listSnapshots(windowMs: number): IndexSnapshot[] {
  const now = Date.now();
  const cutoff = now - windowMs;
  return load()
    .snapshots
    .filter((s) => s.ts >= cutoff)
    .sort((a, b) => a.ts - b.ts);
}

export function clearSnapshots(): void {
  persist({ snapshots: [] });
}
