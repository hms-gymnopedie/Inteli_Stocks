/**
 * Storage configuration — B5-GS
 *
 * Persists user-level storage settings outside the (gitignored) portfolio
 * data so they survive a portfolio reset. File: ~/.intelistock/storage.json
 *
 * Fields:
 *   spreadsheetId — Google Sheets ID for portfolio mirror, or null when
 *                   sync is not yet configured.
 *   spreadsheetUrl — convenience copy of webViewLink (for the UI link).
 *   lastSyncAt    — epoch ms of most recent successful Sheets push.
 *   lastSyncError — human-readable error string from the most recent push,
 *                   or null when the last push succeeded.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_DIR  = path.join(os.homedir(), '.intelistock');
const CONFIG_FILE = path.join(CONFIG_DIR, 'storage.json');

export interface StorageConfig {
  spreadsheetId:  string | null;
  spreadsheetUrl: string | null;
  lastSyncAt:     number | null;
  lastSyncError:  string | null;
}

const DEFAULT_CONFIG: StorageConfig = {
  spreadsheetId:  null,
  spreadsheetUrl: null,
  lastSyncAt:     null,
  lastSyncError:  null,
};

function ensureDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

export function readConfig(): StorageConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return { ...DEFAULT_CONFIG };
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) as Partial<StorageConfig>;
    return { ...DEFAULT_CONFIG, ...raw };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function writeConfig(patch: Partial<StorageConfig>): StorageConfig {
  ensureDir();
  const next = { ...readConfig(), ...patch };
  const tmp = `${CONFIG_FILE}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmp, CONFIG_FILE);
  return next;
}
