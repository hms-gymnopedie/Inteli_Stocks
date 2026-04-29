import { AIInvestmentGuide } from './AIInvestmentGuide';
import { AnalystTargets } from './AnalystTargets';
import { DisclosuresFeed } from './DisclosuresFeed';
import { Header } from './Header';
import { MACDPanel } from './MACDPanel';
import { MainChart } from './MainChart';
import { Peers } from './Peers';
import { RSIPanel } from './RSIPanel';
import { ValuationGrid } from './ValuationGrid';

// Phase 1: hardcoded Detail symbol. B4-RT will replace this with a route param
// (`/detail/:symbol`) and a ⌘K symbol search. Until then, every section reads
// the same constant so swapping symbols is a one-line edit.
const SYMBOL = 'NVDA';

export function Detail() {
  return (
    <div className="app-frame" style={{ fontSize: 12 }}>
      <Header symbol={SYMBOL} />

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

          <ValuationGrid symbol={SYMBOL} />

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
          <AnalystTargets symbol={SYMBOL} />
          <Peers symbol={SYMBOL} />
        </aside>
      </div>
    </div>
  );
}
