/**
 * veba.service.ts — VEBA marketplace API service.
 */

import { get, post, put, del, postMultipart } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { RequestOptions } from "../types";
import type { VebaStatistics, VebaListing, CreateVebaListingRequest, CreateVebaListingResponse } from "../types";
import type { BookingRequest, CreateBookingRequest, CreateBookingRequestResponse } from "../types";
import type { ApiResponse } from "../types";

/* ── Statistics ────────────────────────────────────────────────────── */

export function getVebaStatistics(
  opts?: RequestOptions,
): Promise<VebaStatistics> {
  return get<VebaStatistics>(ENDPOINTS.VEBA.STATISTICS, opts).then(res => res.data);
}

/* ── Listings ──────────────────────────────────────────────────────── */

export function getVebaListings(
  accountRoot: string,
  opts?: RequestOptions,
): Promise<VebaListing[]> {
  const merged: RequestOptions = {
    ...opts,
    params: { account_root: accountRoot, ...(opts?.params ?? {}) },
  };
  return get<VebaListing[]>(
    ENDPOINTS.VEBA.LISTINGS,
    merged,
  ).then(res => res.data);
}

export function createVebaListing(
  payload: CreateVebaListingRequest,
  opts?: RequestOptions,
): Promise<CreateVebaListingResponse> {
  return post<CreateVebaListingResponse>(
    ENDPOINTS.VEBA.LISTINGS_CREATE,
    payload,
    opts,
  ).then(res => res.data);
}

export function updateVebaListing(
  listingUid: string,
  fields: Record<string, unknown>,
  opts?: RequestOptions,
) {
  return put(
    `${ENDPOINTS.VEBA.LISTINGS_UPDATE}/${listingUid}/update`,
    fields,
    opts,
  );
}

export function pauseVebaListing(
  listingUid: string,
  updatedBy: string,
  opts?: RequestOptions,
) {
  return put(
    `${ENDPOINTS.VEBA.LISTINGS_PAUSE}/${listingUid}/pause`,
    { updated_by: updatedBy },
    opts,
  );
}

export function reactivateVebaListing(
  listingUid: string,
  updatedBy: string,
  opts?: RequestOptions,
) {
  return put(
    `${ENDPOINTS.VEBA.LISTINGS_REACTIVATE}/${listingUid}/reactivate`,
    { updated_by: updatedBy },
    opts,
  );
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


/* ── Booking requests ──────────────────────────────────────────────── */

export function getBookingRequests(
  accountRoot: string,
  opts?: RequestOptions,
): Promise<BookingRequest[]> {
  const merged: RequestOptions = {
    ...opts,
    params: { account_root: accountRoot, ...(opts?.params ?? {}) },
  };
  return get<BookingRequest[]>(
    ENDPOINTS.VEBA.BOOKING_REQUESTS,
    merged,
  ).then(res => res.data);
}

export function createBookingRequest(
  payload: CreateBookingRequest,
  opts?: RequestOptions,
): Promise<CreateBookingRequestResponse> {
  return post<CreateBookingRequestResponse>(
    ENDPOINTS.VEBA.BOOKING_CREATE,
    payload,
    opts,
  ).then(res => res.data);
}

export function approveBookingRequest(
  requestUid: string,
  opts?: RequestOptions,
) {
  return put(
    `${ENDPOINTS.VEBA.BOOKING_APPROVE}/${requestUid}/approve`,
    {},
    opts,
  );
}

export function rejectBookingRequest(
  requestUid: string,
  opts?: RequestOptions,
) {
  return put(
    `${ENDPOINTS.VEBA.BOOKING_REJECT}/${requestUid}/reject`,
    {},
    opts,
  );
}

export function cancelBookingRequest(
  requestUid: string,
  opts?: RequestOptions,
) {
  return put(
    `${ENDPOINTS.VEBA.BOOKING_CANCEL}/${requestUid}/cancel`,
    {},
    opts,
  );
}

export function fulfillBookingRequest(
  requestUid: string,
  opts?: RequestOptions,
) {
  return put(
    `${ENDPOINTS.VEBA.BOOKING_FULFILL}/${requestUid}/fulfill`,
    {},
    opts,
  );
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
