/**
 * GatehousePage.tsx  (/gatehouse)
 * Track Playback — a vehicle's history day by day, as the OLIWA mobile app
 * shows it, and replay of a trip, the whole day, or any time range.
 *
 * Layout:
 *   ┌──────────────────────┬──────────────────────────────────┐
 *   │  Vehicle picker       │  Google Map                      │
 *   │  Day chips · Time     │  • the day's route               │
 *   │    range · calendar   │  • parkings (P), selected trip   │
 *   │  Day totals           │  • replay                        │
 *   │  Parked / trip        │                                  │
 *   │    timeline           ├──────────────────────────────────┤
 *   │                       │  Position detail (while playing) │
 *   └──────────────────────┴──────────────────────────────────┘
 *
 * The rules for stops, trips, distance and speed are the app's, ported in
 * ./trip (tests: tests/trip).
 *
 * Security: devices scoped to customer's account_root from cookies.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams }    from "react-router-dom";
import { getCookie }          from "../../utils/cookies";
import { getStoredAuthToken } from "../../api/client";
import { ENDPOINTS }          from "../../api/endpoints";
import { useAuth }            from "../../auth/AuthContext";
import { getGeozones }        from "../../api/services/geozones.service";
import { parseGeozonePoints } from "../../api/types/geozones.types";
import { generateReport, formatDateForApi } from "../../api/services/reports.service";
import { useCan }             from "../../auth/guards";
import {
  arrows, buildDayTimeline, cumulativeKm, dayLabel, distanceKm, endOfDay, headingAt, hhmm, isTrip,
  loadEngineTimes, loadRange, MAX_ENGINE_SPANS, MAX_POINTS, maxSpeedKmh, PAGE_SIZE, placeOf, pointsOf, span, SPEED_BANDS, speedRuns,
  startOfDay, stopCount, TripTimeline,
  type ApiReply, type DayTimeline, type NamedZone, type TripData, type TripPoint,
} from "./trip";
import { PlaybackPanel } from "./components/Playback";
import {
  CarIcon, DayStrip, DayTotals, PlayIcon, SegmentRow,
} from "./components/DayHistory";
import { C, dayTitle, inputDate, parkingDetail } from "./components/historyStyle";

// ─── Config ──────────────────────────────────────────────────────────────────
const FLEET_API = (import.meta.env.VITE_FLEET_API_URL as string) ?? "https://narvas.3dservices.co.ug";
const GMAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || "AIzaSyCxsn8cnwrKUpbgO6Pn_Gdk2-T5HkJRmLY";

const DEFAULT_CENTER = { lat: 1.3733, lng: 32.2903 };

/** The playback clock's tick. */
const TICK_MS = 100;

// ─── Types ───────────────────────────────────────────────────────────────────
interface DeviceOption {
  imei: string;
  name: string;
  car_make: string;
  car_model: string;
}

/** What is being replayed: one trip, the whole day, or a picked time range. */
interface Playback {
  title: string;
  points: TripPoint[];
  /** The points in time, as playback runs over them. */
  timeline: TripTimeline;
  notice: string | null;
  /** The day's row being played, highlighted in the list. */
  segment: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function fleetFetch(method: string, path: string, body?: unknown): Promise<unknown> {
  const token = getStoredAuthToken();
  const hdrs: Record<string, string> = { "Content-Type": "application/json" };
  if (token) hdrs["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${FLEET_API}${path}`, {
    method, headers: hdrs,
    body: body != null ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  return res.json();
}

/** The replay route, as the trip loader calls it. */
const postReplay = (body: unknown) => fleetFetch("POST", ENDPOINTS.TRACKING.TRIPS_REPLAY, body) as Promise<ApiReply>;

/** The engine-time route. Missing on a server without it (404): engine time
 *  is extra, so the stops show without it. */
const postEngineTime = (body: unknown) =>
  fleetFetch("POST", ENDPOINTS.TRACKING.TRIPS_ENGINE_TIME, body).catch(() => ({ status: "error" })) as Promise<ApiReply>;

/** "YYYY-MM-DD" + "HH:MM" → epoch ms, local time. */
function inputStamp(date: string, time: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh = 0, mi = 0] = (time || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mi).getTime();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GMap = any;

// ─── Page ────────────────────────────────────────────────────────────────────
export default function GatehousePage() {
  const { state: authState } = useAuth();
  const canReport = useCan("reports.view");
  // Opened from Live Monitoring or an alert: ?imei=…&date=YYYY-MM-DD.
  const [params] = useSearchParams();
  const wantedImei = params.get("imei") ?? "";
  const wantedDay = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(params.get("date") ?? "");
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : null;
  })();

  // ── Device list ────────────────────────────────────────────────────────
  const [devices, setDevices]       = useState<DeviceOption[]>([]);
  const [devLoading, setDevLoading] = useState(true);
  const [selImei, setSelImei]       = useState("");
  const [deviceSearch, setDeviceSearch] = useState("");

  // ── The day ────────────────────────────────────────────────────────────
  // Today, read when the page opens and again on each load (not during
  // render), so a page left open past midnight moves on.
  const [today, setToday]             = useState(() => startOfDay(Date.now()));
  const [day, setDay]                 = useState(() => (wantedDay != null && wantedDay <= today ? wantedDay : today));
  const [dayTrip, setDayTrip]         = useState<TripData | null>(null);
  const [timeline, setTimeline]       = useState<DayTimeline | null>(null);
  const [dayLoading, setDayLoading]   = useState(false);
  const [loadedPages, setLoadedPages] = useState(0);
  const [selected, setSelected]       = useState<number | null>(null);
  /** Engine-on time at each parking, by row; empty when the unit has no
   *  ignition input or the server can't say. */
  const [engine, setEngine]           = useState<Record<number, number | null>>({});
  // Bumped on every new load, so a slow one can't overwrite a newer one.
  const loadToken = useRef(0);

  // ── Geofences, to name where the vehicle was parked ────────────────────
  const [zones, setZones] = useState<NamedZone[]>([]);

  // ── Time range ─────────────────────────────────────────────────────────
  const [rangeOpen, setRangeOpen] = useState(false);
  const [fromDate, setFromDate] = useState(() => inputDate(today));
  const [toDate, setToDate]     = useState(() => inputDate(today));
  const [fromTime, setFromTime] = useState("00:00");
  const [toTime, setToTime]     = useState("23:59");
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError]     = useState<string | null>(null);

  // ── Trips report download ──────────────────────────────────────────────
  const [reportOpen, setReportOpen] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMsg, setReportMsg]   = useState<{ text: string; ok: boolean } | null>(null);

  // ── Replay ─────────────────────────────────────────────────────────────
  // Playback runs in time (TripTimeline): `t` is the moment shown. The clock
  // reads the refs, so a rate change applies on the next tick.
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [playing, setPlaying]   = useState(false);
  const [t, setT]               = useState(0);
  const tRef                    = useRef(0);
  const [rate, setRate]         = useState(TripTimeline.defaultRate);
  const rateRef                 = useRef(TripTimeline.defaultRate);
  // The map follows the vehicle while playing, until the customer moves it;
  // the Follow button brings it back.
  const [follow, setFollow]     = useState(true);
  const followRef               = useRef(true);
  const replayTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Map refs ───────────────────────────────────────────────────────────
  const mapDivRef  = useRef<HTMLDivElement>(null);
  const gMap       = useRef<GMap>(null);
  const [mapReady, setMapReady] = useState(false);
  const dayLayer   = useRef<GMap[]>([]);   // the day's line and parkings
  const selLayer   = useRef<GMap[]>([]);   // the selected trip
  const playLayer  = useRef<GMap[]>([]);   // the replayed route and arrows
  const vehicle    = useRef<GMap>(null);   // the vehicle, facing its way
  const infoWin    = useRef<GMap>(null);

  // ── Derived ────────────────────────────────────────────────────────────
  const filteredDevices = devices.filter((d) => {
    if (!deviceSearch.trim()) return true;
    const q = deviceSearch.toLowerCase();
    return d.name.toLowerCase().includes(q) || d.imei.toLowerCase().includes(q);
  });
  const selectedDevice = devices.find((d) => d.imei === selImei);

  /** Where each parking was, by row; recomputed when the zones arrive. */
  const places = useMemo(() => {
    if (!timeline) return [] as (string | null)[];
    return timeline.segments.map((s) => (isTrip(s) ? null : placeOf(timeline.points[s.from], zones)));
  }, [timeline, zones]);

  const playTimeline = playback?.timeline ?? null;
  const soFar = useMemo(() => (playTimeline ? cumulativeKm(playTimeline.points) : []), [playTimeline]);
  const playStats = useMemo(() => {
    const pts = playTimeline?.points ?? [];
    return { distanceKm: distanceKm(pts), maxSpeedKmh: maxSpeedKmh(pts), stops: stopCount(pts) };
  }, [playTimeline]);

  // ── Stop replay helper ─────────────────────────────────────────────────
  const stopReplay = useCallback(() => {
    if (replayTimer.current) clearInterval(replayTimer.current);
    replayTimer.current = null;
    setPlaying(false);
  }, []);

  // ── Map init ───────────────────────────────────────────────────────────
  useEffect(() => {
    const initMap = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const G = (window as any).google?.maps;
      if (!mapDivRef.current || gMap.current || !G) return;
      gMap.current = new G.Map(mapDivRef.current, {
        zoom: 7, center: DEFAULT_CENTER, mapTypeId: "roadmap",
        gestureHandling: "greedy", zoomControl: true, fullscreenControl: true,
        streetViewControl: false, mapTypeControl: true,
      });
      infoWin.current = new G.InfoWindow({ maxWidth: 280 });
      gMap.current.addListener("dragstart", () => { followRef.current = false; setFollow(false); });
      setMapReady(true);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.maps) {
      initMap();
    } else if (!document.getElementById("gmaps-gatehouse")) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__gatehouseMapInit = initMap;
      const s = Object.assign(document.createElement("script"), {
        id: "gmaps-gatehouse",
        src: `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&callback=__gatehouseMapInit&loading=async`,
        async: true, defer: true,
      });
      document.head.appendChild(s);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__gatehouseMapInit = initMap;
    }
  }, []);

  // ── Load devices ───────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const rawUid = getCookie("_nvxs_account_uid") ?? "";
      if (!rawUid) { console.warn("[TrackPlayback] No account UID cookie — skipping device fetch"); setDevLoading(false); return; }
      const cookieType = (getCookie("_nvxs_account_type") ?? "client").toLowerCase();
      // Backend recognises "client", "inhouse", "service_provider" — map "customer" → "client"
      const dataLevel   = (cookieType === "customer" || cookieType === "client") ? "client" : cookieType;
      const accountUid  = (dataLevel === "client" || dataLevel === "inhouse")
        ? (getCookie("_nvxs_account_root") ?? rawUid) : rawUid;
      try {
        // 15-second timeout so a hanging backend doesn't freeze the UI
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Device fetch timed out after 15 seconds")), 15000),
        );
        const resp = await Promise.race([
          fleetFetch("POST", ENDPOINTS.FLEET.LIST_UNITS, {
            data: { data_level: dataLevel, account_uid: accountUid },
          }),
          timeout,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ]) as any;
        if (resp?.status === "success" && Array.isArray(resp.data)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const devs: DeviceOption[] = resp.data.map((u: any) => ({
            imei:      u.device_imei || "",
            name:      u.device_name || u.device_imei || "",
            car_make:  u.car_make || "",
            car_model: u.car_model || "",
          })).filter((d: DeviceOption) => d.imei);
          setDevices(devs);
          if (wantedImei && devs.some((d) => d.imei === wantedImei)) setSelImei(wantedImei);
          else if (devs.length === 1) setSelImei(devs[0].imei);
        }
      } catch (err) { console.error("[TrackPlayback] device fetch failed:", err); }
      setDevLoading(false);
    })();
  // The link's vehicle is read once, when the list arrives.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load geofences (naming is best-effort) ─────────────────────────────
  useEffect(() => {
    const owner = authState.accountRoot || getCookie("_nvxs_account_root") || getCookie("_nvxs_account_uid") || "";
    if (!owner) return;
    let cancelled = false;
    getGeozones(owner, "client")
      .then((res) => {
        if (cancelled) return;
        setZones((res.data ?? []).map((z) => ({ name: z.geozone_name, path: parseGeozonePoints(z.geozone_points) })));
      })
      .catch(() => { /* stops are named by place instead */ });
    return () => { cancelled = true; };
  }, [authState.accountRoot]);

  // ── Map helpers ────────────────────────────────────────────────────────
  const clearLayer = (layer: React.MutableRefObject<GMap[]>) => {
    layer.current.forEach((o) => o.setMap(null));
    layer.current = [];
  };

  /** Frame `points`; a parked vehicle's fixes fall on one spot, so zoom to it. */
  const fit = useCallback((points: TripPoint[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G = (window as any).google?.maps;
    const map = gMap.current;
    if (!G || !map || !points.length) return;
    let minLat = points[0].lat, maxLat = minLat, minLng = points[0].lng, maxLng = minLng;
    for (const p of points) {
      minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
    }
    if (points.length === 1 || (maxLat - minLat < 0.002 && maxLng - minLng < 0.002)) {
      map.setCenter({ lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 });
      map.setZoom(points.length === 1 ? 15 : 16);
      return;
    }
    map.fitBounds(new G.LatLngBounds({ lat: minLat, lng: minLng }, { lat: maxLat, lng: maxLng }),
      { top: 50, right: 50, bottom: 50, left: 50 });
  }, []);

  const line = (G: GMap, points: TripPoint[], color: string, weight: number, zIndex: number) =>
    new G.Polyline({
      path: points.map((p) => ({ lat: p.lat, lng: p.lng })),
      geodesic: true, strokeColor: color, strokeOpacity: 0.9, strokeWeight: weight, zIndex,
      map: gMap.current,
    });

  // ── Load the day ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!selImei) return;
    const token = ++loadToken.current;
    const mine = () => token === loadToken.current;
    stopReplay();
    setPlayback(null);
    setSelected(null);
    setEngine({});
    setDayTrip(null);
    setTimeline(null);
    setLoadedPages(0);
    setDayLoading(true);
    setToday(startOfDay(Date.now()));
    const lastMinute = new Date(day + 23 * 3_600_000 + 59 * 60_000).getTime();
    loadRange(postReplay, selImei, day, lastMinute, (pages) => { if (mine()) setLoadedPages(pages); })
      .then((trip) => {
        if (!mine()) return;
        setDayTrip(trip);
        const tl = buildDayTimeline(trip.points, { dayStart: day, dayEnd: endOfDay(day), now: Date.now() });
        setTimeline(tl);
        // Engine-on time for the day's stops, asked for once they are known.
        const stops = tl.segments.map((s, i) => (isTrip(s) ? -1 : i)).filter((i) => i >= 0).slice(0, MAX_ENGINE_SPANS);
        if (stops.length) {
          loadEngineTimes(postEngineTime, selImei, stops.map((i) => ({ from: tl.segments[i].start, to: tl.segments[i].end })))
            .then((times) => {
              if (!mine() || !times) return;
              setEngine(Object.fromEntries(stops.map((i, k) => [i, times[k]])));
            });
        }
      })
      .finally(() => { if (mine()) setDayLoading(false); });
  }, [selImei, day, stopReplay]);

  // ── Draw the day: its route and parkings ───────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G = (window as any).google?.maps;
    clearLayer(dayLayer);
    if (!G || !mapReady || !timeline || playback) return;
    const map = gMap.current;
    if (timeline.points.length >= 2) dayLayer.current.push(line(G, timeline.points, C.primary, 4, 1));
    timeline.segments.forEach((s, i) => {
      if (isTrip(s)) return;
      const p = timeline.points[s.from];
      const on = i === selected;
      const marker = new G.Marker({
        position: { lat: p.lat, lng: p.lng },
        map,
        title: `Parked ${span(s.end - s.start)}`,
        label: { text: "P", color: "#fff", fontSize: "11px", fontWeight: "800" },
        icon: {
          path: G.SymbolPath.CIRCLE, scale: on ? 11 : 9,
          fillColor: on ? C.warning : C.parked, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2,
        },
        zIndex: on ? 20 : 10,
      });
      marker.addListener("click", () => {
        setSelected(i);
        const name = parkingDetail(places[i], timeline, s);
        const when = s.openStart ? `until ${hhmm(s.end)}` : `${hhmm(s.start)} → ${s.ongoing ? "now" : hhmm(s.end)}`;
        const box = document.createElement("div");
        box.style.cssText = "font:12px system-ui;color:#111B21;padding:2px";
        const head = document.createElement("b");
        head.textContent = `Parked ${span(s.end - s.start)}`;
        const body = document.createElement("div");
        body.textContent = `${when} · ${name}`;
        box.append(head, body);
        infoWin.current?.setContent(box);
        infoWin.current?.open({ map, anchor: marker });
      });
      dayLayer.current.push(marker);
    });
  }, [timeline, selected, playback, places, mapReady]);

  // Frame the whole day when it arrives.
  useEffect(() => {
    if (mapReady && timeline && !playback) fit(timeline.points);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline, mapReady]);

  // The selected trip, drawn over the day's line.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G = (window as any).google?.maps;
    clearLayer(selLayer);
    if (!G || !mapReady || !timeline || playback || selected == null) return;
    const s = timeline.segments[selected];
    if (s && isTrip(s)) selLayer.current.push(line(G, pointsOf(timeline, s), C.moving, 7, 5));
  }, [timeline, selected, playback, mapReady]);

  /** A row clicked: frame its trip, or zoom to where it was parked. */
  function selectRow(i: number) {
    if (!timeline) return;
    const s = timeline.segments[i];
    setSelected(i);
    infoWin.current?.close();
    if (isTrip(s)) fit(pointsOf(timeline, s));
    else fit([timeline.points[s.from]]);
  }

  // ── Replay ─────────────────────────────────────────────────────────────

  /** Draw what is being replayed, once per trip: the route coloured by speed
   *  over a dark edge (so pale slow stretches show), direction arrows, start
   *  and end, and the vehicle. */
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G = (window as any).google?.maps;
    clearLayer(playLayer);
    if (vehicle.current) { vehicle.current.setMap(null); vehicle.current = null; }
    if (!G || !mapReady || !playback) return;
    const map = gMap.current;
    const pts = playback.timeline.points;
    if (pts.length >= 2) {
      playLayer.current.push(new G.Polyline({
        path: pts.map((p) => ({ lat: p.lat, lng: p.lng })),
        strokeColor: "#111B21", strokeOpacity: 0.35, strokeWeight: 8, zIndex: 1, map,
      }));
      for (const run of speedRuns(pts)) {
        playLayer.current.push(line(G, pts.slice(run.from, run.to + 1), SPEED_BANDS[run.band].color, 5, 2));
      }
      for (const a of arrows(pts)) {
        playLayer.current.push(new G.Marker({
          position: { lat: pts[a.index].lat, lng: pts[a.index].lng }, map, clickable: false, zIndex: 3,
          icon: { path: G.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, rotation: a.heading,
            fillColor: "#111B21", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 1 },
        }));
      }
    }
    const end = (p: TripPoint, color: string, label: string) => new G.Marker({
      position: { lat: p.lat, lng: p.lng }, map, zIndex: 4,
      title: [label, placeOf(p, zones)].filter(Boolean).join(" · "),
      icon: { path: G.SymbolPath.CIRCLE, fillColor: color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2, scale: 8 },
    });
    if (pts.length) playLayer.current.push(end(pts[0], C.moving, `Start ${hhmm(pts[0].time)}`));
    if (pts.length > 1) playLayer.current.push(end(pts[pts.length - 1], "#C62828", `End ${hhmm(pts[pts.length - 1].time)}`));
    vehicle.current = new G.Marker({ map, zIndex: 10, title: "Vehicle" });
    fit(pts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback, mapReady]);

  // The vehicle at the moment shown, facing the way it was going (a dot when
  // it never moved far enough to have a heading); the camera follows it.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G = (window as any).google?.maps;
    const marker = vehicle.current;
    if (!G || !marker || !playTimeline) return;
    const p = playTimeline.positionAt(t);
    const heading = headingAt(playTimeline.points, playTimeline.indexAt(t));
    marker.setPosition({ lat: p.lat, lng: p.lng });
    marker.setIcon(heading == null
      ? { path: G.SymbolPath.CIRCLE, scale: 9, fillColor: C.primaryDark, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 }
      : { path: G.SymbolPath.FORWARD_CLOSED_ARROW, scale: 7, rotation: heading, anchor: new G.Point(0, 2.6),
          fillColor: C.primaryDark, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 });
    if (playing && followRef.current) gMap.current?.panTo({ lat: p.lat, lng: p.lng });
  }, [t, playTimeline, playing]);

  /** Move playback to a moment. */
  const setMoment = (v: number) => { tRef.current = v; setT(v); };

  function startClock(tl: TripTimeline) {
    if (replayTimer.current) clearInterval(replayTimer.current);
    if (tRef.current >= tl.end || tRef.current < tl.start) setMoment(tl.start);   // finished — start again
    setPlaying(true);
    replayTimer.current = setInterval(() => {
      const next = tl.advance(tRef.current, TICK_MS, rateRef.current);
      setMoment(next);
      if (next >= tl.end) stopReplay();
    }, TICK_MS);
  }

  function togglePlay() {
    if (!playTimeline) return;
    if (playing) stopReplay();
    else startClock(playTimeline);
  }

  /** The next or previous stop, playing on if it was playing. */
  function skip(forward: boolean) {
    if (!playTimeline) return;
    const next = forward ? playTimeline.nextStop(tRef.current) : playTimeline.previousStop(tRef.current);
    setMoment(next);
    if (followRef.current) {
      const p = playTimeline.positionAt(next);
      gMap.current?.panTo({ lat: p.lat, lng: p.lng });
    }
  }

  /** The speed chart dragged: pause there. */
  function scrub(fraction: number) {
    if (!playTimeline) return;
    stopReplay();
    const next = playTimeline.timeAt(fraction);
    setMoment(next);
    if (followRef.current) {
      const p = playTimeline.positionAt(next);
      gMap.current?.panTo({ lat: p.lat, lng: p.lng });
    }
  }

  function changeRate(r: number) { rateRef.current = r; setRate(r); }

  /** The Trips report for this vehicle over the dates shown (the day, or the
   *  playback's), as Reports builds it: PDF or Excel, download logged. */
  async function downloadTrips(format: "pdf" | "excel") {
    setReportOpen(false);
    if (!selImei) return;
    const from = playTimeline ? playTimeline.start : day;
    const to = playTimeline ? playTimeline.end : day;
    setReportBusy(true);
    setReportMsg(null);
    try {
      await generateReport("trips", format, {
        report_devices: [selImei],
        start_date: formatDateForApi(new Date(from)),
        end_date: formatDateForApi(new Date(to)),
        origin_user: authState.accountUid || getCookie("_nvxs_account_uid") || "",
      });
      setReportMsg({ text: `Trips report downloaded (${format === "pdf" ? "PDF" : "Excel"}).`, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setReportMsg({
        text: msg.startsWith("NO_DATA::") ? "No trips recorded for these dates." : "Could not build the trips report. Try again.",
        ok: false,
      });
    }
    setReportBusy(false);
  }

  function followVehicle() {
    followRef.current = true;
    setFollow(true);
    if (playTimeline) {
      const p = playTimeline.positionAt(tRef.current);
      gMap.current?.panTo({ lat: p.lat, lng: p.lng });
    }
  }

  function fitRoute() {
    followRef.current = false;
    setFollow(false);
    if (playTimeline) fit(playTimeline.points);
  }

  /** Open a trip, the day or a range for playback, and start it. */
  function play(next: Omit<Playback, "timeline">) {
    stopReplay();
    infoWin.current?.close();
    if (next.segment == null) setSelected(null);
    const tl = new TripTimeline(next.points);
    followRef.current = true;
    setFollow(true);
    setMoment(tl.start);
    setPlayback({ ...next, timeline: tl });
    if (tl.points.length >= 2) startClock(tl);
  }

  function playSegment(i: number) {
    if (!timeline) return;
    const s = timeline.segments[i];
    // The trip's own window, as the app plays it: its row's points begin at
    // the parking's last fix, which would open the trip parked.
    const points = timeline.points.filter((p) => p.time >= s.start && p.time <= s.end);
    play({ title: `Trip ${hhmm(s.start)} → ${hhmm(s.end)} · ${dayLabel(day)}`, points, notice: null, segment: i });
  }

  function playDay() {
    if (!timeline || timeline.points.length < 2) return;
    play({ title: `Whole day · ${dayLabel(day)}`, points: timeline.points, notice: dayTrip?.notice ?? null, segment: null });
  }

  function backToDay() {
    stopReplay();
    setPlayback(null);
    if (timeline) fit(timeline.points);
  }

  async function playRange() {
    if (!selImei) return;
    if (!fromDate || !toDate) { setRangeError("Choose a start and an end date."); return; }
    const from = inputStamp(fromDate, fromTime);
    const to = inputStamp(toDate, toTime || "23:59");
    if (from > to) { setRangeError("The end date and time must be after the start."); return; }
    setRangeLoading(true);
    setRangeError(null);
    const trip = await loadRange(postReplay, selImei, from, to);
    setRangeLoading(false);
    if (trip.unavailable) { setRangeError(trip.unavailable); return; }
    if (trip.points.length < 2) { setRangeError("Nothing recorded in this time range."); return; }
    const sameDay = fromDate === toDate;
    play({
      title: sameDay ? `${dayLabel(from)} · ${fromTime}–${toTime}` : `${dayLabel(from)} ${fromTime} → ${dayLabel(to)} ${toTime}`,
      points: trip.points, notice: trip.notice, segment: null,
    });
  }

  // Cleanup on unmount
  useEffect(() => () => stopReplay(), [stopReplay]);

  const hasDay = !!timeline && timeline.segments.length > 0;
  const truncatedPages = loadedPages * PAGE_SIZE >= MAX_POINTS;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 min-w-0 min-h-0 xl:h-full flex flex-col overflow-hidden bg-[#F0F2F5]">

      {/* Header */}
      <div className="shrink-0 px-5 pt-4 pb-3">
        <div className="text-[10px] text-[#667781] mb-0.5">Home &rsaquo; Track Report</div>
        <h1 className="text-[20px] font-black text-[#111B21] m-0 leading-tight">Track Playback</h1>
        <p className="text-[12px] text-[#667781] m-0 mt-0.5">
          Trips and stops by day, ready to replay — or replay any time range.
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 grid xl:grid-rows-[minmax(0,1fr)] xl:grid-cols-[400px_1fr] gap-3 px-5 pb-5 overflow-hidden">

        {/* ══ Left: vehicle, day, timeline ════════════════════════════════ */}
        <div className="min-h-0 flex flex-col gap-3 overflow-hidden">

          {/* Vehicle */}
          <div className="shrink-0 bg-white border border-[#E9EDEF] rounded-xl shadow-sm p-3">
            <label className="text-[11px] font-bold text-[#667781] block mb-1" htmlFor="tp-device">Vehicle</label>
            {devLoading ? (
              <div className="h-9 rounded-lg border border-[#E9EDEF] bg-[#F8F9FA] flex items-center px-3 text-[12px] text-[#667781]">Loading vehicles…</div>
            ) : (
              <>
                {devices.length > 5 && (
                  <input
                    type="search"
                    value={deviceSearch}
                    onChange={(e) => setDeviceSearch(e.target.value)}
                    placeholder="Filter vehicles…"
                    aria-label="Filter vehicles"
                    className="w-full h-8 rounded-lg border border-[#E9EDEF] px-3 text-[11px] text-[#111B21]
                      placeholder:text-[#667781] bg-[#F8F9FA] outline-none focus:border-[#128C7E] transition-colors mb-1.5"
                  />
                )}
                <select
                  id="tp-device"
                  value={selImei}
                  onChange={(e) => setSelImei(e.target.value)}
                  className="w-full h-9 rounded-lg border border-[#E9EDEF] px-3 text-[12px]
                    text-[#111B21] outline-none focus:border-[#128C7E] bg-[#F8F9FA] cursor-pointer"
                >
                  <option value="">— Select a vehicle —</option>
                  {filteredDevices.map((d) => (
                    <option key={d.imei} value={d.imei}>
                      {d.name} ({d.imei.slice(-6)})
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          {/* Day history */}
          <div className="flex-1 min-h-0 bg-white border border-[#E9EDEF] rounded-xl shadow-sm flex flex-col overflow-hidden">
            {/* Fixed at the top: the days and the Time range button. */}
            <div className="shrink-0 p-3 border-b border-[#E9EDEF]">
              <DayStrip
                day={day}
                today={today}
                onDay={(d) => { setRangeOpen(false); setDay(d); }}
                rangeOpen={rangeOpen}
                onRange={() => setRangeOpen((o) => !o)}
              />

              {rangeOpen && (
                <div className="mt-3 flex flex-col gap-2">
                  <div className="text-[12px] font-black text-[#111B21]">Play a time range</div>
                  {(["Start", "End"] as const).map((which) => {
                    const start = which === "Start";
                    return (
                      <div key={which}>
                        <label className="text-[11px] font-bold text-[#667781] block mb-1">{which}</label>
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <input type="date" aria-label={`${which} date`} value={start ? fromDate : toDate}
                            max={inputDate(today)}
                            onChange={(e) => (start ? setFromDate : setToDate)(e.target.value)}
                            className="w-full h-9 rounded-lg border border-[#E9EDEF] px-3 text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] bg-[#F8F9FA]" />
                          <input type="time" aria-label={`${which} time`} value={start ? fromTime : toTime}
                            onChange={(e) => (start ? setFromTime : setToTime)(e.target.value)}
                            className="w-[110px] h-9 rounded-lg border border-[#E9EDEF] px-2 text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] bg-[#F8F9FA]" />
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { label: "Whole day", apply: () => { setFromTime("00:00"); setToTime("23:59"); } },
                      { label: "Last hour", apply: () => {
                        const now = new Date(); const back = new Date(now.getTime() - 3600_000);
                        const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                        setFromDate(inputDate(back.getTime())); setFromTime(hm(back));
                        setToDate(inputDate(now.getTime())); setToTime(hm(now));
                      } },
                      { label: "Working hours", apply: () => { setFromTime("08:00"); setToTime("17:00"); } },
                    ].map((p) => (
                      <button key={p.label} type="button" onClick={p.apply}
                        className="h-6 px-2.5 rounded-full border border-[#E9EDEF] bg-white text-[10px] font-extrabold
                          text-[#667781] cursor-pointer hover:bg-[#F0F2F5]">
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {rangeError && <div className="text-[11px] text-[#B45309]">{rangeError}</div>}
                  <button type="button" onClick={playRange} disabled={!selImei || rangeLoading}
                    className="h-9 rounded-lg bg-[#128C7E] text-white text-[12px] font-extrabold border-none cursor-pointer
                      hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {rangeLoading
                      ? <><span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Loading…</>
                      : <><PlayIcon size={12} /> Play this range</>}
                  </button>
                </div>
              )}
            </div>

            {/* The day: totals, then parked / trip rows. */}
            <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              {!selImei && (
                <div className="px-4 py-8 text-center text-[12px] text-[#667781]">
                  Select a vehicle to see where it was parked and the trips it made each day.
                </div>
              )}
              {selImei && dayLoading && (
                <div className="px-4 py-8 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-[#E9EDEF] border-t-[#128C7E] rounded-full animate-spin" />
                  <div className="text-[12px] text-[#667781] mt-2">
                    Loading {dayTitle(day, today)}…{loadedPages > 1 ? ` page ${loadedPages}` : ""}
                    {truncatedPages ? ` (${MAX_POINTS.toLocaleString()} points)` : ""}
                  </div>
                </div>
              )}
              {selImei && !dayLoading && dayTrip && !hasDay && (
                <div className="flex items-start gap-3 px-4 py-6">
                  <span className="shrink-0 w-10 h-10 rounded-xl bg-[#E7F3F1] text-[#075E54] flex items-center justify-center"><CarIcon size={18} /></span>
                  <p className="m-0 text-[13px] text-[#667781]">
                    {dayTrip.unavailable ?? `Nothing recorded on ${dayLabel(day)}. The unit sent no positions that day.`}
                  </p>
                </div>
              )}
              {selImei && !dayLoading && hasDay && timeline && (
                <div className="pb-3">
                  <div className="p-3 pb-1"><DayTotals timeline={timeline} /></div>
                  {dayTrip?.notice && <p className="mx-4 my-1 text-[12px] text-[#B45309]">{dayTrip.notice}</p>}
                  <div className="mt-1">
                    {timeline.segments.map((s, i) => (
                      <SegmentRow
                        key={`${s.from}-${s.kind}`}
                        segment={s}
                        first={i === 0}
                        last={i === timeline.segments.length - 1}
                        selected={i === selected || (playback?.segment === i)}
                        place={isTrip(s) ? null : parkingDetail(places[i], timeline, s)}
                        engineMs={engine[i]}
                        onSelect={() => { if (playback) backToDay(); selectRow(i); }}
                        onPlay={() => playSegment(i)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══ Right: Map + Replay Controls + Detail ═══════════════════════ */}
        <div className="min-h-0 flex flex-col gap-3 overflow-hidden">

          {/* Map */}
          <div className="flex-1 min-h-0 bg-white border border-[#E9EDEF] rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#E9EDEF] min-h-[52px]">
              <div className="min-w-0">
                <div className="font-black text-[14px] text-[#111B21] truncate">
                  {selectedDevice ? selectedDevice.name : "Route Map"}
                </div>
                <div className="text-[11px] text-[#128C7E] font-bold truncate">
                  {playback ? playback.title : selImei ? `Trip history · ${dayTitle(day, today)}` : ""}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {canReport && selImei && (hasDay || playback) && (
                  <div className="relative">
                    <button onClick={() => setReportOpen((o) => !o)} disabled={reportBusy} aria-haspopup="menu" aria-expanded={reportOpen}
                      title="Download the Trips report for these dates"
                      className="h-8 px-3 rounded-lg bg-white border border-[#E9EDEF] text-[#075E54] text-[11px] font-extrabold cursor-pointer hover:bg-[#F8F9FA] disabled:opacity-50 flex items-center gap-1.5">
                      {reportBusy
                        ? <span className="inline-block w-3 h-3 border-2 border-[#128C7E]/30 border-t-[#128C7E] rounded-full animate-spin" />
                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>}
                      Trips report
                    </button>
                    {reportOpen && (
                      <div role="menu" className="absolute right-0 top-9 z-20 w-36 bg-white border border-[#E9EDEF] rounded-lg shadow-lg py-1">
                        {(["pdf", "excel"] as const).map((f) => (
                          <button key={f} role="menuitem" onClick={() => downloadTrips(f)}
                            className="w-full text-left px-3 py-2 text-[12px] font-semibold text-[#111B21] bg-transparent border-none cursor-pointer hover:bg-[#F0F2F5]">
                            {f === "pdf" ? "PDF" : "Excel"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {playback ? (
                  <>
                    {playing && !follow && (
                      <button onClick={followVehicle} title="Follow the vehicle again"
                        className="h-8 px-3 rounded-lg bg-[#128C7E] text-white text-[11px] font-extrabold border-none cursor-pointer hover:brightness-110">
                        Follow vehicle
                      </button>
                    )}
                    <button onClick={fitRoute}
                      className="h-8 px-3 rounded-lg bg-white border border-[#E9EDEF] text-[#075E54] text-[11px] font-extrabold cursor-pointer hover:bg-[#F8F9FA]">
                      Fit route
                    </button>
                    <button onClick={backToDay}
                      className="h-8 px-3 rounded-lg bg-white border border-[#E9EDEF] text-[#075E54] text-[11px] font-extrabold cursor-pointer hover:bg-[#F8F9FA]">
                      Back to the day
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setSelected(null); if (timeline) fit(timeline.points); }}
                      disabled={!hasDay}
                      className="h-8 px-3 rounded-lg bg-white border border-[#E9EDEF] text-[#075E54] text-[11px] font-extrabold cursor-pointer hover:bg-[#F8F9FA] disabled:opacity-40 disabled:cursor-not-allowed">
                      Show the whole day
                    </button>
                    <button onClick={playDay} disabled={!timeline || timeline.points.length < 2}
                      className="h-8 px-3 rounded-lg bg-[#25D366] text-[#053B33] text-[11px] font-extrabold border-none cursor-pointer hover:brightness-105 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                      <PlayIcon size={12} /> Play the whole day
                    </button>
                  </>
                )}
              </div>
            </div>

            {reportMsg && (
              <div role="status" className={`shrink-0 px-4 py-1.5 text-[11px] border-b flex items-center justify-between gap-2 ${
                reportMsg.ok ? "text-[#075E54] bg-[#E7F3F1] border-[#D8E8E4]" : "text-[#B45309] bg-[#FFFBEB] border-[#FDE68A]"}`}>
                {reportMsg.text}
                <button onClick={() => setReportMsg(null)} aria-label="Dismiss" className="bg-transparent border-none cursor-pointer text-current text-[14px] leading-none">×</button>
              </div>
            )}
            {playback?.notice && (
              <div className="shrink-0 px-4 py-1.5 text-[11px] text-[#B45309] bg-[#FFFBEB] border-b border-[#FDE68A]">{playback.notice}</div>
            )}

            <div ref={mapDivRef} className="flex-1 min-h-[300px] w-full" />
          </div>

          {/* Playback: figures, speed chart, readout, controls */}
          {playback && playTimeline && playTimeline.points.length >= 2 && (
            <div className="shrink-0 bg-white border border-[#E9EDEF] rounded-xl shadow-sm">
              <PlaybackPanel
                timeline={playTimeline}
                t={t}
                playing={playing}
                rate={rate}
                soFar={soFar}
                stats={playStats}
                zones={zones}
                onRate={changeRate}
                onToggle={togglePlay}
                onSkip={skip}
                onScrub={scrub}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
