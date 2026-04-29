export function LiveAlertCard() {
  return (
    <div
      className="wf-panel"
      style={{
        padding: 12,
        backdropFilter: 'blur(8px)',
        background: 'rgba(20,20,22,0.7)',
      }}
    >
      <div className="row between">
        <div className="wf-label">Live · Alert</div>
        <div className="chip dot warn">HIGH</div>
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          lineHeight: 1.45,
          color: 'var(--fg)',
        }}
      >
        Taiwan Strait · naval activity escalation
      </div>
      <div
        className="muted"
        style={{ fontSize: 11, marginTop: 4 }}
      >
        Semi supply-chain exposure: TSM, ASML, NVDA. Estimated revenue
        drag if disruption:{' '}
        <span className="accent">−6.4%</span> (Q3).
      </div>
      <div className="row gap-2" style={{ marginTop: 10 }}>
        <span
          className="tag"
          style={{
            color: 'var(--orange)',
            borderColor: 'var(--orange)',
          }}
        >
          HEDGE · SOXX PUT
        </span>
        <span className="tag">DETAIL ↗</span>
      </div>
    </div>
  );
}
