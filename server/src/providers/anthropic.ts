/**
 * Anthropic SDK provider — B2-AI
 *
 * Minimal wrapper around @anthropic-ai/sdk.
 * - `isConfigured()` guards all callers; routes return 503 when false.
 * - `client()` is a lazy singleton so we never construct the SDK without a key.
 * - Default model: claude-opus-4-7 (per PLAN.md §6 data-collection).
 *
 * Prompt-caching pattern (claude-api skill):
 *   Pass `cache_control: { type: 'ephemeral' }` on the last block of any
 *   stable system-prompt content block. The SDK forwards it to the API.
 *   Cache lifetime is ~5 min per Anthropic docs; breakeven ≥ 1024 tokens.
 */

import Anthropic from '@anthropic-ai/sdk';

export const DEFAULT_MODEL = 'claude-opus-4-7';

// Lazily constructed; undefined until first call to client().
let _client: Anthropic | undefined;

/**
 * Returns true when ANTHROPIC_API_KEY is present and non-empty.
 * All AI route handlers must call this first.
 */
export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/**
 * Returns the shared Anthropic client singleton.
 * Throws if the API key is absent — always guard with isConfigured() first.
 */
export function client(): Anthropic {
  if (!_client) {
    if (!isConfigured()) {
      throw new Error(
        'Anthropic client requested but ANTHROPIC_API_KEY is not set.',
      );
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return _client;
}
