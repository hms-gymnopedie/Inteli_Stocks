/**
 * /api/settings/* — local-only settings, key management, and exports.
 *
 * NOTE: this hits the user's `.env` at repo root. Never expose this to a
 * public network — local MacBook host only (per §7 decision).
 */

import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import * as anthropic from '../providers/anthropic.js';
import * as gemini    from '../providers/gemini.js';
import * as fred      from '../providers/fred.js';
import * as finnhub   from '../providers/finnhub.js';
import * as googleAuth from '../providers/google.js';

export const settings = Router();

// ─── .env path & I/O ────────────────────────────────────────────────────────

// server/ runs from <repo>/server with cwd == server. .env lives at repo root.
const ENV_PATH = path.resolve(process.cwd(), '..', '.env');

const MANAGED_KEYS = [
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'FRED_API_KEY',
  'FINNHUB_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const;
type ManagedKey = (typeof MANAGED_KEYS)[number];

function readEnvFile(): string {
  try {
    return fs.readFileSync(ENV_PATH, 'utf8');
  } catch {
    return ''; // not yet created
  }
}

/**
 * Returns a NEW .env content string with the given updates applied.
 * - Preserves all unrelated lines / comments.
 * - Replaces existing key=value lines in place.
 * - Appends new keys at the end if previously absent.
 */
function applyEnvUpdates(
  current: string,
  updates: Partial<Record<ManagedKey, string>>,
): string {
  const lines = current ? current.split('\n') : [];
  const seen = new Set<ManagedKey>();
  const updated = lines.map((line) => {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!m) return line;
    const key = m[1] as ManagedKey;
    if (!(key in updates)) return line;
    seen.add(key);
    return `${key}=${updates[key] ?? ''}`;
  });
  for (const k of MANAGED_KEYS) {
    if (k in updates && !seen.has(k)) {
      updated.push(`${k}=${updates[k] ?? ''}`);
    }
  }
  // Trim trailing blank duplicates but ensure final newline.
  const joined = updated.join('\n').replace(/\n{3,}$/, '\n\n');
  return joined.endsWith('\n') ? joined : joined + '\n';
}

function writeEnvAtomic(content: string): void {
  const tmp = `${ENV_PATH}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, ENV_PATH);
}

// ─── GET /keys/status ───────────────────────────────────────────────────────

settings.get('/keys/status', (_req, res) => {
  res.json({
    keys: {
      ANTHROPIC_API_KEY:    anthropic.isConfigured(),
      GEMINI_API_KEY:       gemini.isConfigured(),
      FRED_API_KEY:         fred.isConfigured(),
      FINNHUB_API_KEY:      finnhub.isConfigured(),
      GOOGLE_CLIENT_ID:     Boolean(process.env.GOOGLE_CLIENT_ID?.trim()),
      GOOGLE_CLIENT_SECRET: Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim()),
    },
    envPath: ENV_PATH,
  });
});

// ─── PUT /keys ──────────────────────────────────────────────────────────────

/**
 * Body: { ANTHROPIC_API_KEY?: string; GEMINI_API_KEY?: string; FRED_API_KEY?: string }
 *
 * Empty string clears a key. Missing keys are left untouched.
 * Updates `process.env` in-place AND writes the .env file so changes
 * take effect immediately for new SDK calls (provider singletons are
 * reset so the next client() call picks up the new key).
 */
settings.put('/keys', (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const updates: Partial<Record<ManagedKey, string>> = {};
  for (const k of MANAGED_KEYS) {
    if (k in body) {
      const v = body[k];
      if (typeof v !== 'string') {
        return res.status(400).json({ ok: false, reason: `bad_value_${k}` });
      }
      updates[k] = v.trim();
    }
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ ok: false, reason: 'no_keys_provided' });
  }

  try {
    // Persist to .env first.
    const current = readEnvFile();
    const next = applyEnvUpdates(current, updates);
    writeEnvAtomic(next);

    // Apply in-process so new requests use the new keys without server restart.
    for (const [k, v] of Object.entries(updates)) {
      if (v) process.env[k] = v;
      else delete process.env[k];
    }

    // Reset provider singletons so the next client() call rebuilds with the
    // fresh key (or throws cleanly if the key was cleared).
    anthropic.reset();
    gemini.reset();
    fred.reset();
    finnhub.reset();
    googleAuth.reset();

    return res.json({
      ok: true,
      keys: {
        ANTHROPIC_API_KEY:    anthropic.isConfigured(),
        GEMINI_API_KEY:       gemini.isConfigured(),
        FRED_API_KEY:         fred.isConfigured(),
        FINNHUB_API_KEY:      finnhub.isConfigured(),
        GOOGLE_CLIENT_ID:     Boolean(process.env.GOOGLE_CLIENT_ID?.trim()),
        GOOGLE_CLIENT_SECRET: Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim()),
      },
    });
  } catch (err) {
    console.error('[settings/keys PUT]', err);
    return res
      .status(500)
      .json({ ok: false, reason: 'env_write_failed', detail: String(err) });
  }
});

// ─── GET /export/portfolio.json ─────────────────────────────────────────────

settings.get('/export/portfolio.json', (_req, res) => {
  const file = path.join(os.homedir(), '.intelistock', 'portfolio.json');
  try {
    const data = fs.readFileSync(file, 'utf8');
    res.setHeader('Content-Type',        'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="portfolio.json"');
    res.send(data);
  } catch {
    res.status(404).json({ ok: false, reason: 'portfolio_not_initialised' });
  }
});

// ─── GET /export/holdings.csv ───────────────────────────────────────────────

interface CsvHolding {
  symbol: string; name: string; weight: string; price: string;
  dayPct: string; plPct: string; risk: number;
}

function escapeCsv(v: string): string {
  if (v.includes('"') || v.includes(',') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

settings.get('/export/holdings.csv', (_req, res) => {
  const file = path.join(os.homedir(), '.intelistock', 'portfolio.json');
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as { holdings?: CsvHolding[] };
    const rows: string[] = [
      ['symbol', 'name', 'weight', 'price', 'dayPct', 'plPct', 'risk'].join(','),
    ];
    for (const h of parsed.holdings ?? []) {
      rows.push(
        [
          h.symbol,
          escapeCsv(h.name),
          h.weight,
          h.price,
          h.dayPct,
          h.plPct,
          String(h.risk),
        ].join(','),
      );
    }
    res.setHeader('Content-Type',        'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="holdings.csv"');
    res.send(rows.join('\n') + '\n');
  } catch {
    res.status(404).json({ ok: false, reason: 'portfolio_not_initialised' });
  }
});
