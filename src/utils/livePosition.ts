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
  /** What to show now, by the fleet status rule (see liveStatus). */
  status: MotionStatus;
  /** The report is under an hour old. */
  reporting: boolean;
  /** Held as Parked while its tracker sleeps, quiet for over a day. */
  quiet: boolean;
  /** When the unit made this report (epoch ms), if the record says. */
  fixAt: number | null;
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

/** The unit's motion state as people read it. The tracking server spells
 *  idling "Idiling"; shown as it is, and matched as it is, an idling vehicle
 *  read "Idiling" and, at 0 km/h, counted as Offline. */
export function motionLabel(motionState: string): string {
  return (motionState ?? "").replace(/idiling/gi, "Idling");
}

/** Moving / Idling / Parked / Offline from what the unit reports. */
export function normalizeStatus(motionState: string, speed: number): MotionStatus {
  const s = motionLabel(motionState).toLowerCase();
  if (s.includes("park") || s.includes("stop")) return "Parked";
  if (s.includes("idl") || s === "idle")        return "Idling";
  if (s.includes("mov") || s.includes("driv"))  return "Moving";
  if (Number.isFinite(speed) && speed >= 5)     return "Moving";
  if (Number.isFinite(speed) && speed > 0)      return "Idling";
  return "Offline";
}

/**
 * The fleet status rule, the same as the mobile dashboard's and the backend's
 * (FleetKpis.classify in oliwa-mobile; both run the shared cases in
 * navas-core-apis/tests/fixtures/fleet_status_cases.json):
 *
 *   - a report up to an hour old is taken as it is;
 *   - a unit last seen moving or idling that has been quiet for over an hour
 *     is Offline: with the engine on it reports every few seconds. The feed
 *     keeps sending a quiet unit's last report: MOROTO GENSET still sent
 *     "Idiling", ignition on, 27 days after it last reported;
 *   - a unit last reported parked (motion state Parked, or no motion state
 *     with the ignition off) stays Parked for up to 7 days. Trackers sleep
 *     with the ignition off, and the vehicle cannot move without waking it.
 *     Quiet for over a day, it is flagged; after 7 days it is Offline.
 *
 * The server's device_state is not used: it says "Offline" for a parked unit
 * whose tracker is asleep.
 */
export const SILENT_AFTER_MS = 60 * 60 * 1000;
export const QUIET_AFTER_MS = 24 * 60 * 60 * 1000;
export const PARKED_HOLD_MS = 7 * 24 * 60 * 60 * 1000;

const ignitionIs = (v: string, values: string[]) => values.includes(v.trim().toLowerCase());

export function liveStatus(motionState: string, speed: number, ignition: string, fixAt: number | null, now: number):
  { status: MotionStatus; reporting: boolean; quiet: boolean } {
  const said = normalizeStatus(motionState, speed);
  if (fixAt == null) return { status: "Offline", reporting: false, quiet: false };
  const age = now - fixAt;
  if (age <= SILENT_AFTER_MS) {
    // No motion state: still with the engine on is idling, otherwise parked.
    const status = said !== "Offline" ? said : ignitionIs(ignition, ["1", "on", "true", "yes"]) ? "Idling" : "Parked";
    return { status, reporting: true, quiet: false };
  }
  const saidParked = said === "Parked" || (said === "Offline" && ignitionIs(ignition, ["0", "off", "false", "no"]));
  if (saidParked && age <= PARKED_HOLD_MS) return { status: "Parked", reporting: false, quiet: age > QUIET_AFTER_MS };
  return { status: "Offline", reporting: false, quiet: false };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** When a record was made: record_timestamp (UTC), else the local date and
 *  time ("07-10-2026" + "12:45:38PM"). Null when it doesn't say. */
export function fixTime(body: Record<string, unknown>): number | null {
  const iso = text(body.record_timestamp);
  if (iso) {
    const t = Date.parse(iso);
    if (Number.isFinite(t)) return t;
  }
  const d = /^(\d{1,4})[-/](\d{1,2})[-/](\d{1,4})/.exec(text(body.local_system_datestamp, body.device_date));
  if (!d) return null;
  const [y, m, day] = d[1].length === 4 ? [+d[1], +d[2], +d[3]] : [+d[3], +d[2], +d[1]];
  const tm = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i.exec(text(body.local_system_timestamp, body.device_time));
  let h = tm ? +tm[1] : 0;
  const ap = tm?.[4]?.toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  if (m < 1 || m > 12 || day < 1 || day > 31) return null;
  return new Date(y, m - 1, day, h, tm ? +tm[2] : 0, tm?.[3] ? +tm[3] : 0).getTime();
}

/** How a position reads: its motion state; for a parked unit whose tracker
 *  is asleep, since when; for one that has stopped reporting, what it was
 *  doing when last heard from. */
export function motionText(p: LivePosition): string {
  if (p.reporting) return p.motionState || p.status;
  if (p.status === "Parked") {
    if (!p.quiet || p.fixAt == null) return "Parked";
    const d = new Date(p.fixAt);
    return `Parked · tracker quiet since ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }
  const was = normalizeStatus(p.motionState, p.speed);
  return was === "Offline" ? "Not reporting" : `Not reporting · last seen ${was.toLowerCase()}`;
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
export function parseLiveFrame(raw: string, imei: string, now = Date.now()): LiveFrame {
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

  const position = readPosition(body, imei, now);
  return position ? { kind: "position", position } : { kind: "ignore" };
}

/**
 * One position record — a live frame's `data`, or a trip-history row (the
 * same location-registry fields) — or null without a usable fix.
 */
export function readPosition(body: Record<string, unknown>, imei: string, now = Date.now()): LivePosition | null {
  const lat = num(body.data_latitude, body.latitude, body.lat);
  const lng = num(body.data_longitude, body.longitude, body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // 0,0 is in the Atlantic — the server sends it when it has no fix.
  if (lat === 0 && lng === 0) return null;

  const speedValue = num(body.speed_log, body.speed);
  const speed = Number.isFinite(speedValue) ? speedValue : 0;
  const motionState = motionLabel(text(body.motion_state, body.status));
  const geocodedRaw = text(body.geocoded_location, body.location);
  const date = text(body.local_system_datestamp, body.device_date);
  const time = text(body.local_system_timestamp, body.device_time, body.timestamp);
  const fixAt = fixTime(body);
  // The live feed sends ignition_state ("ON"/"OFF"); the others are older names.
  const ignition = text(body.ignition_state, body.ignition_status, body.iginition, body.ignition);
  const { status, reporting, quiet } = liveStatus(motionState, speed, ignition, fixAt, now);

  return {
    imei,
    lat,
    lng,
    speed,
    motionState,
    status,
    reporting,
    quiet,
    fixAt,
    lastSync: `${date} ${time}`.trim(),
    // the geocoder reports its own failures in the address field
    geocoded: geocodedRaw.toLowerCase().includes("failure") ? "" : geocodedRaw,
    ignition,
    satellites: num(body.data_connected_satelites, body.satellites) || 0,
    hdop: text(body.data_hdop, body.hdop),
    mileage: text(body.mileage),
    fuelLevel: text(body.fuel_level),
  };
}
