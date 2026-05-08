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

/**
 * Extract a JSON value from a prose-wrapped response.
 *
 * Gemini with googleSearch grounding often prepends explanatory prose
 * ("The CNN Fear & Greed Index is currently…") before the JSON, even
 * when the prompt explicitly forbids it. Stripping markdown fences
 * isn't enough — we need to actually find the first '{' or '[' and
 * parse the matching closing brace, ignoring whatever comes before
 * or after.
 *
 * Returns the JSON substring (still as text) or '' when no JSON is found.
 */
function extractJSON(text: string): string {
  // Fast path: stripped output already starts with { or [
  const stripped = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i,     '')
    .replace(/```\s*$/,      '')
    .trim();
  if (stripped.startsWith('{') || stripped.startsWith('[')) {
    return stripped;
  }
  // Slow path: scan for the first '{' or '[' that opens a balanced JSON
  // value. Track string boundaries so braces inside string literals
  // don't fool the depth counter.
  for (let start = 0; start < stripped.length; start++) {
    const openCh = stripped[start];
    if (openCh !== '{' && openCh !== '[') continue;
    const closeCh = openCh === '{' ? '}' : ']';
    let depth = 0;
    let inStr = false;
    let esc   = false;
    for (let i = start; i < stripped.length; i++) {
      const ch = stripped[i];
      if (inStr) {
        if (esc)            { esc = false; continue; }
        if (ch === '\\')    { esc = true;  continue; }
        if (ch === '"')     { inStr = false; }
        continue;
      }
      if (ch === '"')       { inStr = true; continue; }
      if (ch === openCh)    { depth++; }
      else if (ch === closeCh) {
        depth--;
        if (depth === 0)    { return stripped.slice(start, i + 1); }
      }
    }
  }
  return '';
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
      const json = extractJSON(text);
      if (!json) {
        console.warn(`[gemini-grounded] no JSON found for ${opts.cacheKey} in: ${text.slice(0, 120)}…`);
        return null;
      }
      try {
        return JSON.parse(json) as T;
      } catch (err) {
        console.warn(
          `[gemini-grounded] JSON parse failed for ${opts.cacheKey}: ${(err as Error).message} — extracted: ${json.slice(0, 120)}…`,
        );
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
