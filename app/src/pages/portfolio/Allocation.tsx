import { SectorBars } from '../../lib/primitives';

export function Allocation() {
  return (
    <div className="wf-panel" style={{ padding: 12 }}>
      <div className="row between">
        <div className="wf-label">Allocation</div>
        <div className="row gap-1">
          <span
            className="tab active"
            style={{ padding: '3px 8px', fontSize: 10 }}
          >
            SECTOR
          </span>
          <span
            className="tab"
            style={{ padding: '3px 8px', fontSize: 10 }}
          >
            REGION
          </span>
          <span
            className="tab"
            style={{ padding: '3px 8px', fontSize: 10 }}
          >
            ASSET
          </span>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <SectorBars
          items={[
            { name: 'Semis', v: 28 },
            { name: 'Software', v: 18 },
            { name: 'Korea Eq', v: 14 },
            { name: 'Energy', v: 11 },
            { name: 'Healthcare', v: 9 },
            { name: 'Cash', v: 8 },
            { name: 'Bonds', v: 6 },
            { name: 'Crypto', v: 6 },
          ]}
        />
      </div>
    </div>
  );
}
