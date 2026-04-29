import { AIInvestmentGuide } from './AIInvestmentGuide';
import { AnalystTargets } from './AnalystTargets';
import { DisclosuresFeed } from './DisclosuresFeed';
import { Header } from './Header';
import { MACDPanel } from './MACDPanel';
import { MainChart } from './MainChart';
import { Peers } from './Peers';
import { RSIPanel } from './RSIPanel';
import { ValuationGrid } from './ValuationGrid';

export function Detail() {
  return (
    <div className="app-frame" style={{ fontSize: 12 }}>
      <Header />

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
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
          <MainChart />

          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
          >
            <RSIPanel />
            <MACDPanel />
          </div>

          <ValuationGrid />

          <DisclosuresFeed />
        </main>

        <aside
          style={{
            borderLeft: '1px solid var(--hairline)',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            overflow: 'auto',
          }}
        >
          <AIInvestmentGuide />
          <AnalystTargets />
          <Peers />
        </aside>
      </div>
    </div>
  );
}
