import { useState } from 'react';

import { streamAlerts } from '../../data/geo';
import type { RiskAlert } from '../../data/types';
import { useAsyncStream } from '../../lib/useAsync';

/**
 * Streamed live alerts card. Collapsible — default collapsed so the map
 * stays unblocked. Header bar is always visible (label + level chip);
 * click toggles the full alert body. (B32)
 */
export function LiveAlertCard() {
  const alerts = useAsyncStream<RiskAlert>(() => streamAlerts(), []);
  const latest = alerts.length > 0 ? alerts[alerts.length - 1] : null;
  const [open, setOpen] = useState(false);

  const levelChip =
    latest?.level === 'high'
      ? 'HIGH'
      : latest?.level === 'med'
        ? 'MED'
        : latest?.level === 'low'
          ? 'LOW'
          : 'WAIT';

  return (
    <div
      className="wf-panel" data-tour="geo-alert"
      style={{
        padding: open ? 12 : '6px 10px',
        backdropFilter: 'blur(8px)',
        background: 'rgba(20,20,22,0.7)',
        ...(latest ? {} : { opacity: 0.55 }),
      }}
      aria-busy={!latest}
    >
      <button
        type="button"
        className="row between"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="geo-alert-body"
        style={{
          all: 'unset', cursor: 'pointer', display: 'flex',
          width: '100%', alignItems: 'center', justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div className="row gap-2" style={{ alignItems: 'center' }}>
          <span className="wf-label">Live · Alert</span>
          {!open && latest && (
            <span className="wf-mini muted" style={{
              maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {latest.title}
            </span>
          )}
        </div>
        <div className="row gap-1" style={{ alignItems: 'center' }}>
          <div className="chip dot warn">{levelChip}</div>
          <span style={{
            display: 'inline-block',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
            color: 'var(--fg-3)', fontSize: 10,
          }}>▾</span>
        </div>
      </button>
      {open && (
        <div id="geo-alert-body">
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              lineHeight: 1.45,
              color: 'var(--fg)',
            }}
          >
            {latest?.title ?? 'Listening for live geo-risk alerts…'}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            {latest?.body ?? '—'}
          </div>
          <div className="row gap-2" style={{ marginTop: 10 }}>
            <span className="tag" style={{ color: 'var(--orange)', borderColor: 'var(--orange)' }}>
              {latest?.hedge ?? 'HEDGE · —'}
            </span>
            <span className="tag">DETAIL ↗</span>
          </div>
          {alerts.length > 1 && (
            <div className="wf-mini muted-2" style={{ marginTop: 8, textAlign: 'right' }}>
              {alerts.length} alerts in feed
            </div>
          )}
        </div>
      )}
    </div>
  );
}
