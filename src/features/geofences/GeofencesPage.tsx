/**
 * GeofencesPage — Client-facing Geofences & Zones module.
 *
 * Layout: split-panel
 *   Left panel  — GeofenceList (card list with search) + action drawers/modals
 *   Right panel — GeofenceMap (Google Maps; polygon, circle and line geofences)
 *
 * Tabs:
 *   "my-geofences"  — CRUD geofences with map integration
 *   "device-zones"  — Per-device view of attached geofences
 */
import React, { useState, useCallback, useEffect, useRef } from "react";
import { getGeozones, deleteGeozone, getGeozoneAttachedDevices } from "../../api/services/geozones.service";
import { getClientDevices } from "../../api/services/clients.service";
import { useAuth } from "../../auth/AuthContext";
import { useGuardedMutation, GuardedButton } from "../../auth/guards";
import { parseGeozonePoints } from "../../api/types/geozones.types";
import type { ParsedGeozone, LatLng, Geozone } from "../../api/types";
import {
  emptyDraft,
  draftFromZone,
  previewOf,
  toDraftPoint,
  withMapPoint,
  undoLast,
  clearPoints,
  type ShapeDraft,
} from "../../utils/geofenceShapes";

import { parseLiveFrame, liveStreamUrl } from "../../utils/livePosition";

import { GeofenceMap } from "./components/GeofenceMap";
import type { DeviceMarkerData } from "./components/GeofenceMap";
import { GeofenceList } from "./components/GeofenceList";
import { CreateGeofenceDrawer } from "./components/CreateGeofenceDrawer";
import { EditGeofenceDrawer } from "./components/EditGeofenceDrawer";
import { AttachDevicesModal } from "./components/AttachDevicesModal";
import { DeviceZones } from "./components/DeviceZones";
import { GeofenceGroups } from "./components/GeofenceGroups";

type GeofenceTab = "my-geofences" | "device-zones" | "groups";

const TABS: { key: GeofenceTab; label: string }[] = [
  { key: "my-geofences", label: "My Geofences" },
  { key: "device-zones", label: "Device Zones" },
  { key: "groups",       label: "Groups" },
];

const FLEET_SSE = (import.meta.env.VITE_FLEET_SSE_URL as string) ?? "https://narvasocket.3dservices.co.ug";

/** Wait this long before reopening a stream that dropped. */
const STREAM_RETRY_MS = 4000;

export function GeofencesPage() {
  const { state: authState } = useAuth();
  const [activeTab, setActiveTab] = useState<GeofenceTab>("my-geofences");

  // ── Data ────────────────────────────────────────────────────────────────
  const [geozones, setGeozones] = useState<ParsedGeozone[]>([]);
  const [loading, setLoading] = useState(false);
  // A failed load used to look exactly like "you have no geofences".
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchGeozones = useCallback(() => {
    if (!authState.accountRoot) return;
    setLoading(true);
    setLoadError(null);
    getGeozones(authState.accountRoot, "client")
      .then((res) => {
        if (res.status === "success" && Array.isArray(res.data)) {
          const parsed: ParsedGeozone[] = (res.data as Geozone[]).map((gz) => ({
            ...gz,
            path: parseGeozonePoints(gz.geozone_points),
          }));
          setGeozones(parsed);
        } else {
          setGeozones([]);
        }
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Couldn't load your geofences.");
        setGeozones([]);
      })
      .finally(() => setLoading(false));
  }, [authState.accountRoot]);

  // Fetch on mount / when accountRoot changes
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchGeozones(); }, [fetchGeozones]);

  // ── Selection / interaction state ───────────────────────────────────────
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // The shape being created or edited (shared by the side panel and the map)
  const [draft, setDraft] = useState<ShapeDraft | null>(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);

  // Editing
  const [editingGeozone, setEditingGeozone] = useState<ParsedGeozone | null>(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editBaseline, setEditBaseline] = useState("");

  // Attach devices
  const [attachGeozone, setAttachGeozone] = useState<ParsedGeozone | null>(null);

  // ── Live device markers on geofence map ────────────────────────────────
  const [deviceMarkers, setDeviceMarkers] = useState<DeviceMarkerData[]>([]);
  const sseRefs = useRef<Map<string, EventSource>>(new Map());
  const deviceDataRef = useRef<Map<string, DeviceMarkerData>>(new Map());
  const retryTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Fetch attached devices when a geofence is selected
  useEffect(() => {
    // Close existing SSE connections
    for (const es of sseRefs.current.values()) es.close();
    sseRefs.current.clear();
    for (const timer of retryTimers.current) clearTimeout(timer);
    retryTimers.current.clear();
    deviceDataRef.current.clear();
    setDeviceMarkers([]);

    if (!selectedUid || !authState.accountRoot) return;

    let cancelled = false;

    (async () => {
      try {
        // 1. Get attached device IMEIs for the selected geofence
        const attachRes = await getGeozoneAttachedDevices(selectedUid);
        if (cancelled) return;
        const attachedImeis: string[] =
          attachRes.status === "success" && Array.isArray(attachRes.data)
            ? attachRes.data
            : [];
        if (attachedImeis.length === 0) return;

        // 2. Get device names from client devices
        const devicesRes = await getClientDevices(authState.accountRoot!);
        if (cancelled) return;
        const allDevices = devicesRes.status === "success" && Array.isArray(devicesRes.data)
          ? devicesRes.data
          : [];

        const nameMap = new Map<string, string>();
        for (const d of allDevices) {
          const plate = [d.car_make, d.car_model].filter(Boolean).join(" ");
          nameMap.set(d.device_imei, d.device_name || plate || d.device_imei);
        }

        const show = (marker: DeviceMarkerData) => {
          deviceDataRef.current.set(marker.imei, marker);
          setDeviceMarkers(Array.from(deviceDataRef.current.values()));
        };

        // 3. Follow each attached unit's live position
        const connect = (imei: string) => {
          if (cancelled) return;
          let es: EventSource;
          try {
            es = new EventSource(liveStreamUrl(FLEET_SSE, imei));
          } catch {
            return;
          }
          sseRefs.current.set(imei, es);

          es.onmessage = (ev) => {
            const frame = parseLiveFrame(ev.data, imei);
            if (frame.kind === "ignore") return;

            if (frame.kind === "offline") {
              const known = deviceDataRef.current.get(imei);
              show(known
                ? { ...known, status: "Offline" }
                : { imei, name: nameMap.get(imei) ?? imei, lat: NaN, lng: NaN,
                    speed: 0, status: "Offline", lastSync: "—" });
              return;
            }

            const p = frame.position;
            show({
              imei,
              name: nameMap.get(imei) ?? imei,
              lat: p.lat,
              lng: p.lng,
              speed: Math.round(p.speed),
              status: p.status,
              lastSync: p.lastSync || "—",
            });
          };

          // A dropped stream is normal (sleep, network change) — reopen it,
          // otherwise the map quietly freezes on the last position.
          es.onerror = () => {
            try { es.close(); } catch { /* already closed */ }
            sseRefs.current.delete(imei);
            if (cancelled) return;
            const retry = setTimeout(() => {
              retryTimers.current.delete(retry);
              connect(imei);
            }, STREAM_RETRY_MS);
            retryTimers.current.add(retry);
          };
        };

        for (const imei of attachedImeis) connect(imei);
      } catch (err) {
        console.error("[GeofencesPage] Failed to load device markers:", err);
      }
    })();

    return () => {
      cancelled = true;
      for (const es of sseRefs.current.values()) es.close();
      sseRefs.current.clear();
      for (const timer of retryTimers.current) clearTimeout(timer);
      retryTimers.current.clear();
    };
  }, [selectedUid, authState.accountRoot]);

  // ── Create handlers ─────────────────────────────────────────────────────
  const handleEditClose = () => {
    setEditDrawerOpen(false);
    setEditingUid(null);
    setEditingGeozone(null);
    setDraft(null);
  };

  const handleStartDrawing = () => {
    handleEditClose();
    setSelectedUid(null);
    setDraft(emptyDraft("polygon"));
    setCreateDrawerOpen(true);
  };

  const handleCancelDrawing = () => {
    setCreateDrawerOpen(false);
    setDraft(null);
  };

  // ── Edit handlers ───────────────────────────────────────────────────────
  const handleEditClick = (gz: ParsedGeozone) => {
    const start = draftFromZone(gz.geozone_shape, gz.geozone_shape_params, gz.path);
    setCreateDrawerOpen(false);
    setEditingGeozone(gz);
    setEditingUid(gz.geozone_uid);
    setSelectedUid(gz.geozone_uid);
    setDraft(start);
    setEditBaseline(JSON.stringify(start));
    setEditDrawerOpen(true);
  };

  // ── Map ↔ draft ─────────────────────────────────────────────────────────
  const handleMapClick = (p: LatLng) => setDraft((d) => (d ? withMapPoint(d, p) : d));
  const handlePointMoved = (index: number, p: LatLng) =>
    setDraft((d) => d && { ...d, points: d.points.map((pt, k) => (k === index ? toDraftPoint(p) : pt)) });
  const handleCenterMoved = (p: LatLng) => setDraft((d) => d && { ...d, center: toDraftPoint(p) });
  const handleUndo = () => setDraft((d) => d && undoLast(d));
  const handleClear = () => setDraft((d) => d && clearPoints(d));

  // ── Delete handler ──────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<ParsedGeozone | null>(null);

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMutation = useGuardedMutation(
    "can_delete_geofence",
    useCallback(async () => {
      if (!deleteConfirm) return;
      setDeleteError(null);
      try {
        const res = await deleteGeozone(deleteConfirm.geozone_uid);
        if (res.status === "success") {
          setGeozones((prev) =>
            prev.filter((g) => g.geozone_uid !== deleteConfirm.geozone_uid),
          );
          if (selectedUid === deleteConfirm.geozone_uid) setSelectedUid(null);
        }
        setDeleteConfirm(null);
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : "Failed to delete geofence.");
      }
    }, [deleteConfirm, selectedUid]),
  );

  return (
    <div className="flex flex-col h-full w-full bg-[#F0F2F5]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 p-3 pb-0 flex flex-col gap-2">
        <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-black text-[16px] text-[#111B21]">
                Geofences &amp; Zones
              </div>
              <nav className="text-[11px] text-[#667781] mt-0.5">
                Draw, manage, and attach geofences to your devices
              </nav>
            </div>
            {activeTab === "my-geofences" && !createDrawerOpen && (
              <GuardedButton
                permission="can_create_geofence"
                fallback="disable"
                onClick={handleStartDrawing}
                className="shrink-0 h-8 px-4 rounded-lg border-0 bg-[#128C7E] text-white text-[12px] font-extrabold cursor-pointer hover:bg-[#0D7466]"
              >
                + Mark Geofence
              </GuardedButton>
            )}
            {activeTab === "my-geofences" && createDrawerOpen && (
              <button
                type="button"
                onClick={handleCancelDrawing}
                className="shrink-0 h-8 px-4 rounded-lg border border-[#E9EDEF] bg-white text-[12px] font-extrabold text-[#667781] cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Tab toggle */}
        <div className="bg-white border border-[#E9EDEF] rounded-xl p-1.5 flex gap-1 self-start">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                handleCancelDrawing();
                handleEditClose();
              }}
              className={[
                "px-3 py-1.5 text-[12px] font-extrabold rounded-md cursor-pointer border-0 transition-colors",
                activeTab === tab.key
                  ? "bg-[#128C7E] text-white"
                  : "bg-transparent text-[#667781] hover:bg-[#F0F2F5]",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 p-3 pt-2">
        {activeTab === "my-geofences" ? (
          <div className="flex gap-3 h-full">
            {/* Left panel — list OR create/edit panel */}
            <div className="w-[340px] shrink-0 flex flex-col gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {/* Inline create panel (replaces list when creating) */}
              {createDrawerOpen && draft ? (
                <CreateGeofenceDrawer
                  open={createDrawerOpen}
                  draft={draft}
                  onDraftChange={setDraft}
                  onClose={handleCancelDrawing}
                  onCreated={fetchGeozones}
                />
              ) : editDrawerOpen && editingGeozone && draft ? (
                <EditGeofenceDrawer
                  key={editingGeozone.geozone_uid}
                  open={editDrawerOpen}
                  geozone={editingGeozone}
                  draft={draft}
                  onDraftChange={setDraft}
                  shapeChanged={JSON.stringify(draft) !== editBaseline}
                  onClose={handleEditClose}
                  onUpdated={fetchGeozones}
                />
              ) : loading ? (
                <div className="flex items-center justify-center flex-1">
                  <div className="w-5 h-5 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : loadError ? (
                <div className="p-4">
                  <div role="alert" className="text-[12px] text-[#B00020] bg-[#FFF5F5] border border-[#FFD6D6] rounded-lg px-3 py-2">
                    {loadError}
                  </div>
                  <button
                    type="button"
                    onClick={fetchGeozones}
                    className="mt-2 h-8 px-3 rounded-lg border border-[#E9EDEF] bg-white text-[12px] font-extrabold text-[#111B21] cursor-pointer hover:bg-[#F0F2F5]"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <GeofenceList
                  geozones={geozones}
                  selectedUid={selectedUid}
                  search={search}
                  onSearchChange={setSearch}
                  onSelect={setSelectedUid}
                  onEdit={handleEditClick}
                  onDelete={setDeleteConfirm}
                  onAttachDevices={setAttachGeozone}
                />
              )}
            </div>

            {/* Right panel — map */}
            <div className="flex-1 min-w-0 bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
              <GeofenceMap
                geozones={geozones}
                selectedUid={selectedUid}
                onSelectGeozone={setSelectedUid}
                deviceMarkers={deviceMarkers}
                preview={draft ? previewOf(draft) : null}
                hiddenUid={editDrawerOpen ? editingUid : null}
                onMapClick={handleMapClick}
                onPointMoved={handlePointMoved}
                onCenterMoved={handleCenterMoved}
                onUndo={handleUndo}
                onClear={handleClear}
              />
            </div>
          </div>
        ) : activeTab === "device-zones" ? (
          /* Device Zones tab */
          <div className="h-full max-w-2xl">
            <DeviceZones />
          </div>
        ) : (
          /* Groups tab */
          <div className="h-full overflow-y-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <GeofenceGroups geozones={geozones} onGeozonesChanged={fetchGeozones} />
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────── */}
      {/* Create & Edit drawers are now rendered inline in the left panel */}

      <AttachDevicesModal
        open={!!attachGeozone}
        geozone={attachGeozone}
        onClose={() => setAttachGeozone(null)}
        onAttached={() => {}}
      />

      {/* ── Delete confirmation ─────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[150] grid place-items-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-xl p-5 w-[380px] max-w-[calc(100vw-24px)] shadow-xl">
            <div className="font-black text-[15px] text-[#111B21] mb-2">
              Delete Geofence?
            </div>
            <div className="text-[12px] text-[#667781] mb-4">
              Are you sure you want to delete{" "}
              <span className="font-extrabold text-[#111B21]">
                {deleteConfirm.geozone_name}
              </span>
              ? This action cannot be undone.
            </div>
            {deleteError && (
              <div className="text-[11px] text-[#B00020] bg-[#FFF5F5] border border-[#FFD6D6] rounded-lg px-3 py-2 mb-3">
                {deleteError}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="h-9 px-4 rounded-lg border border-[#E9EDEF] bg-white text-[12px] font-extrabold text-[#667781] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isRunning}
                className="h-9 px-4 rounded-lg border-0 bg-[#B00020] text-white text-[12px] font-extrabold cursor-pointer hover:bg-[#8B0018] disabled:opacity-50"
              >
                {deleteMutation.isRunning ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
