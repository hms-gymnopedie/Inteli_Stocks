import { useRef, useState, type CSSProperties } from 'react';

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

type ChipName = 'GLOBAL' | 'REGIONS' | 'RISK MAP' | 'FLOWS';

const CHIPS: ChipName[] = ['GLOBAL', 'REGIONS', 'RISK MAP', 'FLOWS'];

const pulseStyle: CSSProperties = {
  outline: '2px solid var(--orange)',
  outlineOffset: 4,
  transition: 'outline 200ms ease',
};

const baseTargetStyle: CSSProperties = {
  transition: 'outline 200ms ease',
};

export function GeoRisk() {
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);
  const [activeChip, setActiveChip] = useState<ChipName | null>('RISK MAP');
  const [pulsing, setPulsing] = useState<ChipName | null>(null);

  const globalRef = useRef<HTMLDivElement | null>(null);
  const regionsRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const flowsRef = useRef<HTMLDivElement | null>(null);

  const refFor = (name: ChipName) => {
    switch (name) {
      case 'GLOBAL':
        return globalRef;
      case 'REGIONS':
        return regionsRef;
      case 'RISK MAP':
        return mapRef;
      case 'FLOWS':
        return flowsRef;
    }
  };

  const handleChip = (name: ChipName) => {
    setActiveChip(name);
    const ref = refFor(name);
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setPulsing(name);
    window.setTimeout(() => {
      setPulsing((cur) => (cur === name ? null : cur));
    }, 1500);
  };

  const targetStyle = (name: ChipName, extra?: CSSProperties): CSSProperties => ({
    ...baseTargetStyle,
    ...(extra ?? {}),
    ...(pulsing === name ? pulseStyle : null),
  });

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
          {CHIPS.map((name) => {
            const isActive = activeChip === name;
            return (
              <button
                key={name}
                type="button"
                className={`chip${isActive ? ' active' : ''}`}
                aria-pressed={isActive}
                onClick={() => handleChip(name)}
                style={{
                  font: 'inherit',
                  color: 'inherit',
                  background: 'transparent',
                  border: 0,
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                {name}
              </button>
            );
          })}
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
          ref={mapRef}
          className="geo-map-wrap"
          style={targetStyle('RISK MAP', {
            position: 'relative',
            borderRight: '1px solid var(--hairline)',
          })}
        >
          <WorldMap onPinClick={setSelectedPin} />

          <div ref={globalRef} style={targetStyle('GLOBAL')}>
            <GlobalRiskIndex />
          </div>

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
              // Wrapper itself doesn't catch clicks so the map underneath can
              // receive zoom/pan gestures; only the cards re-enable pointer
              // events for their own content. (B9-6)
              pointerEvents: 'none',
            }}
          >
            <div style={{ pointerEvents: 'auto' }}>
              <LiveAlertCard />
            </div>
            <div
              ref={flowsRef}
              style={{ ...targetStyle('FLOWS'), pointerEvents: 'auto' }}
            >
              <LayerToggles />
            </div>
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
          <div ref={regionsRef} style={targetStyle('REGIONS')}>
            <Hotspots />
          </div>
          <AffectedPortfolio />
          <AIHedgeSuggestion />
        </aside>
      </div>

      <RegionDrawer pin={selectedPin} onClose={() => setSelectedPin(null)} />
    </div>
  );
}
