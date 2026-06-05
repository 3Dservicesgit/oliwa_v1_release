/**
 * EditGeofenceDrawer — Inline panel for editing an existing geofence.
 *
 * Renders as a side panel BELOW the geofence list (not a full-screen overlay)
 * so the user can still interact with the map to drag polygon vertices.
 */
import React, { useState, useCallback, useEffect } from "react";
import { updateGeozone } from "../../../api/services/geozones.service";
import { useGuardedMutation } from "../../../auth/guards";
import type { ParsedGeozone, LatLng } from "../../../api/types";
import { serializeGeozonePoints } from "../../../api/types/geozones.types";

interface EditGeofenceDrawerProps {
  open: boolean;
  geozone: ParsedGeozone | null;
  /** Updated path if user dragged vertices on the map. */
  editedPath?: LatLng[] | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export function EditGeofenceDrawer({
  open,
  geozone,
  editedPath,
  onClose,
  onUpdated,
}: EditGeofenceDrawerProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Populate form when geozone changes
  useEffect(() => {
    if (open && geozone) {
      setName(geozone.geozone_name);
      setDescription(geozone.geozone_description);
      setError(null);
    }
  }, [open, geozone]);

  const updateMutation = useGuardedMutation(
    "can_edit_geofence",
    useCallback(async () => {
      if (!geozone) return;
      if (name.trim().length < 5) {
        setError("Name must be at least 5 characters.");
        return;
      }
      if (description.trim().length < 6) {
        setError("Description must be at least 6 characters.");
        return;
      }
      setError(null);

      const pathToSave = editedPath && editedPath.length >= 3 ? editedPath : geozone.path;

      const res = await updateGeozone(geozone.geozone_uid, {
        new_geozone_name: name.trim(),
        new_geozone_decription: description.trim(),
        new_geozone_points: serializeGeozonePoints(pathToSave),
      });

      if (res.status === "success") {
        onUpdated?.();
        onClose();
      } else {
        setError(res.message || "Failed to update geofence.");
      }
    }, [geozone, name, description, editedPath, onUpdated, onClose]),
  );

  if (!open || !geozone) return null;

  const currentPath = editedPath && editedPath.length >= 3 ? editedPath : geozone.path;
  const pathChanged = editedPath && editedPath.length >= 3;

  return (
    <div className="bg-white border border-[#128C7E] rounded-xl shadow-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#128C7E] shrink-0">
        <div>
          <div className="font-black text-[13px] text-white">Edit Geofence</div>
          <div className="text-[10px] text-white/70 mt-0.5">
            Drag vertices on the map to reshape
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-md bg-white/20 border-0 text-white font-black text-[12px] cursor-pointer grid place-items-center hover:bg-white/30"
        >
          ✕
        </button>
      </div>

      {/* Editing active banner */}
      <div className="px-4 py-2 bg-[#E9F7F4] border-b border-[#C2E8E1] flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
        <span className="text-[11px] font-extrabold text-[#075E54]">
          Edit mode active — drag the white squares on the map to reshape
        </span>
      </div>

      {/* Form */}
      <div className="p-4 flex flex-col gap-3">
        {/* Name */}
        <div>
          <label className="block text-[10px] font-extrabold text-[#667781] mb-1">
            Geofence Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-8 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E]"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-[10px] font-extrabold text-[#667781] mb-1">
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] resize-none"
          />
        </div>

        {/* Polygon status */}
        <div className="bg-[#F0F2F5] border border-[#E9EDEF] rounded-lg p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-[#667781]">
              Polygon: {currentPath.length} points
            </span>
            {pathChanged && (
              <span className="text-[10px] font-extrabold text-[#128C7E]">
                Modified
              </span>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="text-[11px] text-[#B00020] bg-[#FFF5F5] border border-[#FFD6D6] rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-8 rounded-lg border border-[#E9EDEF] bg-white text-[11px] font-extrabold text-[#667781] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isRunning}
            className="flex-1 h-8 rounded-lg border-0 bg-[#128C7E] text-white text-[11px] font-extrabold cursor-pointer hover:bg-[#0D7466] disabled:opacity-50"
          >
            {updateMutation.isRunning ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
