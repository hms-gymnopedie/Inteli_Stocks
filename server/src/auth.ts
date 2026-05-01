/**
 * Auth middleware — B5-AU
 *
 * `requireAuth` is a thin Express middleware that runs on every /api/portfolio/*
 * request (and optionally other protected routes).
 *
 * Two modes — determined at request time by checking isConfigured():
 *
 *   LOCAL mode (SUPABASE_* vars absent):
 *     Sets `req.user = null`, calls `next()` unconditionally.
 *     The downstream route handler falls back to the local JSON file.
 *
 *   SUPABASE mode (all three vars present):
 *     Extracts the `Authorization: Bearer <jwt>` header.
 *     Verifies the JWT with the Supabase Admin client (`auth.getUser(token)`).
 *     On success: sets `req.user = { id, email }`, calls `next()`.
 *     On failure / missing header: returns HTTP 401 JSON.
 *
 * The `req.user` augmentation is declared via module augmentation below so
 * downstream handlers can import the type without a separate types file.
 */

import type { Request, Response, NextFunction } from 'express';
import * as supabase from './providers/supabase.js';

// ─── Request augmentation ────────────────────────────────────────────────────

export interface AuthUser {
  id:    string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** null in local mode; populated in Supabase mode after JWT verification */
      user: AuthUser | null;
    }
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // ── Local mode ───────────────────────────────────────────────────────────
  if (!supabase.isConfigured()) {
    req.user = null;
    next();
    return;
  }

  // ── Supabase mode ────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader);

  if (!match) {
    res.status(401).json({
      error: 'Missing or malformed Authorization header. Expected: Bearer <jwt>',
    });
    return;
  }

  const token = match[1];

  // Use the admin client's getUser() to validate the JWT server-side.
  // This call hits the Supabase auth endpoint and returns the user object
  // associated with the token, or an error if the token is invalid/expired.
  void supabase
    .client()
    .auth.getUser(token)
    .then(({ data, error }) => {
      if (error || !data.user) {
        res.status(401).json({
          error: error?.message ?? 'Invalid or expired token.',
        });
        return;
      }

      req.user = {
        id:    data.user.id,
        email: data.user.email ?? '',
      };
      next();
    })
    .catch((err: unknown) => {
      // Unexpected (network failure, etc.) — don't leak internals
      console.error('[auth] JWT validation error:', err);
      res.status(401).json({ error: 'Authentication failed.' });
    });
}
