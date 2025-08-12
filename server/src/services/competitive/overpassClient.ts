import { getEnv } from '../../lib/env';
import type { OverpassRestaurant } from '../../types/competitive';

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

type AreaOrBbox = { areaId?: string; bbox?: [number, number, number, number] };

export async function fetchRestaurants(areaOrBbox: AreaOrBbox): Promise<OverpassRestaurant[]> {
  const userAgent = getEnv('OSM_USER_AGENT') || 'kaartkompas/unknown-contact';
  const hasArea = !!areaOrBbox.areaId;
  const query = hasArea
    ? `
[out:json][timeout:60];
area(${areaOrBbox.areaId});
nwr["amenity"="restaurant"](area);
out center tags;
`
    : `
[out:json][timeout:60];
nwr["amenity"="restaurant"](${areaOrBbox.bbox?.[1]},${areaOrBbox.bbox?.[0]},${areaOrBbox.bbox?.[3]},${areaOrBbox.bbox?.[2]});
out center tags;
`;

  const body = new URLSearchParams({ data: query });
  const resp = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent,
    },
  });
  if (!resp.ok) {
    throw new Error(`Overpass error: ${resp.status}`);
  }
  const json = await resp.json() as { elements: any[] };
  const results: OverpassRestaurant[] = (json.elements || []).map((el) => {
    const tags = el.tags || {};
    const center = el.center || el;
    const address = {
      street: tags['addr:street'],
      housenumber: tags['addr:housenumber'],
      postcode: tags['addr:postcode'],
      city: tags['addr:city'],
      country: tags['addr:country'],
    };
    return {
      elementType: el.type,
      elementId: String(el.id),
      name: tags.name,
      latitude: center.lat,
      longitude: center.lon,
      phone: tags.phone || tags['contact:phone'],
      tags,
      address,
    } as OverpassRestaurant;
  });
  return results;
}



