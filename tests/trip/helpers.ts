// Test helpers: points built the way the OLIWA mobile app's tests build them.
import type { TripPoint } from "../../src/features/gatehouse/trip/geo.ts";

export const MIN = 60_000;
export const SEC = 1_000;

export function closeTo(actual: number, expected: number, delta: number, msg = "") {
  if (Math.abs(actual - expected) > delta) {
    throw new Error(`${msg} expected ${actual} to be within ${delta} of ${expected}`);
  }
}

/** A point `metresEast` (and `north`) of a fixed spot near Mbale, at `t0 + secs`. */
export function east(t0: number, metresEast: number, secs: number, speed = 0, north = 0): TripPoint {
  const lat0 = 1.0745, lng0 = 34.1356;
  return {
    lat: lat0 + north / 111320,
    lng: lng0 + metresEast / (111320 * Math.cos((lat0 * Math.PI) / 180)),
    speedKmh: speed,
    time: t0 + secs * SEC,
  };
}

/** Deterministic random numbers, so wobble tests repeat exactly. */
export function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}
