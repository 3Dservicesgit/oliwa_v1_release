/**
 * tripTimeline.ts — trip playback in time.
 *
 * Progress is a moment between the first and last fix; the vehicle is placed
 * where it was at that moment and the clock runs at a stated multiple of real
 * time, faster over stand-stills. Stepping one point per tick (the console's
 * old replay) made a two-hour stop flash past and a dense stretch crawl.
 *
 * Ported from the OLIWA mobile app (lib/models/trip_timeline.dart).
 */
import { metres, MINUTE, type TimedPoint, type TripPoint } from "./geo.ts";

/** A stretch spent standing still: parked, or a stop on the way. */
export interface StandStill {
  start: number;
  end: number;
}

export class TripTimeline {
  /** Rates offered, as multiples of real time (×120: a second plays two
   *  minutes), labelled as Wialon labels its own. */
  static readonly rates = [60, 120, 480, 1000];
  static readonly defaultRate = 120;
  /** How much faster the clock runs while the vehicle stands still. */
  static readonly standStillFactor = 8;
  static readonly standStillRadiusM = 60;
  /** The shortest stand-still worth showing as one. */
  static readonly minStandStillMs = 2 * MINUTE;
  /** Across a longer gap between fixes the vehicle is held at its last fix,
   *  as nothing says it moved. */
  static readonly maxInterpolationGapMs = 2 * MINUTE;
  /** A moment this soon after a stop's start counts as at it, so Back goes
   *  on back rather than landing on the same stop. */
  static readonly skipBackGraceMs = 30_000;

  /** Oldest first, every point timed. */
  readonly points: TimedPoint[];
  readonly standStills: StandStill[];

  constructor(points: TripPoint[]) {
    this.points = timed(points);
    this.standStills = findStandStills(this.points);
  }

  get isEmpty() { return this.points.length === 0; }
  get start() { return this.points[0].time; }
  get end() { return this.points[this.points.length - 1].time; }
  get span() { return this.end - this.start; }

  /** 0..1 → the moment that far through the trip. */
  timeAt(progress: number): number {
    return this.start + Math.round(this.span * clamp01(progress));
  }

  /** The moment → 0..1. */
  progressOf(t: number): number {
    const total = this.span;
    if (total <= 0) return 0;
    return clamp01((t - this.start) / total);
  }

  /** The last fix at or before `t`. */
  indexAt(t: number): number {
    const pts = this.points;
    if (t <= pts[0].time) return 0;
    let lo = 0, hi = pts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (pts[mid].time > t) hi = mid - 1;
      else lo = mid;
    }
    return lo;
  }

  /** Where the vehicle was at `t`: between two fixes close in time, the point
   *  along the line between them; across a longer gap, its last fix. */
  positionAt(t: number): TimedPoint {
    const i = this.indexAt(t);
    const a = this.points[i];
    if (i + 1 >= this.points.length) return a;
    const b = this.points[i + 1];
    const gap = b.time - a.time;
    if (gap <= 0 || gap > TripTimeline.maxInterpolationGapMs) return a;
    const k = clamp01((t - a.time) / gap);
    return { lat: a.lat + (b.lat - a.lat) * k, lng: a.lng + (b.lng - a.lng) * k, speedKmh: a.speedKmh, time: t };
  }

  /** The stand-still `t` falls in, if any. */
  standStillAt(t: number): StandStill | null {
    for (const s of this.standStills) {
      if (t >= s.start && t <= s.end) return s;
      if (s.start > t) break;
    }
    return null;
  }

  /** Skip forward: the start of the next stand-still after `t`, or the end. */
  nextStop(t: number): number {
    for (const s of this.standStills) if (s.start > t) return s.start;
    return this.end;
  }

  /** Skip back: the start of the stand-still before `t`, or the start. */
  previousStop(t: number): number {
    const before = t - TripTimeline.skipBackGraceMs;
    for (let i = this.standStills.length - 1; i >= 0; i--) {
      if (this.standStills[i].start < before) return this.standStills[i].start;
    }
    return this.start;
  }

  /** The clock after `elapsedMs` of real time at `rate`: standStillFactor
   *  times faster while standing still, but never past a stand-still's end
   *  in one step, so the drive after it plays at the normal rate. */
  advance(t: number, elapsedMs: number, rate: number): number {
    const normal = elapsedMs * rate;
    const still = this.standStillAt(t);
    // Only before its end: a step capped at the end would land there again,
    // and playback would stop dead at the end of every stand-still.
    if (still && t < still.end) {
      return Math.min(t + normal * TripTimeline.standStillFactor, still.end);
    }
    return Math.min(t + normal, this.end);
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function timed(points: TripPoint[]): TimedPoint[] {
  const withTime = points.filter((p) => p.time != null) as TimedPoint[];
  if (withTime.length === points.length || withTime.length >= 2) return withTime;
  // Nothing (or one fix) is timed: play the route in order, a second apart.
  const t0 = new Date(2000, 0, 1).getTime();
  return points.map((p, i) => ({ ...p, time: t0 + i * 1000 }));
}

/** Runs of fixes within standStillRadiusM of where the run began, lasting at
 *  least minStandStillMs — at the start and end of the window too. */
function findStandStills(pts: TimedPoint[]): StandStill[] {
  const out: StandStill[] = [];
  let i = 0;
  while (i < pts.length) {
    let j = i;
    while (j + 1 < pts.length && metres(pts[i], pts[j + 1]) <= TripTimeline.standStillRadiusM) j++;
    if (pts[j].time - pts[i].time >= TripTimeline.minStandStillMs) out.push({ start: pts[i].time, end: pts[j].time });
    i = j + 1;
  }
  return out;
}
