/**
 * tracking.types.ts — Types for Trip History & Track Playback APIs.
 *
 * Endpoints:
 *   POST /data-stream/trips/history        → getTripHistory
 *   POST /data-stream/trips/history/replay → getTripReplay
 *   POST /data-stream/location/geocoding   → reverseGeocode
 */

// ── Request ─────────────────────────────────────────────────────────────────

export interface TripHistoryRequest {
  device_imei:  string;
  from_date:    string;   // DD-MM-YYYY
  to_date:      string;   // DD-MM-YYYY
  offset_log:   number;
  record_count: number;
}

// ── Position record (single GPS fix) ────────────────────────────────────────

export interface PositionRecord {
  data_longitude:           string;
  data_latitude:            string;
  speed_log:                number;
  data_hdop:                string;
  local_system_datestamp:    string;   // DD-MM-YYYY
  record_io_events_uid:     string;
  geocoded_location:        string;
  local_system_timestamp:   string;   // HH:MM:SS
  data_connected_satelites: number;
  batch_uid:                string;
  data_idx:                 number;
  data_index:               number;
  /** IO events — array of key-value objects or "no-data" */
  io_events_data:           Record<string, string>[] | "no-data";
  /** Derived end-user data (ignition, mileage, fuel, driver) */
  enduser_data?:            EndUserData[];
}

export interface EndUserData {
  iginition:  string;   // note: backend typo "iginition" not "ignition"
  mileage:    string;
  fuel_level: string;
  driver_id:  string;
}

// ── Trip summary (computed by backend from position records) ────────────────

export interface TripSummary {
  trip_number:      number;
  start_time:       string;
  end_time:         string;
  start_point_dta:  PositionRecord;
  end_point_dta:    PositionRecord;
  mileage_passed:   number;   // km (rounded)
}

// ── Full response from /data-stream/trips/history ──────────────────────────

export interface TripHistoryResponse {
  raw_data:   PositionRecord[];
  trips_data: TripSummary[];
}

// ── Replay record (lightweight, no IO events) ──────────────────────────────

export interface ReplayRecord {
  data_longitude:           string;
  data_latitude:            string;
  speed_log:                number;
  data_hdop:                string;
  local_system_datestamp:    string;
  record_io_events_uid:     string;
  geocoded_location:        string;
  local_system_timestamp:   string;
  data_connected_satelites: number;
  batch_uid:                string;
  data_idx:                 number;
  data_index:               number;
}

// ── Geocoding ──────────────────────────────────────────────────────────────

export interface GeocodeRequest {
  latitude_cords:  string;
  logitude_cords:  string;   // note: backend typo "logitude" not "longitude"
}

export interface GeocodeResponse {
  address: string;
}
