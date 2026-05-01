import { proposeHedge } from '../../data/ai';
import type { HedgeProposal } from '../../data/types';
import { formatTime } from '../../lib/format';
import { useTweaks } from '../../lib/tweaks';
import { useOnDemand } from '../../lib/useOnDemand';

const EXPOSURE = 'semis-heavy portfolio with TSM 6.4% in Taiwan-tension';

export function AIHedgeSuggestion() {
  const { values } = useTweaks();
  const tz = values.timezone || 'America/New_York';
  const tzAbbrev =
    tz === 'America/New_York' ? 'NY'
    : tz === 'Asia/Seoul'      ? 'KST'
    : tz === 'Europe/London'   ? 'LDN'
    : 'UTC';

  const hedge = useOnDemand<HedgeProposal>(() => proposeHedge(EXPOSURE));
  const dimmed = !hedge.data ? { opacity: 0.5 } : undefined;

  return (
    <div style={{ padding: 14 }}>
      <div className="row between">
        <div className="wf-label">AI · Hedge suggestion</div>
        {hedge.loading ? (
          <span className="ai-badge loading">Generating…</span>
        ) : hedge.error ? (
          <span className="ai-badge err" title={hedge.error.message}>Failed</span>
        ) : hedge.lastReceivedAt ? (
          <span className="ai-badge ok">
            @ {formatTime(hedge.lastReceivedAt, { timeZone: tz, abbreviation: tzAbbrev })}
          </span>
        ) : (
          <span className="ai-badge idle">Idle</span>
        )}
      </div>

      <div className="row" style={{ marginTop: 8, gap: 6 }}>
        <button
          type="button"
          className="ai-trigger-btn"
          onClick={hedge.run}
          disabled={hedge.loading}
        >
          {hedge.loading
            ? 'Generating…'
            : hedge.data
              ? '↻ Regenerate proposal'
              : 'Suggest hedge'}
        </button>
      </div>

      <div
        className="wf-panel-flat"
        style={{ padding: 10, marginTop: 8, ...dimmed }}
        aria-busy={hedge.loading}
      >
        <div className="wf-mini accent">// PROPOSAL</div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--fg-2)',
            lineHeight: 1.5,
            marginTop: 4,
          }}
        >
          {hedge.error ? (
            <span style={{ color: 'var(--down)' }}>
              Generation failed: {hedge.error.message}
            </span>
          ) : hedge.data ? (
            renderDescription(hedge.data)
          ) : (
            <span style={{ color: 'var(--fg-3)' }}>
              Click the button above to ask the AI for a hedge proposal.
            </span>
          )}
        </div>
        <div className="row gap-2" style={{ marginTop: 8 }}>
          {(hedge.data?.actions ?? ['SIMULATE', 'DISMISS']).map((a, i) => (
            <span
              key={a}
              className="tag"
              style={
                i === 0
                  ? { color: 'var(--orange)', borderColor: 'var(--orange)' }
                  : undefined
              }
            >
              {a}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderDescription(data: HedgeProposal) {
  const { description, expectedDrawdownTrim } = data;
  if (expectedDrawdownTrim && description.includes(expectedDrawdownTrim)) {
    const [head, ...tailParts] = description.split(expectedDrawdownTrim);
    const tail = tailParts.join(expectedDrawdownTrim);
    return (
      <>
        {head}
        <span className="accent">{expectedDrawdownTrim}</span>
        {tail}
      </>
    );
  }
  return (
    <>
      {description}
      {expectedDrawdownTrim ? (
        <>
          {' '}Expected drawdown trim:{' '}
          <span className="accent">{expectedDrawdownTrim}</span>.
        </>
      ) : null}
    </>
  );
}
