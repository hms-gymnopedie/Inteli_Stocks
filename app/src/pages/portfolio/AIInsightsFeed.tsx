const INSIGHTS = [
  {
    tag: 'OPPORTUNITY',
    when: '2m ago',
    tone: 'orange' as const,
    title: 'Semis breakout signal',
    body:
      'NVDA & TSM both crossed 20D EMA on rising volume. Group RSI 68. Add-up to overweight band.',
    actions: ['SIMULATE +2%', 'IGNORE'],
    risk: '2/5',
    score: 78,
  },
  {
    tag: 'RISK',
    when: '14m ago',
    tone: 'down' as const,
    title: 'Geo · Taiwan tension elevated',
    body:
      'Naval activity spike near Strait. Your TSM exposure (6.4%) at risk of −8% drawdown in stress scenario.',
    actions: ['HEDGE PROPOSAL', 'DETAIL ↗'],
    risk: '4/5',
    score: 41,
  },
  {
    tag: 'MACRO',
    when: '1h ago',
    tone: 'fg' as const,
    title: 'CPI print Thu — positioning',
    body:
      'Consensus 3.1% YoY. Your portfolio beta 1.18 — consider trimming duration / adding USD on hot print.',
    actions: ['VIEW SCENARIO'],
    risk: '3/5',
    score: 56,
  },
  {
    tag: 'EARNINGS',
    when: '3h ago',
    tone: 'orange' as const,
    title: 'NVDA earnings → 14D',
    body:
      'IV at 65th percentile. Historic post-print move ±9.2%. Consider trimming 1pp into print or buying protective puts.',
    actions: ['HEDGE', 'KEEP'],
    risk: '3/5',
    score: 62,
  },
];

export function AIInsightsFeed() {
  return (
    <aside
      style={{
        borderLeft: '1px solid var(--hairline)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          padding: 14,
          borderBottom: '1px solid var(--hairline)',
        }}
      >
        <div className="row between center">
          <div>
            <div className="wf-label">AI Insights · Live feed</div>
            <div className="wf-mini muted-2" style={{ marginTop: 2 }}>
              tailored to your portfolio
            </div>
          </div>
          <span className="chip dot warn">3 NEW</span>
        </div>
      </div>

      <div
        style={{
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          flex: 1,
        }}
      >
        {INSIGHTS.map((c) => (
          <div
            key={c.title}
            className="wf-panel-flat"
            style={{ padding: 12 }}
          >
            <div className="row between">
              <span
                className="wf-mini"
                style={{
                  color:
                    c.tone === 'orange'
                      ? 'var(--orange)'
                      : c.tone === 'down'
                        ? 'var(--down)'
                        : 'var(--fg)',
                }}
              >
                // {c.tag}
              </span>
              <span className="wf-mini muted-2">{c.when}</span>
            </div>
            <div
              style={{
                fontSize: 13,
                marginTop: 6,
                color: 'var(--fg)',
              }}
            >
              {c.title}
            </div>
            <div
              style={{
                fontSize: 11,
                marginTop: 4,
                color: 'var(--fg-2)',
                lineHeight: 1.5,
              }}
            >
              {c.body}
            </div>
            <hr className="wf-divider" style={{ margin: '8px 0' }} />
            <div className="row between center">
              <div className="row gap-2 wf-mini">
                <span className="muted">RISK {c.risk}</span>
                <span className="muted">·</span>
                <span>
                  SCORE <span className="accent">{c.score}</span>
                </span>
              </div>
              <div className="row gap-1">
                {c.actions.map((a, j) => (
                  <span
                    key={a}
                    className="tag"
                    style={
                      j === 0
                        ? {
                            color: 'var(--orange)',
                            borderColor: 'var(--orange)',
                          }
                        : {}
                    }
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
