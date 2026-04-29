import { getProfile } from '../../data/security';
import { useAsync } from '../../lib/useAsync';

interface HeaderProps {
  symbol: string;
}

/**
 * Detail page header — stock identity, live price, AI verdict tag, action chips.
 *
 * Data:
 *  - `getProfile(symbol)` for name / sector / indices / price / day change.
 *  - AI verdict + risk tag are still placeholder; B3-DT-AI will wire them to
 *    `ai.getVerdict(symbol)` (lives in `AIInvestmentGuide.tsx` for now).
 *
 * Action chips (+ WATCHLIST / ⤴ TRADE) are UI-only — B5 will hook them up.
 */
export function Header({ symbol }: HeaderProps) {
  const { data: profile, loading } = useAsync(() => getProfile(symbol), [symbol]);

  // Split decimal portion so we can dim it like the prototype: "$924.<19>".
  // Use the formatted string from the data layer (it already carries currency
  // glyphs / locale-aware grouping). Fallbacks preserve the dimmed look while
  // loading.
  const [pricePre, priceDec] = (() => {
    const raw = profile?.priceFormatted ?? '$—.—';
    const dot = raw.lastIndexOf('.');
    if (dot < 0) return [raw, ''];
    return [raw.slice(0, dot + 1), raw.slice(dot + 1)];
  })();

  const dimmed = loading && !profile ? { opacity: 0.5 } : undefined;
  const isUp = (profile?.dayChangePct ?? '').trim().startsWith('+');

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
      aria-busy={loading}
    >
      <div style={dimmed}>
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
                {profile?.name ?? '———'}
              </h2>
              <span className="ticker">{profile?.symbol ?? symbol}</span>
              {profile && <span className="tag">{profile.sector}</span>}
              {profile && <span className="tag">{profile.exchange}</span>}
            </div>
            <div className="muted wf-mini" style={{ marginTop: 4 }}>
              {profile?.indices || ' '}
            </div>
          </div>
        </div>
      </div>
      <div className="row gap-5 center">
        <div style={dimmed}>
          <div className="wf-num" style={{ fontSize: 30 }}>
            {pricePre}
            <span className="muted">{priceDec}</span>
          </div>
          <div
            className={`wf-mono ${isUp ? 'up' : 'down'}`}
            style={{ fontSize: 12 }}
          >
            {profile
              ? `${profile.dayChange} (${profile.dayChangePct}) · DAY`
              : '— · DAY'}
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
          <button
            type="button"
            className="tag"
            style={{
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + WATCHLIST
          </button>
          <button
            type="button"
            className="tag"
            style={{
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ⤴ TRADE
          </button>
        </div>
      </div>
    </div>
  );
}
