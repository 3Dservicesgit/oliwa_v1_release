/**
 * fuel.service.ts — FuelMath, as in the OLIWA mobile app: record fuel issued
 * to drivers and review what the server's checks found.
 *
 *   GET  /fuel/issues?device_imei=&driver_uid=&from=&to=&review=&voided=
 *                                         → getFuelIssues
 *   POST /fuel/issues                     → recordFuelIssue
 *   GET  /fuel/issues/{uid}               → getFuelIssue
 *   POST /fuel/issues/{uid}/review        → reviewFuelIssue
 *   POST /fuel/issues/{uid}/void          → voidFuelIssue
 *   POST /fuel/issues/{uid}/receipt       → uploadFuelReceipt
 *   GET  /fuel/issues/{uid}/receipt       → fuelReceiptUrl (signed in)
 *   GET  /fuel/profiles                   → getFuelProfiles
 *   PUT  /fuel/profiles/{imei}            → saveFuelProfile
 *   GET  /fuel/summary?from=&to=          → getFuelSummary
 *   GET  /fuel/stations                   → getFuelStations
 *   GET  /fuel/capabilities               → getFuelCapabilities
 *
 * Every call works on the signed-in user's own client (fuel_registry.py).
 */
import { get, getBlobUrl, post, postMultipart, put } from "../client";
import type {
  FuelCapability, FuelIssue, FuelIssueFields, FuelProfile, FuelProfileFields,
  FuelSummary,
} from "../types/fuel.types";

const enc = encodeURIComponent;

export interface FuelIssueFilter {
  imei?: string;
  driverUid?: string;
  from?: string;          // YYYY-MM-DD
  to?: string;
  review?: string;        // 'open', 'reviewed', 'explained', 'confirmed_loss'
  includeVoided?: boolean;
}

/** Newest first. */
export async function getFuelIssues(f: FuelIssueFilter = {}): Promise<FuelIssue[]> {
  const params: Record<string, string> = {};
  if (f.imei) params.device_imei = f.imei;
  if (f.driverUid) params.driver_uid = f.driverUid;
  if (f.from) params.from = f.from;
  if (f.to) params.to = f.to;
  if (f.review) params.review = f.review;
  if (f.includeVoided) params.voided = "include";
  const res = await get<FuelIssue[]>("/fuel/issues", { params });
  return Array.isArray(res.data) ? res.data : [];
}

export async function getFuelIssue(uid: string): Promise<FuelIssue> {
  return (await get<FuelIssue>(`/fuel/issues/${enc(uid)}`)).data;
}

/** The reply carries the checks' flags. Recording reads the tracker's
 *  positions since the previous full tank, so it can take a while. */
export async function recordFuelIssue(fields: FuelIssueFields): Promise<FuelIssue> {
  return (await post<FuelIssue>("/fuel/issues", { data: fields })).data;
}

/** `outcome`: 'explained' or 'confirmed_loss'. */
export async function reviewFuelIssue(uid: string, outcome: string, note: string): Promise<FuelIssue> {
  return (await post<FuelIssue>(`/fuel/issues/${enc(uid)}/review`, { data: { outcome, note } })).data;
}

export async function voidFuelIssue(uid: string, reason: string): Promise<FuelIssue> {
  return (await post<FuelIssue>(`/fuel/issues/${enc(uid)}/void`, { data: { reason } })).data;
}

export async function uploadFuelReceipt(uid: string, file: File): Promise<FuelIssue> {
  const form = new FormData();
  form.append("photo", file);
  return (await postMultipart<FuelIssue>(`/fuel/issues/${enc(uid)}/receipt`, form)).data;
}

/** An object URL for the receipt photo; revoke it when done. */
export function fuelReceiptUrl(uid: string): Promise<string> {
  return getBlobUrl(`/fuel/issues/${enc(uid)}/receipt`);
}

/** By IMEI. */
export async function getFuelProfiles(): Promise<Record<string, FuelProfile>> {
  const res = await get<FuelProfile[]>("/fuel/profiles");
  const out: Record<string, FuelProfile> = {};
  for (const p of Array.isArray(res.data) ? res.data : []) out[p.device_imei] = p;
  return out;
}

export async function saveFuelProfile(imei: string, fields: FuelProfileFields): Promise<FuelProfile> {
  return (await put<FuelProfile>(`/fuel/profiles/${enc(imei)}`, { data: fields })).data;
}

export async function getFuelSummary(from: string, to: string): Promise<FuelSummary> {
  const res = await get<FuelSummary>("/fuel/summary", { params: { from, to } });
  return res.data ?? { totals: { issues: 0, litres: 0, cost: 0, open_reviews: 0, excess_cost: 0 }, vehicles: [], drivers: [] };
}

/** Station names used before, most used first. */
export async function getFuelStations(): Promise<string[]> {
  const res = await get<unknown[]>("/fuel/stations");
  return Array.isArray(res.data) ? res.data.map(String) : [];
}

/** By IMEI. */
export async function getFuelCapabilities(): Promise<Record<string, FuelCapability>> {
  const res = await get<FuelCapability[]>("/fuel/capabilities");
  const out: Record<string, FuelCapability> = {};
  for (const c of Array.isArray(res.data) ? res.data : []) out[c.device_imei] = c;
  return out;
}
