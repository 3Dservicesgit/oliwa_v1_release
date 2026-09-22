/**
 * livePosition.ts — reading the live position stream, in one place.
 *
 * The tracking server sends one JSON message per position on
 * /data-stream/{imei}/x-location:
 *
 *   { "status": "success", "data": { "data_latitude": "0.31", "data_longitude": "32.58",
 *                                    "speed_log": "42", "motion_state": "moving", ... } }
 *   { "status": "no_data" }     the unit hasn't reported
 *   { "status": "heartbeat" }   the connection is alive, nothing to say
 *
 * Every screen that shows live vehicles reads that shape, and each one used to
 * do its own parsing. The Geofences page read `latitude` / `lat`, which the
 * server never sends, so no vehicle ever appeared on the geofence map. There is
 * now one parser, used by every screen, which also accepts an unwrapped frame
 * and the older field names so a change on either side can't blank a map again.
 */

export type MotionStatus = "Moving" | "Parked" | "Idling" | "Offline";

export interface LivePosition {
  imei: string;
  lat: number;
  lng: number;
  speed: number;
  motionState: string;
  status: MotionStatus;
  lastSync: string;
  geocoded: string;
  ignition: string;
  satellites: number;
  hdop: string;
  mileage: string;
  fuelLevel: string;
}

export type LiveFrame =
  | { kind: "position"; position: LivePosition }
  | { kind: "offline" }      // the unit has no data — show it as offline
  | { kind: "ignore" };      // heartbeat, or a frame we can't use

/** Moving / Idling / Parked / Offline from what the unit reports. */
export function normalizeStatus(motionState: string, speed: number): MotionStatus {
  const s = (motionState ?? "").toLowerCase();
  if (s.includes("park") || s.includes("stop")) return "Parked";
  if (s.includes("idl") || s === "idle")        return "Idling";
  if (s.includes("mov") || s.includes("driv"))  return "Moving";
  if (Number.isFinite(speed) && speed >= 5)     return "Moving";
  if (Number.isFinite(speed) && speed > 0)      return "Idling";
  return "Offline";
}

/** The live stream URL for one unit. */
export function liveStreamUrl(base: string, imei: string): string {
  return `${base}/data-stream/${encodeURIComponent(imei)}/x-location`;
}

function num(...values: unknown[]): number {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const n = typeof value === "number" ? value : parseFloat(String(value));
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

function text(...values: unknown[]): string {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const s = String(value).trim();
    if (s) return s;
  }
  return "";
}

/**
 * Turn one stream message into something a screen can draw.
 *
 * `raw` is the message body (event.data). Anything unusable — a heartbeat, a
 * frame without a position, malformed JSON — comes back as "ignore" rather
 * than throwing, so one bad frame never stops the stream.
 */
export function parseLiveFrame(raw: string, imei: string): LiveFrame {
  let message: Record<string, unknown>;
  try {
    message = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { kind: "ignore" };
  }
  if (!message || typeof message !== "object") return { kind: "ignore" };

  const state = String(message.status ?? "").toLowerCase();
  if (state === "heartbeat") return { kind: "ignore" };
  if (state === "no_data" || state === "no-data") return { kind: "offline" };
  if (state === "error" || state === "failed") return { kind: "ignore" };

  // Normally { status, data: {...} }; an unwrapped frame is accepted too.
  const body = (message.data && typeof message.data === "object"
    ? message.data
    : message) as Record<string, unknown>;

  const lat = num(body.data_latitude, body.latitude, body.lat);
  const lng = num(body.data_longitude, body.longitude, body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { kind: "ignore" };
  // 0,0 is in the Atlantic — the server sends it when it has no fix.
  if (lat === 0 && lng === 0) return { kind: "ignore" };

  const speedValue = num(body.speed_log, body.speed);
  const speed = Number.isFinite(speedValue) ? speedValue : 0;
  const motionState = text(body.motion_state, body.status);
  const geocodedRaw = text(body.geocoded_location, body.location);
  const date = text(body.local_system_datestamp, body.device_date);
  const time = text(body.local_system_timestamp, body.device_time, body.timestamp);

  return {
    kind: "position",
    position: {
      imei,
      lat,
      lng,
      speed,
      motionState,
      status: normalizeStatus(motionState, speed),
      lastSync: `${date} ${time}`.trim(),
      // the geocoder reports its own failures in the address field
      geocoded: geocodedRaw.toLowerCase().includes("failure") ? "" : geocodedRaw,
      ignition: text(body.ignition_status, body.iginition, body.ignition),
      satellites: num(body.data_connected_satelites, body.satellites) || 0,
      hdop: text(body.data_hdop, body.hdop),
      mileage: text(body.mileage),
      fuelLevel: text(body.fuel_level),
    },
  };
}
