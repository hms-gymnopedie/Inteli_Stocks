/**
 * Google OAuth + APIs provider — B5-GS
 *
 * Installed-app OAuth2 flow:
 *   1. UI calls GET /api/google/auth-url → redirects browser to Google consent
 *   2. Google redirects back to GET /api/google/callback?code=...
 *   3. Server exchanges code → tokens, persists to ~/.intelistock/google-token.json
 *   4. Subsequent calls use the saved refresh_token to mint fresh access tokens
 *
 * Two SDK clients are needed:
 *   - sheets (v4) — read/write spreadsheet values
 *   - drive  (v3) — to fetch spreadsheet metadata (title, webViewLink)
 *
 * Scope: spreadsheets is sufficient for both editing and creating spreadsheets
 * via the Sheets API (no separate Drive scope needed for our usage).
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { OAuth2Client } from 'google-auth-library';
import { google, type sheets_v4, type drive_v3 } from 'googleapis';

// ─── Constants ───────────────────────────────────────────────────────────────

const TOKEN_DIR  = path.join(os.homedir(), '.intelistock');
const TOKEN_FILE = path.join(TOKEN_DIR, 'google-token.json');

/**
 * Sheets scope only — covers create / read / write of any spreadsheet the
 * user can access. We don't need full Drive (`drive`) or even `drive.file`
 * because Sheets API can create new spreadsheets directly.
 */
export const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

/**
 * The OAuth callback runs against the local Express server, not the Vite
 * dev server, because Google's redirect URI must match exactly what's
 * registered in the Google Cloud Console.
 */
export const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI?.trim() ||
  'http://localhost:3001/api/google/callback';

// ─── Persistence ────────────────────────────────────────────────────────────

interface SavedTokens {
  access_token?:  string | null;
  refresh_token?: string | null;
  scope?:         string;
  token_type?:    string | null;
  expiry_date?:   number | null;
  id_token?:      string | null;
}

function ensureDir(): void {
  if (!fs.existsSync(TOKEN_DIR)) fs.mkdirSync(TOKEN_DIR, { recursive: true });
}

function readSavedTokens(): SavedTokens | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')) as SavedTokens;
  } catch {
    return null;
  }
}

function writeSavedTokens(t: SavedTokens): void {
  ensureDir();
  const tmp = `${TOKEN_FILE}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(t, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, TOKEN_FILE);
}

function deleteSavedTokens(): void {
  try { if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE); } catch { /* ignore */ }
}

// ─── OAuth client (lazy singleton) ──────────────────────────────────────────

let _oauth: OAuth2Client | undefined;

/** True when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are present in env. */
export function isConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}

/** True when a refresh_token has been saved (i.e. user completed OAuth). */
export function isConnected(): boolean {
  const t = readSavedTokens();
  return Boolean(t?.refresh_token);
}

/**
 * Returns the OAuth2 client. Throws if env vars aren't set; always guard with
 * isConfigured() first. The returned client has saved tokens loaded if any.
 *
 * The client auto-refreshes its access_token using the saved refresh_token,
 * and we listen for the `tokens` event to persist any updated values.
 */
export function oauthClient(): OAuth2Client {
  if (!_oauth) {
    if (!isConfigured()) {
      throw new Error(
        'Google client requested but GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set.',
      );
    }
    _oauth = new OAuth2Client({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri:  REDIRECT_URI,
    });

    const saved = readSavedTokens();
    if (saved) _oauth.setCredentials(saved);

    // Auto-persist refreshed tokens.
    _oauth.on('tokens', (newTokens) => {
      const merged = { ...(readSavedTokens() ?? {}), ...newTokens };
      writeSavedTokens(merged);
    });
  }
  return _oauth;
}

/** Drop the singleton so the next call picks up new client_id/secret. */
export function reset(): void {
  _oauth = undefined;
}

// ─── OAuth helpers ──────────────────────────────────────────────────────────

/**
 * Generates a consent-screen URL. `access_type: 'offline'` + `prompt: 'consent'`
 * forces Google to issue a refresh_token even if the user has previously
 * granted consent (otherwise re-grants don't return one).
 */
export function getAuthUrl(state?: string): string {
  return oauthClient().generateAuthUrl({
    access_type:  'offline',
    prompt:       'consent',
    scope:        SCOPES,
    state:        state ?? '',
    include_granted_scopes: true,
  });
}

/**
 * Exchanges an authorization code for tokens and persists them.
 * Called by GET /api/google/callback.
 */
export async function handleCallback(code: string): Promise<void> {
  const c = oauthClient();
  const { tokens } = await c.getToken(code);
  c.setCredentials(tokens);
  // First-time OAuth: tokens.refresh_token is set. Persist everything.
  writeSavedTokens(tokens);
}

/** Disconnect: revokes the refresh token (best-effort) and deletes local file. */
export async function disconnect(): Promise<void> {
  try {
    if (isConfigured() && isConnected()) {
      await oauthClient().revokeCredentials().catch(() => { /* ignore */ });
    }
  } finally {
    deleteSavedTokens();
    _oauth = undefined;
  }
}

// ─── API client factories ───────────────────────────────────────────────────

/** Returns an authenticated Sheets v4 client. Caller must isConnected(). */
export function sheetsClient(): sheets_v4.Sheets {
  return google.sheets({ version: 'v4', auth: oauthClient() });
}

/** Returns an authenticated Drive v3 client (used for spreadsheet metadata). */
export function driveClient(): drive_v3.Drive {
  return google.drive({ version: 'v3', auth: oauthClient() });
}
