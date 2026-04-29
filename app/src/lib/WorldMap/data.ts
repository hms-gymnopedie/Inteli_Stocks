// Loads `world-atlas/countries-110m.json` and converts it to a GeoJSON
// FeatureCollection. Country features carry a numeric `id` (UN M49 code) and
// a `name` property. We attach an ISO 3166-1 alpha-3 code (`iso_a3`) onto each
// feature's properties via a small lookup so heat keys can use familiar
// 3-letter codes (`USA`, `KOR`, `JPN`, ...).
//
// The lookup only covers countries we currently visualize plus a few
// neighbors. Unmapped countries simply have `iso_a3: undefined` and get the
// default base fill.
//
// world-atlas v2 is "Pre-built TopoJSON from Natural Earth" (Bostock).

import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import topology from 'world-atlas/countries-110m.json';

/** Properties carried on each country feature. */
export interface CountryProperties {
  /** Country name as shipped by Natural Earth. */
  name: string;
  /** ISO 3166-1 alpha-3 code. Undefined for unmapped countries. */
  iso_a3?: string;
}

export type CountryFeature = Feature<Polygon | MultiPolygon, CountryProperties>;

/**
 * UN M49 numeric code → ISO 3166-1 alpha-3 (best-effort, focused on
 * countries we visualize plus the rest of G20 and a smattering of
 * neighbors). Add entries as new heat regions are introduced.
 */
const M49_TO_ISO3: Record<string, string> = {
  // Americas
  '124': 'CAN',
  '840': 'USA',
  '484': 'MEX',
  '320': 'GTM',
  '188': 'CRI',
  '591': 'PAN',
  '170': 'COL',
  '604': 'PER',
  '076': 'BRA',
  '032': 'ARG',
  '152': 'CHL',
  '858': 'URY',
  '600': 'PRY',
  '068': 'BOL',
  '218': 'ECU',
  '862': 'VEN',
  // Europe
  '826': 'GBR',
  '372': 'IRL',
  '620': 'PRT',
  '724': 'ESP',
  '250': 'FRA',
  '276': 'DEU',
  '380': 'ITA',
  '528': 'NLD',
  '056': 'BEL',
  '208': 'DNK',
  '578': 'NOR',
  '752': 'SWE',
  '246': 'FIN',
  '352': 'ISL',
  '040': 'AUT',
  '756': 'CHE',
  '203': 'CZE',
  '616': 'POL',
  '703': 'SVK',
  '348': 'HUN',
  '642': 'ROU',
  '100': 'BGR',
  '300': 'GRC',
  '792': 'TUR',
  '643': 'RUS',
  '804': 'UKR',
  '112': 'BLR',
  '688': 'SRB',
  '191': 'HRV',
  '705': 'SVN',
  '070': 'BIH',
  '008': 'ALB',
  '440': 'LTU',
  '428': 'LVA',
  '233': 'EST',
  '498': 'MDA',
  // Africa
  '012': 'DZA',
  '504': 'MAR',
  '788': 'TUN',
  '434': 'LBY',
  '818': 'EGY',
  '729': 'SDN',
  '231': 'ETH',
  '404': 'KEN',
  '800': 'UGA',
  '834': 'TZA',
  '894': 'ZMB',
  '716': 'ZWE',
  '454': 'MWI',
  '508': 'MOZ',
  '710': 'ZAF',
  '516': 'NAM',
  '072': 'BWA',
  '566': 'NGA',
  '120': 'CMR',
  '180': 'COD',
  '178': 'COG',
  '024': 'AGO',
  '288': 'GHA',
  '384': 'CIV',
  '466': 'MLI',
  '562': 'NER',
  '148': 'TCD',
  '450': 'MDG',
  '044': 'BHS',
  // Middle East
  '376': 'ISR',
  '275': 'PSE',
  '364': 'IRN',
  '368': 'IRQ',
  '760': 'SYR',
  '422': 'LBN',
  '400': 'JOR',
  '682': 'SAU',
  '887': 'YEM',
  '512': 'OMN',
  '784': 'ARE',
  '634': 'QAT',
  '048': 'BHR',
  '414': 'KWT',
  // Asia
  '156': 'CHN',
  '344': 'HKG',
  '158': 'TWN',
  '392': 'JPN',
  '410': 'KOR',
  '408': 'PRK',
  '496': 'MNG',
  '356': 'IND',
  '586': 'PAK',
  '050': 'BGD',
  '524': 'NPL',
  '144': 'LKA',
  '004': 'AFG',
  '764': 'THA',
  '704': 'VNM',
  '116': 'KHM',
  '418': 'LAO',
  '104': 'MMR',
  '458': 'MYS',
  '702': 'SGP',
  '360': 'IDN',
  '608': 'PHL',
  '398': 'KAZ',
  '860': 'UZB',
  '795': 'TKM',
  '417': 'KGZ',
  '762': 'TJK',
  // Oceania
  '036': 'AUS',
  '554': 'NZL',
  '598': 'PNG',
  '242': 'FJI',
  // Polar / misc
  '304': 'GRL',
};

/**
 * Pre-computed FeatureCollection of world countries with `iso_a3` attached
 * onto each feature's properties. Computed once on module load so consumers
 * (WorldMap renders, geo path generators) can read it synchronously.
 */
export const COUNTRIES: FeatureCollection<Polygon | MultiPolygon, CountryProperties> = (() => {
  // `feature(topology, object)` returns a GeoJSON FeatureCollection when the
  // referenced object is a GeometryCollection (which `countries` is).
  const fc = feature(
    topology,
    topology.objects.countries,
  ) as unknown as FeatureCollection<Polygon | MultiPolygon, { name: string }>;

  const features: CountryFeature[] = fc.features.map((f) => {
    const id = typeof f.id === 'number' ? String(f.id).padStart(3, '0') : f.id;
    const iso = id ? M49_TO_ISO3[String(id)] : undefined;
    return {
      ...f,
      properties: { name: f.properties.name, iso_a3: iso },
    };
  });

  return { type: 'FeatureCollection', features };
})();

/** Helper: return the ISO-3 code for a feature, or undefined if unmapped. */
export function iso3(feature: CountryFeature): string | undefined {
  return feature.properties.iso_a3;
}
