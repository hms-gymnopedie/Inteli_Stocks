import { BarChart, CandleChart, LineChart } from '../../lib/primitives';
import { useTweaks } from '../../lib/tweaks';

export function MainChart() {
  const { values } = useTweaks();
  return (
    <div className="wf-panel" style={{ padding: 14 }}>
      <div className="row between">
        <div className="row gap-2">
          {['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'MAX'].map(
            (t, i) => (
              <span
                key={t}
                className={'tab' + (i === 3 ? ' active' : '')}
                style={{ padding: '4px 10px', fontSize: 11 }}
              >
                {t}
              </span>
            ),
          )}
        </div>
        <div className="row gap-2">
          <span className="tag">RSI</span>
          <span className="tag">MACD</span>
          <span className="tag">VOL</span>
          <span
            className="tag"
            style={{
              color: 'var(--orange)',
              borderColor: 'var(--orange)',
            }}
          >
            + ADD
          </span>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        {values.chartStyle === 'line' ? (
          <LineChart
            w={800}
            h={200}
            seed={11}
            trend={0.5}
            grid={values.showGrid}
            area
            strokeWidth={1.4}
          />
        ) : (
          <CandleChart w={800} h={200} count={62} seed={11} />
        )}
      </div>
      <hr className="wf-divider" style={{ margin: '8px 0' }} />
      <div style={{ height: 50 }}>
        <BarChart w={800} h={50} count={62} seed={4} accent />
      </div>
      <div className="row between wf-mini" style={{ marginTop: 6 }}>
        <span>JAN · FEB · MAR · APR</span>
        <span>VOL · 56.2M shares</span>
      </div>
    </div>
  );
}
