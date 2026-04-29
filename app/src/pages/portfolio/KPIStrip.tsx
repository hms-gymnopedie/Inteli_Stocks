import { Spark } from '../../lib/primitives';

const HEADER_KPIS: [string, string, string][] = [
  ['EXPOSURE', '92%', 'cash 8%'],
  ['RISK SCORE', '3.2/5', 'moderate-aggr'],
  ['DRAWDOWN', '−4.1%', 'from peak'],
];

export function KPIStrip() {
  return (
    <div
      className="wf-panel"
      style={{
        padding: 14,
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
        gap: 18,
      }}
    >
      <div>
        <div className="wf-label">Net Asset Value</div>
        <div className="wf-num" style={{ fontSize: 30 }}>
          $1,284,<span className="muted">420</span>
        </div>
        <div className="up wf-mono" style={{ fontSize: 12 }}>
          +$27,318 (+2.18%) · TODAY
        </div>
        <div className="wf-mini muted-2" style={{ marginTop: 4 }}>
          YTD +18.4% · 1Y +34.2% · SHARPE 1.81
        </div>
      </div>
      {HEADER_KPIS.map((m, i) => (
        <div key={m[0]}>
          <div className="wf-mini">{m[0]}</div>
          <div className="wf-num" style={{ fontSize: 22, marginTop: 2 }}>
            {m[1]}
          </div>
          <div className="wf-mini muted-2">{m[2]}</div>
          <div style={{ marginTop: 6 }}>
            <Spark
              seed={50 + i}
              trend={i % 2 ? -0.3 : 0.4}
              w={200}
              h={26}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
