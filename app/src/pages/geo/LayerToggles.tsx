const LAYERS: [string, boolean][] = [
  ['Country risk heatmap', true],
  ['Conflict / event pins', true],
  ['Trade flow lines', true],
  ['Energy & commodity sites', false],
  ['Sanction zones', false],
  ['Shipping lanes', false],
];

export function LayerToggles() {
  return (
    <div
      className="wf-panel"
      style={{
        padding: 12,
        backdropFilter: 'blur(8px)',
        background: 'rgba(20,20,22,0.7)',
      }}
    >
      <div className="wf-label">Layers</div>
      <div
        style={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
        }}
      >
        {LAYERS.map(([n, on]) => (
          <div
            key={n}
            className="row between"
            style={{ color: on ? 'var(--fg)' : 'var(--fg-3)' }}
          >
            <span>{n}</span>
            <span
              style={{
                width: 22,
                height: 12,
                borderRadius: 6,
                background: on ? 'var(--orange)' : 'var(--hairline-2)',
                position: 'relative',
                display: 'inline-block',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 1,
                  ...(on ? { right: 1 } : { left: 1 }),
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#fff',
                }}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
