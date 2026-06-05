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
 * Queue a report generation job.
 * The server responds immediately with a file_url — the actual file is
 * generated asynchronously and its progress can be polled via the
 * listing endpoints.
 */
export function generateReport(
  type: ReportType,
  format: ReportFormat,
  payload: GenerateReportRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<GenerateReportResponse>> {
  const segment = reportEndpointSegment(type);
  const url = `${ENDPOINTS.REPORTS.GENERATE}/${segment}/${format}`;

  // Build the body — add report_state for state-based reports
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
