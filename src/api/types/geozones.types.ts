/**
 * geozones.types.ts — Geofence / Geozone types.
 *
 * Backend tables:
 *   dll_geozones            — zone definition (uid, name, description, points, owner)
 *   dll_geozone_attachments — devices ↔ geozones link (device_imei, attached_geozones JSON)
 */

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

/**
 * Parse the raw geozone_points JSON string into a LatLng array.
 * Backend stores coordinates as [lng, lat] pairs.
 */
export function parseGeozonePoints(raw: string): LatLng[] {
  try {
    const coords: GeozoneCoord[] = JSON.parse(raw);
    return coords.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return [];
  }
}

/**
 * Serialize a LatLng array back to the backend's [lng, lat] JSON string.
 */
export function serializeGeozonePoints(path: LatLng[]): string {
  return JSON.stringify(path.map(({ lat, lng }) => [lng, lat]));
}
