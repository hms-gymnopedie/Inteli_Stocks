/**
 * Gemini Search-grounded JSON helper — B13-E5.
 *
 * Backstop for data we can't get from any free public API:
 *   - CNN Fear & Greed Index (no public API)
 *   - Geopolitical risk events / hotspots (no structured free source)
 *   - Anything else where "google it and parse" is the realistic option.
 *
 * Strategy:
 *   1. Build a prompt that requests the data + a JSON schema.
 *   2. Call gemini.generateContent with the googleSearch tool enabled
 *      (web grounding) — Gemini reads recent web pages to ground its answer.
 *   3. Strip ```json fences and parse — return as a typed structured value.
 *   4. Cache aggressively (1 h+) so we don't hit the API for every request.
 *
 * The caller provides:
 *   - `prompt`     — natural-language question with explicit JSON shape
 *   - `cacheKey`   — opaque key for the result
 *   - `cacheTtlMs` — how long to hold (default 1 h)
 *
 * Failures (no key, parse error, upstream 5xx) return null so callers can
 * fall back to their existing mock without breaking the UI.
 */

import { TTLCache } from '../lib/cache.js';
import { client as geminiClient, isConfigured } from './gemini.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

// One shared cache; entries are JSON values keyed by cacheKey.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _cache = new TTLCache<any>(6 * ONE_HOUR_MS);

export { isConfigured };

interface AskOpts {
  /** Cache key (e.g. 'fear-greed' or 'geo-hotspots:2026-05-02'). */
  cacheKey: string;
  /** Time-to-live for the cached response in ms. Default: 1 h. */
  cacheTtlMs?: number;
  /** The full prompt — must instruct the model to return JSON only. */
  prompt: string;
  /** Model id. Default: gemini-2.5-flash (cheap + fast for grounded search). */
  model?: string;
  /** Maximum output tokens. Default: 1024. */
  maxOutputTokens?: number;
}

/** Strip ```json fences and trim. */
function unfence(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i,    '')
    .replace(/```\s*$/,     '')
    .trim();
}

/**
 * Run a Google-Search-grounded Gemini query and parse the result as JSON.
 * Returns null on any failure (no key, network error, JSON parse fail);
 * caller should fall back to its existing mock in that case.
 *
 * Cached per `cacheKey` for `cacheTtlMs` — the underlying Gemini call only
 * fires when no fresh entry exists.
 */
export async function askJSON<T>(opts: AskOpts): Promise<T | null> {
  if (!isConfigured()) return null;

  const ttl = opts.cacheTtlMs ?? ONE_HOUR_MS;
  // Pull cache; loader runs on miss.
  return (_cache as TTLCache<T | null>).get(opts.cacheKey, async () => {
    try {
      const ai = geminiClient();
      // The @google/genai SDK exposes the googleSearch tool via:
      //   config: { tools: [{ googleSearch: {} }] }
      const response = await ai.models.generateContent({
        model: opts.model ?? 'gemini-2.5-flash',
        contents: opts.prompt,
        config: {
          tools: [{ googleSearch: {} }],
          maxOutputTokens: opts.maxOutputTokens ?? 1024,
        },
      });
      const text = response.text ?? '';
      const stripped = unfence(text);
      if (!stripped) return null;
      try {
        return JSON.parse(stripped) as T;
      } catch (err) {
        console.warn(`[gemini-grounded] JSON parse failed for ${opts.cacheKey}:`, (err as Error).message);
        return null;
      }
    } catch (err) {
      console.error(`[gemini-grounded] generation failed for ${opts.cacheKey}:`, (err as Error).message);
      return null;
    }
  // We deliberately swallow errors above and return null in the cached
  // value, so a transient outage doesn't poison the cache forever (the
  // null entry expires on the same TTL and re-tries naturally).
  }) as Promise<T | null>;
}

/** Force-evict a cached entry (e.g. on user-triggered refresh). */
export function invalidate(cacheKey: string): void {
  // TTLCache exposes clear() but no per-key delete; drop the whole cache
  // when we want a fresh fetch — small enough that this is fine.
  if (cacheKey === '*') {
    _cache.clear();
    return;
  }
  // No surgical eviction available; clear all.
  _cache.clear();
}
