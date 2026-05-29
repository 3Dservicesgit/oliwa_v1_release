/**
 * AttachDevicesModal — Select devices from the client's fleet and attach
 * them to a specific geofence.
 *
 * Flow:
 *   1. Fetches client devices via getClientDevices(accountRoot)
 *   2. User checks one or more devices
 *   3. Submit → attachDevicesToGeozone(geozoneId, { devices: [...imeis] })
 */
import React, { useState, useCallback, useEffect } from "react";
import { getClientDevices } from "../../../api/services/clients.service";
import { attachDevicesToGeozone } from "../../../api/services/geozones.service";
import { useAuth } from "../../../auth/AuthContext";
import { useGuardedMutation } from "../../../auth/guards";
import type { ClientDevice, ParsedGeozone } from "../../../api/types";

interface AttachDevicesModalProps {
  open: boolean;
  geozone: ParsedGeozone | null;
  onClose: () => void;
  onAttached?: () => void;
}

export function AttachDevicesModal({
  open,
  geozone,
  onClose,
  onAttached,
}: AttachDevicesModalProps) {
  const { state: authState } = useAuth();
  const [devices, setDevices] = useState<ClientDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fetch devices on open
  useEffect(() => {
    if (!open || !authState.accountRoot) return;
    setLoading(true);
    setSelected(new Set());
    setSearch("");
    setError(null);
    getClientDevices(authState.accountRoot)
      .then((res) => {
        if (res.status === "success" && Array.isArray(res.data)) {
          setDevices(res.data);
        } else {
          setDevices([]);
        }
      })
      .catch(() => setDevices([]))
      .finally(() => setLoading(false));
  }, [open, authState.accountRoot]);

  const toggle = (imei: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(imei)) next.delete(imei);
      else next.add(imei);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredDevices.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredDevices.map((d) => d.device_imei)));
    }
  };

  const filteredDevices = devices.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.device_imei.toLowerCase().includes(q) ||
      (d.device_name || "").toLowerCase().includes(q) ||
      (d.car_make || "").toLowerCase().includes(q) ||
      (d.car_model || "").toLowerCase().includes(q)
    );
  });

  const attachMutation = useGuardedMutation(
    "can_edit_geofence",
    useCallback(async () => {
      if (!geozone || selected.size === 0) return;
      setError(null);
      const res = await attachDevicesToGeozone(geozone.geozone_uid, {
        devices: Array.from(selected),
      });
      if (res.status === "success") {
        onAttached?.();
        onClose();
      } else {
        setError(res.message || "Failed to attach devices.");
      }
    }, [geozone, selected, onAttached, onClose]),
  );

  if (!open || !geozone) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-[520px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-48px)] bg-white rounded-xl flex flex-col shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E9EDEF] shrink-0">
          <div>
            <div className="font-black text-[15px] text-[#111B21]">Attach Devices</div>
            <div className="text-[11px] text-[#667781] mt-0.5">
              to <span className="font-extrabold text-[#128C7E]">{geozone.geozone_name}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[#667781] font-black text-[13px] cursor-pointer grid place-items-center"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-2 border-b border-[#E9EDEF] shrink-0">
          <input
            type="text"
            placeholder="Search devices by IMEI, name, or vehicle…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] placeholder:text-[#8696A0] outline-none focus:border-[#128C7E]"
          />
        </div>

        {/* Device list */}
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="text-center text-[12px] text-[#667781] py-12">
              {devices.length === 0 ? "No devices found" : "No devices match search"}
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#E9EDEF] bg-[#F8FAFC]">
                  <th className="w-10 px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={selected.size === filteredDevices.length && filteredDevices.length > 0}
                      onChange={toggleAll}
                      className="accent-[#128C7E]"
                    />
                  </th>
                  <th className="text-left px-3 py-2 font-extrabold text-[#667781]">IMEI</th>
                  <th className="text-left px-3 py-2 font-extrabold text-[#667781]">Name</th>
                  <th className="text-left px-3 py-2 font-extrabold text-[#667781]">Vehicle</th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map((d) => (
                  <tr
                    key={d.device_imei}
                    onClick={() => toggle(d.device_imei)}
                    className={[
                      "border-b border-[#E9EDEF] last:border-0 cursor-pointer transition-colors",
                      selected.has(d.device_imei) ? "bg-[#E9F7F4]" : "hover:bg-[#F8FAFC]",
                    ].join(" ")}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(d.device_imei)}
                        onChange={() => toggle(d.device_imei)}
                        className="accent-[#128C7E]"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-[#111B21]">{d.device_imei}</td>
                    <td className="px-3 py-2 text-[#111B21]">{d.device_name || "—"}</td>
                    <td className="px-3 py-2 text-[#667781]">
                      {[d.car_make, d.car_model].filter(Boolean).join(" ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-2 text-[11px] text-[#B00020] bg-[#FFF5F5] border border-[#FFD6D6] rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#E9EDEF] shrink-0">
          <span className="text-[11px] text-[#667781]">
            {selected.size} device{selected.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-lg border border-[#E9EDEF] bg-white text-[12px] font-extrabold text-[#667781] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => attachMutation.mutate()}
              disabled={selected.size === 0 || attachMutation.isRunning}
              className="h-9 px-4 rounded-lg border-0 bg-[#128C7E] text-white text-[12px] font-extrabold cursor-pointer hover:bg-[#0D7466] disabled:opacity-50"
            >
              {attachMutation.isRunning ? "Attaching…" : "Attach"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
