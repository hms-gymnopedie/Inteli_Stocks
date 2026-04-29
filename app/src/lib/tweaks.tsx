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
  timezone: string;
  locale: string;
  currency: string;
}

const DEFAULTS: Tweaks = {
  chartStyle: 'line',
  mapStyle: 'satellite',
  density: 'comfortable',
  showGrid: true,
  accent: '#E8702A',
  timezone: 'America/New_York',
  locale: 'en-US',
  currency: 'USD',
};

const STORAGE_KEY = 'intelistock.tweaks.v1';

function loadFromStorage(): Tweaks {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Tweaks> | null;
    if (!parsed || typeof parsed !== 'object') return DEFAULTS;
    // DEFAULTS provides the canonical shape; spread parsed last but only known
    // keys survive the type — unknown / missing fields fall back to defaults.
    return { ...DEFAULTS, ...parsed };
  } catch {
    // Corrupted JSON → fall back silently.
    return DEFAULTS;
  }
}

function saveToStorage(values: Tweaks) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Quota exceeded / private mode — silent no-op.
  }
}

interface TweaksContextValue {
  values: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
  reset: () => void;
}

const TweaksContext = createContext<TweaksContextValue | null>(null);

export function TweaksProvider({ children }: { children: ReactNode }) {
  // Start from DEFAULTS so SSR matches CSR; hydrate from localStorage on mount.
  const [values, setValues] = useState<Tweaks>(DEFAULTS);

  useEffect(() => {
    const loaded = loadFromStorage();
    setValues(loaded);
    // No write here — saveToStorage runs from setTweak/reset only.
  }, []);

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
    // Reflect locale on <html lang> so screen readers pick the right language.
    document.documentElement.setAttribute('lang', values.locale);
  }, [values.accent, values.density, values.locale]);

  const ctx = useMemo<TweaksContextValue>(
    () => ({
      values,
      setTweak: (key, value) =>
        setValues((prev) => {
          const next = { ...prev, [key]: value };
          saveToStorage(next);
          return next;
        }),
      reset: () => {
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.removeItem(STORAGE_KEY);
          } catch {
            // ignore
          }
        }
        setValues(DEFAULTS);
      },
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

interface SelectOption {
  label: string;
  value: string;
}

// Inline-styled select to match the dark, mono-label aesthetic of the panel
// without touching styles.css (B2-TW only owns tweaks.tsx).
function TweakSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
}) {
  return (
    <div className="tw-row">
      <label>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'var(--panel-3, #181818)',
          color: 'var(--fg, #f0f0f0)',
          border: '1px solid var(--hairline, #2a2a2a)',
          borderRadius: 6,
          padding: '4px 8px',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          minWidth: 110,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const TIMEZONE_OPTIONS: SelectOption[] = [
  { label: 'NYC', value: 'America/New_York' },
  { label: 'Seoul', value: 'Asia/Seoul' },
  { label: 'UTC', value: 'UTC' },
  { label: 'London', value: 'Europe/London' },
];

const LOCALE_OPTIONS: SelectOption[] = [
  { label: 'en-US', value: 'en-US' },
  { label: 'ko-KR', value: 'ko-KR' },
];

const CURRENCY_OPTIONS: SelectOption[] = [
  { label: 'USD', value: 'USD' },
  { label: 'KRW', value: 'KRW' },
  { label: 'EUR', value: 'EUR' },
  { label: 'JPY', value: 'JPY' },
];

export function TweaksPanel() {
  const [open, setOpen] = useState(false);
  const { values, setTweak, reset } = useTweaks();

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
          <div className="tw-section">
            <div className="tw-section-label">Locale</div>
            <TweakSelect
              label="Timezone"
              value={values.timezone}
              onChange={(v) => setTweak('timezone', v)}
              options={TIMEZONE_OPTIONS}
            />
            <TweakSelect
              label="Locale"
              value={values.locale}
              onChange={(v) => setTweak('locale', v)}
              options={LOCALE_OPTIONS}
            />
            <TweakSelect
              label="Currency"
              value={values.currency}
              onChange={(v) => setTweak('currency', v)}
              options={CURRENCY_OPTIONS}
            />
          </div>
          <div className="tw-section">
            <button
              type="button"
              onClick={reset}
              style={{
                width: '100%',
                background: 'transparent',
                color: 'var(--fg-2, #b8b8b8)',
                border: '1px solid var(--hairline, #2a2a2a)',
                borderRadius: 6,
                padding: '6px 10px',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Reset to defaults
            </button>
          </div>
        </div>
      )}
    </>
  );
}
