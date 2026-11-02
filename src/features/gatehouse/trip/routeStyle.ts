/**
 * routeStyle.ts — how a played-back route is drawn: coloured by speed, as
 * Wialon colours its tracks, with arrows showing the way it was driven.
 *
 * Ported from the OLIWA mobile app (lib/models/route_style.dart).
 */
import { bearing, metres, type TripPoint } from "./geo.ts";
import { MAX_PLAUSIBLE_KMH } from "./tripStats.ts";

export interface SpeedBand {
  fromKmh: number;
  color: string;
  label: string;
}

/** Slowest first. Fleet-wide for now; Wialon sets them per unit. */
export const SPEED_BANDS: SpeedBand[] = [
  { fromKmh: 0,   color: "#4DD0E1", label: "under 40" },
  { fromKmh: 40,  color: "#1E88E5", label: "40–60" },
  { fromKmh: 60,  color: "#6A1B9A", label: "60–80" },
  { fromKmh: 80,  color: "#FFB300", label: "80–100" },
  { fromKmh: 100, color: "#E53935", label: "100+" },
];

/** A run shorter than this takes the colour of the run before it: one
 *  reading either side of a boundary would break the line into hundreds of
 *  pieces. */
export const MIN_RUN_POINTS = 3;

/** A stretch in one band: points `from`..`to`, inclusive. Neighbouring runs
 *  share their end point, so the line has no gaps. */
export interface RouteRun {
  band: number;
  from: number;
  to: number;
}

export function bandOf(kmh: number): number {
  for (let i = SPEED_BANDS.length - 1; i > 0; i--) {
    if (kmh >= SPEED_BANDS[i].fromKmh) return i;
  }
  return 0;
}

/** The route split into runs of one speed band. A faulty reading keeps the
 *  band before it. */
export function speedRuns(points: TripPoint[]): RouteRun[] {
  if (points.length < 2) return [];
  const band: number[] = [];
  for (const p of points) {
    const faulty = p.speedKmh > MAX_PLAUSIBLE_KMH;
    band.push(faulty ? (band.length ? band[band.length - 1] : 0) : bandOf(p.speedKmh));
  }

  const runs: RouteRun[] = [];
  let start = 0;
  for (let i = 1; i <= points.length; i++) {
    if (i < points.length && band[i] === band[start]) continue;
    const end = Math.min(i, points.length - 1);
    const short = end - start + 1 < MIN_RUN_POINTS;
    const prev = runs[runs.length - 1];
    if (prev && (short || prev.band === band[start])) prev.to = end;
    else runs.push({ band: band[start], from: start, to: end });
    start = i;
  }
  return runs;
}

/** Ahead of this, a position is far enough for its bearing to mean
 *  something rather than GPS wobble. */
export const HEADING_LOOK_M = 15;

/** Which way the vehicle faced at `index`: towards the first fix at least
 *  HEADING_LOOK_M ahead, else from the last one that far behind (it has
 *  stopped). Null when it never moved that far. */
export function headingAt(points: TripPoint[], index: number): number | null {
  if (index < 0 || index >= points.length) return null;
  const here = points[index];
  for (let j = index + 1; j < points.length; j++) {
    if (metres(here, points[j]) >= HEADING_LOOK_M) return bearing(here, points[j]);
  }
  for (let j = index - 1; j >= 0; j--) {
    if (metres(points[j], here) >= HEADING_LOOK_M) return bearing(points[j], here);
  }
  return null;
}

/** Where to put direction arrows: about `count` along the route, evenly by
 *  distance and never closer than `minSpacingM`. */
export function arrows(points: TripPoint[], count = 15, minSpacingM = 300): { index: number; heading: number }[] {
  if (points.length < 2) return [];
  let total = 0;
  for (let i = 1; i < points.length; i++) total += metres(points[i - 1], points[i]);
  const spacing = Math.max(minSpacingM, total / (count + 1));
  if (total < spacing) return [];

  const out: { index: number; heading: number }[] = [];
  let travelled = 0, next = spacing;
  for (let i = 1; i < points.length; i++) {
    travelled += metres(points[i - 1], points[i]);
    if (travelled < next) continue;
    const heading = headingAt(points, i);
    if (heading != null) out.push({ index: i, heading });
    while (next <= travelled) next += spacing;
  }
  return out;
}

/** The speed chart's scale: a faulty reading is drawn at the limit rather
 *  than flattening the rest of the chart. */
export const shownSpeed = (kmh: number) => Math.min(Math.max(kmh, 0), MAX_PLAUSIBLE_KMH);
