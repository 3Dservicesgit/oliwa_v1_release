/**
 * veba.service.ts — VEBA marketplace API service.
 */

import { get, post, put, del, postMultipart } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ApiResponse, RequestOptions } from "../types";
import type {
  VebaStatistics,
  VebaListing,
  CreateVebaListingRequest,
  CreateVebaListingResponse,
  BookingRequest,
  CreateBookingRequest,
  CreateBookingRequestResponse,
} from "../types";

export function getVebaStatistics(opts?: RequestOptions): Promise<VebaStatistics> {
  return get<VebaStatistics>(ENDPOINTS.VEBA.STATISTICS, opts).then((res) => res.data);
}

export function createVebaListing(
  payload: CreateVebaListingRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<CreateVebaListingResponse>> {
  return post<CreateVebaListingResponse>(ENDPOINTS.VEBA.LISTINGS_CREATE, { data: payload }, opts);
}

export function getVebaListingForAsset(
  assetUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<VebaListing | null>> {
  return get<VebaListing | null>(`${ENDPOINTS.VEBA.LISTINGS_BY_ASSET}/${assetUid}`, opts);
}

export function getVebaListingByUid(
  listingUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<VebaListing>> {
  return get<VebaListing>(`${ENDPOINTS.VEBA.LISTINGS_BY_UID}/${listingUid}`, opts);
}

export function getVebaListings(
  accountRoot: string,
  opts?: RequestOptions,
): Promise<ApiResponse<VebaListing[]>> {
  return get<VebaListing[]>(ENDPOINTS.VEBA.LISTINGS, {
    ...opts,
    params: { account_root: accountRoot, ...opts?.params },
  });
}

export function pauseVebaListing(
  listingUid: string, updatedBy: string, opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return put<string>(`${ENDPOINTS.VEBA.LISTINGS_PAUSE}/${listingUid}/pause`, { data: { updated_by: updatedBy } }, opts);
}

export function reactivateVebaListing(
  listingUid: string, updatedBy: string, opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return put<string>(`${ENDPOINTS.VEBA.LISTINGS_REACTIVATE}/${listingUid}/reactivate`, { data: { updated_by: updatedBy } }, opts);
}

export function archiveVebaListing(
  listingUid: string, updatedBy: string, opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return put<string>(`${ENDPOINTS.VEBA.LISTINGS_ARCHIVE}/${listingUid}/archive`, { data: { updated_by: updatedBy } }, opts);
}

export function deleteVebaListing(
  listingUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<{ listing_uid: string }>> {
  return del<{ listing_uid: string }>(
    `${ENDPOINTS.VEBA.LISTINGS_DELETE}/${listingUid}/delete`,
    undefined,
    opts,
  );
}

export function updateVebaListing(
  listingUid: string,
  fields: Record<string, unknown>,
  opts?: RequestOptions,
): Promise<ApiResponse<{ listing_uid: string }>> {
  return put<{ listing_uid: string }>(
    `${ENDPOINTS.VEBA.LISTINGS_UPDATE}/${listingUid}/update`,
    { data: fields },
    opts,
  );
}

export function approveBookingRequest(
  requestUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<{ request_uid: string; status: string }>> {
  return put<{ request_uid: string; status: string }>(
    `${ENDPOINTS.VEBA.BOOKING_REQUESTS}/${requestUid}/approve`,
    { data: {} },
    opts,
  );
}

export function rejectBookingRequest(
  requestUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<{ request_uid: string; status: string }>> {
  return put<{ request_uid: string; status: string }>(
    `${ENDPOINTS.VEBA.BOOKING_REQUESTS}/${requestUid}/reject`,
    { data: {} },
    opts,
  );
}

export function cancelBookingRequest(
  requestUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<{ request_uid: string; status: string }>> {
  return put<{ request_uid: string; status: string }>(
    `${ENDPOINTS.VEBA.BOOKING_REQUESTS}/${requestUid}/cancel`,
    { data: {} },
    opts,
  );
}

export function fulfillBookingRequest(
  requestUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<{ request_uid: string; status: string }>> {
  return put<{ request_uid: string; status: string }>(
    `${ENDPOINTS.VEBA.BOOKING_REQUESTS}/${requestUid}/fulfill`,
    { data: {} },
    opts,
  );
}

export function createBookingRequest(
  payload: CreateBookingRequest, opts?: RequestOptions,
): Promise<ApiResponse<CreateBookingRequestResponse>> {
  return post<CreateBookingRequestResponse>(ENDPOINTS.VEBA.BOOKING_REQUESTS_CREATE, { data: payload }, opts);
}

export function getBookingRequests(
  accountRoot: string, opts?: RequestOptions,
): Promise<ApiResponse<BookingRequest[]>> {
  return get<BookingRequest[]>(ENDPOINTS.VEBA.BOOKING_REQUESTS, {
    ...opts,
    params: { account_root: accountRoot, ...opts?.params },
  });
}

export function uploadAssetPhoto(
  assetUid: string,
  file: File,
  opts?: RequestOptions,
): Promise<ApiResponse<{ photo_url: string }>> {
  const formData = new FormData();
  formData.append("photo", file);
  return postMultipart<{ photo_url: string }>(
    `${ENDPOINTS.VEBA.ASSET_PHOTO_UPLOAD}/${assetUid}/photo`,
    formData,
    opts,
  );
}

/**
 * Build the full URL for an asset photo path returned by the API.
 * The photo_url from the backend is a relative path like "/veba/assets/photo/xxx.jpg".
 */
export function getAssetPhotoFullUrl(photoPath: string): string {
  if (!photoPath) return "";
  if (photoPath.startsWith("http")) return photoPath;
  const base = import.meta.env.VITE_API_BASE_URL || "";
  return `${base.replace(/\/+$/, "")}${photoPath}`;
}
