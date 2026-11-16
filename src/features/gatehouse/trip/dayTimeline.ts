/**
 * dayTimeline.ts — a day of one vehicle's history as Wialon shows it: where
 * it was parked and the trips between, with the day's totals.
 *
 * Worked out from the positions alone: a parking is a run of fixes within
 * STOP_RADIUS_M of where the run began, lasting at least MIN_PARKING_MS. The
 * speed field is not trusted and ignition is not read.
 *
 * Ported from the OLIWA mobile app (lib/models/day_timeline.dart).
 */
import { metres, MINUTE, timedSorted, type TimedPoint, type TripPoint } from "./geo.ts";
import { distanceKm, maxSpeedKmh } from "./tripStats.ts";

/** Within this of where it stopped, a vehicle is standing still. */
export const STOP_RADIUS_M = 60;
/** The shortest stay counted as parked; a shorter one is part of the trip. */
export const MIN_PARKING_MS = 5 * MINUTE;
/** A shorter "trip" is a move across a yard or GPS drift: it joins the
 *  parking either side of it. */
export const MIN_TRIP_KM = 0.3;
/** Nothing sent for longer than this before the first fix away from a
 *  parking: the unit slept while parked, and the trip starts at that fix. */
export const DEPARTURE_GAP_MS = 2 * MINUTE;

/** One row of a day's history: a stay in one place, or a drive. */
export interface DaySegment {
  kind: "parked" | "trip";
  start: number;
  end: number;
  /** The first and last of the day's points it covers, inclusive. */
  from: number;
  to: number;
  distanceKm: number;
  maxSpeedKmh: number;
  /** Already under way when the history begins (parked overnight, or driving
   *  at midnight): its real start is not known. */
  openStart: boolean;
  /** Still going when the history ends: parked there now, or still driving. */
  ongoing: boolean;
}

export interface DayTimeline {
  /** Oldest first, every point timed. */
  points: TimedPoint[];
  segments: DaySegment[];
}

export const isTrip = (s: DaySegment) => s.kind === "trip";
export const segmentLength = (s: DaySegment) => s.end - s.start;

export const drivingMs = (d: DayTimeline) =>
  d.segments.filter(isTrip).reduce((sum, s) => sum + segmentLength(s), 0);
export const parkedMs = (d: DayTimeline) =>
  d.segments.filter((s) => !isTrip(s)).reduce((sum, s) => sum + segmentLength(s), 0);
export const dayDistanceKm = (d: DayTimeline) =>
  d.segments.filter(isTrip).reduce((sum, s) => sum + s.distanceKm, 0);

/** The points of `s`, for its map line or its playback. */
export const pointsOf = (d: DayTimeline, s: DaySegment) => d.points.slice(s.from, s.to + 1);

/**
 * The day's history from its `raw` points. Parked time counts from `dayStart`
 * when the day opens parked, and to `dayEnd` — or `now`, for today — when it
 * closes parked, as the vehicle stood there throughout.
 */
export function buildDayTimeline(
  raw: TripPoint[],
  { dayStart, dayEnd, now }: { dayStart: number; dayEnd: number; now: number },
): DayTimeline {
  const pts = timedSorted(raw);
  if (!pts.length) return { points: pts, segments: [] };

  const last = pts.length - 1;
  const today = now < dayEnd;
  const windowEnd = Math.max(today ? now : dayEnd, pts[last].time);

  // Stand-still runs long enough to be parkings.
  const runs: { from: number; to: number; start: number; end: number }[] = [];
  let i = 0;
  while (i < pts.length) {
    let j = i;
    while (j < last && metres(pts[i], pts[j + 1]) <= STOP_RADIUS_M) j++;
    const start = i === 0 ? dayStart : pts[i].time;
    const end = j === last ? windowEnd : departure(pts, j);
    if (end - start >= MIN_PARKING_MS) runs.push({ from: i, to: j, start, end });
    i = j + 1;
  }

  const trip = (a: number, b: number, start: number, end: number, openStart = false, ongoing = false): DaySegment => {
    const slice = pts.slice(a, b + 1);
    return {
      kind: "trip", start, end, from: a, to: b,
      distanceKm: distanceKm(slice), maxSpeedKmh: maxSpeedKmh(slice),
      openStart, ongoing,
    };
  };

  const found: DaySegment[] = [];
  if (!runs.length) {
    found.push(trip(0, last, pts[0].time, pts[last].time, true, today));
  } else {
    if (runs[0].from > 0) found.push(trip(0, runs[0].from, pts[0].time, runs[0].start, true));
    runs.forEach((r, k) => {
      found.push({
        kind: "parked", start: r.start, end: r.end, from: r.from, to: r.to,
        distanceKm: 0, maxSpeedKmh: 0,
        openStart: r.from === 0, ongoing: today && r.to === last,
      });
      const next = runs[k + 1];
      if (next) found.push(trip(r.to, next.from, r.end, next.start));
      else if (r.to < last) found.push(trip(r.to, last, r.end, pts[last].time, false, today));
    });
  }

  // A trip too short to count joins the parking either side of it.
  const segments: DaySegment[] = [];
  for (let s of found) {
    if (isTrip(s) && s.distanceKm < MIN_TRIP_KM) s = { ...s, kind: "parked", distanceKm: 0, maxSpeedKmh: 0 };
    const prev = segments[segments.length - 1];
    if (prev && !isTrip(prev) && !isTrip(s)) {
      segments[segments.length - 1] = { ...prev, end: s.end, to: s.to, ongoing: s.ongoing };
    } else {
      segments.push(s);
    }
  }
  return { points: pts, segments };
}

/** When the vehicle left the parking whose last fix is `j`: that fix, or the
 *  next one when nothing was sent for a while, as it stood there until then. */
function departure(pts: TimedPoint[], j: number): number {
  const here = pts[j].time;
  if (j + 1 >= pts.length) return here;
  const next = pts[j + 1].time;
  return next - here > DEPARTURE_GAP_MS ? next : here;
}
