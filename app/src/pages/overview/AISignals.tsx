import { useEffect, useMemo, useState } from 'react';

import { getAIHistory, streamSignals } from '../../data/ai';
import type { AIMeta, AISignal } from '../../data/types';
import type { HistoryEntry } from '../../data/aiHistoryTypes';
import { AITokenFooter } from '../../lib/AITokenFooter';
import { formatTime } from '../../lib/format';
import { useTweaks } from '../../lib/tweaks';
import { useOnDemandStream } from '../../lib/useOnDemand';

/**
 * AI Assistant — on-demand. Click "Generate" to ask the configured AI
 * provider for fresh market signal cards. We deliberately do NOT auto-fetch
 * on mount or polling intervals — LLM calls are slow and metered.
 */
export function AISignals() {
  const { values } = useTweaks();
  const tz = values.timezone || 'America/New_York';
  const tzAbbrev =
    tz === 'America/New_York' ? 'NY'
    : tz === 'Asia/Seoul'      ? 'KST'
    : tz === 'Europe/London'   ? 'LDN'
    : 'UTC';

  // Hydration from server-persisted history. Mounts blank, then once we hear
  // back from /api/ai/history with the most-recent batch we re-mount the
  // useOnDemandStream hook with that batch as `initial`. The `hydratedKey`
  // change forces React to discard the empty hook instance.
  const [hydration, setHydration] = useState<{
    items: AISignal[];
    meta:  AIMeta | null;
    at:    number;
  } | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAIHistory('signals', 1).then((entries: HistoryEntry[]) => {
      if (cancelled) return;
      const latest = entries.at(-1);
      if (latest) {
        const items = Array.isArray(latest.data) ? (latest.data as AISignal[]) : [];
        setHydration({
          items,
          meta: { provider: latest.provider as AIMeta['provider'], model: latest.model, usage: latest.usage },
          at:   latest.createdAt,
        });
      }
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Re-instantiate the on-demand stream with hydrated initial state once
  // history loads. The `key` prop forces React to discard the loading-state
  // hook instance and create a fresh one with seeded `initial` — without it
  // useState's lazy init only runs on the very first mount, so seeding
  // never takes effect. (B9-4)
  return hydrated
    ? <AISignalsInner key="hydrated" hydration={hydration} tz={tz} tzAbbrev={tzAbbrev} />
    : <AISignalsInner key="loading"  hydration={null}      tz={tz} tzAbbrev={tzAbbrev} loadingHistory />;
}

interface InnerProps {
  hydration: { items: AISignal[]; meta: AIMeta | null; at: number } | null;
  tz:        string;
  tzAbbrev:  string;
  loadingHistory?: boolean;
}

function AISignalsInner({ hydration, tz, tzAbbrev, loadingHistory }: InnerProps) {
  const initial = useMemo(
    () => hydration
      ? { items: hydration.items, meta: hydration.meta, receivedAt: hydration.at }
      : undefined,
    [hydration],
  );
  const stream = useOnDemandStream<AISignal, AIMeta>(
    (onMeta) => streamSignals(onMeta),
    initial,
  );

  return (
    <div>
      <div className="row between">
        <div className="wf-label">AI Assistant</div>
        {loadingHistory ? (
          <span className="ai-badge loading">Loading…</span>
        ) : stream.loading ? (
          <span className="ai-badge loading">Generating…</span>
        ) : stream.error ? (
          <span className="ai-badge err" title={stream.error.message}>Failed</span>
        ) : stream.lastReceivedAt ? (
          <span className="ai-badge ok">
            {stream.items.length} ok @{' '}
            {formatTime(stream.lastReceivedAt, { timeZone: tz, abbreviation: tzAbbrev })}
          </span>
        ) : (
          <span className="ai-badge idle">Idle</span>
        )}
      </div>

      <div className="row" style={{ marginTop: 8, gap: 6 }}>
        <button
          type="button"
          className="ai-trigger-btn"
          onClick={stream.run}
          disabled={stream.loading}
        >
          {stream.loading ? 'Generating…' : stream.items.length > 0 ? '↻ Regenerate' : 'Generate signals'}
        </button>
        {stream.items.length > 0 && (
          <button
            type="button"
            className="ai-trigger-btn ghost"
            onClick={stream.reset}
            disabled={stream.loading}
          >
            Clear
          </button>
        )}
      </div>

      {stream.items.length === 0 && !stream.loading && (
        <div className="ai-empty">
          {stream.error
            ? 'Generation failed. Check Settings → AI Provider keys.'
            : 'Click Generate to ask the AI for current market signals.'}
        </div>
      )}

      {stream.items.map((entry, i) => (
        <SignalCard
          key={`${entry.receivedAt}-${i}`}
          signal={entry.data}
          receivedAt={entry.receivedAt}
          tz={tz}
          tzAbbrev={tzAbbrev}
        />
      ))}

      {stream.items.length > 0 && stream.meta && (
        <AITokenFooter meta={stream.meta} />
      )}
    </div>
  );
}

interface SignalCardProps {
  signal: AISignal;
  receivedAt: number;
  tz: string;
  tzAbbrev: string;
}

function SignalCard({ signal, receivedAt, tz, tzAbbrev }: SignalCardProps) {
  const headerColor =
    signal.type === 'CAUTION' ? 'var(--down)'
    : signal.type === 'INFO'   ? 'var(--fg-2)'
    : 'var(--orange)';

  return (
    <div className="wf-panel-flat" style={{ padding: 10, marginTop: 8 }}>
      <div className="row between" style={{ marginBottom: 6 }}>
        <div className="wf-mini" style={{ color: headerColor }}>
          // {signal.type} · {signal.when}
        </div>
        <div className="wf-mini muted" title={new Date(receivedAt).toISOString()}>
          {formatTime(receivedAt, { timeZone: tz, abbreviation: tzAbbrev })}
        </div>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--fg-2)' }}>
        {signal.body}
      </div>
      <div className="row gap-2" style={{ marginTop: 8 }}>
        {signal.tags.map((tag) => {
          const isAction = /ACTION/i.test(tag);
          return (
            <span
              key={tag}
              className="tag"
              style={
                isAction
                  ? { color: 'var(--orange)', borderColor: 'var(--orange)' }
                  : undefined
              }
            >
              {tag}
            </span>
          );
        })}
      </div>
    </div>
  );
}
