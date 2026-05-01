/**
 * Login / Sign-up page — B5-AU
 *
 * Routes: /login  (default: sign-in form)
 *         /signup (opens with sign-up toggle active)
 *
 * Features:
 *   - email + password form with toggle between Sign in / Sign up.
 *   - Submits via useAuth().signIn / signUp.
 *   - On success, navigates to /overview.
 *   - Accessible: label-input pairs, ARIA live error region, focus-visible rings.
 *   - Only rendered in Supabase mode; local mode redirects away (App.tsx logic).
 */

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';

type AuthTab = 'signin' | 'signup';

export function Login() {
  const { signIn, signUp } = useAuth();
  const navigate           = useNavigate();

  const [tab,      setTab]      = useState<AuthTab>('signin');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (tab === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      void navigate('/overview', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand */}
        <div className="auth-brand">
          <span className="brand-dot" />
          <span>InteliStock</span>
        </div>

        {/* Tab toggle */}
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'signin'}
            className={`auth-tab ${tab === 'signin' ? 'active' : ''}`}
            onClick={() => { setTab('signin'); setError(null); }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'signup'}
            className={`auth-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => { setTab('signup'); setError(null); }}
          >
            Sign up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => { void handleSubmit(e); }} noValidate>
          <div className="auth-field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              spellCheck={false}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
              required
              placeholder={tab === 'signup' ? 'min. 6 characters' : ''}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </div>

          {/* ARIA live error region */}
          {error && (
            <div role="alert" className="auth-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={busy || !email || !password}
          >
            {busy
              ? (tab === 'signin' ? 'Signing in…' : 'Creating account…')
              : (tab === 'signin' ? 'Sign in'      : 'Create account')}
          </button>
        </form>

        <p className="auth-foot">
          {tab === 'signin'
            ? <>No account? <button type="button" className="auth-link" onClick={() => { setTab('signup'); setError(null); }}>Sign up</button></>
            : <>Have an account? <button type="button" className="auth-link" onClick={() => { setTab('signin'); setError(null); }}>Sign in</button></>
          }
        </p>
      </div>
    </div>
  );
}
