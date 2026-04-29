import { getGlobalIndex } from '../../data/geo';
import type { GlobalRiskIndex as GlobalRiskIndexData } from '../../data/types';
import { useAsync } from '../../lib/useAsync';

export function GlobalRiskIndex() {
  const { data, loading } = useAsync<GlobalRiskIndexData>(getGlobalIndex, []);

  return (
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
          opacity: loading && !data ? 0.5 : 1,
          transition: 'opacity 200ms ease',
        }}
        aria-busy={loading && !data}
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
            {data ? data.value : '—'}
            <span className="muted-2" style={{ fontSize: 14 }}>
              /100
            </span>
          </div>
          <div className="wf-mono down" style={{ fontSize: 11 }}>
            {data
              ? `${data.delta >= 0 ? '+' : '−'}${Math.abs(data.delta)} ${data.period}`
              : '—'}
          </div>
        </div>
        <div className="wf-mini">{data ? data.note : '—'}</div>
      </div>
    </div>
  );
}
