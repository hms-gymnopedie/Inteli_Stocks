import { getFearGreed } from '../../data/market';
import type { FearGreed } from '../../data/types';
import { Gauge } from '../../lib/primitives';
import { useAsync } from '../../lib/useAsync';

/** Skeleton placeholder used while the fetch is in flight. */
const SKELETON: FearGreed = {
  value:     0,
  label:     '——',
  yesterday: 0,
  oneWeek:   0,
  oneMonth:  0,
};

export function Sentiment() {
  const { data, loading } = useAsync<FearGreed>(getFearGreed, []);
  const fg = data ?? SKELETON;
  const dimmed = loading && !data ? { opacity: 0.4 } : undefined;

  return (
    <div>
      <div className="wf-label">Market sentiment</div>
      <div
        className="wf-panel-flat"
        style={{ padding: 10, marginTop: 8, ...dimmed }}
        aria-busy={loading}
      >
        <Gauge value={fg.value} label={fg.label} />
        <div className="row between wf-mini" style={{ marginTop: 6 }}>
          <span>YESTERDAY {fg.yesterday}</span>
          <span>1W {fg.oneWeek}</span>
          <span>1M {fg.oneMonth}</span>
        </div>
      </div>
    </div>
  );
}
