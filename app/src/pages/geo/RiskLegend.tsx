export function RiskLegend() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 14,
        left: 14,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: '6px 12px',
        background: 'rgba(20,20,22,0.7)',
        border: '1px solid var(--hairline)',
        borderRadius: 999,
        backdropFilter: 'blur(8px)',
      }}
    >
      <span className="wf-mini">RISK</span>
      <span className="wf-mini" style={{ color: 'var(--up)' }}>
        ● LOW
      </span>
      <span className="wf-mini" style={{ color: 'var(--orange)' }}>
        ● MED
      </span>
      <span className="wf-mini" style={{ color: 'var(--down)' }}>
        ● HIGH
      </span>
      <span className="wf-mini muted-2" style={{ marginLeft: 12 }}>
        UPDATED 26 APR · 09:42 KST
      </span>
    </div>
  );
}
