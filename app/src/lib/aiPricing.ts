/**
 * USD cost estimator for an LLM call.
 *
 * Pricing snapshot (per 1 M tokens) baked in below — last refreshed
 * 2026-05-01 against:
 *   - Anthropic: https://www.anthropic.com/pricing
 *   - Gemini AI Studio paid tier: https://ai.google.dev/pricing
 *   (NOT Vertex AI — those rates differ.)
 * Update PRICING when rates change. Estimates are approximate; **for
 * authoritative billing always check the provider console** — caching
 * tier discounts and free-tier rate limits can shift effective cost.
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

export interface ModelPricing {
  /** USD per 1 M input tokens (full price). */
  input: number;
  /** USD per 1 M output tokens. */
  output: number;
  /** USD per 1 M cached-read input tokens (Anthropic ~10% / Gemini ~25%). */
  cacheRead?: number;
  /** USD per 1 M cache-creation tokens (Anthropic only, ~+25% surcharge). */
  cacheWrite?: number;
  /** When true, the price is a placeholder (preview/unannounced model). */
  estimated?: boolean;
}

export const PRICING: Record<string, ModelPricing> = {
  // ── Anthropic Claude ──────────────────────────────────────────────────────
  'claude-opus-4-7':            { input: 15.00, output: 75.00, cacheRead: 1.50,  cacheWrite: 18.75 },
  'claude-sonnet-4-6':          { input:  3.00, output: 15.00, cacheRead: 0.30,  cacheWrite:  3.75 },
  'claude-haiku-4-5-20251001':  { input:  1.00, output:  5.00, cacheRead: 0.10,  cacheWrite:  1.25 },

  // ── Google Gemini 2.5 (AI Studio paid tier, mid-2025 GA pricing) ─────────
  // Pro tier flips above 200 k context (we ignore — almost all dashboard
  // calls are well under).
  // Flash and Flash-Lite were re-priced upward at GA — earlier preview
  // rates ($0.075 in / $0.30 out for Flash; $0.04 / $0.15 for Flash-Lite)
  // are NO LONGER current. These match ai.google.dev/pricing as of 2026-05.
  'gemini-2.5-pro':             { input:  1.25, output: 10.00, cacheRead: 0.3125 },
  'gemini-2.5-flash':           { input:  0.30, output:  2.50, cacheRead: 0.075  },
  'gemini-2.5-flash-lite':      { input:  0.10, output:  0.40, cacheRead: 0.025  },

  // ── Google Gemini 3.1 (preview) ──────────────────────────────────────────
  // Official pricing not yet announced — use 2.5 Flash-Lite as a
  // placeholder and surface "(est)" in the UI so the user knows.
  'gemini-3.1-flash-lite-preview': { input: 0.10, output: 0.40, cacheRead: 0.025, estimated: true },
};

/**
 * Returns the cost of a "typical" call for a given model — 600 input + 400
 * output tokens, no cache hits. Used by the Settings AI Models cards to
 * give a quick "how much per call" reference.
 */
export function sampleCallCost(modelId: string): number | null {
  const p = PRICING[modelId];
  if (!p) return null;
  return (600 * p.input + 400 * p.output) / 1_000_000;
}

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
 * Format a USD amount with magnitude-appropriate precision (B11-7).
 *   ≥ $1,000   → "$1.23k"     (compact)
 *   ≥ $1       → "$12.34"     (cents)
 *   ≥ $0.01    → "$0.0123"    (4 sig figs after dollar)
 *   ≥ $0.0001  → "$0.000165"  (typical per-call AI cost)
 *   smaller    → "<$0.0001"
 *   negative   → prepended typographic minus
 */
export function formatUSD(amount: number): string {
  if (amount === 0) return '$0';
  const sign = amount < 0 ? '−' : '';
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(2)}k`;
  if (abs >= 1)         return `${sign}$${abs.toFixed(2)}`;
  if (abs >= 0.01)      return `${sign}$${abs.toFixed(4)}`;
  if (abs >= 0.0001)    return `${sign}$${abs.toFixed(6)}`;
  if (abs > 0)          return '<$0.0001';
  return '$0';
}
