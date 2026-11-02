// Ported from oliwa-mobile test/trip_service_test.dart and engine_time_test.dart,
// plus the paging the console's replay depends on.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadEngineTimes, loadRange, PAGE_SIZE, parseEngineTimes, parseStamp, replayBody,
  unavailableReason, type ApiReply,
} from "../../src/features/gatehouse/trip/tripHistory.ts";
import { MIN } from "./helpers.ts";

const from = new Date(2026, 9, 30, 6, 0).getTime();
const to = new Date(2026, 9, 30, 18, 30).getTime();

/** A server record `i` minutes after 06:00, newest-first pages built from these. */
function record(i: number) {
  const t = new Date(from + i * MIN);
  const two = (v: number) => String(v).padStart(2, "0");
  return {
    data_idx: 100000 + i,
    data_latitude: String(0.3 + i * 0.0001),
    data_longitude: "32.6",
    speed_log: "40",
    local_system_datestamp: `${two(t.getDate())}-${two(t.getMonth() + 1)}-${t.getFullYear()}`,
    local_system_timestamp: `${two(t.getHours())}:${two(t.getMinutes())}:00`,
  };
}

/** A fake replay route serving `records` (oldest first) newest first, a page at a time. */
function server(records: object[], fail?: (offset: number) => ApiReply | null) {
  const calls: { offset: number }[] = [];
  const post = async (body: unknown): Promise<ApiReply> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (body as any).data;
    const offset = Number(d.offset_log);
    calls.push({ offset });
    const failed = fail?.(offset);
    if (failed) return failed;
    const newest = [...records].reverse();
    const pageItems = newest.slice(offset, offset + Number(d.record_count));
    return pageItems.length ? { status: "success", data: pageItems } : { status: "error", message: "No Trips Found" };
  };
  return { post, calls };
}

test("the request asks for the exact window, every fix", () => {
  const b = replayBody("354002396040196", from, to, 5000).data;
  assert.deepEqual(b, {
    device_imei: "354002396040196", from_date: "30-10-2026", to_date: "30-10-2026",
    from_time: "06:00", to_time: "18:30", offset_log: "5000", record_count: String(PAGE_SIZE), dedupe: "false",
  });
});

test("points come back oldest first, with the figures", async () => {
  const { post } = server(Array.from({ length: 100 }, (_, i) => record(i)));
  const trip = await loadRange(post, "imei", from, to);
  assert.equal(trip.points.length, 100);
  assert.equal(trip.start, from);
  assert.equal(trip.end, from + 99 * MIN);
  assert.equal(trip.unavailable, null);
  assert.equal(trip.notice, null);
  assert.ok(trip.distanceKm > 1);
});

test("every page is read, and a fix a page boundary repeats is kept once", async () => {
  const records = Array.from({ length: PAGE_SIZE + 10 }, (_, i) => record(i % 700)).map((r, i) => ({ ...r, data_idx: i }));
  // The second page repeats the first page's last fix.
  const { post, calls } = server(records);
  const dupPost = async (body: unknown) => {
    const res = await post(body);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((body as any).data.offset_log === String(PAGE_SIZE) && Array.isArray(res.data)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prev = [...records].reverse()[PAGE_SIZE - 1] as any;
      return { ...res, data: [prev, ...res.data] };
    }
    return res;
  };
  const trip = await loadRange(dupPost, "imei", from, new Date(2026, 9, 30, 23, 59).getTime());
  assert.deepEqual(calls.map((c) => c.offset), [0, PAGE_SIZE]);
  assert.equal(trip.points.length, PAGE_SIZE + 10);
});

test("a day with no trip is empty, with nothing to report", async () => {
  const trip = await loadRange(server([]).post, "imei", from, to);
  assert.equal(trip.points.length, 0);
  assert.equal(trip.unavailable, null);
});

test("a vehicle the server cannot find says so, not 'no trip'", async () => {
  const post = async (): Promise<ApiReply> => ({ status: "error", message: "Device Data Cant Be Found" });
  const trip = await loadRange(post, "imei", from, to);
  assert.match(trip.unavailable ?? "", /trip history/);
  assert.match(trip.unavailable ?? "", /support/);
});

test("a failed later page keeps what loaded, and says the start may be missing", async () => {
  const records = Array.from({ length: PAGE_SIZE + 10 }, (_, i) => ({ ...record(i % 700), data_idx: i }));
  const { post } = server(records, (offset) => (offset > 0 ? { status: "error", message: "timeout" } : null));
  const trip = await loadRange(post, "imei", from, new Date(2026, 9, 30, 23, 59).getTime());
  assert.ok(trip.points.length > 0);
  assert.match(trip.notice ?? "", /start may be missing/);
});

test("a window over 31 days is refused before asking", async () => {
  const { post, calls } = server([]);
  const trip = await loadRange(post, "imei", from, from + 40 * 86_400_000);
  assert.match(trip.unavailable ?? "", /31 days/);
  assert.equal(calls.length, 0);
});

test("blocked billing and other failures each get their own reason", () => {
  assert.match(unavailableReason("Device Billing Is Blocked")!, /blocked/);
  assert.match(unavailableReason("Request timed out")!, /connection/);
  assert.equal(unavailableReason("No Trips Found"), null);
});

test("stamps: 24-hour and AM/PM", () => {
  assert.equal(parseStamp("30-10-2026", "15:50:07"), new Date(2026, 9, 30, 15, 50, 7).getTime());
  assert.equal(parseStamp("30-10-2026", "03:50:07PM"), new Date(2026, 9, 30, 15, 50, 7).getTime());
  assert.equal(parseStamp("30-10-2026", "12:05:00AM"), new Date(2026, 9, 30, 0, 5, 0).getTime());
  assert.equal(parseStamp("2026/10/30", "15:50"), null);
  assert.equal(parseStamp(null, "15:50"), null);
});

test("engine time: one per stop asked about, unknown ones null", () => {
  assert.deepEqual(parseEngineTimes({
    ignition: "configured",
    spans: [
      { engine_on_seconds: 56, readings: 41 },
      { engine_on_seconds: null, readings: 0 },
      { engine_on_seconds: 1500.4, readings: 9 },
    ],
  }, 3), [56_000, null, 1_500_000]);
  assert.deepEqual(parseEngineTimes({ ignition: "configured", spans: [{ engine_on_seconds: 15 }] }, 2), [15_000, null]);
});

test("engine time: no ignition input, or an unreadable answer, gives none", async () => {
  assert.equal(parseEngineTimes({ ignition: "not_configured", spans: [] }, 1), null);
  assert.equal(parseEngineTimes("oops", 1), null);
  assert.equal(parseEngineTimes({ ignition: "configured" }, 1), null);
  // The route missing on the server (404 before waswa-ai is deployed).
  const post = async (): Promise<ApiReply> => ({ status: "error", message: "Not Found" });
  assert.equal(await loadEngineTimes(post, "imei", [{ from, to }]), null);
});

test("engine time: stops are sent in local time", async () => {
  let sent: unknown;
  const post = async (body: unknown): Promise<ApiReply> => { sent = body; return { status: "success", data: { ignition: "configured", spans: [{ engine_on_seconds: 60 }] } }; };
  assert.deepEqual(await loadEngineTimes(post, "imei", [{ from, to }]), [60_000]);
  assert.deepEqual(sent, { data: { device_imei: "imei", spans: [{ from: "2026-10-30 06:00:00", to: "2026-10-30 18:30:00" }] } });
});
