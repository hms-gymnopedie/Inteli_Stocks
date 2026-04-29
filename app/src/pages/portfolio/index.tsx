import { AIInsightsFeed } from './AIInsightsFeed';
import { Allocation } from './Allocation';
import { EquityCurve } from './EquityCurve';
import { HoldingsTable } from './HoldingsTable';
import { KPIStrip } from './KPIStrip';

export function Portfolio() {
  return (
    <div className="app-frame" style={{ fontSize: 12 }}>
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 380px',
          minHeight: 0,
        }}
      >
        <main
          style={{
            padding: 14,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <KPIStrip />

          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
          >
            <EquityCurve />
            <Allocation />
          </div>

          <HoldingsTable />
        </main>

        <AIInsightsFeed />
      </div>
    </div>
  );
}
