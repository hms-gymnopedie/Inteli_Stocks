import { useEffect, useState } from 'react';
import { getLayers } from '../../data/geo';
import type { MapLayer } from '../../data/types';
import { useAsync } from '../../lib/useAsync';

const SKELETON_COUNT = 6;

export function LayerToggles() {
  const { data, loading } = useAsync<MapLayer[]>(getLayers, []);

  // Local state: name → enabled. Hydrated once from the fetched defaults.
  // The map's actual layer rendering is owned by B2-MAP — for now this state
  // is purely visual (toggle reflects on/off).
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!data) return;
    setEnabled((prev) => {
      // Only initialize keys that haven't been touched yet, so user toggles
      // survive any later refetch.
      const next = { ...prev };
      for (const layer of data) {
        if (!(layer.name in next)) next[layer.name] = layer.enabled;
      }
      return next;
    });
  }, [data]);

  const toggle = (name: string) => {
    setEnabled((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const layers: MapLayer[] =
    data && data.length > 0
      ? data.map((l) => ({
          name: l.name,
          enabled: enabled[l.name] ?? l.enabled,
        }))
      : Array.from({ length: SKELETON_COUNT }, (_, i) => ({
          name: `skeleton-${i}`,
          enabled: false,
        }));

  const isSkeleton = !data || data.length === 0;

  return (
    <div
      className="wf-panel"
      style={{
        padding: 12,
        backdropFilter: 'blur(8px)',
        background: 'rgba(20,20,22,0.7)',
        opacity: loading && !data ? 0.5 : 1,
        transition: 'opacity 200ms ease',
      }}
      aria-busy={loading && !data}
    >
      <div className="wf-label">Layers</div>
      <div
        role="group"
        aria-label="Map layer toggles"
        style={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
        }}
      >
        {layers.map((layer) => {
          const on = layer.enabled;
          if (isSkeleton) {
            return (
              <div
                key={layer.name}
                className="row between"
                style={{ color: 'var(--fg-3)', opacity: 0.4 }}
              >
                <span>—</span>
                <span
                  style={{
                    width: 22,
                    height: 12,
                    borderRadius: 6,
                    background: 'var(--hairline-2)',
                    display: 'inline-block',
                  }}
                />
              </div>
            );
          }
          return (
            <button
              key={layer.name}
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={`Toggle ${layer.name}`}
              onClick={() => toggle(layer.name)}
              className="row between"
              style={{
                all: 'unset',
                cursor: 'pointer',
                color: on ? 'var(--fg)' : 'var(--fg-3)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{layer.name}</span>
              <span
                style={{
                  width: 22,
                  height: 12,
                  borderRadius: 6,
                  background: on ? 'var(--orange)' : 'var(--hairline-2)',
                  position: 'relative',
                  display: 'inline-block',
                  transition: 'background 150ms ease',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 1,
                    ...(on ? { right: 1 } : { left: 1 }),
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 150ms ease, right 150ms ease',
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
