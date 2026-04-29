import {
  BarChart,
  CandleChart,
  Gauge,
  HeatGrid,
  LineChart,
  SectorBars,
  Spark,
} from '../lib/primitives';
import { useTweaks } from '../lib/tweaks';

const WORKSPACES = [
  'Overview',
  'Geopolitics',
  'Sectors',
  'Macro Monitor',
  'Watchlist',
  'Portfolio',
  'AI Insights',
  'Alerts',
];

const KR_WATCH: [string, string, string, number, number][] = [
  ['005930', 'Samsung', '+1.82%', 1, 1],
  ['000660', 'SK Hynix', '+3.41%', 2, 1],
  ['035420', 'Naver', '-0.92%', 3, -1],
  ['051910', 'LG Chem', '+0.14%', 4, 1],
  ['207940', 'SamsungBio', '-1.20%', 5, -1],
];

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

export function Overview() {
  const { values } = useTweaks();
  const showGrid = values.showGrid;

  return (
    <div className="app-frame" style={{ fontSize: 12 }}>
      {/* TOP TICKER STRIP */}
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

      {/* MAIN GRID */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '220px 1fr 280px',
          minHeight: 0,
        }}
      >
        {/* LEFT NAV */}
        <aside
          className="responsive-side"
          style={{
            borderRight: '1px solid var(--hairline)',
            padding: '14px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            overflow: 'auto',
          }}
        >
          <div>
            <div className="wf-label">Workspaces</div>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '8px 0 0',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
              }}
            >
              {WORKSPACES.map((n, i) => (
                <li
                  key={n}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 4,
                    background: i === 0 ? 'var(--panel-2)' : 'transparent',
                    color: i === 0 ? 'var(--fg)' : 'var(--fg-3)',
                    marginBottom: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{n}</span>
                  {i === 7 && <span className="accent">3</span>}
                </li>
              ))}
            </ul>
          </div>

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
        </aside>

        {/* CENTER */}
        <main
          style={{
            padding: 12,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div className="wf-panel" style={{ padding: 14 }}>
            <div className="row between center">
              <div>
                <div className="wf-label">Primary · S&amp;P 500 · Intraday</div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 12,
                    marginTop: 4,
                  }}
                >
                  <div className="wf-num" style={{ fontSize: 32 }}>
                    5,247.<span className="muted">18</span>
                  </div>
                  <div className="up wf-mono" style={{ fontSize: 13 }}>
                    +22.04 (+0.42%)
                  </div>
                  <div className="muted wf-mini">VOL 2.41B</div>
                </div>
              </div>
              <div className="row gap-1">
                {['1D', '1W', '1M', '3M', 'YTD', '1Y', '5Y'].map((t, i) => (
                  <div
                    key={t}
                    className={'tab' + (i === 1 ? ' active' : '')}
                    style={{ padding: '4px 10px', fontSize: 11 }}
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              {values.chartStyle === 'candle' ? (
                <CandleChart w={800} h={180} count={62} seed={3} />
              ) : (
                <LineChart
                  w={800}
                  h={180}
                  seed={3}
                  trend={0.6}
                  grid={showGrid}
                  dashedTarget
                  accent
                  area={values.chartStyle === 'area'}
                  accentRange={[0.62, 0.78]}
                  strokeWidth={1.4}
                />
              )}
            </div>
            <div className="row between" style={{ marginTop: 8 }}>
              <div className="wf-mini">
                09:30 · 11:00 · 13:00 · 15:00 · 16:00
              </div>
              <div className="row gap-3 wf-mini">
                <span>O 5,225.14</span>
                <span>H 5,251.02</span>
                <span>L 5,219.88</span>
                <span>C 5,247.18</span>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr',
              gap: 10,
            }}
          >
            <div className="wf-panel" style={{ padding: 12 }}>
              <div className="row between">
                <div className="wf-label">S&amp;P 500 · Sector heatmap</div>
                <div className="wf-mini">SESSION</div>
              </div>
              <div style={{ marginTop: 10 }}>
                <HeatGrid
                  cols={6}
                  cells={[
                    { t: 'AAPL', v: 1.4 },
                    { t: 'MSFT', v: 0.8 },
                    { t: 'NVDA', v: 3.2 },
                    { t: 'GOOG', v: -0.4 },
                    { t: 'AMZN', v: 0.9 },
                    { t: 'META', v: 1.1 },
                    { t: 'JPM', v: 0.3 },
                    { t: 'BAC', v: -0.6 },
                    { t: 'V', v: 0.2 },
                    { t: 'XOM', v: -1.2 },
                    { t: 'CVX', v: -0.9 },
                    { t: 'PFE', v: 1.6 },
                    { t: 'TSLA', v: -2.3 },
                    { t: 'UNH', v: 0.4 },
                    { t: 'HD', v: -0.2 },
                    { t: 'COST', v: 0.7 },
                    { t: 'WMT', v: 0.1 },
                    { t: 'KO', v: -0.3 },
                    { t: 'NKE', v: 1.9 },
                    { t: 'BA', v: -3.6 },
                    { t: 'DIS', v: 0.5 },
                    { t: 'NFLX', v: 2.4 },
                    { t: 'CRM', v: 1.0 },
                    { t: 'ORCL', v: -0.7 },
                  ]}
                />
              </div>
            </div>
            <div className="wf-panel" style={{ padding: 12 }}>
              <div className="wf-label">Sector flow · Today</div>
              <div style={{ marginTop: 10 }}>
                <SectorBars
                  items={[
                    { name: 'Tech', v: 1.84 },
                    { name: 'Semis', v: 3.21 },
                    { name: 'Energy', v: -1.08 },
                    { name: 'Financials', v: 0.32 },
                    { name: 'Healthcare', v: 0.71 },
                    { name: 'Discretionary', v: -0.44 },
                    { name: 'Materials', v: -0.22 },
                    { name: 'Utilities', v: 0.08 },
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="wf-panel" style={{ padding: 12 }}>
            <div className="row between">
              <div className="wf-label">Macro Monitor</div>
              <div className="wf-mini muted-2">Fed · BoK · ECB</div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
                marginTop: 10,
              }}
            >
              {[
                {
                  t: 'US 10Y',
                  v: '4.412',
                  d: '+2.1bp',
                  s: 11,
                  tr: 0.5,
                },
                {
                  t: 'CPI YoY',
                  v: '3.20%',
                  d: '−0.10',
                  s: 12,
                  tr: -0.3,
                },
                {
                  t: 'USD/KRW',
                  v: '1,378.4',
                  d: '+0.42%',
                  s: 13,
                  tr: 0.4,
                },
                {
                  t: 'WTI Crude',
                  v: '$78.42',
                  d: '−1.18%',
                  s: 14,
                  tr: -0.5,
                },
              ].map((m, i) => (
                <div
                  key={m.t}
                  style={{
                    borderLeft: i ? '1px solid var(--hairline)' : 0,
                    paddingLeft: i ? 12 : 0,
                  }}
                >
                  <div className="wf-mini">{m.t}</div>
                  <div
                    className="wf-num"
                    style={{ fontSize: 22, marginTop: 2 }}
                  >
                    {m.v}
                  </div>
                  <div
                    className="wf-mono"
                    style={{
                      fontSize: 10,
                      color: m.d.startsWith('+')
                        ? 'var(--up)'
                        : 'var(--down)',
                    }}
                  >
                    {m.d}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <Spark seed={m.s} trend={m.tr} w={200} h={26} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* RIGHT — AI INSIGHTS */}
        <aside
          className="responsive-side"
          style={{
            borderLeft: '1px solid var(--hairline)',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflow: 'auto',
          }}
        >
          <div>
            <div className="row between">
              <div className="wf-label">AI Assistant</div>
              <div className="chip dot warn">SYNTH</div>
            </div>
            <div className="wf-panel-flat" style={{ padding: 10, marginTop: 8 }}>
              <div className="wf-mini accent" style={{ marginBottom: 6 }}>
                // SIGNAL · 4m AGO
              </div>
              <div
                style={{
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: 'var(--fg-2)',
                }}
              >
                Semis breaking{' '}
                <span style={{ color: 'var(--fg)' }}>+3.2σ</span> above 20D
                mean. NVDA leads, options skew flipping bullish into earnings
                window.
              </div>
              <div className="row gap-2" style={{ marginTop: 8 }}>
                <span className="tag">RISK 2/5</span>
                <span
                  className="tag"
                  style={{
                    color: 'var(--orange)',
                    borderColor: 'var(--orange)',
                  }}
                >
                  ACTION · ADD
                </span>
              </div>
            </div>
            <div className="wf-panel-flat" style={{ padding: 10, marginTop: 8 }}>
              <div
                className="wf-mini"
                style={{ color: 'var(--down)', marginBottom: 6 }}
              >
                // CAUTION · 18m AGO
              </div>
              <div
                style={{
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: 'var(--fg-2)',
                }}
              >
                Energy drawdown widens. WTI breaks 50D MA support; geopolitical
                premium fading. Watch XLE for follow-through.
              </div>
              <div className="row gap-2" style={{ marginTop: 8 }}>
                <span className="tag">RISK 4/5</span>
                <span className="tag">ACTION · TRIM</span>
              </div>
            </div>
          </div>

          <div>
            <div className="wf-label">Market sentiment</div>
            <div className="wf-panel-flat" style={{ padding: 10, marginTop: 8 }}>
              <Gauge value={62} label="Greed" />
              <div className="row between wf-mini" style={{ marginTop: 6 }}>
                <span>YESTERDAY 58</span>
                <span>1W 49</span>
                <span>1M 41</span>
              </div>
            </div>
          </div>

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

          {/* Volume bars at the bottom */}
          <div>
            <div className="wf-label">Session volume</div>
            <div style={{ marginTop: 8 }}>
              <BarChart w={260} h={50} count={30} seed={9} accent />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
