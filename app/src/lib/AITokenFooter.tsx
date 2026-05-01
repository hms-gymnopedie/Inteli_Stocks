/**
 * Compact "Used N in / M out · model · ≈$cost" footer for AI section cards.
 *
 * Auto-suppressed when meta is null. Mock-mode meta renders as a faint
 * "mock fallback" line. Hover for the precise breakdown including cache
 * hits/writes and per-token-class spend.
 */

import type { AIMeta } from '../data/types';
import { estimateCost, formatUSD } from './aiPricing';

interface Props {
  meta: AIMeta | null;
}

function fmt(n: number): string {
  if (n < 1_000) return String(n);
  return `${(n / 1_000).toFixed(n < 10_000 ? 2 : 1)}k`;
}

export function AITokenFooter({ meta }: Props) {
  if (!meta) return null;
  if (meta.usage.totalTokens === 0 && meta.model === 'mock') {
    return (
      <div className="ai-token-footer mock" title="No real LLM call — mock fallback in use">
        mock fallback · 0 tokens
      </div>
    );
  }

  const u = meta.usage;
  const cachedPart = u.cachedReadTokens
    ? ` (${fmt(u.cachedReadTokens)} cached)`
    : '';
  const writePart = u.cachedWriteTokens
    ? ` · ${fmt(u.cachedWriteTokens)} cache-write`
    : '';
  const cost = estimateCost(meta);

  // Tooltip with the precise breakdown.
  const tooltip = [
    `provider: ${meta.provider}`,
    `model: ${meta.model}`,
    `input: ${u.inputTokens.toLocaleString()}`,
    `output: ${u.outputTokens.toLocaleString()}`,
    `total: ${u.totalTokens.toLocaleString()}`,
    u.cachedReadTokens != null
      ? `cache-read: ${u.cachedReadTokens.toLocaleString()}`
      : '',
    u.cachedWriteTokens != null
      ? `cache-write: ${u.cachedWriteTokens.toLocaleString()}`
      : '',
    cost != null
      ? `cost: ≈ ${formatUSD(cost)} (estimated, see lib/aiPricing.ts)`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="ai-token-footer" title={tooltip}>
      <span className="ai-token-numbers">
        {fmt(u.inputTokens)}{cachedPart} in · {fmt(u.outputTokens)} out
      </span>
      <span className="ai-token-divider">·</span>
      <span className="ai-token-model">{meta.model}</span>
      {writePart}
      {cost != null && (
        <>
          <span className="ai-token-divider">·</span>
          <span className="ai-token-cost">≈ {formatUSD(cost)}</span>
        </>
      )}
    </div>
  );
}
