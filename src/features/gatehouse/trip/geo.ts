/**
 * geo.ts — a trip's points, and distances and bearings between them.
 *
 * Ported from the OLIWA mobile app (lib/models/trip.dart, route_style.dart)
 * so the console and the app agree on every figure.
 */

/** One GPS fix. `time` is epoch ms (local time, as the server stamps it);
 *  null when the fix had no usable stamp. */
export interface TripPoint {
  lat: number;
  lng: number;
  speedKmh: number;
  time: number | null;
  /** The server's place name for the fix (may be bare coordinates). */
  place?: string;
  satellites?: number;
  hdop?: string;
}

/** A fix whose time is known. */
export type TimedPoint = TripPoint & { time: number };

export const MINUTE = 60_000;
export const HOUR = 3_600_000;

const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function metres(a: TripPoint, b: TripPoint): number {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const haversineKm = (a: TripPoint, b: TripPoint) => metres(a, b) / 1000;

/** Compass bearing from `a` to `b`, degrees clockwise from north. */
export function bearing(a: TripPoint, b: TripPoint): number {
  const lat1 = rad(a.lat), lat2 = rad(b.lat), dLng = rad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** The timed points, oldest first. */
export function timedSorted(points: TripPoint[]): TimedPoint[] {
  return (points.filter((p) => p.time != null) as TimedPoint[]).sort((a, b) => a.time - b.time);
}
