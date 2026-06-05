/**
 * reports.types.ts — TypeScript types for the Reports module.
 *
 * Maps to backend:
 *   Generate: POST /data-house/reports/{type}/{format}
 *   List:     GET  /data-stream/reports/{owner}/{type}/list
 *   Status:   GET  /data-stream/reports/{request_uid}/status
 *   Download: GET  /reports-cdn/{filename}
 */

// ── Report type enum ────────────────────────────────────────────────────────

export type ReportType =
  | "trips"
  | "overspeeding"
  | "fuel"
  | "geozone"
  | "night_driving"
  | "IDILING"
  | "PARKING";

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  trips:          "Trips",
  overspeeding:   "Overspeeding",
  fuel:           "Fuel Level",
  geozone:        "Geofence Breach",
  night_driving:  "Night Driving",
  IDILING:        "Idling",
  PARKING:        "Parking",
};

export const REPORT_TYPE_ICONS: Record<ReportType, string> = {
  trips:          "🛣️",
  overspeeding:   "⚡",
  fuel:           "⛽",
  geozone:        "📍",
  night_driving:  "🌙",
  IDILING:        "⏸️",
  PARKING:        "🅿️",
};

// ── Export format ───────────────────────────────────────────────────────────

export type ReportFormat = "pdf" | "excel";

// ── State report subtypes (sent as report_state in payload) ─────────────────

/** State-based reports use a single endpoint with a `report_state` field. */
export type StateReportType = "IDILING" | "PARKING";

/** Report types that use the /state/ endpoint. */
export function isStateReport(type: ReportType): type is StateReportType {
  return type === "IDILING" || type === "PARKING";
}

// ── Generate report request ─────────────────────────────────────────────────

export interface GenerateReportRequest {
  report_devices: string[];      // Array of device IMEIs
  start_date: string;            // DD-MM-YYYY
  end_date: string;              // DD-MM-YYYY
  origin_user: string;           // Account UID of the requester
  report_state?: string;         // Only for state reports: "IDILING" | "PARKING"
}

// ── Generate report response ────────────────────────────────────────────────

export interface GenerateReportResponse {
  file_url: string;
}

// ── Previous report (from listing endpoints) ────────────────────────────────

export interface PreviousReport {
  file_link: string;
  file_progress: "completed" | "in_process" | string;
  file_request_uid: string;
  file_datestamp: string;
  report_type: string;           // Uppercase: "TRIPS", "OVERSPEEDING", etc.
}

// ── Report status check ─────────────────────────────────────────────────────

export interface ReportStatus {
  request_uid: string;
  status: string;
  file_path: string;
}

// ── Available report type (from /reports/types/available) ───────────────

export interface AvailableReportType {
  key: string;          // e.g. "trips", "overspeeding", "IDILING"
  label: string;        // e.g. "Trips", "Overspeeding", "Idling"
  icon: string;         // emoji icon
  category: string;     // "movement", "safety", "maintenance", "state"
}
