import { LineChart } from '../../lib/primitives';
import { useTweaks } from '../../lib/tweaks';

export function MACDPanel() {
  const { values } = useTweaks();
  return (
    <div className="wf-panel" style={{ padding: 12 }}>
      <div className="row between">
        <div className="wf-label">MACD (12,26,9)</div>
        <div className="wf-mono up">+2.81</div>
      </div>
      <div style={{ marginTop: 8 }}>
        <LineChart
          w={400}
          h={70}
          seed={21}
          grid={values.showGrid}
          trend={0.2}
          accent
        />
      </div>
      <div className="row between wf-mini" style={{ marginTop: 4 }}>
        <span>SIGNAL ↑ CROSS · 3D AGO</span>
        <span>HIST +0.42</span>
      </div>
    </div>
  );
}
