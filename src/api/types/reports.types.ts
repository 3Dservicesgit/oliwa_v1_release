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
  | "PARKING"
  // FuelMath (navas-core-apis fuel_report.py), as in the OLIWA mobile app.
  | "fuel_issuance"
  | "fuel_consumption"
  | "fuel_exceptions"
  // Driver reports (navas-core-apis driver_report.py).
  | "driver_registry"
  | "driver_assignments"
  | "driver_compliance"
  | "driver_fuel"
  | "driver_scorecard";

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  trips:          "Trips",
  overspeeding:   "Overspeeding",
  fuel:           "Fuel Level",
  geozone:        "Geofence Breach",
  night_driving:  "Night Driving",
  IDILING:        "Idling",
  PARKING:        "Parking",
  fuel_issuance:    "Fuel Issuance & Expenditure",
  fuel_consumption: "Fuel Consumption & Performance",
  fuel_exceptions:  "Fuel Exceptions",
  driver_registry:    "Driver Registry",
  driver_assignments: "Driver Assignments",
  driver_compliance:  "Driver Compliance",
  driver_fuel:        "Driver Fuel",
  driver_scorecard:   "Driver Scorecard",
};

export const REPORT_TYPE_ICONS: Record<ReportType, string> = {
  trips:          "🛣️",
  overspeeding:   "⚡",
  fuel:           "⛽",
  geozone:        "📍",
  night_driving:  "🌙",
  IDILING:        "⏸️",
  PARKING:        "🅿️",
  fuel_issuance:    "🧾",
  fuel_consumption: "📈",
  fuel_exceptions:  "⚠️",
  driver_registry:    "🪪",
  driver_assignments: "🔁",
  driver_compliance:  "✅",
  driver_fuel:        "⛽",
  driver_scorecard:   "🏅",
};

/** The FuelMath reports. Built from fuel recorded in FuelMath, so they work
 *  for vehicles without a fuel sensor; the server's report-type list does
 *  not include them yet, so the console adds them itself. */
export const FUEL_REPORT_TYPES: AvailableReportType[] = [
  { key: "fuel_issuance",    label: "Fuel Issuance & Expenditure",    icon: "🧾", category: "fuel" },
  { key: "fuel_consumption", label: "Fuel Consumption & Performance", icon: "📈", category: "fuel" },
  { key: "fuel_exceptions",  label: "Fuel Exceptions",                icon: "⚠️", category: "fuel" },
];

/** The driver reports: chosen by driver rather than vehicle. Registry and
 *  compliance describe drivers as they are today, so they take no dates. */
export const DRIVER_REPORT_TYPES: AvailableReportType[] = [
  { key: "driver_registry",    label: "Driver Registry",    icon: "🪪", category: "drivers" },
  { key: "driver_assignments", label: "Driver Assignments", icon: "🔁", category: "drivers" },
  { key: "driver_compliance",  label: "Driver Compliance",  icon: "✅", category: "drivers" },
  { key: "driver_fuel",        label: "Driver Fuel",        icon: "⛽", category: "drivers" },
  { key: "driver_scorecard",   label: "Driver Scorecard",   icon: "🏅", category: "drivers" },
];

export type DriverReportType =
  "driver_registry" | "driver_assignments" | "driver_compliance" | "driver_fuel" | "driver_scorecard";

export function isDriverReport(type: string): type is DriverReportType {
  return type === "driver_registry" || type === "driver_assignments"
    || type === "driver_compliance" || type === "driver_fuel" || type === "driver_scorecard";
}

/** Driver reports that cover a period (the others are "as of today"). */
export function driverReportUsesDates(type: string): boolean {
  return type === "driver_assignments" || type === "driver_fuel" || type === "driver_scorecard";
}

export function isFuelReport(type: string): type is "fuel_issuance" | "fuel_consumption" | "fuel_exceptions" {
  return type === "fuel_issuance" || type === "fuel_consumption" || type === "fuel_exceptions";
}

// ── Export format ───────────────────────────────────────────────────────────

export type ReportFormat = "pdf" | "excel" | "summary";

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
  /** Driver reports only: driver_uids to include; all drivers when empty. */
  report_drivers?: string[];
  /** Summary report config — which sections & columns to include */
  summary_config?: {
    sections: { cover: boolean; statistics: boolean; detail: boolean };
    columns: string[];
    groupName?: string;
  };
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
