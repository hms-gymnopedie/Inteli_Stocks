const HOTSPOTS: [string, string, 'high' | 'med', string][] = [
  ['Taiwan Strait', 'Semis · 32% impact', 'high', 'NVDA TSM ASML'],
  ['Russia-Ukraine', 'Energy · 18% impact', 'high', 'XOM CVX BP'],
  ['Middle East', 'Crude · 14% impact', 'med', 'WTI BRENT'],
  ['Korea Peninsula', 'KRW · 6% impact', 'med', 'KOSPI USDKRW'],
  ['US-China Tariffs', 'Tech · 9% impact', 'med', 'AAPL TSLA'],
];

export function Hotspots() {
  return (
    <div
      style={{
        padding: 14,
        borderBottom: '1px solid var(--hairline)',
      }}
    >
      <div className="wf-label">Active hotspots · Ranked impact</div>
      <div
        style={{
          marginTop: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {HOTSPOTS.map((r) => (
          <div
            key={r[0]}
            className="wf-panel-flat"
            style={{ padding: 10 }}
          >
            <div className="row between">
              <div
                className="wf-mono"
                style={{ fontSize: 11, color: 'var(--fg)' }}
              >
                {r[0]}
              </div>
              <span
                className="tag"
                style={{
                  color:
                    r[2] === 'high' ? 'var(--down)' : 'var(--orange)',
                  borderColor:
                    r[2] === 'high' ? 'var(--down)' : 'var(--orange)',
                }}
              >
                {r[2].toUpperCase()}
              </span>
            </div>
            <div className="wf-mini muted" style={{ marginTop: 4 }}>
              {r[1]}
            </div>
            <div
              className="wf-mono muted-2"
              style={{
                fontSize: 9,
                marginTop: 4,
                letterSpacing: '0.08em',
              }}
            >
              {r[3]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
