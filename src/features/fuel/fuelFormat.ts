/**
 * fuelFormat.ts — labels and the form's arithmetic for FuelMath, the same as
 * the OLIWA mobile app's (lib/models/fuel.dart), so both show the same
 * figures.
 */
import type { FuelFlag, FuelIssue } from "../../api/types/fuel.types";

export const FUEL_TYPES = ["diesel", "petrol"] as const;
export const PAYMENT_METHODS = ["fuel_card", "cash", "credit", "mobile_money"] as const;

/** A number the server may send as text ("64,375"); null when absent. */
export function fuelNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

/** "12,500.5" or "40" → 12500.5; null when not a positive number. */
export function parsePositive(text: string): number | null {
  const n = Number(text.replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function fuelLabel(type: string): string {
  return type === "diesel" ? "Diesel" : type === "petrol" ? "Petrol" : type;
}

export function paymentLabel(method: string): string {
  switch (method) {
    case "fuel_card": return "Fuel card";
    case "cash": return "Cash";
    case "credit": return "Credit account";
    case "mobile_money": return "Mobile money";
    default: return method;
  }
}

export function reviewLabel(state: string): string {
  switch (state) {
    case "open": return "Needs review";
    case "explained": return "Explained";
    case "confirmed_loss": return "Confirmed loss";
    default: return "OK";
  }
}

export function sensorLabel(state: string): string {
  switch (state) {
    case "ready": return "Fuel sensor ready";
    case "needs_calibration": return "Fuel sensor needs calibration";
    default: return "No fuel sensor";
  }
}

/** The receipt total: litres × price per litre, to the shilling (the server
 *  works it out the same way and its figure is the one stored). */
export function fuelTotal(litres: number, unitPrice: number): number {
  return Math.round(litres * unitPrice);
}

/** "UGX 206,000". */
export function ugx(amount: number | null | undefined): string {
  const n = Math.round(amount ?? 0);
  return `UGX ${n < 0 ? "-" : ""}${Math.abs(n).toLocaleString("en-US")}`;
}

/** "40 L", "40.5 L". */
export function litres(l: number | null | undefined): string {
  const n = l ?? 0;
  return `${Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1)} L`;
}

export const flags = (i: FuelIssue): FuelFlag[] => (Array.isArray(i.flags) ? i.flags : []);
export const discrepancies = (i: FuelIssue) => flags(i).filter((f) => f.kind === "discrepancy");
export const notices = (i: FuelIssue) => flags(i).filter((f) => f.kind !== "discrepancy");
export const needsReview = (i: FuelIssue) => i.review_state === "open" && !i.voided;
export const isReviewed = (i: FuelIssue) => i.review_state === "explained" || i.review_state === "confirmed_loss";
export const driverLabel = (i: FuelIssue) => i.driver_name || (i.driver_uid ? i.driver_uid : "No driver recorded");
