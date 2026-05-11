import { useEffect, useState } from 'react';

import { getRegionDetail } from '../../data/geo';
import type { MapPin, RegionDetail } from '../../data/types';

interface RegionDrawerProps {
  pin: MapPin | null;
  onClose: () => void;
}

/**
 * Slide-in panel anchored to the right edge of the viewport. Mounts with
 * `pin === null` so the slide-in transition runs even on first open: when
 * `pin` is set, the wrapper picks up the `.open` class which moves the panel
 * into view (translateX 0). Closing flips the class back, animating it out
 * before unmounting via the parent.
 *
 * Backdrop click + Escape both call `onClose`. Body content is fetched on
 * pin change via `getRegionDetail(pin.label)`; while it loads we show a
 * placeholder timeline.
 */
export function RegionDrawer({ pin, onClose }: RegionDrawerProps) {
  const [detail, setDetail] = useState<RegionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch detail when pin changes.
  useEffect(() => {
    if (!pin) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    getRegionDetail(pin.label)
      .then((d) => {
        if (!cancelled) {
          setDetail(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pin]);

  // Esc → close.
  useEffect(() => {
    if (!pin) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pin, onClose]);

  const open = pin !== null;
  const level = pin?.level ?? 'low';
  const levelColor =
    level === 'high'
      ? 'var(--down)'
      : level === 'med'
        ? 'var(--orange)'
        : 'var(--up)';

  return (
    <>
      {/* Backdrop — click to close. Captures pointer events only when open. */}
      <div
        className={`region-drawer-backdrop${open ? ' open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`region-drawer${open ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label={pin ? `Region detail: ${pin.label}` : 'Region detail'}
      >
        {/* Header */}
        <div
          className="row between"
          style={{
            padding: '12px 14px',
            borderBottom: '1px solid var(--hairline)',
            gap: 10,
          }}
        >
          <div className="col" style={{ minWidth: 0, flex: 1 }}>
            <div
              className="wf-mini muted-2"
              style={{ marginBottom: 2, letterSpacing: '0.08em' }}
            >
              REGION DETAIL
            </div>
            <div
              className="wf-mono"
              style={{
                fontSize: 13,
                color: 'var(--fg)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {pin?.label ?? '—'}
            </div>
          </div>
          <span
            className="tag"
            style={{ color: levelColor, borderColor: levelColor }}
          >
            {level.toUpperCase()}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close region drawer"
            style={{
              all: 'unset',
              cursor: 'pointer',
              fontSize: 18,
              color: 'var(--fg-3)',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: 14,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            flex: 1,
            opacity: loading ? 0.5 : 1,
            transition: 'opacity 200ms ease',
          }}
          aria-busy={loading}
        >
          {/* Event timeline */}
          <section>
            <div className="wf-label">Event timeline</div>
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {(detail?.events ?? []).map((ev, i) => (
                <div
                  key={`${ev.date}-${i}`}
                  className="wf-panel-flat"
                  style={{ padding: 10 }}
                >
                  <div
                    className="wf-mono muted-2"
                    style={{ fontSize: 9, letterSpacing: '0.08em' }}
                  >
                    {ev.date}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: 'var(--fg-2)',
                      lineHeight: 1.5,
                    }}
                  >
                    {ev.headline}
                  </div>
                </div>
              ))}
              {!loading && detail && detail.events.length === 0 && (
                <div className="wf-mini muted">No events on record.</div>
              )}
            </div>
          </section>

          {/* Related ETFs */}
          <section>
            <div className="wf-label">Related ETFs</div>
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {(detail?.etfs ?? []).map((etf) => {
                // Direction falls back to dayPct sign when the server omitted
                // it (e.g. for non-yahoo proxies). Accepts both ASCII '-' and
                // typographic minus (U+2212).
                const trimmed = etf.dayPct.trim();
                const dir: 1 | -1 = etf.direction
                  ? etf.direction
                  : trimmed.startsWith('-') || trimmed.startsWith('−')
                    ? -1
                    : 1;
                const changeColor =
                  dir > 0 ? 'var(--up)' : 'var(--down)';
                const priceLabel =
                  typeof etf.price === 'number' && etf.currency
                    ? `${formatPriceForCurrency(etf.price, etf.currency)} ${etf.currency.toUpperCase()}`
                    : typeof etf.price === 'number'
                      ? formatPriceForCurrency(etf.price, 'USD')
                      : '—';
                return (
                  <div
                    key={etf.symbol}
                    className="dense-row"
                    style={{
                      gridTemplateColumns: 'minmax(0, 1fr) auto 64px',
                      gap: 10,
                      alignItems: 'center',
                      border: '1px solid var(--hairline)',
                      borderRadius: 4,
                      padding: '6px 10px',
                    }}
                  >
                    <div className="col" style={{ minWidth: 0 }}>
                      <span
                        className="ticker"
                        style={{ fontWeight: 600 }}
                      >
                        {etf.symbol}
                      </span>
                      {etf.name && (
                        <span
                          className="wf-mini muted"
                          style={{
                            fontSize: 10,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginTop: 1,
                          }}
                          title={etf.name}
                        >
                          {etf.name}
                        </span>
                      )}
                    </div>
                    <span
                      className="wf-mono"
                      style={{
                        fontSize: 11,
                        color: 'var(--fg-2)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {priceLabel}
                    </span>
                    <span
                      style={{
                        textAlign: 'right',
                        color: changeColor,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {etf.dayPct}
                    </span>
                  </div>
                );
              })}
              {!loading && detail && detail.etfs.length === 0 && (
                <div className="wf-mini muted">No related ETFs.</div>
              )}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

/**
 * Mirror of `server/src/routes/portfolio.ts` `formatPriceForCurrency`:
 * KRW / JPY → integer with ₩ / ¥ glyph + thousand separators.
 * Otherwise → 2-decimal with $ / € / £ / HK$ glyph.
 * Inlined per task constraint (no cross-tree imports).
 */
function formatPriceForCurrency(value: number, ccy: string): string {
  const u = ccy.toUpperCase();
  if (u === 'KRW' || u === 'JPY') {
    return `${u === 'KRW' ? '₩' : '¥'}${Math.round(value).toLocaleString('en-US')}`;
  }
  const glyph =
    u === 'EUR' ? '€' : u === 'GBP' ? '£' : u === 'HKD' ? 'HK$' : '$';
  return `${glyph}${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
