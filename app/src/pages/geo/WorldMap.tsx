import { useMemo } from 'react';
import { geoEqualEarth } from 'd3-geo';

import { getRiskMap } from '../../data/geo';
import type { MapPin } from '../../data/types';
import { COUNTRIES } from '../../lib/WorldMap/data';
import { WorldMap as WorldMapPrimitive } from '../../lib/primitives';
import { useAsync } from '../../lib/useAsync';

interface WorldMapProps {
  /**
   * Optional pin click handler. Until the primitive grows a click API,
   * the wrapper layers absolutely-positioned transparent buttons over the
   * SVG at each pin's projected coordinates so they are still focusable
   * and click/tap-able. Aligned to the same `geoEqualEarth().fitSize` the
   * primitive uses, in the same 1000×500 viewBox space, scaled via a
   * percent (`top`/`left`) overlay so the buttons follow `preserveAspectRatio`
   * resizing of the SVG.
   */
  onPinClick?: (pin: MapPin) => void;
}

const VIEWBOX_W = 1000;
const VIEWBOX_H = 500;

export function WorldMap({ onPinClick }: WorldMapProps = {}) {
  const { data } = useAsync(getRiskMap, []);

  // Mirror the primitive's projection so overlay button positions match
  // the rendered pins exactly. Computing it here is cheap (geoEqualEarth +
  // fitSize is O(features)) and the primitive memoizes the same internally.
  const projection = useMemo(
    () => geoEqualEarth().fitSize([VIEWBOX_W, VIEWBOX_H], COUNTRIES),
    [],
  );

  const pins = data?.pins ?? [];

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <WorldMapPrimitive
        heat={data?.heat ?? {}}
        pins={pins}
        flows={data?.flows ?? []}
      />

      {/* Overlay click hit-areas. Skip when no handler is wired. */}
      {onPinClick &&
        pins.map((pin, i) => {
          let cx: number;
          let cy: number;
          if (typeof pin.lng === 'number' && typeof pin.lat === 'number') {
            const projected = projection([pin.lng, pin.lat]);
            if (!projected) return null;
            [cx, cy] = projected;
          } else {
            // Legacy x/y in viewBox coordinates.
            cx = pin.x > 1 ? pin.x : pin.x * VIEWBOX_W;
            cy = pin.y > 1 ? pin.y : pin.y * VIEWBOX_H;
          }
          // Convert viewBox units to percentages so the hit-area follows the
          // SVG's `preserveAspectRatio="xMidYMid slice"` scaling.
          const leftPct = (cx / VIEWBOX_W) * 100;
          const topPct = (cy / VIEWBOX_H) * 100;
          return (
            <button
              key={`${pin.label}-${i}`}
              type="button"
              onClick={() => onPinClick(pin)}
              aria-label={`Open region detail for ${pin.label}`}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: 28,
                height: 28,
                marginLeft: -14,
                marginTop: -14,
                borderRadius: '50%',
                background: 'transparent',
                border: 0,
                padding: 0,
                cursor: 'pointer',
              }}
            />
          );
        })}
    </div>
  );
}
