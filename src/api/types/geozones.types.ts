/**
 * geozones.types.ts — Geofence / Geozone types.
 *
 * Backend tables:
 *   dll_geozones            — zone definition (uid, name, description, points, owner)
 *   dll_geozone_attachments — devices ↔ geozones link (device_imei, attached_geozones JSON)
 */

import { circleRing } from "../../utils/geofenceShapes.ts";

// ── Core geozone ────────────────────────────────────────────────────────────

/** A single coordinate pair as stored in the backend (lng, lat order). */
export type GeozoneCoord = [number, number];

/** What the customer drew. Every shape is also stored as a polygon ring in
 *  geozone_points (a circle as a 64-gon, a line as its corridor). */
export type GeozoneShape = "polygon" | "circle" | "line";

/** The drawn shape's details, as sent to and returned by the API. */
export type ShapeParams =
  | { points: LatLng[] }                           // polygon (4+ corners)
  | { center: LatLng; radius_m: number }           // circle
  | { points: LatLng[]; width_m: number };         // line (2+ points) + thickness

/** A geozone as returned by the list / details endpoints. */
export interface Geozone {
  geozone_uid: string;
  geozone_name: string;
  geozone_description: string;
  /** Raw JSON string of coordinates from the backend — parse with JSON.parse. */
  geozone_points: string;
  date_created: string;
  /** Present only when access_level = "inhouse". */
  geozone_owner?: string;
  geozone_owner_name?: string;
  /** Hex color for the geofence polygon (e.g. "#128C7E"). */
  geozone_color?: string;
  /** Hex color for the geofence name label on the map. */
  geozone_label_color?: string;
  /** polygon | circle | line (older zones: polygon). */
  geozone_shape?: GeozoneShape;
  /** The drawn shape; null for zones created before shapes existed. */
  geozone_shape_params?: ShapeParams | null;
}

// ── Create / Update payloads ────────────────────────────────────────────────

export interface CreateGeozoneRequest {
  geozone_name: string;
  geozone_decription: string;   // backend uses this spelling
  geozone_points: string;       // JSON-stringified coordinate array
  geozone_owner: string;
  geozone_color?: string;       // hex color for the geofence polygon (e.g. "#128C7E")
  geozone_label_color?: string; // hex color for the geofence name label on the map
  geozone_shape?: GeozoneShape;
  geozone_shape_params?: ShapeParams;
}

export interface UpdateGeozoneRequest {
  new_geozone_name: string;
  new_geozone_decription: string;  // backend spelling
  new_geozone_points: string;      // JSON-stringified coordinate array
  new_geozone_shape?: GeozoneShape;
  new_geozone_shape_params?: ShapeParams;
}

// ── Device attachment ───────────────────────────────────────────────────────

export interface AttachDevicesRequest {
  devices: string[];  // array of device IMEIs
}

/** A zone attached to a specific device (from GET /geozones/devices/:id/list). */
export interface DeviceGeozone {
  zone_uid: string;
  zone_name: string;
  zone_description: string;
}

// ── Geozone details (single zone fetch) ─────────────────────────────────────

export interface GeozoneDetails {
  geozone_name: string;
  geozone_description: string;
  geopoints: string;  // raw JSON string
}

// ── Parsed coordinate for frontend use ──────────────────────────────────────

/** Frontend-friendly lat/lng object used by Google Maps. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** A geozone with its coordinates already parsed for rendering. */
export interface ParsedGeozone extends Omit<Geozone, "geozone_points"> {
  /** Parsed polygon path ready for Google Maps Polygon component. */
  path: LatLng[];
}

// ── Geozone Groups ─────────────────────────────────────────────────────────

export interface GeozoneGroup {
  group_uid: string;
  group_name: string;
  group_description: string;
  group_owner: string;
  date_created: string;
  geozone_count: number;
}

export interface CreateGeozoneGroupRequest {
  group_name: string;
  group_description?: string;
  group_owner: string;
}

export interface UpdateGeozoneGroupRequest {
  group_name: string;
  group_description?: string;
}

export interface AssignGeozonesRequest {
  geozone_uids: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** A zone's geometry, whichever way it was stored. */
export interface GeozoneGeometry {
  shape: GeozoneShape;
  /** The drawn shape, for zones stored the mobile app's way; else null. */
  params: ShapeParams | null;
  /** The area, for inside/outside checks: empty for a line with no width. */
  ring: LatLng[];
  /** What to draw and frame on the map: the ring, or a line's route. */
  outline: LatLng[];
}

const toLatLngs = (coords: unknown): LatLng[] =>
  Array.isArray(coords)
    ? coords
        .filter((c): c is GeozoneCoord => Array.isArray(c) && c.length >= 2)
        .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    : [];

/**
 * Parse geozone_points. Usually a ring of [lng, lat] pairs, but zones drawn
 * in the mobile app store their shape there instead (oliwa-mobile
 * lib/models/geozone.dart):
 *   {"type":"circle","center":[lng,lat],"radius":<metres>}
 *   {"type":"line","points":[[lng,lat], ...]}
 * Read as a ring, those came back empty, and the map's polygon for them
 * threw inside Google Maps, blanking the Geofences page.
 */
export function parseGeozoneGeometry(raw: string): GeozoneGeometry {
  const none: GeozoneGeometry = { shape: "polygon", params: null, ring: [], outline: [] };
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return none; }
  if (Array.isArray(data)) {
    const ring = toLatLngs(data);
    return { shape: "polygon", params: null, ring, outline: ring };
  }
  if (!data || typeof data !== "object") return none;
  const o = data as { type?: unknown; center?: unknown; radius?: unknown; points?: unknown };
  const type = String(o.type ?? "polygon").toLowerCase();
  if (type === "circle") {
    const [center] = toLatLngs([o.center]);
    const radius = Number(o.radius);
    if (!center || !(radius > 0)) return none;
    const ring = circleRing(center, radius);
    return { shape: "circle", params: { center, radius_m: radius }, ring, outline: ring };
  }
  const points = toLatLngs(o.points);
  if (type === "line") {
    // No thickness is stored, so the route has no inside.
    return { shape: "line", params: { points, width_m: 0 }, ring: [], outline: points };
  }
  return { shape: "polygon", params: null, ring: points, outline: points };
}

/**
 * The zone's area as a LatLng ring, for inside/outside checks. Backend stores
 * coordinates as [lng, lat] pairs; a circle stored the mobile app's way comes
 * back as its 64-sided ring, a line with no width as no area.
 */
export function parseGeozonePoints(raw: string): LatLng[] {
  return parseGeozoneGeometry(raw).ring;
}

/**
 * Serialize a LatLng array back to the backend's [lng, lat] JSON string.
 */
export function serializeGeozonePoints(path: LatLng[]): string {
  return JSON.stringify(path.map(({ lat, lng }) => [lng, lat]));
}
