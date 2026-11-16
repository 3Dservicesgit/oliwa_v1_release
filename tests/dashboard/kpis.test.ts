// The dashboard's fleet status from the server's summary.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fleetFromServer, healthyFraction, reportingNow } from "../../src/features/fleet-dashboard/kpis.ts";

// Timothy Mwandha's fleet on 6 Nov 2026, as /fleet/{client}/summary sent it.
const summary = {
  counts: { moving: 2, idling: 0, parked: 7, no_position: 0, silent: 12, never_reported: 14, unread: 0 },
  silent_ages: { under_day: 0, up_to_week: 0, over_week: 12 },
  weak_gps: 0, quiet_parked: 0, reporting_now: 9, total: 35,
};

test("units that never reported are No data, not online", () => {
  const k = fleetFromServer(summary);
  assert.equal(k.counts.noData, 14);
  assert.equal(reportingNow(k), 9);
  assert.equal(reportingNow(k), summary.reporting_now);
});

test("the states add up to the fleet", () => {
  const k = fleetFromServer(summary);
  assert.equal(Object.values(k.counts).reduce((a, b) => a + b, 0), k.total);
});

test("device health counts never-reported units as flagged, as the app does", () => {
  // 35 units: 12 silent over a day and 14 never reported leave 9 healthy.
  assert.equal(Math.round(healthyFraction(fleetFromServer(summary))! * 100), 26);
});
