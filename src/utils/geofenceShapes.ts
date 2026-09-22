/**
 * geofenceShapes.ts — the three geofence shapes a customer can draw.
 *
 *   polygon  at least 4 corners, each a latitude / longitude
 *   circle   a centre and a radius in metres
 *   line     a route of at least 2 points and a thickness in metres
 *            (a corridor — "stay on this road")
 *
 * Inside/outside checks everywhere (live monitoring, the event stream) read a
 * zone's polygon ring, so every shape is also saved as one: a circle as a
 * 64-sided polygon, a line as the corridor around it. The server computes that
 * ring itself (navas-core-apis endpoints/geozone_shapes.py); this file makes the
 * same ring for the live preview. Keep the two in step.
 */
import type { LatLng } from "../api/types";
import type { GeozoneShape, ShapeParams } from "../api/types/geozones.types";

export type { GeozoneShape, ShapeParams };

export const MIN_POLYGON_POINTS = 4;
export const MIN_LINE_POINTS = 2;
export const MAX_POINTS = 500;
export const CIRCLE_RADIUS_M: [number, number] = [10, 100_000];
export const LINE_WIDTH_M: [number, number] = [5, 5_000];
const CIRCLE_SEGMENTS = 64;
const EARTH_M = 6_371_008.8;

// ── Form state ──────────────────────────────────────────────────────────────
// Coordinates are kept as the text the customer typed, so "0." or "-" can be
// typed on the way to a number. They become numbers only when valid.

export interface DraftPoint { lat: string; lng: string; }

export interface ShapeDraft {
  type: GeozoneShape;
  points: DraftPoint[];     // polygon corners / line route
  center: DraftPoint;       // circle
  radius: string;           // circle, metres
  width: string;            // line thickness, metres
}

export const SHAPE_INFO: Record<GeozoneShape, { label: string; hint: string }> = {
  polygon: { label: "Polygon", hint: "An area with 4 or more corners" },
  circle:  { label: "Circle",  hint: "A centre point and a radius" },
  line:    { label: "Line",    hint: "A route with a thickness, e.g. a road" },
};

export function emptyDraft(type: GeozoneShape = "polygon"): ShapeDraft {
  return { type, points: [], center: { lat: "", lng: "" }, radius: "500", width: "50" };
}

const fmt = (n: number) => String(Math.round(n * 1e6) / 1e6);

export function toDraftPoint(p: LatLng): DraftPoint {
  return { lat: fmt(p.lat), lng: fmt(p.lng) };
}

/** A typed point as numbers, or null if it isn't a valid coordinate yet. */
export function parsePoint(p: DraftPoint): LatLng | null {
  if (p.lat.trim() === "" || p.lng.trim() === "") return null;
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** The draft for an existing zone (legacy zones are polygons of their ring). */
export function draftFromZone(
  shape: GeozoneShape | undefined,
  params: ShapeParams | null | undefined,
  ring: LatLng[],
): ShapeDraft {
  const d = emptyDraft(shape ?? "polygon");
  if (d.type === "circle" && params && "center" in params) {
    d.center = toDraftPoint(params.center);
    d.radius = fmt(params.radius_m);
  } else if (d.type === "line" && params && "width_m" in params) {
    d.points = params.points.map(toDraftPoint);
    d.width = fmt(params.width_m);
  } else {
    d.type = "polygon";
    d.points = (params && "points" in params ? params.points : ring).map(toDraftPoint);
  }
  return d;
}

// ── Validation (same rules and wording as the server) ──────────────────────

function checkPoints(points: DraftPoint[], minimum: number, what: string): LatLng[] | string {
  if (points.length < minimum) return `A ${what} needs at least ${minimum} points.`;
  if (points.length > MAX_POINTS) return `A ${what} can have at most ${MAX_POINTS} points.`;
  const out: LatLng[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = parsePoint(points[i]);
    if (!p) {
      return `Point ${i + 1} needs a valid latitude (-90 to 90) and longitude (-180 to 180).`;
    }
    out.push(p);
  }
  const distinct = new Set(out.map((p) => `${p.lat.toFixed(7)},${p.lng.toFixed(7)}`));
  if (distinct.size < minimum) return `A ${what} needs at least ${minimum} different points.`;
  return out;
}

function checkMetres(value: string, [low, high]: [number, number], label: string): number | string {
  const n = Number(value);
  if (value.trim() === "" || !Number.isFinite(n)) return `${label} must be a number of metres.`;
  if (n < low || n > high) {
    return `${label} must be between ${low.toLocaleString()} and ${high.toLocaleString()} metres.`;
  }
  return n;
}

/** Validated params ready to send, or the first problem as a message. */
export function draftToParams(d: ShapeDraft): { params: ShapeParams } | { error: string } {
  if (d.type === "circle") {
    const center = parsePoint(d.center);
    if (!center) return { error: "The centre needs a valid latitude and longitude." };
    const r = checkMetres(d.radius, CIRCLE_RADIUS_M, "The radius");
    if (typeof r === "string") return { error: r };
    return { params: { center, radius_m: r } };
  }
  if (d.type === "line") {
    const pts = checkPoints(d.points, MIN_LINE_POINTS, "line");
    if (typeof pts === "string") return { error: pts };
    const w = checkMetres(d.width, LINE_WIDTH_M, "The thickness");
    if (typeof w === "string") return { error: w };
    return { params: { points: pts, width_m: w } };
  }
  const pts = checkPoints(d.points, MIN_POLYGON_POINTS, "polygon");
  if (typeof pts === "string") return { error: pts };
  if (ringArea(pts) < 1) return { error: "The polygon has no area — its points are in a line." };
  return { params: { points: pts } };
}

// ── Geometry (mirrors geozone_shapes.py) ───────────────────────────────────

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

type XY = [number, number];

function toXY(p: LatLng, lat0: number, lng0: number): XY {
  const k = Math.cos(rad(lat0));
  return [rad(p.lng - lng0) * EARTH_M * k, rad(p.lat - lat0) * EARTH_M];
}

function toLatLng([x, y]: XY, lat0: number, lng0: number): LatLng {
  const k = Math.cos(rad(lat0)) || 1e-12;
  return { lat: lat0 + deg(y / EARTH_M), lng: lng0 + deg(x / (EARTH_M * k)) };
}

function ringArea(pts: LatLng[]): number {
  const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const lng0 = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
  const xy = pts.map((p) => toXY(p, lat0, lng0));
  let s = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

export function circleRing(center: LatLng, radiusM: number, segments = CIRCLE_SEGMENTS): LatLng[] {
  const d = radiusM / EARTH_M;
  const phi1 = rad(center.lat);
  const lam1 = rad(center.lng);
  const ring: LatLng[] = [];
  for (let i = 0; i < segments; i++) {
    const theta = (2 * Math.PI * i) / segments;
    const phi2 = Math.asin(Math.sin(phi1) * Math.cos(d) + Math.cos(phi1) * Math.sin(d) * Math.cos(theta));
    const lam2 = lam1 + Math.atan2(
      Math.sin(theta) * Math.sin(d) * Math.cos(phi1),
      Math.cos(d) - Math.sin(phi1) * Math.sin(phi2),
    );
    ring.push({ lat: deg(phi2), lng: ((deg(lam2) + 540) % 360) - 180 });
  }
  return ring;
}

function offsetSide(xy: XY[], half: number, side: 1 | -1): XY[] {
  const n = xy.length;
  return xy.map((pt, i) => {
    const dirs: XY[] = i === 0
      ? [[xy[1][0] - xy[0][0], xy[1][1] - xy[0][1]]]
      : i === n - 1
        ? [[pt[0] - xy[i - 1][0], pt[1] - xy[i - 1][1]]]
        : [[pt[0] - xy[i - 1][0], pt[1] - xy[i - 1][1]], [xy[i + 1][0] - pt[0], xy[i + 1][1] - pt[1]]];
    const units = dirs.map(([dx, dy]) => {
      const len = Math.hypot(dx, dy) || 1e-9;
      return [(-dy / len) * side, (dx / len) * side] as XY;
    });
    let nx = units.reduce((s, u) => s + u[0], 0) / units.length;
    let ny = units.reduce((s, u) => s + u[1], 0) / units.length;
    let norm = Math.hypot(nx, ny);
    if (norm < 1e-9) { [nx, ny] = units[0]; norm = 1; }
    const scale = units.length === 2 ? Math.min(1 / norm, 3) : 1;
    return [pt[0] + (nx / norm) * scale * half, pt[1] + (ny / norm) * scale * half] as XY;
  });
}

function cap(center: XY, [dx, dy]: XY, half: number, steps = 8): XY[] {
  const len = Math.hypot(dx, dy) || 1e-9;
  const ux = dx / len;
  const uy = dy / len;
  const start = Math.atan2(ux, -uy);          // angle of the left-hand normal
  const out: XY[] = [];
  for (let k = 1; k < steps; k++) {
    const a = start - (Math.PI * k) / steps;
    out.push([center[0] + Math.cos(a) * half, center[1] + Math.sin(a) * half]);
  }
  return out;
}

export function corridorRing(points: LatLng[], widthM: number): LatLng[] {
  const route: LatLng[] = [points[0]];
  for (const p of points.slice(1)) {
    const last = route[route.length - 1];
    if (p.lat.toFixed(7) !== last.lat.toFixed(7) || p.lng.toFixed(7) !== last.lng.toFixed(7)) route.push(p);
  }
  if (route.length < 2) return [];
  const lat0 = route.reduce((s, p) => s + p.lat, 0) / route.length;
  const lng0 = route.reduce((s, p) => s + p.lng, 0) / route.length;
  const xy = route.map((p) => toXY(p, lat0, lng0));
  const half = widthM / 2;
  const left = offsetSide(xy, half, 1);
  const right = offsetSide(xy, half, -1);
  const last = xy.length - 1;
  const ring: XY[] = [
    ...left,
    ...cap(xy[last], [xy[last][0] - xy[last - 1][0], xy[last][1] - xy[last - 1][1]], half),
    ...[...right].reverse(),
    ...cap(xy[0], [xy[0][0] - xy[1][0], xy[0][1] - xy[1][1]], half),
  ];
  return ring.map((p) => toLatLng(p, lat0, lng0));
}

/** Add a clicked map point to a draft: a circle's centre, or the next point
 *  (filling the first empty row the customer added, if there is one). */
export function withMapPoint(d: ShapeDraft, p: LatLng): ShapeDraft {
  if (d.type === "circle") return { ...d, center: toDraftPoint(p) };
  const empty = d.points.findIndex((pt) => pt.lat.trim() === "" && pt.lng.trim() === "");
  const points = [...d.points];
  if (empty >= 0) points[empty] = toDraftPoint(p);
  else points.push(toDraftPoint(p));
  return { ...d, points };
}

/** Remove the last point placed — or a circle's centre. */
export function undoLast(d: ShapeDraft): ShapeDraft {
  if (d.type === "circle") return { ...d, center: { lat: "", lng: "" } };
  return { ...d, points: d.points.slice(0, -1) };
}

/** Remove every point placed (the shape type and sizes are kept). */
export function clearPoints(d: ShapeDraft): ShapeDraft {
  return { ...d, points: [], center: { lat: "", lng: "" } };
}

/** The polygon ring saved in geozone_points for a shape. */
export function ringFor(shape: GeozoneShape, params: ShapeParams): LatLng[] {
  if (shape === "circle" && "center" in params) return circleRing(params.center, params.radius_m);
  if (shape === "line" && "width_m" in params) return corridorRing(params.points, params.width_m);
  return "points" in params ? params.points : [];
}

/** What the map should preview for a half-finished draft. */
export interface DraftPreview {
  type: GeozoneShape;
  points: LatLng[];          // the typed points that are valid (markers)
  indexes: number[];         // each marker's position in draft.points
  ring: LatLng[];            // the area to shade, when there is one
  center: LatLng | null;
  radius: number | null;
}

export function previewOf(d: ShapeDraft): DraftPreview {
  const indexes: number[] = [];
  const points: LatLng[] = [];
  d.points.forEach((dp, i) => {
    const p = parsePoint(dp);
    if (p) { points.push(p); indexes.push(i); }
  });
  if (d.type === "circle") {
    const center = parsePoint(d.center);
    const r = Number(d.radius);
    const radius = center && Number.isFinite(r) && r > 0 ? r : null;
    return { type: "circle", points: [], indexes: [], center, radius, ring: center && radius ? circleRing(center, radius) : [] };
  }
  if (d.type === "line") {
    const w = Number(d.width);
    const ring = points.length >= 2 && Number.isFinite(w) && w > 0 ? corridorRing(points, w) : [];
    return { type: "line", points, indexes, ring, center: null, radius: null };
  }
  return { type: "polygon", points, indexes, ring: points.length >= 3 ? points : [], center: null, radius: null };
}
