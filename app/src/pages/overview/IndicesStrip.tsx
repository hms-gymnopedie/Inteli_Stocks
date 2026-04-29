const TICKER_STRIP: [string, string, string, number][] = [
  ['S&P 500', '5,247.18', '+0.42%', 1],
  ['NASDAQ', '16,492.7', '+0.71%', 1],
  ['DOW', '39,218.5', '-0.08%', -1],
  ['KOSPI', '2,710.3', '+1.24%', 1],
  ['VIX', '14.82', '-3.10%', -1],
  ['DXY', '104.12', '+0.18%', 1],
  ['10Y UST', '4.412%', '+2.1bp', 1],
  ['BTC', '67,420', '-1.84%', -1],
];

export function IndicesStrip() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        borderBottom: '1px solid var(--hairline)',
      }}
    >
      {TICKER_STRIP.map(([t, p, c, d], i) => (
        <div
          key={t}
          style={{
            padding: '8px 10px',
            borderRight: i < 7 ? '1px solid var(--hairline)' : 0,
          }}
        >
          <div className="wf-mini">{t}</div>
          <div
            className="wf-mono"
            style={{ fontSize: 13, color: 'var(--fg)', marginTop: 2 }}
          >
            {p}
          </div>
          <div
            className="wf-mono"
            style={{
              fontSize: 10,
              color: d > 0 ? 'var(--up)' : 'var(--down)',
            }}
          >
            {c}
          </div>
        </div>
      ))}
    </div>
  );
}
