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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  clearAIHistory,
  getAIHistory,
  proposeHedge,
  streamInsights,
  streamSignals,
  getVerdict,
} from '../../data/ai';
import type { AIHistory, Area, HistoryEntry } from '../../data/aiHistoryTypes';
import type {
  AIInsight,
  AIMeta,
  AISignal,
  AIVerdict,
  ConvictionAxis,
  HedgeProposal,
} from '../../data/types';
import { AITokenFooter } from '../../lib/AITokenFooter';
import { estimateCost, formatUSD } from '../../lib/aiPricing';
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
  const [allHistory, setAllHistory] = useState<AIHistory | null>(null);
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

  // Pull the entire history file once per `reload` bump for the side panel
  // aggregate stats. Cheap — single file read on the server, capped at 200
  // entries (50 × 4 areas).
  useEffect(() => {
    let cancelled = false;
    getAIHistory().then((h) => {
      if (cancelled) return;
      setAllHistory(h);
    });
    return () => { cancelled = true; };
  }, [reload]);

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

  // ── Per-area + Global generators (B9-3) ────────────────────────────────────

  const [generating, setGenerating] = useState<Area | 'all' | null>(null);
  const [genErr, setGenErr] = useState<string | null>(null);

  /** Drain whichever generator matches `area` so the server-side history append fires. */
  async function generateOne(area: Area): Promise<void> {
    if (area === 'signals') {
      for await (const _ of streamSignals()) { void _; }
    } else if (area === 'insights') {
      for await (const _ of streamInsights('default')) { void _; }
    } else if (area === 'verdicts') {
      // Use the most recent symbol from history if available, else NVDA.
      const recent = entries.find((e) => e.symbol)?.symbol ?? 'NVDA';
      await getVerdict(recent);
    } else {
      const recent = entries.find((e) => e.exposure)?.exposure
        ?? 'broad equity exposure with US tech tilt';
      await proposeHedge(recent);
    }
  }

  const onGenerateActive = useCallback(async () => {
    setGenerating(active);
    setGenErr(null);
    try {
      await generateOne(active);
      // Server append happens fire-and-forget; give it a beat then reload.
      setTimeout(() => setReload((n) => n + 1), 400);
    } catch (e) {
      setGenErr(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, entries]);

  const onGenerateAll = useCallback(async () => {
    setGenerating('all');
    setGenErr(null);
    try {
      await Promise.all(
        (['signals', 'insights', 'verdicts', 'hedges'] as const).map((a) => generateOne(a)),
      );
      setTimeout(() => setReload((n) => n + 1), 600);
    } catch (e) {
      setGenErr(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  return (
    <div className="ai-assistant-layout">
    <div className="ai-assistant-page">
      <header className="settings-header ai-assistant-header">
        <div>
          <h1 className="settings-title">AI Assistant — History</h1>
          <p className="settings-sub">
            Every AI generation is persisted server-side (last 50 per area).
            Browse, inspect token usage, or re-run any prior call.
          </p>
        </div>
        {/* Global action — distinct level from per-tab Generate. */}
        <button
          type="button"
          className="ai-trigger-btn"
          onClick={() => void onGenerateAll()}
          disabled={generating != null}
          title="Generate fresh batch for all four areas in parallel"
          style={{ alignSelf: 'flex-start' }}
        >
          {generating === 'all' ? 'Generating all…' : '⚡ Generate All'}
        </button>
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
        {/* Per-tab actions — tied to the active area. */}
        <div className="ai-tab-actions">
          <button
            type="button"
            className="ai-trigger-btn"
            onClick={() => void onGenerateActive()}
            disabled={generating != null}
            title={`Generate fresh ${active}`}
          >
            {generating === active ? 'Generating…' : `+ Generate ${active}`}
          </button>
          <button
            type="button"
            className="ai-trigger-btn ghost"
            onClick={onClear}
            disabled={!entries.length || loading}
            title={`Clear ${active} history`}
          >
            Clear
          </button>
        </div>
      </div>
      {genErr && (
        <div className="wf-mini" style={{ color: 'var(--down)', padding: '4px 14px' }}>
          {genErr}
        </div>
      )}

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
    <UsagePanel history={allHistory} />
    </div>
  );
}

// ─── Usage panel (right sidebar) ────────────────────────────────────────────

interface UsagePanelProps { history: AIHistory | null }

function UsagePanel({ history }: UsagePanelProps) {
  const stats = useMemo(() => computeStats(history), [history]);

  return (
    <aside className="ai-usage-panel" aria-label="AI usage summary">
      <div className="wf-label">AI Usage</div>
      <div className="wf-mini muted-2" style={{ marginTop: 2, marginBottom: 14 }}>
        Lifetime — across all areas
      </div>

      <div className="ai-usage-stats">
        <div className="ai-usage-stat">
          <div className="wf-mini muted-2">Calls</div>
          <div className="wf-num" style={{ fontSize: 22 }}>{stats.totalCalls.toLocaleString()}</div>
        </div>
        <div className="ai-usage-stat">
          <div className="wf-mini muted-2">Tokens</div>
          <div className="wf-num" style={{ fontSize: 22 }}>{fmtTokensShort(stats.totalTokens)}</div>
        </div>
        <div className="ai-usage-stat">
          <div className="wf-mini muted-2">Est. cost</div>
          <div className="wf-num" style={{ fontSize: 22, color: 'var(--orange)' }}>
            {stats.totalCost > 0 ? formatUSD(stats.totalCost) : '$0'}
          </div>
        </div>
      </div>

      <div className="wf-label" style={{ marginTop: 16, marginBottom: 6 }}>By area</div>
      <div className="ai-usage-by-area">
        {(['signals', 'insights', 'verdicts', 'hedges'] as const).map((a) => {
          const s = stats.byArea[a];
          const pct = stats.totalCalls > 0 ? (s.calls / stats.totalCalls) * 100 : 0;
          return (
            <div key={a} className="ai-usage-area-row">
              <span className="ai-usage-area-name">{a}</span>
              <span className="ai-usage-area-bar-wrap" aria-hidden>
                <span
                  className="ai-usage-area-bar"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="wf-mono ai-usage-area-num">{s.calls}</span>
              <span className="wf-mono muted ai-usage-area-num">{fmtTokensShort(s.tokens)}</span>
            </div>
          );
        })}
      </div>

      <div className="wf-label" style={{ marginTop: 16, marginBottom: 6 }}>
        Tokens / call · last {stats.recent.length}
      </div>
      <UsageBars points={stats.recent} />
      {stats.recent.length === 0 && (
        <div className="ai-empty" style={{ padding: 8 }}>No calls yet.</div>
      )}

      {stats.lastCallAt && (
        <div className="wf-mini muted-2" style={{ marginTop: 12 }}>
          Last call {new Date(stats.lastCallAt).toLocaleString()}
        </div>
      )}
    </aside>
  );
}

interface RecentPoint { ts: number; tokens: number; area: Area }

interface UsageStats {
  totalCalls:  number;
  totalTokens: number;
  totalCost:   number;
  byArea: Record<Area, { calls: number; tokens: number; cost: number }>;
  recent:      RecentPoint[];
  lastCallAt:  number | null;
}

function computeStats(h: AIHistory | null): UsageStats {
  const empty: UsageStats = {
    totalCalls: 0, totalTokens: 0, totalCost: 0,
    byArea: {
      signals:  { calls: 0, tokens: 0, cost: 0 },
      insights: { calls: 0, tokens: 0, cost: 0 },
      verdicts: { calls: 0, tokens: 0, cost: 0 },
      hedges:   { calls: 0, tokens: 0, cost: 0 },
    },
    recent: [], lastCallAt: null,
  };
  if (!h) return empty;
  const out = { ...empty, byArea: { ...empty.byArea } };

  const all: { entry: HistoryEntry; area: Area }[] = [];
  (['signals', 'insights', 'verdicts', 'hedges'] as const).forEach((area) => {
    for (const e of h[area] ?? []) all.push({ entry: e, area });
  });

  for (const { entry, area } of all) {
    const u = entry.usage;
    const tokens = (u?.totalTokens ?? ((u?.inputTokens ?? 0) + (u?.outputTokens ?? 0)));
    const cost = estimateCost({
      provider: entry.provider as AIMeta['provider'],
      model:    entry.model,
      usage:    u,
    }) ?? 0;
    out.totalCalls  += 1;
    out.totalTokens += tokens;
    out.totalCost   += cost;
    out.byArea[area].calls  += 1;
    out.byArea[area].tokens += tokens;
    out.byArea[area].cost   += cost;
    if (out.lastCallAt === null || entry.createdAt > out.lastCallAt) {
      out.lastCallAt = entry.createdAt;
    }
  }

  // Recent: last 30 calls across all areas, sorted ascending by ts.
  const recent = all
    .map(({ entry, area }) => ({
      ts:     entry.createdAt,
      tokens: entry.usage?.totalTokens ?? ((entry.usage?.inputTokens ?? 0) + (entry.usage?.outputTokens ?? 0)),
      area,
    }))
    .sort((a, b) => a.ts - b.ts)
    .slice(-30);
  out.recent = recent;

  return out;
}

const AREA_COLORS: Record<Area, string> = {
  signals:  'var(--orange)',
  insights: '#6fcf8a',
  verdicts: '#7a93e8',
  hedges:   '#c178e8',
};

function UsageBars({ points }: { points: RecentPoint[] }) {
  if (points.length === 0) return <div className="ai-usage-bars" />;
  const maxT = Math.max(...points.map((p) => p.tokens), 1);
  const W = 240;
  const H = 60;
  const bw = points.length > 0 ? Math.max(2, (W - (points.length - 1) * 2) / points.length) : 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="ai-usage-bars">
      {points.map((p, i) => {
        const x = i * (bw + 2);
        const h = (p.tokens / maxT) * (H - 2);
        const y = H - h;
        return (
          <rect
            key={i}
            x={x} y={y}
            width={bw} height={Math.max(h, 1)}
            fill={AREA_COLORS[p.area]}
            opacity={0.85}
          >
            <title>
              {new Date(p.ts).toLocaleString()} · {p.area} · {p.tokens.toLocaleString()} tokens
            </title>
          </rect>
        );
      })}
    </svg>
  );
}

function fmtTokensShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
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
