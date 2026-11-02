/**
 * tripHistory.ts — reading a window of history from the replay route
 * (POST /data-stream/trips/history/replay), page by page, and the engine-time
 * route (POST /data-stream/trips/engine-time).
 *
 * The network call is passed in, so this is the same code under test and in
 * the page. Ported from the OLIWA mobile app (lib/services/trip_service.dart).
 */
import type { TripPoint } from "./geo.ts";
import { emptyTrip, summarize, type TripData } from "./tripStats.ts";
import { hhmm, monthDay } from "./format.ts";

/** Fixes per request (the replay route takes up to 15,000). */
export const PAGE_SIZE = 5000;
/** The most fixes one window loads. Past it the window is shortened — from
 *  its start, as pages run newest first — and the notice says so. */
export const MAX_POINTS = 50000;
/** The longest window: the position store reads a day at a time and cuts a
 *  long range short without saying so. */
export const MAX_DAYS = 31;
/** Most stops one engine-time request covers (the server's limit). */
export const MAX_ENGINE_SPANS = 50;

/** The server's reply, as the console's fetch helpers return it. */
export interface ApiReply {
  status?: string;
  message?: string;
  data?: unknown;
}

export type PostFn = (body: unknown) => Promise<ApiReply>;

const two = (v: number) => String(v).padStart(2, "0");
const ddmmyyyy = (d: Date) => `${two(d.getDate())}-${two(d.getMonth() + 1)}-${d.getFullYear()}`;
const hm = (d: Date) => `${two(d.getHours())}:${two(d.getMinutes())}`;

/** "2026-10-30 15:50:00", as the engine-time route reads local times. */
export function localStamp(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${hm(d)}:${two(d.getSeconds())}`;
}

/** OLIWA stamps — date "DD-MM-YYYY", time "HH:MM:SS", maybe with AM/PM — as
 *  epoch ms in local time; null when unreadable. */
export function parseStamp(date?: string | null, time?: string | null): number | null {
  if (!date) return null;
  const dp = date.split("-");
  if (dp.length !== 3) return null;
  const [day, month, year] = dp.map(Number);
  if (![day, month, year].every(Number.isFinite)) return null;
  let hour = 0, minute = 0, second = 0;
  if (time) {
    const up = time.toUpperCase();
    const pm = up.includes("PM");
    const tp = up.replace(/[^0-9:]/g, "").split(":");
    hour = parseInt(tp[0], 10) || 0;
    minute = parseInt(tp[1], 10) || 0;
    second = parseInt(tp[2], 10) || 0;
    if (pm && hour !== 12) hour += 12;
    if (!pm && hour === 12 && up.includes("AM")) hour = 0;
  }
  return new Date(year, month - 1, day, hour, minute, second).getTime();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pointFrom(m: any): TripPoint {
  const num = (v: unknown) => (typeof v === "number" ? v : parseFloat(String(v ?? ""))) || 0;
  return {
    lat: num(m?.data_latitude),
    lng: num(m?.data_longitude),
    speedKmh: num(m?.speed_log),
    time: parseStamp(m?.local_system_datestamp?.toString(), m?.local_system_timestamp?.toString()),
    place: m?.geocoded_location ? String(m.geocoded_location) : undefined,
    satellites: m?.data_connected_satelites != null ? num(m.data_connected_satelites) : undefined,
    hdop: m?.data_hdop != null ? String(m.data_hdop) : undefined,
  };
}

/** What to tell the customer when the history request fails. Null for "No
 *  Trips Found": that window really has no trip. */
export function unavailableReason(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("no trips found")) return null;
  if (m.includes("cant be found") || m.includes("can't be found")) {
    return "This vehicle's trip history isn't set up yet. Contact support to have it added.";
  }
  if (m.includes("billing is blocked")) {
    return "Trip history is paused because tracking for this vehicle is blocked. Top up or contact support.";
  }
  return "Trip history could not be loaded. Check your connection and try again.";
}

/** The request body for one page of the window [from, to]. */
export function replayBody(imei: string, from: number, to: number, offset: number) {
  const f = new Date(from), t = new Date(to);
  return {
    data: {
      device_imei: imei,
      from_date: ddmmyyyy(f),
      to_date: ddmmyyyy(t),
      // A continuous span; the server pads to_time to its last second.
      from_time: hm(f),
      to_time: hm(t),
      offset_log: String(offset),
      record_count: String(PAGE_SIZE),
      // Every fix, not one per spot: otherwise an hour parked is a single fix
      // that playback cannot show in time.
      dedupe: "false",
    },
  };
}

class HistoryError extends Error {}

/** One page, newest first. "No Trips Found" is an empty page. */
async function page(post: PostFn, imei: string, from: number, to: number, offset: number): Promise<unknown[]> {
  const res = await post(replayBody(imei, from, to, offset));
  if (res?.status !== "success") {
    const msg = res?.message || "";
    if (msg.toLowerCase().includes("no trips found")) return [];
    throw new HistoryError(msg);
  }
  const data = res.data;
  // Flat list; a proxy that nests it under raw_data is read too.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = Array.isArray(data) ? data : Array.isArray((data as any)?.raw_data) ? (data as any).raw_data : [];
  return list.filter((x: unknown) => x && typeof x === "object");
}

/**
 * The history for the window [from, to] (epoch ms, local); `to` includes its
 * whole minute. Every page is read, up to MAX_POINTS; `onPage` hears how many
 * pages have arrived, for a progress line.
 */
export async function loadRange(
  post: PostFn, imei: string, from: number, to: number, onPage?: (pages: number) => void,
): Promise<TripData> {
  if (to < from) [from, to] = [to, from];
  const until = Math.floor(to / 60_000) * 60_000 + 59_000;
  if (until - from > MAX_DAYS * 86_400_000) {
    return emptyTrip(`Pick a window of ${MAX_DAYS} days or less to play back a trip.`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any[] = []; // newest first, as served
  let shortened = false;
  let notice: string | null = null;
  try {
    for (;;) {
      const batch = await page(post, imei, from, to, raw.length);
      raw.push(...batch);
      onPage?.(Math.ceil(raw.length / PAGE_SIZE) || 1);
      if (batch.length < PAGE_SIZE) break;
      if (raw.length >= MAX_POINTS) { shortened = true; break; }
    }
  } catch (e) {
    const msg = e instanceof HistoryError ? e.message : "";
    if (!raw.length) return emptyTrip(unavailableReason(msg));
    notice = "Part of this trip could not be loaded, so its start may be missing. Try again, or pick a shorter window.";
  }

  // Oldest first, without the fixes a page boundary repeats: a unit still
  // driving adds fixes between requests, shifting the pages by one.
  const points: TripPoint[] = [];
  const seen = new Set<string>();
  for (let i = raw.length - 1; i >= 0; i--) {
    const p = pointFrom(raw[i]);
    if (p.lat === 0 && p.lng === 0) continue;
    // The server filters the window; this guards a fix it lets through.
    if (p.time != null && (p.time < from || p.time > until)) continue;
    const key = `${raw[i].data_idx}|${p.time}|${p.lat}|${p.lng}`;
    if (seen.has(key)) continue;
    seen.add(key);
    points.push(p);
  }
  if (!points.length) return emptyTrip();

  if (shortened) {
    const first = points[0].time;
    notice = first == null
      ? "This trip is long, so its start is not shown. Pick a shorter window to see it."
      : `This trip is long, so it is shown from ${hhmm(first)} on ${monthDay(first)}. Pick a shorter window to see the start.`;
  }
  return summarize(points, notice);
}

/** How long the engine ran in each stop (local times), in order: null for a
 *  stop with no ignition reading. Null when the unit has no ignition input
 *  or the server could not be asked — engine time is extra. */
export async function loadEngineTimes(
  post: PostFn, imei: string, spans: { from: number; to: number }[],
): Promise<(number | null)[] | null> {
  if (!spans.length) return [];
  try {
    const res = await post({
      data: {
        device_imei: imei,
        spans: spans.slice(0, MAX_ENGINE_SPANS).map((s) => ({ from: localStamp(s.from), to: localStamp(s.to) })),
      },
    });
    if (res?.status !== "success") return null;
    return parseEngineTimes(res.data, spans.length);
  } catch {
    return null;
  }
}

/** The engine-time answer as one entry (ms) per span asked about; null when
 *  the unit has no ignition input or the answer is unreadable. */
export function parseEngineTimes(data: unknown, asked: number): (number | null)[] | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  if (!d || typeof d !== "object" || d.ignition !== "configured" || !Array.isArray(d.spans)) return null;
  return Array.from({ length: asked }, (_, i) => {
    const secs = d.spans[i]?.engine_on_seconds;
    return typeof secs === "number" ? Math.round(secs) * 1000 : null;
  });
}
