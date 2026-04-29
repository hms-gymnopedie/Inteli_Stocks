import { WorldMap as WorldMapPrimitive } from '../../lib/primitives';

export function WorldMap() {
  return (
    <WorldMapPrimitive
      heat={{
        namerica: 'low',
        europe: 'med',
        africa: 'med',
        asia: 'high',
        india: 'med',
        seasia: 'med',
        samerica: 'low',
        australia: 'low',
        arabia: 'high',
        korea: 'med',
        japan: 'low',
        uk: 'low',
        indonesia: 'low',
        camerica: 'low',
        nz: 'low',
        philippines: 'med',
        greenland: 'low',
        scand: 'low',
        madagascar: 'low',
      }}
      pins={[
        { x: 490, y: 120, level: 'high', label: 'UA · WAR' },
        { x: 565, y: 200, level: 'high', label: 'IL · CONFLICT' },
        { x: 590, y: 215, level: 'med', label: 'IR · SANCTIONS' },
        { x: 790, y: 200, level: 'high', label: 'TW · TENSION' },
        { x: 815, y: 158, level: 'med', label: 'KR · ELECTION' },
        { x: 220, y: 160, level: 'med', label: 'US · TARIFFS' },
        { x: 480, y: 280, level: 'low', label: 'NG · OIL' },
      ]}
      flows={[
        [220, 160, 790, 200],
        [815, 158, 220, 160],
        [590, 215, 490, 120],
        [480, 280, 490, 120],
      ]}
    />
  );
}
