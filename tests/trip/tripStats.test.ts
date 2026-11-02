// Ported from oliwa-mobile test/trip_stats_test.dart.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { TripPoint } from "../../src/features/gatehouse/trip/geo.ts";
import { metres } from "../../src/features/gatehouse/trip/geo.ts";
import { cumulativeKm, distanceKm, maxSpeedKmh, stopCount } from "../../src/features/gatehouse/trip/tripStats.ts";
import { closeTo, east, seeded } from "./helpers.ts";

const t0 = new Date(2026, 9, 26, 8).getTime();
const at = (m: number, secs: number, speed = 0, north = 0) => east(t0, m, secs, speed, north);

/** `n` points scattered within `radius` m of one spot, 10 s apart. */
function parked(n: number, radius = 6, fromSecs = 0, where = 0): TripPoint[] {
  const rnd = seeded(7);
  return Array.from({ length: n }, (_, i) =>
    at(where + (rnd() * 2 - 1) * radius, fromSecs + i * 10, 0, (rnd() * 2 - 1) * radius));
}

/** Driving east at `kmh` for `secs`, one fix a second. */
function drive(secs: number, kmh: number, from = 0, fromSecs = 0): TripPoint[] {
  const mps = kmh / 3.6;
  return Array.from({ length: secs + 1 }, (_, i) => at(from + mps * i, fromSecs + i, kmh));
}

test("distance so far rises along the route and ends at the trip distance", () => {
  const pts = [
    ...parked(30),
    ...Array.from({ length: 50 }, (_, k) => at((k + 1) * 100, 300 + (k + 1) * 10, 36)),
    ...parked(30, 6, 900, 5000),
  ];
  const so = cumulativeKm(pts);
  assert.equal(so.length, pts.length);
  assert.equal(so[0], 0);
  for (let i = 1; i < so.length; i++) assert.ok(so[i] >= so[i - 1]);
  assert.equal(so[so.length - 1], distanceKm(pts));
  assert.ok(so[29] < 0.05, "wobble while parked adds nothing");
  closeTo(so[so.length - 1], 5, 0.1);
});

test("an hour parked adds nothing", () => {
  const points = parked(360);
  let naive = 0;
  for (let i = 1; i < points.length; i++) naive += metres(points[i - 1], points[i]);
  assert.ok(naive > 500, "the old sum of every hop");
  assert.equal(distanceKm(points), 0);
});

test("a 10 km drive reads about 10 km, wobble and all", () => {
  closeTo(distanceKm([...drive(600, 60), ...parked(180, 6, 601, 10000)]), 10, 0.1);
});

test("one bad fix far away is not travel there and back", () => {
  const points = [...drive(60, 36), at(50000, 61, 36), ...drive(60, 36, 610, 62)];
  closeTo(distanceKm(points), 1.2, 0.05);
});

test("max speed: one faulty reading does not set it", () => {
  const points = drive(60, 50);
  points[30] = { ...points[30], speedKmh: 7200 }; // the 120x fault
  assert.equal(maxSpeedKmh(drive(60, 50)), 50);
  assert.equal(maxSpeedKmh(points), 50);
});

test("max speed: a single spike below the limit does not set it either", () => {
  const points = drive(60, 50);
  points[30] = { ...points[30], speedKmh: 140 };
  assert.equal(maxSpeedKmh(points), 50);
});

test("max speed: a unit whose every reading is faulty is timed from positions", () => {
  const points = drive(120, 72)
    .filter((p) => new Date(p.time!).getSeconds() % 10 === 0)
    .map((p) => ({ ...p, speedKmh: 72 * 120 }));
  closeTo(maxSpeedKmh(points), 72, 2);
});

test("max speed: a vehicle parked all day has none, wobble or not", () => {
  assert.equal(maxSpeedKmh(parked(360)), 0);
});

test("a 20-minute stop between two drives is counted", () => {
  const leg1 = drive(300, 40);
  const stop = parked(120, 6, 301, 3333);
  const leg2 = drive(300, 40, 3340, 1502);
  assert.equal(stopCount([...leg1, ...stop, ...leg2]), 1);
});
