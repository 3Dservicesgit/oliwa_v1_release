/**
 * speedProfile.ts — the playback's speed chart, laid out in time: a long stop
 * is a flat stretch of its true width, and a click lands on a moment.
 *
 * As the OLIWA mobile app draws it (_SpeedProfilePainter), but reduced to one
 * value per column first: a day can hold 50,000 fixes and the chart is a few
 * hundred pixels wide.
 */
import { shownSpeed } from "./routeStyle.ts";
import type { TripTimeline } from "./tripTimeline.ts";

/** Room at the top for the cursor dot, as a share of the height. */
const TOP = 0.12;

/** The chart's top speed: faulty readings are drawn at the limit rather than
 *  flattening the rest of the chart. */
export function topSpeed(tl: TripTimeline): number {
  let max = 0;
  for (const p of tl.points) max = Math.max(max, shownSpeed(p.speedKmh));
  return max;
}

/** Height (0 at the top, `h` at the bottom) for a speed. */
export function speedY(kmh: number, maxKmh: number, h: number): number {
  const room = h * (1 - TOP);
  return h - (maxKmh <= 0 ? 0 : (room * shownSpeed(kmh)) / maxKmh) * 0.92;
}

/**
 * The outline as SVG path data in a `w` × `h` box: per column, the fastest
 * reading in it, so a short burst of speed still shows. Columns without a fix
 * (a gap, or a stop with few fixes) carry the speed before them on.
 */
export function profilePath(tl: TripTimeline, w: number, h: number): { line: string; area: string } {
  if (tl.points.length < 2) return { line: "", area: "" };
  const cols = Math.max(2, Math.round(w));
  const best = new Array<number>(cols).fill(-1);
  for (const p of tl.points) {
    const c = Math.min(cols - 1, Math.floor(tl.progressOf(p.time) * (cols - 1) + 0.5));
    best[c] = Math.max(best[c], shownSpeed(p.speedKmh));
  }
  const max = topSpeed(tl);
  let last = Math.max(0, best[0]);
  const parts: string[] = [];
  for (let c = 0; c < cols; c++) {
    if (best[c] >= 0) last = best[c];
    const x = ((c / (cols - 1)) * w).toFixed(1);
    parts.push(`${c ? "L" : "M"}${x} ${speedY(last, max, h).toFixed(1)}`);
  }
  const line = parts.join(" ");
  return { line, area: `${line} L${w} ${h} L0 ${h} Z` };
}
