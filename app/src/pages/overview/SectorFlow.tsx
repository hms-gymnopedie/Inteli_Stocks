import { SectorBars } from '../../lib/primitives';

export function SectorFlow() {
  return (
    <div className="wf-panel" style={{ padding: 12 }}>
      <div className="wf-label">Sector flow · Today</div>
      <div style={{ marginTop: 10 }}>
        <SectorBars
          items={[
            { name: 'Tech', v: 1.84 },
            { name: 'Semis', v: 3.21 },
            { name: 'Energy', v: -1.08 },
            { name: 'Financials', v: 0.32 },
            { name: 'Healthcare', v: 0.71 },
            { name: 'Discretionary', v: -0.44 },
            { name: 'Materials', v: -0.22 },
            { name: 'Utilities', v: 0.08 },
          ]}
        />
      </div>
    </div>
  );
}
