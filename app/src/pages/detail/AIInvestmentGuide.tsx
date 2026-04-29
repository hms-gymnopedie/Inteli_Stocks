export function AIInvestmentGuide() {
  return (
    <div>
      <div className="wf-label">AI Investment Guide</div>
      <div className="wf-panel-flat" style={{ padding: 10, marginTop: 8 }}>
        <div className="wf-num" style={{ fontSize: 22 }}>
          72
          <span className="muted-2" style={{ fontSize: 12 }}>
            /100
          </span>
        </div>
        <div className="wf-mini accent">CONVICTION SCORE</div>
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: 'var(--fg-2)',
            lineHeight: 1.5,
          }}
        >
          Momentum + earnings revisions positive; valuation full but
          justified by AI capex cycle.{' '}
          <span className="accent">Stagger entries</span> below $890 with
          6M horizon.
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
          <div className="row between">
            <span className="muted">MOMENTUM</span>
            <span className="up">▮▮▮▮▯ 4/5</span>
          </div>
          <div className="row between">
            <span className="muted">VALUATION</span>
            <span className="down">▮▮▯▯▯ 2/5</span>
          </div>
          <div className="row between">
            <span className="muted">QUALITY</span>
            <span className="up">▮▮▮▮▮ 5/5</span>
          </div>
          <div className="row between">
            <span className="muted">SENTIMENT</span>
            <span className="accent">▮▮▮▮▯ 4/5</span>
          </div>
          <div className="row between">
            <span className="muted">GEO RISK</span>
            <span className="down">▮▮▮▯▯ 3/5</span>
          </div>
        </div>
      </div>
    </div>
  );
}
