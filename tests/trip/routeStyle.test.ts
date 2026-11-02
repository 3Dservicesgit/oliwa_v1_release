// Ported from oliwa-mobile test/route_style_test.dart.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { TripPoint } from "../../src/features/gatehouse/trip/geo.ts";
import { bearing } from "../../src/features/gatehouse/trip/geo.ts";
import { arrows, bandOf, headingAt, speedRuns } from "../../src/features/gatehouse/trip/routeStyle.ts";
import { closeTo } from "./helpers.ts";

/** Points heading north, ~111 m apart, at the given speeds. */
const north = (speeds: number[]): TripPoint[] =>
  speeds.map((s, i) => ({ lat: 0.3 + i * 0.001, lng: 32.6, speedKmh: s, time: null }));
const pt = (lat: number, lng: number, speedKmh = 0): TripPoint => ({ lat, lng, speedKmh, time: null });

test("bands", () => {
  assert.equal(bandOf(0), 0);
  assert.equal(bandOf(39.9), 0);
  assert.equal(bandOf(40), 1);
  assert.equal(bandOf(75), 2);
  assert.equal(bandOf(95), 3);
  assert.equal(bandOf(130), 4);
});

test("speed runs share their end points, so the line has no gaps", () => {
  const runs = speedRuns(north([20, 20, 20, 20, 70, 70, 70, 70, 20, 20, 20]));
  assert.deepEqual(runs, [
    { band: 0, from: 0, to: 4 },
    { band: 2, from: 4, to: 8 },
    { band: 0, from: 8, to: 10 },
  ]);
});

test("a reading or two across a boundary does not split the line", () => {
  assert.deepEqual(speedRuns(north([30, 30, 30, 30, 45, 30, 30, 30, 30])), [{ band: 0, from: 0, to: 8 }]);
});

test("a faulty reading keeps the colour before it", () => {
  assert.deepEqual(speedRuns(north([30, 30, 30, 9000, 30, 30])).map((r) => r.band), [0]);
});

test("fewer than two points: nothing to draw", () => {
  assert.deepEqual(speedRuns(north([50])), []);
});

test("bearing", () => {
  const a = pt(0.3, 32.6);
  closeTo(bearing(a, pt(0.31, 32.6)), 0, 0.01);
  closeTo(bearing(a, pt(0.3, 32.61)), 90, 0.01);
  closeTo(bearing(a, pt(0.29, 32.6)), 180, 0.01);
  closeTo(bearing(a, pt(0.3, 32.59)), 270, 0.01);
});

test("heading looks past GPS wobble, and behind once stopped", () => {
  const a = pt(0.3, 32.6);
  const pts = [a, pt(0.30001, 32.6), pt(0.3, 32.601, 30)];
  closeTo(headingAt(pts, 0)!, 90, 1);
  closeTo(headingAt(pts, 2)!, 90, 1, "at the end it faces the way it came");
  assert.equal(headingAt([a, a], 0), null);
});

test("arrows are spread along the route, all pointing the way driven", () => {
  const out = arrows(north(Array(101).fill(50)), 10);
  assert.ok(out.length >= 9 && out.length <= 11, `${out.length}`);
  for (const a of out) closeTo(a.heading, 0, 0.5);
  const gaps = out.slice(1).map((a, i) => a.index - out[i].index);
  assert.ok(gaps.every((g) => g >= 8 && g <= 10), `${gaps}`);
});

test("a short route gets no arrows", () => {
  assert.deepEqual(arrows(north([30, 30])), []);
});
