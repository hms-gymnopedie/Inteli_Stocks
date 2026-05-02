import { useEffect, useMemo, useRef, useState } from 'react';

import { getAIHistory, streamInsights } from '../../data/ai';
import type { HistoryEntry } from '../../data/aiHistoryTypes';
import type { AICategory, AIInsight, AIMeta } from '../../data/types';
import { AITokenFooter } from '../../lib/AITokenFooter';
import { formatTime } from '../../lib/format';
import { useTweaks } from '../../lib/tweaks';
import { useOnDemandStream } from '../../lib/useOnDemand';

const CATEGORIES: { id: AICategory | 'ALL'; label: string }[] = [
  { id: 'ALL',         label: 'ALL'      },
  { id: 'OPPORTUNITY', label: 'OPP'      },
  { id: 'RISK',        label: 'RISK'     },
  { id: 'MACRO',       label: 'MACRO'    },
  { id: 'EARNINGS',    label: 'EARNINGS' },
];

/**
 * Portfolio AI insights — on-demand. Click "Generate" to ask the AI
 * provider for insight cards tailored to your portfolio. No auto-fetch.
 */
export function AIInsightsFeed() {
  // Hydrate from server history on mount, then mount the inner component
  // (which holds the on-demand stream) with that initial state. Splitting
  // these into two components keeps the Rules of Hooks clean — no hooks
  // are called conditionally.
  const [hydration, setHydration] = useState<{
    items: AIInsight[];
    meta:  AIMeta | null;
    at:    number;
  } | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAIHistory('insights', 1).then((entries: HistoryEntry[]) => {
      if (cancelled) return;
      const latest = entries.at(-1);
      if (latest) {
        const items = Array.isArray(latest.data) ? (latest.data as AIInsight[]) : [];
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

  if (!hydrated) {
    return (
      <aside style={{ borderLeft: '1px solid var(--hairline)', padding: 14 }}>
        <div className="wf-label">AI Insights · On-demand</div>
        <div className="ai-empty" style={{ marginTop: 12 }}>Loading history…</div>
      </aside>
    );
  }

  return <AIInsightsInner hydration={hydration} />;
}

interface AIInsightsInnerProps {
  hydration: { items: AIInsight[]; meta: AIMeta | null; at: number } | null;
}

function AIInsightsInner({ hydration }: AIInsightsInnerProps) {
  const { values } = useTweaks();
  const tz = values.timezone || 'America/New_York';
  const tzAbbrev =
    tz === 'America/New_York' ? 'NY'
    : tz === 'Asia/Seoul'      ? 'KST'
    : tz === 'Europe/London'   ? 'LDN'
    : 'UTC';

  const initial = useMemo(
    () => hydration
      ? { items: hydration.items, meta: hydration.meta, receivedAt: hydration.at }
      : undefined,
    [hydration],
  );

  const stream = useOnDemandStream<AIInsight, AIMeta>(
    (onMeta) => streamInsights('default', onMeta),
    initial,
  );

  const [filter, setFilter] = useState<AICategory | 'ALL'>('ALL');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % CATEGORIES.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + CATEGORIES.length) % CATEGORIES.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = CATEGORIES.length - 1;
    else return;
    e.preventDefault();
    setFilter(CATEGORIES[next].id);
    tabRefs.current[next]?.focus();
  };

  const visible = useMemo(
    () =>
      filter === 'ALL'
        ? stream.items
        : stream.items.filter((c) => c.data.tag === filter),
    [stream.items, filter],
  );

  return (
    <aside
      style={{
        borderLeft: '1px solid var(--hairline)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}
    >
      <div style={{ padding: 14, borderBottom: '1px solid var(--hairline)' }}>
        <div className="row between center">
          <div>
            <div className="wf-label">AI Insights · On-demand</div>
            <div className="wf-mini muted-2" style={{ marginTop: 2 }}>
              tailored to your portfolio
            </div>
          </div>
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

        <div className="row" style={{ marginTop: 10, gap: 6 }}>
          <button
            type="button"
            className="ai-trigger-btn"
            onClick={stream.run}
            disabled={stream.loading}
          >
            {stream.loading
              ? 'Generating…'
              : stream.items.length > 0
                ? '↻ Regenerate'
                : 'Generate insights'}
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

        <div
          className="row gap-1"
          role="tablist"
          aria-label="Insight category filter"
          style={{ marginTop: 10, flexWrap: 'wrap' }}
        >
          {CATEGORIES.map((cat, i) => {
            const active = filter === cat.id;
            return (
              <button
                key={cat.id}
                ref={(el) => { tabRefs.current[i] = el; }}
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                className={active ? 'tab active' : 'tab'}
                style={{
                  padding: '3px 8px',
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.06em',
                  background: active ? undefined : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setFilter(cat.id)}
                onKeyDown={(e) => onTabKeyDown(e, i)}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          flex: 1,
        }}
      >
        {stream.items.length === 0 && !stream.loading && (
          <div className="ai-empty">
            {stream.error
              ? 'Generation failed. Check Settings → AI Provider keys.'
              : 'Click Generate to ask the AI for portfolio insights.'}
          </div>
        )}
        {visible.length === 0 && stream.items.length > 0 && !stream.loading && (
          <div
            className="wf-mini muted"
            style={{ padding: 8, textAlign: 'center' }}
          >
            No insights match this filter.
          </div>
        )}
        {visible.map((entry, i) => (
          <InsightCard
            key={`${entry.data.id}-${i}`}
            card={entry.data}
            receivedAt={entry.receivedAt}
            tz={tz}
            tzAbbrev={tzAbbrev}
          />
        ))}

        {stream.items.length > 0 && stream.meta && (
          <AITokenFooter meta={stream.meta} />
        )}
      </div>
    </aside>
  );
}

interface InsightCardProps {
  card: AIInsight;
  receivedAt: number;
  tz: string;
  tzAbbrev: string;
}

function InsightCard({ card, receivedAt, tz, tzAbbrev }: InsightCardProps) {
  const tagColor =
    card.tone === 'orange'
      ? 'var(--orange)'
      : card.tone === 'down'
        ? 'var(--down)'
        : 'var(--fg)';

  return (
    <div className="wf-panel-flat" style={{ padding: 12 }}>
      <div className="row between">
        <span className="wf-mini" style={{ color: tagColor }}>
          // {card.tag}
        </span>
        <span
          className="wf-mini muted-2"
          title={new Date(receivedAt).toISOString()}
        >
          {formatTime(receivedAt, { timeZone: tz, abbreviation: tzAbbrev })}
        </span>
      </div>
      <div style={{ fontSize: 13, marginTop: 6, color: 'var(--fg)' }}>
        {card.title}
      </div>
      <div
        style={{
          fontSize: 11,
          marginTop: 4,
          color: 'var(--fg-2)',
          lineHeight: 1.5,
        }}
      >
        {card.body}
      </div>
      <hr className="wf-divider" style={{ margin: '8px 0' }} />
      <div className="row between center">
        <div className="row gap-2 wf-mini">
          <span className="muted">RISK {card.risk}</span>
          <span className="muted">·</span>
          <span>SCORE <span className="accent">{card.score}</span></span>
        </div>
        <div className="row gap-1">
          {card.actions.map((a, j) => (
            <span
              key={a}
              className="tag"
              style={
                j === 0
                  ? { color: 'var(--orange)', borderColor: 'var(--orange)' }
                  : {}
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
