import { getSessionVolume } from '../../data/market';
import type { VolumeBar } from '../../data/types';
import { BarChart } from '../../lib/primitives';
import { useAsync } from '../../lib/useAsync';

export function SessionVolume() {
  // BarChart renders deterministically from a seed today; we drive the panel's
  // loading state from the data layer so when B2-MD swaps in real bars we just
  // pass `data` to a new bar primitive without touching consumers.
  const { data, loading } = useAsync<VolumeBar[]>(getSessionVolume, []);

  return (
    <div>
      <div className="wf-label">Session volume</div>
      <div
        style={{
          marginTop: 8,
          opacity: loading && !data ? 0.4 : 1,
          transition: 'opacity 120ms linear',
        }}
        aria-busy={loading}
      >
        <BarChart w={260} h={50} count={30} seed={9} accent />
      </div>
    </div>
  );
}
