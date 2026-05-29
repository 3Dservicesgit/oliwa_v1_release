/**
 * CreateGeofenceDrawer — Slide-in drawer for saving a newly drawn polygon.
 *
 * Opens after the user finishes drawing on the map. The polygon path is
 * passed in; the user provides a name and description, then saves.
 */
import React, { useState, useCallback, useEffect } from "react";
import { createGeozone } from "../../../api/services/geozones.service";
import { useAuth } from "../../../auth/AuthContext";
import { useGuardedMutation } from "../../../auth/guards";
import type { LatLng } from "../../../api/types";
import { serializeGeozonePoints } from "../../../api/types/geozones.types";

interface CreateGeofenceDrawerProps {
  open: boolean;
  /** The polygon path the user just drew. */
  drawnPath: LatLng[] | null;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateGeofenceDrawer({
  open,
  drawnPath,
  onClose,
  onCreated,
}: CreateGeofenceDrawerProps) {
  const { state: authState } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset form when drawer opens/closes
  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setError(null);
    }
  }, [open]);

  const createMutation = useGuardedMutation(
    "can_create_geofence",
    useCallback(async () => {
      if (!drawnPath || drawnPath.length < 3) {
        setError("A geofence needs at least 3 points.");
        return;
      }
      if (name.trim().length < 5) {
        setError("Name must be at least 5 characters.");
        return;
      }
      if (description.trim().length < 6) {
        setError("Description must be at least 6 characters.");
        return;
      }
      setError(null);
      const res = await createGeozone({
        geozone_name: name.trim(),
        geozone_decription: description.trim(),
        geozone_points: serializeGeozonePoints(drawnPath),
        geozone_owner: authState.accountRoot || "",
      });
      if (res.status === "success") {
        onCreated?.();
        onClose();
      } else {
        setError(res.message || "Failed to create geofence.");
      }
    }, [name, description, drawnPath, authState.accountRoot, onCreated, onClose]),
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer panel */}
      <div className="relative w-[400px] max-w-full bg-white h-full flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E9EDEF] shrink-0">
          <div>
            <div className="font-black text-[15px] text-[#111B21]">Save Geofence</div>
            <div className="text-[11px] text-[#667781] mt-0.5">
              {drawnPath?.length ?? 0} vertices drawn
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[#667781] font-black text-[13px] cursor-pointer grid place-items-center"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-5 flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-extrabold text-[#667781] mb-1">
              Geofence Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Warehouse Zone A"
              className="w-full h-9 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] placeholder:text-[#8696A0] outline-none focus:border-[#128C7E]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-extrabold text-[#667781] mb-1">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this geofence area…"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] placeholder:text-[#8696A0] outline-none focus:border-[#128C7E] resize-none"
            />
          </div>

          {/* Polygon info */}
          <div className="bg-[#F0F2F5] border border-[#E9EDEF] rounded-xl p-3">
            <div className="text-[11px] font-extrabold text-[#667781] mb-1">Polygon Preview</div>
            <div className="text-[11px] text-[#111B21]">
              {drawnPath?.length ?? 0} coordinate points captured
            </div>
            {drawnPath && drawnPath.length > 0 && (
              <div className="mt-1 text-[10px] text-[#667781] font-mono max-h-20 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {drawnPath.slice(0, 5).map((p, i) => (
                  <div key={i}>
                    [{p.lat.toFixed(6)}, {p.lng.toFixed(6)}]
                  </div>
                ))}
                {drawnPath.length > 5 && (
                  <div>…and {drawnPath.length - 5} more</div>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="text-[11px] text-[#B00020] bg-[#FFF5F5] border border-[#FFD6D6] rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-3 border-t border-[#E9EDEF] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-[#E9EDEF] bg-white text-[12px] font-extrabold text-[#667781] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isRunning}
            className="flex-1 h-9 rounded-lg border-0 bg-[#128C7E] text-white text-[12px] font-extrabold cursor-pointer hover:bg-[#0D7466] disabled:opacity-50"
          >
            {createMutation.isRunning ? "Saving…" : "Save Geofence"}
          </button>
        </div>
      </div>
    </div>
  );
}
