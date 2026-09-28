/**
 * Distancia en línea recta (Haversine) entre dos coordenadas, en km. Misma fórmula y mismo
 * formato que la app (mobile/utils/geo-distance.ts): sirve para ORDENAR por cercanía y mostrar
 * "a cuánto queda", no para una distancia de manejo exacta.
 */
const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

export function haversineDistanceKm(from, to) {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Distancia a un elemento con `latitude`/`longitude`, o null si falta alguna coordenada. */
export function distanceKmTo(coords, item) {
  if (!coords || item?.latitude == null || item?.longitude == null) return null;
  return haversineDistanceKm(coords, { latitude: Number(item.latitude), longitude: Number(item.longitude) });
}

/** "850 m", "2.3 km" o "49 km" (igual que la app). */
export function formatDistanceKm(distanceKm) {
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km`;
}

/**
 * De la más cercana a la más lejana. Las que no tienen distancia (sin coordenadas todavía)
 * van al final en el orden en que venían. No muta el arreglo recibido.
 */
export function sortByDistance(items, distanceOf) {
  return items
    .map((item, index) => ({ item, index, distance: distanceOf(item) }))
    .sort((a, b) => {
      if (a.distance == null && b.distance == null) return a.index - b.index;
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance || a.index - b.index;
    })
    .map(({ item }) => item);
}
