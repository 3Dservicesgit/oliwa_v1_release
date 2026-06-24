/**
 * DeviceZones — All devices with their attached geofences at a glance.
 *
 * Tapping a device opens a detail blade with:
 *   - Device info (name, IMEI, car make/model)
 *   - Attached geofences list with Detach action
 *   - "Add to Geofence" picker to attach the device to new zones
 */
import React, { useState, useCallback, useEffect } from "react";
import { getClientDevices } from "../../../api/services/clients.service";
import {
  getGeozones,
  getDeviceGeozones,
  detachDeviceFromGeozone,
  attachDevicesToGeozone,
} from "../../../api/services/geozones.service";
import { parseGeozonePoints } from "../../../api/types/geozones.types";
import { useAuth } from "../../../auth/AuthContext";
import { useGuardedMutation, GuardedButton } from "../../../auth/guards";
import type { ClientDevice, DeviceGeozone, Geozone } from "../../../api/types";

interface DeviceWithZones {
  imei: string;
  name: string;
  carMake: string;
  carModel: string;
  carType: string;
  zones: DeviceGeozone[];
  loading: boolean;
}

export function DeviceZones() {
  const { state: authState } = useAuth();

  // ── All devices + their zones ──────────────────────────────────────────
  const [devices, setDevices] = useState<ClientDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [allDeviceZones, setAllDeviceZones] = useState<DeviceWithZones[]>([]);
  const [search, setSearch] = useState("");

  // ── Detail blade state ─────────────────────────────────────────────────
  const [selectedImei, setSelectedImei] = useState<string | null>(null);
  const [bladeZones, setBladeZones] = useState<DeviceGeozone[]>([]);
  const [bladeLoading, setBladeLoading] = useState(false);
  const [detachingId, setDetachingId] = useState<string | null>(null);

  // ── Add-to-geofence picker ─────────────────────────────────────────────
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [allGeozones, setAllGeozones] = useState<Geozone[]>([]);
  const [loadingGeozones, setLoadingGeozones] = useState(false);
  const [attachingZone, setAttachingZone] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  // ── Fetch client devices on mount ──────────────────────────────────────
  useEffect(() => {
    if (!authState.accountRoot) return;
    setLoadingDevices(true);
    getClientDevices(authState.accountRoot)
      .then((res) => {
        if (res.status === "success" && Array.isArray(res.data)) {
          setDevices(res.data);
        }
      })
      .finally(() => setLoadingDevices(false));
  }, [authState.accountRoot]);

  // ── Fetch all device zones once devices are loaded ─────────────────────
  useEffect(() => {
    if (devices.length === 0) return;
    let cancelled = false;

    const items: DeviceWithZones[] = devices.map((d) => ({
      imei: d.device_imei,
      name: d.device_name || d.device_imei,
      carMake: d.car_make || "",
      carModel: d.car_model || "",
      carType: d.car_type || "",
      zones: [],
      loading: true,
    }));
    setAllDeviceZones(items);

    (async () => {
      const batchSize = 5;
      for (let i = 0; i < items.length; i += batchSize) {
        if (cancelled) return;
        const batch = items.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (item) => {
            try {
              const res = await getDeviceGeozones(item.imei);
              if (cancelled) return;
              if (res.status === "success" && Array.isArray(res.data)) {
                item.zones = res.data;
              }
            } catch { /* skip */ }
            item.loading = false;
          }),
        );
        if (!cancelled) setAllDeviceZones([...items]);
      }
    })();

    return () => { cancelled = true; };
  }, [devices]);

  // ── Open blade for a device ────────────────────────────────────────────
  const openBlade = useCallback((imei: string) => {
    setSelectedImei(imei);
    setShowAddPicker(false);
    setPickerSearch("");
    setBladeLoading(true);
    getDeviceGeozones(imei)
      .then((res) => {
        if (res.status === "success" && Array.isArray(res.data)) {
          setBladeZones(res.data);
        } else {
          setBladeZones([]);
        }
      })
      .catch(() => setBladeZones([]))
      .finally(() => setBladeLoading(false));
  }, []);

  const closeBlade = () => {
    setSelectedImei(null);
    setBladeZones([]);
    setShowAddPicker(false);
  };

  // ── Detach a zone from the selected device ─────────────────────────────
  const detachMutation = useGuardedMutation(
    "can_edit_geofence",
    useCallback(
      async (zoneUid: string) => {
        if (!selectedImei) return;
        setDetachingId(zoneUid);
        try {
          const res = await detachDeviceFromGeozone(zoneUid, selectedImei);
          if (res.status === "success") {
            setBladeZones((prev) => prev.filter((z) => z.zone_uid !== zoneUid));
            // Also update the overview list
            setAllDeviceZones((prev) =>
              prev.map((d) =>
                d.imei === selectedImei
                  ? { ...d, zones: d.zones.filter((z) => z.zone_uid !== zoneUid) }
                  : d,
              ),
            );
          }
        } finally {
          setDetachingId(null);
        }
      },
      [selectedImei],
    ),
  );

  // ── Load all geozones for the add picker ───────────────────────────────
  const openAddPicker = useCallback(() => {
    if (!authState.accountRoot) return;
    setShowAddPicker(true);
    setPickerSearch("");
    setLoadingGeozones(true);
    getGeozones(authState.accountRoot, "client")
      .then((res) => {
        if (res.status === "success" && Array.isArray(res.data)) {
          setAllGeozones(res.data);
        }
      })
      .finally(() => setLoadingGeozones(false));
  }, [authState.accountRoot]);

  // ── Attach device to a geofence ────────────────────────────────────────
  const attachMutation = useGuardedMutation(
    "can_edit_geofence",
    useCallback(
      async (geozoneUid: string) => {
        if (!selectedImei) return;
        setAttachingZone(geozoneUid);
        try {
          const res = await attachDevicesToGeozone(geozoneUid, { devices: [selectedImei] });
          if (res.status === "success") {
            // Refresh blade zones
            const refreshed = await getDeviceGeozones(selectedImei);
            if (refreshed.status === "success" && Array.isArray(refreshed.data)) {
              setBladeZones(refreshed.data);
              // Update overview
              setAllDeviceZones((prev) =>
                prev.map((d) =>
                  d.imei === selectedImei ? { ...d, zones: refreshed.data } : d,
                ),
              );
            }
          }
        } finally {
          setAttachingZone(null);
        }
      },
      [selectedImei],
    ),
  );

  // ── Derived data ───────────────────────────────────────────────────────
  const selectedDevice = selectedImei
    ? devices.find((d) => d.device_imei === selectedImei)
    : null;

  const filteredOverview = allDeviceZones.filter((d) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      d.name.toLowerCase().includes(q) ||
      d.imei.toLowerCase().includes(q) ||
      [d.carMake, d.carModel].join(" ").toLowerCase().includes(q) ||
      d.zones.some((z) => z.zone_name.toLowerCase().includes(q))
    );
  });

  const totalAttached = allDeviceZones.filter((d) => d.zones.length > 0).length;

  // Geozones not already attached for the add picker
  const attachedUids = new Set(bladeZones.map((z) => z.zone_uid));
  const availableGeozones = allGeozones.filter((gz) => {
    if (attachedUids.has(gz.geozone_uid)) return false;
    if (!pickerSearch) return true;
    const q = pickerSearch.toLowerCase();
    return (
      gz.geozone_name.toLowerCase().includes(q) ||
      gz.geozone_description.toLowerCase().includes(q)
    );
  });

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 h-full relative">
      {/* Header + stats */}
      <div className="bg-white border border-[#E9EDEF] rounded-xl p-3 flex flex-col gap-2 min-h-0 flex-1">
        <div className="flex items-center justify-between">
          <div className="text-[12px] font-extrabold text-[#111B21]">
            All Devices &amp; Their Geofences
          </div>
          <span className="text-[10px] font-extrabold bg-[#E9F7F4] text-[#075E54] rounded-full px-2 py-0.5">
            {totalAttached}/{allDeviceZones.length} with zones
          </span>
        </div>

        <input
          type="text"
          placeholder="Search devices or zones…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-8 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] placeholder:text-[#8696A0] outline-none focus:border-[#128C7E]"
        />

        {loadingDevices ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex flex-col gap-1.5">
            {filteredOverview.map((d) => (
              <button
                key={d.imei}
                type="button"
                onClick={() => openBlade(d.imei)}
                className={[
                  "w-full text-left bg-[#F8F9FA] border rounded-lg px-3 py-2.5 cursor-pointer transition-colors",
                  selectedImei === d.imei
                    ? "border-[#128C7E] bg-[#E9F7F4]"
                    : "border-[#E9EDEF] hover:border-[#128C7E] hover:bg-[#F0FAF8]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-extrabold text-[12px] text-[#111B21] truncate">
                      {d.name}
                    </div>
                    <div className="text-[10px] text-[#667781] truncate">
                      {d.imei}
                      {d.carMake ? ` · ${d.carMake} ${d.carModel}`.trim() : ""}
                    </div>
                  </div>
                  {d.loading ? (
                    <div className="w-3 h-3 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : (
                    <span className={[
                      "shrink-0 text-[10px] font-extrabold rounded-full px-2 py-0.5",
                      d.zones.length > 0
                        ? "bg-[#E9F7F4] text-[#075E54]"
                        : "bg-[#F0F2F5] text-[#667781]",
                    ].join(" ")}>
                      {d.zones.length} zone{d.zones.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* Zone pills */}
                {d.zones.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {d.zones.map((z) => (
                      <span
                        key={z.zone_uid}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#E9F7F4] border border-[#C2E8E1] text-[10px] font-extrabold text-[#075E54]"
                        title={z.zone_description}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#128C7E]" />
                        {z.zone_name}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
            {filteredOverview.length === 0 && !loadingDevices && (
              <div className="text-center text-[12px] text-[#667781] py-8">
                {search ? "No devices match your search." : "No devices configured."}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Detail Blade (slide-over) ───────────────────────────────────── */}
      {selectedImei && selectedDevice && (
        <div className="fixed inset-0 top-12 z-[110] flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/25" onClick={closeBlade} />

          {/* Blade panel */}
          <div className="relative w-[400px] max-w-[calc(100vw-24px)] bg-white shadow-2xl flex flex-col animate-[slideIn_0.2s_ease-out]">
            {/* Blade header */}
            <div className="shrink-0 bg-[#128C7E] px-5 py-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-[16px] font-black text-white truncate">
                    {selectedDevice.device_name || selectedDevice.device_imei}
                  </div>
                  <div className="text-[11px] text-white/60 font-mono mt-1">
                    {selectedDevice.device_imei}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeBlade}
                  className="w-7 h-7 rounded-full bg-white/20 text-white text-[16px] font-bold
                    flex items-center justify-center border-none cursor-pointer hover:bg-white/30 shrink-0 ml-2"
                >
                  ×
                </button>
              </div>

              {/* Device info chips */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {selectedDevice.car_make && (
                  <span className="text-[10px] font-extrabold bg-white/20 text-white px-2 py-0.5 rounded-full">
                    {selectedDevice.car_make} {selectedDevice.car_model || ""}
                  </span>
                )}
                {selectedDevice.car_type && (
                  <span className="text-[10px] font-extrabold bg-white/20 text-white px-2 py-0.5 rounded-full">
                    {selectedDevice.car_type}
                  </span>
                )}
                <span className="text-[10px] font-extrabold bg-white/20 text-white px-2 py-0.5 rounded-full">
                  {bladeZones.length} geofence{bladeZones.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Blade body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: "thin" }}>
              {/* ── Attached Geofences ─────────────────────────────────── */}
              <div className="flex items-center justify-between mb-3">
                <div className="text-[13px] font-black text-[#111B21]">Attached Geofences</div>
                <GuardedButton
                  permission="can_edit_geofence"
                  fallback="hide"
                  onClick={openAddPicker}
                  className="h-7 px-3 rounded-lg border-0 bg-[#128C7E] text-white text-[11px] font-extrabold cursor-pointer hover:bg-[#0D7466] transition-colors"
                >
                  + Add to Geofence
                </GuardedButton>
              </div>

              {bladeLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : bladeZones.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-[28px] mb-2">📍</div>
                  <div className="text-[12px] text-[#667781]">
                    No geofences attached to this device yet.
                  </div>
                  <div className="text-[11px] text-[#8696A0] mt-1">
                    Tap "Add to Geofence" to link this device to a zone.
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {bladeZones.map((z) => (
                    <div
                      key={z.zone_uid}
                      className="flex items-center justify-between bg-[#F8F9FA] border border-[#E9EDEF] rounded-lg px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#128C7E] shrink-0" />
                          <span className="font-extrabold text-[12px] text-[#111B21] truncate">
                            {z.zone_name}
                          </span>
                        </div>
                        {z.zone_description && (
                          <div className="text-[10px] text-[#667781] truncate mt-0.5 ml-3.5">
                            {z.zone_description}
                          </div>
                        )}
                      </div>

                      <GuardedButton
                        permission="can_edit_geofence"
                        fallback="hide"
                        onClick={() => detachMutation.mutate(z.zone_uid)}
                        disabled={detachingId === z.zone_uid}
                        className="shrink-0 ml-2 h-7 px-2.5 text-[10px] font-extrabold rounded-lg
                          bg-[#FFF5F5] border border-[#FFD6D6] text-[#B00020]
                          hover:bg-[#FFD6D6] cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        {detachingId === z.zone_uid ? "…" : "Detach"}
                      </GuardedButton>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Add to Geofence Picker ─────────────────────────────── */}
              {showAddPicker && (
                <div className="mt-5 border-t border-[#E9EDEF] pt-4">
                  <div className="text-[13px] font-black text-[#111B21] mb-2">
                    Add to Geofence
                  </div>
                  <input
                    type="text"
                    placeholder="Search geofences…"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    className="w-full h-8 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21]
                      placeholder:text-[#8696A0] outline-none focus:border-[#128C7E] mb-2"
                  />

                  {loadingGeozones ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="w-4 h-4 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : availableGeozones.length === 0 ? (
                    <div className="text-center text-[12px] text-[#667781] py-4">
                      {allGeozones.length === 0
                        ? "No geofences created yet."
                        : attachedUids.size === allGeozones.length
                          ? "Device is already attached to all geofences."
                          : "No matching geofences."}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {availableGeozones.map((gz) => (
                        <div
                          key={gz.geozone_uid}
                          className="flex items-center justify-between bg-[#F0F2F5] border border-[#E9EDEF] rounded-lg px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-extrabold text-[12px] text-[#111B21] truncate">
                              {gz.geozone_name}
                            </div>
                            <div className="text-[10px] text-[#667781] truncate">
                              {gz.geozone_description || "—"}
                            </div>
                          </div>
                          <GuardedButton
                            permission="can_edit_geofence"
                            fallback="hide"
                            onClick={() => attachMutation.mutate(gz.geozone_uid)}
                            disabled={attachingZone === gz.geozone_uid}
                            className="shrink-0 ml-2 h-7 px-2.5 text-[10px] font-extrabold rounded-lg
                              bg-[#E9F7F4] border border-[#C2E8E1] text-[#075E54]
                              hover:bg-[#C2E8E1] cursor-pointer disabled:opacity-50 transition-colors"
                          >
                            {attachingZone === gz.geozone_uid ? "…" : "+ Attach"}
                          </GuardedButton>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowAddPicker(false)}
                    className="mt-3 w-full h-8 rounded-lg border border-[#E9EDEF] bg-white
                      text-[11px] font-extrabold text-[#667781] cursor-pointer hover:bg-[#F0F2F5] transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Slide-in animation */}
          <style>{`
            @keyframes slideIn {
              from { transform: translateX(100%); }
              to   { transform: translateX(0); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
