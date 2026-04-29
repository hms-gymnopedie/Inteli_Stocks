import { WorldMap } from '../lib/primitives';

const HOTSPOTS: [string, string, 'high' | 'med', string][] = [
  ['Taiwan Strait', 'Semis · 32% impact', 'high', 'NVDA TSM ASML'],
  ['Russia-Ukraine', 'Energy · 18% impact', 'high', 'XOM CVX BP'],
  ['Middle East', 'Crude · 14% impact', 'med', 'WTI BRENT'],
  ['Korea Peninsula', 'KRW · 6% impact', 'med', 'KOSPI USDKRW'],
  ['US-China Tariffs', 'Tech · 9% impact', 'med', 'AAPL TSLA'],
];

const AFFECTED: [string, string, string, number][] = [
  ['NVDA', '12.4%', '−4.2%', -1],
  ['TSM', ' 8.1%', '−6.8%', -1],
  ['XOM', ' 4.0%', '+2.1%', 1],
  ['005930.KS', ' 6.3%', '−1.4%', -1],
];

const LAYERS: [string, boolean][] = [
  ['Country risk heatmap', true],
  ['Conflict / event pins', true],
  ['Trade flow lines', true],
  ['Energy & commodity sites', false],
  ['Sanction zones', false],
  ['Shipping lanes', false],
];

export function GeoRisk() {
  return (
    <div className="app-frame" style={{ fontSize: 12 }}>
      <div className="titlebar" style={{ padding: '6px 12px' }}>
        <div className="lights">
          <div className="light" />
          <div className="light" />
          <div className="light" />
        </div>
        <div className="wf-mini" style={{ marginLeft: 6 }}>
          GEOPOLITICAL RISK MONITOR
        </div>
        <div style={{ flex: 1 }} />
        <div className="row gap-2">
          <span className="chip">GLOBAL</span>
          <span className="chip">REGIONS</span>
          <span className="chip active">RISK MAP</span>
          <span className="chip">FLOWS</span>
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
        <div
          style={{
            position: 'relative',
            borderRight: '1px solid var(--hairline)',
          }}
        >
          <WorldMap
            heat={{
              namerica: 'low',
              europe: 'med',
              africa: 'med',
              asia: 'high',
              india: 'med',
              seasia: 'med',
              samerica: 'low',
              australia: 'low',
              arabia: 'high',
              korea: 'med',
              japan: 'low',
              uk: 'low',
              indonesia: 'low',
              camerica: 'low',
              nz: 'low',
              philippines: 'med',
              greenland: 'low',
              scand: 'low',
              madagascar: 'low',
            }}
            pins={[
              { x: 490, y: 120, level: 'high', label: 'UA · WAR' },
              { x: 565, y: 200, level: 'high', label: 'IL · CONFLICT' },
              { x: 590, y: 215, level: 'med', label: 'IR · SANCTIONS' },
              { x: 790, y: 200, level: 'high', label: 'TW · TENSION' },
              { x: 815, y: 158, level: 'med', label: 'KR · ELECTION' },
              { x: 220, y: 160, level: 'med', label: 'US · TARIFFS' },
              { x: 480, y: 280, level: 'low', label: 'NG · OIL' },
            ]}
            flows={[
              [220, 160, 790, 200],
              [815, 158, 220, 160],
              [590, 215, 490, 120],
              [480, 280, 490, 120],
            ]}
          />

          <div
            style={{
              position: 'absolute',
              top: 14,
              left: 14,
              display: 'flex',
              gap: 8,
            }}
          >
            <div
              className="wf-panel"
              style={{
                padding: '8px 12px',
                backdropFilter: 'blur(8px)',
                background: 'rgba(20,20,22,0.7)',
              }}
            >
              <div className="wf-mini">GLOBAL RISK INDEX</div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                }}
              >
                <div className="wf-num accent" style={{ fontSize: 28 }}>
                  71
                  <span className="muted-2" style={{ fontSize: 14 }}>
                    /100
                  </span>
                </div>
                <div className="wf-mono down" style={{ fontSize: 11 }}>
                  +4 24H
                </div>
              </div>
              <div className="wf-mini">ELEVATED · ASIA-PACIFIC LEADING</div>
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              width: 240,
            }}
          >
            <div
              className="wf-panel"
              style={{
                padding: 12,
                backdropFilter: 'blur(8px)',
                background: 'rgba(20,20,22,0.7)',
              }}
            >
              <div className="row between">
                <div className="wf-label">Live · Alert</div>
                <div className="chip dot warn">HIGH</div>
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: 'var(--fg)',
                }}
              >
                Taiwan Strait · naval activity escalation
              </div>
              <div
                className="muted"
                style={{ fontSize: 11, marginTop: 4 }}
              >
                Semi supply-chain exposure: TSM, ASML, NVDA. Estimated revenue
                drag if disruption:{' '}
                <span className="accent">−6.4%</span> (Q3).
              </div>
              <div className="row gap-2" style={{ marginTop: 10 }}>
                <span
                  className="tag"
                  style={{
                    color: 'var(--orange)',
                    borderColor: 'var(--orange)',
                  }}
                >
                  HEDGE · SOXX PUT
                </span>
                <span className="tag">DETAIL ↗</span>
              </div>
            </div>

            <div
              className="wf-panel"
              style={{
                padding: 12,
                backdropFilter: 'blur(8px)',
                background: 'rgba(20,20,22,0.7)',
              }}
            >
              <div className="wf-label">Layers</div>
              <div
                style={{
                  marginTop: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                }}
              >
                {LAYERS.map(([n, on]) => (
                  <div
                    key={n}
                    className="row between"
                    style={{ color: on ? 'var(--fg)' : 'var(--fg-3)' }}
                  >
                    <span>{n}</span>
                    <span
                      style={{
                        width: 22,
                        height: 12,
                        borderRadius: 6,
                        background: on ? 'var(--orange)' : 'var(--hairline-2)',
                        position: 'relative',
                        display: 'inline-block',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 1,
                          ...(on ? { right: 1 } : { left: 1 }),
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: '#fff',
                        }}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: 14,
              left: 14,
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              padding: '6px 12px',
              background: 'rgba(20,20,22,0.7)',
              border: '1px solid var(--hairline)',
              borderRadius: 999,
              backdropFilter: 'blur(8px)',
            }}
          >
            <span className="wf-mini">RISK</span>
            <span className="wf-mini" style={{ color: 'var(--up)' }}>
              ● LOW
            </span>
            <span className="wf-mini" style={{ color: 'var(--orange)' }}>
              ● MED
            </span>
            <span className="wf-mini" style={{ color: 'var(--down)' }}>
              ● HIGH
            </span>
            <span className="wf-mini muted-2" style={{ marginLeft: 12 }}>
              UPDATED 26 APR · 09:42 KST
            </span>
          </div>
        </div>

        <aside
          style={{
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
            <div className="wf-label">Active hotspots · Ranked impact</div>
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {HOTSPOTS.map((r) => (
                <div
                  key={r[0]}
                  className="wf-panel-flat"
                  style={{ padding: 10 }}
                >
                  <div className="row between">
                    <div
                      className="wf-mono"
                      style={{ fontSize: 11, color: 'var(--fg)' }}
                    >
                      {r[0]}
                    </div>
                    <span
                      className="tag"
                      style={{
                        color:
                          r[2] === 'high' ? 'var(--down)' : 'var(--orange)',
                        borderColor:
                          r[2] === 'high' ? 'var(--down)' : 'var(--orange)',
                      }}
                    >
                      {r[2].toUpperCase()}
                    </span>
                  </div>
                  <div className="wf-mini muted" style={{ marginTop: 4 }}>
                    {r[1]}
                  </div>
                  <div
                    className="wf-mono muted-2"
                    style={{
                      fontSize: 9,
                      marginTop: 4,
                      letterSpacing: '0.08em',
                    }}
                  >
                    {r[3]}
                  </div>
                </div>
              ))}
            </div>
          </div>

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

          <div style={{ padding: 14 }}>
            <div className="wf-label">AI · Hedge suggestion</div>
            <div className="wf-panel-flat" style={{ padding: 10, marginTop: 8 }}>
              <div className="wf-mini accent">// PROPOSAL</div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--fg-2)',
                  lineHeight: 1.5,
                  marginTop: 4,
                }}
              >
                Reduce semi exposure 4pp; rotate into utilities + USD cash.
                Hedge with SOXX 6M 5% OTM puts. Expected drawdown trim:{' '}
                <span className="accent">−2.1pp</span>.
              </div>
              <div className="row gap-2" style={{ marginTop: 8 }}>
                <span
                  className="tag"
                  style={{
                    color: 'var(--orange)',
                    borderColor: 'var(--orange)',
                  }}
                >
                  SIMULATE
                </span>
                <span className="tag">DISMISS</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
