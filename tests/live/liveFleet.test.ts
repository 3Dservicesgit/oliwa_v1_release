import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { limiter, LiveFleet, type StreamLike } from "../../src/utils/liveFleet.ts";
import { fixTime, motionText, parseLiveFrame, readPosition } from "../../src/utils/livePosition.ts";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Until [ok] holds, or 3 s (timers are coarse on Windows, so no fixed waits). */
async function until(ok: () => boolean) {
  for (let t = 0; t < 3000 && !ok(); t += 10) await wait(10);
}

/** A fake stream server: records what is open, and answers each unit as told. */
function server(answer: (imei: string) => string | null = () => JSON.stringify({ status: "no_data" })) {
  const open = new Set<FakeStream>();
  let peak = 0;
  const opened: string[] = [];
  class FakeStream implements StreamLike {
    onmessage: ((ev: { data: string }) => void) | null = null;
    onerror: ((ev: unknown) => void) | null = null;
    readonly imei: string;
    constructor(imei: string) {
      this.imei = imei;
      open.add(this);
      peak = Math.max(peak, open.size);
      opened.push(imei);
      const data = answer(imei);
      if (data != null) setTimeout(() => this.onmessage?.({ data: JSON.stringify({ status: "heartbeat" }) }), 1);
      if (data != null) setTimeout(() => this.onmessage?.({ data }), 3);
    }
    close() { open.delete(this); }
  }
  return {
    open: (url: string) => new FakeStream(/data-stream\/([^/]+)\//.exec(url)![1]),
    get openNow() { return [...open].map((s) => s.imei); },
    get peak() { return peak; },
    opened,
    streams: open,
  };
}

/** A report made just now. */
const position = (lat: number) => {
  const t = new Date();
  const two = (v: number) => String(v).padStart(2, "0");
  return JSON.stringify({
    status: "success",
    data: { data_latitude: String(lat), data_longitude: "32.58", speed_log: "0", motion_state: "Idiling", ignition_state: "ON",
      local_system_datestamp: `${two(t.getDate())}-${two(t.getMonth() + 1)}-${t.getFullYear()}`,
      local_system_timestamp: `${two(t.getHours())}:${two(t.getMinutes())}:${two(t.getSeconds())}` },
  });
};

test("reads every unit, a few at a time, never more connections than allowed", async () => {
  const s = server();
  const seen: string[] = [];
  const fleet = new LiveFleet({
    base: "https://x", open: s.open, parallel: 4, waitMs: 200, restMs: 10_000,
    onFrame: (imei) => seen.push(imei),
  });
  fleet.setUnits(Array.from({ length: 35 }, (_, i) => `u${i}`));
  fleet.start();
  await until(() => new Set(seen).size === 35);
  fleet.stop();
  assert.equal(new Set(seen).size, 35);
  assert.ok(s.peak <= 4, `peak ${s.peak}`);
  assert.deepEqual(s.openNow, []);
});

test("the followed unit keeps its stream and is left out of the rotation", async () => {
  const s = server((imei) => (imei === "u1" ? position(0.31) : JSON.stringify({ status: "no_data" })));
  const frames: string[] = [];
  const fleet = new LiveFleet({
    base: "https://x", open: s.open, parallel: 2, waitMs: 200, restMs: 10_000,
    onFrame: (imei, f) => frames.push(`${imei}:${f.kind}`),
  });
  fleet.setUnits(["u0", "u1", "u2"]);
  fleet.follow("u1");
  fleet.start();
  await until(() => s.opened.length === 3 && s.openNow.length === 1 && frames.includes("u1:position"));
  assert.deepEqual(s.openNow, ["u1"]);
  assert.equal(s.opened.filter((i) => i === "u1").length, 1);
  assert.ok(frames.includes("u1:position"));
  fleet.follow(null);
  assert.deepEqual(s.openNow, []);
  fleet.stop();
});

test("a dropped followed stream reopens; stop() cancels a pending reopen", async () => {
  const s = server();
  const fleet = new LiveFleet({ base: "https://x", open: s.open, retryMs: 20, restMs: 10_000, onFrame: () => {} });
  fleet.follow("u1");
  fleet.start();
  [...s.streams][0].onerror?.({});
  await until(() => s.openNow.length === 1);
  assert.deepEqual(s.openNow, ["u1"]);
  [...s.streams][0].onerror?.({});
  fleet.stop();
  await wait(40);
  assert.deepEqual(s.openNow, []);
});

test("a quiet unit is reported silent after the wait, and the next pass reads it again", async () => {
  const s = server(() => null);
  const silent: string[] = [];
  const fleet = new LiveFleet({
    base: "https://x", open: s.open, waitMs: 15, restMs: 15,
    onFrame: () => {}, onSilent: (imei) => silent.push(imei),
  });
  fleet.setUnits(["u0"]);
  fleet.start();
  await until(() => silent.length >= 2);
  fleet.stop();
  assert.ok(silent.length >= 2, `read ${silent.length} times`);
});

test("skipped units are not read", async () => {
  const s = server();
  const fleet = new LiveFleet({
    base: "https://x", open: s.open, restMs: 10_000, onFrame: () => {}, skip: (i) => i === "u0",
  });
  fleet.setUnits(["u0", "u1"]);
  fleet.start();
  await wait(20);
  fleet.stop();
  assert.deepEqual(s.opened, ["u1"]);
});

test("limiter runs every task, at most limit at once, past failures", async () => {
  let now = 0, peak = 0;
  const limit = limiter(3);
  const results = await Promise.allSettled([1, 2, 3, 4, 5, 6, 7].map((n) => limit(async () => {
    now++; peak = Math.max(peak, now);
    try {
      await wait(5);
      if (n === 2) throw new Error("one fails");
      return n;
    } finally { now--; }
  })));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 6);
  assert.ok(peak <= 3, `peak ${peak}`);
});

test("the server's 'Idiling' reads as Idling, also at 0 km/h", () => {
  const f = parseLiveFrame(position(0.31), "u1");
  assert.equal(f.kind, "position");
  if (f.kind !== "position") return;
  assert.equal(f.position.status, "Idling");
  assert.equal(f.position.motionState, "Idling");
});

test("ignition comes from ignition_state, as the live feed sends it", () => {
  const f = parseLiveFrame(position(0.31), "u1");
  assert.equal(f.kind === "position" && f.position.ignition, "ON");
});

test("a trip-history row reads as a position; no fix reads as none", () => {
  const p = readPosition({ data_latitude: "0.3", data_longitude: "32.6", speed_log: "0",
    local_system_datestamp: "01-11-2026", local_system_timestamp: "23:57:02" }, "u1");
  assert.equal(p?.lastSync, "01-11-2026 23:57:02");
  assert.equal(readPosition({ data_latitude: "0", data_longitude: "0" }, "u1"), null);
});

// MOROTO GENSET, 3 Nov 2026 20:34: the feed still sent its 7 Oct report.
const now = new Date(2026, 10, 3, 20, 34).getTime();
const report = (date: string, time: string, extra: Record<string, unknown> = {}) => JSON.stringify({
  status: "success",
  data: { data_latitude: "2.53", data_longitude: "34.66", speed_log: 0, motion_state: "Idiling", ignition_state: "ON",
    local_system_datestamp: date, local_system_timestamp: time, ...extra },
});
const read = (raw: string) => {
  const f = parseLiveFrame(raw, "u1", now);
  assert.equal(f.kind, "position");
  return f.kind === "position" ? f.position : null!;
};

test("a report weeks old is Offline, with what it was doing then", () => {
  const p = read(report("07-10-2026", "12:45:38PM", { device_state: "Offline" }));
  assert.equal(p.status, "Offline");
  assert.equal(p.reporting, false);
  assert.equal(motionText(p), "Not reporting · last seen idling");
  // Old by its date alone, whatever device_state says.
  assert.equal(read(report("07-10-2026", "12:45:38PM")).status, "Offline");
});

test("a fresh report keeps its state, whatever device_state says", () => {
  const p = read(report("03-11-2026", "08:22:52PM", { device_state: "Online" }));
  assert.equal(p.status, "Idling");
  assert.equal(motionText(p), "Idling");
  assert.equal(read(report("03-11-2026", "08:22:52PM", { device_state: "Offline" })).status, "Idling");
});

test("parked is held while the tracker sleeps: flagged after a day, Offline after 7", () => {
  const parked = (date: string, time: string) => read(report(date, time,
    { motion_state: "Parked", ignition_state: "OFF", device_state: "Offline" }));
  // UAJ 378X(Mpigi), 3 Nov: parked at 12:44, tracker asleep since.
  assert.equal(parked("03-11-2026", "12:44:43PM").status, "Parked");
  assert.equal(motionText(parked("03-11-2026", "12:44:43PM")), "Parked");
  const quiet = parked("01-11-2026", "11:57:02PM");
  assert.equal(quiet.status, "Parked");
  assert.equal(quiet.quiet, true);
  assert.equal(motionText(quiet), "Parked · tracker quiet since 1 Nov");
  assert.equal(parked("25-10-2026", "11:44:36PM").status, "Offline");
  assert.equal(motionText(parked("25-10-2026", "11:44:36PM")), "Not reporting · last seen parked");
});

test("the hour is the line", () => {
  assert.equal(read(report("03-11-2026", "07:33:00PM")).status, "Offline");
  assert.equal(read(report("03-11-2026", "07:35:00PM")).status, "Idling");
});

test("report times: record_timestamp (UTC) first, else the local date and time", () => {
  assert.equal(fixTime({ record_timestamp: "2026-10-07T09:45:38.000Z" }), Date.UTC(2026, 9, 7, 9, 45, 38));
  assert.equal(fixTime({ local_system_datestamp: "07-10-2026", local_system_timestamp: "12:45:38PM" }),
    new Date(2026, 9, 7, 12, 45, 38).getTime());
  assert.equal(fixTime({ local_system_datestamp: "07-10-2026", local_system_timestamp: "12:05:00AM" }),
    new Date(2026, 9, 7, 0, 5, 0).getTime());
  assert.equal(fixTime({}), null);
});

// The fleet status cases shared by the backend and the mobile app
// (navas-core-apis/tests/fixtures/fleet_status_cases.json, copied to
// oliwa-mobile/test/fixtures/): the console reads a unit the same way.
const sharedCases = ["../navas-core-apis/tests/fixtures/fleet_status_cases.json",
  "../oliwa-mobile/test/fixtures/fleet_status_cases.json"].find((f) => existsSync(f));
const asShown: Record<string, string> = { moving: "Moving", idling: "Idling", parked: "Parked", silent: "Offline" };

test("the shared fleet status cases", { skip: sharedCases ? false : "fleet_status_cases.json not checked out beside this repo" }, () => {
  const data = JSON.parse(readFileSync(sharedCases!, "utf8"));
  const now = new Date(data.now).getTime();
  const two = (v: number) => String(v).padStart(2, "0");
  let checked = 0;
  for (const c of data.cases) {
    for (const u of c.units) {
      // Units with no report, or not checked, never reach this reader.
      if (!u.frame || !(u.expect in asShown)) continue;
      const t = new Date(now - u.minutes_ago * 60_000);
      const body = { ...u.frame,
        local_system_datestamp: `${two(t.getDate())}-${two(t.getMonth() + 1)}-${t.getFullYear()}`,
        local_system_timestamp: `${two(t.getHours())}:${two(t.getMinutes())}:${two(t.getSeconds())}` };
      const p = readPosition(body, u.id, now);
      if (!p) continue; // no fix (0,0): no position on the map either
      assert.equal(p.status, asShown[u.expect], `${c.name}: ${u.id}`);
      checked++;
    }
  }
  assert.ok(checked >= 25, `checked ${checked}`);
});
