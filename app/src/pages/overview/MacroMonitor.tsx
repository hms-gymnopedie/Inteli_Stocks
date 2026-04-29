import { Spark } from '../../lib/primitives';

export function MacroMonitor() {
  return (
    <div className="wf-panel" style={{ padding: 12 }}>
      <div className="row between">
        <div className="wf-label">Macro Monitor</div>
        <div className="wf-mini muted-2">Fed · BoK · ECB</div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginTop: 10,
        }}
      >
        {[
          {
            t: 'US 10Y',
            v: '4.412',
            d: '+2.1bp',
            s: 11,
            tr: 0.5,
          },
          {
            t: 'CPI YoY',
            v: '3.20%',
            d: '−0.10',
            s: 12,
            tr: -0.3,
          },
          {
            t: 'USD/KRW',
            v: '1,378.4',
            d: '+0.42%',
            s: 13,
            tr: 0.4,
          },
          {
            t: 'WTI Crude',
            v: '$78.42',
            d: '−1.18%',
            s: 14,
            tr: -0.5,
          },
        ].map((m, i) => (
          <div
            key={m.t}
            style={{
              borderLeft: i ? '1px solid var(--hairline)' : 0,
              paddingLeft: i ? 12 : 0,
            }}
          >
            <div className="wf-mini">{m.t}</div>
            <div
              className="wf-num"
              style={{ fontSize: 22, marginTop: 2 }}
            >
              {m.v}
            </div>
            <div
              className="wf-mono"
              style={{
                fontSize: 10,
                color: m.d.startsWith('+')
                  ? 'var(--up)'
                  : 'var(--down)',
              }}
            >
              {m.d}
            </div>
            <div style={{ marginTop: 4 }}>
              <Spark seed={m.s} trend={m.tr} w={200} h={26} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
