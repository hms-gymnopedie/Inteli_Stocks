import { getTargets } from '../../data/security';
import type { AnalystTarget } from '../../data/types';
import { formatPrice } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

interface AnalystTargetsProps {
  symbol: string;
}

/**
 * Analyst price-target distribution. Renders a low/consensus/high range bar
 * with two markers — a faint "current" hint at 38% (we don't have current
 * price wired in here yet) and the consensus target at the proportional
 * position between low and high.
 *
 * Falls back to a dimmed placeholder when targets are missing (non-NVDA mock).
 */
export function AnalystTargets({ symbol }: AnalystTargetsProps) {
  const { data, loading } = useAsync(() => getTargets(symbol), [symbol]);

  return (
    <div aria-busy={loading}>
      <div className="wf-label">Analyst targets</div>
      <div
        className="wf-panel-flat"
        style={{
          padding: 10,
          marginTop: 8,
          opacity: loading && !data ? 0.4 : 1,
          transition: 'opacity 120ms linear',
        }}
      >
        {data ? <Loaded t={data} /> : <Empty />}
      </div>
    </div>
  );
}

function Loaded({ t }: { t: AnalystTarget }) {
  const formatTarget = (n: number) =>
    formatPrice(n, { currency: t.currency, decimals: 0 });

  // Consensus position relative to [low, high].
  const span = t.high - t.low || 1;
  const consensusPct = ((t.consensus - t.low) / span) * 100;
  // Clamp to [5%, 95%] of the bar width so the marker stays inside the rail.
  const railLeft = 5;
  const railRight = 95;
  const railSpan = railRight - railLeft;
  const consensusLeft = railLeft + (consensusPct / 100) * railSpan;
  // Faint "current price" sits 38% of the way from low to high (placeholder
  // until we wire the live price source through; matches prototype look).
  const currentLeft = railLeft + 0.38 * railSpan;

  return (
    <>
      <div style={{ position: 'relative', height: 30 }}>
        <div
          style={{
            position: 'absolute',
            left: `${railLeft}%`,
            right: `${100 - railRight}%`,
            top: 14,
            height: 1,
            background: 'var(--hairline-2)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${currentLeft}%`,
            top: 8,
            width: 2,
            height: 14,
            background: 'var(--fg)',
          }}
          aria-label="Current price marker"
        />
        <div
          style={{
            position: 'absolute',
            left: `${consensusLeft}%`,
            top: 8,
            width: 2,
            height: 14,
            background: 'var(--orange)',
          }}
          aria-label="Consensus target marker"
        />
      </div>
      <div className="row between wf-mini" style={{ marginTop: 4 }}>
        <span>LOW {formatTarget(t.low)}</span>
        <span className="accent">TGT {formatTarget(t.consensus)}</span>
        <span>HIGH {formatTarget(t.high)}</span>
      </div>
      <div
        className="row between wf-mini muted-2"
        style={{ marginTop: 6 }}
      >
        <span>BUY {t.buys}</span>
        <span>HOLD {t.holds}</span>
        <span>SELL {t.sells}</span>
      </div>
    </>
  );
}

function Empty() {
  return (
    <>
      <div style={{ position: 'relative', height: 30 }}>
        <div
          style={{
            position: 'absolute',
            left: '5%',
            right: '5%',
            top: 14,
            height: 1,
            background: 'var(--hairline-2)',
          }}
        />
      </div>
      <div className="row between wf-mini muted-2" style={{ marginTop: 4 }}>
        <span>LOW —</span>
        <span>TGT —</span>
        <span>HIGH —</span>
      </div>
      <div
        className="row between wf-mini muted-2"
        style={{ marginTop: 6 }}
      >
        <span>BUY —</span>
        <span>HOLD —</span>
        <span>SELL —</span>
      </div>
    </>
  );
}
