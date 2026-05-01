import { streamSignals } from '../../data/ai';
import type { AIMeta, AISignal } from '../../data/types';
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

  const stream = useOnDemandStream<AISignal, AIMeta>((onMeta) =>
    streamSignals(onMeta),
  );

  return (
    <div>
      <div className="row between">
        <div className="wf-label">AI Assistant</div>
        {stream.loading ? (
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
