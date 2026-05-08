/**
 * Rich card for one PositionRationale (B19).
 *
 * Shows: symbol + entry, reason, each trigger as a pill with current
 * price's distance to it (so the user can see how close they are to a
 * fire). Includes a cancel button.
 */

import { useEffect, useState } from 'react';

import { deletePosition, type PositionRationale, type SellTrigger } from '../../data/positions';
import { getProfile } from '../../data/security';

interface Props {
  rationale: PositionRationale;
  onChanged: () => void;
}

export function RationaleCard({ rationale, onChanged }: Props) {
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getProfile(rationale.symbol)
      .then((p) => { if (!cancelled) setCurrentPrice(p?.price ?? null); })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [rationale.symbol]);

  async function cancel(): Promise<void> {
    if (!window.confirm(`Cancel position rationale for ${rationale.symbol}?`)) return;
    setBusy(true);
    try {
      await deletePosition(rationale.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const heldDays = Math.floor((Date.now() - rationale.createdAt) / (24 * 3600_000));
  const pnlPct = currentPrice != null
    ? (currentPrice / rationale.entryPrice - 1) * 100
    : null;

  return (
    <div className="positions-row">
      <div className="row between center">
        <div className="row gap-2 center">
          <span className="ticker" style={{ fontSize: 13 }}>{rationale.symbol}</span>
          <span className="wf-mini muted">entry ${rationale.entryPrice.toFixed(2)}</span>
          {currentPrice != null && (
            <>
              <span className="wf-mini muted">·</span>
              <span className="wf-mini">now ${currentPrice.toFixed(2)}</span>
              <span
                className="wf-mono"
                style={{ fontSize: 11, color: (pnlPct ?? 0) >= 0 ? 'var(--up)' : 'var(--down)' }}
              >
                {(pnlPct ?? 0) >= 0 ? '+' : '−'}{Math.abs(pnlPct ?? 0).toFixed(2)}%
              </span>
            </>
          )}
          <span className="wf-mini muted-2" style={{ marginLeft: 4 }}>
            {heldDays === 0 ? 'today' : `${heldDays}d held`}
          </span>
        </div>
        <button
          type="button"
          className="settings-btn-danger"
          onClick={() => void cancel()}
          disabled={busy}
          style={{ padding: '2px 10px', fontSize: 10 }}
          title="Remove this rationale"
        >
          cancel
        </button>
      </div>

      <div className="positions-reason">{rationale.reason}</div>

      <div className="row gap-2" style={{ flexWrap: 'wrap', marginTop: 6 }}>
        {rationale.triggers.map((t, i) => (
          <TriggerChip key={i} trigger={t} currentPrice={currentPrice} />
        ))}
      </div>
    </div>
  );
}

function TriggerChip({ trigger, currentPrice }: { trigger: SellTrigger; currentPrice: number | null }) {
  const { label, distance } = describeTriggerWithDistance(trigger, currentPrice);
  return (
    <span
      className="tag"
      style={{
        fontSize: 10,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        ...(distance && distance.color ? { borderColor: distance.color, color: distance.color } : {}),
      }}
      title={distance?.title}
    >
      <span>{label}</span>
      {distance && <span style={{ opacity: 0.7 }}>· {distance.text}</span>}
    </span>
  );
}

function describeTriggerWithDistance(
  t: SellTrigger,
  px: number | null,
): { label: string; distance: { text: string; color?: string; title?: string } | null } {
  switch (t.type) {
    case 'date':
      return { label: `by ${t.date}`, distance: null };
    case 'absoluteAbove':
      return px != null
        ? { label: `≥ $${t.price.toFixed(2)}`, distance: pctDistance(px, t.price, true) }
        : { label: `≥ $${t.price.toFixed(2)}`, distance: null };
    case 'absoluteBelow':
      return px != null
        ? { label: `≤ $${t.price.toFixed(2)}`, distance: pctDistance(px, t.price, false) }
        : { label: `≤ $${t.price.toFixed(2)}`, distance: null };
    case 'pctFromBase': {
      const target = t.basePrice * (1 + t.pct / 100);
      return px != null
        ? {
            label: `${t.pct >= 0 ? '+' : ''}${t.pct}% from $${t.basePrice.toFixed(2)}`,
            distance: pctDistance(px, target, t.pct >= 0),
          }
        : { label: `${t.pct >= 0 ? '+' : ''}${t.pct}% from $${t.basePrice.toFixed(2)}`, distance: null };
    }
    case 'trailingFromPeak': {
      const target = t.peakPrice * (1 + t.pct / 100);
      return px != null
        ? {
            label: `trailing ${t.pct}% from $${t.peakPrice.toFixed(2)}`,
            distance: pctDistance(px, target, false),
          }
        : { label: `trailing ${t.pct}% from $${t.peakPrice.toFixed(2)}`, distance: null };
    }
  }
}

function pctDistance(current: number, target: number, isUpsideTarget: boolean): { text: string; color?: string; title?: string } {
  const diffPct = ((target - current) / current) * 100;
  const ready = isUpsideTarget ? current >= target : current <= target;
  if (ready) {
    return { text: 'ready', color: 'var(--orange)', title: 'Trigger condition met' };
  }
  const dist = Math.abs(diffPct);
  // Colour scale: <2% urgent, <5% close, else neutral.
  const color = dist < 2 ? 'var(--orange)' : dist < 5 ? 'var(--fg-2)' : undefined;
  return {
    text: isUpsideTarget ? `+${dist.toFixed(2)}%` : `−${dist.toFixed(2)}%`,
    color,
    title: `current $${current.toFixed(2)} → target $${target.toFixed(2)}`,
  };
}
