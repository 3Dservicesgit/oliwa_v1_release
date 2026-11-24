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
  /** No history (never in a vehicle, no fuel issued), so it may be deleted.
   *  Sent on single-driver reads only; absent in lists. */
  deletable?: boolean;
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

/** A driver scoring rule (GET /drivers/score/list, navas-core-apis
 *  driver_scoring.py). Every driver starts a period at 100 and each
 *  violation takes off `points_denomination`, at most `max_deduction` per
 *  period. The list has one rule per violation: the client's own, or the
 *  built-in default (is_default, score_uid "default:<violation>"). */
export interface DriverScoreRule {
  score_uid: string;
  score_name: string;
  violation_parameter: string;
  violation_label: string;
  points_denomination: number | null;
  max_deduction: number | null;
  /** False for violations the server cannot see yet (harsh driving, night
   *  driving): a rule can be saved but deducts nothing. */
  measured: boolean;
  is_default: boolean;
}

export interface ScoreBreakdown {
  violation: string;
  label: string;
  count: number;
  points_each: number;
  deducted: number;
}

export interface ScoreViolation {
  code: string;
  label: string;
  at: string;          // "YYYY-MM-DD HH:MM"
  vehicle: string;
  detail: string;
}

/** One driver's scorecard for a period. score is null when they neither
 *  drove nor had a violation ("No driving"). */
export interface DriverScorecard {
  driver_uid: string;
  full_name: string;
  status: string;
  score: number | null;
  grade: "A" | "B" | "C" | "D" | null;
  grade_label: string;
  deducted: number;
  violation_count: number;
  breakdown: ScoreBreakdown[];
  rank: number | null;
  /** Only on the single-driver scorecard. */
  violations?: ScoreViolation[];
}

/** GET /drivers/scorecards */
export interface ScorecardList {
  start_date: string;  // DD-MM-YYYY
  end_date: string;
  start_score: number;
  rules: DriverScoreRule[];
  drivers: DriverScorecard[];
}

/** GET /drivers/registry/<uid>/scorecard */
export interface DriverScorecardDetail extends DriverScorecard {
  start_date: string;
  end_date: string;
  start_score: number;
  rules: DriverScoreRule[];
  ranked_drivers: number;
}
