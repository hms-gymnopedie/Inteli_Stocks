import { proposeHedge } from '../../data/ai';
import type { HedgeProposal } from '../../data/types';
import { useAsync } from '../../lib/useAsync';

/**
 * Static exposure descriptor passed to the AI hedge prompt. The portfolio
 * page derives this from real holdings; for now Geo uses a fixed semis +
 * Taiwan-tension scenario that matches the hotspots/affected sections.
 *
 * B5 will replace this with a derived heuristic from the user's portfolio.
 */
const EXPOSURE = 'semis-heavy portfolio with TSM 6.4% in Taiwan-tension';

export function AIHedgeSuggestion() {
  const { data, loading } = useAsync<HedgeProposal>(
    () => proposeHedge(EXPOSURE),
    [],
  );

  const dimmed = loading && !data ? { opacity: 0.4 } : undefined;

  return (
    <div style={{ padding: 14 }}>
      <div className="wf-label">AI · Hedge suggestion</div>
      <div
        className="wf-panel-flat"
        style={{ padding: 10, marginTop: 8, ...dimmed }}
        aria-busy={loading}
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
          {data ? (
            renderDescription(data)
          ) : (
            <span style={{ color: 'var(--fg-3)' }}>
              Waiting for hedge proposal…
            </span>
          )}
        </div>
        <div className="row gap-2" style={{ marginTop: 8 }}>
          {(data?.actions ?? ['SIMULATE', 'DISMISS']).map((a, i) => (
            <span
              key={a}
              className="tag"
              style={
                i === 0
                  ? {
                      color: 'var(--orange)',
                      borderColor: 'var(--orange)',
                    }
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

/**
 * Render the proposal description, accent-coloring the expected drawdown trim
 * substring if it appears verbatim in the description string. If it doesn't
 * (some providers return only the cleaned description), append it as a tail.
 */
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
