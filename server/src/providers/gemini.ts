/**
 * Google Gemini provider — B2-AI2
 *
 * Mirrors the anthropic.ts API surface so providers/registry.ts can dispatch
 * uniformly. Uses the official `@google/genai` SDK.
 */

import { GoogleGenAI } from '@google/genai';

export const DEFAULT_MODEL = 'gemini-2.5-pro';

let _client: GoogleGenAI | undefined;

export function isConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function client(): GoogleGenAI {
  if (!_client) {
    if (!isConfigured()) {
      throw new Error(
        'Gemini client requested but GEMINI_API_KEY is not set.',
      );
    }
    _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }
  return _client;
}

/** Drop the cached client so the next call to client() rebuilds with the
 *  current GEMINI_API_KEY. Called by /api/settings/keys PUT. */
export function reset(): void {
  _client = undefined;
}
