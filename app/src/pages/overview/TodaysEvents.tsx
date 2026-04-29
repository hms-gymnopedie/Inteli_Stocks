export function TodaysEvents() {
  return (
    <div>
      <div className="wf-label">Today · Key events</div>
      <div style={{ marginTop: 8 }}>
        {[
          ['08:30', 'US Initial Jobless Claims', 'HIGH'],
          ['10:00', 'Fed Powell · Press Q&A', 'HIGH'],
          ['14:30', 'BoK Minutes (KR)', 'MED'],
          ['—', 'NVDA · Earnings AMC', 'HIGH'],
        ].map((r) => (
          <div
            key={r[1]}
            className="row gap-2"
            style={{
              padding: '6px 0',
              borderBottom: '1px solid var(--hairline)',
              fontSize: 11,
            }}
          >
            <span className="wf-mono muted" style={{ width: 40 }}>
              {r[0]}
            </span>
            <span style={{ flex: 1, color: 'var(--fg-2)' }}>{r[1]}</span>
            <span
              className="tag"
              style={{
                color:
                  r[2] === 'HIGH' ? 'var(--orange)' : 'var(--fg-3)',
                borderColor:
                  r[2] === 'HIGH' ? 'var(--orange)' : 'var(--hairline)',
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
