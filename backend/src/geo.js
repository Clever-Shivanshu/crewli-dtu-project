/**
 * Convert a {lat, lng} pair to GeoJSON Point.
 * Returns null if invalid (caller decides what to do).
 */
export function toGeoPoint(input) {
  if (!input) return null;
  const lat = Number(input.lat ?? input.latitude);
  const lng = Number(input.lng ?? input.lon ?? input.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { type: 'Point', coordinates: [lng, lat] };
}

export function geoPointToLatLng(pt) {
  if (!pt || !Array.isArray(pt.coordinates)) return null;
  const [lng, lat] = pt.coordinates;
  return { lat, lng };
}
