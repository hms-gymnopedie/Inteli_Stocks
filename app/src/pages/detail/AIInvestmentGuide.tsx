import { useEffect, useMemo, useState } from 'react';

import { getAIHistory, getVerdict } from '../../data/ai';
import type { HistoryEntry } from '../../data/aiHistoryTypes';
import type { AIMeta, AIResponse, AIVerdict, ConvictionAxis } from '../../data/types';
import { AITokenFooter } from '../../lib/AITokenFooter';
import { formatTime } from '../../lib/format';
import { useTweaks } from '../../lib/tweaks';
import { useOnDemand } from '../../lib/useOnDemand';

interface AIInvestmentGuideProps {
  symbol?: string;
}

const PLACEHOLDER_AXES: ConvictionAxis[] = [
  { label: 'MOMENTUM',  score: 0, maxScore: 5, color: 'accent' },
  { label: 'VALUATION', score: 0, maxScore: 5, color: 'accent' },
  { label: 'QUALITY',   score: 0, maxScore: 5, color: 'accent' },
  { label: 'SENTIMENT', score: 0, maxScore: 5, color: 'accent' },
  { label: 'GEO RISK',  score: 0, maxScore: 5, color: 'accent' },
];

export function AIInvestmentGuide({ symbol = 'NVDA' }: AIInvestmentGuideProps) {
  const { values } = useTweaks();
  const tz = values.timezone || 'America/New_York';
  const tzAbbrev =
    tz === 'America/New_York' ? 'NY'
    : tz === 'Asia/Seoul'      ? 'KST'
    : tz === 'Europe/London'   ? 'LDN'
    : 'UTC';

  // Hydrate from server-persisted history. Pull last 50 entries and pick
  // the most-recent one whose `symbol` matches the current ticker.
  const upper = symbol.trim().toUpperCase();
  const [seed, setSeed] = useState<{ data: AIResponse<AIVerdict>; at: number } | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(false);
    setSeed(null);
    let cancelled = false;
    getAIHistory('verdicts', 50).then((entries: HistoryEntry[]) => {
      if (cancelled) return;
      // entries are oldest-first; iterate from the end.
      for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i];
        if ((e.symbol ?? '').toUpperCase() === upper) {
          const meta: AIMeta = {
            provider: e.provider as AIMeta['provider'],
            model:    e.model,
            usage:    e.usage,
          };
          setSeed({ data: { data: e.data as AIVerdict, meta }, at: e.createdAt });
          break;
        }
      }
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, [upper]);

  const initial = useMemo(
    () => seed ? { data: seed.data, receivedAt: seed.at } : undefined,
    [seed],
  );

  return hydrated
    ? <Inner symbol={symbol} initial={initial} tz={tz} tzAbbrev={tzAbbrev} />
    : <Inner symbol={symbol} initial={undefined} tz={tz} tzAbbrev={tzAbbrev} loadingHistory />;
}

interface InnerProps {
  symbol:    string;
  initial:   { data: AIResponse<AIVerdict>; receivedAt: number } | undefined;
  tz:        string;
  tzAbbrev:  string;
  loadingHistory?: boolean;
}

function Inner({ symbol, initial, tz, tzAbbrev, loadingHistory }: InnerProps) {
  const verdict = useOnDemand<AIResponse<AIVerdict>>(() => getVerdict(symbol), initial);
  const result = verdict.data?.data;
  const meta = verdict.data?.meta ?? null;
  const axes = result?.axes ?? PLACEHOLDER_AXES;
  const dimmed = !result ? { opacity: 0.5 } : undefined;

  return (
    <div>
      <div className="row between">
        <div className="wf-label">AI Investment Guide</div>
        {loadingHistory ? (
          <span className="ai-badge loading">Loading…</span>
        ) : verdict.loading ? (
          <span className="ai-badge loading">Generating…</span>
        ) : verdict.error ? (
          <span className="ai-badge err" title={verdict.error.message}>Failed</span>
        ) : verdict.lastReceivedAt ? (
          <span className="ai-badge ok">
            @ {formatTime(verdict.lastReceivedAt, { timeZone: tz, abbreviation: tzAbbrev })}
          </span>
        ) : (
          <span className="ai-badge idle">Idle</span>
        )}
      </div>

      <div className="row" style={{ marginTop: 8, gap: 6 }}>
        <button
          type="button"
          className="ai-trigger-btn"
          onClick={verdict.run}
          disabled={verdict.loading}
        >
          {verdict.loading
            ? 'Analyzing…'
            : verdict.data
              ? `↻ Re-analyze ${symbol}`
              : `Analyze ${symbol}`}
        </button>
      </div>

      <div
        className="wf-panel-flat"
        style={{ padding: 10, marginTop: 8, ...dimmed }}
        aria-busy={verdict.loading}
      >
        <div className="wf-num" style={{ fontSize: 22 }}>
          {result ? result.convictionScore : '—'}
          <span className="muted-2" style={{ fontSize: 12 }}>/100</span>
        </div>
        <div className="wf-mini accent">
          {result ? `CONVICTION · ${result.verdict}` : 'CONVICTION SCORE'}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: 'var(--fg-2)',
            lineHeight: 1.5,
          }}
        >
          {verdict.error
            ? `Generation failed: ${verdict.error.message}`
            : result
              ? result.summary
              : 'Click the button above to ask the AI for a verdict.'}
        </div>
        <hr className="wf-divider" style={{ margin: '10px 0' }} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
          }}
        >
          {axes.map((axis) => (
            <AxisRow key={axis.label} axis={axis} />
          ))}
        </div>
        {result && <AITokenFooter meta={meta} />}
      </div>
    </div>
  );
}

function AxisRow({ axis }: { axis: ConvictionAxis }) {
  const colorClass =
    axis.color === 'up' ? 'up' : axis.color === 'down' ? 'down' : 'accent';
  return (
    <div className="row between">
      <span className="muted">{axis.label}</span>
      <span className={colorClass}>
        {renderBar(axis.score, axis.maxScore)} {axis.score}/{axis.maxScore}
      </span>
    </div>
  );
}

function renderBar(score: number, maxScore: number): string {
  const filled = Math.max(0, Math.min(maxScore, score));
  const empty = maxScore - filled;
  return '▮'.repeat(filled) + '▯'.repeat(empty);
}
