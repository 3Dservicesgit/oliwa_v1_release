/**
 * driverRules.ts — labels and field checks for drivers, the same as the
 * OLIWA mobile app's (lib/models/driver.dart) and the server's
 * (navas-core-apis driver_rules.py), so a form error shows before sending.
 */
import type { Driver, DriverStatus } from "../../api/types/drivers.types";

export const STATUSES: DriverStatus[] = ["active", "suspended", "blacklisted", "inactive"];

export function statusLabel(status: string): string {
  switch (status) {
    case "active": return "Active";
    case "suspended": return "Suspended";
    case "blacklisted": return "Blacklisted";
    case "inactive": return "Inactive";
    default: return status;
  }
}

/** Uganda driving permit classes, with what each covers. */
export const PERMIT_CLASSES: { code: string; covers: string }[] = [
  { code: "A", covers: "Motorcycles" },
  { code: "B", covers: "Cars and light vehicles" },
  { code: "C", covers: "Light trucks" },
  { code: "CM", covers: "Medium goods vehicles" },
  { code: "CH", covers: "Heavy goods vehicles" },
  { code: "DL", covers: "Light omnibuses" },
  { code: "DM", covers: "Medium omnibuses" },
  { code: "DH", covers: "Heavy omnibuses and buses" },
  { code: "E", covers: "Vehicles with trailers" },
  { code: "F", covers: "Agricultural tractors" },
  { code: "G", covers: "Engineering plant" },
];

export function permitClasses(d: Driver): string[] {
  const c = d.permit_classes;
  if (Array.isArray(c)) return c.map(String);
  return String(c ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Why this driver cannot be put in a vehicle, or null when they can (the
 *  server checks again). */
export function assignmentBlock(d: Driver): string | null {
  if (d.status !== "active") return `This driver is ${d.status}.`;
  if (d.permit_state === "expired") return "This driver's permit has expired.";
  return null;
}

export function endReasonLabel(reason: string | null): string {
  switch (reason) {
    case "reassigned": return "Moved to another vehicle";
    case "replaced": return "Another driver took over";
    case "unassigned": return "Unassigned";
    case "suspended": return "Driver suspended";
    case "blacklisted": return "Driver blacklisted";
    case "inactive": return "Driver deactivated";
    case null: return "";
    default: return reason;
  }
}

/** '0772 123 456' and friends → '+256772123456'; null when not a number. */
export function normalisePhone(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const plus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  let local: string;
  if (plus) {
    if (!digits.startsWith("256")) {
      return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
    }
    local = digits.slice(3);
  } else if (digits.startsWith("256") && digits.length === 12) {
    local = digits.slice(3);
  } else if (digits.startsWith("0") && digits.length === 10) {
    local = digits.slice(1);
  } else if (digits.length === 9) {
    local = digits;
  } else {
    return null;
  }
  if (local.length !== 9 || local.startsWith("0")) return null;
  return `+256${local}`;
}

/** '01-23-45-67-89-ab-cd-ef' → '0123456789ABCDEF'; null when not a tag. */
export function normaliseIbutton(input: string): string | null {
  let raw = input.trim().toUpperCase();
  if (raw.startsWith("0X")) raw = raw.slice(2);
  raw = raw.replace(/[\s:.-]/g, "");
  return /^[0-9A-F]{6,16}$/.test(raw) ? raw : null;
}

export function validNin(input: string): boolean {
  return /^[A-Z0-9]{14}$/.test(input.trim().toUpperCase().replace(/ /g, ""));
}

export function validPermit(input: string): boolean {
  return /^[A-Z0-9][A-Z0-9/-]{2,39}$/.test(input.trim().toUpperCase().replace(/ /g, ""));
}
