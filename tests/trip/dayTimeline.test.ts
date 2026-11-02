// Ported from oliwa-mobile test/day_timeline_test.dart.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { TripPoint } from "../../src/features/gatehouse/trip/geo.ts";
import {
  buildDayTimeline, drivingMs, isTrip, parkedMs,
} from "../../src/features/gatehouse/trip/dayTimeline.ts";
import { span } from "../../src/features/gatehouse/trip/format.ts";
import { closeTo, MIN } from "./helpers.ts";

const day = new Date(2026, 9, 30).getTime();
const dayEnd = new Date(2026, 9, 30, 23, 59, 59).getTime();
const at = (h: number, m: number) => new Date(2026, 9, 30, h, m).getTime();
const p = (lat: number, lng: number, t: number, speed = 0): TripPoint => ({ lat, lng, speedKmh: speed, time: t });

/** Fixes every `every` at one spot, from `from` to `to`. */
function parked(lat: number, lng: number, from: number, to: number, every = 10 * MIN): TripPoint[] {
  const out: TripPoint[] = [];
  for (let t = from; t <= to; t += every) out.push(p(lat, lng, t));
  return out;
}

/** A straight drive, a fix a minute. */
function drive(lat0: number, lng0: number, lat1: number, lng1: number, from: number, to: number): TripPoint[] {
  const mins = Math.round((to - from) / MIN);
  const out: TripPoint[] = [];
  for (let m = 1; m < mins; m++) {
    out.push(p(lat0 + ((lat1 - lat0) * m) / mins, lng0 + ((lng1 - lng0) * m) / mins, from + m * MIN, 60));
  }
  return out;
}

const build = (pts: TripPoint[], now = new Date(2026, 10, 2).getTime()) =>
  buildDayTimeline(pts, { dayStart: day, dayEnd, now });

const kinds = (d: ReturnType<typeof build>) => d.segments.map((s) => s.kind);

test("parked overnight, one trip, parked now: as Wialon shows UBK 415T", () => {
  const pts = [
    ...parked(0.43, 33.2, at(0, 0), at(12, 18)),
    ...drive(0.43, 33.2, 0.25, 32.6, at(12, 18), at(15, 50)),
    ...parked(0.25, 32.6, at(15, 50), at(22, 0)),
  ];
  const d = build(pts, at(22, 1));
  assert.deepEqual(kinds(d), ["parked", "trip", "parked"]);
  const [first, trip, now] = d.segments;
  assert.ok(first.openStart);
  assert.equal(first.start, day);
  assert.equal(trip.start, at(12, 19), "nothing sent from 12:10, so it was parked until then");
  assert.equal(trip.end, at(15, 50));
  closeTo(trip.distanceKm, 70, 3);
  assert.equal(trip.maxSpeedKmh, 60);
  assert.ok(now.ongoing);
  assert.equal(now.end, at(22, 1));
  assert.equal(parkedMs(d) + drivingMs(d), at(22, 1) - day, "the whole day so far is accounted for");
});

test("a past day closes at its end, not ongoing", () => {
  const d = build([
    ...parked(0.43, 33.2, at(0, 0), at(8, 0)),
    ...drive(0.43, 33.2, 0.45, 33.25, at(8, 0), at(8, 30)),
    ...parked(0.45, 33.25, at(8, 30), at(23, 50)),
  ]);
  const last = d.segments[d.segments.length - 1];
  assert.equal(last.ongoing, false);
  assert.equal(last.end, dayEnd);
  assert.equal(d.segments.filter(isTrip).length, 1);
});

test("a short hop or GPS drift does not split a parking", () => {
  const d = build([
    ...parked(0.43, 33.2, at(0, 0), at(9, 0)),
    p(0.4309, 33.2, at(9, 5)), // 100 m away, and back
    ...parked(0.43, 33.2, at(9, 10), at(12, 0)),
    ...drive(0.43, 33.2, 0.45, 33.25, at(12, 0), at(12, 30)),
    ...parked(0.45, 33.25, at(12, 30), at(23, 50)),
  ]);
  assert.deepEqual(kinds(d), ["parked", "trip", "parked"]);
  assert.equal(d.segments[0].start, day);
  assert.equal(d.segments[0].end, at(12, 0));
});

test("a unit that sleeps while parked: the trip starts at its next fix", () => {
  const d = build([
    ...parked(0.43, 33.2, at(0, 0), at(7, 0)),
    ...drive(0.43, 33.2, 0.45, 33.25, at(7, 39), at(8, 10)),
    ...parked(0.45, 33.25, at(8, 10), at(23, 50)),
  ]);
  assert.equal(d.segments[0].end, at(7, 40));
  assert.equal(d.segments[1].start, at(7, 40));
});

test("driving at midnight opens with a trip", () => {
  const d = build([
    ...drive(0.4, 33.1, 0.43, 33.2, at(0, 0), at(0, 40)),
    ...parked(0.43, 33.2, at(0, 40), at(23, 50)),
  ]);
  assert.ok(isTrip(d.segments[0]));
  assert.ok(d.segments[0].openStart);
});

test("stops shorter than five minutes stay part of the trip", () => {
  const d = build([
    ...parked(0.43, 33.2, at(0, 0), at(8, 0)),
    ...drive(0.43, 33.2, 0.45, 33.25, at(8, 0), at(8, 30)),
    ...parked(0.45, 33.25, at(8, 30), at(8, 33), MIN),
    ...drive(0.45, 33.25, 0.47, 33.3, at(8, 33), at(9, 0)),
    ...parked(0.47, 33.3, at(9, 0), at(23, 50)),
  ]);
  assert.equal(d.segments.filter(isTrip).length, 1);
});

test("no points: an empty day", () => {
  assert.equal(build([]).segments.length, 0);
});

test("span", () => {
  assert.equal(span(3 * 60 * MIN + 31 * MIN), "3 h 31 min");
  assert.equal(span(45 * MIN), "45 min");
  assert.equal(span(0), "0 min");
});
