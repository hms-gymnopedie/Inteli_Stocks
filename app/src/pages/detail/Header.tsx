import { useEffect, useState } from 'react';
import { getProfile } from '../../data/security';
import { getAIHistory, getVerdict } from '../../data/ai';
import {
  addTrade,
  addWatchlist,
} from '../../data/portfolio';
import type { AIVerdict, Trade } from '../../data/types';
import type { HistoryEntry } from '../../data/aiHistoryTypes';
import { useAsync } from '../../lib/useAsync';

/**
 * Logo placeholder — uses a free third-party CDN for the real bitmap, with a
 * graceful fallback to a 2-char monogram derived from the ticker. The CDN
 * (parqet.com) hosts pre-cropped logos keyed by exchange-prefixed symbol;
 * we strip Yahoo suffixes (.KS / .KQ) since the CDN keys are bare tickers.
 */
function SymbolLogo({ symbol, name }: { symbol: string; name?: string }) {
  const [errored, setErrored] = useState(false);
  const bare = symbol.split('.')[0].toUpperCase();
  const monogram = (name ?? symbol).replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || bare.slice(0, 2);
  const src = `https://assets.parqet.com/logos/symbol/${encodeURIComponent(bare)}?format=png`;

  if (errored) {
    return (
      <div
        aria-label={`${symbol} logo placeholder`}
        style={{
          width: 44, height: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--panel-2)',
          borderRadius: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--orange)',
          letterSpacing: '0.04em',
        }}
      >
        {monogram}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${symbol} logo`}
      width={44}
      height={44}
      onError={() => setErrored(true)}
      style={{
        width: 44, height: 44,
        objectFit: 'contain',
        borderRadius: 6,
        background: 'var(--panel-2)',
      }}
    />
  );
}

interface HeaderProps {
  symbol: string;
}

/**
 * Detail page header — stock identity, live price, AI verdict tag, action chips.
 *
 * Data:
 *  - `getProfile(symbol)` for name / sector / indices / price / day change.
 *  - Verdict tag hydrates from /api/ai/history?area=verdicts (B13-D2),
 *    matched on the current symbol. Falls back to the synthetic NVDA mock
 *    if no verdict has been generated yet for this symbol.
 *  - Action chips (+ WATCHLIST / ⤴ TRADE) hit B8-PF-CRUD endpoints (B13-D4).
 */
export function Header({ symbol }: HeaderProps) {
  const { data: profile, loading } = useAsync(() => getProfile(symbol), [symbol]);

  // Hydrate the verdict pill from history; falls through to "—" while loading
  // or when no entry matches this symbol. (B13-D2)
  const upper = symbol.toUpperCase();
  const [verdict, setVerdict] = useState<AIVerdict | null>(null);
  const [verdictLoading, setVerdictLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void getAIHistory('verdicts', 50).then((entries: HistoryEntry[]) => {
      if (cancelled) return;
      const mine = [...entries].reverse().find(
        (e) => (e.symbol ?? '').toUpperCase() === upper,
      );
      if (mine && mine.data && typeof mine.data === 'object') {
        setVerdict(mine.data as AIVerdict);
      } else {
        setVerdict(null);
      }
    });
    return () => { cancelled = true; };
  }, [upper]);

  async function generateNow(): Promise<void> {
    setVerdictLoading(true);
    try {
      const res = await getVerdict(upper);
      setVerdict(res.data);
    } catch {
      // Best effort — popover stays in current state.
    } finally {
      setVerdictLoading(false);
    }
  }

  // ── Action chip handlers (B13-D4) ──────────────────────────────────────────
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [showTradeForm, setShowTradeForm] = useState(false);

  async function onAddWatchlist(): Promise<void> {
    if (!profile) return;
    setActionBusy(true);
    setActionMsg(null);
    try {
      // Map yahoo ticker → KR watchlist code (strip .KS/.KQ); for non-KR
      // we still add it as the bare code so users get one-click coverage
      // until per-region watchlists land.
      const code = profile.symbol.replace(/\.[A-Z]+$/, '');
      await addWatchlist({
        code,
        name:      profile.name,
        change:    profile.dayChangePct,
        seed:      Math.floor(Math.random() * 1000),
        direction: profile.dayChangePct.trim().startsWith('+') ? 1 : -1,
      });
      setActionMsg(`Added ${profile.symbol} to watchlist.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setActionMsg(/code_exists/.test(msg) ? 'Already on watchlist.' : `Failed: ${msg}`);
    } finally {
      setActionBusy(false);
    }
  }

  async function onAddTrade(t: Trade): Promise<void> {
    setActionBusy(true);
    setActionMsg(null);
    try {
      await addTrade(t);
      setShowTradeForm(false);
      setActionMsg(`Logged ${t.side} ${t.quantity} ${t.symbol}.`);
    } catch (e) {
      setActionMsg(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActionBusy(false);
    }
  }

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
          <SymbolLogo symbol={profile?.symbol ?? symbol} name={profile?.name} />
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
            {verdict ? (
              <>
                <span
                  className="tag"
                  style={{
                    color: verdictColor(verdict.verdict),
                    borderColor: verdictColor(verdict.verdict),
                    fontSize: 10,
                    padding: '4px 10px',
                  }}
                  title={verdict.summary}
                >
                  ● {verdict.verdict}
                </span>
                <span className="wf-mono muted">RISK {verdict.riskScore} / 5</span>
              </>
            ) : (
              <>
                <span className="tag muted" style={{ fontSize: 10, padding: '4px 10px' }}>
                  no verdict
                </span>
                <button
                  type="button"
                  onClick={() => void generateNow()}
                  disabled={verdictLoading}
                  className="tag"
                  style={{ background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 10 }}
                  title={`Generate AI verdict for ${upper}`}
                >
                  {verdictLoading ? 'generating…' : '↻ generate'}
                </button>
              </>
            )}
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
            disabled={actionBusy || !profile}
            onClick={() => void onAddWatchlist()}
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
            disabled={!profile}
            onClick={() => setShowTradeForm((v) => !v)}
          >
            ⤴ TRADE
          </button>
        </div>
      </div>
      {actionMsg && (
        <div className="wf-mini muted" style={{ gridColumn: '1 / -1' }}>
          {actionMsg}
        </div>
      )}
      {showTradeForm && profile && (
        <div style={{ gridColumn: '1 / -1' }}>
          <TradeChip
            symbol={profile.symbol}
            currency={profile.currency || 'USD'}
            price={profile.price}
            busy={actionBusy}
            onSubmit={onAddTrade}
            onCancel={() => setShowTradeForm(false)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Verdict color mapping ──────────────────────────────────────────────────

function verdictColor(v: string): string {
  switch (v) {
    case 'ACCUMULATE': return 'var(--up)';
    case 'HOLD':       return 'var(--orange)';
    case 'REDUCE':     return 'var(--down)';
    case 'AVOID':      return 'var(--down)';
    default:           return 'var(--orange)';
  }
}

// ─── Inline trade form ─────────────────────────────────────────────────────

interface TradeChipProps {
  symbol: string;
  currency: string;
  price: number;
  busy: boolean;
  onSubmit: (t: Trade) => Promise<void> | void;
  onCancel: () => void;
}

function TradeChip({ symbol, currency, price, busy, onSubmit, onCancel }: TradeChipProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [qty, setQty] = useState('1');
  const [px, setPx]   = useState(String(price || 0));

  const cell: React.CSSProperties = {
    background: 'var(--panel-2)',
    border: '1px solid var(--hairline)',
    borderRadius: 4,
    padding: '4px 8px',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--fg)',
    outline: 'none',
    minWidth: 0,
  };

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    void onSubmit({
      date,
      symbol,
      side,
      quantity: Number(qty) || 0,
      price:    Number(px) || 0,
      currency,
    });
  };

  return (
    <form
      onSubmit={submit}
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 70px 70px 90px 60px auto',
        gap: 6,
        marginTop: 8,
        padding: '8px 10px',
        background: 'var(--panel-2)',
        borderRadius: 4,
        alignItems: 'center',
      }}
    >
      <input style={cell} type="date"   value={date}  onChange={(e) => setDate(e.target.value)} required />
      <select style={cell}              value={side}  onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}>
        <option value="BUY">BUY</option>
        <option value="SELL">SELL</option>
      </select>
      <input style={cell} type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="qty" required />
      <input style={cell} type="number" min="0" step="any" value={px}  onChange={(e) => setPx(e.target.value)}  placeholder="price" required />
      <span className="wf-mini muted">{currency}</span>
      <div className="row gap-1">
        <button type="submit" className="tag" style={{ background: 'var(--orange)', color: '#000', border: 0, cursor: 'pointer' }} disabled={busy}>
          OK
        </button>
        <button type="button" className="tag" style={{ background: 'transparent', cursor: 'pointer' }} onClick={onCancel}>
          ×
        </button>
      </div>
    </form>
  );
}
