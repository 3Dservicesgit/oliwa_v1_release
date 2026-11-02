/**
 * historyStyle.ts — colours and small helpers shared by the Track Playback
 * page and its day-history components.
 */
import { coordsText, dayLabel, type DaySegment, type DayTimeline } from "../trip";

// The OLIWA mobile app's colours (lib/core/theme/app_theme.dart).
export const C = {
  primary: "#128C7E",
  primaryDark: "#075E54",
  moving: "#25D366",
  parked: "#34B7F1",
  warning: "#F59E0B",
  softMint: "#E7F3F1",
  border: "#E9EDEF",
  text: "#111B21",
  muted: "#667781",
};

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" in local time, for <input type="date">. */
export function inputDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The place for a parking row: its name, else its coordinates. */
export const parkingDetail = (name: string | null, timeline: DayTimeline, s: DaySegment) =>
  name ?? coordsText(timeline.points[s.from]);

/** "Fri 30 Oct", or "Today". */
export const dayTitle = (day: number, today: number) => (day === today ? "Today" : dayLabel(day));
