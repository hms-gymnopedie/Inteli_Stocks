export function Header() {
  return (
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
  );
}
