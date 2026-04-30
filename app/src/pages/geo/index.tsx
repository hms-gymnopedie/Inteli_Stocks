import { useState } from 'react';

import type { MapPin } from '../../data/types';

import { AffectedPortfolio } from './AffectedPortfolio';
import { AIHedgeSuggestion } from './AIHedgeSuggestion';
import { GlobalRiskIndex } from './GlobalRiskIndex';
import { Hotspots } from './Hotspots';
import { LayerToggles } from './LayerToggles';
import { LiveAlertCard } from './LiveAlertCard';
import { RegionDrawer } from './RegionDrawer';
import { RiskLegend } from './RiskLegend';
import { WorldMap } from './WorldMap';

export function GeoRisk() {
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);

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
        <div className="row gap-2 geo-titlebar-chips">
          <span className="chip">GLOBAL</span>
          <span className="chip">REGIONS</span>
          <span className="chip active">RISK MAP</span>
          <span className="chip">FLOWS</span>
        </div>
      </div>

      <div
        className="geo-grid"
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          minHeight: 0,
        }}
      >
        <div
          className="geo-map-wrap"
          style={{
            position: 'relative',
            borderRight: '1px solid var(--hairline)',
          }}
        >
          <WorldMap onPinClick={setSelectedPin} />

          <GlobalRiskIndex />

          <div
            className="geo-overlays"
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
          className="geo-aside"
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

      <RegionDrawer pin={selectedPin} onClose={() => setSelectedPin(null)} />
    </div>
  );
}
