import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ChartStyle = 'line' | 'candle' | 'area';
export type MapStyle = 'satellite' | 'terrain' | 'mono';
export type Density = 'compact' | 'comfortable' | 'spacious';

export interface Tweaks {
  chartStyle: ChartStyle;
  mapStyle: MapStyle;
  density: Density;
  showGrid: boolean;
  accent: string;
}

const DEFAULTS: Tweaks = {
  chartStyle: 'line',
  mapStyle: 'satellite',
  density: 'comfortable',
  showGrid: true,
  accent: '#E8702A',
};

interface TweaksContextValue {
  values: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
}

const TweaksContext = createContext<TweaksContextValue | null>(null);

export function TweaksProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<Tweaks>(DEFAULTS);

  useEffect(() => {
    document.documentElement.style.setProperty('--orange', values.accent);
    document.documentElement.style.setProperty(
      '--orange-soft',
      values.accent,
    );
    document.body.style.fontSize =
      values.density === 'compact'
        ? '11px'
        : values.density === 'spacious'
          ? '13px'
          : '12px';
  }, [values.accent, values.density]);

  const ctx = useMemo<TweaksContextValue>(
    () => ({
      values,
      setTweak: (key, value) => setValues((prev) => ({ ...prev, [key]: value })),
    }),
    [values],
  );

  return (
    <TweaksContext.Provider value={ctx}>{children}</TweaksContext.Provider>
  );
}

export function useTweaks() {
  const ctx = useContext(TweaksContext);
  if (!ctx) throw new Error('useTweaks must be used inside TweaksProvider');
  return ctx;
}

interface RadioOption<T extends string> {
  label: string;
  value: T;
}

function TweakRadio<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: RadioOption<T>[];
}) {
  return (
    <div className="tw-row">
      <label>{label}</label>
      <div className="tw-radio">
        {options.map((o) => (
          <button
            key={o.value}
            className={value === o.value ? 'active' : ''}
            onClick={() => onChange(o.value)}
            type="button"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TweakToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="tw-row">
      <label>{label}</label>
      <button
        type="button"
        className={`tw-toggle ${value ? 'on' : ''}`}
        onClick={() => onChange(!value)}
        aria-pressed={value}
      />
    </div>
  );
}

function TweakColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="tw-row">
      <label>{label}</label>
      <input
        type="color"
        className="tw-color"
        style={{ background: value }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function TweaksPanel() {
  const [open, setOpen] = useState(false);
  const { values, setTweak } = useTweaks();

  return (
    <>
      <button
        type="button"
        className="tweaks-fab"
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ color: 'var(--orange)' }}>●</span>
        {open ? 'Close Tweaks' : 'Tweaks'}
      </button>
      {open && (
        <div
          className="tweaks-panel"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="tw-section">
            <div className="tw-section-label">Chart</div>
            <TweakRadio
              label="Style"
              value={values.chartStyle}
              onChange={(v) => setTweak('chartStyle', v)}
              options={[
                { label: 'Line', value: 'line' },
                { label: 'Candle', value: 'candle' },
                { label: 'Area', value: 'area' },
              ]}
            />
            <TweakToggle
              label="Show grid"
              value={values.showGrid}
              onChange={(v) => setTweak('showGrid', v)}
            />
          </div>
          <div className="tw-section">
            <div className="tw-section-label">Map</div>
            <TweakRadio
              label="Style"
              value={values.mapStyle}
              onChange={(v) => setTweak('mapStyle', v)}
              options={[
                { label: 'Sat', value: 'satellite' },
                { label: 'Terr', value: 'terrain' },
                { label: 'Mono', value: 'mono' },
              ]}
            />
          </div>
          <div className="tw-section">
            <div className="tw-section-label">Layout</div>
            <TweakRadio
              label="Density"
              value={values.density}
              onChange={(v) => setTweak('density', v)}
              options={[
                { label: 'Cmp', value: 'compact' },
                { label: 'Mid', value: 'comfortable' },
                { label: 'Spc', value: 'spacious' },
              ]}
            />
            <TweakColor
              label="Accent"
              value={values.accent}
              onChange={(v) => setTweak('accent', v)}
            />
          </div>
        </div>
      )}
    </>
  );
}
