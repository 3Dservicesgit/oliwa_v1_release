/**
 * CreateGeofenceDrawer — inline panel for creating a geofence.
 *
 * The customer picks a shape (polygon, circle or line) and enters its points
 * here or by clicking the map; the map previews it live. On save the shape is
 * sent with its details, plus the polygon ring every inside/outside check
 * uses (the server recomputes the ring from the shape).
 */
import React, { useState, useCallback } from "react";
import { createGeozone } from "../../../api/services/geozones.service";
import { useAuth } from "../../../auth/AuthContext";
import { useGuardedMutation } from "../../../auth/guards";
import { serializeGeozonePoints } from "../../../api/types/geozones.types";
import { draftToParams, ringFor, type ShapeDraft } from "../../../utils/geofenceShapes";
import { ShapeEditor } from "./ShapeEditor";

/** Preset colors for quick selection. */
const COLOR_PRESETS = [
  "#128C7E", "#075E54", "#25D366", "#3B82F6", "#8B5CF6",
  "#EF4444", "#F97316", "#F59E0B", "#10B981", "#EC4899",
];

interface CreateGeofenceDrawerProps {
  open: boolean;
  /** The shape being drawn — shared with the map. */
  draft: ShapeDraft;
  onDraftChange: (draft: ShapeDraft) => void;
  onClose: () => void;
  onCreated?: () => void;
}

function ColorRow({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div>
      <label className="block text-[10px] font-extrabold text-[#667781] mb-1">{label}</label>
      <div className="flex items-center gap-1.5 flex-wrap">
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`${label} ${c}`}
            onClick={() => onChange(c)}
            className="w-6 h-6 rounded-full border-2 cursor-pointer transition-all shrink-0"
            style={{ backgroundColor: c, borderColor: value === c ? "#111B21" : "transparent" }}
          />
        ))}
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer border border-[#E9EDEF] p-0"
          title="Custom color"
        />
      </div>
    </div>
  );
}

export function CreateGeofenceDrawer({
  open,
  draft,
  onDraftChange,
  onClose,
  onCreated,
}: CreateGeofenceDrawerProps) {
  const { state: authState } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [geofenceColor, setGeofenceColor] = useState("#128C7E");
  const [labelColor, setLabelColor] = useState("#075E54");
  const [error, setError] = useState<string | null>(null);

  // The page mounts this panel fresh each time a geofence is started, so the
  // fields above start empty without a reset effect.

  const createMutation = useGuardedMutation(
    "can_create_geofence",
    useCallback(async () => {
      const checked = draftToParams(draft);
      if ("error" in checked) {
        setError(checked.error);
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
          geozone_points: serializeGeozonePoints(ringFor(draft.type, checked.params)),
          geozone_owner: authState.accountRoot,
          geozone_color: geofenceColor,
          geozone_label_color: labelColor,
          geozone_shape: draft.type,
          geozone_shape_params: checked.params,
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
    }, [draft, name, description, authState.accountRoot, geofenceColor, labelColor, onCreated, onClose]),
  );

  if (!open) return null;

  return (
    <div className="bg-white border border-[#128C7E] rounded-xl shadow-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#128C7E] shrink-0">
        <div>
          <div className="font-black text-[13px] text-white">New Geofence</div>
          <div className="text-[10px] text-white/70 mt-0.5">
            Click the map to place points · drag them to adjust
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
      <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-4 flex flex-col gap-3">
        <ShapeEditor draft={draft} onChange={onDraftChange} />

        <div className="h-px bg-[#E9EDEF]" />

        {/* Name */}
        <div>
          <label className="block text-[10px] font-extrabold text-[#667781] mb-1" htmlFor="gf-name">
            Geofence Name *
          </label>
          <input
            id="gf-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Warehouse Zone A"
            className="w-full h-8 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] placeholder:text-[#8696A0] outline-none focus:border-[#128C7E]"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-[10px] font-extrabold text-[#667781] mb-1" htmlFor="gf-desc">
            Description *
          </label>
          <textarea
            id="gf-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this geofence area…"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] placeholder:text-[#8696A0] outline-none focus:border-[#128C7E] resize-none"
          />
        </div>

        <ColorRow label="Geofence Color" value={geofenceColor} onChange={setGeofenceColor} />
        <ColorRow label="Label Color" value={labelColor} onChange={setLabelColor} />

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
