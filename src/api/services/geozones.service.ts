/**
 * geozones.service.ts — Geofences / Geozones API service.
 *
 * Endpoints:
 *   POST   /geozones/create                                 → createGeozone
 *   PUT    /geozones/{geozone_id}/update                    → updateGeozone
 *   GET    /geozones/{owner_uid}/list/{access_level}/load   → getGeozones
 *   GET    /geozones/{geozone_id}/details                   → getGeozoneDetails
 *   DELETE /geozones/{geozone_id}/delete                    → deleteGeozone
 *   POST   /geozones/{geozone_id}/attach                   → attachDevicesToGeozone
 *   PUT    /geozones/{geozone_id}/detach/{device_id}/action → detachDeviceFromGeozone
 *   GET    /geozones/devices/{device_uid}/list              → getDeviceGeozones
 */

import { get, post, put, del } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ApiResponse, RequestOptions } from "../types";
import type {
  Geozone,
  CreateGeozoneRequest,
  UpdateGeozoneRequest,
  AttachDevicesRequest,
  DeviceGeozone,
  GeozoneDetails,
  GeozoneGroup,
  CreateGeozoneGroupRequest,
  UpdateGeozoneGroupRequest,
} from "../types";

// ── CRUD ────────────────────────────────────────────────────────────────────

/** Create a new geozone. */
export function createGeozone(
  payload: CreateGeozoneRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return post<string>(ENDPOINTS.GEOZONES.CREATE, { data: payload }, opts);
}

/** Update an existing geozone (name, description, points). */
export function updateGeozone(
  geozoneId: string,
  payload: UpdateGeozoneRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return put<string>(
    `${ENDPOINTS.GEOZONES.UPDATE}/${geozoneId}/update`,
    { data: payload },
    opts,
  );
}

/**
 * Fetch all geozones for an owner.
 * @param ownerUid  The account UID of the zone owner.
 * @param accessLevel  "client" | "service_provider" | "inhouse"
 */
export function getGeozones(
  ownerUid: string,
  accessLevel: "client" | "service_provider" | "inhouse" = "client",
  opts?: RequestOptions,
): Promise<ApiResponse<Geozone[]>> {
  return get<Geozone[]>(
    `${ENDPOINTS.GEOZONES.LIST}/${ownerUid}/list/${accessLevel}/load`,
    opts,
  );
}

/** Fetch details for a single geozone. */
export function getGeozoneDetails(
  geozoneId: string,
  opts?: RequestOptions,
): Promise<ApiResponse<GeozoneDetails>> {
  return get<GeozoneDetails>(
    `${ENDPOINTS.GEOZONES.DETAILS}/${geozoneId}/details`,
    opts,
  );
}

/** Delete a geozone. */
export function deleteGeozone(
  geozoneId: string,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return del<string>(
    `${ENDPOINTS.GEOZONES.DELETE}/${geozoneId}/delete`,
    undefined,
    opts,
  );
}

// ── Device attachment ───────────────────────────────────────────────────────

/** Attach one or more devices to a geozone. */
export function attachDevicesToGeozone(
  geozoneId: string,
  payload: AttachDevicesRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return post<string>(
    `${ENDPOINTS.GEOZONES.ATTACH}/${geozoneId}/attach`,
    { data: payload },
    opts,
  );
}

/** Detach a single device from a geozone. */
export function detachDeviceFromGeozone(
  geozoneId: string,
  deviceImei: string,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return put<string>(
    `${ENDPOINTS.GEOZONES.DETACH}/${geozoneId}/detach/${deviceImei}/action`,
    {},
    opts,
  );
}

/** Get all geozones attached to a specific device. */
export function getDeviceGeozones(
  deviceUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<DeviceGeozone[]>> {
  return get<DeviceGeozone[]>(
    `${ENDPOINTS.GEOZONES.DEVICE_ZONES}/${deviceUid}/list`,
    opts,
  );
}

// ── Geozone Groups ─────────────────────────────────────────────────────────

/** Create a new geozone group. */
export function createGeozoneGroup(
  payload: CreateGeozoneGroupRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<{ group_uid: string }>> {
  return post<{ group_uid: string }>(ENDPOINTS.GEOZONES.GROUP_CREATE, { data: payload }, opts);
}

/** List all geozone groups for an owner. */
export function getGeozoneGroups(
  ownerUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<GeozoneGroup[]>> {
  return get<GeozoneGroup[]>(`${ENDPOINTS.GEOZONES.GROUP_LIST}/${ownerUid}/list`, opts);
}

/** Update a geozone group. */
export function updateGeozoneGroup(
  groupUid: string,
  payload: UpdateGeozoneGroupRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return put<string>(`${ENDPOINTS.GEOZONES.GROUP_UPDATE}/${groupUid}/update`, { data: payload }, opts);
}

/** Delete a geozone group. */
export function deleteGeozoneGroup(
  groupUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return del<string>(`${ENDPOINTS.GEOZONES.GROUP_DELETE}/${groupUid}/delete`, {}, opts);
}

/** Assign geozones to a group. */
export function assignGeozonesToGroup(
  groupUid: string,
  geozoneUids: string[],
  opts?: RequestOptions,
): Promise<ApiResponse<{ updated: number }>> {
  return post<{ updated: number }>(
    `${ENDPOINTS.GEOZONES.GROUP_ASSIGN}/${groupUid}/assign`,
    { data: { geozone_uids: geozoneUids } },
    opts,
  );
}

/** Remove geozones from a group. */
export function removeGeozonesFromGroup(
  groupUid: string,
  geozoneUids: string[],
  opts?: RequestOptions,
): Promise<ApiResponse<{ removed: number }>> {
  return post<{ removed: number }>(
    `${ENDPOINTS.GEOZONES.GROUP_REMOVE}/${groupUid}/remove`,
    { data: { geozone_uids: geozoneUids } },
    opts,
  );
}
