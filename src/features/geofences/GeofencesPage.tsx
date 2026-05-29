/**
 * GeofencesPage — Client-facing Geofences & Zones module.
 *
 * Layout: split-panel
 *   Left panel  — GeofenceList (card list with search) + action drawers/modals
 *   Right panel — GeofenceMap (interactive Google Maps with polygon drawing)
 *
 * Tabs:
 *   "my-geofences"  — CRUD geofences with map integration
 *   "device-zones"  — Per-device view of attached geofences
 */
import React, { useState, useCallback, useEffect } from "react";
import { getGeozones, deleteGeozone } from "../../api/services/geozones.service";
import { useAuth } from "../../auth/AuthContext";
import { useGuardedMutation, GuardedButton } from "../../auth/guards";
import { parseGeozonePoints } from "../../api/types/geozones.types";
import type { ParsedGeozone, LatLng, Geozone } from "../../api/types";

import { GeofenceMap } from "./components/GeofenceMap";
import { GeofenceList } from "./components/GeofenceList";
import { CreateGeofenceDrawer } from "./components/CreateGeofenceDrawer";
import { EditGeofenceDrawer } from "./components/EditGeofenceDrawer";
import { AttachDevicesModal } from "./components/AttachDevicesModal";
import { DeviceZones } from "./components/DeviceZones";

type GeofenceTab = "my-geofences" | "device-zones";

const TABS: { key: GeofenceTab; label: string }[] = [
  { key: "my-geofences", label: "My Geofences" },
  { key: "device-zones", label: "Device Zones" },
];

export function GeofencesPage() {
  const { state: authState } = useAuth();
  const [activeTab, setActiveTab] = useState<GeofenceTab>("my-geofences");

  // ── Data ────────────────────────────────────────────────────────────────
  const [geozones, setGeozones] = useState<ParsedGeozone[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGeozones = useCallback(() => {
    if (!authState.accountRoot) return;
    setLoading(true);
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
      .catch(() => setGeozones([]))
      .finally(() => setLoading(false));
  }, [authState.accountRoot]);

  useEffect(() => {
    fetchGeozones();
  }, [fetchGeozones]);

  // ── Selection / interaction state ───────────────────────────────────────
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Drawing mode
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawnPath, setDrawnPath] = useState<LatLng[] | null>(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);

  // Editing
  const [editingGeozone, setEditingGeozone] = useState<ParsedGeozone | null>(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editedPath, setEditedPath] = useState<LatLng[] | null>(null);

  // Attach devices
  const [attachGeozone, setAttachGeozone] = useState<ParsedGeozone | null>(null);

  // ── Drawing handlers ────────────────────────────────────────────────────
  const handleStartDrawing = () => {
    setDrawingMode(true);
    setSelectedUid(null);
    setEditingUid(null);
  };

  const handlePolygonComplete = (path: LatLng[]) => {
    setDrawingMode(false);
    setDrawnPath(path);
    setCreateDrawerOpen(true);
  };

  const handleCancelDrawing = () => {
    setDrawingMode(false);
    setDrawnPath(null);
  };

  // ── Edit handlers ───────────────────────────────────────────────────────
  const handleEditClick = (gz: ParsedGeozone) => {
    setEditingGeozone(gz);
    setEditingUid(gz.geozone_uid);
    setEditedPath(null);
    setSelectedUid(gz.geozone_uid);
    setEditDrawerOpen(true);
  };

  const handlePolygonEdited = (_uid: string, newPath: LatLng[]) => {
    setEditedPath(newPath);
  };

  const handleEditClose = () => {
    setEditDrawerOpen(false);
    setEditingUid(null);
    setEditedPath(null);
    setEditingGeozone(null);
  };

  // ── Delete handler ──────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<ParsedGeozone | null>(null);

  const deleteMutation = useGuardedMutation(
    "can_delete_geofence",
    useCallback(async () => {
      if (!deleteConfirm) return;
      const res = await deleteGeozone(deleteConfirm.geozone_uid);
      if (res.status === "success") {
        setGeozones((prev) =>
          prev.filter((g) => g.geozone_uid !== deleteConfirm.geozone_uid),
        );
        if (selectedUid === deleteConfirm.geozone_uid) setSelectedUid(null);
      }
      setDeleteConfirm(null);
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
            {activeTab === "my-geofences" && !drawingMode && (
              <GuardedButton
                permission="can_create_geofence"
                fallback="disable"
                onClick={handleStartDrawing}
                className="shrink-0 h-8 px-4 rounded-lg border-0 bg-[#128C7E] text-white text-[12px] font-extrabold cursor-pointer hover:bg-[#0D7466]"
              >
                + Mark Geofence
              </GuardedButton>
            )}
            {activeTab === "my-geofences" && drawingMode && (
              <button
                type="button"
                onClick={handleCancelDrawing}
                className="shrink-0 h-8 px-4 rounded-lg border border-[#E9EDEF] bg-white text-[12px] font-extrabold text-[#667781] cursor-pointer"
              >
                Cancel Drawing
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
                setDrawingMode(false);
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

        {/* Drawing mode banner */}
        {drawingMode && (
          <div className="bg-[#E9F7F4] border border-[#C2E8E1] rounded-xl px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
            <span className="text-[12px] font-extrabold text-[#075E54]">
              Drawing mode active — click on the map to place polygon vertices, then close the shape
            </span>
          </div>
        )}
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 p-3 pt-2">
        {activeTab === "my-geofences" ? (
          <div className="flex gap-3 h-full">
            {/* Left panel — list OR edit panel */}
            <div className="w-[340px] shrink-0 flex flex-col gap-2">
              {/* Inline edit panel (replaces list when editing) */}
              {editDrawerOpen && editingGeozone ? (
                <EditGeofenceDrawer
                  open={editDrawerOpen}
                  geozone={editingGeozone}
                  editedPath={editedPath}
                  onClose={handleEditClose}
                  onUpdated={fetchGeozones}
                />
              ) : loading ? (
                <div className="flex items-center justify-center flex-1">
                  <div className="w-5 h-5 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
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
                drawingMode={drawingMode}
                onPolygonComplete={handlePolygonComplete}
                editingUid={editingUid}
                onPolygonEdited={handlePolygonEdited}
              />
            </div>
          </div>
        ) : (
          /* Device Zones tab */
          <div className="h-full max-w-2xl">
            <DeviceZones />
          </div>
        )}
      </div>

      {/* ── Drawers & Modals ────────────────────────────────────────────── */}
      <CreateGeofenceDrawer
        open={createDrawerOpen}
        drawnPath={drawnPath}
        onClose={() => {
          setCreateDrawerOpen(false);
          setDrawnPath(null);
        }}
        onCreated={fetchGeozones}
      />

      {/* EditGeofenceDrawer is now rendered inline in the left panel */}

      <AttachDevicesModal
        open={!!attachGeozone}
        geozone={attachGeozone}
        onClose={() => setAttachGeozone(null)}
        onAttached={() => {}}
      />

      {/* ── Delete confirmation ─────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 grid place-items-center">
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
