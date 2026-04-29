import { BarChart } from '../../lib/primitives';

export function SessionVolume() {
  return (
    <div>
      <div className="wf-label">Session volume</div>
      <div style={{ marginTop: 8 }}>
        <BarChart w={260} h={50} count={30} seed={9} accent />
      </div>
    </div>
  );
}
