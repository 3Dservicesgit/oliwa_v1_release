/**
 * NocBridgePage.tsx  (/noc-bridge)
 * Customer Live Monitoring — Real-time GPS Fleet Tracking
 *
 * Layout:
 *   ┌──────────────┬───────────────────────────────────┐
 *   │ Device List   │  Google Map + live SSE markers    │
 *   │ (sidebar)     │                                   │
 *   │               │                                   │
 *   │ search / chip │                                   │
 *   │ device cards  │                                   │
 *   │               │                                   │
 *   │               ├───────────────────────────────────┤
 *   │               │  Detail Panel (selected device)  │
 *   └──────────────┴───────────────────────────────────┘
 *
 * Security: scoped to customer's account_root from cookies.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { getCookie }          from "../../utils/cookies";
import { getStoredAuthToken } from "../../api/client";
import { ENDPOINTS }          from "../../api/endpoints";
import { getGeozones, getDeviceGeozones } from "../../api/services/geozones.service";
import { getClientDevices }   from "../../api/services/clients.service";
import { getEvents }          from "../../api/services/events.service";
import { logNotification }    from "../../api/services/notifications.service";
import { parseGeozonePoints } from "../../api/types/geozones.types";
import type { Geozone, DeviceEvent } from "../../api/types";
import { checkGeozoneTransitions } from "../../utils/geofenceUtils";
import type { Point }              from "../../utils/geofenceUtils";

// ─── Fleet env config ─────────────────────────────────────────────────────────
const FLEET_API = (import.meta.env.VITE_FLEET_API_URL as string) ?? "https://narvas.3dservices.co.ug";
const FLEET_SSE = (import.meta.env.VITE_FLEET_SSE_URL as string) ?? "https://narvasocket.3dservices.co.ug";
const GMAPS_KEY = "AIzaSyCxsn8cnwrKUpbgO6Pn_Gdk2-T5HkJRmLY";
const PAGE_SIZE = 30;

const ICONS: Record<string, string> = {
  moving:  "https://santripe.com/static/moving.png",
  parked:  "https://santripe.com/static/parked.png",
  idling:  "https://santripe.com/static/idiling.png",
  unknown: "https://santripe.com/static/unknown.png",
};

const DEFAULT_CENTER = { lat: 1.3733, lng: 32.2903 };

// InfoWindow CSS — strips Google's default padding/background
const IW_CSS = `
  .gm-style .gm-style-iw-c{
    padding:0!important;background:transparent!important;
    border-radius:12px!important;overflow:hidden!important;
    box-shadow:0 8px 32px rgba(0,0,0,0.28)!important;
    max-width:none!important;
  }
  .gm-style .gm-style-iw-d{
    overflow:hidden!important;padding:0!important;max-height:none!important;
  }
  .gm-style .gm-style-iw-t::after{ display:none!important; }
  .gm-style .gm-style-iw-chr{
    position:absolute!important;top:6px!important;right:6px!important;z-index:10!important;
  }
  .gm-style .gm-ui-hover-effect{
    background:rgba(255,255,255,0.2)!important;border-radius:50%!important;
    width:26px!important;height:26px!important;opacity:1!important;
  }
  .gm-style .gm-ui-hover-effect:hover{ background:rgba(255,255,255,0.35)!important; }
  .gm-style .gm-ui-hover-effect>span{ background-color:white!important; }
  .gm-style .gm-ui-hover-effect img{ filter:brightness(100)!important; }
`;

// ─── Types ────────────────────────────────────────────────────────────────────
type MotionStatus = "Moving" | "Parked" | "Idling" | "Offline";

interface VehicleUnit {
  imei:                string;
  name:                string;
  subscription_status: string;
  status:              MotionStatus;
  speed:               number;
  motion_state:        string;
  geocoded_location:   string;
  coords:              { lat: number; lng: number } | null;
  last_sync:           string;
  country:             string;
  // Extended fields from device metadata
  car_make:            string;
  car_model:           string;
  car_type:            string;
  hardware:            string;
  hardware_model:      string;
  simcard:             string;
  vin_number:          string;
  billing_status:      string;
  // IO data from SSE
  ignition:            string;
  mileage:             string;
  fuel_level:          string;
  satellites:          number;
  hdop:                string;
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const STATUS_META: Record<MotionStatus, { bg: string; dim: string; text: string; dot: string; badge: string; badgeText: string }> = {
  Moving:  { bg: "#2E7D32", dim: "rgba(46,125,50,0.88)",   text: "Moving",  dot: "#2E7D32", badge: "#E8F5E9", badgeText: "#2E7D32" },
  Parked:  { bg: "#C62828", dim: "rgba(198,40,40,0.88)",   text: "Parked",  dot: "#C62828", badge: "#FFEBEE", badgeText: "#C62828" },
  Idling:  { bg: "#1565C0", dim: "rgba(21,101,192,0.88)",  text: "Idling",  dot: "#1565C0", badge: "#E3F2FD", badgeText: "#1565C0" },
  Offline: { bg: "#455A64", dim: "rgba(69,90,100,0.85)",   text: "Offline", dot: "#607D8B", badge: "#F1F3F4", badgeText: "#607D8B" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function sseUrl(imei: string): string {
  return `${FLEET_SSE}/data-stream/${encodeURIComponent(imei)}/x-location`;
}

function normalizeStatus(ms: string, spd: number): MotionStatus {
  const s = ms.toLowerCase();
  if (s.includes("park") || s.includes("stop")) return "Parked";
  if (s.includes("idl")  || s === "idle")        return "Idling";
  if (s.includes("mov")  || s.includes("driv"))  return "Moving";
  if (Number.isFinite(spd) && spd >= 5)          return "Moving";
  if (Number.isFinite(spd) && spd > 0)           return "Idling";
  return "Offline";
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── InfoWindow HTML ─────────────────────────────────────────────────────────
const CAR_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="white">
  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3
    12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0
    1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5
    13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5
    1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
</svg>`;

function popupRow(label: string, value: string): string {
  return `<div style="display:flex;justify-content:space-between;align-items:center;
    padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
    <span style="font-size:12px;color:rgba(255,255,255,0.65);font-weight:500">${label}</span>
    <span style="font-size:12px;color:#fff;font-weight:700;
      max-width:160px;overflow:hidden;text-overflow:ellipsis;
      white-space:nowrap;text-align:right">${value}</span>
  </div>`;
}

function buildPopupHtml(u: VehicleUnit): string {
  const st = STATUS_META[u.status] ?? STATUS_META.Offline;
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
  width:280px;background:${st.bg};color:#fff;border-radius:12px;overflow:hidden;">
  <div style="padding:14px 40px 12px 14px;display:flex;align-items:flex-start;gap:11px;
    border-bottom:1px solid rgba(255,255,255,0.18);background:${st.dim};">
    <div style="width:40px;height:40px;border-radius:50%;flex-shrink:0;
      background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center">
      ${CAR_SVG}
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-size:14px;font-weight:800;color:#fff;line-height:1.25;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(u.name || u.imei)}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.6);margin-top:3px;
        font-family:monospace;letter-spacing:.5px">${esc(u.imei)}</div>
    </div>
  </div>
  <div style="padding:4px 14px 2px">
    ${popupRow("Speed", u.speed > 0 ? `${u.speed} km/h` : "0 km/h")}
    ${popupRow("Motion", esc(u.motion_state || u.status))}
    ${popupRow("Location", esc(u.geocoded_location || u.country || "—"))}
    ${popupRow("Last Sync", esc(u.last_sync || "—"))}
  </div>
  ${u.coords ? `<div style="padding:8px 14px 12px;text-align:right">
    <a href="https://www.google.com/maps?q=${u.coords.lat},${u.coords.lng}" target="_blank"
      rel="noopener noreferrer" style="font-size:11px;color:rgba(255,255,255,0.8);
      font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:3px;">
      Open in Google Maps
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
        stroke="rgba(255,255,255,0.8)" stroke-width="2.5" stroke-linecap="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    </a>
  </div>` : `<div style="padding-bottom:10px"></div>`}
</div>`;
}

function buildWaitingHtml(name: string): string {
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
  width:240px;background:${STATUS_META.Offline.bg};color:#fff;border-radius:12px;overflow:hidden;">
  <div style="padding:12px 40px 12px 14px;background:${STATUS_META.Offline.dim};
    border-bottom:1px solid rgba(255,255,255,0.18);
    display:flex;align-items:center;gap:11px">
    <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;
      background:rgba(255,255,255,0.18);
      display:flex;align-items:center;justify-content:center">${CAR_SVG}</div>
    <div style="font-size:13px;font-weight:800;color:#fff;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div>
  </div>
  <div style="padding:14px;display:flex;align-items:center;gap:10px">
    <style>@keyframes gw-spin{to{transform:rotate(360deg)}}.gw-s{animation:gw-spin 1s linear infinite;transform-origin:center}</style>
    <svg class="gw-s" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="rgba(255,255,255,0.8)" stroke-width="2.5" stroke-linecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83
               M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
    <span style="font-size:12px;color:rgba(255,255,255,0.8)">Waiting for live GPS fix…</span>
  </div>
</div>`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MotionStatus }) {
  const c = STATUS_META[status] ?? STATUS_META.Offline;
  return (
    <span className="shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded"
      style={{ background: c.badge, color: c.badgeText }}>{c.text}</span>
  );
}

/** KPI mini card at the top of sidebar */
function KpiChip({ label, value, active, onClick }: {
  label: string; value: number; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={[
        "flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-center transition-all cursor-pointer border",
        active
          ? "bg-[#128C7E] text-white border-[#128C7E]"
          : "bg-white text-[#111B21] border-[#E9EDEF] hover:border-[#128C7E]",
      ].join(" ")}
    >
      <span className="text-[16px] font-black leading-tight">{value}</span>
      <span className={`text-[10px] font-bold ${active ? "text-white/80" : "text-[#667781]"}`}>{label}</span>
    </button>
  );
}

/** Detail row in the right panel */
function DetailRow({ icon, label, value, mono }: {
  icon: string; label: string; value: string; mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#E9EDEF] last:border-b-0">
      <span className="w-5 h-5 rounded bg-[#F0F2F5] flex items-center justify-center text-[12px] shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-[#667781] font-bold uppercase tracking-wide">{label}</div>
        <div className={`text-[13px] text-[#111B21] font-semibold mt-0.5 break-words ${mono ? "font-mono text-[12px]" : ""}`}>
          {value || "—"}
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function NocBridgePage() {
  const [, forceUpdate]    = useState(0);
  const [loading, setLoading]         = useState(true);
  const [listError, setListError]     = useState<string | null>(null);
  const [searchQ, setSearchQ]         = useState("");
  const [page, setPage]               = useState(1);
  const [statusFilter, setStatusFilter] = useState<MotionStatus | "">("");
  const [selectedImei, setSelectedImei] = useState<string | null>(null);

  const mapDivRef    = useRef<HTMLDivElement>(null);
  const gMap         = useRef<unknown>(null);
  const infoWin      = useRef<unknown>(null);
  const markers      = useRef(new Map<string, unknown>());
  const sseConns     = useRef(new Map<string, EventSource>());
  const units        = useRef(new Map<string, VehicleUnit>());
  const pendingFocus = useRef<string | null>(null);
  const activePopup  = useRef<string | null>(null);

  // Geofence overlay state
  const [showGeofences, setShowGeofences] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geoPolygons = useRef<any[]>([]);

  // Geofence alerts
  interface GeoAlert { id: number; type: "enter" | "exit"; deviceName: string; zoneName: string; time: string; }
  const [geoAlerts, setGeoAlerts] = useState<GeoAlert[]>([]);
  const alertIdRef = useRef(0);
  const geozonePathsRef = useRef<{ uid: string; name: string; path: Point[] }[]>([]);
  // Per-device map of which geozones they're currently inside
  const deviceInsideRef = useRef(new Map<string, Map<string, boolean>>());
  // Event rules loaded from the backend (for notification matching)
  const eventRulesRef = useRef<DeviceEvent[]>([]);
  // Track which notifications we already logged to avoid duplicates per session
  const loggedNotifsRef = useRef(new Set<string>());

  // Geofence-attached device markers (shown on map when geofences are ON)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geoDeviceMarkers = useRef(new Map<string, any>());
  const geoDeviceSse = useRef(new Map<string, EventSource>());
  const geoDeviceNames = useRef(new Map<string, string>());

  // RAF tick — batches SSE updates into one render frame
  const rafRef = useRef<number | null>(null);
  const tick = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      forceUpdate((n) => n + 1);
    });
  }, []);

  // ── Filtered + paginated list ────────────────────────────────────────────
  const q        = searchQ.trim().toLowerCase();
  const allUnits = Array.from(units.current.values());
  const list     = allUnits.filter((u) => {
    const matchQ  = !q || u.name.toLowerCase().includes(q)
      || u.imei.toLowerCase().includes(q)
      || (u.geocoded_location || u.country || "").toLowerCase().includes(q);
    const matchSt = !statusFilter || u.status === statusFilter;
    return matchQ && matchSt;
  });

  const statusCounts = allUnits.reduce<Record<string, number>>((acc, u) => {
    acc[u.status] = (acc[u.status] ?? 0) + 1;
    return acc;
  }, {});

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pagedList  = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectedUnit = selectedImei ? units.current.get(selectedImei) ?? null : null;

  // ── Map helpers ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function ensureMarker(u: VehicleUnit): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G = (window as any).google?.maps;
    if (!gMap.current || !u.coords || !G) return null;
    if (String(u.subscription_status).toLowerCase() === "expired") {
      const m = markers.current.get(u.imei);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (m) { try { (m as any).setMap(null); } catch { /**/ } markers.current.delete(u.imei); }
      return null;
    }
    const iconKey = u.status === "Moving" ? "moving" : u.status === "Parked" ? "parked"
                  : u.status === "Idling" ? "idling" : "unknown";
    const icon = { url: ICONS[iconKey], scaledSize: new G.Size(32, 32), anchor: new G.Point(16, 16) };
    let m = markers.current.get(u.imei);
    if (!m) {
      m = new G.Marker({ position: u.coords, map: gMap.current, title: u.name || u.imei, icon });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m as any).addListener("click", () => openPopup(u.imei, true));
      markers.current.set(u.imei, m);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m as any).setPosition(u.coords); (m as any).setIcon(icon);
    }
    return m;
  }

  function openPopup(imei: string, fromMarker: boolean) {
    const u = units.current.get(imei);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const IW = infoWin.current as any; const GM = gMap.current as any;
    if (!u || !GM || !IW) return;
    activePopup.current = imei;
    setSelectedImei(imei);
    if (!u.coords) {
      pendingFocus.current = imei;
      IW.setPosition(GM.getCenter());
      IW.setContent(buildWaitingHtml(u.name || imei));
      IW.open(GM);
      return;
    }
    const m = ensureMarker(u);
    if (!m) return;
    IW.setContent(buildPopupHtml(u));
    IW.open({ map: GM, anchor: m });
    if (!fromMarker) { GM.panTo(u.coords); GM.setZoom(15); }
  }

  // ── SSE ──────────────────────────────────────────────────────────────────
  function stopAll() {
    sseConns.current.forEach((es) => { try { es.close(); } catch { /**/ } });
    sseConns.current.clear();
  }

  function openStream(imei: string) {
    let es: EventSource;
    try { es = new EventSource(sseUrl(imei)); } catch { return; }
    sseConns.current.set(imei, es);

    es.onmessage = (ev) => {
      const u = units.current.get(imei);
      if (!u) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let res: any;
      try { res = JSON.parse(ev.data); } catch { return; }
      if (res.status === "heartbeat") return;

      if (res.status === "no_data") {
        u.status = "Offline";
        tick();
        const m = ensureMarker(u);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const IW = infoWin.current as any; const GM = gMap.current as any;
        if (activePopup.current === imei && IW && GM) {
          if (m) { IW.setContent(buildPopupHtml(u)); IW.open({ map: GM, anchor: m }); }
          else   { IW.setContent(buildWaitingHtml(u.name || imei)); IW.open(GM); }
        }
        if (pendingFocus.current === imei && IW && GM) {
          IW.setContent(buildWaitingHtml(u.name || imei));
          IW.open(GM);
          pendingFocus.current = null;
        }
        return;
      }

      if (res.status !== "success" || !res.data) return;
      const d = res.data;
      const lat = parseFloat(d.data_latitude), lng = parseFloat(d.data_longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      u.speed             = Number(d.speed_log) || 0;
      u.motion_state      = d.motion_state || "";
      u.status            = normalizeStatus(u.motion_state, u.speed);
      u.coords            = { lat, lng };
      u.geocoded_location = d.geocoded_location || u.geocoded_location || "";
      u.last_sync         = `${d.local_system_datestamp || ""} ${d.local_system_timestamp || ""}`.trim();
      u.satellites        = Number(d.data_connected_satelites) || 0;
      u.hdop              = d.data_hdop ? String(d.data_hdop) : "";
      u.ignition          = d.ignition_status || d.iginition || "";
      u.mileage           = d.mileage || "";
      u.fuel_level        = d.fuel_level || "";

      // ── Geofence entry/exit detection ──
      if (geozonePathsRef.current.length > 0 && showGeofences) {
        if (!deviceInsideRef.current.has(imei)) {
          deviceInsideRef.current.set(imei, new Map());
        }
        const prevMap = deviceInsideRef.current.get(imei)!;
        const events = checkGeozoneTransitions({ lat, lng }, geozonePathsRef.current, prevMap);
        if (events.length > 0) {
          const now = new Date().toLocaleTimeString();
          const newAlerts: GeoAlert[] = events.map((e) => ({
            id: ++alertIdRef.current,
            type: e.type,
            deviceName: u.name || imei,
            zoneName: e.name,
            time: now,
          }));
          setGeoAlerts((prev) => [...newAlerts, ...prev].slice(0, 50));

          // ── Match against event rules and log notifications ──
          const deviceName = u.name || imei;
          const ownerUid = getCookie("_nvxs_account_root") ?? getCookie("_nvxs_account_uid") ?? "";
          for (const geoEvt of events) {
            for (const rule of eventRulesRef.current) {
              // Parse the rule's condition_value to check zone and breach_type match
              let ruleZones: string[] = [];
              let ruleBreachType = "both";
              try {
                const cv = JSON.parse(rule.condition_value);
                if (cv && Array.isArray(cv.zones)) {
                  ruleZones = cv.zones;
                  ruleBreachType = cv.breach_type || "both";
                }
              } catch { continue; }

              // Check if this zone matches the rule
              if (ruleZones.length > 0 && !ruleZones.includes(geoEvt.uid)) continue;
              // Check if the breach type matches
              if (ruleBreachType !== "both" && ruleBreachType !== geoEvt.type) continue;

              // Deduplicate: one notification per rule+device+zone+type per session
              const dedupeKey = `${rule.event_uid}:${imei}:${geoEvt.uid}:${geoEvt.type}`;
              if (loggedNotifsRef.current.has(dedupeKey)) continue;
              loggedNotifsRef.current.add(dedupeKey);

              // Fire-and-forget log to the backend
              logNotification({
                event_uid: rule.event_uid,
                event_name: rule.event_name,
                device_imei: imei,
                device_name: deviceName,
                condition: "geofence_breach",
                trigger_value: `${geoEvt.type}:${geoEvt.name}`,
                geozone_name: geoEvt.name,
                breach_type: geoEvt.type,
                alert_channels: (() => {
                  try { return JSON.parse(rule.alert_methods || "[]"); } catch { return []; }
                })(),
                owner_uid: ownerUid,
              }).catch(() => { /* ignore logging errors */ });
            }
          }
        }
      }

      tick();
      const m = ensureMarker(u);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const IW = infoWin.current as any; const GM = gMap.current as any;
      if (activePopup.current === imei && IW && GM && m) {
        IW.setContent(buildPopupHtml(u)); IW.open({ map: GM, anchor: m });
      }
      if (pendingFocus.current === imei) {
        pendingFocus.current = null;
        openPopup(imei, false);
      }
    };

    es.onerror = () => {
      try { es.close(); } catch { /**/ }
      sseConns.current.delete(imei);
      setTimeout(() => openStream(imei), 4000);
    };
  }

  function startAll() { stopAll(); units.current.forEach((_, i) => openStream(i)); }

  // ── Subscription enrichment ──────────────────────────────────────────────
  async function enrichSubs() {
    await Promise.all(
      Array.from(units.current.entries()).map(async ([imei, u]) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const j = await fleetFetch("GET", `${ENDPOINTS.FLEET.CHECK_IMEI}/${encodeURIComponent(imei)}`) as any;
          if (j?.status !== "success" || !j.data) return;
          const d = j.data;
          const expired = d.is_expired === true || String(d.is_expired).toLowerCase() === "true" || String(d.is_expired) === "1";
          const valid   = d.is_valid   === true || String(d.is_valid).toLowerCase()   === "true" || String(d.is_valid)   === "1";
          u.subscription_status = expired ? "expired" : valid ? "running"
            : String(d.validity_status || d.subscription_status || "unknown").toLowerCase();
        } catch { /**/ }
      })
    );
  }

  // ── Load units ───────────────────────────────────────────────────────────
  async function loadUnits(dataLevel: string, accountUid: string) {
    setLoading(true); setListError(null);
    console.log("[LiveMonitoring] loadUnits — dataLevel:", dataLevel, "accountUid:", accountUid);
    try {
      // 15-second timeout so a hanging backend doesn't freeze the UI forever
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
      console.log("[LiveMonitoring] fleetFetch response status:", resp?.status, "data count:", Array.isArray(resp?.data) ? resp.data.length : "not-array");
      if (!resp || resp.status !== "success" || !Array.isArray(resp.data)) {
        setListError(resp?.message || "No devices found for this account.");
        setLoading(false);
        return;
      }
      units.current.clear();
      setPage(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resp.data.forEach((u: any) => {
        if (!u.device_imei) return;
        units.current.set(u.device_imei, {
          imei:                u.device_imei,
          name:                u.device_name || u.device_imei,
          subscription_status: u.subscription_status || "",
          status:              "Offline",
          speed:               0,
          motion_state:        "",
          geocoded_location:   "",
          coords:              null,
          last_sync:           "",
          country:             "",
          car_make:            u.car_make || "",
          car_model:           u.car_model || "",
          car_type:            u.car_type || "",
          hardware:            u.hardware || "",
          hardware_model:      u.hardware_model || "",
          simcard:             u.simcard || "",
          vin_number:          u.vin_number || "",
          billing_status:      u.billing_status || "",
          ignition:            "",
          mileage:             "",
          fuel_level:          "",
          satellites:          0,
          hdop:                "",
        });
      });
      tick();
      setLoading(false);
      try { await enrichSubs(); tick(); } catch { /**/ }
      startAll();
    } catch (err) {
      console.error("[LiveMonitoring] loadUnits error:", err);
      setListError("Failed to load devices. Please try again.");
      setLoading(false);
    }
  }

  // ── Bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => {
    const initMap = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const G = (window as any).google?.maps;
      if (!mapDivRef.current || gMap.current || !G) return;

      if (!document.getElementById("navas-iw-css")) {
        const el = document.createElement("style");
        el.id = "navas-iw-css";
        el.textContent = IW_CSS;
        document.head.appendChild(el);
      }

      gMap.current = new G.Map(mapDivRef.current, {
        zoom: 7, center: DEFAULT_CENTER, mapTypeId: "roadmap",
        gestureHandling: "greedy", zoomControl: true, fullscreenControl: true,
        streetViewControl: false, mapTypeControl: false,
      });
      infoWin.current = new G.InfoWindow({ maxWidth: 300, disableAutoPan: false });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.maps) {
      initMap();
    } else if (!document.getElementById("gmaps-nocbridge")) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__nocBridgeMapInit = initMap;
      const s = Object.assign(document.createElement("script"), {
        id: "gmaps-nocbridge",
        src: `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&callback=__nocBridgeMapInit&loading=async`,
        async: true, defer: true,
      });
      document.head.appendChild(s);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__nocBridgeMapInit = initMap;
    }

    (async () => {
      const rawUid = getCookie("_nvxs_account_uid") ?? "";
      if (!rawUid) {
        setListError("Missing session — please log in.");
        setLoading(false);
        return;
      }
      // Use "client" data level for customers — queries devices by client UID.
      // "inhouse" fetches ALL devices in the system (admin only).
      const accountType = getCookie("_nvxs_account_type") || "Customer";
      const isAdmin = ["Admin", "SuperAdmin", "super_admin", "system"].includes(accountType);
      const dataLevel   = isAdmin ? "inhouse" : "client";
      const accountUid  = getCookie("_nvxs_account_root") ?? rawUid;
      await loadUnits(dataLevel, accountUid);
    })();

    return () => {
      stopAll();
      if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Geofence overlays + attached device markers (merged) ─────────────────
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G = (window as any).google?.maps;

    // Helper: clear all geofence device markers & SSE connections
    const clearGeoDevices = () => {
      for (const es of geoDeviceSse.current.values()) { try { es.close(); } catch { /**/ } }
      geoDeviceSse.current.clear();
      for (const m of geoDeviceMarkers.current.values()) { try { m.setMap(null); } catch { /**/ } }
      geoDeviceMarkers.current.clear();
      geoDeviceNames.current.clear();
    };

    // Clear existing polygons
    for (const p of geoPolygons.current) p.setMap(null);
    geoPolygons.current = [];

    if (!showGeofences || !G || !gMap.current) {
      clearGeoDevices();
      return;
    }

    const accountRoot = getCookie("_nvxs_account_root") ?? "";
    if (!accountRoot) return;

    let cancelled = false;

    (async () => {
      try {
        // 1. Get all geozones for this account
        const gzRes = await getGeozones(accountRoot, "client");
        if (cancelled) return;
        if (gzRes.status !== "success" || !Array.isArray(gzRes.data)) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const GM = gMap.current as any;
        if (!GM) return;

        // 2. Get all client devices for name lookup
        const devRes = await getClientDevices(accountRoot);
        if (cancelled) return;
        const allDevices = devRes.status === "success" && Array.isArray(devRes.data) ? devRes.data : [];
        const deviceNameMap = new Map<string, string>();
        for (const d of allDevices) {
          deviceNameMap.set(d.device_imei, d.device_name || d.device_imei);
          geoDeviceNames.current.set(d.device_imei, d.device_name || d.device_imei);
        }

        // 3. For each client device, fetch its attached geozones and build reverse map
        //    Uses getDeviceGeozones (per device) which works on the hosted server,
        //    instead of getGeozoneAttachedDevices (per zone) which may not be deployed.
        const zoneAttachments = new Map<string, string[]>(); // geozone_uid → [imei, ...]
        const allAttachedImeis = new Set<string>();
        const geozoneUids = new Set((gzRes.data as Geozone[]).map((gz) => gz.geozone_uid));

        await Promise.allSettled(
          allDevices.map(async (dev) => {
            try {
              const dzRes = await getDeviceGeozones(dev.device_imei);
              if (cancelled) return;
              if (dzRes.status === "success" && Array.isArray(dzRes.data)) {
                for (const dz of dzRes.data) {
                  // Only consider zones that belong to this account
                  if (!geozoneUids.has(dz.zone_uid)) continue;
                  allAttachedImeis.add(dev.device_imei);
                  const existing = zoneAttachments.get(dz.zone_uid) ?? [];
                  existing.push(dev.device_imei);
                  zoneAttachments.set(dz.zone_uid, existing);
                }
              }
            } catch { /* skip silently */ }
          }),
        );

        if (cancelled) return;
        console.log(`[LiveMonitoring] Geofence attachments loaded: ${zoneAttachments.size} zones with devices, ${allAttachedImeis.size} unique devices`);

        // 4. Render polygons ONLY for geozones that have attached devices
        const alertPaths: { uid: string; name: string; path: Point[] }[] = [];
        for (const gz of gzRes.data as Geozone[]) {
          const path = parseGeozonePoints(gz.geozone_points);
          if (path.length < 3) continue;
          alertPaths.push({ uid: gz.geozone_uid, name: gz.geozone_name, path });

          const attachedImeis = zoneAttachments.get(gz.geozone_uid) ?? [];
          // Only render geofence polygon if it has at least one attached device
          if (attachedImeis.length === 0) continue;

          const poly = new G.Polygon({
            paths: path.map((p: { lat: number; lng: number }) => ({ lat: p.lat, lng: p.lng })),
            fillColor: "#128C7E",
            fillOpacity: 0.15,
            strokeColor: "#128C7E",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            clickable: true,
            zIndex: 0,
            map: GM,
          });

          // Build device list HTML for the info popup
          const deviceListHtml = attachedImeis.map((imei) => {
            const name = deviceNameMap.get(imei) ?? imei;
            return `<div style="display:flex;align-items:center;gap:6px;padding:3px 0">
              <span style="width:6px;height:6px;border-radius:50%;background:#128C7E;flex-shrink:0"></span>
              <span style="font-size:11px;color:#111B21;font-weight:600">${esc(name)}</span>
            </div>`;
          }).join("");

          // Show zone name + attached devices on click
          const iw = new G.InfoWindow({
            content: `<div style="font-family:system-ui;padding:8px 12px;min-width:180px">
              <div style="font-weight:800;font-size:13px;color:#111B21">${esc(gz.geozone_name)}</div>
              <div style="font-size:11px;color:#667781;margin-top:2px">${esc(gz.geozone_description || "Geofence zone")}</div>
              <div style="margin-top:8px;padding-top:6px;border-top:1px solid #E9EDEF">
                <div style="font-size:10px;font-weight:700;color:#128C7E;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">
                  Attached Devices (${attachedImeis.length})
                </div>
                ${deviceListHtml}
              </div>
            </div>`,
          });
          poly.addListener("click", (ev: { latLng: unknown }) => {
            iw.setPosition(ev.latLng);
            iw.open(GM);
          });

          // Add a label marker at the centroid of the geofence showing device count
          const centroid = path.reduce(
            (acc, p) => ({ lat: acc.lat + p.lat / path.length, lng: acc.lng + p.lng / path.length }),
            { lat: 0, lng: 0 },
          );
          const labelMarker = new G.Marker({
            position: centroid,
            map: GM,
            icon: {
              path: G.SymbolPath.CIRCLE,
              scale: 0,  // invisible icon — we only want the label
            },
            label: {
              text: `${esc(gz.geozone_name)} (${attachedImeis.length})`,
              color: "#075E54",
              fontSize: "11px",
              fontWeight: "800",
              className: "geofence-label",
            },
            clickable: false,
            zIndex: 2,
          });

          geoPolygons.current.push(poly);
          geoPolygons.current.push(labelMarker);
        }
        geozonePathsRef.current = alertPaths;

        // 4b. Load event rules to match geofence_breach events for notifications
        try {
          const ownerUid = getCookie("_nvxs_account_uid") ?? accountRoot;
          const evRes = await getEvents(ownerUid, "usri");
          if (!cancelled && evRes.status === "success" && Array.isArray(evRes.data)) {
            eventRulesRef.current = evRes.data.filter(
              (ev: DeviceEvent) => ev.condition === "geofence_breach",
            );
            console.log(`[LiveMonitoring] Loaded ${eventRulesRef.current.length} geofence_breach event rules`);
          }
        } catch {
          // Silently ignore — events may not exist yet
        }

        // 5. Open SSE for attached devices NOT already tracked by the fleet
        for (const imei of allAttachedImeis) {
          // Fleet devices already have SSE via startAll() — only open extra SSE for non-fleet devices
          if (sseConns.current.has(imei)) continue;

          const url = `${FLEET_SSE}/data-stream/${encodeURIComponent(imei)}/x-location`;
          const es = new EventSource(url);
          geoDeviceSse.current.set(imei, es);

          es.onmessage = (ev) => {
            if (cancelled) return;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let d: any;
            try { d = JSON.parse(ev.data); } catch { return; }
            if (d.status === "heartbeat" || d.status === "no_data") return;
            if (d.status !== "success" || !d.data) return;

            const lat = parseFloat(d.data?.data_latitude ?? d.data?.latitude ?? 0);
            const lng = parseFloat(d.data?.data_longitude ?? d.data?.longitude ?? 0);
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return;

            const spd = Number(d.data?.speed_log ?? d.data?.speed ?? 0);
            const status = normalizeStatus(d.data?.motion_state ?? "", spd);
            const iconKey = status === "Moving" ? "moving" : status === "Parked" ? "parked"
                          : status === "Idling" ? "idling" : "unknown";
            const icon = { url: ICONS[iconKey], scaledSize: new G.Size(28, 28), anchor: new G.Point(14, 14) };
            const devName = geoDeviceNames.current.get(imei) ?? imei;

            let m = geoDeviceMarkers.current.get(imei);
            if (!m) {
              m = new G.Marker({
                position: { lat, lng },
                map: GM,
                title: `${devName} (geofence device)`,
                icon,
                zIndex: 1,
              });
              m.addListener("click", () => {
                const iwDev = new G.InfoWindow({
                  content: `<div style="font-family:system-ui;padding:8px 12px;min-width:160px">
                    <div style="font-weight:800;font-size:13px;color:#111B21">${esc(devName)}</div>
                    <div style="font-size:11px;color:#667781;margin-top:2px">IMEI: ${esc(imei)}</div>
                    <div style="font-size:11px;color:#667781;margin-top:2px">Status: ${status}</div>
                    <div style="font-size:10px;color:#128C7E;margin-top:4px;font-weight:700">Geofence-attached device</div>
                  </div>`,
                });
                iwDev.open({ map: GM, anchor: m });
              });
              geoDeviceMarkers.current.set(imei, m);
            } else {
              m.setPosition({ lat, lng });
              m.setIcon(icon);
            }
          };
        }
      } catch (err) {
        console.error("[LiveMonitoring] Failed to load geofences:", err);
      }
    })();

    return () => {
      cancelled = true;
      for (const p of geoPolygons.current) p.setMap(null);
      geoPolygons.current = [];
      clearGeoDevices();
    };
  }, [showGeofences]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────
  function onUnitClick(imei: string) {
    const u = units.current.get(imei);
    if (!u) return;
    setSelectedImei(imei);
    if (String(u.subscription_status).toLowerCase() === "expired") return;
    openPopup(imei, false);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-[#F0F2F5]">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pt-4 pb-3 flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] text-[#667781] mb-0.5">Home &rsaquo; Live Monitoring</div>
          <h1 className="text-[20px] font-black text-[#111B21] m-0 leading-tight">
            Live Monitoring
          </h1>
          <p className="text-[12px] text-[#667781] m-0 mt-0.5">
            Real-time GPS tracking for your fleet. Click a device to see it on the map.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[11px] font-extrabold text-white px-2.5 py-1 rounded-full bg-[#25D366] animate-pulse">
            LIVE
          </span>
          <span className="text-[11px] text-[#667781]">
            {allUnits.length} device{allUnits.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── Body: 3-column on xl (list | map | detail), 2-column on lg, stack on sm */}
      <div className={[
        "flex-1 min-h-0 grid gap-3 px-5 pb-5 overflow-hidden",
        selectedUnit
          ? "xl:grid-cols-[320px_1fr_340px] lg:grid-cols-[300px_1fr]"
          : "xl:grid-cols-[320px_1fr] lg:grid-cols-[300px_1fr]",
      ].join(" ")}>

        {/* ══ Left: Device List ═══════════════════════════════════════════ */}
        <div className="min-h-0 flex flex-col bg-white border border-[#E9EDEF] rounded-xl overflow-hidden shadow-sm">

          {/* KPI strip */}
          <div className="shrink-0 grid grid-cols-4 gap-1.5 p-3 border-b border-[#E9EDEF]">
            <KpiChip label="All"     value={allUnits.length}           active={statusFilter === ""} onClick={() => { setStatusFilter(""); setPage(1); }} />
            <KpiChip label="Moving"  value={statusCounts["Moving"]  ?? 0} active={statusFilter === "Moving"}  onClick={() => { setStatusFilter("Moving"); setPage(1); }} />
            <KpiChip label="Parked"  value={statusCounts["Parked"]  ?? 0} active={statusFilter === "Parked"}  onClick={() => { setStatusFilter("Parked"); setPage(1); }} />
            <KpiChip label="Idle"    value={statusCounts["Idling"]  ?? 0} active={statusFilter === "Idling"}  onClick={() => { setStatusFilter("Idling"); setPage(1); }} />
          </div>

          {/* Search */}
          <div className="shrink-0 px-3 pt-2.5 pb-2">
            <input
              type="search"
              value={searchQ}
              onChange={(e) => { setSearchQ(e.target.value); setPage(1); }}
              placeholder="Search name, IMEI, location…"
              className="w-full h-9 rounded-lg border border-[#E9EDEF] px-3 text-[12px] text-[#111B21]
                placeholder:text-[#667781] bg-[#F8F9FA] outline-none focus:border-[#128C7E] transition-colors"
            />
          </div>

          {/* Device list */}
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
            {loading && (
              <div className="px-4 py-8 text-center">
                <div className="inline-block w-6 h-6 border-2 border-[#E9EDEF] border-t-[#128C7E] rounded-full animate-spin" />
                <div className="text-[12px] text-[#667781] mt-2">Loading devices…</div>
              </div>
            )}
            {listError && <div className="px-4 py-3 text-[12px] text-[#D93025]">{listError}</div>}
            {!loading && !listError && list.length === 0 && (
              <div className="px-4 py-8 text-center text-[12px] text-[#667781]">
                {q || statusFilter ? "No devices match your filter." : "No devices configured."}
              </div>
            )}
            {pagedList.map((u) => {
              const expired  = String(u.subscription_status).toLowerCase() === "expired";
              const selected = selectedImei === u.imei;
              const loc      = u.geocoded_location || u.country || "—";
              return (
                <div
                  key={u.imei}
                  onClick={() => onUnitClick(u.imei)}
                  className={[
                    "flex items-center gap-3 px-3 py-2.5 cursor-pointer",
                    "border-b border-[#E9EDEF] last:border-b-0 transition-colors",
                    selected ? "bg-[#E7F7EF] border-l-[3px] border-l-[#128C7E]" : "hover:bg-[#F8F9FA]",
                    expired ? "opacity-50" : "",
                  ].join(" ")}
                >
                  {/* Status dot */}
                  <span className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: STATUS_META[u.status]?.dot ?? "#607D8B" }} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-[12px] text-[#111B21] truncate">{u.name || u.imei}</span>
                      {expired && (
                        <span className="text-[9px] font-bold text-[#D93025] bg-[#FFEBEE] px-1 rounded">EXPIRED</span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#667781] truncate mt-0.5" title={loc}>{loc}</div>
                    {u.speed > 0 && (
                      <div className="text-[10px] text-[#2E7D32] font-bold mt-0.5">{u.speed} km/h</div>
                    )}
                  </div>

                  {/* Badge */}
                  <StatusBadge status={u.status} />
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {list.length > PAGE_SIZE && (
            <div className="shrink-0 flex items-center justify-between px-3 py-2 border-t border-[#E9EDEF] bg-white">
              <span className="text-[10px] text-[#667781]">
                {`${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, list.length)} of ${list.length}`}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}
                  className="w-6 h-6 rounded flex items-center justify-center text-[16px] leading-none
                    text-[#667781] disabled:opacity-30 hover:bg-[#F0F2F5] transition-colors
                    border-none bg-transparent cursor-pointer disabled:cursor-not-allowed">‹</button>
                <span className="text-[10px] font-extrabold text-[#111B21] min-w-[40px] text-center">
                  {safePage}/{totalPages}
                </span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                  className="w-6 h-6 rounded flex items-center justify-center text-[16px] leading-none
                    text-[#667781] disabled:opacity-30 hover:bg-[#F0F2F5] transition-colors
                    border-none bg-transparent cursor-pointer disabled:cursor-not-allowed">›</button>
              </div>
            </div>
          )}
        </div>

        {/* ══ Center: Map ════════════════════════════════════════════════ */}
        <div className="min-h-0 flex flex-col bg-white border border-[#E9EDEF] rounded-xl overflow-hidden shadow-sm">
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#E9EDEF]">
            <div className="flex items-center gap-2">
              <span className="font-black text-[14px] text-[#111B21]">Fleet Map</span>
              <span className="text-[11px] text-[#667781]">Click a marker for details</span>
            </div>
            {/* Geofence toggle */}
            <button
              type="button"
              onClick={() => setShowGeofences((v) => !v)}
              className={[
                "h-7 px-2.5 rounded-lg text-[10px] font-extrabold cursor-pointer border transition-colors",
                showGeofences
                  ? "bg-[#E9F7F4] border-[#C2E8E1] text-[#075E54]"
                  : "bg-[#F0F2F5] border-[#E9EDEF] text-[#667781]",
              ].join(" ")}
            >
              {showGeofences ? "Geofences ON" : "Geofences OFF"}
            </button>
            {/* Status legend */}
            <div className="hidden sm:flex items-center gap-3">
              {(["Moving", "Parked", "Idling", "Offline"] as MotionStatus[]).map((s) => (
                <div key={s} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: STATUS_META[s].dot }} />
                  <span className="text-[10px] text-[#667781]">{s}</span>
                </div>
              ))}
            </div>
          </div>
          <div ref={mapDivRef} className="flex-1 min-h-[300px] w-full relative">
            {/* Geofence alert toasts — bottom-left of map */}
            {geoAlerts.length > 0 && (
              <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5 max-h-[200px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {geoAlerts.slice(0, 5).map((a) => (
                  <div
                    key={a.id}
                    className={[
                      "flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-[11px] font-extrabold backdrop-blur-sm",
                      a.type === "enter"
                        ? "bg-[#E8F5E9]/95 text-[#2E7D32] border border-[#A5D6A7]"
                        : "bg-[#FFF3E0]/95 text-[#E65100] border border-[#FFCC80]",
                    ].join(" ")}
                  >
                    <span className="text-[14px]">{a.type === "enter" ? "📍" : "🚪"}</span>
                    <span>
                      <span className="font-black">{a.deviceName}</span>
                      {a.type === "enter" ? " entered " : " exited "}
                      <span className="font-black">{a.zoneName}</span>
                    </span>
                    <span className="text-[9px] opacity-60 ml-auto">{a.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ══ Right: Device Detail Panel ════════════════════════════════ */}
        {selectedUnit && (
          <div className="min-h-0 flex flex-col bg-white border border-[#E9EDEF] rounded-xl overflow-hidden shadow-sm lg:col-span-2 xl:col-span-1">
            {/* Detail header */}
            <div className="shrink-0 px-4 py-3 border-b border-[#E9EDEF]"
              style={{ background: STATUS_META[selectedUnit.status]?.bg ?? "#455A64" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3
                        12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0
                        1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5
                        13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5
                        1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14px] font-black text-white truncate">{selectedUnit.name || selectedUnit.imei}</div>
                    <div className="text-[10px] text-white/60 font-mono tracking-wider">{selectedUnit.imei}</div>
                  </div>
                </div>
                <button onClick={() => setSelectedImei(null)}
                  className="w-7 h-7 rounded-full bg-white/20 text-white text-[16px] font-bold flex items-center justify-center
                    border-none cursor-pointer hover:bg-white/30 transition-colors shrink-0">×</button>
              </div>
              {/* Status strip */}
              <div className="flex items-center gap-2 mt-2.5">
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-white/20 text-white">
                  {STATUS_META[selectedUnit.status]?.text ?? "Unknown"}
                </span>
                {selectedUnit.speed > 0 && (
                  <span className="text-[12px] font-bold text-white/90">{selectedUnit.speed} km/h</span>
                )}
              </div>
            </div>

            {/* Detail body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2" style={{ scrollbarWidth: "thin" }}>
              {/* Location section */}
              <div className="text-[10px] font-bold text-[#128C7E] uppercase tracking-wider mt-2 mb-1">Location</div>
              <DetailRow icon="📍" label="Address" value={selectedUnit.geocoded_location || selectedUnit.country || "Waiting for GPS…"} />
              <DetailRow icon="🧭" label="Coordinates"
                value={selectedUnit.coords ? `${selectedUnit.coords.lat.toFixed(6)}, ${selectedUnit.coords.lng.toFixed(6)}` : "—"} mono />
              <DetailRow icon="⏱" label="Last Update" value={selectedUnit.last_sync} />
              <DetailRow icon="🏎" label="Speed" value={selectedUnit.speed > 0 ? `${selectedUnit.speed} km/h` : "0 km/h"} />
              <DetailRow icon="🔄" label="Motion State" value={selectedUnit.motion_state || selectedUnit.status} />

              {/* Vehicle section */}
              <div className="text-[10px] font-bold text-[#128C7E] uppercase tracking-wider mt-4 mb-1">Vehicle</div>
              <DetailRow icon="🚗" label="Make / Model"
                value={[selectedUnit.car_make, selectedUnit.car_model].filter(Boolean).join(" ") || "—"} />
              <DetailRow icon="📋" label="Vehicle Type" value={selectedUnit.car_type} />
              <DetailRow icon="🔑" label="VIN" value={selectedUnit.vin_number} mono />

              {/* Device section */}
              <div className="text-[10px] font-bold text-[#128C7E] uppercase tracking-wider mt-4 mb-1">Device</div>
              <DetailRow icon="📡" label="Hardware" value={[selectedUnit.hardware, selectedUnit.hardware_model].filter(Boolean).join(" / ") || "—"} />
              <DetailRow icon="📶" label="SIM Card" value={selectedUnit.simcard} mono />
              <DetailRow icon="🛰" label="Satellites" value={selectedUnit.satellites > 0 ? String(selectedUnit.satellites) : "—"} />
              <DetailRow icon="📊" label="HDOP (Accuracy)" value={selectedUnit.hdop || "—"} />

              {/* Telemetry section */}
              <div className="text-[10px] font-bold text-[#128C7E] uppercase tracking-wider mt-4 mb-1">Telemetry</div>
              <DetailRow icon="🔥" label="Ignition" value={selectedUnit.ignition || "—"} />
              <DetailRow icon="🛣" label="Mileage" value={selectedUnit.mileage || "—"} />
              <DetailRow icon="⛽" label="Fuel Level" value={selectedUnit.fuel_level || "—"} />

              {/* Subscription section */}
              <div className="text-[10px] font-bold text-[#128C7E] uppercase tracking-wider mt-4 mb-1">Subscription</div>
              <DetailRow icon="💳" label="Billing Status" value={selectedUnit.billing_status || "—"} />
              <DetailRow icon="📦" label="Subscription"
                value={String(selectedUnit.subscription_status || "—").replace(/^\w/, (c) => c.toUpperCase())} />

              {/* Google Maps link */}
              {selectedUnit.coords && (
                <a
                  href={`https://www.google.com/maps?q=${selectedUnit.coords.lat},${selectedUnit.coords.lng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 mt-4 mb-3 h-9 rounded-lg
                    bg-[#128C7E] text-white text-[12px] font-extrabold no-underline
                    hover:brightness-110 transition-all"
                >
                  Open in Google Maps
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
