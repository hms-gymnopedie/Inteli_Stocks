import { LineChart } from '../../lib/primitives';
import { useTweaks } from '../../lib/tweaks';

export function EquityCurve() {
  const { values } = useTweaks();
  return (
    <div className="wf-panel" style={{ padding: 12 }}>
      <div className="wf-label">Equity curve · 1Y</div>
      <div style={{ marginTop: 10 }}>
        <LineChart
          w={400}
          h={150}
          seed={42}
          trend={1.2}
          grid={values.showGrid}
          area
          accentRange={[0.55, 0.7]}
        />
      </div>
      <div className="row between wf-mini" style={{ marginTop: 4 }}>
        <span>MAY · JUL · SEP · NOV · JAN · MAR</span>
        <span className="muted">vs S&amp;P +6.2pp</span>
      </div>
    </div>
  );
}
