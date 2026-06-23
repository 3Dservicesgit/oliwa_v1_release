/**
 * reports.service.ts — Reports generation & history API service.
 *
 * Generate endpoints (POST):
 *   /data-house/reports/trips/{pdf|excel}
 *   /data-house/reports/overspeeding/{pdf|excel}
 *   /data-house/reports/fuel/{pdf|excel}
 *   /data-house/reports/geozone/{pdf|excel}
 *   /data-house/reports/night-driving/{pdf|excel}
 *   /data-house/reports/state/{pdf|excel}          (with report_state field)
 *
 * Listing endpoints (GET):
 *   /data-stream/reports/{owner}/trips
 *   /data-stream/reports/{owner}/{type}/list
 *   /data-stream/reports/{owner}/state/list
 *
 * Status:  GET  /data-stream/reports/{request_uid}/status
 * CDN:     GET  /reports-cdn/{filename}
 */

import { post, get, del } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ApiResponse, RequestOptions } from "../types";
import type {
  ReportType,
  ReportFormat,
  GenerateReportRequest,
  GenerateReportResponse,
  PreviousReport,
  ReportStatus,
  AvailableReportType,
} from "../types";
import { isStateReport } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Maps our ReportType to the URL segment the backend expects.
 * State-based types (IDILING, PARKING) all go to /state/.
 */
function reportEndpointSegment(type: ReportType): string {
  if (isStateReport(type)) return "state";
  if (type === "night_driving") return "night-driving";
  return type; // trips, overspeeding, fuel, geozone
}

/**
 * Convert a JS Date to DD-MM-YYYY string for the backend.
 */
export function formatDateForApi(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// ── Generate report ─────────────────────────────────────────────────────────

/**
 * Fetch trip data from the lightweight endpoint in data_stream blueprint,
 * then generate PDF or Excel client-side.
 *
 * Falls back to the legacy /data-house/ endpoint if the new one isn't
 * available, but that endpoint requires server-side deps (WeasyPrint etc.)
 * that may not be installed on all deployments.
 */
export async function generateReport(
  type: ReportType,
  format: ReportFormat,
  payload: GenerateReportRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<GenerateReportResponse>> {
  // ── Client-side report types ─────────────────────────────────────────────
  // These fetch data from lightweight JSON endpoints, then generate PDF/Excel
  // in the browser — no server-side WeasyPrint / GTK3 dependencies needed.

  // All report types now use client-side generation via lightweight JSON endpoints
  const CLIENT_SIDE_TYPES = ["trips", "fuel", "night_driving", "PARKING", "IDILING", "overspeeding", "geozone"];
  if (CLIENT_SIDE_TYPES.includes(type)) {
    const reportGen = await import("../../utils/reportGenerator");
    const isState = type === "PARKING" || type === "IDILING";

    // Pick the right backend endpoint based on report type
    const endpointMap: Record<string, string> = {
      trips: ENDPOINTS.REPORTS.TRIPS_DATA,
      fuel: ENDPOINTS.REPORTS.TRIPS_DATA,
      night_driving: ENDPOINTS.REPORTS.NIGHT_DRIVING_DATA,
      overspeeding: ENDPOINTS.REPORTS.OVERSPEEDING_DATA,
      geozone: ENDPOINTS.REPORTS.GEOZONE_DATA,
      PARKING: ENDPOINTS.REPORTS.STATE_DATA,
      IDILING: ENDPOINTS.REPORTS.STATE_DATA,
    };
    const endpointUrl = endpointMap[type] ?? ENDPOINTS.REPORTS.TRIPS_DATA;

    const labelMap: Record<string, string> = {
      trips: "Trip", fuel: "Fuel", night_driving: "Night Driving",
      overspeeding: "Overspeeding", geozone: "Geozone",
      PARKING: "Parking", IDILING: "Idling",
    };
    const typeLabel = labelMap[type] ?? type;

    // Friendly tips per report type for when no data is found
    const noDataHints: Record<string, string> = {
      trips: "This could mean no trips were recorded for these devices during the selected period. Try expanding your date range.",
      fuel: "This could mean no fuel level changes were recorded for these devices. Try a wider date range or check that fuel sensors are active.",
      night_driving: "No night driving events were detected. This is actually good news — your drivers may not have driven at night during this period!",
      overspeeding: "No overspeeding events were detected — great news! Your drivers stayed within speed limits during this period.",
      geozone: "No geozone breach events found. Make sure the selected devices have geozones assigned, or try a wider date range.",
      PARKING: "No parking records found. Try expanding the date range or verify the devices were active during this period.",
      IDILING: "No idling records found. Try expanding the date range or verify the devices were active during this period.",
    };

    console.log(`[Reports] Fetching ${typeLabel} data:`, { devices: payload.report_devices, start: payload.start_date, end: payload.end_date });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resp: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = {
        data: {
          report_devices: payload.report_devices,
          start_date: payload.start_date,
          end_date: payload.end_date,
        },
      };
      // State reports need the report_state field
      if (isState) {
        body.data.report_state = type; // "PARKING" or "IDILING"
      }

      resp = await post<unknown>(endpointUrl, body, opts);
    } catch (e) {
      console.error(`[Reports] ${typeLabel} data fetch failed:`, e);
      const msg = e instanceof Error ? e.message : `Failed to fetch ${typeLabel.toLowerCase()} data.`;
      if (msg.includes("No ") && (msg.includes("Found") || msg.includes("Data"))) {
        const hint = noDataHints[type] || "Try selecting a different date range or different devices.";
        throw new Error(`NO_DATA::${typeLabel}::${hint}`);
      }
      if (msg.includes("datestyle") || msg.includes("date/time")) {
        throw new Error("Date format error. Please check the selected date range and try again.");
      }
      throw new Error(msg);
    }

    console.log(`[Reports] ${typeLabel} data response:`, resp);

    const reportData = resp?.data;
    if (!Array.isArray(reportData) || reportData.length === 0) {
      const hint = noDataHints[type] || "Try selecting a different date range or different devices.";
      throw new Error(`NO_DATA::${typeLabel}::${hint}`);
    }

    try {
      if (isState) {
        if (format === "pdf") {
          reportGen.generateStatePDF(reportData, payload.start_date, payload.end_date, typeLabel);
        } else {
          reportGen.generateStateExcel(reportData, payload.start_date, payload.end_date, typeLabel);
        }
      } else if (type === "night_driving") {
        if (format === "pdf") {
          reportGen.generateNightDrivingPDF(reportData, payload.start_date, payload.end_date);
        } else {
          reportGen.generateNightDrivingExcel(reportData, payload.start_date, payload.end_date);
        }
      } else if (type === "overspeeding") {
        if (format === "pdf") {
          reportGen.generateOverspeedingPDF(reportData, payload.start_date, payload.end_date);
        } else {
          reportGen.generateOverspeedingExcel(reportData, payload.start_date, payload.end_date);
        }
      } else if (type === "geozone") {
        if (format === "pdf") {
          reportGen.generateGeozonePDF(reportData, payload.start_date, payload.end_date);
        } else {
          reportGen.generateGeozoneExcel(reportData, payload.start_date, payload.end_date);
        }
      } else if (type === "fuel") {
        if (format === "pdf") {
          reportGen.generateFuelPDF(reportData, payload.start_date, payload.end_date);
        } else {
          reportGen.generateFuelExcel(reportData, payload.start_date, payload.end_date);
        }
      } else {
        if (format === "pdf") {
          reportGen.generateTripsPDF(reportData, payload.start_date, payload.end_date);
        } else {
          reportGen.generateTripsExcel(reportData, payload.start_date, payload.end_date);
        }
      }
    } catch (genErr) {
      console.error("[Reports] Client-side generation failed:", genErr);
      throw new Error("Failed to generate the report file. Please try again.");
    }

    // Log the client-side report to the backend so it appears in Previous Reports
    // Fire-and-forget — don't block the user if this fails
    try {
      await post(ENDPOINTS.REPORTS.LOG_DOWNLOAD, {
        data: {
          report_caller: payload.origin_user,
          report_type: type,
          format: format,
        },
      });
      console.log(`[Reports] Logged ${typeLabel} ${format} download to backend`);
    } catch (logErr) {
      console.warn("[Reports] Failed to log report download (non-blocking):", logErr);
    }

    // Return a synthetic success response
    return { data: { file_url: "client-generated" } } as ApiResponse<GenerateReportResponse>;
  }

  // For other report types, fall back to legacy server-side generation
  const segment = reportEndpointSegment(type);
  const url = `${ENDPOINTS.REPORTS.GENERATE}/${segment}/${format}`;

  const body: { data: GenerateReportRequest } = { data: { ...payload } };
  if (isStateReport(type)) {
    body.data.report_state = type;
  }

  return post<GenerateReportResponse>(url, body, opts);
}

// ── List previous reports ───────────────────────────────────────────────────

/**
 * Fetch previously generated reports for a specific type.
 * State types (IDILING, PARKING) use the /state/list endpoint.
 * Trips uses /trips (no /list suffix).
 * Everything else uses /{type}/list.
 */
export function getReportsByType(
  ownerUid: string,
  type: ReportType,
  opts?: RequestOptions,
): Promise<ApiResponse<PreviousReport[]>> {
  let url: string;

  if (isStateReport(type)) {
    url = `${ENDPOINTS.REPORTS.LIST_STATE}/${ownerUid}/state/list`;
  } else if (type === "trips") {
    url = `${ENDPOINTS.REPORTS.LIST_BY_TYPE}/${ownerUid}/trips`;
  } else {
    url = `${ENDPOINTS.REPORTS.LIST_BY_TYPE}/${ownerUid}/${type}/list`;
  }

  return get<PreviousReport[]>(url, opts);
}

/**
 * Fetch ALL previous reports for the logged-in customer.
 *
 * Uses the single /reports/{ownerUid}/trips endpoint which returns
 * every report type for that owner (the backend query has no type filter).
 * This avoids duplicate results that would occur from calling multiple
 * type-specific endpoints, and reduces network requests from 4 to 1.
 *
 * SECURITY: ownerUid MUST be the logged-in user's account UID from
 * AuthContext / _nvxs_account_uid cookie — never from URL params or
 * user input. Each customer can only see reports where report_caller
 * matches their own UID. The backend enforces this via:
 *   WHERE report_caller = ownerUid
 */
export async function getAllPreviousReports(
  ownerUid: string,
  opts?: RequestOptions,
): Promise<PreviousReport[]> {
  if (!ownerUid || ownerUid.length < 6) {
    return [];
  }

  try {
    // The /trips endpoint returns ALL report types for this owner
    // (trips, fuel, overspeeding, idling, parking, ignition_on, etc.)
    const res = await getReportsByType(ownerUid, "trips", opts);
    const reports = Array.isArray(res?.data) ? res.data : [];

    // Deduplicate by file_request_uid as a safety net
    const seen = new Set<string>();
    const unique = reports.filter((r) => {
      if (!r.file_request_uid || seen.has(r.file_request_uid)) return false;
      seen.add(r.file_request_uid);
      return true;
    });

    // Sort newest first by datestamp
    unique.sort((a, b) => {
      return (b.file_datestamp || "").localeCompare(a.file_datestamp || "");
    });

    return unique;
  } catch {
    // 400 "No Reports Data Found" — customer has no reports yet
    return [];
  }
}

// ── Report status ───────────────────────────────────────────────────────────

/** Check the generation status of a specific report request. */
export function getReportStatus(
  requestUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<ReportStatus>> {
  return get<ReportStatus>(
    `${ENDPOINTS.REPORTS.STATUS}/${requestUid}/status`,
    opts,
  );
}

// ── Download URL builder ────────────────────────────────────────────────────

/**
 * Build the full download URL for a completed report.
 * The file_link from the listing response may be a full URL or just a filename.
 */
export function getReportDownloadUrl(fileLink: string): string {
  if (!fileLink) return "";
  // If it's already a full URL, return as-is
  if (fileLink.startsWith("http://") || fileLink.startsWith("https://")) {
    return fileLink;
  }
  // Otherwise build from CDN base
  return `${ENDPOINTS.REPORTS.CDN}/${fileLink}`;
}

// ── Delete report ──────────────────────────────────────────────────────────

/**
 * Delete a report record.
 * SECURITY: ownerUid is sent in the body so the backend verifies
 * report_caller matches — customers can only delete their own reports.
 */
export function deleteReport(
  requestUid: string,
  ownerUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<void>> {
  return del<void>(
    `${ENDPOINTS.REPORTS.DELETE}/${requestUid}/delete`,
    { owner_uid: ownerUid },
    opts,
  );
}

// ── Available report types ─────────────────────────────────────────────────

/**
 * Fetch the list of report types the system supports.
 * Used to dynamically render report type options in the Generate form
 * so new types can be added on the backend without frontend code changes.
 */
export function getAvailableReportTypes(
  opts?: RequestOptions,
): Promise<ApiResponse<AvailableReportType[]>> {
  return get<AvailableReportType[]>(ENDPOINTS.REPORTS.TYPES, opts);
}
