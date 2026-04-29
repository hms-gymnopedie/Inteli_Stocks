import { useState } from 'react';

import { AIInvestmentGuide } from './AIInvestmentGuide';
import { AnalystTargets } from './AnalystTargets';
import { DisclosuresFeed } from './DisclosuresFeed';
import { Header } from './Header';
import { MACDPanel } from './MACDPanel';
import { MainChart, type StudyKey } from './MainChart';
import { Peers } from './Peers';
import { RSIPanel } from './RSIPanel';
import { ValuationGrid } from './ValuationGrid';

// Phase 1: hardcoded Detail symbol. B4-RT will replace this with a route param
// (`/detail/:symbol`) and a ⌘K symbol search. Until then, every section reads
// the same constant so swapping symbols is a one-line edit.
const SYMBOL = 'NVDA';

const ALL_STUDIES: StudyKey[] = ['RSI', 'MACD', 'VOL'];

export function Detail() {
  // Studies pills are owned here so RSI/MACD panel visibility can follow the
  // same toggle. VOL is consumed locally inside MainChart.
  const [studies, setStudies] = useState<Set<StudyKey>>(
    () => new Set(ALL_STUDIES),
  );

  const toggleStudy = (key: StudyKey) => {
    setStudies((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
          <MainChart
            symbol={SYMBOL}
            studies={studies}
            onToggleStudy={toggleStudy}
          />

          {(studies.has('RSI') || studies.has('MACD')) && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  studies.has('RSI') && studies.has('MACD') ? '1fr 1fr' : '1fr',
                gap: 10,
              }}
            >
              {studies.has('RSI') && <RSIPanel />}
              {studies.has('MACD') && <MACDPanel />}
            </div>
          )}

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
