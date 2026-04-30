import { streamSignals } from '../../data/ai';
import type { AISignal } from '../../data/types';
import { useAsyncStream } from '../../lib/useAsync';

/**
 * Skeleton signal cards rendered while the SSE stream is warming up.
 * Same shape as a real card so the layout doesn't jump when items arrive.
 */
const SKELETON_COUNT = 2;

export function AISignals() {
  const signals = useAsyncStream<AISignal>(() => streamSignals(), []);
  const showSkeleton = signals.length === 0;

  return (
    <div>
      <div className="row between">
        <div className="wf-label">AI Assistant</div>
        <div className="chip dot warn">{showSkeleton ? 'WAIT' : 'LIVE'}</div>
      </div>

      {showSkeleton
        ? Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <div
              key={`sk-${i}`}
              className="wf-panel-flat"
              style={{ padding: 10, marginTop: 8, opacity: 0.4 }}
              aria-busy
            >
              <div
                className="wf-mini accent"
                style={{ marginBottom: 6 }}
              >
                // —
              </div>
              <div
                style={{
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: 'var(--fg-3)',
                }}
              >
                ————————————————————————————
              </div>
              <div className="row gap-2" style={{ marginTop: 8 }}>
                <span className="tag">—</span>
                <span className="tag">—</span>
              </div>
            </div>
          ))
        : signals.map((sig) => (
            <SignalCard key={sig.id} signal={sig} />
          ))}
    </div>
  );
}

function SignalCard({ signal }: { signal: AISignal }) {
  const headerColor =
    signal.type === 'CAUTION'
      ? 'var(--down)'
      : signal.type === 'INFO'
        ? 'var(--fg-2)'
        : 'var(--orange)';

  return (
    <div className="wf-panel-flat" style={{ padding: 10, marginTop: 8 }}>
      <div
        className="wf-mini"
        style={{ color: headerColor, marginBottom: 6 }}
      >
        // {signal.type} · {signal.when}
      </div>
      <div
        style={{
          fontSize: 12,
          lineHeight: 1.45,
          color: 'var(--fg-2)',
        }}
      >
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
                  ? {
                      color: 'var(--orange)',
                      borderColor: 'var(--orange)',
                    }
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
