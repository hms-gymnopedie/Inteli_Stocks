const AFFECTED: [string, string, string, number][] = [
  ['NVDA', '12.4%', '−4.2%', -1],
  ['TSM', ' 8.1%', '−6.8%', -1],
  ['XOM', ' 4.0%', '+2.1%', 1],
  ['005930.KS', ' 6.3%', '−1.4%', -1],
];

export function AffectedPortfolio() {
  return (
    <div
      style={{
        padding: 14,
        borderBottom: '1px solid var(--hairline)',
      }}
    >
      <div className="wf-label">Affected · Your portfolio</div>
      <div style={{ marginTop: 8 }}>
        {AFFECTED.map((r) => (
          <div
            key={r[0]}
            className="row between"
            style={{
              padding: '6px 0',
              borderBottom: '1px solid var(--hairline)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
            }}
          >
            <span className="ticker">{r[0]}</span>
            <span className="muted">w {r[1]}</span>
            <span
              style={{
                color: r[3] > 0 ? 'var(--up)' : 'var(--down)',
              }}
            >
              {r[2]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
