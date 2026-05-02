/**
 * /api/google/* — Google OAuth + Drive Sync — B5-GS
 *
 * Endpoints:
 *   GET  /status                — connection status, spreadsheet info, last sync
 *   GET  /auth-url              — returns OAuth consent URL (UI opens in popup/tab)
 *   GET  /callback              — OAuth redirect target, exchanges code → tokens,
 *                                  redirects browser back to /settings
 *   POST /disconnect            — revokes tokens, clears spreadsheet config
 *   POST /spreadsheet/use       — set spreadsheet from URL or ID
 *   POST /spreadsheet/create    — create new spreadsheet, save its ID
 *   POST /spreadsheet/clear     — forget spreadsheet (keep OAuth tokens)
 *   POST /sync-now              — manual full-sync trigger
 *
 * NOTE: this hits the user's Google account — never expose to a public
 * network. Local MacBook host only (per §7 decision).
 */

import { Router, type Request, type Response } from 'express';
import * as google      from '../providers/google.js';
import { localStore }   from '../storage/local.js';
import { readConfig, writeConfig } from '../storage/config.js';
import {
  mirrorToSheets,
  createSpreadsheet,
  lookupSpreadsheet,
  extractSpreadsheetId,
} from '../storage/google-sheets.js';

export const googleRouter = Router();

// Where to send the browser after the OAuth callback finishes.
const APP_URL = process.env.GOOGLE_APP_URL?.trim() || 'http://localhost:5180/settings';

// ─── GET /status ─────────────────────────────────────────────────────────────

googleRouter.get('/status', (_req: Request, res: Response) => {
  const cfg = readConfig();
  res.json({
    configured:     google.isConfigured(),
    connected:      google.isConnected(),
    spreadsheetId:  cfg.spreadsheetId,
    spreadsheetUrl: cfg.spreadsheetUrl,
    lastSyncAt:     cfg.lastSyncAt,
    lastSyncError:  cfg.lastSyncError,
  });
});

// ─── GET /auth-url ───────────────────────────────────────────────────────────

googleRouter.get('/auth-url', (_req: Request, res: Response) => {
  if (!google.isConfigured()) {
    res.status(503).json({ ok: false, reason: 'oauth_client_not_configured' });
    return;
  }
  try {
    const url = google.getAuthUrl();
    res.json({ ok: true, url });
  } catch (err) {
    res.status(500).json({ ok: false, reason: 'auth_url_failed', detail: String(err) });
  }
});

// ─── GET /callback ───────────────────────────────────────────────────────────

/**
 * Google redirects the user's browser here after consent. We exchange the
 * one-shot `code` for tokens, persist them, then 302 the browser back to
 * the app's settings page. On error we render a tiny HTML page with the
 * message so the user isn't stranded.
 */
googleRouter.get('/callback', async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const oauthErr = typeof req.query.error === 'string' ? req.query.error : '';

  if (oauthErr) {
    res
      .status(400)
      .type('html')
      .send(`<h2>Google sign-in cancelled</h2><p>${escapeHtml(oauthErr)}</p>` +
            `<p><a href="${APP_URL}">Return to settings</a></p>`);
    return;
  }
  if (!code) {
    res.status(400).type('html').send(
      `<h2>Missing OAuth code</h2><p><a href="${APP_URL}">Return to settings</a></p>`,
    );
    return;
  }
  if (!google.isConfigured()) {
    res.status(503).type('html').send(
      `<h2>OAuth client not configured</h2>` +
      `<p>Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Settings first.</p>` +
      `<p><a href="${APP_URL}">Return to settings</a></p>`,
    );
    return;
  }

  try {
    await google.handleCallback(code);
    res.redirect(`${APP_URL}?google=connected`);
  } catch (err) {
    res
      .status(500)
      .type('html')
      .send(`<h2>OAuth callback failed</h2><pre>${escapeHtml(String(err))}</pre>` +
            `<p><a href="${APP_URL}">Return to settings</a></p>`);
  }
});

// ─── POST /disconnect ────────────────────────────────────────────────────────

googleRouter.post('/disconnect', async (_req: Request, res: Response) => {
  try {
    await google.disconnect();
    writeConfig({
      spreadsheetId: null,
      spreadsheetUrl: null,
      lastSyncAt: null,
      lastSyncError: null,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, reason: 'disconnect_failed', detail: String(err) });
  }
});

// ─── POST /spreadsheet/use ───────────────────────────────────────────────────

googleRouter.post('/spreadsheet/use', async (req: Request, res: Response) => {
  if (!google.isConnected()) {
    res.status(401).json({ ok: false, reason: 'not_connected' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const raw = typeof body.spreadsheet === 'string' ? body.spreadsheet : '';
  const id = extractSpreadsheetId(raw);
  if (!id) {
    res.status(400).json({ ok: false, reason: 'invalid_spreadsheet' });
    return;
  }
  try {
    const meta = await lookupSpreadsheet(id);
    const cfg = writeConfig({
      spreadsheetId: id,
      spreadsheetUrl: meta.spreadsheetUrl,
      lastSyncError: null,
    });
    res.json({ ok: true, title: meta.title, ...cfg });
  } catch (err) {
    res
      .status(500)
      .json({ ok: false, reason: 'lookup_failed', detail: String(err) });
  }
});

// ─── POST /spreadsheet/create ────────────────────────────────────────────────

googleRouter.post('/spreadsheet/create', async (_req: Request, res: Response) => {
  if (!google.isConnected()) {
    res.status(401).json({ ok: false, reason: 'not_connected' });
    return;
  }
  try {
    const created = await createSpreadsheet();
    const cfg = writeConfig({
      spreadsheetId: created.spreadsheetId,
      spreadsheetUrl: created.spreadsheetUrl,
      lastSyncError: null,
    });
    res.json({ ok: true, title: created.title, ...cfg });
  } catch (err) {
    res
      .status(500)
      .json({ ok: false, reason: 'create_failed', detail: String(err) });
  }
});

// ─── POST /spreadsheet/clear ─────────────────────────────────────────────────

googleRouter.post('/spreadsheet/clear', (_req: Request, res: Response) => {
  const cfg = writeConfig({
    spreadsheetId: null,
    spreadsheetUrl: null,
    lastSyncAt: null,
    lastSyncError: null,
  });
  res.json({ ok: true, ...cfg });
});

// ─── POST /sync-now ──────────────────────────────────────────────────────────

googleRouter.post('/sync-now', async (_req: Request, res: Response) => {
  try {
    const store = await localStore.read(null);
    const result = await mirrorToSheets(store);
    if (result.ok) {
      res.json({ ok: true, syncedAt: result.syncedAt });
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    res.status(500).json({ ok: false, reason: 'sync_failed', detail: String(err) });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
