import { HeatGrid } from '../../lib/primitives';

export function SectorHeat() {
  return (
    <div className="wf-panel" style={{ padding: 12 }}>
      <div className="row between">
        <div className="wf-label">S&amp;P 500 · Sector heatmap</div>
        <div className="wf-mini">SESSION</div>
      </div>
      <div style={{ marginTop: 10 }}>
        <HeatGrid
          cols={6}
          cells={[
            { t: 'AAPL', v: 1.4 },
            { t: 'MSFT', v: 0.8 },
            { t: 'NVDA', v: 3.2 },
            { t: 'GOOG', v: -0.4 },
            { t: 'AMZN', v: 0.9 },
            { t: 'META', v: 1.1 },
            { t: 'JPM', v: 0.3 },
            { t: 'BAC', v: -0.6 },
            { t: 'V', v: 0.2 },
            { t: 'XOM', v: -1.2 },
            { t: 'CVX', v: -0.9 },
            { t: 'PFE', v: 1.6 },
            { t: 'TSLA', v: -2.3 },
            { t: 'UNH', v: 0.4 },
            { t: 'HD', v: -0.2 },
            { t: 'COST', v: 0.7 },
            { t: 'WMT', v: 0.1 },
            { t: 'KO', v: -0.3 },
            { t: 'NKE', v: 1.9 },
            { t: 'BA', v: -3.6 },
            { t: 'DIS', v: 0.5 },
            { t: 'NFLX', v: 2.4 },
            { t: 'CRM', v: 1.0 },
            { t: 'ORCL', v: -0.7 },
          ]}
        />
      </div>
    </div>
  );
}
