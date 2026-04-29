import { Spark } from '../../lib/primitives';

const HOLDINGS: [string, string, string, string, string, string, number, number][] = [
  ['NVDA', 'NVIDIA Corp', '12.4%', '$924.19', '+3.17', '+184%', 60, 3],
  ['AAPL', 'Apple Inc', '9.8%', '$184.42', '+0.42', '+22%', 61, 2],
  ['005930.KS', 'Samsung Electronics', '8.1%', '₩72,400', '+1.82', '+14%', 62, 2],
  ['MSFT', 'Microsoft', '7.5%', '$418.60', '+0.61', '+38%', 63, 2],
  ['TSM', 'TSMC ADR', '6.4%', '$148.20', '+2.14', '+62%', 64, 4],
  ['000660.KS', 'SK Hynix', '5.8%', '₩214,500', '+3.41', '+71%', 65, 3],
  ['XOM', 'Exxon Mobil', '4.0%', '$118.40', '−0.84', '+9%', 66, 3],
  ['META', 'Meta Platforms', '3.9%', '$502.10', '+1.10', '+44%', 67, 2],
];

export function HoldingsTable() {
  return (
    <div className="wf-panel" style={{ padding: 0 }}>
      <div className="row between" style={{ padding: 12 }}>
        <div className="wf-label">Holdings · 14 positions</div>
        <div className="row gap-2">
          <span className="tag">FILTER</span>
          <span className="tag">EXPORT</span>
        </div>
      </div>
      <div
        className="dense-row"
        style={{
          gridTemplateColumns:
            '90px 1fr 70px 70px 80px 70px 90px 50px',
          color: 'var(--fg-3)',
          borderTop: '1px solid var(--hairline)',
        }}
      >
        <span>TICKER</span>
        <span>NAME</span>
        <span>WEIGHT</span>
        <span>PRICE</span>
        <span>DAY %</span>
        <span>P/L %</span>
        <span>30D TREND</span>
        <span>RISK</span>
      </div>
      {HOLDINGS.map((r) => (
        <div
          key={r[0]}
          className="dense-row"
          style={{
            gridTemplateColumns:
              '90px 1fr 70px 70px 80px 70px 90px 50px',
          }}
        >
          <span className="ticker">{r[0]}</span>
          <span
            className="muted"
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {r[1]}
          </span>
          <span>{r[2]}</span>
          <span style={{ color: 'var(--fg)' }}>{r[3]}</span>
          <span
            style={{
              color: r[4].startsWith('+')
                ? 'var(--up)'
                : 'var(--down)',
            }}
          >
            {r[4]}%
          </span>
          <span style={{ color: 'var(--up)' }}>{r[5]}</span>
          <Spark seed={r[6]} trend={0.4} />
          <span className="tag" style={{ textAlign: 'center' }}>
            {r[7]}/5
          </span>
        </div>
      ))}
    </div>
  );
}
