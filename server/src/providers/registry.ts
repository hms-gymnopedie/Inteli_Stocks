/**
 * AI provider registry — B2-AI2
 *
 * Single dispatch point for all AI work. Routes call `generate()` with a
 * provider id and model id; this file decides which SDK to invoke.
 *
 * Adding a new provider:
 *   1. Create `providers/<name>.ts` exporting `isConfigured()`, `client()`.
 *   2. Add an entry to PROVIDERS below with its model list.
 *   3. Add a branch in `generate()` and (if needed) `defaultModelFor()`.
 */

import * as anthropic from './anthropic.js';
import * as gemini    from './gemini.js';

// ─── Public types ────────────────────────────────────────────────────────────

export type AIProvider = 'anthropic' | 'gemini';

export interface AIModelInfo {
  id: string;
  label: string;
  /** First `default: true` per provider becomes the fallback when no model is sent. */
  default?: boolean;
}

export interface AIProviderInfo {
  id: AIProvider;
  label: string;
  configured: boolean;
  models: AIModelInfo[];
}

export interface AIModelsResponse {
  providers: AIProviderInfo[];
  /** First configured provider, or null when none are. */
  defaultProvider: AIProvider | null;
}

// ─── Static catalogue ────────────────────────────────────────────────────────

interface ProviderEntry {
  id: AIProvider;
  label: string;
  models: AIModelInfo[];
}

const PROVIDERS: ProviderEntry[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    models: [
      { id: 'claude-opus-4-7',           label: 'Claude Opus 4.7',  default: true },
      { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6'                },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5'                 },
    ],
  },
  {
    id: 'gemini',
    label: 'Google',
    models: [
      { id: 'gemini-2.5-pro',        label: 'Gemini 2.5 Pro',        default: true },
      { id: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash'                      },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite'                 },
    ],
  },
];

// ─── Configuration ───────────────────────────────────────────────────────────

export function providerConfigured(id: AIProvider): boolean {
  if (id === 'anthropic') return anthropic.isConfigured();
  if (id === 'gemini')    return gemini.isConfigured();
  return false;
}

export function listProviders(): AIProviderInfo[] {
  return PROVIDERS.map((p) => ({
    id:         p.id,
    label:      p.label,
    configured: providerConfigured(p.id),
    models:     p.models,
  }));
}

export function getModelsResponse(): AIModelsResponse {
  const providers = listProviders();
  const first = providers.find((p) => p.configured);
  return { providers, defaultProvider: first?.id ?? null };
}

export function defaultModelFor(provider: AIProvider): string {
  const entry = PROVIDERS.find((p) => p.id === provider);
  return entry?.models.find((m) => m.default)?.id ?? entry?.models[0]?.id ?? '';
}

/** Validate a model id belongs to a provider; falls back to the provider's default. */
export function resolveModel(provider: AIProvider, requested?: string): string {
  if (!requested) return defaultModelFor(provider);
  const entry = PROVIDERS.find((p) => p.id === provider);
  const ok = entry?.models.some((m) => m.id === requested);
  return ok ? requested : defaultModelFor(provider);
}

// ─── Unified generate ────────────────────────────────────────────────────────

export interface GenerateOpts {
  provider:   AIProvider;
  model:      string;
  system:     string;
  user:       string;
  maxTokens?: number;
}

/**
 * Run an LLM call and return the text response.
 *
 * Anthropic: system block carries `cache_control: { type: 'ephemeral' }`
 * (claude-api skill pattern; ~5 min cache, ≥1024 tokens breakeven).
 *
 * Gemini: system + user are concatenated into a single content block. The
 * SDK auto-handles caching server-side for repeated identical prompts.
 */
export async function generate({
  provider,
  model,
  system,
  user,
  maxTokens = 1024,
}: GenerateOpts): Promise<string> {
  if (provider === 'anthropic') {
    const message = await anthropic.client().messages.create({
      model,
      max_tokens: maxTokens,
      system: [
        { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: user }],
    });
    const block = message.content[0];
    return block && block.type === 'text' ? block.text : '';
  }

  if (provider === 'gemini') {
    const response = await gemini.client().models.generateContent({
      model,
      contents: `${system}\n\n${user}`,
      config: { maxOutputTokens: maxTokens },
    });
    return response.text ?? '';
  }

  throw new Error(`Unknown AI provider: ${String(provider)}`);
}
