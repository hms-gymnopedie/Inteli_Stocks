import { AffectedPortfolio } from './AffectedPortfolio';
import { AIHedgeSuggestion } from './AIHedgeSuggestion';
import { GlobalRiskIndex } from './GlobalRiskIndex';
import { Hotspots } from './Hotspots';
import { LayerToggles } from './LayerToggles';
import { LiveAlertCard } from './LiveAlertCard';
import { RiskLegend } from './RiskLegend';
import { WorldMap } from './WorldMap';

export function GeoRisk() {
  return (
    <div className="app-frame" style={{ fontSize: 12 }}>
      <div className="titlebar" style={{ padding: '6px 12px' }}>
        <div className="lights">
          <div className="light" />
          <div className="light" />
          <div className="light" />
        </div>
        <div className="wf-mini" style={{ marginLeft: 6 }}>
          GEOPOLITICAL RISK MONITOR
        </div>
        <div style={{ flex: 1 }} />
        <div className="row gap-2">
          <span className="chip">GLOBAL</span>
          <span className="chip">REGIONS</span>
          <span className="chip active">RISK MAP</span>
          <span className="chip">FLOWS</span>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          minHeight: 0,
        }}
      >
        <div
          style={{
            position: 'relative',
            borderRight: '1px solid var(--hairline)',
          }}
        >
          <WorldMap />

          <GlobalRiskIndex />

          <div
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              width: 240,
            }}
          >
            <LiveAlertCard />
            <LayerToggles />
          </div>

          <RiskLegend />
        </div>

        <aside
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
          }}
        >
          <Hotspots />
          <AffectedPortfolio />
          <AIHedgeSuggestion />
        </aside>
      </div>
    </div>
  );
}
