import { useMemo, useRef, useState } from 'react';

import { streamInsights } from '../../data/ai';
import type { AICategory, AIInsight } from '../../data/types';
import { useAsyncStream } from '../../lib/useAsync';

const CATEGORIES: { id: AICategory | 'ALL'; label: string }[] = [
  { id: 'ALL',         label: 'ALL'      },
  { id: 'OPPORTUNITY', label: 'OPP'      },
  { id: 'RISK',        label: 'RISK'     },
  { id: 'MACRO',       label: 'MACRO'    },
  { id: 'EARNINGS',    label: 'EARNINGS' },
];

const SKELETON_COUNT = 3;

export function AIInsightsFeed() {
  const insights = useAsyncStream<AIInsight>(
    () => streamInsights('default'),
    [],
  );

  const [filter, setFilter] = useState<AICategory | 'ALL'>('ALL');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // ARIA tabs keyboard pattern — Left/Right cycle, Home/End jump.
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
        ? insights
        : insights.filter((c) => c.tag === filter),
    [insights, filter],
  );

  const showSkeleton = insights.length === 0;

  return (
    <aside
      style={{
        borderLeft: '1px solid var(--hairline)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          padding: 14,
          borderBottom: '1px solid var(--hairline)',
        }}
      >
        <div className="row between center">
          <div>
            <div className="wf-label">AI Insights · Live feed</div>
            <div className="wf-mini muted-2" style={{ marginTop: 2 }}>
              tailored to your portfolio
            </div>
          </div>
          <span className="chip dot warn">
            {showSkeleton ? 'WAIT' : `${insights.length} NEW`}
          </span>
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
        {showSkeleton
          ? Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <SkeletonCard key={`sk-${i}`} />
            ))
          : visible.length === 0
            ? (
                <div
                  className="wf-mini muted"
                  style={{ padding: 8, textAlign: 'center' }}
                >
                  No insights match this filter yet.
                </div>
              )
            : visible.map((c) => <InsightCard key={c.id} card={c} />)}
      </div>
    </aside>
  );
}

function InsightCard({ card }: { card: AIInsight }) {
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
        <span className="wf-mini muted-2">{card.when}</span>
      </div>
      <div
        style={{
          fontSize: 13,
          marginTop: 6,
          color: 'var(--fg)',
        }}
      >
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
          <span>
            SCORE <span className="accent">{card.score}</span>
          </span>
        </div>
        <div className="row gap-1">
          {card.actions.map((a, j) => (
            <span
              key={a}
              className="tag"
              style={
                j === 0
                  ? {
                      color: 'var(--orange)',
                      borderColor: 'var(--orange)',
                    }
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

function SkeletonCard() {
  return (
    <div
      className="wf-panel-flat"
      style={{ padding: 12, opacity: 0.4 }}
      aria-busy
    >
      <div className="row between">
        <span className="wf-mini accent">// —</span>
        <span className="wf-mini muted-2">—</span>
      </div>
      <div style={{ fontSize: 13, marginTop: 6, color: 'var(--fg-3)' }}>
        ————————————————
      </div>
      <div
        style={{
          fontSize: 11,
          marginTop: 4,
          color: 'var(--fg-3)',
          lineHeight: 1.5,
        }}
      >
        ——————————————————————————————
      </div>
      <hr className="wf-divider" style={{ margin: '8px 0' }} />
      <div className="row between center">
        <div className="row gap-2 wf-mini">
          <span className="muted">RISK —</span>
          <span className="muted">·</span>
          <span>
            SCORE <span className="accent">—</span>
          </span>
        </div>
        <div className="row gap-1">
          <span className="tag">—</span>
          <span className="tag">—</span>
        </div>
      </div>
    </div>
  );
}
