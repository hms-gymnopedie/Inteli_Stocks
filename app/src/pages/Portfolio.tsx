import { LineChart, SectorBars, Spark } from '../lib/primitives';
import { useTweaks } from '../lib/tweaks';

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

const HEADER_KPIS: [string, string, string][] = [
  ['EXPOSURE', '92%', 'cash 8%'],
  ['RISK SCORE', '3.2/5', 'moderate-aggr'],
  ['DRAWDOWN', '−4.1%', 'from peak'],
];

export function Portfolio() {
  const { values } = useTweaks();
  return (
    <div className="app-frame" style={{ fontSize: 12 }}>
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 380px',
          minHeight: 0,
        }}
      >
        <main
          style={{
            padding: 14,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            className="wf-panel"
            style={{
              padding: 14,
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
              gap: 18,
            }}
          >
            <div>
              <div className="wf-label">Net Asset Value</div>
              <div className="wf-num" style={{ fontSize: 30 }}>
                $1,284,<span className="muted">420</span>
              </div>
              <div className="up wf-mono" style={{ fontSize: 12 }}>
                +$27,318 (+2.18%) · TODAY
              </div>
              <div className="wf-mini muted-2" style={{ marginTop: 4 }}>
                YTD +18.4% · 1Y +34.2% · SHARPE 1.81
              </div>
            </div>
            {HEADER_KPIS.map((m, i) => (
              <div key={m[0]}>
                <div className="wf-mini">{m[0]}</div>
                <div className="wf-num" style={{ fontSize: 22, marginTop: 2 }}>
                  {m[1]}
                </div>
                <div className="wf-mini muted-2">{m[2]}</div>
                <div style={{ marginTop: 6 }}>
                  <Spark
                    seed={50 + i}
                    trend={i % 2 ? -0.3 : 0.4}
                    w={200}
                    h={26}
                  />
                </div>
              </div>
            ))}
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
          >
            <div className="wf-panel" style={{ padding: 12 }}>
              <div className="wf-label">Equity curve · 1Y</div>
              <div style={{ marginTop: 10 }}>
                <LineChart
                  w={400}
                  h={150}
                  seed={42}
                  trend={1.2}
                  grid={values.showGrid}
                  area
                  accentRange={[0.55, 0.7]}
                />
              </div>
              <div className="row between wf-mini" style={{ marginTop: 4 }}>
                <span>MAY · JUL · SEP · NOV · JAN · MAR</span>
                <span className="muted">vs S&amp;P +6.2pp</span>
              </div>
            </div>
            <div className="wf-panel" style={{ padding: 12 }}>
              <div className="row between">
                <div className="wf-label">Allocation</div>
                <div className="row gap-1">
                  <span
                    className="tab active"
                    style={{ padding: '3px 8px', fontSize: 10 }}
                  >
                    SECTOR
                  </span>
                  <span
                    className="tab"
                    style={{ padding: '3px 8px', fontSize: 10 }}
                  >
                    REGION
                  </span>
                  <span
                    className="tab"
                    style={{ padding: '3px 8px', fontSize: 10 }}
                  >
                    ASSET
                  </span>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <SectorBars
                  items={[
                    { name: 'Semis', v: 28 },
                    { name: 'Software', v: 18 },
                    { name: 'Korea Eq', v: 14 },
                    { name: 'Energy', v: 11 },
                    { name: 'Healthcare', v: 9 },
                    { name: 'Cash', v: 8 },
                    { name: 'Bonds', v: 6 },
                    { name: 'Crypto', v: 6 },
                  ]}
                />
              </div>
            </div>
          </div>

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
        </main>

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
      </div>
    </div>
  );
}
