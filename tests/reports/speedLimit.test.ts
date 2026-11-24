// Mirrors oliwa-mobile test/speed_limit_test.dart.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseSpeedLimit, speedLimitProblem, speedRangeProblem,
} from "../../src/features/reports/speedLimit.ts";

test("any speed from 1 to 300 km/h is accepted", () => {
  assert.equal(parseSpeedLimit("30"), 30);
  assert.equal(parseSpeedLimit(" 43 "), 43);
  assert.equal(parseSpeedLimit("42.5"), 42.5);
  assert.equal(parseSpeedLimit("1"), 1);
  assert.equal(parseSpeedLimit("300"), 300);
  for (const bad of ["", "0", "-5", "301", "fast", "NaN", "1e2"]) {
    assert.equal(parseSpeedLimit(bad), null, bad);
    assert.notEqual(speedLimitProblem(bad), null, bad);
  }
});

test("up to 31 days, counted inclusively, either way round", () => {
  assert.equal(speedRangeProblem("2026-11-01", "2026-11-30"), null);
  assert.equal(speedRangeProblem("2026-10-01", "2026-10-31"), null);
  assert.notEqual(speedRangeProblem("2026-10-01", "2026-11-01"), null);
  assert.notEqual(speedRangeProblem("2026-11-30", "2026-10-01"), null);
});
