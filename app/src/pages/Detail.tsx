import { BarChart, CandleChart, LineChart, Spark } from '../lib/primitives';
import { useTweaks } from '../lib/tweaks';

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

const FILINGS: [string, string, string, 'high' | 'med' | 'low'][] = [
  ['26 APR', '8-K', 'Material Definitive Agreement · supply contract', 'high'],
  ['18 APR', '4', 'Insider sale · CFO · 12,000 shares', 'med'],
  ['09 APR', '10-Q', 'Quarterly Report · Q1 FY25', 'high'],
  ['02 APR', '8-K', 'Press release · GTC keynote summary', 'low'],
  ['28 MAR', '13G', 'Vanguard 5.1% holding update', 'low'],
];

const PEERS: [string, string, string, number, number][] = [
  ['AMD', '$162.4', '+1.84%', 1, 31],
  ['TSM', '$148.2', '+2.14%', 1, 32],
  ['INTC', ' $34.1', '−0.62%', -1, 33],
  ['ASML', '$928.5', '+1.10%', 1, 34],
];

export function Detail() {
  const { values } = useTweaks();
  return (
    <div className="app-frame" style={{ fontSize: 12 }}>
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--hairline)',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 18,
          alignItems: 'center',
        }}
      >
        <div>
          <div className="row gap-3 center">
            <div
              className="wf-dashed"
              style={{
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--fg-3)',
              }}
            >
              LOGO
            </div>
            <div>
              <div className="row gap-2 center">
                <h2
                  className="wf-h"
                  style={{ fontSize: 22, margin: 0, fontWeight: 400 }}
                >
                  NVIDIA Corp
                </h2>
                <span className="tag">NVDA</span>
                <span className="tag">SEMIS</span>
                <span className="tag">US</span>
              </div>
              <div
                className="muted wf-mini"
                style={{ marginTop: 4 }}
              >
                S&amp;P 500 · Nasdaq 100 · MSCI World
              </div>
            </div>
          </div>
        </div>
        <div className="row gap-5 center">
          <div>
            <div className="wf-num" style={{ fontSize: 30 }}>
              $924.<span className="muted">19</span>
            </div>
            <div className="wf-mono up" style={{ fontSize: 12 }}>
              +$28.41 (+3.17%) · DAY
            </div>
          </div>
          <div className="wf-divider-v" />
          <div>
            <div className="wf-mini">AI VERDICT</div>
            <div className="row gap-2 center" style={{ marginTop: 4 }}>
              <span
                className="tag"
                style={{
                  color: 'var(--orange)',
                  borderColor: 'var(--orange)',
                  fontSize: 10,
                  padding: '4px 10px',
                }}
              >
                ● ACCUMULATE
              </span>
              <span className="wf-mono muted">RISK 3 / 5</span>
            </div>
          </div>
          <div className="row gap-2">
            <span className="tag">+ WATCHLIST</span>
            <span className="tag">⤴ TRADE</span>
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
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
          <div className="wf-panel" style={{ padding: 14 }}>
            <div className="row between">
              <div className="row gap-2">
                {['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'MAX'].map(
                  (t, i) => (
                    <span
                      key={t}
                      className={'tab' + (i === 3 ? ' active' : '')}
                      style={{ padding: '4px 10px', fontSize: 11 }}
                    >
                      {t}
                    </span>
                  ),
                )}
              </div>
              <div className="row gap-2">
                <span className="tag">RSI</span>
                <span className="tag">MACD</span>
                <span className="tag">VOL</span>
                <span
                  className="tag"
                  style={{
                    color: 'var(--orange)',
                    borderColor: 'var(--orange)',
                  }}
                >
                  + ADD
                </span>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              {values.chartStyle === 'line' ? (
                <LineChart
                  w={800}
                  h={200}
                  seed={11}
                  trend={0.5}
                  grid={values.showGrid}
                  area
                  strokeWidth={1.4}
                />
              ) : (
                <CandleChart w={800} h={200} count={62} seed={11} />
              )}
            </div>
            <hr className="wf-divider" style={{ margin: '8px 0' }} />
            <div style={{ height: 50 }}>
              <BarChart w={800} h={50} count={62} seed={4} accent />
            </div>
            <div className="row between wf-mini" style={{ marginTop: 6 }}>
              <span>JAN · FEB · MAR · APR</span>
              <span>VOL · 56.2M shares</span>
            </div>
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
          >
            <div className="wf-panel" style={{ padding: 12 }}>
              <div className="row between">
                <div className="wf-label">RSI (14)</div>
                <div className="wf-mono accent">68.4</div>
              </div>
              <div style={{ marginTop: 8 }}>
                <LineChart
                  w={400}
                  h={70}
                  seed={20}
                  grid={values.showGrid}
                  trend={0.4}
                  stroke="var(--orange)"
                />
              </div>
              <div className="row between wf-mini" style={{ marginTop: 4 }}>
                <span>30 oversold</span>
                <span>70 overbought</span>
              </div>
            </div>
            <div className="wf-panel" style={{ padding: 12 }}>
              <div className="row between">
                <div className="wf-label">MACD (12,26,9)</div>
                <div className="wf-mono up">+2.81</div>
              </div>
              <div style={{ marginTop: 8 }}>
                <LineChart
                  w={400}
                  h={70}
                  seed={21}
                  grid={values.showGrid}
                  trend={0.2}
                  accent
                />
              </div>
              <div className="row between wf-mini" style={{ marginTop: 4 }}>
                <span>SIGNAL ↑ CROSS · 3D AGO</span>
                <span>HIST +0.42</span>
              </div>
            </div>
          </div>

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
        </main>

        <aside
          style={{
            borderLeft: '1px solid var(--hairline)',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            overflow: 'auto',
          }}
        >
          <div>
            <div className="wf-label">AI Investment Guide</div>
            <div className="wf-panel-flat" style={{ padding: 10, marginTop: 8 }}>
              <div className="wf-num" style={{ fontSize: 22 }}>
                72
                <span className="muted-2" style={{ fontSize: 12 }}>
                  /100
                </span>
              </div>
              <div className="wf-mini accent">CONVICTION SCORE</div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: 'var(--fg-2)',
                  lineHeight: 1.5,
                }}
              >
                Momentum + earnings revisions positive; valuation full but
                justified by AI capex cycle.{' '}
                <span className="accent">Stagger entries</span> below $890 with
                6M horizon.
              </div>
              <hr className="wf-divider" style={{ margin: '10px 0' }} />
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                }}
              >
                <div className="row between">
                  <span className="muted">MOMENTUM</span>
                  <span className="up">▮▮▮▮▯ 4/5</span>
                </div>
                <div className="row between">
                  <span className="muted">VALUATION</span>
                  <span className="down">▮▮▯▯▯ 2/5</span>
                </div>
                <div className="row between">
                  <span className="muted">QUALITY</span>
                  <span className="up">▮▮▮▮▮ 5/5</span>
                </div>
                <div className="row between">
                  <span className="muted">SENTIMENT</span>
                  <span className="accent">▮▮▮▮▯ 4/5</span>
                </div>
                <div className="row between">
                  <span className="muted">GEO RISK</span>
                  <span className="down">▮▮▮▯▯ 3/5</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="wf-label">Analyst targets</div>
            <div className="wf-panel-flat" style={{ padding: 10, marginTop: 8 }}>
              <div style={{ position: 'relative', height: 30 }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '10%',
                    right: '5%',
                    top: 14,
                    height: 1,
                    background: 'var(--hairline-2)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '38%',
                    top: 8,
                    width: 2,
                    height: 14,
                    background: 'var(--fg)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '60%',
                    top: 8,
                    width: 2,
                    height: 14,
                    background: 'var(--orange)',
                  }}
                />
              </div>
              <div className="row between wf-mini" style={{ marginTop: 4 }}>
                <span>LOW $720</span>
                <span className="accent">TGT $1,040</span>
                <span>HIGH $1,200</span>
              </div>
              <div
                className="row between wf-mini muted-2"
                style={{ marginTop: 6 }}
              >
                <span>BUY 38</span>
                <span>HOLD 7</span>
                <span>SELL 1</span>
              </div>
            </div>
          </div>

          <div>
            <div className="wf-label">Peers</div>
            <div style={{ marginTop: 8 }}>
              {PEERS.map((r) => (
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
                  <span className="muted">{r[1]}</span>
                  <Spark
                    seed={r[4]}
                    trend={r[3] * 0.4}
                    color={r[3] > 0 ? 'var(--up)' : 'var(--down)'}
                  />
                  <span
                    style={{ color: r[3] > 0 ? 'var(--up)' : 'var(--down)' }}
                  >
                    {r[2]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
