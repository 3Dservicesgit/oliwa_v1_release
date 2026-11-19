/**
 * eventConditions.ts — what each event-rule condition needs, as the OLIWA
 * mobile app's rule form (lib/models/device_event.dart) and the server's
 * checks (navas-core-apis alert_conditions.parse_config and
 * devices._event_value_error) have it, so a rule the alert engine cannot
 * read is caught in the form instead of being saved and never firing.
 */
import type { EventCondition } from "../../api/types/events.types";

/** The picker's groups, in order, as in the app. */
export const CONDITION_GROUPS: { label: string; conditions: EventCondition[] }[] = [
  { label: "Driving", conditions: ["speed_threshold", "ignition_change"] },
  { label: "Places", conditions: ["geofence_breach"] },
  { label: "Device health", conditions: ["device_offline", "low_battery"] },
  // Checked when fuel is recorded in FuelMath: no fuel sensor needed.
  { label: "Fuel · all vehicles", conditions: ["fuel_issue_flagged", "high_fuel_consumption"] },
  // Client-wide: cover every driver, never attached to vehicles.
  { label: "Drivers · all drivers", conditions: ["driver_permit_expiry", "driver_unauthorised"] },
];

/** One line saying what the condition watches. */
export const CONDITION_SUMMARY: Record<EventCondition, string> = {
  speed_threshold: "Goes over a speed limit",
  ignition_change: "Ignition switched on or off",
  geofence_breach: "Enters or leaves a geofence",
  device_offline: "Stops reporting for a while",
  low_battery: "Battery readings don't reach the server yet",
  fuel_issue_flagged: "A Fuel Refill receipt doesn't add up",
  high_fuel_consumption: "More fuel than expected between full tanks",
  driver_permit_expiry: "A driver's permit is about to expire",
  driver_unauthorised: "A driver who may not drive has, or nearly gets, a vehicle",
};

/** Rules about the client's drivers rather than a vehicle: the server covers
 *  every driver and refuses to attach them to units, so the form asks for no
 *  vehicles. Mirrors navas-core-apis alert_conditions.CLIENT_WIDE. */
export function isClientWide(c: EventCondition | string): boolean {
  return c === "driver_permit_expiry" || c === "driver_unauthorised";
}

/** What an Unauthorised Driver rule can watch (alert_conditions.UNAUTHORISED_CHECKS). */
export const UNAUTHORISED_LABELS: Record<string, string> = {
  expired_while_assigned: "Keeps a vehicle after their permit expired",
  blocked_assignment: "Someone tried to assign them and was refused",
};

export const UNAUTHORISED_CODES = Object.keys(UNAUTHORISED_LABELS);

/** The checks an Unauthorised Driver rule's value names; all for "all". */
export function unauthorisedCodes(value: string): string[] {
  const text = value.trim().toLowerCase();
  if (!text || text === "all" || text === "any") return [...UNAUTHORISED_CODES];
  return text.split(",").map((c) => c.trim()).filter((c) => UNAUTHORISED_LABELS[c]);
}

/** The value for the chosen checks: "all", or them comma-separated. */
export function unauthorisedValue(codes: string[]): string {
  const known = UNAUTHORISED_CODES.filter((c) => codes.includes(c));
  return known.length === 0 || known.length === UNAUTHORISED_CODES.length ? "all" : known.join(",");
}

/** The server refuses new rules for these: they would never fire. */
export function isAvailable(c: EventCondition): boolean {
  return c !== "low_battery";
}

/** The fuel discrepancies a "Fuel issue flagged" rule can watch (the
 *  server's fuel_rules.FLAGS discrepancies; it refuses any other code). */
export const FUEL_DISCREPANCY_LABELS: Record<string, string> = {
  over_capacity: "More than the tank holds",
  more_than_used: "More than the distance needs",
  not_stopped: "Vehicle not stopped",
  odometer_backwards: "Odometer went backwards",
  odometer_mismatch: "Odometer does not match tracker",
  driver_not_assigned: "Driver not assigned",
  driver_not_allowed: "Driver not allowed to drive",
  possible_duplicate: "Possible duplicate",
  fuel_type_mismatch: "Wrong fuel type",
};

export const FUEL_CODES = Object.keys(FUEL_DISCREPANCY_LABELS);

/** The codes a fuel rule's value names; every code for "all". */
export function fuelCodes(value: string): string[] {
  const text = value.trim().toLowerCase();
  if (!text || text === "all" || text === "any") return [...FUEL_CODES];
  return text.split(",").map((c) => c.trim()).filter((c) => FUEL_DISCREPANCY_LABELS[c]);
}

/** The value for the chosen codes: "all", or them comma-separated. */
export function fuelValue(codes: string[]): string {
  const known = codes.filter((c) => FUEL_DISCREPANCY_LABELS[c]).sort();
  return known.length === 0 || known.length === FUEL_CODES.length ? "all" : known.join(",");
}

/** 'on', 'off' or 'both', reading the words the server reads. */
export function ignitionDirection(value: string): "on" | "off" | "both" {
  const t = value.trim().toLowerCase();
  if (["on", "1", "true", "ignition on", "start", "started"].includes(t)) return "on";
  if (["off", "0", "false", "ignition off", "stop", "stopped"].includes(t)) return "off";
  return "both";
}

/** What the value field starts as when the condition is chosen. */
export function defaultValue(c: EventCondition): string {
  if (c === "ignition_change") return "both";
  if (c === "fuel_issue_flagged") return "all";
  if (c === "driver_permit_expiry") return "30";
  if (c === "driver_unauthorised") return "all";
  return "";
}

/** A saved value as the form shows it (the inverse of valueToSend). */
export function valueForForm(c: EventCondition, saved: string): string {
  if (c === "ignition_change") return ignitionDirection(saved);
  if (c === "fuel_issue_flagged") return fuelValue(fuelCodes(saved));
  if (c === "driver_unauthorised") return unauthorisedValue(unauthorisedCodes(saved));
  if (c === "high_fuel_consumption") {
    const t = saved.trim().toLowerCase();
    return t === "profile" || t === "default" ? "" : saved.trim().replace(/%$/, "");
  }
  return saved;
}

/** The value to save (geofence rules are built by the zone selector). */
export function valueToSend(c: EventCondition, value: string): string {
  const v = value.trim();
  // Empty means each vehicle's own tolerance, from its fuel profile.
  if (c === "high_fuel_consumption") return v ? v.replace(/%$/, "") : "profile";
  if (c === "ignition_change") return ignitionDirection(v);
  if (c === "fuel_issue_flagged") return fuelValue(fuelCodes(v));
  if (c === "driver_unauthorised") return unauthorisedValue(unauthorisedCodes(v));
  return v;
}

function num(v: string): number | null {
  const n = Number(v.replace(/,/g, "").replace(/%$/, "").trim());
  return v.trim() && Number.isFinite(n) ? n : null;
}

/** Why the value would be refused, in the server's terms; null when fine. */
export function valueError(c: EventCondition, value: string): string | null {
  const n = num(value);
  switch (c) {
    case "speed_threshold":
      return n === null || n < 5 || n > 250 ? "Enter a speed limit between 5 and 250 km/h." : null;
    case "device_offline":
      return n === null || Math.round(n) < 5 || Math.round(n) > 60 * 24 * 30
        ? "Enter at least 5 minutes (at most 30 days)." : null;
    case "low_battery":
      return "Low battery alerts are not available yet: battery readings from the trackers do not reach the server.";
    case "high_fuel_consumption":
      return value.trim() && (n === null || n < 5 || n > 100)
        ? "Enter a percentage between 5 and 100, or leave it empty." : null;
    case "fuel_issue_flagged":
      return fuelCodes(value).length === 0 ? "Choose at least one fuel check." : null;
    case "driver_permit_expiry":
      return n === null || !Number.isInteger(n) || n < 0 || n > 90
        ? "Enter the days before expiry to warn, 0 to 90." : null;
    case "driver_unauthorised":
      return unauthorisedCodes(value).length === 0 ? "Choose at least one thing to watch." : null;
    default:
      return null;
  }
}

/** A saved rule's value in words, for the rules list. */
export function valueText(c: EventCondition | string, saved: string): string {
  switch (c) {
    case "speed_threshold": return `Over ${saved} km/h`;
    case "device_offline": return `Silent for ${saved} min`;
    case "ignition_change": {
      const d = ignitionDirection(saved);
      return d === "both" ? "Switched on or off" : `Switched ${d}`;
    }
    case "fuel_issue_flagged": {
      const codes = fuelCodes(saved);
      return codes.length === FUEL_CODES.length ? "Any fuel check"
        : codes.length === 1 ? FUEL_DISCREPANCY_LABELS[codes[0]]
        : `${codes.length} fuel checks`;
    }
    case "high_fuel_consumption": {
      const v = valueForForm("high_fuel_consumption", saved);
      return v ? `${v}% over expected` : "Over each vehicle's tolerance";
    }
    case "driver_permit_expiry": {
      const d = Number(saved);
      return d === 0 ? "When it expires" : `${saved} day${d === 1 ? "" : "s"} before expiry`;
    }
    case "driver_unauthorised": {
      const codes = unauthorisedCodes(saved);
      return codes.length === UNAUTHORISED_CODES.length ? "Expired permit or refused assignment"
        : UNAUTHORISED_LABELS[codes[0]] ?? saved;
    }
    case "low_battery": return "Not available yet";
    default: return saved;
  }
}
