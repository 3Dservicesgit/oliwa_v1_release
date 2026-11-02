/**
 * fuel.types.ts — FuelMath: fuel issued to drivers, checked against the
 * tracker (navas-core-apis endpoints/fuel_registry.py and fuel_rules.py,
 * migration 053). The same records the OLIWA mobile app's FuelMath shows.
 *
 * Numbers can arrive as text; read them with fuelNum() (features/fuel).
 */

export type FuelType = "diesel" | "petrol";
export type PaymentMethod = "fuel_card" | "cash" | "credit" | "mobile_money";

/** 'none', 'open', 'explained' or 'confirmed_loss'. */
export type ReviewState = "none" | "open" | "explained" | "confirmed_loss";

/** One finding of the server's checks. A 'discrepancy' needs a review; a
 *  'notice' says a check could not be done. */
export interface FuelFlag {
  code: string;
  kind: "discrepancy" | "notice" | string;
  message: string;
}

/** Where the tracker put the vehicle at the issue time. */
export interface FuelTracker {
  /** 'checked', 'no_data', 'unavailable' or 'unchecked'. */
  state: string;
  lat?: number | null;
  lon?: number | null;
  at?: string | null;
  place?: string | null;
}

export interface FuelIssue {
  issue_uid: string;
  device_imei: string;
  driver_uid: string | null;          // null: recorded without a driver
  driver_name: string | null;
  issued_at: string;
  fuel_type: FuelType | string;
  litres: number | string;
  unit_price: number | string;
  total_cost: number | string;
  full_tank: boolean;
  odometer_km: number | string | null;
  station_name: string;
  receipt_number: string | null;
  payment_method: PaymentMethod | string;
  notes: string | null;
  has_receipt: boolean;
  tracker: FuelTracker | null;
  /** Since the previous full tank, and the km per litre they give. */
  km_since_full: number | string | null;
  litres_since_full: number | string | null;
  km_per_l: number | string | null;
  flags: FuelFlag[] | null;
  review_state: ReviewState | string;
  review_note: string | null;
  reviewed_at: string | null;
  voided: boolean;
  void_reason: string | null;
}

/** Fields sent to record an issue. issued_at is local, YYYY-MM-DDTHH:mm.
 *  driver_uid is left out when unknown: the server then uses whoever was
 *  assigned to the vehicle at that time, if anyone. */
export interface FuelIssueFields {
  device_imei: string;
  driver_uid?: string;
  issued_at: string;
  litres: number;
  unit_price: number;
  fuel_type: FuelType;
  station_name: string;
  payment_method: PaymentMethod;
  full_tank: boolean;
  odometer_km?: string;
  receipt_number?: string;
  notes?: string;
}

/** What a vehicle should use: the yardstick for its fuel issues. */
export interface FuelProfile {
  device_imei: string;
  fuel_type: FuelType | string;
  tank_capacity_l: number | string;
  baseline_km_per_l: number | string;
  tolerance_pct: number | string;
  updated_at?: string;
}

export interface FuelProfileFields {
  fuel_type: FuelType;
  tank_capacity_l: number;
  baseline_km_per_l: number;
  tolerance_pct: number;
}

/** Which fuel features a vehicle can use (GET /fuel/capabilities). */
export interface FuelCapability {
  device_imei: string;
  name: string;
  has_profile: boolean;
  /** 'none', 'needs_calibration' or 'ready'. */
  fuel_sensor: string;
}

export interface FuelVehicleTotal {
  device_imei: string;
  issues: number;
  litres: number;
  cost: number;
  open_reviews: number;
  measured_km: number;
  km_per_l: number | null;
  baseline_km_per_l: number | null;
  cost_per_km: number | null;
  excess_litres: number | null;
  excess_cost: number | null;
}

export interface FuelDriverTotal {
  driver_uid: string | null;
  driver_name: string | null;
  issues: number;
  litres: number;
  cost: number;
  flagged: number;
}

export interface FuelSummary {
  totals: {
    issues: number;
    litres: number;
    cost: number;
    open_reviews: number;
    excess_cost: number;
  };
  vehicles: FuelVehicleTotal[];
  drivers: FuelDriverTotal[];
}
