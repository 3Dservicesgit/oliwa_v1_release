/**
 * places.ts — what to call the place a vehicle was: the customer's own
 * geofence name first, then the server's place name. As the OLIWA mobile app
 * names stops (GeoLocate.zoneContaining, then the place name).
 */
import { isPointInPolygon, type Point } from "../../../utils/geofenceUtils.ts";
import type { TripPoint } from "./geo.ts";

/** A geofence as a ring of points (every shape is saved as one). */
export interface NamedZone {
  name: string;
  path: Point[];
}

/** True when `s` is bare "lat, lng" — the geocoder's fallback — rather than
 *  a place name. */
export function looksLikeCoords(s: string | undefined | null): boolean {
  return !!s && /^[-+]?\d{1,3}(\.\d+)?\s*,\s*[-+]?\d{1,3}(\.\d+)?$/.test(s.trim());
}

/** The name of the customer's geofence the point is in, if any. */
export function zoneAt(p: TripPoint, zones: NamedZone[]): string | null {
  return zones.find((z) => z.name && isPointInPolygon(p, z.path))?.name ?? null;
}

/** The geofence name, else the place name; null when neither is known. */
export function placeOf(p: TripPoint, zones: NamedZone[]): string | null {
  const zone = zoneAt(p, zones);
  if (zone) return zone;
  const place = p.place?.trim();
  return place && !looksLikeCoords(place) ? place : null;
}

/** "0.31234, 32.58123". */
export const coordsText = (p: TripPoint) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
