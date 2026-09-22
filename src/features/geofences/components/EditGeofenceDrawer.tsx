/**
 * EditGeofenceDrawer — inline panel for editing an existing geofence.
 *
 * Name and description can always be changed. The shape (polygon, circle or
 * line) and its points are edited with the same editor as when creating: type
 * coordinates, click the map to add points, or drag the markers. If the shape
 * is left untouched it is saved exactly as it was — so an older 3-corner
 * polygon can still be renamed without being forced to 4 corners.
 */
import React, { useState, useCallback } from "react";
import { updateGeozone } from "../../../api/services/geozones.service";
import { useGuardedMutation } from "../../../auth/guards";
import type { ParsedGeozone } from "../../../api/types";
import { serializeGeozonePoints } from "../../../api/types/geozones.types";
import { draftToParams, ringFor, type ShapeDraft } from "../../../utils/geofenceShapes";
import { ShapeEditor } from "./ShapeEditor";

interface EditGeofenceDrawerProps {
  open: boolean;
  geozone: ParsedGeozone | null;
  /** The shape being edited — shared with the map. */
  draft: ShapeDraft;
  onDraftChange: (draft: ShapeDraft) => void;
  /** True once the customer has changed the shape or its points. */
  shapeChanged: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function EditGeofenceDrawer({
  open,
  geozone,
  draft,
  onDraftChange,
  shapeChanged,
  onClose,
  onUpdated,
}: EditGeofenceDrawerProps) {
  // Mounted fresh (keyed by geofence) each time editing starts, so the fields
  // are filled from the geofence here rather than in an effect.
  const [name, setName] = useState(geozone?.geozone_name ?? "");
  const [description, setDescription] = useState(geozone?.geozone_description ?? "");
  const [error, setError] = useState<string | null>(null);

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

      let shapeFields = {};
      let points = serializeGeozonePoints(geozone.path);
      if (shapeChanged) {
        const checked = draftToParams(draft);
        if ("error" in checked) {
          setError(checked.error);
          return;
        }
        points = serializeGeozonePoints(ringFor(draft.type, checked.params));
        shapeFields = { new_geozone_shape: draft.type, new_geozone_shape_params: checked.params };
      }
      setError(null);

      try {
        const res = await updateGeozone(geozone.geozone_uid, {
          new_geozone_name: name.trim(),
          new_geozone_decription: description.trim(),
          new_geozone_points: points,
          ...shapeFields,
        });

        if (res.status === "success") {
          onUpdated?.();
          onClose();
        } else {
          setError(res.message || "Failed to update geofence.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update geofence.");
      }
    }, [geozone, name, description, draft, shapeChanged, onUpdated, onClose]),
  );

  if (!open || !geozone) return null;

  return (
    <div className="bg-white border border-[#128C7E] rounded-xl shadow-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#128C7E] shrink-0">
        <div>
          <div className="font-black text-[13px] text-white">Edit Geofence</div>
          <div className="text-[10px] text-white/70 mt-0.5">
            Change the points below, click the map to add one, or drag a marker
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-6 h-6 rounded-md bg-white/20 border-0 text-white font-black text-[12px] cursor-pointer grid place-items-center hover:bg-white/30"
        >
          ✕
        </button>
      </div>

      {/* Form */}
      <div className="p-4 flex flex-col gap-3">
        {/* Name */}
        <div>
          <label className="block text-[10px] font-extrabold text-[#667781] mb-1" htmlFor="gf-edit-name">
            Geofence Name *
          </label>
          <input
            id="gf-edit-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-8 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E]"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-[10px] font-extrabold text-[#667781] mb-1" htmlFor="gf-edit-desc">
            Description *
          </label>
          <textarea
            id="gf-edit-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] resize-none"
          />
        </div>

        <div className="h-px bg-[#E9EDEF]" />

        <ShapeEditor draft={draft} onChange={onDraftChange} />

        {shapeChanged && (
          <div className="text-[10px] font-extrabold text-[#128C7E]">Shape changed — saved when you press Save Changes.</div>
        )}

        {/* Error */}
        {error && (
          <div role="alert" className="text-[11px] text-[#B00020] bg-[#FFF5F5] border border-[#FFD6D6] rounded-lg px-3 py-2">
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
