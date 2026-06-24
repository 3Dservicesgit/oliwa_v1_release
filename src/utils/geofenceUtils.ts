/**
 * geofenceUtils.ts — Geometry helpers for geofence boundary detection.
 *
 * Uses the ray-casting algorithm to determine if a point is inside a polygon.
 */

export interface Point {
  lat: number;
  lng: number;
}

/**
 * Determine if a point (lat, lng) lies inside a polygon defined by an array of vertices.
 * Uses the ray-casting (Jordan curve) algorithm.
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  const { lat: x, lng: y } = point;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Check a device position against all geozones and return entry/exit events.
 *
 * @param imei         Device IMEI
 * @param position     Current device position
 * @param geozones     Array of geozones with their polygon paths
 * @param prevInside   Map of geozone_uid → was device inside on last check
 * @returns            Array of events: { type: "enter" | "exit", geozone }
 */
export function checkGeozoneTransitions(
  position: Point,
  geozones: { uid: string; name: string; path: Point[] }[],
  prevInside: Map<string, boolean>,
): { type: "enter" | "exit"; uid: string; name: string }[] {
  const events: { type: "enter" | "exit"; uid: string; name: string }[] = [];

  for (const gz of geozones) {
    const nowInside = isPointInPolygon(position, gz.path);
    const wasInside = prevInside.get(gz.uid) ?? false;

    if (nowInside && !wasInside) {
      events.push({ type: "enter", uid: gz.uid, name: gz.name });
    } else if (!nowInside && wasInside) {
      events.push({ type: "exit", uid: gz.uid, name: gz.name });
    }

    prevInside.set(gz.uid, nowInside);
  }

  return events;
}
