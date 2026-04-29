import { useState } from 'react';

type Level = 'low' | 'med' | 'high';

const LEVELS: { key: Level; label: string; color: string }[] = [
  { key: 'low',  label: 'LOW',  color: 'var(--up)' },
  { key: 'med',  label: 'MED',  color: 'var(--orange)' },
  { key: 'high', label: 'HIGH', color: 'var(--down)' },
];

export function RiskLegend() {
  const [hovered, setHovered] = useState<Level | null>(null);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 14,
        left: 14,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: '6px 12px',
        background: 'rgba(20,20,22,0.7)',
        border: '1px solid var(--hairline)',
        borderRadius: 999,
        backdropFilter: 'blur(8px)',
      }}
    >
      <span className="wf-mini">RISK</span>
      {LEVELS.map((lv) => {
        const isHovered = hovered === lv.key;
        const dimmed = hovered !== null && !isHovered;
        return (
          <span
            key={lv.key}
            className="wf-mini"
            onMouseEnter={() => setHovered(lv.key)}
            onMouseLeave={() => setHovered(null)}
            style={{
              color: lv.color,
              opacity: dimmed ? 0.35 : 1,
              transform: isHovered ? 'scale(1.08)' : 'scale(1)',
              transformOrigin: 'left center',
              transition: 'opacity 150ms ease, transform 150ms ease',
              cursor: 'default',
              fontWeight: isHovered ? 600 : 400,
            }}
          >
            ● {lv.label}
          </span>
        );
      })}
      <span className="wf-mini muted-2" style={{ marginLeft: 12 }}>
        UPDATED 26 APR · 09:42 KST
      </span>
    </div>
  );
}
