const FILINGS: [string, string, string, 'high' | 'med' | 'low'][] = [
  ['26 APR', '8-K', 'Material Definitive Agreement · supply contract', 'high'],
  ['18 APR', '4', 'Insider sale · CFO · 12,000 shares', 'med'],
  ['09 APR', '10-Q', 'Quarterly Report · Q1 FY25', 'high'],
  ['02 APR', '8-K', 'Press release · GTC keynote summary', 'low'],
  ['28 MAR', '13G', 'Vanguard 5.1% holding update', 'low'],
];

export function DisclosuresFeed() {
  return (
    <div className="wf-panel" style={{ padding: 12 }}>
      <div className="row between">
        <div className="wf-label">Disclosures · Filings</div>
        <span className="wf-mini muted">last 30D</span>
      </div>
      <div style={{ marginTop: 8 }}>
        {FILINGS.map((r) => (
          <div
            key={`${r[0]}-${r[1]}-${r[2]}`}
            className="row gap-3"
            style={{
              padding: '7px 0',
              borderBottom: '1px solid var(--hairline)',
              fontSize: 11,
            }}
          >
            <span className="wf-mono muted" style={{ width: 64 }}>
              {r[0]}
            </span>
            <span
              className="tag"
              style={{ width: 50, textAlign: 'center' }}
            >
              {r[1]}
            </span>
            <span style={{ flex: 1, color: 'var(--fg-2)' }}>{r[2]}</span>
            <span
              className="wf-mini"
              style={{
                color:
                  r[3] === 'high'
                    ? 'var(--orange)'
                    : r[3] === 'med'
                      ? 'var(--fg-2)'
                      : 'var(--fg-4)',
              }}
            >
              {r[3].toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
