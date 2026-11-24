/**
 * drivers.service.ts — driver management, as in the OLIWA mobile app:
 * register, edit, change status, assign to a vehicle, photo.
 *
 *   GET  /drivers/registry?status=&q=          → getDrivers
 *   POST /drivers/registry                     → registerDriver
 *   GET  /drivers/registry/{uid}               → getDriver
 *   PUT  /drivers/registry/{uid}               → updateDriver
 *   DELETE /drivers/registry/{uid}             → deleteDriver (no history only)
 *   PUT  /drivers/registry/{uid}/status        → setDriverStatus
 *   POST /drivers/registry/{uid}/assign        → assignDriver
 *   POST /drivers/registry/{uid}/unassign      → unassignDriver
 *   GET  /drivers/registry/{uid}/assignments   → getDriverAssignments
 *   GET  /drivers/registry/unit/{imei}         → getUnitDriver
 *   POST /drivers/registry/{uid}/photo         → uploadDriverPhoto
 *   GET  /drivers/registry/{uid}/photo         → driverPhotoUrl (signed in)
 *   GET  /drivers/score/list                   → getDriverScoreRules
 *
 * Every call works on the signed-in user's own client (driver_registry.py).
 */
import { del, get, getBlobUrl, post, postMultipart, put } from "../client";
import type {
  Driver, DriverAssignment, DriverFields, DriverScoreRule, DriverScorecardDetail,
  DriverStatus, ScorecardList,
} from "../types/drivers.types";

const enc = encodeURIComponent;
const BASE = "/drivers/registry";

/** The client's drivers, A–Z. `query` searches name, phone, permit number
 *  and employee number. */
export async function getDrivers(status?: string, query?: string): Promise<Driver[]> {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  if (query?.trim()) params.q = query.trim();
  const res = await get<Driver[]>(BASE, { params });
  return Array.isArray(res.data) ? res.data : [];
}

export async function getDriver(uid: string): Promise<Driver> {
  return (await get<Driver>(`${BASE}/${enc(uid)}`)).data;
}

export async function registerDriver(fields: DriverFields): Promise<Driver> {
  return (await post<Driver>(BASE, { data: fields })).data;
}

export async function updateDriver(uid: string, fields: DriverFields): Promise<Driver> {
  return (await put<Driver>(`${BASE}/${enc(uid)}`, { data: fields })).data;
}

/** Deletes a driver with no history. One with history is refused (409,
 *  "Deactivate them instead"). */
export async function deleteDriver(uid: string): Promise<void> {
  await del(`${BASE}/${enc(uid)}`);
}

export async function setDriverStatus(uid: string, status: DriverStatus, reason?: string): Promise<Driver> {
  return (await put<Driver>(`${BASE}/${enc(uid)}/status`, {
    data: { status, ...(reason ? { reason } : {}) },
  })).data;
}

/** Puts the driver in the vehicle. Their previous vehicle, and the
 *  vehicle's previous driver, are released. */
export async function assignDriver(uid: string, imei: string): Promise<Driver> {
  return (await post<Driver>(`${BASE}/${enc(uid)}/assign`, { data: { device_imei: imei } })).data;
}

export async function unassignDriver(uid: string): Promise<Driver> {
  return (await post<Driver>(`${BASE}/${enc(uid)}/unassign`, {})).data;
}

/** Newest first. */
export async function getDriverAssignments(uid: string): Promise<DriverAssignment[]> {
  const res = await get<DriverAssignment[]>(`${BASE}/${enc(uid)}/assignments`);
  return Array.isArray(res.data) ? res.data : [];
}

/** The driver in the vehicle now, or null. */
export async function getUnitDriver(imei: string): Promise<Driver | null> {
  const res = await get<Driver | null>(`${BASE}/unit/${enc(imei)}`);
  return res.data && typeof res.data === "object" ? res.data : null;
}

export async function uploadDriverPhoto(uid: string, file: File): Promise<Driver> {
  const form = new FormData();
  form.append("photo", file);
  return (await postMultipart<Driver>(`${BASE}/${enc(uid)}/photo`, form)).data;
}

/** An object URL for the driver's photo; revoke it when done. */
export function driverPhotoUrl(uid: string): Promise<string> {
  return getBlobUrl(`${BASE}/${enc(uid)}/photo`);
}

// ── Scoring (navas-core-apis drivers.py / driver_scoring.py) ────────────────

/** One rule per violation: the client's own, or the default. */
export async function getDriverScoreRules(): Promise<DriverScoreRule[]> {
  const res = await get<DriverScoreRule[]>("/drivers/score/list");
  return Array.isArray(res.data) ? res.data : [];
}

export interface ScoreRuleFields {
  violation_parameter: string;
  points_denomination: number;
  max_deduction: number | null;
  score_name?: string;
}

/** Saves the client's rule for a violation: creates one over a default,
 *  edits one the client already has. Returns the rules after the change. */
export async function saveScoreRule(rule: DriverScoreRule, fields: ScoreRuleFields): Promise<DriverScoreRule[]> {
  const res = rule.is_default
    ? await post<DriverScoreRule[]>("/drivers/score/create", { data: fields })
    : await put<DriverScoreRule[]>("/drivers/score/update", { data: { ...fields, score_uid: rule.score_uid } });
  return Array.isArray(res.data) ? res.data : [];
}

/** Removes the client's own rule: the default applies again. */
export async function resetScoreRule(scoreUid: string): Promise<DriverScoreRule[]> {
  const res = await del<DriverScoreRule[]>("/drivers/score/delete", { data: { score_uid: scoreUid } });
  return Array.isArray(res.data) ? res.data : [];
}

/** Every driver's scorecard, best first. Dates are DD-MM-YYYY; the server
 *  uses the last 30 days when they are left out. */
export async function getScorecards(startDate?: string, endDate?: string): Promise<ScorecardList> {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  return (await get<ScorecardList>("/drivers/scorecards", { params })).data;
}

/** One driver's scorecard, with each violation. */
export async function getDriverScorecard(uid: string, startDate?: string, endDate?: string): Promise<DriverScorecardDetail> {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  return (await get<DriverScorecardDetail>(`${BASE}/${enc(uid)}/scorecard`, { params })).data;
}
