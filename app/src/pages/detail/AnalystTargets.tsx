export function AnalystTargets() {
  return (
    <div>
      <div className="wf-label">Analyst targets</div>
      <div className="wf-panel-flat" style={{ padding: 10, marginTop: 8 }}>
        <div style={{ position: 'relative', height: 30 }}>
          <div
            style={{
              position: 'absolute',
              left: '10%',
              right: '5%',
              top: 14,
              height: 1,
              background: 'var(--hairline-2)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '38%',
              top: 8,
              width: 2,
              height: 14,
              background: 'var(--fg)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '60%',
              top: 8,
              width: 2,
              height: 14,
              background: 'var(--orange)',
            }}
          />
        </div>
        <div className="row between wf-mini" style={{ marginTop: 4 }}>
          <span>LOW $720</span>
          <span className="accent">TGT $1,040</span>
          <span>HIGH $1,200</span>
        </div>
        <div
          className="row between wf-mini muted-2"
          style={{ marginTop: 6 }}
        >
          <span>BUY 38</span>
          <span>HOLD 7</span>
          <span>SELL 1</span>
        </div>
      </div>
    </div>
  );
}
