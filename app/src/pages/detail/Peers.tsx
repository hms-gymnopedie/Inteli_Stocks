import { Spark } from '../../lib/primitives';

const PEERS: [string, string, string, number, number][] = [
  ['AMD', '$162.4', '+1.84%', 1, 31],
  ['TSM', '$148.2', '+2.14%', 1, 32],
  ['INTC', ' $34.1', '−0.62%', -1, 33],
  ['ASML', '$928.5', '+1.10%', 1, 34],
];

export function Peers() {
  return (
    <div>
      <div className="wf-label">Peers</div>
      <div style={{ marginTop: 8 }}>
        {PEERS.map((r) => (
          <div
            key={r[0]}
            className="row between"
            style={{
              padding: '6px 0',
              borderBottom: '1px solid var(--hairline)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
            }}
          >
            <span className="ticker">{r[0]}</span>
            <span className="muted">{r[1]}</span>
            <Spark
              seed={r[4]}
              trend={r[3] * 0.4}
              color={r[3] > 0 ? 'var(--up)' : 'var(--down)'}
            />
            <span
              style={{ color: r[3] > 0 ? 'var(--up)' : 'var(--down)' }}
            >
              {r[2]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
