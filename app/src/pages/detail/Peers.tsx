import { getPeers } from '../../data/security';
import type { Peer } from '../../data/types';
import { Spark } from '../../lib/primitives';
import { useAsync } from '../../lib/useAsync';

interface PeersProps {
  symbol: string;
  /**
   * Optional callback when a peer row is clicked. Lets the parent swap the
   * detail symbol prop. Wiring this is optional in Phase 1 — B4-RT will turn
   * peer clicks into route navigation instead.
   */
  onPeerClick?: (symbol: string) => void;
}

const SKELETON_ROWS = 4;

export function Peers({ symbol, onPeerClick }: PeersProps) {
  const { data, loading } = useAsync(() => getPeers(symbol), [symbol]);

  return (
    <div aria-busy={loading}>
      <div className="wf-label">Peers</div>
      <div
        style={{
          marginTop: 8,
          opacity: loading && !data ? 0.4 : 1,
          transition: 'opacity 120ms linear',
        }}
      >
        {data
          ? data.length === 0
            ? <Empty />
            : data.map((p) => (
                <Row key={p.symbol} peer={p} onClick={onPeerClick} />
              ))
          : Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <SkeletonRow key={i} seed={30 + i} />
            ))}
      </div>
    </div>
  );
}

function Row({
  peer,
  onClick,
}: {
  peer: Peer;
  onClick?: (symbol: string) => void;
}) {
  const isClickable = !!onClick;
  const handle = () => onClick?.(peer.symbol);
  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : -1}
      onClick={handle}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handle();
        }
      }}
      className="row between"
      style={{
        padding: '6px 0',
        borderBottom: '1px solid var(--hairline)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        cursor: isClickable ? 'pointer' : 'default',
      }}
    >
      <span className="ticker">{peer.symbol}</span>
      <span className="muted">{peer.price}</span>
      <Spark
        seed={peer.seed}
        trend={peer.direction * 0.4}
        color={peer.direction > 0 ? 'var(--up)' : 'var(--down)'}
      />
      <span
        style={{ color: peer.direction > 0 ? 'var(--up)' : 'var(--down)' }}
      >
        {peer.change}
      </span>
    </div>
  );
}

function SkeletonRow({ seed }: { seed: number }) {
  return (
    <div
      className="row between"
      style={{
        padding: '6px 0',
        borderBottom: '1px solid var(--hairline)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--fg-4)',
      }}
    >
      <span className="ticker">———</span>
      <span className="muted">—</span>
      <Spark seed={seed} trend={0} color="var(--fg-4)" />
      <span>—</span>
    </div>
  );
}

function Empty() {
  return (
    <div
      className="muted wf-mini"
      style={{ padding: '12px 0', fontStyle: 'italic' }}
    >
      No peers available.
    </div>
  );
}
