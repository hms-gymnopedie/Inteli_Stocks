import { useEffect, useMemo, useState } from 'react';

import { getAIHistory, proposeHedge } from '../../data/ai';
import type { HedgeInput } from '../../data/ai';
import type { HistoryEntry } from '../../data/aiHistoryTypes';
import { getHotspots } from '../../data/geo';
import { getHoldings } from '../../data/portfolio';
import type { AIMeta, AIResponse, HedgeProposal, Holding, RiskHotspot } from '../../data/types';
import { AITokenFooter } from '../../lib/AITokenFooter';
import { formatTime } from '../../lib/format';
import { useTweaks } from '../../lib/tweaks';
import { useOnDemand } from '../../lib/useOnDemand';

// Legacy fallback string used when /api/portfolio/holdings or /api/geo/state
// fail to load — keeps the proposal generic but still useful.
const FALLBACK_EXPOSURE =
  'semis-heavy portfolio with TSM 6.4% in Taiwan-tension';

interface BuiltContext {
  payload: string | HedgeInput;
  label:   string; // one-line "context: …" status hint
}

/** Build the structured `proposeHedge` payload from holdings + hotspots,
 *  or fall back to the legacy string form if either source errors. */
async function buildHedgeContext(): Promise<BuiltContext> {
  const [holdingsRes, hotspotsRes] = await Promise.allSettled([
    getHoldings(),
    getHotspots(),
  ]);

  if (
    holdingsRes.status !== 'fulfilled' ||
    hotspotsRes.status !== 'fulfilled'
  ) {
    return {
      payload: FALLBACK_EXPOSURE,
      label:   "context: fallback (couldn't load holdings or hotspots)",
    };
  }

  const allHoldings: Holding[] = Array.isArray(holdingsRes.value) ? holdingsRes.value : [];
  const allHotspots: RiskHotspot[] = Array.isArray(hotspotsRes.value) ? hotspotsRes.value : [];

  // Top 10 by parsed weight (mirrors AffectedPortfolio's parseFloat pattern).
  const top10 = [...allHoldings]
    .sort((a, b) => parseFloat(b.weight) - parseFloat(a.weight))
    .slice(0, 10);

  const holdings = top10.map((h) => ({
    symbol: h.symbol,
    weight: h.weight,
    name:   h.name,
  }));

  const hotspots = allHotspots.map((h) => ({
    name:    h.name,
    level:   h.level,
    impact:  h.impact,
    tickers: h.tickers,
  }));

  // One-line exposure summary so the model has a quick read even before
  // it walks the structured arrays.
  const top = top10[0];
  const topClause = top
    ? `top weight ${top.weight.trim()} ${top.symbol}`
    : 'no holdings on file';
  const hotspotClause =
    hotspots.length > 0
      ? `Active hotspots: ${hotspots
          .map((h) => {
            const region = h.name.split(/\s+/)[0] ?? h.name;
            return `${region} (${h.level})`;
          })
          .join(', ')}`
      : 'No active hotspots';
  const exposure = `${holdings.length} holdings, ${topClause}. ${hotspotClause}`;

  return {
    payload: { exposure, holdings, hotspots },
    label:   `context: ${holdings.length} holdings · ${hotspots.length} hotspots`,
  };
}

export function AIHedgeSuggestion() {
  const { values } = useTweaks();
  const tz = values.timezone || 'America/New_York';
  const tzAbbrev =
    tz === 'America/New_York' ? 'NY'
    : tz === 'Asia/Seoul'      ? 'KST'
    : tz === 'Europe/London'   ? 'LDN'
    : 'UTC';

  // Hydrate from server history on mount with the most recent hedge.
  const [seed, setSeed] = useState<{ data: AIResponse<HedgeProposal>; at: number } | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAIHistory('hedges', 1).then((entries: HistoryEntry[]) => {
      if (cancelled) return;
      const latest = entries.at(-1);
      if (latest) {
        const meta: AIMeta = {
          provider: latest.provider as AIMeta['provider'],
          model:    latest.model,
          usage:    latest.usage,
        };
        setSeed({ data: { data: latest.data as HedgeProposal, meta }, at: latest.createdAt });
      }
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, []);

  const initial = useMemo(
    () => seed ? { data: seed.data, receivedAt: seed.at } : undefined,
    [seed],
  );

  // Force-remount when hydration arrives so useState lazy init reads the
  // freshly seeded `initial` (B9-4).
  return hydrated
    ? <Inner key="hydrated" initial={initial} tz={tz} tzAbbrev={tzAbbrev} />
    : <Inner key="loading"  initial={undefined} tz={tz} tzAbbrev={tzAbbrev} loadingHistory />;
}

interface InnerProps {
  initial:  { data: AIResponse<HedgeProposal>; receivedAt: number } | undefined;
  tz:       string;
  tzAbbrev: string;
  loadingHistory?: boolean;
}

function Inner({ initial, tz, tzAbbrev, loadingHistory }: InnerProps) {
  // Build the real exposure context from the user's book + active hotspots.
  // On any failure we fall back to the legacy string so the proposal flow
  // still works without a portfolio or geo backend.
  const [context, setContext] = useState<BuiltContext>({
    payload: FALLBACK_EXPOSURE,
    label:   'context: loading…',
  });

  useEffect(() => {
    let cancelled = false;
    buildHedgeContext()
      .then((c) => {
        if (!cancelled) setContext(c);
      })
      .catch(() => {
        if (!cancelled) {
          setContext({
            payload: FALLBACK_EXPOSURE,
            label:   "context: fallback (couldn't load holdings or hotspots)",
          });
        }
      });
    return () => { cancelled = true; };
  }, []);

  const hedge = useOnDemand<AIResponse<HedgeProposal>>(
    () => proposeHedge(context.payload),
    initial,
  );
  const result = hedge.data?.data;
  const meta = hedge.data?.meta ?? null;
  const dimmed = !result ? { opacity: 0.5 } : undefined;

  return (
    <div style={{ padding: 14 }}>
      <div className="row between">
        <div className="wf-label">AI · Hedge suggestion</div>
        {loadingHistory ? (
          <span className="ai-badge loading">Loading…</span>
        ) : hedge.loading ? (
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

      <div className="wf-mini muted-2" style={{ marginTop: 4 }}>
        {context.label}
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
          ) : result ? (
            renderDescription(result)
          ) : (
            <span style={{ color: 'var(--fg-3)' }}>
              Click the button above to ask the AI for a hedge proposal.
            </span>
          )}
        </div>
        <div className="row gap-2" style={{ marginTop: 8 }}>
          {(result?.actions ?? ['SIMULATE', 'DISMISS']).map((a, i) => (
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
        {result && <AITokenFooter meta={meta} />}
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
