import { Spark } from '../../lib/primitives';

const KR_WATCH: [string, string, string, number, number][] = [
  ['005930', 'Samsung', '+1.82%', 1, 1],
  ['000660', 'SK Hynix', '+3.41%', 2, 1],
  ['035420', 'Naver', '-0.92%', 3, -1],
  ['051910', 'LG Chem', '+0.14%', 4, 1],
  ['207940', 'SamsungBio', '-1.20%', 5, -1],
];

export function Watchlist() {
  return (
    <div>
      <div className="wf-label">Watchlist · Korea</div>
      <div style={{ marginTop: 8 }}>
        {KR_WATCH.map(([code, name, chg, s, d]) => (
          <div
            key={code}
            className="row between"
            style={{
              padding: '5px 0',
              borderBottom: '1px solid var(--hairline)',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
            }}
          >
            <div>
              <div style={{ color: 'var(--fg)' }}>{code}</div>
              <div className="muted" style={{ fontSize: 9 }}>
                {name}
              </div>
            </div>
            <Spark
              seed={s}
              trend={d}
              color={d > 0 ? 'var(--up)' : 'var(--down)'}
            />
            <div
              style={{
                color: d > 0 ? 'var(--up)' : 'var(--down)',
                minWidth: 50,
                textAlign: 'right',
              }}
            >
              {chg}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
