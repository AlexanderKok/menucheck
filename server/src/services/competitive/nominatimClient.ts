import { getEnv } from '../../lib/env';
import type { GeocodeResult } from '../../types/competitive';

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';

export async function geocodeToAreaOrBbox(locationQuery: string): Promise<GeocodeResult> {
  const userAgent = getEnv('OSM_USER_AGENT') || 'kaartkompas/unknown-contact';
  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set('q', locationQuery);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '1');
  url.searchParams.set('polygon_geojson', '0');

  const resp = await fetch(url.toString(), {
    headers: {
      'User-Agent': userAgent,
      'Accept': 'application/json',
    },
  });
  if (!resp.ok) {
    throw new Error(`Nominatim error: ${resp.status}`);
  }
  const data = await resp.json() as Array<any>;
  if (!data.length) {
    throw new Error('Nominatim returned no results');
  }
  const first = data[0];
  const bboxNumbers = (first.boundingbox || first.bbox || []).map((n: string) => parseFloat(n));
  const bbox: [number, number, number, number] = [
    bboxNumbers[2], // west (lon)
    bboxNumbers[0], // south (lat)
    bboxNumbers[3], // east (lon)
    bboxNumbers[1], // north (lat)
  ];
  const areaId = first.osm_type && first.osm_id
    ? (first.osm_type === 'relation' ? String(3600000000 + Number(first.osm_id)) : undefined)
    : undefined;
  return { areaId, bbox };
}



