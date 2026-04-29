import { Gauge } from '../../lib/primitives';

export function Sentiment() {
  return (
    <div>
      <div className="wf-label">Market sentiment</div>
      <div className="wf-panel-flat" style={{ padding: 10, marginTop: 8 }}>
        <Gauge value={62} label="Greed" />
        <div className="row between wf-mini" style={{ marginTop: 6 }}>
          <span>YESTERDAY 58</span>
          <span>1W 49</span>
          <span>1M 41</span>
        </div>
      </div>
    </div>
  );
}
