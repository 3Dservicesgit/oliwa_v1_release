// Ported from oliwa-mobile test/trip_timeline_test.dart.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { TripPoint } from "../../src/features/gatehouse/trip/geo.ts";
import { TripTimeline } from "../../src/features/gatehouse/trip/tripTimeline.ts";
import { closeTo, east, MIN, SEC } from "./helpers.ts";

const t0 = new Date(2026, 9, 26, 8).getTime();
const at = (m: number, secs: number, speed = 0) => east(t0, m, secs, speed);

/** 10 min driving (a fix every 10 s), 60 min parked (a fix a minute), 10 min
 *  driving: 80 min in all. */
function driveStopDrive(): TripPoint[] {
  const pts: TripPoint[] = [];
  for (let s = 0; s <= 600; s += 10) pts.push(at(s * 10, s, 36));
  for (let m = 1; m <= 60; m++) pts.push(at(6000, 600 + m * 60));
  for (let s = 10; s <= 600; s += 10) pts.push(at(6000 + s * 10, 4200 + s, 36));
  return pts;
}

const TICK = 100;

test("progress is a moment: an hour stopped is three quarters of 80 min", () => {
  const tl = new TripTimeline(driveStopDrive());
  assert.equal(tl.span, 80 * MIN);
  assert.equal(tl.timeAt(0.5), t0 + 40 * MIN);
  assert.equal(tl.progressOf(t0 + 70 * MIN), 0.875);
});

test("the vehicle moves smoothly between fixes close in time", () => {
  const tl = new TripTimeline(driveStopDrive());
  const p = tl.positionAt(t0 + 5 * SEC);
  closeTo(p.lng, (tl.points[0].lng + tl.points[1].lng) / 2, 1e-9);
});

test("across a long gap it is held at its last fix, not glided", () => {
  const points = [at(0, 0), at(5000, 600)];
  const tl = new TripTimeline(points);
  assert.equal(tl.positionAt(t0 + 5 * MIN).lng, points[0].lng);
});

test("the hour parked is found", () => {
  const tl = new TripTimeline(driveStopDrive());
  const mid = tl.standStillAt(t0 + 40 * MIN);
  assert.ok(mid);
  assert.ok(mid.end - mid.start >= 59 * MIN);
  assert.equal(tl.standStillAt(t0 + 5 * MIN), null, "driving is not standing still");
});

test("parked before setting off counts as standing still too", () => {
  const points: TripPoint[] = [];
  for (let m = 0; m <= 30; m++) points.push(at(0, m * 60));
  for (let s = 10; s <= 300; s += 10) points.push(at(s * 10, 1800 + s, 36));
  assert.ok(new TripTimeline(points).standStillAt(t0 + 10 * MIN));
});

test("clock: ×120 plays two minutes of trip a second", () => {
  const tl = new TripTimeline(driveStopDrive());
  assert.equal(tl.advance(t0, TICK, 120) - t0, 12 * SEC);
});

test("clock: ×480 plays four times as fast", () => {
  const tl = new TripTimeline(driveStopDrive());
  assert.equal(tl.advance(t0, TICK, 480) - t0, 48 * SEC);
});

test("clock: a stand-still plays eight times faster, and stops at its end", () => {
  const tl = new TripTimeline(driveStopDrive());
  const inStop = t0 + 30 * MIN;
  assert.equal(tl.advance(inStop, TICK, 120) - inStop, 96 * SEC);
  const stop = tl.standStillAt(inStop)!;
  assert.equal(tl.advance(stop.end - 30 * SEC, TICK, 480), stop.end);
});

test("clock: the whole 80 min trip plays in well under a minute at ×120", () => {
  const tl = new TripTimeline(driveStopDrive());
  let t = tl.start, ticks = 0;
  while (t < tl.end && ticks < 10000) { t = tl.advance(t, TICK, 120); ticks++; }
  assert.equal(t, tl.end, "playback reached the end");
  const secs = (ticks * TICK) / 1000;
  assert.ok(secs >= 12 && secs <= 16, `${secs} s`);
});

test("clock: it moves on after a stand-still ends", () => {
  const tl = new TripTimeline(driveStopDrive());
  const stop = tl.standStillAt(t0 + 30 * MIN)!;
  assert.equal(tl.advance(stop.end, TICK, 120) - stop.end, 12 * SEC);
});

test("clock: it never runs past the end", () => {
  const tl = new TripTimeline(driveStopDrive());
  assert.equal(tl.advance(tl.end - SEC, TICK, 480), tl.end);
});

test("skip forward to the next stop, then to the end", () => {
  const tl = new TripTimeline(driveStopDrive());
  assert.equal(tl.standStills.length, 1);
  const stop = tl.standStills[0];
  assert.equal(tl.nextStop(tl.start), stop.start);
  assert.equal(tl.nextStop(stop.start), tl.end);
});

test("skip back to the stop, then on back to the start", () => {
  const tl = new TripTimeline(driveStopDrive());
  const stop = tl.standStills[0];
  assert.equal(tl.previousStop(tl.end), stop.start);
  assert.equal(tl.previousStop(stop.start + 5 * SEC), tl.start, "just after a stop starts, back goes past it");
  assert.equal(tl.previousStop(tl.start), tl.start);
});

test("untimed points still play, in order", () => {
  const tl = new TripTimeline([
    { lat: 1, lng: 34, speedKmh: 0, time: null },
    { lat: 1.001, lng: 34, speedKmh: 0, time: null },
    { lat: 1.002, lng: 34, speedKmh: 0, time: null },
  ]);
  assert.equal(tl.points.length, 3);
  assert.equal(tl.positionAt(tl.end).lat, 1.002);
});

test("indexAt finds the last fix at or before a moment", () => {
  const tl = new TripTimeline(driveStopDrive());
  assert.equal(tl.indexAt(t0), 0);
  assert.equal(tl.indexAt(t0 + 15 * SEC), 1);
  assert.equal(tl.indexAt(tl.end + 60 * MIN), tl.points.length - 1);
});
