const VALUATION: [string, string, string?][] = [
  ['MKT CAP', '$2.31T'],
  ['P/E', '74.1', 'sector 28.4'],
  ['P/S', '36.2'],
  ['REV YoY', '+265%', 'up'],
  ['NET MARGIN', '54.2%'],
  ['DIV YIELD', '0.02%'],
  ['52W RANGE', '$280 — $974'],
  ['BETA', '1.74'],
  ['SHORT %', '1.20%'],
  ['EPS (TTM)', '$11.93'],
  ['FCF', '$26.9B'],
  ['DEBT/EQ', '0.36'],
];

export function ValuationGrid() {
  return (
    <div className="wf-panel" style={{ padding: 12 }}>
      <div className="row between">
        <div className="wf-label">Valuation · Fundamentals</div>
        <div className="wf-mini muted-2">FY24 · TTM</div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 12,
          marginTop: 10,
        }}
      >
        {VALUATION.map((m, i) => (
          <div
            key={m[0]}
            style={{
              borderTop: i >= 6 ? '1px solid var(--hairline)' : 0,
              paddingTop: i >= 6 ? 10 : 0,
            }}
          >
            <div className="wf-mini">{m[0]}</div>
            <div
              className={`wf-num ${m[2] === 'up' ? 'up' : ''}`}
              style={{ fontSize: 16, marginTop: 2 }}
            >
              {m[1]}
            </div>
            {m[2] && m[2] !== 'up' && (
              <div className="wf-mini muted-2">{m[2]}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
