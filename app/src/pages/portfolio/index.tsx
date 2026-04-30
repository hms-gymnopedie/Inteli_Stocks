import { useCallback, useRef } from 'react';

import type { AllocationBy, AllocationSlice } from '../../data/types';

import { AIInsightsFeed } from './AIInsightsFeed';
import { Allocation } from './Allocation';
import { EquityCurve } from './EquityCurve';
import { HoldingsTable } from './HoldingsTable';
import { KPIStrip } from './KPIStrip';
import { RiskDecomposition } from './RiskDecomposition';
import { TradesLog } from './TradesLog';

export function Portfolio() {
  const holdingsRef = useRef<HTMLDivElement>(null);

  // Allocation drill-in: scroll the holdings table into view. A future
  // enhancement (post-B4) will also seed the holdings filter from the slice
  // name; until then, scrolling preserves user context without coupling
  // sibling components to one another.
  const handleSliceClick = useCallback(
    (_slice: AllocationSlice, _by: AllocationBy) => {
      holdingsRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    },
    [],
  );

  return (
    <div className="app-frame" style={{ fontSize: 12 }}>
      <div
        className="pf-grid"
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 380px',
          minHeight: 0,
        }}
      >
        <main
          className="pf-main"
          style={{
            padding: 14,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/*
           * Wrappers carry the responsive class hooks so the CSS in
           * styles.css (RESPONSIVE B4-RS section) can reach the grids
           * that live inside the section components — section files
           * themselves are off-limits for this task.
           */}
          <div className="pf-kpi-wrap">
            <KPIStrip />
          </div>

          <div
            className="pf-charts-row"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
          >
            <EquityCurve />
            <Allocation onSliceClick={handleSliceClick} />
          </div>

          <div ref={holdingsRef} className="pf-holdings-wrap">
            <HoldingsTable />
          </div>

          <TradesLog />

          <RiskDecomposition />
        </main>

        <div className="pf-aside-wrap">
          <AIInsightsFeed />
        </div>
      </div>
    </div>
  );
}
