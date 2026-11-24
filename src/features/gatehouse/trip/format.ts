/**
 * format.ts — how trip history words times and lengths, as the OLIWA mobile
 * app does.
 */
import { HOUR, MINUTE } from "./geo.ts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const two = (v: number) => String(v).padStart(2, "0");

/** "14:32"; "--:--" for no time. */
export function hhmm(ms: number | null): string {
  if (ms == null) return "--:--";
  const d = new Date(ms);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** "Oct/25". */
export function monthDay(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()]}/${two(d.getDate())}`;
}

/** "Fri 30 Oct". */
export function dayLabel(ms: number): string {
  const d = new Date(ms);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "3 h 31 min", "45 min", "0 min". */
export function span(ms: number): string {
  const h = Math.floor(ms / HOUR), m = Math.floor((ms % HOUR) / MINUTE);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/** Engine time at a stop: "56 s", "12 min", "1 h 5 min". */
export function engineSpan(ms: number): string {
  if (ms < MINUTE) return `${Math.floor(ms / 1000)} s`;
  return span(ms);
}

/** Midnight at the start of the day `ms` falls in. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 23:59:59 on the day `ms` falls in. */
export function endOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).getTime();
}
