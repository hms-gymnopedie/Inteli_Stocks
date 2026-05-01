// Geo-page WorldMap wrapper. After B2-MAP-2 grew a first-class `onPinClick`
// API on the primitive (plus zoom/pan/keyboard/reset), this wrapper is just a
// data fetch + pass-through. The overlay-button hit-area trick that lived
// here pre-B2-MAP-2 is gone — the primitive's pin `<g role="button">` is now
// the click target.

import { getRiskMap } from '../../data/geo';
import type { MapPin } from '../../data/types';
import { WorldMap as WorldMapPrimitive } from '../../lib/primitives';
import { useAsync } from '../../lib/useAsync';

interface WorldMapProps {
  onPinClick?: (pin: MapPin) => void;
}

export function WorldMap({ onPinClick }: WorldMapProps = {}) {
  const { data } = useAsync(getRiskMap, []);
  return (
    <WorldMapPrimitive
      heat={data?.heat ?? {}}
      pins={data?.pins ?? []}
      flows={data?.flows ?? []}
      onPinClick={onPinClick}
    />
  );
}
