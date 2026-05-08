/**
 * CNN Fear & Greed direct fetch — B21-fix.
 *
 * CNN runs an unofficial JSON endpoint at
 *   https://production.dataviz.cnn.io/index/fearandgreed/graphdata
 * which their public dashboard at cnn.com/markets/fear-and-greed reads.
 * It needs browser-like headers (the server returns "I'm a teapot.
 * You're a bot." otherwise) but is otherwise straight JSON.
 *
 * Response shape (only the fields we care about):
 *   {
 *     "fear_and_greed": {
 *       "score":             67.97,        // current
 *       "rating":            "greed",
 *       "previous_close":    67.62,        // ~yesterday
 *       "previous_1_week":   66.08,
 *       "previous_1_month":  34.42,
 *       "previous_1_year":   57.65
 *     },
 *     "fear_and_greed_historical": {
 *       "data": [
 *         { "x": <epoch ms>, "y": <0-100 score>, "rating": "..." },
 *         ...                                    // ~3 years of daily values
 *       ]
 *     }
 *   }
 *
 * 6h TTL — CNN updates daily so anything tighter is wasted bandwidth.
 */

import { TTLCache } from '../lib/cache.js';

const URL = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
const SIX_HOURS = 6 * 60 * 60 * 1000;

interface CNNRaw {
  fear_and_greed: {
    score:            number;
    rating:           string;
    previous_close:   number;
    previous_1_week:  number;
    previous_1_month: number;
  };
  fear_and_greed_historical: {
    data: { x: number; y: number; rating?: string }[];
  };
}

export interface CNNResult {
  value:     number;
  label:     string;
  yesterday: number;
  oneWeek:   number;
  oneMonth:  number;
  daily:     { date: string; value: number }[];
}

const _cache = new TTLCache<CNNResult>(SIX_HOURS);

export async function fetchCNNFearGreed(): Promise<CNNResult> {
  return _cache.get('cnn-fg', async () => {
    const res = await fetch(URL, {
      headers: {
        // CNN gates the JSON behind a UA + Origin check. Use Chrome-like.
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept':          'application/json, text/plain, */*',
        'Origin':          'https://www.cnn.com',
        'Referer':         'https://www.cnn.com/markets/fear-and-greed',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) throw new Error(`CNN F&G ${res.status} ${res.statusText}`);
    const raw = (await res.json()) as CNNRaw;

    const head = raw.fear_and_greed;
    const hist = raw.fear_and_greed_historical?.data ?? [];

    // Take the last 30 entries — historical includes ~3 years.
    const daily = hist.slice(-30).map((p) => ({
      date:  new Date(p.x).toISOString().slice(0, 10),
      value: Math.round(p.y),
    }));

    return {
      value:     Math.round(head.score),
      label:     toLabel(head.rating, head.score),
      yesterday: Math.round(head.previous_close),
      oneWeek:   Math.round(head.previous_1_week),
      oneMonth:  Math.round(head.previous_1_month),
      daily,
    };
  });
}

/** CNN returns lowercase rating like "greed"; map to canonical capitalised. */
function toLabel(rating: string, score: number): string {
  const r = (rating ?? '').toLowerCase();
  if (r.includes('extreme fear'))  return 'Extreme Fear';
  if (r.includes('fear'))          return 'Fear';
  if (r.includes('extreme greed')) return 'Extreme Greed';
  if (r.includes('greed'))         return 'Greed';
  if (r.includes('neutral'))       return 'Neutral';
  // Defensive — derive from score.
  if (score < 25)  return 'Extreme Fear';
  if (score < 45)  return 'Fear';
  if (score < 55)  return 'Neutral';
  if (score < 75)  return 'Greed';
  return 'Extreme Greed';
}
