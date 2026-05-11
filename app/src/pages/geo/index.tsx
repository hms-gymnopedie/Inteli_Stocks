import { useCallback, useRef, useState, type CSSProperties } from 'react';

import type { MapPin, RiskHotspot, RiskLevel } from '../../data/types';

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

/**
 * Map ISO-3 country codes to the same `LABEL` format that the pins (and the
 * server's per-region fallback) use, so clicking a heat-tinted country
 * opens the same drawer a pin would. Anything missing falls back to the
 * country code itself — the drawer still renders, just with the generic
 * "No timeline" body.
 */
const ISO3_TO_PIN_LABEL: Record<string, string> = {
  UKR: 'UA · WAR',
  RUS: 'UA · WAR',
  ISR: 'IL · CONFLICT',
  PSE: 'IL · CONFLICT',
  IRN: 'IR · TENSION',
  TWN: 'TW · TENSION',
  KOR: 'KR · NK RISK',
  USA: 'US · ELECTION',
  CHN: 'CN · TARIFFS',
  NGA: 'NG · ENERGY',
};

/**
 * Hotspot → pin label. Best-effort substring match against the hotspot's
 * `name` field. Falls back to using the hotspot name verbatim.
 */
function hotspotToLabel(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('taiwan'))   return 'TW · TENSION';
  if (n.includes('ukrain') || n.includes('russia')) return 'UA · WAR';
  if (n.includes('iran'))     return 'IR · TENSION';
  if (n.includes('israel') || n.includes('middle east') || n.includes('red sea')) return 'IL · CONFLICT';
  if (n.includes('korea'))    return 'KR · NK RISK';
  if (n.includes('china') || n.includes('us-china') || n.includes('tariff')) return 'US · ELECTION';
  if (n.includes('niger'))    return 'NG · ENERGY';
  return name;
}

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

  // Heat-region click — synthesize a pin so the existing drawer flow works.
  const handleCountryClick = useCallback((iso3: string, level: RiskLevel) => {
    const label = ISO3_TO_PIN_LABEL[iso3] ?? iso3;
    setSelectedPin({ label, level, x: 0, y: 0 });
  }, []);

  // Hotspot card click — same synthesized pin pattern.
  const handleHotspotSelect = useCallback((h: RiskHotspot) => {
    setSelectedPin({ label: hotspotToLabel(h.name), level: h.level, x: 0, y: 0 });
  }, []);

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
          <WorldMap
            onPinClick={setSelectedPin}
            onCountryClick={handleCountryClick}
          />

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
            <Hotspots onSelect={handleHotspotSelect} />
          </div>
          <AffectedPortfolio />
          <AIHedgeSuggestion />
        </aside>
      </div>

      <RegionDrawer pin={selectedPin} onClose={() => setSelectedPin(null)} />
    </div>
  );
}
