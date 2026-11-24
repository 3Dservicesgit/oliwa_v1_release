/**
 * speedLimit.ts — the speed the Overspeeding report measures against (km/h).
 *
 * navas-core-apis overspeed.py takes it as `speed_limit` and lists every
 * stretch of driving above it from the GPS history, so any figure works, not
 * only the limits the alert rules are set to. Same bounds as oliwa-mobile
 * lib/models/speed_limit.dart.
 */

/** Offered as one-click choices; any other figure can be typed. */
export const SPEED_PRESETS = [30, 40, 50, 60, 80, 100, 120] as const;
export const INITIAL_SPEED_LIMIT = 80;

// The server's bounds.
export const LOWEST_SPEED = 1;
export const HIGHEST_SPEED = 300;

/** The longest range the server reads against a speed limit. */
export const SPEED_LIMIT_MAX_DAYS = 31;

/** The typed figure, or null when it is not a speed the server accepts. */
export function parseSpeedLimit(text: string): number | null {
  const t = text.trim();
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const v = Number(t);
  return v >= LOWEST_SPEED && v <= HIGHEST_SPEED ? v : null;
}

/** Why `text` is refused, or null when it is fine. */
export function speedLimitProblem(text: string): string | null {
  return parseSpeedLimit(text) === null
    ? `Enter a speed from ${LOWEST_SPEED} to ${HIGHEST_SPEED} km/h.`
    : null;
}

/** Why the YYYY-MM-DD range is too long for a speed-limit report, or null. */
export function speedRangeProblem(start: string, end: string): string | null {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const days = Math.abs(b - a) / 86_400_000 + 1;
  return days > SPEED_LIMIT_MAX_DAYS
    ? `Pick ${SPEED_LIMIT_MAX_DAYS} days or fewer for an overspeeding report.`
    : null;
}
