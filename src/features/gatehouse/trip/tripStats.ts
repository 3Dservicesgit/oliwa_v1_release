/**
 * tripStats.ts — distance, top speed and stops for a stretch of route.
 *
 * Ported from the OLIWA mobile app (lib/services/trip_service.dart,
 * lib/models/trip.dart). The speed field is not trusted on its own: one
 * unit's speed_log was found wrong by 120x.
 */
import { haversineKm, metres, MINUTE, type TripPoint } from "./geo.ts";

/** The fastest a reading is believed: above it, a reading is a fault. */
export const MAX_PLAUSIBLE_KMH = 200;
/** Movement smaller than this from the last counted point is GPS wobble. */
export const JITTER_METRES = 15;
/** A jump implying more than this is a bad fix, not travel. */
export const TELEPORT_KMH = 250;

/**
 * Distance travelled up to each point, in km. A hop counts only once the
 * vehicle is JITTER_METRES from the last counted point (so an hour parked
 * adds nothing), and a hop implying over TELEPORT_KMH (a bad fix, and the
 * jump back from it) is not counted at all. The last entry is the distance.
 */
export function cumulativeKm(points: TripPoint[]): number[] {
  if (!points.length) return [];
  const out = [0];
  let total = 0;
  let anchor = points[0];
  for (const p of points.slice(1)) {
    const km = haversineKm(anchor, p);
    if (km * 1000 >= JITTER_METRES) {
      const hours = anchor.time == null || p.time == null ? null : (p.time - anchor.time) / 3_600_000;
      const glitch = hours != null && hours > 0 && km / hours > TELEPORT_KMH;
      if (!glitch) total += km;
      anchor = p;
    }
    out.push(total);
  }
  return out;
}

export function distanceKm(points: TripPoint[]): number {
  if (points.length < 2) return 0;
  const so = cumulativeKm(points);
  return so[so.length - 1];
}

/**
 * Top speed: the highest speed held for two readings in a row, ignoring
 * readings over MAX_PLAUSIBLE_KMH. When no reading is usable (all faulty, or
 * none sent by a vehicle that plainly moved) it is worked out from the
 * positions, the same way.
 */
export function maxSpeedKmh(points: TripPoint[]): number {
  const held = (v: number[]) => {
    let best = 0;
    for (let i = 0; i + 1 < v.length; i++) {
      const a = v[i], b = v[i + 1];
      if (a > MAX_PLAUSIBLE_KMH || b > MAX_PLAUSIBLE_KMH) continue;
      best = Math.max(best, Math.min(a, b));
    }
    return best;
  };

  const fromReadings = held(points.map((p) => p.speedKmh));
  if (fromReadings > 0) return fromReadings;

  // Readings of 0 from a vehicle that stood still are right; only then would
  // a parked unit's GPS wobble show as a speed.
  const faulty = points.some((p) => p.speedKmh > MAX_PLAUSIBLE_KMH);
  const unreported = points.every((p) => p.speedKmh === 0) && distanceKm(points) > 0.5;
  if (!faulty && !unreported) return 0;

  // From positions: hops at least 5 s long and past the wobble.
  const derived: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].time, b = points[i].time;
    if (a == null || b == null) continue;
    const secs = (b - a) / 1000;
    const km = haversineKm(points[i - 1], points[i]);
    if (secs < 5 || km * 1000 < JITTER_METRES) { derived.push(0); continue; }
    derived.push(km / (secs / 3600));
  }
  return held(derived);
}

/**
 * Stops made on the way: places the vehicle stayed within `radiusM` of for at
 * least `minStopMs`. A run touching the start or end of the window is parked
 * before setting off or after arriving, so it is not a stop on the way.
 */
export function stopCount(points: TripPoint[], radiusM = 60, minStopMs = 5 * MINUTE): number {
  const pts = points.filter((p) => p.time != null);
  if (pts.length < 3) return 0;
  let stops = 0;
  let i = 0;
  while (i < pts.length) {
    let j = i;
    while (j + 1 < pts.length && metres(pts[i], pts[j + 1]) <= radiusM) j++;
    const dwell = pts[j].time! - pts[i].time!;
    if (i > 0 && j < pts.length - 1 && dwell >= minStopMs) stops++;
    i = j + 1;
  }
  return stops;
}

/** A loaded window of history, with its figures. */
export interface TripData {
  /** Oldest first. */
  points: TripPoint[];
  distanceKm: number;
  maxSpeedKmh: number;
  durationMs: number;
  start: number | null;
  end: number | null;
  /** Why the history could not be loaded, for the customer. Null when it
   *  was read, including a window that simply has no trip. */
  unavailable: string | null;
  /** Said beside a trip shown but incomplete. */
  notice: string | null;
}

export function emptyTrip(unavailable: string | null = null): TripData {
  return { points: [], distanceKm: 0, maxSpeedKmh: 0, durationMs: 0, start: null, end: null, unavailable, notice: null };
}

/** The figures for oldest-first `points`. */
export function summarize(points: TripPoint[], notice: string | null = null): TripData {
  const times = points.map((p) => p.time).filter((t): t is number => t != null);
  // Not Math.min(...times): a long window has tens of thousands of points.
  const start = times.length ? times.reduce((a, b) => Math.min(a, b)) : null;
  const end = times.length ? times.reduce((a, b) => Math.max(a, b)) : null;
  return {
    points,
    distanceKm: distanceKm(points),
    maxSpeedKmh: maxSpeedKmh(points),
    durationMs: start != null && end != null ? end - start : 0,
    start,
    end,
    unavailable: null,
    notice,
  };
}
