import { getFilings } from '../../data/security';
import type { Filing } from '../../data/types';
import { useAsync } from '../../lib/useAsync';

interface DisclosuresFeedProps {
  /**
   * Symbol to fetch filings for. Optional today so the section keeps
   * rendering until B4-RT rewrites `pages/detail/index.tsx` to pass the
   * route param through. Defaults to NVDA — same hardcoded symbol the rest
   * of the Detail page uses pre-B4-RT.
   */
  symbol?: string;
}

const SKELETON_ROWS: Filing[] = Array.from({ length: 5 }, () => ({
  date:        '——',
  form:        '—',
  description: '——————————————',
  impact:      'low',
}));

export function DisclosuresFeed({ symbol = 'NVDA' }: DisclosuresFeedProps) {
  const { data, loading } = useAsync<Filing[]>(
    () => getFilings(symbol),
    [symbol],
  );

  const rows = data ?? SKELETON_ROWS;
  const dimmed = loading && !data ? { opacity: 0.4 } : undefined;
  const isEmpty = data !== undefined && data.length === 0;

  return (
    <div className="wf-panel" style={{ padding: 12 }}>
      <div className="row between">
        <div className="wf-label">Disclosures · Filings</div>
        <span className="wf-mini muted">last 30D</span>
      </div>
      <div style={{ marginTop: 8, ...dimmed }} aria-busy={loading}>
        {isEmpty ? (
          <div
            className="wf-mini muted"
            style={{ padding: '12px 0', textAlign: 'center' }}
          >
            No filings on record for {symbol}.
          </div>
        ) : (
          rows.map((r, i) => <FilingRow key={`${r.date}-${r.form}-${i}`} filing={r} />)
        )}
      </div>
    </div>
  );
}

function FilingRow({ filing }: { filing: Filing }) {
  const impactColor =
    filing.impact === 'high'
      ? 'var(--orange)'
      : filing.impact === 'med'
        ? 'var(--fg-2)'
        : 'var(--fg-4)';

  return (
    <div
      className="row gap-3"
      style={{
        padding: '7px 0',
        borderBottom: '1px solid var(--hairline)',
        fontSize: 11,
      }}
    >
      <span className="wf-mono muted" style={{ width: 64 }}>
        {filing.date}
      </span>
      <span className="tag" style={{ width: 50, textAlign: 'center' }}>
        {filing.form}
      </span>
      <span style={{ flex: 1, color: 'var(--fg-2)' }}>
        {filing.description}
      </span>
      <span className="wf-mini" style={{ color: impactColor }}>
        {filing.impact.toUpperCase()}
      </span>
    </div>
  );
}
