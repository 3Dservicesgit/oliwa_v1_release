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
}

// ── Create / Update payloads ────────────────────────────────────────────────

export interface CreateGeozoneRequest {
  geozone_name: string;
  geozone_decription: string;   // backend uses this spelling
  geozone_points: string;       // JSON-stringified coordinate array
  geozone_owner: string;
}

export interface UpdateGeozoneRequest {
  new_geozone_name: string;
  new_geozone_decription: string;  // backend spelling
  new_geozone_points: string;      // JSON-stringified coordinate array
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
