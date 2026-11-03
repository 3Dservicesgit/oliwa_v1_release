import { test } from "node:test";
import assert from "node:assert/strict";
import { limiter, LiveFleet, type StreamLike } from "../../src/utils/liveFleet.ts";
import { parseLiveFrame, readPosition } from "../../src/utils/livePosition.ts";

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

const position = (lat: number) => JSON.stringify({
  status: "success",
  data: { data_latitude: String(lat), data_longitude: "32.58", speed_log: "0", motion_state: "Idiling", ignition_state: "ON" },
});

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
