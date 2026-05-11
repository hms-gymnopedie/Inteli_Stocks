/**
 * Google News RSS reader — B33.
 *
 * Free + no-key source of real, recent news headlines per topic.
 * Used by /api/geo/region/:label to surface actual events instead of
 * the hardcoded FALLBACK_REGION_DETAIL strings.
 *
 * Endpoint:
 *   https://news.google.com/rss/search?q=<query>&hl=en-US&gl=US&ceid=US:en
 *
 * Caveat: Google permits the feed for "personal, non-commercial use" only —
 * fits InteliStock's single-user-local-dashboard model.
 */

import { TTLCache } from '../lib/cache.js';

export interface NewsItem {
  /** YYYY-MM-DD parsed from RSS pubDate. */
  date:     string;
  /** Article title with the " - SourceName" suffix removed. */
  headline: string;
  /** Source name detected from the title suffix (e.g. "Reuters"). */
  source:   string;
}

// 1h TTL per (query) — news doesn't change every minute, GDELT-like quotas
// favor caching, and we're not paginating.
const _cache = new TTLCache<NewsItem[]>(60 * 60 * 1000);

const FEED_BASE = 'https://news.google.com/rss/search';

/**
 * Fetch up to `max` recent headlines for a free-text query. Returns []
 * on any error (timeout / parse fail) so callers can fall back to a
 * static template without breaking the page.
 */
export async function fetchNews(query: string, max = 8): Promise<NewsItem[]> {
  const cacheKey = `${query}|${max}`;
  return _cache.get(cacheKey, async () => {
    const url =
      `${FEED_BASE}?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    try {
      const r = await fetchWithTimeout(url, 8_000);
      if (!r.ok) {
        console.warn(`[googleNews] HTTP ${r.status} for query=${query}`);
        return [];
      }
      const xml = await r.text();
      return parseItems(xml).slice(0, max);
    } catch (err) {
      console.warn(`[googleNews] fetch failed for query=${query}:`, (err as Error).message);
      return [];
    }
  });
}

// ─── XML parsing (regex — sufficient for Google's stable RSS shape) ──────────

const ITEM_RE     = /<item>([\s\S]*?)<\/item>/g;
const TITLE_RE    = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/;
const PUBDATE_RE  = /<pubDate>([\s\S]*?)<\/pubDate>/;
const SOURCE_RE   = /<source[^>]*>([\s\S]*?)<\/source>/;

function parseItems(xml: string): NewsItem[] {
  const out: NewsItem[] = [];
  for (const m of xml.matchAll(ITEM_RE)) {
    const block = m[1];
    const titleRaw    = TITLE_RE  .exec(block)?.[1] ?? '';
    const pubDateRaw  = PUBDATE_RE.exec(block)?.[1] ?? '';
    const sourceRaw   = SOURCE_RE .exec(block)?.[1] ?? '';
    if (!titleRaw || !pubDateRaw) continue;

    const decoded = decodeEntities(titleRaw).trim();
    // Google News titles usually end with " - Source Name". Split it off
    // so the headline reads cleanly + we get the source label for free.
    const dashIdx = decoded.lastIndexOf(' - ');
    const headline = dashIdx > 0 ? decoded.slice(0, dashIdx).trim() : decoded;
    const source =
      sourceRaw ? decodeEntities(sourceRaw).trim()
      : dashIdx > 0 ? decoded.slice(dashIdx + 3).trim()
      : '';

    const date = parseDate(pubDateRaw);
    if (!date) continue;

    out.push({ date, headline, source });
  }
  // Sort newest first (Google already sorts but be defensive).
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return out;
}

function parseDate(rfc822: string): string | null {
  const t = Date.parse(rfc822);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/** Decode the small set of HTML entities Google News actually emits. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// ─── Fetch with timeout (no AbortController polyfill needed in Node 18+) ────

function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  return fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'InteliStock/1.0 (+local)' } })
    .finally(() => clearTimeout(timer));
}
