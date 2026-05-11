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

  const [open, setOpen] = useState(false);
  const activeCount = layers.filter((l) => l.enabled).length;

  return (
    <div
      className="wf-panel" data-tour="geo-layers"
      style={{
        padding: open ? 12 : '6px 10px',
        backdropFilter: 'blur(8px)',
        background: 'rgba(20,20,22,0.7)',
        opacity: loading && !data ? 0.5 : 1,
        transition: 'opacity 200ms ease',
      }}
      aria-busy={loading && !data}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="geo-layers-body"
        style={{
          all: 'unset', cursor: 'pointer', width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div className="row gap-2" style={{ alignItems: 'center' }}>
          <span className="wf-label">Layers</span>
          {!open && !isSkeleton && (
            <span className="wf-mini muted">{activeCount} / {layers.length} on</span>
          )}
        </div>
        <span style={{
          display: 'inline-block',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 150ms ease',
          color: 'var(--fg-3)', fontSize: 10,
        }}>▾</span>
      </button>
      {open && (
      <div
        id="geo-layers-body"
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
      )}
    </div>
  );
}
