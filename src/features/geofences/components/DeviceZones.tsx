/**
 * DeviceZones — Per-device view of attached geofences.
 *
 * Flow:
 *   1. Client selects a device from their fleet
 *   2. Component fetches all geozones attached to that device
 *   3. Each zone shows name + description + detach button
 */
import React, { useState, useCallback, useEffect } from "react";
import { getClientDevices } from "../../../api/services/clients.service";
import {
  getDeviceGeozones,
  detachDeviceFromGeozone,
} from "../../../api/services/geozones.service";
import { useAuth } from "../../../auth/AuthContext";
import { useGuardedMutation, GuardedButton } from "../../../auth/guards";
import type { ClientDevice, DeviceGeozone } from "../../../api/types";

export function DeviceZones() {
  const { state: authState } = useAuth();

  // Device selection
  const [devices, setDevices] = useState<ClientDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [deviceSearch, setDeviceSearch] = useState("");

  // Zones for selected device
  const [zones, setZones] = useState<DeviceGeozone[]>([]);
  const [loadingZones, setLoadingZones] = useState(false);
  const [detachingId, setDetachingId] = useState<string | null>(null);

  // Fetch client devices on mount
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

  // Fetch zones when device selection changes
  const fetchZones = useCallback((imei: string) => {
    if (!imei) {
      setZones([]);
      return;
    }
    setLoadingZones(true);
    getDeviceGeozones(imei)
      .then((res) => {
        if (res.status === "success" && Array.isArray(res.data)) {
          setZones(res.data);
        } else {
          setZones([]);
        }
      })
      .catch(() => setZones([]))
      .finally(() => setLoadingZones(false));
  }, []);

  useEffect(() => {
    fetchZones(selectedDevice);
  }, [selectedDevice, fetchZones]);

  // Detach mutation
  const detachMutation = useGuardedMutation(
    "can_edit_geofence",
    useCallback(
      async (zoneUid: string) => {
        if (!selectedDevice) return;
        setDetachingId(zoneUid);
        try {
          const res = await detachDeviceFromGeozone(zoneUid, selectedDevice);
          if (res.status === "success") {
            setZones((prev) => prev.filter((z) => z.zone_uid !== zoneUid));
          }
        } finally {
          setDetachingId(null);
        }
      },
      [selectedDevice],
    ),
  );

  const filteredDevices = devices.filter((d) => {
    const q = deviceSearch.toLowerCase();
    return (
      d.device_imei.toLowerCase().includes(q) ||
      (d.device_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Device selector */}
      <div className="bg-white border border-[#E9EDEF] rounded-xl p-3 flex flex-col gap-2">
        <div className="text-[12px] font-extrabold text-[#111B21]">Select Device</div>
        <input
          type="text"
          placeholder="Search devices…"
          value={deviceSearch}
          onChange={(e) => setDeviceSearch(e.target.value)}
          className="w-full h-8 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] placeholder:text-[#8696A0] outline-none focus:border-[#128C7E]"
        />

        {loadingDevices ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-4 h-4 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="max-h-40 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex flex-col gap-1">
            {filteredDevices.map((d) => (
              <button
                key={d.device_imei}
                type="button"
                onClick={() => setSelectedDevice(d.device_imei)}
                className={[
                  "w-full text-left px-3 py-2 rounded-lg text-[12px] cursor-pointer border-0 transition-colors",
                  selectedDevice === d.device_imei
                    ? "bg-[#128C7E] text-white font-extrabold"
                    : "bg-[#F0F2F5] text-[#111B21] hover:bg-[#E9EDEF]",
                ].join(" ")}
              >
                <div className="font-extrabold">{d.device_name || d.device_imei}</div>
                <div className={`text-[10px] ${selectedDevice === d.device_imei ? "text-white/80" : "text-[#667781]"}`}>
                  {d.device_imei}
                  {d.car_make ? ` · ${d.car_make} ${d.car_model || ""}` : ""}
                </div>
              </button>
            ))}
            {filteredDevices.length === 0 && (
              <div className="text-center text-[11px] text-[#667781] py-3">No devices found</div>
            )}
          </div>
        )}
      </div>

      {/* Attached zones */}
      {selectedDevice && (
        <div className="bg-white border border-[#E9EDEF] rounded-xl p-3 flex-1 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-extrabold text-[#111B21]">
              Attached Geofences
            </div>
            <span className="text-[10px] font-extrabold bg-[#E9F7F4] text-[#075E54] rounded-full px-2 py-0.5">
              {zones.length}
            </span>
          </div>

          {loadingZones ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-4 h-4 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : zones.length === 0 ? (
            <div className="text-center text-[12px] text-[#667781] py-8">
              No geofences attached to this device
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {zones.map((z) => (
                <div
                  key={z.zone_uid}
                  className="flex items-center justify-between bg-[#F0F2F5] border border-[#E9EDEF] rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="font-extrabold text-[12px] text-[#111B21] truncate">
                      {z.zone_name}
                    </div>
                    <div className="text-[10px] text-[#667781] truncate">
                      {z.zone_description}
                    </div>
                  </div>

                  <GuardedButton
                    permission="can_edit_geofence"
                    fallback="hide"
                    onClick={() => detachMutation.mutate(z.zone_uid)}
                    disabled={detachingId === z.zone_uid}
                    className="shrink-0 ml-2 h-6 px-2 text-[10px] font-extrabold rounded-md bg-[#FFF5F5] border border-[#FFD6D6] text-[#B00020] hover:bg-[#FFD6D6] cursor-pointer disabled:opacity-50"
                  >
                    {detachingId === z.zone_uid ? "…" : "Detach"}
                  </GuardedButton>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
