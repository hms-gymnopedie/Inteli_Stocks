/**
 * Local file-backed portfolio storage — B5-CR
 *
 * Reads/writes ~/.intelistock/portfolio.json.
 * Implements `PortfolioStorage` so it can be swapped with the Supabase impl.
 * `userId` is ignored (the local file is single-user).
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { PortfolioStorage, PortfolioStore } from './types.js';
import { buildSeedData } from './seed.js';
import { mirrorToSheets } from './google-sheets.js';

const DATA_DIR  = path.join(os.homedir(), '.intelistock');
const DATA_FILE = path.join(DATA_DIR, 'portfolio.json');

export const localStore: PortfolioStorage = {
  async read(_userId: string | null): Promise<PortfolioStore> {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      if (!fs.existsSync(DATA_FILE)) {
        const seed = buildSeedData();
        fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), 'utf8');
        return seed;
      }
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as PortfolioStore;
    } catch {
      return buildSeedData();
    }
  },

  async write(_userId: string | null, data: PortfolioStore): Promise<void> {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[localStore] write failed:', err);
    }

    // Fire-and-forget Google Sheets mirror. Skipped silently when Google is
    // not configured / not connected / no spreadsheet selected. Errors are
    // logged inside mirrorToSheets and recorded in storage.json.lastSyncError.
    void mirrorToSheets(data).catch((err) => {
      console.error('[localStore] mirror error (unhandled):', err);
    });
  },
};
