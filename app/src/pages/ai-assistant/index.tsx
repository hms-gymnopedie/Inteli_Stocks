/**
 * /ai-assistant — persistent per-area AI history view (B8-AI-TAB).
 *
 * Mirrors the per-page AI cards but reads from the server's persistent
 * history file (`~/.intelistock/ai-history.json`) rather than the
 * component-local on-demand state. Lets the user browse every prior
 * generation across all four areas (signals / insights / verdicts /
 * hedges) and re-run any of them.
 *
 * Tabs use the WAI-ARIA tabs pattern, identical to HeroChart's range
 * tablist (roving tabindex, Arrow/Home/End keyboard navigation).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  clearAIHistory,
  getAIHistory,
  proposeHedge,
  streamInsights,
  streamSignals,
  getVerdict,
} from '../../data/ai';
import type { Area, HistoryEntry } from '../../data/aiHistoryTypes';
import type {
  AIInsight,
  AIMeta,
  AISignal,
  AIVerdict,
  ConvictionAxis,
  HedgeProposal,
} from '../../data/types';
import { AITokenFooter } from '../../lib/AITokenFooter';
import { formatTime } from '../../lib/format';
import { useTweaks } from '../../lib/tweaks';

const AREAS: ReadonlyArray<{ id: Area; label: string; help: string }> = [
  { id: 'signals',  label: 'Signals',  help: 'Generated on /overview' },
  { id: 'insights', label: 'Insights', help: 'Generated on /portfolio' },
  { id: 'verdicts', label: 'Verdicts', help: 'Generated on /detail' },
  { id: 'hedges',   label: 'Hedges',   help: 'Generated on /geo' },
];

export function AIAssistant() {
  const { values } = useTweaks();
  const tz = values.timezone || 'America/New_York';
  const tzAbbrev =
    tz === 'America/New_York' ? 'NY'
    : tz === 'Asia/Seoul'      ? 'KST'
    : tz === 'Europe/London'   ? 'LDN'
    : 'UTC';

  const [active, setActive] = useState<Area>('signals');
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Fetch history for the active area whenever it changes (or reload bumps).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAIHistory(active, 50).then((list) => {
      if (cancelled) return;
      setEntries(list);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [active, reload]);

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % AREAS.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + AREAS.length) % AREAS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = AREAS.length - 1;
    else return;
    e.preventDefault();
    setActive(AREAS[next].id);
    tabRefs.current[next]?.focus();
  };

  const onClear = useCallback(async () => {
    if (!entries.length) return;
    const ok = window.confirm(`Clear all ${active}? This cannot be undone.`);
    if (!ok) return;
    await clearAIHistory(active);
    setReload((n) => n + 1);
  }, [active, entries.length]);

  const onReran = useCallback(() => {
    // Re-fetch after a brief delay so the server has finished appending.
    setTimeout(() => setReload((n) => n + 1), 800);
  }, []);

  return (
    <div className="ai-assistant-page">
      <header className="settings-header">
        <h1 className="settings-title">AI Assistant — History</h1>
        <p className="settings-sub">
          Every AI generation is persisted server-side (last 50 per area).
          Browse, inspect token usage, or re-run any prior call.
        </p>
      </header>

      <div
        className="ai-tablist"
        role="tablist"
        aria-label="AI history area"
      >
        {AREAS.map((a, i) => {
          const isActive = active === a.id;
          return (
            <button
              key={a.id}
              ref={(el) => { tabRefs.current[i] = el; }}
              type="button"
              role="tab"
              id={`ai-tab-${a.id}`}
              aria-controls={`ai-panel-${a.id}`}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className={'ai-tab' + (isActive ? ' active' : '')}
              onClick={() => setActive(a.id)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
            >
              {a.label}
            </button>
          );
        })}
        <span className="ai-tab-help">{AREAS.find((a) => a.id === active)?.help}</span>
        <button
          type="button"
          className="ai-trigger-btn ghost ai-tab-clear"
          onClick={onClear}
          disabled={!entries.length || loading}
          title={`Clear ${active} history`}
        >
          Clear
        </button>
      </div>

      <div
        role="tabpanel"
        id={`ai-panel-${active}`}
        aria-labelledby={`ai-tab-${active}`}
        className="ai-panel"
      >
        {loading && entries.length === 0 ? (
          <div className="ai-empty">Loading {active}…</div>
        ) : entries.length === 0 ? (
          <div className="ai-empty">
            No {active} generated yet. Use the Generate button on{' '}
            <code>
              {active === 'signals'  ? '/overview'
              : active === 'insights' ? '/portfolio'
              : active === 'verdicts' ? '/detail'
              : '/geo'}
            </code>.
          </div>
        ) : (
          // Newest at top.
          [...entries].reverse().map((entry) => (
            <HistoryCard
              key={entry.id}
              entry={entry}
              area={active}
              tz={tz}
              tzAbbrev={tzAbbrev}
              onReran={onReran}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Per-entry card ─────────────────────────────────────────────────────────

interface HistoryCardProps {
  entry:    HistoryEntry;
  area:     Area;
  tz:       string;
  tzAbbrev: string;
  onReran:  () => void;
}

function HistoryCard({ entry, area, tz, tzAbbrev, onReran }: HistoryCardProps) {
  const [rerunning, setRerunning] = useState(false);
  const [rerunErr, setRerunErr] = useState<string | null>(null);

  const meta: AIMeta = {
    provider: entry.provider as AIMeta['provider'],
    model:    entry.model,
    usage:    entry.usage,
  };

  const handleRerun = async () => {
    setRerunning(true);
    setRerunErr(null);
    try {
      if (area === 'signals') {
        // Drain the AsyncIterable to trigger the server-side append.
        for await (const _ of streamSignals()) { void _; }
      } else if (area === 'insights') {
        for await (const _ of streamInsights('default')) { void _; }
      } else if (area === 'verdicts') {
        await getVerdict(entry.symbol ?? 'NVDA');
      } else {
        await proposeHedge(entry.exposure ?? '');
      }
      onReran();
    } catch (err) {
      setRerunErr(err instanceof Error ? err.message : String(err));
    } finally {
      setRerunning(false);
    }
  };

  const headerLabel =
    area === 'verdicts' ? entry.symbol ?? '—'
    : area === 'hedges' ? truncate(entry.exposure ?? '', 60)
    : `${Array.isArray(entry.data) ? entry.data.length : 1} items`;

  return (
    <div className="wf-panel-flat ai-history-card">
      <div className="row between center" style={{ marginBottom: 8 }}>
        <div className="row gap-2 center">
          <span className="wf-mini accent">// {area.toUpperCase()}</span>
          <span className="wf-mini muted">·</span>
          <span className="wf-mini" style={{ color: 'var(--fg-2)' }}>
            {headerLabel}
          </span>
        </div>
        <span
          className="wf-mini muted-2"
          title={new Date(entry.createdAt).toISOString()}
        >
          {relativeTime(entry.createdAt)} ·{' '}
          {formatTime(entry.createdAt, { timeZone: tz, abbreviation: tzAbbrev })}
        </span>
      </div>

      <div className="ai-history-body">
        {area === 'signals'  && <SignalsList  data={entry.data} />}
        {area === 'insights' && <InsightsList data={entry.data} />}
        {area === 'verdicts' && <VerdictView  data={entry.data as AIVerdict} />}
        {area === 'hedges'   && <HedgeView    data={entry.data as HedgeProposal} exposure={entry.exposure} />}
      </div>

      <hr className="wf-divider" style={{ margin: '10px 0 8px' }} />

      <div className="row between center">
        <AITokenFooter meta={meta} />
        <div className="row gap-2 center">
          {rerunErr && (
            <span className="wf-mini" style={{ color: 'var(--down)' }}>
              {rerunErr}
            </span>
          )}
          <button
            type="button"
            className="ai-trigger-btn"
            onClick={handleRerun}
            disabled={rerunning}
          >
            {rerunning ? 'Re-running…' : '↻ Re-run'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-views ──────────────────────────────────────────────────────────────

function SignalsList({ data }: { data: unknown }) {
  const items = Array.isArray(data) ? (data as AISignal[]) : [];
  if (!items.length) return <div className="ai-empty">No items.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((s, i) => (
        <div key={s.id ?? i} style={{ paddingLeft: 4, borderLeft: '2px solid var(--hairline)' }}>
          <div className="row between" style={{ marginBottom: 2 }}>
            <span
              className="wf-mini"
              style={{ color: signalColor(s.type) }}
            >
              // {s.type} · {s.when}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.45 }}>
            {s.body}
          </div>
          <div className="row gap-2" style={{ marginTop: 4, flexWrap: 'wrap' }}>
            {(s.tags ?? []).map((t) => (
              <span key={t} className="tag">{t}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightsList({ data }: { data: unknown }) {
  const items = Array.isArray(data) ? (data as AIInsight[]) : [];
  if (!items.length) return <div className="ai-empty">No items.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((c, i) => (
        <div key={c.id ?? i} style={{ paddingLeft: 4, borderLeft: '2px solid var(--hairline)' }}>
          <div className="row between">
            <span className="wf-mini" style={{ color: toneColor(c.tone) }}>
              // {c.tag}
            </span>
            <span className="wf-mini muted">RISK {c.risk} · SCORE {c.score}</span>
          </div>
          <div style={{ fontSize: 13, marginTop: 2, color: 'var(--fg)' }}>
            {c.title}
          </div>
          <div style={{ fontSize: 11, marginTop: 2, color: 'var(--fg-2)', lineHeight: 1.5 }}>
            {c.body}
          </div>
          <div className="row gap-2" style={{ marginTop: 4, flexWrap: 'wrap' }}>
            {(c.actions ?? []).map((a) => (
              <span key={a} className="tag">{a}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function VerdictView({ data }: { data: AIVerdict | undefined }) {
  if (!data) return <div className="ai-empty">No data.</div>;
  return (
    <div>
      <div className="row gap-3 center">
        <div className="wf-num" style={{ fontSize: 22 }}>
          {data.convictionScore}
          <span className="muted-2" style={{ fontSize: 12 }}>/100</span>
        </div>
        <div className="wf-mini accent">CONVICTION · {data.verdict}</div>
        <div className="wf-mini muted">RISK {data.riskScore}/5</div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.5, marginTop: 6 }}>
        {data.summary}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          marginTop: 8,
        }}
      >
        {(data.axes ?? []).map((axis: ConvictionAxis) => (
          <div key={axis.label} className="row between">
            <span className="muted">{axis.label}</span>
            <span className={axis.color === 'up' ? 'up' : axis.color === 'down' ? 'down' : 'accent'}>
              {bar(axis.score, axis.maxScore)} {axis.score}/{axis.maxScore}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HedgeView({ data, exposure }: { data: HedgeProposal | undefined; exposure?: string }) {
  if (!data) return <div className="ai-empty">No data.</div>;
  return (
    <div>
      {exposure && (
        <div className="wf-mini muted-2" style={{ marginBottom: 4 }}>
          exposure: <span style={{ color: 'var(--fg-2)' }}>{exposure}</span>
        </div>
      )}
      <div className="wf-mini accent">// PROPOSAL · {data.proposalId}</div>
      <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5, marginTop: 4 }}>
        {data.description}
      </div>
      <div className="row between" style={{ marginTop: 6 }}>
        <span className="wf-mini muted">expected drawdown trim</span>
        <span className="wf-mini accent">{data.expectedDrawdownTrim}</span>
      </div>
      <div className="row gap-2" style={{ marginTop: 6, flexWrap: 'wrap' }}>
        {(data.actions ?? []).map((a) => (
          <span key={a} className="tag">{a}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Small helpers ──────────────────────────────────────────────────────────

function signalColor(type: AISignal['type']): string {
  return type === 'CAUTION' ? 'var(--down)'
       : type === 'INFO'    ? 'var(--fg-2)'
       : 'var(--orange)';
}

function toneColor(tone: AIInsight['tone']): string {
  return tone === 'orange' ? 'var(--orange)'
       : tone === 'down'   ? 'var(--down)'
       : 'var(--fg)';
}

function bar(score: number, maxScore: number): string {
  const filled = Math.max(0, Math.min(maxScore, score));
  return '▮'.repeat(filled) + '▯'.repeat(maxScore - filled);
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)        return 'just now';
  if (diff < 3_600_000)     return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)    return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString();
}
