import { useState } from 'react';
import { useParams } from 'react-router-dom';

import { AIInvestmentGuide } from './AIInvestmentGuide';
import { AnalystTargets } from './AnalystTargets';
import { DisclosuresFeed } from './DisclosuresFeed';
import { EarningsGuidance } from './EarningsGuidance';
import { Header } from './Header';
import { MACDPanel } from './MACDPanel';
import { MainChart, type StudyKey } from './MainChart';
import { Peers } from './Peers';
import { RSIPanel } from './RSIPanel';
import { ValuationGrid } from './ValuationGrid';

// Default symbol when the URL is just `/detail` (no param). The full route
// `/detail/:symbol` is wired in App.tsx — every section keeps reading
// `SYMBOL` so the existing prop-drill is undisturbed.
const DEFAULT_SYMBOL = 'NVDA';

const ALL_STUDIES: StudyKey[] = ['RSI', 'MACD', 'VOL'];

export function Detail() {
  const params = useParams<{ symbol?: string }>();
  const SYMBOL = params.symbol ?? DEFAULT_SYMBOL;
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
      {/* Header is a section component — wrap it so CSS can reach the
          inline 1fr/auto grid inside without editing Header.tsx. */}
      <div className="dt-header-wrap">
        <Header symbol={SYMBOL} />
      </div>

      <div
        className="dt-grid"
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          minHeight: 0,
        }}
      >
        <main
          className="dt-main"
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
              className="dt-rsi-macd-row"
              style={{
                display: 'grid',
                gridTemplateColumns:
                  studies.has('RSI') && studies.has('MACD') ? '1fr 1fr' : '1fr',
                gap: 10,
              }}
            >
              {studies.has('RSI') && <RSIPanel symbol={SYMBOL} />}
              {studies.has('MACD') && <MACDPanel symbol={SYMBOL} />}
            </div>
          )}

          {/* Valuation grid lives inside ValuationGrid.tsx as repeat(6, 1fr).
              Wrap so responsive CSS can override the inner template. */}
          <div className="dt-valuation-wrap">
            <ValuationGrid symbol={SYMBOL} />
          </div>

          <DisclosuresFeed />

          <EarningsGuidance symbol={SYMBOL} />
        </main>

        <aside
          className="dt-aside"
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
