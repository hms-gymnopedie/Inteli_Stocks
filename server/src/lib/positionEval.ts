/**
 * Position trigger evaluator — B18-2.
 *
 * Walks every active rationale, fetches the current quote for its symbol,
 * tests each trigger, fires the matching one as a Slack notification,
 * and marks the rationale closed. Trailing stops bump their peakPrice
 * on every pass even when they don't fire.
 *
 * Idempotent: once a rationale's firedAt is set, the next pass ignores
 * it (no duplicate Slack messages).
 */

import { fetchQuotes } from '../providers/yahoo.js';
import * as slack from '../providers/slack.js';
import {
  listActive,
  markFired,
  updatePeak,
  type PositionRationale,
  type SellTrigger,
} from '../storage/positions.js';

export interface EvalResult {
  total:       number;
  fired:       number;
  notified:    number;
  symbols:     string[];
  errors:      string[];
}

export async function evalPositions(): Promise<EvalResult> {
  const active = listActive();
  if (active.length === 0) {
    return { total: 0, fired: 0, notified: 0, symbols: [], errors: [] };
  }

  const symbols = [...new Set(active.map((r) => r.symbol))];
  let quotes: Awaited<ReturnType<typeof fetchQuotes>>;
  try {
    quotes = await fetchQuotes(symbols);
  } catch (err) {
    return {
      total: active.length, fired: 0, notified: 0, symbols,
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qMap = new Map<string, any>(quotes.map((q: any) => [q.symbol, q]));

  let fired = 0;
  let notified = 0;
  const errors: string[] = [];

  for (const r of active) {
    const q = qMap.get(r.symbol);
    const px = q && typeof q.regularMarketPrice === 'number' ? q.regularMarketPrice : null;
    if (px == null) continue;

    // Bump trailing peak first — peak update should happen even when no
    // trigger fires, so trailing stops don't misfire on the next pass.
    if (px > r.entryPrice) {
      updatePeak(r.id, px);
    }

    const matched = matchTrigger(r, px);
    if (!matched) continue;

    markFired(r.id, matched);
    fired++;

    if (slack.isConfigured()) {
      try {
        await sendSellAlert(r, matched, px);
        notified++;
      } catch (err) {
        errors.push(`${r.symbol}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return { total: active.length, fired, notified, symbols, errors };
}

/** Return the first trigger that matches the current price, or null. */
function matchTrigger(r: PositionRationale, currentPrice: number): SellTrigger | null {
  const today = new Date().toISOString().slice(0, 10);
  for (const t of r.triggers) {
    switch (t.type) {
      case 'date':
        if (today >= t.date) return t;
        break;
      case 'absoluteAbove':
        if (currentPrice >= t.price) return t;
        break;
      case 'absoluteBelow':
        if (currentPrice <= t.price) return t;
        break;
      case 'pctFromBase': {
        const target = t.basePrice * (1 + t.pct / 100);
        if (t.pct >= 0 ? currentPrice >= target : currentPrice <= target) return t;
        break;
      }
      case 'trailingFromPeak': {
        // pct is signed (typically negative for stop-loss).
        const target = t.peakPrice * (1 + t.pct / 100);
        if (currentPrice <= target) return t;
        break;
      }
    }
  }
  return null;
}

async function sendSellAlert(
  r: PositionRationale,
  fired: SellTrigger,
  currentPrice: number,
): Promise<void> {
  const lines: string[] = [
    `*🔔 InteliStock sell signal — ${r.symbol}*`,
    `Trigger: ${describeTrigger(fired)} (matched at $${currentPrice.toFixed(2)})`,
    '',
    `*Why you bought:*`,
    `> ${r.reason}`,
    '',
    `Entry: $${r.entryPrice.toFixed(2)}  ·  P&L: ${pnlPct(r.entryPrice, currentPrice)}`,
    `Held: ${formatHeldDays(r.createdAt)}`,
  ];
  await slack.send({
    text: `Sell signal: ${r.symbol} hit ${describeTrigger(fired)}`,
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } }],
  });
}

function describeTrigger(t: SellTrigger): string {
  switch (t.type) {
    case 'date':              return `time-based (${t.date})`;
    case 'absoluteAbove':     return `price ≥ $${t.price.toFixed(2)}`;
    case 'absoluteBelow':     return `price ≤ $${t.price.toFixed(2)}`;
    case 'pctFromBase':       return `${t.pct >= 0 ? '+' : ''}${t.pct}% from base ($${t.basePrice.toFixed(2)})`;
    case 'trailingFromPeak':  return `trailing ${t.pct}% from peak ($${t.peakPrice.toFixed(2)})`;
  }
}

function pnlPct(entry: number, current: number): string {
  const pct = (current / entry - 1) * 100;
  return `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(2)}%`;
}

function formatHeldDays(createdAt: number): string {
  const days = Math.floor((Date.now() - createdAt) / (24 * 3600_000));
  if (days < 1)   return '<1 day';
  if (days === 1) return '1 day';
  if (days < 30)  return `${days} days`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'}`;
}
