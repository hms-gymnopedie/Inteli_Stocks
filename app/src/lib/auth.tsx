/**
 * Auth context — B5-AU
 *
 * AuthProvider + useAuth() hook.
 *
 * Two modes (discovered at mount via GET /api/auth/config):
 *
 *   LOCAL mode (config.url === null):
 *     - AuthProvider is a transparent no-op wrapper.
 *     - useAuth() always returns { user: null, mode: 'local', loading: false }.
 *     - No login screen is shown anywhere in the app.
 *     - Session/signIn/signOut are all harmless no-ops.
 *
 *   SUPABASE mode (config.url is a real URL):
 *     - Creates a Supabase browser client from the fetched url + anonKey.
 *     - Listens to onAuthStateChange so session is always current.
 *     - Exposes signIn / signUp / signOut helpers.
 *     - While loading, mode is 'loading' so the app can show a spinner.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AuthMode = 'loading' | 'local' | 'supabase';

export interface AuthState {
  user:    User | null;
  mode:    AuthMode;
  loading: boolean;
  /** Sign in with email + password. Throws on error. */
  signIn:  (email: string, password: string) => Promise<void>;
  /** Sign up with email + password. Throws on error. */
  signUp:  (email: string, password: string) => Promise<void>;
  /** Sign out. No-op in local mode. */
  signOut: () => Promise<void>;
}

export interface AuthConfig {
  url:     string | null;
  anonKey: string | null;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthState | null>(null);

// ─── Singleton Supabase browser client ───────────────────────────────────────

// Created once when config is first loaded; never recreated so React doesn't
// thrash subscriptions.
let _sbClient: SupabaseClient | null = null;

function getOrCreateClient(url: string, anonKey: string): SupabaseClient {
  if (!_sbClient) {
    _sbClient = createClient(url, anonKey, {
      auth: {
        persistSession:    true,
        autoRefreshToken:  true,
        detectSessionInUrl: true,
      },
    });
  }
  return _sbClient;
}

/** Exposed so fetchStatus.ts can call `supabase.auth.getSession()` without
 *  importing the AuthContext (avoids circular deps). */
export function getSupabaseClient(): SupabaseClient | null {
  return _sbClient;
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface AuthProviderProps { children: ReactNode }

export function AuthProvider({ children }: AuthProviderProps) {
  const [mode,    setMode]    = useState<AuthMode>('loading');
  const [user,    setUser]    = useState<User | null>(null);
  const [sbClient, setSbClient] = useState<SupabaseClient | null>(null);

  // ── Step 1: fetch /api/auth/config on mount ───────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/config')
      .then((r) => r.json() as Promise<AuthConfig>)
      .then((cfg) => {
        if (cancelled) return;
        if (!cfg.url || !cfg.anonKey) {
          // Local mode — no Supabase
          setMode('local');
          return;
        }
        // Supabase mode — create client + subscribe to auth events
        const sb = getOrCreateClient(cfg.url, cfg.anonKey);
        setSbClient(sb);

        // Get the initial session synchronously (returns from cache if available)
        void sb.auth.getSession().then(({ data }) => {
          if (cancelled) return;
          setUser(data.session?.user ?? null);
          setMode('supabase');
        });

        // Subscribe to future auth state changes
        const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
          if (cancelled) return;
          setUser(session?.user ?? null);
          setMode('supabase');
        });

        return () => { subscription.unsubscribe(); };
      })
      .catch(() => {
        if (!cancelled) setMode('local'); // fallback on network error
      });

    return () => { cancelled = true; };
  }, []);

  // ── Auth helpers ──────────────────────────────────────────────────────────

  const signIn = useCallback(async (email: string, password: string) => {
    if (!sbClient) return;
    const { error } = await sbClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, [sbClient]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!sbClient) return;
    const { error } = await sbClient.auth.signUp({ email, password });
    if (error) throw error;
  }, [sbClient]);

  const signOut = useCallback(async () => {
    if (!sbClient) return;
    const { error } = await sbClient.auth.signOut();
    if (error) throw error;
  }, [sbClient]);

  const value: AuthState = useMemo(
    () => ({
      user,
      mode,
      loading: mode === 'loading',
      signIn,
      signUp,
      signOut,
    }),
    [user, mode, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Outside the provider — return a safe local-mode default so components
    // that haven't been wrapped yet don't crash.
    return {
      user:    null,
      mode:    'local',
      loading: false,
      signIn:  async () => { /* no-op */ },
      signUp:  async () => { /* no-op */ },
      signOut: async () => { /* no-op */ },
    };
  }
  return ctx;
}
