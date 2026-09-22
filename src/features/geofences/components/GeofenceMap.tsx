/**
 * GeofenceMap — Interactive Google Maps component for geofence management.
 *
 * Capabilities:
 *   - Renders existing geofences by shape: polygons, circles, and lines (the
 *     route plus its corridor)
 *   - Creating / editing: map clicks are passed to the page (which adds a
 *     point or sets a circle's centre); the draft is previewed live and its
 *     markers can be dragged
 *   - Click-to-select: clicking a geofence highlights it and notifies parent
 *   - Fit bounds: auto-zooms to show all geofences on load
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
// The "F" (function) versions of the overlays. The older class versions leave
// a copy behind on the map under React StrictMode, so a cancelled drawing or
// a removed point stayed visible after it was gone from the page.
import {
  GoogleMap,
  useJsApiLoader,
  PolygonF as Polygon,
  PolylineF as Polyline,
  CircleF as Circle,
  MarkerF as Marker,
  InfoWindowF as InfoWindow,
} from "@react-google-maps/api";
import type { LatLng, ParsedGeozone } from "../../../api/types";
import type { DraftPreview } from "../../../utils/geofenceShapes";

/** A device with its live position to show on the geofence map. */
export interface DeviceMarkerData {
  imei: string;
  name: string;
  lat: number;
  lng: number;
  speed: number;
  status: "Moving" | "Parked" | "Idling" | "Offline";
  lastSync: string;
}

const MAP_CONTAINER: React.CSSProperties = { width: "100%", height: "100%" };

const DEFAULT_CENTER = { lat: 0.3476, lng: 32.5825 }; // Kampala
const DEFAULT_ZOOM = 12;

const DEFAULT_COLOR = "#128C7E";
const SELECTED_COLOR = "#075E54";
const DRAFT_COLOR = "#25D366";

// ── Device marker styles ───────────────────────────────────────────────────
const DEVICE_COLORS: Record<string, string> = {
  Moving:  "#2E7D32",
  Parked:  "#C62828",
  Idling:  "#1565C0",
  Offline: "#607D8B",
};

// ── Props ───────────────────────────────────────────────────────────────────
export interface GeofenceMapProps {
  /** All geozones to render. */
  geozones: ParsedGeozone[];
  /** UID of the currently selected/highlighted geozone. */
  selectedUid?: string | null;
  /** Called when user clicks a geofence on the map. */
  onSelectGeozone?: (uid: string) => void;
  /** Live device markers to render on the map. */
  deviceMarkers?: DeviceMarkerData[];
  /** The shape being created or edited, if any. */
  preview?: DraftPreview | null;
  /** A geozone not to draw (it is being edited and shown as the preview). */
  hiddenUid?: string | null;
  /** Map clicked while a shape is being drawn. */
  onMapClick?: (point: LatLng) => void;
  /** A draft point marker was dragged (index into the draft's points). */
  onPointMoved?: (index: number, point: LatLng) => void;
  /** The circle's centre marker was dragged. */
  onCenterMoved?: (point: LatLng) => void;
  /** Remove the last point placed (or a circle's centre). */
  onUndo?: () => void;
  /** Remove every point placed. */
  onClear?: () => void;
}

function pointLabel(i: number) {
  return { text: String(i + 1), color: "#fff", fontSize: "10px", fontWeight: "800" };
}

function vertexIcon(): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 9,
    fillColor: SELECTED_COLOR,
    fillOpacity: 1,
    strokeColor: "#fff",
    strokeWeight: 2,
  };
}

function fromEvent(e: google.maps.MapMouseEvent): LatLng | null {
  return e.latLng ? { lat: e.latLng.lat(), lng: e.latLng.lng() } : null;
}

export function GeofenceMap({
  geozones,
  selectedUid,
  onSelectGeozone,
  deviceMarkers = [],
  preview = null,
  hiddenUid = null,
  onMapClick,
  onPointMoved,
  onCenterMoved,
  onUndo,
  onClear,
}: GeofenceMapProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [activeDevice, setActiveDevice] = useState<DeviceMarkerData | null>(null);
  const drawing = !!preview;

  // ── Fit bounds to show all geofences ────────────────────────────────────
  const fitBounds = useCallback(() => {
    if (!mapRef.current || geozones.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;
    for (const gz of geozones) {
      for (const pt of gz.path) {
        bounds.extend(pt);
        hasPoints = true;
      }
    }
    if (hasPoints) mapRef.current.fitBounds(bounds, 60);
  }, [geozones]);

  useEffect(() => {
    if (mapReady) fitBounds();
  }, [mapReady, fitBounds]);

  // ── Pan to selected geofence ────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !selectedUid) return;
    const gz = geozones.find((g) => g.geozone_uid === selectedUid);
    if (!gz || gz.path.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    gz.path.forEach((pt) => bounds.extend(pt));
    mapRef.current.fitBounds(bounds, 80);
  }, [selectedUid, geozones]);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!drawing) return;
      const p = fromEvent(e);
      if (p) onMapClick?.(p);
    },
    [drawing, onMapClick],
  );

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#F0F2F5]">
        <div className="flex items-center gap-2 text-[12px] text-[#667781]">
          <div className="w-4 h-4 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
          Loading map…
        </div>
      </div>
    );
  }

  const visible = geozones.filter((gz) => gz.geozone_uid !== hiddenUid);

  // What to tell the customer while drawing.
  let hint = "";
  if (preview) {
    if (preview.type === "circle") {
      hint = preview.center ? "Drag the centre or click the map to move it" : "Click the map to place the centre";
    } else {
      const min = preview.type === "line" ? 2 : 4;
      const n = preview.points.length;
      hint = n === 0
        ? "Click the map to place the first point"
        : n < min
          ? `${n} point${n === 1 ? "" : "s"} placed — at least ${min} needed`
          : `${n} points — click to add more, drag to adjust`;
    }
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER}
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        onLoad={(map) => {
          mapRef.current = map;
          setMapReady(true);
        }}
        onClick={handleMapClick}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          draggableCursor: drawing ? "crosshair" : undefined,
          styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
        }}
      >
        {/* ── Existing geofences ─────────────────────────────────────── */}
        {visible.map((gz) => {
          const isSelected = gz.geozone_uid === selectedUid;
          const color = isSelected ? SELECTED_COLOR : gz.geozone_color || DEFAULT_COLOR;
          const style = {
            fillColor: color,
            fillOpacity: isSelected ? 0.25 : 0.15,
            strokeColor: color,
            strokeOpacity: isSelected ? 1 : 0.8,
            strokeWeight: isSelected ? 3 : 2,
            clickable: !drawing,
            zIndex: isSelected ? 2 : 1,
          };
          const select = () => { if (!drawing) onSelectGeozone?.(gz.geozone_uid); };
          const params = gz.geozone_shape_params;

          if (gz.geozone_shape === "circle" && params && "center" in params) {
            return (
              <Circle
                key={gz.geozone_uid}
                center={params.center}
                radius={params.radius_m}
                options={style}
                onClick={select}
              />
            );
          }
          if (gz.geozone_shape === "line" && params && "width_m" in params) {
            return (
              <React.Fragment key={gz.geozone_uid}>
                <Polygon paths={gz.path} options={{ ...style, strokeWeight: 1 }} onClick={select} />
                <Polyline
                  path={params.points}
                  options={{ strokeColor: color, strokeOpacity: 1, strokeWeight: isSelected ? 4 : 3, clickable: !drawing, zIndex: 3 }}
                  onClick={select}
                />
              </React.Fragment>
            );
          }
          return <Polygon key={gz.geozone_uid} paths={gz.path} options={style} onClick={select} />;
        })}

        {/* ── Geofence name labels ────────────────────────────────── */}
        {visible.map((gz) => {
          if (gz.path.length === 0) return null;
          const params = gz.geozone_shape_params;
          const at = gz.geozone_shape === "circle" && params && "center" in params
            ? params.center
            : {
                lat: gz.path.reduce((s, p) => s + p.lat, 0) / gz.path.length,
                lng: gz.path.reduce((s, p) => s + p.lng, 0) / gz.path.length,
              };
          const lblColor = gz.geozone_label_color || gz.geozone_color || "#075E54";
          return (
            <Marker
              key={`label-${gz.geozone_uid}`}
              position={at}
              label={{ text: gz.geozone_name, color: lblColor, fontSize: "11px", fontWeight: "800" }}
              icon={{ path: google.maps.SymbolPath.CIRCLE, scale: 0, fillOpacity: 0, strokeOpacity: 0 }}
              clickable={false}
            />
          );
        })}

        {/* ── The shape being drawn ─────────────────────────────────── */}
        {preview && preview.type === "circle" && preview.center && preview.radius && (
          <Circle
            center={preview.center}
            radius={preview.radius}
            options={{ fillColor: DRAFT_COLOR, fillOpacity: 0.2, strokeColor: DRAFT_COLOR, strokeWeight: 2, clickable: false, zIndex: 5 }}
          />
        )}
        {preview && preview.type === "circle" && preview.center && (
          <Marker
            position={preview.center}
            draggable
            title="Centre — drag to move"
            icon={vertexIcon()}
            label={{ text: "C", color: "#fff", fontSize: "10px", fontWeight: "800" }}
            onDragEnd={(e) => { const p = fromEvent(e); if (p) onCenterMoved?.(p); }}
          />
        )}

        {preview && preview.type !== "circle" && preview.ring.length >= 3 && (
          <Polygon
            paths={preview.ring}
            options={{ fillColor: DRAFT_COLOR, fillOpacity: 0.2, strokeColor: DRAFT_COLOR, strokeWeight: preview.type === "line" ? 1 : 2, clickable: false, zIndex: 5 }}
          />
        )}
        {preview && preview.type !== "circle" && preview.points.length >= 2 && (
          <Polyline
            path={preview.type === "polygon" && preview.points.length >= 3 ? [...preview.points, preview.points[0]] : preview.points}
            options={{ strokeColor: SELECTED_COLOR, strokeOpacity: 0.9, strokeWeight: preview.type === "line" ? 3 : 2, clickable: false, zIndex: 6 }}
          />
        )}
        {preview && preview.type !== "circle" &&
          preview.points.map((pt, i) => (
            <Marker
              key={`draft-pt-${i}`}
              position={pt}
              draggable
              title={`Point ${(preview.indexes[i] ?? i) + 1} — drag to move`}
              icon={vertexIcon()}
              label={pointLabel(preview.indexes[i] ?? i)}
              zIndex={20}
              onDragEnd={(e) => { const p = fromEvent(e); if (p) onPointMoved?.(preview.indexes[i] ?? i, p); }}
            />
          ))}

        {/* ── Attached device markers ─────────────────────────────── */}
        {/* A unit with no position yet (never reported, or offline before we
            heard from it) has nothing to draw — it is listed, not mapped. */}
        {deviceMarkers.filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng)).map((d) => {
          const color = DEVICE_COLORS[d.status] ?? DEVICE_COLORS.Offline;
          return (
            <Marker
              key={`dev-${d.imei}`}
              position={{ lat: d.lat, lng: d.lng }}
              title={d.name || d.imei}
              onClick={() => setActiveDevice(d)}
              icon={{
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 5,
                fillColor: color,
                fillOpacity: 1,
                strokeColor: "#fff",
                strokeWeight: 2,
                rotation: 0,
              }}
            />
          );
        })}

        {/* ── Device info popup ────────────────────────────────────── */}
        {activeDevice && (
          <InfoWindow
            position={{ lat: activeDevice.lat, lng: activeDevice.lng }}
            onCloseClick={() => setActiveDevice(null)}
          >
            <div style={{ fontFamily: "system-ui, sans-serif", minWidth: 180, padding: 4 }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
                {activeDevice.name || activeDevice.imei}
              </div>
              <div style={{ fontSize: 11, color: "#667781", fontFamily: "monospace", marginBottom: 8 }}>
                {activeDevice.imei}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{
                  display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                  background: DEVICE_COLORS[activeDevice.status] ?? DEVICE_COLORS.Offline,
                }} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>{activeDevice.status}</span>
                {activeDevice.speed > 0 && (
                  <span style={{ fontSize: 11, color: "#667781" }}>
                    {activeDevice.speed} km/h
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "#667781" }}>
                Last sync: {activeDevice.lastSync || "—"}
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* ── Drawing hint (overlaid on map) ──────────────────────────── */}
      {preview && (
        <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
          <div className="bg-white rounded-xl shadow-lg border border-[#E9EDEF] px-4 py-2.5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
            <span className="text-[12px] text-[#667781]">{hint}</span>
            {(preview.points.length > 0 || preview.center) && (
              <>
                <button
                  type="button"
                  onClick={onUndo}
                  className="h-7 px-3 rounded-lg border border-[#E9EDEF] bg-white text-[11px] font-extrabold text-[#667781] cursor-pointer hover:bg-[#F0F2F5]"
                >
                  Undo
                </button>
                {preview.points.length > 1 && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="h-7 px-3 rounded-lg border border-[#EF4444]/30 bg-white text-[11px] font-extrabold text-[#EF4444] cursor-pointer hover:bg-[#FEF2F2]"
                  >
                    Clear all
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
