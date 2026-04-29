export function AISignals() {
  return (
    <div>
      <div className="row between">
        <div className="wf-label">AI Assistant</div>
        <div className="chip dot warn">SYNTH</div>
      </div>
      <div className="wf-panel-flat" style={{ padding: 10, marginTop: 8 }}>
        <div className="wf-mini accent" style={{ marginBottom: 6 }}>
          // SIGNAL · 4m AGO
        </div>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.45,
            color: 'var(--fg-2)',
          }}
        >
          Semis breaking{' '}
          <span style={{ color: 'var(--fg)' }}>+3.2σ</span> above 20D
          mean. NVDA leads, options skew flipping bullish into earnings
          window.
        </div>
        <div className="row gap-2" style={{ marginTop: 8 }}>
          <span className="tag">RISK 2/5</span>
          <span
            className="tag"
            style={{
              color: 'var(--orange)',
              borderColor: 'var(--orange)',
            }}
          >
            ACTION · ADD
          </span>
        </div>
      </div>
      <div className="wf-panel-flat" style={{ padding: 10, marginTop: 8 }}>
        <div
          className="wf-mini"
          style={{ color: 'var(--down)', marginBottom: 6 }}
        >
          // CAUTION · 18m AGO
        </div>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.45,
            color: 'var(--fg-2)',
          }}
        >
          Energy drawdown widens. WTI breaks 50D MA support; geopolitical
          premium fading. Watch XLE for follow-through.
        </div>
        <div className="row gap-2" style={{ marginTop: 8 }}>
          <span className="tag">RISK 4/5</span>
          <span className="tag">ACTION · TRIM</span>
        </div>
      </div>
    </div>
  );
}
