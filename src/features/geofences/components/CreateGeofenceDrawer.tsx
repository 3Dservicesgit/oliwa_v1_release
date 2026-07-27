/**
 * CreateGeofenceDrawer — Inline panel for saving a newly drawn polygon.
 *
 * Renders as a side panel in the left column (not a full-screen overlay)
 * so the user can still interact with the map to drag polygon vertices
 * and extend the geofence shape before saving.
 */
import React, { useState, useCallback, useEffect } from "react";
import { createGeozone } from "../../../api/services/geozones.service";
import { useAuth } from "../../../auth/AuthContext";
import { useGuardedMutation } from "../../../auth/guards";
import type { LatLng } from "../../../api/types";
import { serializeGeozonePoints } from "../../../api/types/geozones.types";

/** Preset colors for quick selection. */
const COLOR_PRESETS = [
  "#128C7E", "#075E54", "#25D366", "#3B82F6", "#8B5CF6",
  "#EF4444", "#F97316", "#F59E0B", "#10B981", "#EC4899",
];

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
  const [geofenceColor, setGeofenceColor] = useState("#128C7E");
  const [labelColor, setLabelColor] = useState("#075E54");
  const [error, setError] = useState<string | null>(null);

  // Reset form when drawer opens/closes
  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setGeofenceColor("#128C7E");
      setLabelColor("#075E54");
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
      if (!authState.accountRoot) {
        setError("Session expired — please log in again.");
        return;
      }
      setError(null);
      try {
        const res = await createGeozone({
          geozone_name: name.trim(),
          geozone_decription: description.trim(),
          geozone_points: serializeGeozonePoints(drawnPath),
          geozone_owner: authState.accountRoot,
          geozone_color: geofenceColor,
          geozone_label_color: labelColor,
        });
        if (res.status === "success") {
          onCreated?.();
          onClose();
        } else {
          setError(res.message || "Failed to create geofence.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create geofence.");
      }
    }, [name, description, drawnPath, authState.accountRoot, geofenceColor, labelColor, onCreated, onClose]),
  );

  if (!open) return null;

  return (
    <div className="bg-white border border-[#128C7E] rounded-xl shadow-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#128C7E] shrink-0">
        <div>
          <div className="font-black text-[13px] text-white">Save Geofence</div>
          <div className="text-[10px] text-white/70 mt-0.5">
            {drawnPath?.length ?? 0} vertices drawn
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
          Drag vertices on map to reshape — drag midpoints to extend
        </span>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-4 flex flex-col gap-3">
        {/* Name */}
        <div>
          <label className="block text-[10px] font-extrabold text-[#667781] mb-1">
            Geofence Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Warehouse Zone A"
            className="w-full h-8 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] placeholder:text-[#8696A0] outline-none focus:border-[#128C7E]"
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
            placeholder="Describe this geofence area…"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] placeholder:text-[#8696A0] outline-none focus:border-[#128C7E] resize-none"
          />
        </div>

        {/* Geofence Color */}
        <div>
          <label className="block text-[10px] font-extrabold text-[#667781] mb-1">
            Geofence Color
          </label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setGeofenceColor(c)}
                className="w-6 h-6 rounded-full border-2 cursor-pointer transition-all shrink-0"
                style={{
                  backgroundColor: c,
                  borderColor: geofenceColor === c ? "#111B21" : "transparent",
                }}
              />
            ))}
            <input
              type="color"
              value={geofenceColor}
              onChange={(e) => setGeofenceColor(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border border-[#E9EDEF] p-0"
              title="Custom color"
            />
          </div>
        </div>

        {/* Label Color */}
        <div>
          <label className="block text-[10px] font-extrabold text-[#667781] mb-1">
            Label Color
          </label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setLabelColor(c)}
                className="w-6 h-6 rounded-full border-2 cursor-pointer transition-all shrink-0"
                style={{
                  backgroundColor: c,
                  borderColor: labelColor === c ? "#111B21" : "transparent",
                }}
              />
            ))}
            <input
              type="color"
              value={labelColor}
              onChange={(e) => setLabelColor(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border border-[#E9EDEF] p-0"
              title="Custom color"
            />
          </div>
        </div>

        {/* Polygon info */}
        <div className="bg-[#F0F2F5] border border-[#E9EDEF] rounded-lg p-2.5">
          <div className="text-[10px] font-extrabold text-[#667781]">
            Polygon: {drawnPath?.length ?? 0} vertices
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
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isRunning}
            className="flex-1 h-8 rounded-lg border-0 bg-[#128C7E] text-white text-[11px] font-extrabold cursor-pointer hover:bg-[#0D7466] disabled:opacity-50"
          >
            {createMutation.isRunning ? "Saving…" : "Save Geofence"}
          </button>
        </div>
      </div>
    </div>
  );
}
