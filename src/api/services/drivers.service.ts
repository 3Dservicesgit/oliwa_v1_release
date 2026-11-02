/**
 * drivers.service.ts — driver management, as in the OLIWA mobile app:
 * register, edit, change status, assign to a vehicle, photo.
 *
 *   GET  /drivers/registry?status=&q=          → getDrivers
 *   POST /drivers/registry                     → registerDriver
 *   GET  /drivers/registry/{uid}               → getDriver
 *   PUT  /drivers/registry/{uid}               → updateDriver
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
import { get, getBlobUrl, post, postMultipart, put } from "../client";
import type {
  Driver, DriverAssignment, DriverFields, DriverScoreRule, DriverStatus,
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

export async function getDriverScoreRules(): Promise<DriverScoreRule[]> {
  const res = await get<DriverScoreRule[]>("/drivers/score/list");
  return Array.isArray(res.data) ? res.data : [];
}
