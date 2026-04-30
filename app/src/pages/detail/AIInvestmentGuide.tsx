import { getVerdict } from '../../data/ai';
import type { AIVerdict, ConvictionAxis } from '../../data/types';
import { useAsync } from '../../lib/useAsync';

interface AIInvestmentGuideProps {
  /**
   * Symbol to fetch the verdict for. Optional today so the section keeps
   * rendering until B4-RT rewrites `pages/detail/index.tsx` to pass the
   * route param through. Defaults to NVDA — same hardcoded symbol the rest
   * of the Detail page uses pre-B4-RT.
   */
  symbol?: string;
}

const SKELETON_AXES: ConvictionAxis[] = [
  { label: 'MOMENTUM',  score: 0, maxScore: 5, color: 'accent' },
  { label: 'VALUATION', score: 0, maxScore: 5, color: 'accent' },
  { label: 'QUALITY',   score: 0, maxScore: 5, color: 'accent' },
  { label: 'SENTIMENT', score: 0, maxScore: 5, color: 'accent' },
  { label: 'GEO RISK',  score: 0, maxScore: 5, color: 'accent' },
];

export function AIInvestmentGuide({ symbol = 'NVDA' }: AIInvestmentGuideProps) {
  const { data, loading } = useAsync<AIVerdict>(
    () => getVerdict(symbol),
    [symbol],
  );

  const dimmed = loading && !data ? { opacity: 0.4 } : undefined;
  const axes = data?.axes ?? SKELETON_AXES;

  return (
    <div>
      <div className="wf-label">AI Investment Guide</div>
      <div
        className="wf-panel-flat"
        style={{ padding: 10, marginTop: 8, ...dimmed }}
        aria-busy={loading}
      >
        <div className="wf-num" style={{ fontSize: 22 }}>
          {data ? data.convictionScore : '—'}
          <span className="muted-2" style={{ fontSize: 12 }}>
            /100
          </span>
        </div>
        <div className="wf-mini accent">
          {data ? `CONVICTION · ${data.verdict}` : 'CONVICTION SCORE'}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: 'var(--fg-2)',
            lineHeight: 1.5,
          }}
        >
          {data ? data.summary : 'Loading verdict…'}
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
      </div>
    </div>
  );
}

function AxisRow({ axis }: { axis: ConvictionAxis }) {
  const colorClass =
    axis.color === 'up'
      ? 'up'
      : axis.color === 'down'
        ? 'down'
        : 'accent';
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
