// Type shim for the static `world-atlas` TopoJSON import.
//
// `world-atlas/countries-110m.json` ships as raw JSON. Vite resolves the JSON
// import at build time; TypeScript needs a module declaration to type the
// value. We type it as `Topology` (from topojson-specification, supplied by
// @types/topojson-client transitively) so callers get autocomplete.
declare module 'world-atlas/countries-110m.json' {
  import type { Topology } from 'topojson-specification';
  const value: Topology;
  export default value;
}
