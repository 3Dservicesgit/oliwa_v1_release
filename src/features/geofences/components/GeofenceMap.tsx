/**
 * GeofenceMap — Interactive Google Maps component for geofence management.
 *
 * Capabilities:
 *   - Renders existing geofence polygons
 *   - Drawing mode: click-to-place vertices, then "Finish" to create polygon
 *     (DrawingManager was removed from Google Maps API v3.65+)
 *   - Edit mode: selected polygon becomes editable/draggable
 *   - Click-to-select: clicking a polygon highlights it and notifies parent
 *   - Fit bounds: auto-zooms to show all polygons on load
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Polygon,
  Marker,
} from "@react-google-maps/api";
import { InfoWindow } from "@react-google-maps/api";
import type { LatLng, ParsedGeozone } from "../../../api/types";

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

// ── Polygon style presets ───────────────────────────────────────────────────
const POLYGON_DEFAULT = {
  fillColor: "#128C7E",
  fillOpacity: 0.15,
  strokeColor: "#128C7E",
  strokeOpacity: 0.8,
  strokeWeight: 2,
};

const POLYGON_SELECTED = {
  fillColor: "#075E54",
  fillOpacity: 0.25,
  strokeColor: "#075E54",
  strokeOpacity: 1,
  strokeWeight: 3,
};

const POLYGON_DRAWING = {
  fillColor: "#25D366",
  fillOpacity: 0.2,
  strokeColor: "#25D366",
  strokeWeight: 2,
};

// ── Device marker styles ───────────────────────────────────────────────────
const DEVICE_COLORS: Record<string, string> = {
  Moving:  "#2E7D32",
  Parked:  "#C62828",
  Idling:  "#1565C0",
  Offline: "#607D8B",
};

// ── Props ───────────────────────────────────────────────────────────────────
export interface GeofenceMapProps {
  /** All geozones to render as polygons. */
  geozones: ParsedGeozone[];
  /** UID of the currently selected/highlighted geozone. */
  selectedUid?: string | null;
  /** Called when user clicks a polygon on the map. */
  onSelectGeozone?: (uid: string) => void;
  /** Whether drawing mode is active — user is creating a new polygon. */
  drawingMode?: boolean;
  /** Called when user completes drawing a polygon. Returns the coordinate path. */
  onPolygonComplete?: (path: LatLng[]) => void;
  /** Called when user finishes editing a polygon's vertices. */
  onPolygonEdited?: (uid: string, newPath: LatLng[]) => void;
  /** UID of the geozone currently being edited (vertices draggable). */
  editingUid?: string | null;
  /** Live device markers to render on the map. */
  deviceMarkers?: DeviceMarkerData[];
}

export function GeofenceMap({
  geozones,
  selectedUid,
  onSelectGeozone,
  drawingMode = false,
  onPolygonComplete,
  onPolygonEdited,
  editingUid,
  deviceMarkers = [],
}: GeofenceMapProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const polygonRefs = useRef<Record<string, google.maps.Polygon>>({});
  const [mapReady, setMapReady] = useState(false);
  const [activeDevice, setActiveDevice] = useState<DeviceMarkerData | null>(null);

  // ── Click-to-draw state ─────────────────────────────────────────────────
  const [drawPoints, setDrawPoints] = useState<LatLng[]>([]);

  // Reset draw points when leaving drawing mode
  useEffect(() => {
    if (!drawingMode) setDrawPoints([]);
  }, [drawingMode]);

  // ── Fit bounds to show all polygons ─────────────────────────────────────
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
    if (hasPoints) {
      mapRef.current.fitBounds(bounds, 60);
    }
  }, [geozones]);

  useEffect(() => {
    if (mapReady) fitBounds();
  }, [mapReady, fitBounds]);

  // ── Pan to selected polygon ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !selectedUid) return;
    const gz = geozones.find((g) => g.geozone_uid === selectedUid);
    if (!gz || gz.path.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    gz.path.forEach((pt) => bounds.extend(pt));
    mapRef.current.fitBounds(bounds, 80);
  }, [selectedUid, geozones]);

  // ── Map click handler — places points in drawing mode ──────────────────
  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!drawingMode) return;
      if (!e.latLng) return;
      const pt: LatLng = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      setDrawPoints((prev) => [...prev, pt]);
    },
    [drawingMode],
  );

  const handleFinishDraw = useCallback(() => {
    if (drawPoints.length >= 3) {
      onPolygonComplete?.(drawPoints);
    }
    setDrawPoints([]);
  }, [drawPoints, onPolygonComplete]);

  const handleUndoPoint = useCallback(() => {
    setDrawPoints((prev) => prev.slice(0, -1));
  }, []);

  // ── Edit complete handler ───────────────────────────────────────────────
  const handleEditEnd = useCallback(
    (uid: string) => {
      const poly = polygonRefs.current[uid];
      if (!poly) return;
      const path = poly
        .getPath()
        .getArray()
        .map((p) => ({ lat: p.lat(), lng: p.lng() }));
      onPolygonEdited?.(uid, path);
    },
    [onPolygonEdited],
  );

  // ── Store polygon refs & apply editable on load ─────────────────────────
  const onPolygonLoad = useCallback(
    (uid: string, poly: google.maps.Polygon) => {
      polygonRefs.current[uid] = poly;
      const shouldEdit = uid === editingUid;
      poly.setEditable(shouldEdit);
      poly.setDraggable(shouldEdit);
    },
    [editingUid],
  );

  const onPolygonUnmount = useCallback((uid: string) => {
    delete polygonRefs.current[uid];
  }, []);

  // ── Programmatically toggle editable/draggable via refs ─────────────────
  useEffect(() => {
    for (const [uid, poly] of Object.entries(polygonRefs.current)) {
      const shouldEdit = uid === editingUid;
      poly.setEditable(shouldEdit);
      poly.setDraggable(shouldEdit);
    }
  }, [editingUid]);

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
          draggableCursor: drawingMode ? "crosshair" : undefined,
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
          ],
        }}
      >
        {/* ── Existing polygons ──────────────────────────────────────── */}
        {geozones.map((gz) => {
          const isSelected = gz.geozone_uid === selectedUid;
          const isEditing = gz.geozone_uid === editingUid;
          return (
            <Polygon
              key={`${gz.geozone_uid}-${isEditing ? "edit" : "view"}`}
              paths={gz.path}
              options={{
                ...(isSelected ? POLYGON_SELECTED : POLYGON_DEFAULT),
                editable: isEditing,
                draggable: isEditing,
                clickable: true,
                zIndex: isSelected ? 2 : 1,
              }}
              onClick={() => onSelectGeozone?.(gz.geozone_uid)}
              onLoad={(poly) => onPolygonLoad(gz.geozone_uid, poly)}
              onUnmount={() => onPolygonUnmount(gz.geozone_uid)}
              onMouseUp={() => {
                if (isEditing) handleEditEnd(gz.geozone_uid);
              }}
              onDragEnd={() => {
                if (isEditing) handleEditEnd(gz.geozone_uid);
              }}
            />
          );
        })}

        {/* ── Drawing preview polygon ──────────────────────────────── */}
        {drawingMode && drawPoints.length >= 2 && (
          <Polygon
            paths={drawPoints}
            options={{ ...POLYGON_DRAWING, editable: false, clickable: false, zIndex: 5 }}
          />
        )}

        {/* ── Vertex markers while drawing ─────────────────────────── */}
        {drawingMode &&
          drawPoints.map((pt, i) => (
            <Marker
              key={`draw-pt-${i}`}
              position={pt}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 6,
                fillColor: "#25D366",
                fillOpacity: 1,
                strokeColor: "#fff",
                strokeWeight: 2,
              }}
            />
          ))}

        {/* ── Attached device markers ─────────────────────────────── */}
        {deviceMarkers.map((d) => {
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

      {/* ── Drawing toolbar (overlaid on map) ───────────────────────── */}
      {drawingMode && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
          }}
        >
          <div className="bg-white rounded-xl shadow-lg border border-[#E9EDEF] px-4 py-2.5 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
            <span className="text-[12px] text-[#667781]">
              {drawPoints.length === 0
                ? "Click on the map to start placing vertices"
                : `${drawPoints.length} point${drawPoints.length !== 1 ? "s" : ""} placed`}
            </span>
            {drawPoints.length > 0 && (
              <button
                type="button"
                onClick={handleUndoPoint}
                className="h-7 px-3 rounded-lg border border-[#E9EDEF] bg-white text-[11px] font-extrabold text-[#667781] cursor-pointer hover:bg-[#F0F2F5]"
              >
                Undo
              </button>
            )}
            {drawPoints.length >= 3 && (
              <button
                type="button"
                onClick={handleFinishDraw}
                className="h-7 px-3 rounded-lg border-0 bg-[#128C7E] text-white text-[11px] font-extrabold cursor-pointer hover:bg-[#0D7466]"
              >
                Finish Drawing
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
