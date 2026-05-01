/**
 * /api/auth/* — B5-AU
 *
 * Endpoints:
 *   GET /api/auth/me     — returns current user + mode (local | supabase)
 *   GET /api/auth/config — returns the public anon key for the browser SDK
 *
 * Both endpoints are ALWAYS accessible (no auth gate) so the frontend can
 * determine the mode without needing credentials first.
 *
 * /api/auth/me uses `requireAuth` only to populate `req.user` when configured;
 * it intentionally does NOT return 401 on a missing/invalid token so the
 * browser can call it freely to detect the operating mode.
 */

import { Router, type Request, type Response } from 'express';
import * as supabase from '../providers/supabase.js';
import type { AuthUser } from '../auth.js';

export const auth = Router();

// ─── Types ───────────────────────────────────────────────────────────────────

interface MeResponse {
  user: AuthUser | null;
  mode: 'local' | 'supabase';
}

interface ConfigResponse {
  url:     string | null;
  anonKey: string | null;
}

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

/**
 * Returns `{ user, mode }`.
 *
 * mode = 'local'    → Supabase not configured; app works without auth.
 * mode = 'supabase' → Supabase is configured.
 *   - user = null if no / invalid Authorization header was sent.
 *   - user = { id, email } if a valid JWT was presented.
 *
 * The frontend calls this on startup to decide whether to show the login page.
 */
auth.get('/me', (req: Request, res: Response): void => {
  if (!supabase.isConfigured()) {
    const body: MeResponse = { user: null, mode: 'local' };
    res.json(body);
    return;
  }

  // In Supabase mode, attempt JWT validation but do NOT 401 — just reflect
  // whatever user is on the request (populated by requireAuth if mounted,
  // or undefined if this route is hit without the middleware).
  const existingUser = (req as Request & { user?: AuthUser | null }).user ?? null;

  // If the middleware was not yet applied to this route, try inline extraction.
  if (existingUser !== undefined) {
    // requireAuth already ran (called via app-level middleware path)
    const body: MeResponse = { user: existingUser, mode: 'supabase' };
    res.json(body);
    return;
  }

  // Inline JWT extraction (fallback when this route is not behind requireAuth)
  const authHeader = req.headers.authorization ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader);

  if (!match) {
    const body: MeResponse = { user: null, mode: 'supabase' };
    res.json(body);
    return;
  }

  void supabase
    .client()
    .auth.getUser(match[1])
    .then(({ data, error }) => {
      const user: AuthUser | null =
        !error && data.user
          ? { id: data.user.id, email: data.user.email ?? '' }
          : null;
      const body: MeResponse = { user, mode: 'supabase' };
      res.json(body);
    })
    .catch(() => {
      const body: MeResponse = { user: null, mode: 'supabase' };
      res.json(body);
    });
});

// ─── GET /api/auth/config ─────────────────────────────────────────────────────

/**
 * Returns the public Supabase configuration needed by the browser SDK.
 * The anon key is safe to expose; the service role key is NEVER included.
 *
 * When not configured, returns `{ url: null, anonKey: null }` so the frontend
 * can detect local mode without special-casing HTTP error codes.
 */
auth.get('/config', (_req: Request, res: Response): void => {
  if (!supabase.isConfigured()) {
    const body: ConfigResponse = { url: null, anonKey: null };
    res.json(body);
    return;
  }

  const body: ConfigResponse = {
    url:     process.env.SUPABASE_URL?.trim() ?? null,
    anonKey: process.env.SUPABASE_ANON_KEY?.trim() ?? null,
  };
  res.json(body);
});
