import { CandleChart, LineChart } from '../../lib/primitives';
import { useTweaks } from '../../lib/tweaks';

export function HeroChart() {
  const { values } = useTweaks();
  const showGrid = values.showGrid;

  return (
    <div className="wf-panel" style={{ padding: 14 }}>
      <div className="row between center">
        <div>
          <div className="wf-label">Primary · S&amp;P 500 · Intraday</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              marginTop: 4,
            }}
          >
            <div className="wf-num" style={{ fontSize: 32 }}>
              5,247.<span className="muted">18</span>
            </div>
            <div className="up wf-mono" style={{ fontSize: 13 }}>
              +22.04 (+0.42%)
            </div>
            <div className="muted wf-mini">VOL 2.41B</div>
          </div>
        </div>
        <div className="row gap-1">
          {['1D', '1W', '1M', '3M', 'YTD', '1Y', '5Y'].map((t, i) => (
            <div
              key={t}
              className={'tab' + (i === 1 ? ' active' : '')}
              style={{ padding: '4px 10px', fontSize: 11 }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        {values.chartStyle === 'candle' ? (
          <CandleChart w={800} h={180} count={62} seed={3} />
        ) : (
          <LineChart
            w={800}
            h={180}
            seed={3}
            trend={0.6}
            grid={showGrid}
            dashedTarget
            accent
            area={values.chartStyle === 'area'}
            accentRange={[0.62, 0.78]}
            strokeWidth={1.4}
          />
        )}
      </div>
      <div className="row between" style={{ marginTop: 8 }}>
        <div className="wf-mini">
          09:30 · 11:00 · 13:00 · 15:00 · 16:00
        </div>
        <div className="row gap-3 wf-mini">
          <span>O 5,225.14</span>
          <span>H 5,251.02</span>
          <span>L 5,219.88</span>
          <span>C 5,247.18</span>
        </div>
      </div>
    </div>
  );
}
