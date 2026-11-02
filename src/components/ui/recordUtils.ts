/**
 * recordUtils.ts — plain helpers for the Drivers and FuelMath pages (kept
 * apart from records.tsx, which holds only components, for fast refresh).
 */

export function errText(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

function parseWhen(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "30 Oct 2026, 12:18". */
export function whenText(iso: string | null | undefined): string {
  const d = parseWhen(iso);
  return d ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : (iso || "—");
}

/** "30 Oct 2026". */
export function dayText(iso: string | null | undefined): string {
  const d = parseWhen(iso);
  return d ? d.toLocaleDateString(undefined, { dateStyle: "medium" }) : (iso || "—");
}

/** YYYY-MM-DD in local time. */
export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A photo chosen from the computer: JPEG, PNG or WebP, at most 5 MB (the
 *  server's limits, driver_rules.py). Returns an error message, or null. */
export function photoProblem(file: File): string | null {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return "Choose a JPEG, PNG or WebP photo.";
  if (file.size > 5 * 1024 * 1024) return "The photo is larger than 5 MB.";
  return null;
}
