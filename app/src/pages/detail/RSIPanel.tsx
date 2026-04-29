import { LineChart } from '../../lib/primitives';
import { useTweaks } from '../../lib/tweaks';

export function RSIPanel() {
  const { values } = useTweaks();
  return (
    <div className="wf-panel" style={{ padding: 12 }}>
      <div className="row between">
        <div className="wf-label">RSI (14)</div>
        <div className="wf-mono accent">68.4</div>
      </div>
      <div style={{ marginTop: 8 }}>
        <LineChart
          w={400}
          h={70}
          seed={20}
          grid={values.showGrid}
          trend={0.4}
          stroke="var(--orange)"
        />
      </div>
      <div className="row between wf-mini" style={{ marginTop: 4 }}>
        <span>30 oversold</span>
        <span>70 overbought</span>
      </div>
    </div>
  );
}
