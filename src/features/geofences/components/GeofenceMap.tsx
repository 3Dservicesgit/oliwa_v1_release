/**
 * GeofenceMap — Interactive Google Maps component for geofence management.
 *
 * Capabilities:
 *   - Renders existing geofence polygons
 *   - Drawing mode: user draws a polygon, coordinates extracted on complete
 *   - Edit mode: selected polygon becomes editable/draggable
 *   - Click-to-select: clicking a polygon highlights it and notifies parent
 *   - Fit bounds: auto-zooms to show all polygons on load
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Polygon,
  DrawingManager,
} from "@react-google-maps/api";
import type { LatLng, ParsedGeozone } from "../../../api/types";

const MAP_LIBRARIES: ("drawing")[] = ["drawing"];

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
}

export function GeofenceMap({
  geozones,
  selectedUid,
  onSelectGeozone,
  drawingMode = false,
  onPolygonComplete,
  onPolygonEdited,
  editingUid,
}: GeofenceMapProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: MAP_LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const polygonRefs = useRef<Record<string, google.maps.Polygon>>({});
  const [mapReady, setMapReady] = useState(false);

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

  // ── Drawing complete handler ────────────────────────────────────────────
  const handleDrawingComplete = useCallback(
    (polygon: google.maps.Polygon) => {
      const path = polygon
        .getPath()
        .getArray()
        .map((p) => ({ lat: p.lat(), lng: p.lng() }));
      // Remove the drawing overlay — we'll render it as a controlled Polygon
      polygon.setMap(null);
      onPolygonComplete?.(path);
    },
    [onPolygonComplete],
  );

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
      // Apply editable/draggable immediately when the polygon loads
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
    <GoogleMap
      mapContainerStyle={MAP_CONTAINER}
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      onLoad={(map) => {
        mapRef.current = map;
        setMapReady(true);
      }}
      options={{
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
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

      {/* ── Drawing manager ────────────────────────────────────────── */}
      {drawingMode && (
        <DrawingManager
          drawingMode={google.maps.drawing.OverlayType.POLYGON}
          onPolygonComplete={handleDrawingComplete}
          options={{
            drawingControl: false,
            polygonOptions: POLYGON_DRAWING,
          }}
        />
      )}
    </GoogleMap>
  );
}
