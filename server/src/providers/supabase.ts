/**
 * Supabase provider — B5-AU / B5-CR
 *
 * Lazy singleton that initialises the Supabase Admin client (service-role key)
 * only when all three env vars are present.
 *
 * Graceful-degrade contract:
 *   - `isConfigured()` returns false when any required var is absent.
 *   - `client()` throws if called while `isConfigured()` is false (guards
 *     should always check first).
 *   - `reset()` clears the cached client so tests / settings-page key changes
 *     can force re-initialisation.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ─── Required environment variables ─────────────────────────────────────────

function getEnv(key: string): string {
  return process.env[key]?.trim() ?? '';
}

/** Returns true only when all three Supabase vars are set and non-empty. */
export function isConfigured(): boolean {
  return Boolean(
    getEnv('SUPABASE_URL') &&
    getEnv('SUPABASE_ANON_KEY') &&
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  );
}

// ─── Lazy singleton ──────────────────────────────────────────────────────────

// The service-role client bypasses Row Level Security — used server-side only.
// The anon key is never used here (it is served to the browser via /api/auth/config).
let _client: SupabaseClient | null = null;

/**
 * Returns the Supabase Admin (service-role) client.
 * Throws if `isConfigured()` is false.
 */
export function client(): SupabaseClient {
  if (!isConfigured()) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
  if (!_client) {
    _client = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: {
        // We're doing server-side JWT validation ourselves; don't need the
        // Supabase auth helpers to manage sessions on this side.
        persistSession:     false,
        autoRefreshToken:   false,
        detectSessionInUrl: false,
      },
    });
  }
  return _client;
}

/**
 * Clears the cached client so the next call to `client()` creates a fresh one.
 * Called by /api/settings/keys PUT when env vars are updated at runtime.
 */
export function reset(): void {
  _client = null;
}
