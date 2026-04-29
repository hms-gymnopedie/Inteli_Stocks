export function GlobalRiskIndex() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        left: 14,
        display: 'flex',
        gap: 8,
      }}
    >
      <div
        className="wf-panel"
        style={{
          padding: '8px 12px',
          backdropFilter: 'blur(8px)',
          background: 'rgba(20,20,22,0.7)',
        }}
      >
        <div className="wf-mini">GLOBAL RISK INDEX</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
          }}
        >
          <div className="wf-num accent" style={{ fontSize: 28 }}>
            71
            <span className="muted-2" style={{ fontSize: 14 }}>
              /100
            </span>
          </div>
          <div className="wf-mono down" style={{ fontSize: 11 }}>
            +4 24H
          </div>
        </div>
        <div className="wf-mini">ELEVATED · ASIA-PACIFIC LEADING</div>
      </div>
    </div>
  );
}
