/**
 * drivers.types.ts — the client's drivers (navas-core-apis
 * endpoints/driver_registry.py, migration 052). The same records the OLIWA
 * mobile app's Drivers module shows.
 */

export type DriverStatus = "active" | "suspended" | "blacklisted" | "inactive";

/** 'valid', 'expiring' (within 30 days) or 'expired' — worked out by the
 *  server on its own date. */
export type PermitState = "valid" | "expiring" | "expired";

export interface Driver {
  driver_uid: string;
  full_name: string;
  phone: string;
  permit_number: string;
  permit_expiry: string | null;      // YYYY-MM-DD
  permit_state: PermitState | string;
  permit_classes: string[] | string;
  status: DriverStatus | string;
  status_reason?: string | null;
  ibutton_id?: string | null;
  national_id?: string | null;
  employee_number?: string | null;
  emergency_name?: string | null;
  emergency_phone?: string | null;
  home_branch?: string | null;
  notes?: string | null;
  has_photo?: boolean;
  current_imei?: string | null;      // the vehicle they are in now
  assigned_at?: string | null;
}

/** Fields sent to register or edit a driver. On edit only the fields sent
 *  change; an optional field sent empty is cleared. */
export interface DriverFields {
  full_name?: string;
  phone?: string;
  permit_number?: string;
  permit_expiry?: string;
  permit_classes?: string[];
  ibutton_id?: string;
  national_id?: string;
  employee_number?: string;
  emergency_name?: string;
  emergency_phone?: string;
  home_branch?: string;
  notes?: string;
}

/** One stint of a driver in a vehicle, newest first. */
export interface DriverAssignment {
  device_imei: string;
  assigned_at: string;
  ended_at: string | null;
  /** 'reassigned', 'replaced', 'unassigned', or the status that ended it. */
  end_reason: string | null;
}

/** A driver-behaviour scoring rule (GET /drivers/score/list). */
export type DriverScoreRule = Record<string, unknown>;
