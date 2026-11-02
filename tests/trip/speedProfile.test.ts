import { test } from "node:test";
import assert from "node:assert/strict";
import type { TripPoint } from "../../src/features/gatehouse/trip/geo.ts";
import { TripTimeline } from "../../src/features/gatehouse/trip/tripTimeline.ts";
import { profilePath, speedY, topSpeed } from "../../src/features/gatehouse/trip/speedProfile.ts";
import { placeOf, zoneAt, looksLikeCoords } from "../../src/features/gatehouse/trip/places.ts";
import { MIN } from "./helpers.ts";

const t0 = new Date(2026, 9, 30, 8).getTime();
const pt = (min: number, speed: number, lat = 0.3 + min * 0.001): TripPoint => ({ lat, lng: 32.6, speedKmh: speed, time: t0 + min * MIN });

test("one column per pixel, whatever the number of fixes", () => {
  const pts = Array.from({ length: 20000 }, (_, i) => ({ ...pt(0, 50), time: t0 + i * 1000, lat: 0.3 + i * 0.0001 }));
  const { line, area } = profilePath(new TripTimeline(pts), 400, 64);
  assert.equal(line.split(/[ML]/).filter(Boolean).length, 400);
  assert.ok(area.endsWith("Z"));
});

test("laid out in time: an hour stopped is most of the chart", () => {
  // 5 min driving at 60, an hour at 0, 5 min driving at 60.
  const pts = [pt(0, 60), pt(5, 60), pt(6, 0, 0.305), pt(65, 0, 0.305), pt(66, 60, 0.306), pt(70, 60, 0.31)];
  const tl = new TripTimeline(pts);
  const ys = profilePath(tl, 70, 64).line.split(/[ML]/).filter(Boolean).map((s) => Number(s.trim().split(" ")[1]));
  const flat = ys.filter((y) => y === speedY(0, topSpeed(tl), 64)).length;
  assert.ok(flat >= 55, `${flat} of 70 columns at 0 km/h`);
});

test("a faulty reading is drawn at the limit, not as the scale", () => {
  const tl = new TripTimeline([pt(0, 40), pt(1, 7200), pt(2, 40)]);
  assert.equal(topSpeed(tl), 200);
});

test("fewer than two fixes: nothing to draw", () => {
  assert.deepEqual(profilePath(new TripTimeline([pt(0, 10)]), 100, 64), { line: "", area: "" });
});

test("places: the geofence first, then a place name, never bare coordinates", () => {
  const zones = [{ name: "Entebbe Depot", path: [{ lat: 0, lng: 32 }, { lat: 0, lng: 33 }, { lat: 1, lng: 33 }, { lat: 1, lng: 32 }] }];
  const inside: TripPoint = { lat: 0.5, lng: 32.5, speedKmh: 0, time: null, place: "Entebbe Road" };
  const outside: TripPoint = { lat: 2, lng: 32.5, speedKmh: 0, time: null, place: "Gulu Road" };
  assert.equal(zoneAt(inside, zones), "Entebbe Depot");
  assert.equal(placeOf(inside, zones), "Entebbe Depot");
  assert.equal(placeOf(outside, zones), "Gulu Road");
  assert.equal(placeOf({ ...outside, place: "2.00000, 32.50000" }, zones), null);
  assert.ok(looksLikeCoords("0.9123383, 31.7719733"));
});
