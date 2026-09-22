/**
 * booking.types.ts — Types for VEBA booking requests.
 */

export type BookingRequestStatus = "pending" | "approved" | "rejected" | "cancelled" | "fulfilled";

export interface BookingRequest {
  request_uid:    string;
  listing_uid:    string;
  asset_uid:      string;
  requester_uid:  string;
  requester_root: string;
  owner_root:     string;

  start_date:     string;
  end_date:       string;
  notes?:         string | null;

  status:         BookingRequestStatus;
  created_at:     string;
  updated_at:     string;

  /** The rate the requester saw, frozen at request time. Absent on a row
   *  the server couldn't parse. */
  rate_snapshot?: {
    daily_rate:     number;
    currency:       string;
    pricing_basis:  string;
  } | null;

  /** The asset's details, carried over from its listing so a request can be
   *  shown by name rather than by UID. */
  asset_summary?: {
    display_name?: string;
    asset_class?:  string;
    owner_org?:    string;
    country?:      string;
  } | null;
}

export interface CreateBookingRequest {
  listing_uid:    string;
  requester_uid:  string;
  requester_root: string;
  start_date:     string;
  end_date:       string;
  notes?:         string | null;
}

export interface CreateBookingRequestResponse {
  request_uid: string;
}
