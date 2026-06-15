/**
 * tracking.service.ts — Trip History & Track Playback API service.
 *
 * Endpoints:
 *   POST /data-stream/trips/history        → getTripHistory
 *   POST /data-stream/trips/history/replay → getTripReplay
 *   POST /data-stream/location/geocoding   → reverseGeocode
 */

import { post } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ApiResponse, RequestOptions } from "../types";
import type {
  TripHistoryRequest,
  TripHistoryResponse,
  ReplayRecord,
  GeocodeResponse,
} from "../types";

/**
 * Fetch full trip history with IO events for a device within a date range.
 * Returns raw position records + computed trip summaries.
 */
export function getTripHistory(
  payload: TripHistoryRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<TripHistoryResponse>> {
  return post<TripHistoryResponse>(
    ENDPOINTS.TRACKING.TRIPS_HISTORY,
    { data: payload },
    opts,
  );
}

/**
 * Fetch lightweight trip replay positions (no IO events).
 * Ideal for drawing route polylines on a map.
 */
export function getTripReplay(
  payload: TripHistoryRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<ReplayRecord[]>> {
  return post<ReplayRecord[]>(
    ENDPOINTS.TRACKING.TRIPS_REPLAY,
    { data: payload },
    opts,
  );
}

/**
 * Reverse-geocode GPS coordinates to a street address.
 */
export function reverseGeocode(
  lat: string,
  lng: string,
  opts?: RequestOptions,
): Promise<ApiResponse<GeocodeResponse>> {
  return post<GeocodeResponse>(
    ENDPOINTS.TRACKING.GEOCODE,
    { data: { latitude_cords: lat, logitude_cords: lng } },
    opts,
  );
}
