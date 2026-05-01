/**
 * Compact "Used N in / M out · model" footer for AI section cards.
 *
 * Auto-suppressed when meta is null or shows the synthetic mock-mode meta
 * (totalTokens === 0 + model === 'mock'). Hover for the full detail
 * including cache hits/writes.
 */

import type { AIMeta } from '../data/types';

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
    </div>
  );
}
