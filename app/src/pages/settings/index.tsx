/**
 * /settings — local-only configuration page.
 *
 * Sections:
 *   1. API keys     — Anthropic / Gemini / FRED. Type=password inputs;
 *                     submit calls PUT /api/settings/keys which rewrites
 *                     the .env file at repo root and resets provider
 *                     singletons so changes take effect without restart.
 *   2. Data export  — download portfolio.json and holdings.csv.
 *   3. Refresh      — Off / 30 s / 1 m / 5 m / 10 m / 30 m / 1 h.
 *   4. Other tweaks — chart, map, layout/locale (mirrors the corner FAB).
 */

import { useEffect, useState } from 'react';

import { getModels } from '../../data/ai';
import type { AIModelsResponse, AIProvider } from '../../data/types';
import { PRICING, formatUSD, sampleCallCost } from '../../lib/aiPricing';
import { useTweaks } from '../../lib/tweaks';
import { useAuth } from '../../lib/auth';

// ─── Section 1: API keys ─────────────────────────────────────────────────────

const KEY_DEFS: { id: string; label: string; help?: string }[] = [
  { id: 'ANTHROPIC_API_KEY', label: 'Anthropic',     help: 'sk-ant-…' },
  { id: 'GEMINI_API_KEY',    label: 'Google Gemini', help: 'aistudio.google.com/app/apikey' },
  { id: 'FRED_API_KEY',      label: 'FRED (CPI)',    help: 'fred.stlouisfed.org/docs/api/api_key.html' },
];

interface KeyStatus {
  ok: boolean;
  keys: Record<string, boolean>;
  envPath?: string;
}

function ApiKeysSection() {
  const [status, setStatus]   = useState<KeyStatus | null>(null);
  const [drafts, setDrafts]   = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadStatus(): Promise<void> {
    try {
      const r = await fetch('/api/settings/keys/status');
      const j = (await r.json()) as KeyStatus;
      setStatus({ ...j, ok: true });
    } catch {
      setStatus({ ok: false, keys: {} });
    }
  }

  useEffect(() => { void loadStatus(); }, []);

  async function save(): Promise<void> {
    const updates: Record<string, string> = {};
    for (const k of Object.keys(drafts)) {
      if (drafts[k] !== '') updates[k] = drafts[k];
    }
    if (Object.keys(updates).length === 0) {
      setMessage('Nothing to save — fields are empty.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const r = await fetch('/api/settings/keys', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(updates),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as KeyStatus;
      setStatus({ ...j, ok: true });
      setDrafts({});
      setMessage('Saved · provider clients reset · effective immediately.');
    } catch (e) {
      setMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function clearKey(id: string): Promise<void> {
    setSaving(true);
    setMessage(null);
    try {
      const r = await fetch('/api/settings/keys', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [id]: '' }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as KeyStatus;
      setStatus({ ...j, ok: true });
      setMessage(`Cleared ${id}.`);
    } catch (e) {
      setMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section-h">API Keys</h2>
      <p className="settings-section-desc">
        Stored in <code>.env</code> at repo root (
        <span className="muted">600-mode, gitignored</span>). Inputs are
        masked. Saving rewrites the file and resets the in-process clients —
        no server restart needed.
      </p>
      <div className="settings-keys">
        {KEY_DEFS.map((k) => {
          const configured = status?.keys[k.id] ?? false;
          const draft      = drafts[k.id] ?? '';
          return (
            <div key={k.id} className="settings-key-row">
              <div className="settings-key-meta">
                <div className="settings-key-label">
                  {k.label}
                  <span
                    className={`settings-key-badge ${configured ? 'on' : 'off'}`}
                  >
                    {configured ? '● configured' : '○ unset'}
                  </span>
                </div>
                {k.help && <div className="settings-key-help">{k.help}</div>}
              </div>
              <div className="settings-key-input">
                <input
                  type="password"
                  value={draft}
                  placeholder={configured ? '•••• enter to replace ••••' : 'paste key…'}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [k.id]: e.target.value }))
                  }
                  autoComplete="off"
                  spellCheck={false}
                />
                {configured && (
                  <button
                    type="button"
                    onClick={() => void clearKey(k.id)}
                    disabled={saving}
                    className="settings-btn-danger"
                    title="Remove this key from .env"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="settings-actions">
        <button
          type="button"
          className="settings-btn-primary"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {message && <span className="settings-msg">{message}</span>}
      </div>
      {status?.envPath && (
        <div className="settings-foot">
          envPath: <code>{status.envPath}</code>
        </div>
      )}
    </section>
  );
}

// ─── Section 2: Data export ─────────────────────────────────────────────────

function DataExportSection() {
  return (
    <section className="settings-section">
      <h2 className="settings-section-h">Data Export</h2>
      <p className="settings-section-desc">
        Download a copy of your local portfolio store. Data lives at{' '}
        <code>~/.intelistock/portfolio.json</code>.
      </p>
      <div className="settings-actions" style={{ flexWrap: 'wrap' }}>
        <a
          href="/api/settings/export/portfolio.json"
          className="settings-btn-link"
          download="portfolio.json"
        >
          Portfolio · JSON
        </a>
        <a
          href="/api/settings/export/holdings.csv"
          className="settings-btn-link"
          download="holdings.csv"
        >
          Holdings · CSV
        </a>
      </div>
    </section>
  );
}

// ─── Section 3: Refresh interval ────────────────────────────────────────────

const REFRESH_OPTIONS: { label: string; ms: number }[] = [
  { label: 'Off',    ms: 0          },
  { label: '30 s',   ms: 30   * 1000 },
  { label: '1 m',    ms: 60   * 1000 },
  { label: '5 m',    ms: 300  * 1000 },
  { label: '10 m',   ms: 600  * 1000 },
  { label: '30 m',   ms: 1800 * 1000 },
  { label: '1 h',    ms: 3600 * 1000 },
];

function RefreshSection() {
  const { values, setTweak } = useTweaks();
  return (
    <section className="settings-section">
      <h2 className="settings-section-h">Refresh Interval</h2>
      <p className="settings-section-desc">
        How often live-data fetchers (indices, macro, holdings, equity curve,
        etc.) re-poll. Static data (filings, peers, profile) ignores this.
        Polling pauses while the tab is hidden.
      </p>
      <div className="settings-radio-row">
        {REFRESH_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            type="button"
            className={`settings-radio ${
              values.refreshInterval === opt.ms ? 'active' : ''
            }`}
            onClick={() => setTweak('refreshInterval', opt.ms)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </section>
  );
}

// ─── Section: AI Models ─────────────────────────────────────────────────────

function AIModelsSection() {
  const { values, setTweak } = useTweaks();
  const [catalogue, setCatalogue] = useState<AIModelsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    getModels().then((cat) => {
      if (!cancelled) setCatalogue(cat);
    });
    return () => { cancelled = true; };
  }, []);

  // Active selection — fall back to backend's defaultProvider, then the
  // first provider listed in the catalogue, then 'gemini' as a last resort.
  const activeProvider: AIProvider =
    values.aiProvider ??
    catalogue?.defaultProvider ??
    catalogue?.providers[0]?.id ??
    'gemini';

  // Active model resolves through Tweaks → provider's `default: true` model
  // → first model in that provider's list.
  const activeProviderInfo = catalogue?.providers.find((p) => p.id === activeProvider);
  const providerDefaultModel =
    activeProviderInfo?.models.find((m) => m.default)?.id ??
    activeProviderInfo?.models[0]?.id ??
    '';
  const activeModel = values.aiModel ?? providerDefaultModel;

  function selectModel(provider: AIProvider, modelId: string): void {
    setTweak('aiProvider', provider);
    setTweak('aiModel', modelId);
  }

  function clearOverride(): void {
    setTweak('aiProvider', null);
    setTweak('aiModel', null);
  }

  return (
    <section className="settings-section settings-section--wide">
      <h2 className="settings-section-h">AI Models</h2>
      <p className="settings-section-desc">
        Choose which model handles AI calls (signals, insights, verdict,
        hedge). Pricing is per 1 M tokens; the per-call estimate uses a
        typical 600-input / 400-output payload from this dashboard. Models
        from providers without a key are disabled — set the key under
        <strong> API Keys</strong> first.
      </p>

      {!catalogue ? (
        <div className="settings-foot">Loading catalogue…</div>
      ) : (
        <>
          {catalogue.providers.map((p) => (
            <div key={p.id} className="ai-models-provider">
              <div className="ai-models-provider-h">
                <span>{p.label}</span>
                {p.configured ? (
                  <span className="settings-key-badge on">● configured</span>
                ) : (
                  <span className="settings-key-badge off">○ key not set</span>
                )}
              </div>
              <div className="ai-models-grid">
                {p.models.map((m) => {
                  const active = activeProvider === p.id && activeModel === m.id;
                  const pricing = PRICING[m.id];
                  const sample = sampleCallCost(m.id);
                  const disabled = !p.configured;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`ai-model-card ${active ? 'active' : ''}`}
                      onClick={() => selectModel(p.id, m.id)}
                      disabled={disabled}
                      aria-pressed={active}
                    >
                      <div className="ai-model-name">
                        {m.label}
                        {m.default && (
                          <span className="ai-model-tag default">DEFAULT</span>
                        )}
                        {pricing?.estimated && (
                          <span className="ai-model-tag preview">EST</span>
                        )}
                      </div>
                      <div className="ai-model-id">{m.id}</div>
                      {pricing ? (
                        <>
                          <div className="ai-model-pricing">
                            <span>${pricing.input}/M in</span>
                            <span className="muted">·</span>
                            <span>${pricing.output}/M out</span>
                          </div>
                          {sample != null && (
                            <div className="ai-model-sample">
                              ≈ {formatUSD(sample)} / call
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="ai-model-pricing muted">
                          pricing unknown
                        </div>
                      )}
                      {active && <span className="ai-model-badge">Active</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="settings-actions">
            <button
              type="button"
              onClick={clearOverride}
              className="settings-btn-link"
              title="Clear your override so the backend's default takes effect"
            >
              Use backend default
            </button>
            <span className="settings-msg">
              Active: <code>{activeProvider}</code> ·{' '}
              <code>{activeModel || '—'}</code>
            </span>
          </div>
        </>
      )}
    </section>
  );
}

// ─── Section 4: Other tweaks ────────────────────────────────────────────────

function OtherTweaksSection() {
  const { values, setTweak, reset } = useTweaks();

  function radio<T extends string | number>(
    label: string,
    field: keyof typeof values,
    options: { label: string; value: T }[],
  ) {
    return (
      <div className="settings-tw-row">
        <span className="settings-tw-label">{label}</span>
        <div className="settings-radio-row">
          {options.map((o) => (
            <button
              key={String(o.value)}
              type="button"
              className={`settings-radio ${
                values[field] === o.value ? 'active' : ''
              }`}
              onClick={() => setTweak(field, o.value as never)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="settings-section settings-section--wide">
      <h2 className="settings-section-h">Display Tweaks</h2>
      <p className="settings-section-desc">
        These mirror the corner Tweaks panel — adjust here for a roomier view.
      </p>

      {radio('Chart style', 'chartStyle', [
        { label: 'Line',   value: 'line'   },
        { label: 'Candle', value: 'candle' },
        { label: 'Area',   value: 'area'   },
      ])}

      {radio('Map style', 'mapStyle', [
        { label: 'Sat',  value: 'satellite' },
        { label: 'Terr', value: 'terrain'   },
        { label: 'Mono', value: 'mono'      },
      ])}

      {radio('Density', 'density', [
        { label: 'Compact',  value: 'compact'     },
        { label: 'Comfort',  value: 'comfortable' },
        { label: 'Spacious', value: 'spacious'    },
      ])}

      {radio('Timezone', 'timezone', [
        { label: 'NYC',    value: 'America/New_York' },
        { label: 'Seoul',  value: 'Asia/Seoul'       },
        { label: 'UTC',    value: 'UTC'              },
        { label: 'London', value: 'Europe/London'    },
      ])}

      {radio('Locale', 'locale', [
        { label: 'en-US', value: 'en-US' },
        { label: 'ko-KR', value: 'ko-KR' },
      ])}

      {radio('Currency', 'currency', [
        { label: 'USD', value: 'USD' },
        { label: 'KRW', value: 'KRW' },
        { label: 'EUR', value: 'EUR' },
        { label: 'JPY', value: 'JPY' },
      ])}

      <div className="settings-tw-row">
        <span className="settings-tw-label">Show grid</span>
        <button
          type="button"
          className={`settings-radio ${values.showGrid ? 'active' : ''}`}
          onClick={() => setTweak('showGrid', !values.showGrid)}
        >
          {values.showGrid ? 'On' : 'Off'}
        </button>
      </div>

      <div className="settings-tw-row">
        <span className="settings-tw-label">Accent</span>
        <input
          type="color"
          className="tw-color"
          value={values.accent}
          onChange={(e) => setTweak('accent', e.target.value)}
        />
      </div>

      <div className="settings-actions">
        <button
          type="button"
          onClick={reset}
          className="settings-btn-danger"
          title="Reset all Display Tweaks (chart/map/density/locale/accent/grid)"
        >
          Reset to defaults
        </button>
      </div>
    </section>
  );
}

// ─── Section 5: Supabase ─────────────────────────────────────────────────────

/**
 * Shows Supabase connection state + sign-out button.
 *
 * Three display states:
 *   loading  — still fetching /api/auth/config (hide section entirely).
 *   local    — Supabase not configured; show setup instructions.
 *   supabase — configured; show URL, current user, sign-out button.
 */
function SupabaseSection() {
  const { mode, user, signOut } = useAuth();

  // Fetch the public config so we can show the project URL
  const [url,     setUrl]     = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (mode !== 'supabase') return;
    void fetch('/api/auth/config')
      .then((r) => r.json() as Promise<{ url: string | null }>)
      .then((cfg) => setUrl(cfg.url ?? null))
      .catch(() => { /* ignore */ });
  }, [mode]);

  // Don't render while still loading
  if (mode === 'loading') return null;

  return (
    <section className="settings-section">
      <h2 className="settings-section-h">Supabase</h2>

      {mode === 'local' ? (
        <>
          <p className="settings-section-desc">
            <span className="settings-key-badge off">○ not configured</span>{' '}
            The dashboard is running in <strong>local mode</strong> — portfolio
            data is stored at <code>~/.intelistock/portfolio.json</code> and no
            login is required.
          </p>
          <p className="settings-section-desc">
            To enable multi-device sync and authentication, set the following
            environment variables in your <code>.env</code> file and restart:
          </p>
          <pre className="settings-code">
{`SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=<public anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>`}
          </pre>
          <p className="settings-section-desc">
            Then apply the migration in{' '}
            <code>server/migrations/001_portfolios.sql</code> via the Supabase
            SQL editor. See <code>server/migrations/README.md</code> for details.
          </p>
        </>
      ) : (
        <>
          <p className="settings-section-desc">
            <span className="settings-key-badge on">● configured</span>{' '}
            Connected to Supabase. Portfolio data is synced per user.
          </p>
          {url && (
            <div className="settings-foot">
              Project URL: <code>{url}</code>
            </div>
          )}
          {user ? (
            <div className="settings-tw-row" style={{ marginTop: '0.75rem' }}>
              <span className="settings-tw-label">
                Signed in as{' '}
                <code>{user.email ?? user.id}</code>
              </span>
              <button
                type="button"
                className="settings-btn-danger"
                disabled={signing}
                onClick={() => {
                  setSigning(true);
                  void signOut().finally(() => setSigning(false));
                }}
              >
                {signing ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          ) : (
            <p className="settings-section-desc muted">
              Not signed in.{' '}
              <a href="/login" className="auth-link">Sign in</a>
            </p>
          )}
        </>
      )}
    </section>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function Settings() {
  return (
    <div className="settings-page">
      <header className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-sub">
          Local configuration · API keys persist to{' '}
          <code>.env</code> · all changes take effect immediately.
        </p>
      </header>
      <div className="settings-grid">
        <ApiKeysSection />
        <DataExportSection />
        <RefreshSection />
        <AIModelsSection />
        <OtherTweaksSection />
        <SupabaseSection />
      </div>
    </div>
  );
}
