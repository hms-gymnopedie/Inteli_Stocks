import { getRiskMap } from '../../data/geo';
import { WorldMap as WorldMapPrimitive } from '../../lib/primitives';
import { useAsync } from '../../lib/useAsync';

export function WorldMap() {
  const { data } = useAsync(getRiskMap, []);
  return (
    <WorldMapPrimitive
      heat={data?.heat ?? {}}
      pins={data?.pins ?? []}
      flows={data?.flows ?? []}
    />
  );
}
