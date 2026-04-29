export function AIHedgeSuggestion() {
  return (
    <div style={{ padding: 14 }}>
      <div className="wf-label">AI · Hedge suggestion</div>
      <div className="wf-panel-flat" style={{ padding: 10, marginTop: 8 }}>
        <div className="wf-mini accent">// PROPOSAL</div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--fg-2)',
            lineHeight: 1.5,
            marginTop: 4,
          }}
        >
          Reduce semi exposure 4pp; rotate into utilities + USD cash.
          Hedge with SOXX 6M 5% OTM puts. Expected drawdown trim:{' '}
          <span className="accent">−2.1pp</span>.
        </div>
        <div className="row gap-2" style={{ marginTop: 8 }}>
          <span
            className="tag"
            style={{
              color: 'var(--orange)',
              borderColor: 'var(--orange)',
            }}
          >
            SIMULATE
          </span>
          <span className="tag">DISMISS</span>
        </div>
      </div>
    </div>
  );
}
