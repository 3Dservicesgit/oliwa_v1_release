/**
 * GatehousePage.tsx  (/gatehouse)
 * Track Playback — Historical Trip Replay
 *
 * Layout:
 *   ┌─────────────────┬──────────────────────────────────┐
 *   │  Controls        │  Google Map                      │
 *   │  • Device picker │  • Route polyline                │
 *   │  • Date range    │  • Start/end markers             │
 *   │  • Load button   │  • Replay animation              │
 *   │                  │                                  │
 *   │  Trip List       │                                  │
 *   │  • trip cards    │                                  │
 *   │  • start/end     │                                  │
 *   │  • distance      │                                  │
 *   │  • duration      ├──────────────────────────────────┤
 *   │                  │  Position Detail (bottom strip)  │
 *   └─────────────────┴──────────────────────────────────┘
 *
 * Security: devices scoped to customer's account_root from cookies.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { getCookie }          from "../../utils/cookies";
import { getStoredAuthToken } from "../../api/client";
import { ENDPOINTS }          from "../../api/endpoints";
import type { TripSummary, PositionRecord } from "../../api";

// ─── Config ──────────────────────────────────────────────────────────────────
const FLEET_API = (import.meta.env.VITE_FLEET_API_URL as string) ?? "https://narvas.3dservices.co.ug";
const GMAPS_KEY = "AIzaSyCxsn8cnwrKUpbgO6Pn_Gdk2-T5HkJRmLY";

const DEFAULT_CENTER = { lat: 1.3733, lng: 32.2903 };

// ─── Types ───────────────────────────────────────────────────────────────────
interface DeviceOption {
  imei: string;
  name: string;
  car_make: string;
  car_model: string;
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

/** Format date as DD-MM-YYYY for backend. */
function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

/** Format date as YYYY-MM-DD for <input type="date">. */
function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parse YYYY-MM-DD from input. */
function parseInputDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Duration string from two time strings "HH:MM:SS". */
function durationStr(start: string, end: string): string {
  const toSec = (t: string) => {
    const p = t.split(":").map(Number);
    return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0);
  };
  let diff = toSec(end) - toSec(start);
  if (diff < 0) diff += 86400;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TripCard({ trip, index, selected, onClick }: {
  trip: TripSummary; index: number; selected: boolean; onClick: () => void;
}) {
  const startLoc = trip.start_point_dta?.geocoded_location || "—";
  const endLoc   = trip.end_point_dta?.geocoded_location   || "—";
  const startTime = trip.start_point_dta?.local_system_timestamp || trip.start_time || "";
  const endTime   = trip.end_point_dta?.local_system_timestamp   || trip.end_time || "";
  const dur = startTime && endTime ? durationStr(startTime, endTime) : "—";

  return (
    <button
      onClick={onClick}
      className={[
        "w-full text-left px-3 py-3 border-b border-[#E9EDEF] transition-all cursor-pointer",
        selected
          ? "bg-[#E7F7EF] border-l-[3px] border-l-[#128C7E]"
          : "bg-white hover:bg-[#F8F9FA] border-l-[3px] border-l-transparent",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-black text-[#128C7E]">Trip {index + 1}</span>
        <span className="text-[10px] font-bold text-[#667781] bg-[#F0F2F5] px-1.5 py-0.5 rounded">
          {trip.mileage_passed} km
        </span>
      </div>

      {/* Timeline */}
      <div className="flex gap-2">
        {/* Dots + line */}
        <div className="flex flex-col items-center pt-0.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#25D366] shrink-0" />
          <span className="w-[2px] flex-1 bg-[#E9EDEF] my-0.5" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#C62828] shrink-0" />
        </div>

        {/* Locations */}
        <div className="flex-1 min-w-0">
          <div className="mb-2">
            <div className="text-[10px] text-[#667781] font-bold">START · {startTime.slice(0, 5)}</div>
            <div className="text-[11px] text-[#111B21] truncate" title={startLoc}>{startLoc}</div>
          </div>
          <div>
            <div className="text-[10px] text-[#667781] font-bold">END · {endTime.slice(0, 5)}</div>
            <div className="text-[11px] text-[#111B21] truncate" title={endLoc}>{endLoc}</div>
          </div>
        </div>
      </div>

      {/* Footer stats */}
      <div className="flex items-center gap-3 mt-2 text-[10px] text-[#667781]">
        <span>Duration: <b className="text-[#111B21]">{dur}</b></span>
        <span>Distance: <b className="text-[#111B21]">{trip.mileage_passed} km</b></span>
      </div>
    </button>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function GatehousePage() {
  // ── Device list ────────────────────────────────────────────────────────
  const [devices, setDevices]       = useState<DeviceOption[]>([]);
  const [devLoading, setDevLoading] = useState(true);
  const [selImei, setSelImei]       = useState("");
  const [deviceSearch, setDeviceSearch] = useState("");

  // ── Date range ─────────────────────────────────────────────────────────
  const today = new Date();
  const [fromDate, setFromDate] = useState(toInputDate(today));
  const [toDate, setToDate]     = useState(toInputDate(today));

  // ── Trip data ──────────────────────────────────────────────────────────
  const [rawData, setRawData]         = useState<PositionRecord[]>([]);
  const [trips, setTrips]             = useState<TripSummary[]>([]);
  const [tripLoading, setTripLoading] = useState(false);
  const [tripError, setTripError]     = useState<string | null>(null);
  const [selTripIdx, setSelTripIdx]   = useState<number | null>(null);

  // ── Replay ─────────────────────────────────────────────────────────────
  const [playing, setPlaying]           = useState(false);
  const [replayIdx, setReplayIdx]       = useState(0);
  const [replaySpeed, setReplaySpeed]   = useState(1);    // 1x, 2x, 4x
  const replayTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Map refs ───────────────────────────────────────────────────────────
  const mapDivRef   = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gMap        = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polyRef     = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startMarker = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const endMarker   = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const carMarker   = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infoWin     = useRef<any>(null);

  // ── Derived ────────────────────────────────────────────────────────────
  const filteredDevices = devices.filter((d) => {
    if (!deviceSearch.trim()) return true;
    const q = deviceSearch.toLowerCase();
    return d.name.toLowerCase().includes(q) || d.imei.toLowerCase().includes(q);
  });

  // Points for the current view (selected trip or all data)
  const activePoints: PositionRecord[] = (() => {
    if (selTripIdx !== null && trips[selTripIdx]) {
      const t = trips[selTripIdx];
      const startIdx = t.start_point_dta?.data_idx;
      const endIdx   = t.end_point_dta?.data_idx;
      if (startIdx != null && endIdx != null) {
        return rawData.filter((r) => r.data_idx <= startIdx && r.data_idx >= endIdx);
      }
    }
    return rawData;
  })();

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
      console.log("[TrackPlayback] loadDevices — dataLevel:", dataLevel, "accountUid:", accountUid);
      try {
        // 15-second timeout so a hanging backend doesn't freeze the UI
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Device fetch timed out after 15 seconds")), 15000),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resp = await Promise.race([
          fleetFetch("POST", ENDPOINTS.FLEET.LIST_UNITS, {
            data: { data_level: dataLevel, account_uid: accountUid },
          }),
          timeout,
        ]) as any;
        console.log("[TrackPlayback] fleetFetch response status:", resp?.status, "data count:", Array.isArray(resp?.data) ? resp.data.length : "not-array");
        if (resp?.status === "success" && Array.isArray(resp.data)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const devs: DeviceOption[] = resp.data.map((u: any) => ({
            imei:      u.device_imei || "",
            name:      u.device_name || u.device_imei || "",
            car_make:  u.car_make || "",
            car_model: u.car_model || "",
          })).filter((d: DeviceOption) => d.imei);
          setDevices(devs);
          if (devs.length === 1) setSelImei(devs[0].imei);
        }
      } catch (err) { console.error("[TrackPlayback] device fetch failed:", err); }
      setDevLoading(false);
    })();
  }, []);

  // ── Draw route on map ──────────────────────────────────────────────────
  const drawRoute = useCallback((points: PositionRecord[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G = (window as any).google?.maps;
    const map = gMap.current;
    if (!G || !map) return;

    // Clear previous
    if (polyRef.current) polyRef.current.setMap(null);
    if (startMarker.current) startMarker.current.setMap(null);
    if (endMarker.current) endMarker.current.setMap(null);
    if (carMarker.current) carMarker.current.setMap(null);

    if (!points.length) return;

    // Build path (reversed since backend returns newest first)
    const path = [...points].reverse().map((p) => ({
      lat: parseFloat(p.data_latitude),
      lng: parseFloat(p.data_longitude),
    })).filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));

    if (!path.length) return;

    // Polyline
    polyRef.current = new G.Polyline({
      path,
      geodesic: true,
      strokeColor: "#128C7E",
      strokeOpacity: 0.9,
      strokeWeight: 4,
      map,
    });

    // Start marker (green)
    startMarker.current = new G.Marker({
      position: path[0],
      map,
      title: "Start",
      icon: {
        path: G.SymbolPath.CIRCLE,
        fillColor: "#25D366",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2,
        scale: 8,
      },
    });

    // End marker (red)
    if (path.length > 1) {
      endMarker.current = new G.Marker({
        position: path[path.length - 1],
        map,
        title: "End",
        icon: {
          path: G.SymbolPath.CIRCLE,
          fillColor: "#C62828",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
          scale: 8,
        },
      });
    }

    // Fit bounds
    const bounds = new G.LatLngBounds();
    path.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
  }, []);

  // Redraw when active points change
  useEffect(() => {
    drawRoute(activePoints);
    setReplayIdx(0);
    stopReplay();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selTripIdx, rawData]);

  // ── Load trips ─────────────────────────────────────────────────────────
  async function loadTrips() {
    if (!selImei) return;
    setTripLoading(true);
    setTripError(null);
    setTrips([]);
    setRawData([]);
    setSelTripIdx(null);
    stopReplay();

    try {
      const from = parseInputDate(fromDate);
      const to   = parseInputDate(toDate);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp = await fleetFetch("POST", ENDPOINTS.TRACKING.TRIPS_REPLAY, {
        data: {
          device_imei:  selImei,
          from_date:    fmtDate(from),
          to_date:      fmtDate(to),
          offset_log:   0,
          record_count: 10000,
        },
      }) as any;
      console.log("[TrackPlayback] trips/history/replay full response:", JSON.stringify(resp));

      if (resp?.status === "success" && Array.isArray(resp.data)) {
        // Map replay response fields to PositionRecord shape
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rd: PositionRecord[] = resp.data.map((p: any) => ({
          data_longitude:          p.data_longitude,
          data_latitude:           p.data_latitude,
          speed_log:               p.speed_log,
          data_hdop:               p.data_hdop,
          local_system_datestamp:   p.local_system_datestamp,
          record_io_events_uid:    p.record_io_events_uid,
          geocoded_location:       p.geocoded_location,
          local_system_timestamp:  p.local_system_timestamp,
          data_connected_satelites: p.data_connected_satelites,
          batch_uid:               p.batch_uid,
          data_idx:                p.data_idx,
          data_index:              p.data_index,
        }));
        setRawData(rd);
        setTrips([]);  // replay endpoint doesn't return grouped trips
        drawRoute(rd);
        if (rd.length === 0) {
          setTripError("No trips found for this date range.");
        }
      } else {
        setTripError(resp?.message || "No trips found for this date range.");
      }
    } catch {
      setTripError("Failed to load trip data. Please try again.");
    }
    setTripLoading(false);
  }

  // ── Replay controls ────────────────────────────────────────────────────
  function startReplay() {
    const points = [...activePoints].reverse();
    if (points.length < 2) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G = (window as any).google?.maps;
    const map = gMap.current;
    if (!G || !map) return;

    setPlaying(true);
    let idx = replayIdx;

    // Create or reposition car marker
    const pos = {
      lat: parseFloat(points[idx]?.data_latitude),
      lng: parseFloat(points[idx]?.data_longitude),
    };

    if (!carMarker.current) {
      carMarker.current = new G.Marker({
        position: pos,
        map,
        title: "Vehicle",
        icon: { url: "https://santripe.com/static/moving.png", scaledSize: new G.Size(36, 36), anchor: new G.Point(18, 18) },
        zIndex: 999,
      });
    } else {
      carMarker.current.setPosition(pos);
      carMarker.current.setMap(map);
    }

    const interval = Math.max(50, 300 / replaySpeed);
    replayTimer.current = setInterval(() => {
      idx++;
      if (idx >= points.length) {
        stopReplay();
        setReplayIdx(points.length - 1);
        return;
      }
      setReplayIdx(idx);
      const p = {
        lat: parseFloat(points[idx].data_latitude),
        lng: parseFloat(points[idx].data_longitude),
      };
      if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
        carMarker.current.setPosition(p);
        map.panTo(p);
      }
    }, interval);
  }

  function toggleReplay() {
    if (playing) { stopReplay(); return; }
    const pts = [...activePoints].reverse();
    if (replayIdx >= pts.length - 1) setReplayIdx(0);
    startReplay();
  }

  // Cleanup on unmount
  useEffect(() => () => stopReplay(), [stopReplay]);

  // Current replay point info
  const replayPoints = [...activePoints].reverse();
  const currentPoint = replayPoints[replayIdx] || null;

  // ── Quick stats for loaded data ────────────────────────────────────────
  const totalDistance = trips.reduce((s, t) => s + (t.mileage_passed || 0), 0);
  const totalPoints  = rawData.length;
  const selectedDevice = devices.find((d) => d.imei === selImei);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-[#F0F2F5]">

      {/* Header */}
      <div className="shrink-0 px-5 pt-4 pb-3">
        <div className="text-[10px] text-[#667781] mb-0.5">Home &rsaquo; Track Report</div>
        <h1 className="text-[20px] font-black text-[#111B21] m-0 leading-tight">Track Playback</h1>
        <p className="text-[12px] text-[#667781] m-0 mt-0.5">
          View historical routes, replay trips, and analyze past journeys for any device.
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 grid xl:grid-cols-[340px_1fr] gap-3 px-5 pb-5 overflow-hidden">

        {/* ══ Left: Controls + Trip List ══════════════════════════════════ */}
        <div className="min-h-0 flex flex-col gap-3 overflow-hidden">

          {/* Controls card */}
          <div className="shrink-0 bg-white border border-[#E9EDEF] rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 border-b border-[#E9EDEF]">
              <div className="font-black text-[14px] text-[#111B21]">Select Device & Date</div>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {/* Device picker */}
              <div>
                <label className="text-[11px] font-bold text-[#667781] block mb-1">Device</label>
                {devLoading ? (
                  <div className="h-9 rounded-lg border border-[#E9EDEF] bg-[#F8F9FA] flex items-center px-3 text-[12px] text-[#667781]">Loading devices…</div>
                ) : (
                  <>
                    {devices.length > 5 && (
                      <input
                        type="search"
                        value={deviceSearch}
                        onChange={(e) => setDeviceSearch(e.target.value)}
                        placeholder="Filter devices…"
                        className="w-full h-8 rounded-lg border border-[#E9EDEF] px-3 text-[11px] text-[#111B21]
                          placeholder:text-[#667781] bg-[#F8F9FA] outline-none focus:border-[#128C7E] transition-colors mb-1.5"
                      />
                    )}
                    <select
                      value={selImei}
                      onChange={(e) => setSelImei(e.target.value)}
                      className="w-full h-9 rounded-lg border border-[#E9EDEF] px-3 text-[12px]
                        text-[#111B21] outline-none focus:border-[#128C7E] bg-[#F8F9FA] cursor-pointer"
                    >
                      <option value="">— Select a device —</option>
                      {filteredDevices.map((d) => (
                        <option key={d.imei} value={d.imei}>
                          {d.name} ({d.imei.slice(-6)})
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-[#667781] block mb-1">From</label>
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                    className="w-full h-9 rounded-lg border border-[#E9EDEF] px-3 text-[12px]
                      text-[#111B21] outline-none focus:border-[#128C7E] bg-[#F8F9FA]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#667781] block mb-1">To</label>
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                    className="w-full h-9 rounded-lg border border-[#E9EDEF] px-3 text-[12px]
                      text-[#111B21] outline-none focus:border-[#128C7E] bg-[#F8F9FA]" />
                </div>
              </div>

              {/* Load button */}
              <button
                onClick={loadTrips}
                disabled={!selImei || tripLoading}
                className="h-10 rounded-lg bg-[#128C7E] text-white text-[13px] font-extrabold
                  border-none cursor-pointer hover:brightness-110 active:opacity-85
                  disabled:opacity-50 disabled:cursor-not-allowed transition-all
                  flex items-center justify-center gap-2"
              >
                {tripLoading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Loading…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    Load Track History
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick stats strip */}
          {rawData.length > 0 && (
            <div className="shrink-0 grid grid-cols-3 gap-2">
              {[
                { label: "Trips", value: String(trips.length) },
                { label: "Distance", value: `${totalDistance} km` },
                { label: "Points", value: totalPoints.toLocaleString() },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-[#E9EDEF] rounded-lg px-3 py-2 text-center">
                  <div className="text-[14px] font-black text-[#128C7E]">{s.value}</div>
                  <div className="text-[10px] text-[#667781] font-bold">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Trip list */}
          <div className="flex-1 min-h-0 bg-white border border-[#E9EDEF] rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="shrink-0 px-4 py-2.5 border-b border-[#E9EDEF] flex items-center justify-between">
              <div className="font-black text-[13px] text-[#111B21]">
                Trips {trips.length > 0 && <span className="text-[#667781] font-normal">({trips.length})</span>}
              </div>
              {selTripIdx !== null && (
                <button onClick={() => setSelTripIdx(null)}
                  className="text-[10px] font-bold text-[#128C7E] bg-[#E7F7EF] px-2 py-0.5 rounded cursor-pointer border-none hover:bg-[#D0F0E0] transition-colors">
                  Show All
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              {tripLoading && (
                <div className="px-4 py-8 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-[#E9EDEF] border-t-[#128C7E] rounded-full animate-spin" />
                  <div className="text-[12px] text-[#667781] mt-2">Loading trip data…</div>
                </div>
              )}
              {tripError && !tripLoading && (
                <div className="px-4 py-6 text-center text-[12px] text-[#667781]">{tripError}</div>
              )}
              {!tripLoading && !tripError && trips.length === 0 && rawData.length === 0 && (
                <div className="px-4 py-8 text-center text-[12px] text-[#667781]">
                  Select a device and date range, then click <b>Load Track History</b>.
                </div>
              )}
              {!tripLoading && trips.length === 0 && rawData.length > 0 && (
                <div className="px-4 py-6 text-center text-[12px] text-[#667781]">
                  {rawData.length} position records found but no distinct trips detected.
                  The route is shown on the map.
                </div>
              )}
              {trips.map((t, i) => (
                <TripCard
                  key={t.trip_number}
                  trip={t}
                  index={i}
                  selected={selTripIdx === i}
                  onClick={() => setSelTripIdx(selTripIdx === i ? null : i)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ══ Right: Map + Replay Controls + Detail ═══════════════════════ */}
        <div className="min-h-0 flex flex-col gap-3 overflow-hidden">

          {/* Map */}
          <div className="flex-1 min-h-0 bg-white border border-[#E9EDEF] rounded-xl overflow-hidden shadow-sm flex flex-col">
            {/* Map header with replay controls */}
            <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[#E9EDEF]">
              <div className="flex items-center gap-2">
                <span className="font-black text-[14px] text-[#111B21]">Route Map</span>
                {selectedDevice && (
                  <span className="text-[11px] text-[#667781]">{selectedDevice.name}</span>
                )}
              </div>

              {/* Replay controls */}
              {activePoints.length >= 2 && (
                <div className="flex items-center gap-2">
                  {/* Speed selector */}
                  <div className="flex items-center gap-1 bg-[#F0F2F5] rounded-lg p-0.5">
                    {[1, 2, 4].map((s) => (
                      <button key={s} onClick={() => setReplaySpeed(s)}
                        className={[
                          "px-2 py-0.5 rounded text-[10px] font-extrabold border-none cursor-pointer transition-all",
                          replaySpeed === s
                            ? "bg-[#128C7E] text-white"
                            : "bg-transparent text-[#667781] hover:text-[#111B21]",
                        ].join(" ")}
                      >{s}x</button>
                    ))}
                  </div>

                  {/* Play/pause */}
                  <button onClick={toggleReplay}
                    className="h-8 px-3 rounded-lg bg-[#128C7E] text-white text-[11px] font-extrabold
                      border-none cursor-pointer hover:brightness-110 transition-all flex items-center gap-1.5"
                  >
                    {playing ? (
                      <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause</>
                    ) : (
                      <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Replay</>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {activePoints.length >= 2 && (
              <div className="shrink-0 h-1.5 bg-[#E9EDEF]">
                <div className="h-full bg-[#128C7E] transition-all duration-200"
                  style={{ width: `${(replayIdx / Math.max(1, replayPoints.length - 1)) * 100}%` }} />
              </div>
            )}

            <div ref={mapDivRef} className="flex-1 min-h-[300px] w-full" />
          </div>

          {/* Position detail strip */}
          {currentPoint && activePoints.length > 0 && (
            <div className="shrink-0 bg-white border border-[#E9EDEF] rounded-xl overflow-hidden shadow-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-px bg-[#E9EDEF]">
                {[
                  { label: "Speed", value: `${currentPoint.speed_log || 0} km/h` },
                  { label: "Location", value: currentPoint.geocoded_location || "—" },
                  { label: "Time", value: `${currentPoint.local_system_datestamp} ${currentPoint.local_system_timestamp}` },
                  { label: "Coordinates", value: `${parseFloat(currentPoint.data_latitude).toFixed(5)}, ${parseFloat(currentPoint.data_longitude).toFixed(5)}` },
                  { label: "Satellites", value: String(currentPoint.data_connected_satelites || "—") },
                  { label: "HDOP", value: currentPoint.data_hdop || "—" },
                ].map((item) => (
                  <div key={item.label} className="bg-white px-3 py-2.5">
                    <div className="text-[10px] text-[#667781] font-bold">{item.label}</div>
                    <div className="text-[12px] text-[#111B21] font-semibold mt-0.5 truncate" title={item.value}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
