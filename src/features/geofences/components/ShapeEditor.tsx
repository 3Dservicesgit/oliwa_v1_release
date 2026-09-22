/**
 * ShapeEditor — choose a geofence shape and enter its coordinates.
 *
 *   Polygon  4+ corners, each a latitude and longitude
 *   Circle   a centre (latitude, longitude) and a radius in metres
 *   Line     2+ points along a route and a thickness in metres
 *
 * Points can be typed here, or placed by clicking the map (the page passes map
 * clicks into the same draft). Markers on the map can be dragged to move them.
 */
import React from "react";
import {
  SHAPE_INFO,
  MIN_POLYGON_POINTS,
  MIN_LINE_POINTS,
  CIRCLE_RADIUS_M,
  LINE_WIDTH_M,
  parsePoint,
  undoLast,
  clearPoints,
  type DraftPoint,
  type GeozoneShape,
  type ShapeDraft,
} from "../../../utils/geofenceShapes";

const INPUT =
  "w-full h-8 px-2 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] " +
  "placeholder:text-[#8696A0] outline-none focus:border-[#128C7E] font-mono";
const LABEL = "block text-[10px] font-extrabold text-[#667781] mb-1";

const SHAPES: GeozoneShape[] = ["polygon", "circle", "line"];

function ShapeIcon({ shape }: { shape: GeozoneShape }) {
  if (shape === "circle") {
    return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeWidth="2" /></svg>;
  }
  if (shape === "line") {
    return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><polyline points="2,14 7,6 11,11 16,3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><polygon points="3,4 15,2 16,14 5,16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>;
}

interface ShapeEditorProps {
  draft: ShapeDraft;
  onChange: (draft: ShapeDraft) => void;
}

export function ShapeEditor({ draft, onChange }: ShapeEditorProps) {
  const set = (patch: Partial<ShapeDraft>) => onChange({ ...draft, ...patch });

  const chooseShape = (type: GeozoneShape) => {
    if (type === draft.type) return;
    // Keep what was entered where it still makes sense.
    const next: ShapeDraft = { ...draft, type };
    if (type === "circle" && !parsePoint(draft.center) && draft.points[0]) {
      next.center = draft.points[0];
    }
    if (type !== "circle" && draft.points.length === 0 && parsePoint(draft.center)) {
      next.points = [draft.center];
    }
    onChange(next);
  };

  const setPoint = (i: number, patch: Partial<DraftPoint>) =>
    set({ points: draft.points.map((p, k) => (k === i ? { ...p, ...patch } : p)) });
  const removePoint = (i: number) => set({ points: draft.points.filter((_, k) => k !== i) });
  const addPoint = () => set({ points: [...draft.points, { lat: "", lng: "" }] });

  const minimum = draft.type === "line" ? MIN_LINE_POINTS : MIN_POLYGON_POINTS;
  const validCount = draft.points.filter((p) => parsePoint(p)).length;

  return (
    <div className="flex flex-col gap-3">
      {/* Shape picker */}
      <div>
        <div className={LABEL}>Geofence type *</div>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Geofence type">
          {SHAPES.map((s) => {
            const on = draft.type === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => chooseShape(s)}
                title={SHAPE_INFO[s].hint}
                className={[
                  "h-14 rounded-lg border flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors",
                  on
                    ? "border-[#128C7E] bg-[#E9F7F4] text-[#075E54]"
                    : "border-[#E9EDEF] bg-white text-[#667781] hover:bg-[#F8F9FA]",
                ].join(" ")}
              >
                <ShapeIcon shape={s} />
                <span className="text-[11px] font-extrabold">{SHAPE_INFO[s].label}</span>
              </button>
            );
          })}
        </div>
        <div className="text-[10px] text-[#667781] mt-1">{SHAPE_INFO[draft.type].hint}.</div>
      </div>

      {draft.type === "circle" ? (
        <>
          <div>
            <div className={LABEL}>Centre *</div>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                aria-label="Centre latitude"
                inputMode="decimal"
                placeholder="Latitude"
                value={draft.center.lat}
                onChange={(e) => set({ center: { ...draft.center, lat: e.target.value } })}
                className={INPUT}
              />
              <input
                aria-label="Centre longitude"
                inputMode="decimal"
                placeholder="Longitude"
                value={draft.center.lng}
                onChange={(e) => set({ center: { ...draft.center, lng: e.target.value } })}
                className={INPUT}
              />
            </div>
            <div className="text-[10px] text-[#667781] mt-1">Or click the map to place the centre.</div>
          </div>
          <div>
            <label className={LABEL} htmlFor="gf-radius">Radius (metres) *</label>
            <input
              id="gf-radius"
              inputMode="decimal"
              value={draft.radius}
              onChange={(e) => set({ radius: e.target.value })}
              className={INPUT}
            />
            <div className="text-[10px] text-[#667781] mt-1">
              {CIRCLE_RADIUS_M[0]} m to {(CIRCLE_RADIUS_M[1] / 1000).toLocaleString()} km.
            </div>
          </div>
        </>
      ) : (
        <>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={LABEL.replace(" mb-1", "")}>
                {draft.type === "line" ? "Route points *" : "Corner points *"}
              </span>
              <span className={`text-[10px] font-extrabold ${validCount >= minimum ? "text-[#128C7E]" : "text-[#B45309]"}`}>
                {validCount} of at least {minimum}
              </span>
            </div>

            {draft.points.length === 0 && (
              <div className="text-[11px] text-[#667781] bg-[#F8F9FA] border border-dashed border-[#E9EDEF] rounded-lg px-3 py-2.5">
                Click the map to add points, or add them below by latitude and longitude.
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              {draft.points.map((p, i) => {
                const bad = (p.lat !== "" || p.lng !== "") && !parsePoint(p);
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-[#128C7E] text-white text-[10px] font-black grid place-items-center">
                      {i + 1}
                    </span>
                    <input
                      aria-label={`Point ${i + 1} latitude`}
                      inputMode="decimal"
                      placeholder="Latitude"
                      value={p.lat}
                      onChange={(e) => setPoint(i, { lat: e.target.value })}
                      className={`${INPUT} ${bad ? "border-[#FCA5A5]" : ""}`}
                    />
                    <input
                      aria-label={`Point ${i + 1} longitude`}
                      inputMode="decimal"
                      placeholder="Longitude"
                      value={p.lng}
                      onChange={(e) => setPoint(i, { lng: e.target.value })}
                      className={`${INPUT} ${bad ? "border-[#FCA5A5]" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => removePoint(i)}
                      aria-label={`Remove point ${i + 1}`}
                      className="w-7 h-8 shrink-0 rounded-lg border border-[#E9EDEF] bg-white text-[#667781] text-[12px] cursor-pointer hover:bg-[#FEF2F2] hover:text-[#B91C1C]"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={addPoint}
                className="h-7 px-3 rounded-lg border border-dashed border-[#128C7E] bg-white text-[11px] font-extrabold text-[#128C7E] cursor-pointer hover:bg-[#E9F7F4]"
              >
                + Add point
              </button>
              {draft.points.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange(undoLast(draft))}
                  className="h-7 px-3 rounded-lg border border-[#E9EDEF] bg-white text-[11px] font-extrabold text-[#667781] cursor-pointer hover:bg-[#F0F2F5]"
                >
                  Undo last point
                </button>
              )}
              {draft.points.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(clearPoints(draft))}
                  className="h-7 px-3 rounded-lg border border-[#EF4444]/30 bg-white text-[11px] font-extrabold text-[#EF4444] cursor-pointer hover:bg-[#FEF2F2]"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {draft.type === "line" && (
            <div>
              <label className={LABEL} htmlFor="gf-width">Thickness (metres) *</label>
              <input
                id="gf-width"
                inputMode="decimal"
                value={draft.width}
                onChange={(e) => set({ width: e.target.value })}
                className={INPUT}
              />
              <div className="text-[10px] text-[#667781] mt-1">
                The full width of the corridor around the route ({LINE_WIDTH_M[0]} m to {LINE_WIDTH_M[1].toLocaleString()} m).
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
