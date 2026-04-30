import { useMemo, useState } from 'react';

import { getRiskFactors } from '../../data/portfolio';
import type { RiskFactor } from '../../data/types';
import { useAsync } from '../../lib/useAsync';

/**
 * Palette for stacked-bar segments. Cycles through 5 muted hues so neighboring
 * factors visually separate; selected factor is highlighted by reducing
 * opacity on non-selected segments rather than recoloring.
 */
const SEGMENT_COLORS = [
  'var(--orange)',
  '#5b8acb',
  '#7e9d6b',
  '#c97a3a',
  '#9d7eb5',
];

const SKELETON_COUNT = 4;

/** Parse "42%" → 42. Returns 0 on parse failure. */
function parseContribution(s: string): number {
  const n = Number.parseFloat(s.replace(/[%\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function RiskDecomposition() {
  const { data, loading } = useAsync<RiskFactor[]>(getRiskFactors, []);
  const [selected, setSelected] = useState<string | null>(null);

  const total = useMemo(() => {
    if (!data) return 0;
    return data.reduce((acc, f) => acc + parseContribution(f.contribution), 0);
  }, [data]);

  const dimmed = loading && !data ? { opacity: 0.4 } : undefined;
  const factors = data ?? [];
  const selectedFactor = data?.find((f) => f.name === selected) ?? null;

  return (
    <div className="wf-panel" style={{ padding: 12 }} aria-busy={loading}>
      <div className="row between">
        <div className="wf-label">Risk decomposition · Factor exposure</div>
        <div className="wf-mini muted-2">
          {data ? `${factors.length} factors` : '—'}
        </div>
      </div>

      {/* Stacked bar */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 14,
          marginTop: 10,
          borderRadius: 3,
          overflow: 'hidden',
          background: 'var(--panel-2)',
          border: '1px solid var(--hairline)',
          ...dimmed,
        }}
        role="img"
        aria-label="Stacked contribution bar"
      >
        {data
          ? factors.map((f, i) => {
              const pct = total > 0
                ? (parseContribution(f.contribution) / total) * 100
                : 0;
              const isSelected = selected === f.name;
              const isDeselected = selected != null && !isSelected;
              return (
                <div
                  key={f.name}
                  title={`${f.name} · ${f.contribution}`}
                  style={{
                    width: `${pct}%`,
                    background: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                    opacity: isDeselected ? 0.3 : 1,
                    transition: 'opacity 150ms ease',
                  }}
                />
              );
            })
          : Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: '25%',
                  background: 'var(--hairline-2)',
                  opacity: 0.4,
                }}
              />
            ))}
      </div>

      {/* Factor rows */}
      <div
        style={{
          marginTop: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          ...dimmed,
        }}
      >
        {data
          ? factors.map((f, i) => {
              const isSelected = selected === f.name;
              const valColor = f.value >= 0 ? 'var(--up)' : 'var(--down)';
              const segColor = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
              return (
                <button
                  key={f.name}
                  type="button"
                  onClick={() =>
                    setSelected((cur) => (cur === f.name ? null : f.name))
                  }
                  aria-pressed={isSelected}
                  style={{
                    all: 'unset',
                    display: 'grid',
                    gridTemplateColumns: '10px 1fr 70px 60px',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 4px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    cursor: 'pointer',
                    borderTop: i === 0 ? 0 : '1px solid var(--hairline)',
                    background: isSelected ? 'var(--panel-2)' : 'transparent',
                    color: isSelected ? 'var(--fg)' : 'var(--fg-2)',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: segColor,
                      display: 'inline-block',
                    }}
                  />
                  <span>{f.name}</span>
                  <span style={{ textAlign: 'right', color: valColor }}>
                    {f.value >= 0 ? '+' : ''}
                    {f.value.toFixed(2)}β
                  </span>
                  <span style={{ textAlign: 'right', color: 'var(--fg)' }}>
                    {f.contribution}
                  </span>
                </button>
              );
            })
          : Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '10px 1fr 70px 60px',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 4px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--fg-4)',
                  borderTop: i === 0 ? 0 : '1px solid var(--hairline)',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: 'var(--hairline-2)',
                    display: 'inline-block',
                  }}
                />
                <span>—————</span>
                <span style={{ textAlign: 'right' }}>—</span>
                <span style={{ textAlign: 'right' }}>—</span>
              </div>
            ))}
      </div>

      {/* Selected factor breakdown */}
      {selectedFactor && (
        <div
          className="wf-panel-flat"
          style={{
            padding: 10,
            marginTop: 10,
            fontSize: 11,
            color: 'var(--fg-2)',
            lineHeight: 1.5,
          }}
        >
          <div className="wf-mini accent">
            {selectedFactor.name.toUpperCase()} · BREAKDOWN
          </div>
          <div style={{ marginTop: 4 }}>
            Beta exposure{' '}
            <span
              className="wf-mono"
              style={{
                color:
                  selectedFactor.value >= 0 ? 'var(--up)' : 'var(--down)',
              }}
            >
              {selectedFactor.value >= 0 ? '+' : ''}
              {selectedFactor.value.toFixed(2)}
            </span>{' '}
            · contributes{' '}
            <span className="wf-mono" style={{ color: 'var(--fg)' }}>
              {selectedFactor.contribution}
            </span>{' '}
            of total factor risk.
          </div>
        </div>
      )}
    </div>
  );
}
