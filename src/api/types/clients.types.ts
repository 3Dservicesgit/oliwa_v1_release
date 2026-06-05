/**
 * clients.types.ts — Types for the Clients API.
 */

export interface Client {
  client_uid:   string;
  client_name:  string;
  client_email: string;
}

export interface CreateClientRequest {
  client_name:  string;
  client_email: string;
  client_owner: string;
}

export interface UpdateClientRequest {
  client_name?:  string;
  client_email?: string;
}

export interface TrashClientRequest {
  deleted_by: string;
}

export interface TrashedClient {
  client_uid:   string;
  client_name:  string;
  client_email: string;
  deleted_by:   string;
  deleted_at:   string;
}

export interface ClientDevice {
  device_imei:          string;
  device_name:          string;
  simcard:              string;
  simcard_uid:          string;
  car_make:             string;
  car_model:            string;
  vin_number:           string;
  car_type:             string;
  events_attached:      string;
  billing_status:       string;
  subscription_status:  string;
  client_uid:           string;
  client_name:          string;
  hardware:             string;
  hardware_model:       string;
}

// ── Unit statistics ──────────────────────────────────────────────────────────

export interface OnlineUnit {
  device_imei:          string;
  device_name:          string;
  client_uid:           string;
  client_name:          string;
  last_seen_timestamp:  string;
  last_seen_datestamp:   string;
  status:               string;
}

export interface OnlineUnitsResponse {
  count:                    number;
  total_configured_units:   number;
  criteria:                 string;
  units:                    OnlineUnit[];
}

export interface OfflineUnitsResponse {
  count:                    number;
  total_configured_units:   number;
  criteria:                 string;
  units:                    OnlineUnit[];  // same shape as online
}

export interface ExpiredSubscription {
  token_billing_uid:  string;
  client_uid:         string;
  client_name:        string;
  token_id:           string;
  token_name:         string;
  token_type:         string;
  token_status:       string;
  token_hours_left:   number;
  token_hours_used:   number;
  token_currency:     string;
}

export interface ExpiredTokensResponse {
  count:          number;
  subscriptions:  ExpiredSubscription[];
}

// ── Token registry (packages available for purchase) ────────────────────────

export interface TokenPackage {
  token_id:         string;
  token_name:       string;
  token_type:       string;   // "parameter" | "dynamic"
  token_validity:   number;   // hours
  token_currency:   string;   // KES, UGX, USD
  token_parameters: unknown[];
  date_created:     string;
  token_amount:     number;   // price per unit
}

// ── Token wallet ────────────────────────────────────────────────────────────

export interface ClientTokenBalance {
  client_uid:        string;
  client_name:       string;
  token_billing_uid: string | null;
  token_uid:         string | null;
  token_name:        string;
  token_hours_left:  number;
  token_hours_used:  number;
}

export interface BuyTokensRequest {
  token_buyer:          string;   // client_uid
  token_uid:            string;   // token type/plan UID
  mobile_money_number:  string;
  token_quantity:       number;
}

export interface BuyTokensResponse {
  client_uid:   string;
  new_balance:  number;
  transaction_id: string;
}

export interface TransferTokensRequest {
  source_client_uid:      string;
  destination_client_uid: string;
  token_billing_uid:      string;
}

export interface TransferTokensResponse {
  from_client_uid:  string;
  to_client_uid:    string;
  from_new_balance: number;
  to_new_balance:   number;
}
