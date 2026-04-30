import { getMacro } from '../../data/market';
import type { MacroIndicator, MacroKey } from '../../data/types';
import { Spark } from '../../lib/primitives';
import { useAsync } from '../../lib/useAsync';

const KEYS: MacroKey[] = ['US10Y', 'CPI_YOY', 'USD_KRW', 'WTI'];

const SKELETON: MacroIndicator[] = KEYS.map((key, i) => ({
  key,
  label: '—',
  value: '—',
  delta: '',
  seed: i,
  trend: 0,
}));

function isPositive(delta: string): boolean {
  // '+2.1bp' → up, '−0.10' / '-1.18%' → down. Empty (skeleton) returns up.
  if (!delta) return true;
  return delta.startsWith('+');
}

export function MacroMonitor() {
  const { data, loading } = useAsync<MacroIndicator[]>(
    () => getMacro(KEYS),
    [],
  );
  const items = data ?? SKELETON;

  return (
    <div className="wf-panel" style={{ padding: 12 }}>
      <div className="row between">
        <div className="wf-label">Macro Monitor</div>
        <div className="wf-mini muted-2">Fed · BoK · ECB</div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginTop: 10,
          opacity: loading && !data ? 0.4 : 1,
          transition: 'opacity 120ms linear',
        }}
        aria-busy={loading}
      >
        {items.map((m, i) => (
          <div
            key={`${m.key}-${i}`}
            style={{
              borderLeft: i ? '1px solid var(--hairline)' : 0,
              paddingLeft: i ? 12 : 0,
            }}
          >
            <div className="wf-mini">{m.label}</div>
            <div className="wf-num" style={{ fontSize: 22, marginTop: 2 }}>
              {m.value}
            </div>
            <div
              className="wf-mono"
              style={{
                fontSize: 10,
                color: isPositive(m.delta) ? 'var(--up)' : 'var(--down)',
              }}
            >
              {m.delta || '—'}
            </div>
            <div style={{ marginTop: 4 }}>
              <Spark seed={m.seed} trend={m.trend} w={200} h={26} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
