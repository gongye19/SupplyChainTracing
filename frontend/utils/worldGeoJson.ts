import * as d3 from 'd3';

let worldGeoJsonPromise: Promise<any> | null = null;

export function loadWorldGeoJson() {
  if (!worldGeoJsonPromise) {
    worldGeoJsonPromise = d3.json('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson');
  }
  return worldGeoJsonPromise;
}


