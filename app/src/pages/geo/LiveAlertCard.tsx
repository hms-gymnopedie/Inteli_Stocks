import { streamAlerts } from '../../data/geo';
import type { RiskAlert } from '../../data/types';
import { useAsyncStream } from '../../lib/useAsync';

/**
 * Streamed live alerts card. The map overlays a single card showing the most
 * recent alert; if a feed exists we pop the latest one. While the stream is
 * warming up, render a dimmed placeholder.
 */
export function LiveAlertCard() {
  const alerts = useAsyncStream<RiskAlert>(() => streamAlerts(), []);
  const latest = alerts.length > 0 ? alerts[alerts.length - 1] : null;

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
      className="wf-panel"
      style={{
        padding: 12,
        backdropFilter: 'blur(8px)',
        background: 'rgba(20,20,22,0.7)',
        ...(latest ? {} : { opacity: 0.55 }),
      }}
      aria-busy={!latest}
    >
      <div className="row between">
        <div className="wf-label">Live · Alert</div>
        <div className="chip dot warn">{levelChip}</div>
      </div>
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
      <div
        className="muted"
        style={{ fontSize: 11, marginTop: 4 }}
      >
        {latest?.body ?? '—'}
      </div>
      <div className="row gap-2" style={{ marginTop: 10 }}>
        <span
          className="tag"
          style={{
            color: 'var(--orange)',
            borderColor: 'var(--orange)',
          }}
        >
          {latest?.hedge ?? 'HEDGE · —'}
        </span>
        <span className="tag">DETAIL ↗</span>
      </div>
      {alerts.length > 1 && (
        <div
          className="wf-mini muted-2"
          style={{ marginTop: 8, textAlign: 'right' }}
        >
          {alerts.length} alerts in feed
        </div>
      )}
    </div>
  );
}
