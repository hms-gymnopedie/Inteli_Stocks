/**
 * USD cost estimator for an LLM call.
 *
 * Pricing snapshot (per 1 M tokens) baked in below. These rates change
 * occasionally — when they do, edit `PRICING`. Estimates are approximate;
 * for accurate billing always check the provider console.
 *
 * Anthropic billing model:
 *   - `usage.input_tokens` is the FRESH (non-cached) prompt portion.
 *   - `cache_read_input_tokens` is read at ~10% of normal input cost.
 *   - `cache_creation_input_tokens` is written at +25% surcharge.
 *
 * Gemini billing model:
 *   - `promptTokenCount` is the TOTAL prompt — `cachedContentTokenCount`
 *     is the cached portion *included* in that total. Cached portion is
 *     billed at ~25% of normal input cost; subtract it from the total to
 *     get the non-cached prompt that pays full rate.
 */

import type { AIMeta } from '../data/types';

interface ModelPricing {
  /** USD per 1 M input tokens (full price). */
  input: number;
  /** USD per 1 M output tokens. */
  output: number;
  /** USD per 1 M cached-read input tokens (Anthropic ~10% / Gemini ~25%). */
  cacheRead?: number;
  /** USD per 1 M cache-creation tokens (Anthropic only, ~+25% surcharge). */
  cacheWrite?: number;
}

const PRICING: Record<string, ModelPricing> = {
  // ── Anthropic Claude ──────────────────────────────────────────────────────
  'claude-opus-4-7':            { input: 15.00, output: 75.00, cacheRead: 1.50,  cacheWrite: 18.75 },
  'claude-sonnet-4-6':          { input:  3.00, output: 15.00, cacheRead: 0.30,  cacheWrite:  3.75 },
  'claude-haiku-4-5-20251001':  { input:  1.00, output:  5.00, cacheRead: 0.10,  cacheWrite:  1.25 },

  // ── Google Gemini 2.5 ────────────────────────────────────────────────────
  // Pro tier flips at 200 k context — we ignore that here (most calls in
  // this dashboard are well under). Pricing matches the AI Studio / Vertex
  // entry tier.
  'gemini-2.5-pro':             { input:  1.25, output: 10.00, cacheRead: 0.3125  },
  'gemini-2.5-flash':           { input:  0.075, output: 0.30, cacheRead: 0.01875 },
  'gemini-2.5-flash-lite':      { input:  0.04,  output: 0.15, cacheRead: 0.01    },
};

/**
 * Returns the estimated cost in USD for a single LLM response, or null when
 * the model isn't priced (e.g. the synthetic 'mock' model from offline
 * fallback).
 */
export function estimateCost(meta: AIMeta): number | null {
  const p = PRICING[meta.model];
  if (!p) return null;

  const u = meta.usage;
  let cents = 0;

  if (meta.provider === 'anthropic') {
    // Anthropic: cache reads/writes are reported separately; input_tokens
    // is the non-cached portion.
    cents += u.inputTokens * p.input;
    cents += (u.cachedReadTokens  ?? 0) * (p.cacheRead  ?? p.input);
    cents += (u.cachedWriteTokens ?? 0) * (p.cacheWrite ?? p.input);
    cents += u.outputTokens * p.output;
  } else {
    // Gemini: cachedContentTokenCount is INSIDE promptTokenCount; subtract.
    const cached = u.cachedReadTokens ?? 0;
    const uncached = Math.max(0, u.inputTokens - cached);
    cents += uncached * p.input;
    cents += cached * (p.cacheRead ?? p.input);
    cents += u.outputTokens * p.output;
  }

  return cents / 1_000_000;
}

/**
 * Format a USD amount compactly for the topbar / footer:
 *   ≥ $0.01    → "$0.0123"
 *   ≥ $0.0001  → "$0.000165"
 *   smaller    → "<$0.0001"
 */
export function formatUSD(amount: number): string {
  if (amount >= 0.01)   return `$${amount.toFixed(4)}`;
  if (amount >= 0.0001) return `$${amount.toFixed(6)}`;
  if (amount > 0)       return '<$0.0001';
  return '$0';
}
