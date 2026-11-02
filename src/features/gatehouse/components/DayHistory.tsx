/**
 * DayHistory.tsx — the day-by-day trip history panel, as the OLIWA mobile
 * app shows it: day chips with a fixed Time range button, the day's totals,
 * and a timeline of where the vehicle was parked and the trips between.
 */
import React, { useRef } from "react";
import {
  dayDistanceKm, drivingMs, hhmm, isTrip, parkedMs, span,
  type DaySegment, type DayTimeline,
} from "../trip";
import { C, DAY_MS, MONTHS, WEEKDAYS, inputDate } from "./historyStyle";

// ── Icons ────────────────────────────────────────────────────────────────────
const svg = (size: number, children: React.ReactNode, fill = false) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"}
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
export const CarIcon = ({ size = 16 }: { size?: number }) => svg(size,
  <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11v6h-2v-2H7v2H5v-6zm2.5 2.5h.01M16.5 13.5h.01M5 11h14" />);
export const ParkIcon = ({ size = 16 }: { size?: number }) => svg(size,
  <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3" /></>);
export const PlayIcon = ({ size = 16 }: { size?: number }) => svg(size, <polygon points="7,4 20,12 7,20" />, true);
const ClockIcon = () => svg(14, <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
const CalendarIcon = () => svg(14, <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>);
const KeyIcon = () => svg(12, <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3" /></>);

// ── Day strip ────────────────────────────────────────────────────────────────

/** The last week, today on the right, an older picked day added on the left;
 *  the Time range button stays fixed at the left, set apart by a divider so
 *  the days don't seem to slide under it. A calendar picks any other day. */
export function DayStrip({ day, today, onDay, rangeOpen, onRange }: {
  day: number;
  /** Midnight today. */
  today: number;
  onDay: (day: number) => void;
  rangeOpen: boolean;
  onRange: () => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => new Date(today - i * DAY_MS + DAY_MS / 2).setHours(0, 0, 0, 0));
  if (day < days[6]) days.push(day);
  const picker = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-0 min-w-0">
      <button type="button" onClick={onRange} aria-pressed={rangeOpen} title="Play a time range"
        className={`shrink-0 w-[58px] h-[42px] rounded-[10px] border flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
          rangeOpen ? "bg-[#075E54] border-[#075E54] text-white" : "bg-[#E7F3F1] border-[#D8E8E4] text-[#075E54] hover:brightness-95"}`}>
        <ClockIcon />
        <span className="text-[10px] font-bold leading-none">Time range</span>
      </button>
      <div className="shrink-0 w-px h-7 mx-2 bg-[#D8E8E4]" />
      <div className="flex-1 min-w-0 flex flex-row-reverse gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
        {days.map((d) => {
          const on = d === day && !rangeOpen;
          const date = new Date(d);
          return (
            <button key={d} type="button" onClick={() => onDay(d)} aria-pressed={on}
              className={`shrink-0 w-[50px] h-[42px] rounded-[10px] border flex flex-col items-center justify-center cursor-pointer transition-colors ${
                on ? "bg-[#075E54] border-[#075E54]" : "bg-white border-[#D8E8E4] hover:bg-[#F8F9FA]"}`}>
              <span className={`text-[10px] leading-tight ${on ? "text-white/70" : "text-[#667781]"}`}>
                {d === today ? "Today" : WEEKDAYS[date.getDay()]}
              </span>
              <span className={`text-[12px] font-bold leading-tight ${on ? "text-white" : "text-[#111B21]"}`}>
                {date.getDate()} {MONTHS[date.getMonth()]}
              </span>
            </button>
          );
        })}
      </div>
      <div className="relative shrink-0 ml-2">
        <button type="button" title="Show another day"
          onClick={() => { const el = picker.current; if (!el) return; try { el.showPicker(); } catch { el.focus(); } }}
          className="w-8 h-[42px] rounded-[10px] border border-[#D8E8E4] bg-white text-[#075E54] flex items-center justify-center cursor-pointer hover:bg-[#F8F9FA]">
          <CalendarIcon />
        </button>
        <input ref={picker} type="date" aria-label="Show another day" max={inputDate(today)} value={inputDate(day)}
          onChange={(e) => {
            if (!e.target.value) return;
            const [y, m, dd] = e.target.value.split("-").map(Number);
            onDay(new Date(y, m - 1, dd).getTime());
          }}
          className="absolute inset-0 opacity-0 pointer-events-none" tabIndex={-1} />
      </div>
    </div>
  );
}

// ── Totals ───────────────────────────────────────────────────────────────────

export function DayTotals({ timeline }: { timeline: DayTimeline }) {
  const stat = (icon: React.ReactNode, color: string, value: string, label: string) => (
    <div className="flex-1 min-w-0 text-center">
      <div className="flex items-center justify-center gap-1.5" style={{ color }}>
        {icon}
        <span className="text-[15px] font-bold text-[#111B21] truncate">{value}</span>
      </div>
      <div className="text-[11px] text-[#667781] mt-0.5">{label}</div>
    </div>
  );
  return (
    <div className="flex gap-1 rounded-2xl border border-[#D8E8E4] bg-[#F7FBFA] px-2 py-3">
      {stat(<CarIcon />, C.moving, span(drivingMs(timeline)), "driving")}
      {stat(svg(16, <path d="M4 19l5-14h6l5 14M12 7v2M12 12v2M12 17v2" />), C.warning, `${dayDistanceKm(timeline).toFixed(1)} km`, "distance")}
      {stat(<ParkIcon />, C.parked, span(parkedMs(timeline)), "parked")}
    </div>
  );
}

// ── One row of the day ───────────────────────────────────────────────────────

export function SegmentRow({ segment: s, first, last, selected, place, engineMs, onSelect, onPlay }: {
  segment: DaySegment;
  first: boolean;
  last: boolean;
  selected: boolean;
  /** Geofence or place name for a parking; null when unknown. */
  place: string | null;
  /** Engine-on time at a parking, when the unit reports ignition. */
  engineMs?: number | null;
  onSelect: () => void;
  onPlay: () => void;
}) {
  const trip = isTrip(s);
  const color = trip ? C.moving : C.parked;
  const tags = [
    ...(s.openStart ? [trip ? "from before 00:00" : "overnight"] : []),
    ...(s.ongoing ? [trip ? "driving now" : "parked now"] : []),
  ];
  const headline = trip
    ? `${span(s.end - s.start)} · ${s.distanceKm.toFixed(1)} km · max ${s.maxSpeedKmh.toFixed(0)} km/h`
    : span(s.end - s.start);
  const detail = trip ? `${hhmm(s.start)} → ${hhmm(s.end)}` : place;
  const idling = engineMs != null && engineMs >= 5 * 60_000;

  return (
    <div role="button" tabIndex={0} onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      className={`flex items-stretch cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#128C7E] ${
        selected ? "bg-[#E7F3F1]" : "hover:bg-[#F8F9FA]"}`}>
      <div className="w-[52px] shrink-0 pt-[18px] pr-1 text-right text-[13px] font-semibold text-[#111B21]">
        {s.openStart ? "" : hhmm(s.start)}
      </div>
      {/* The timeline: a line through every row, with this row's dot. */}
      <div className="relative w-12 shrink-0 flex justify-center">
        {!(first && last) && (
          <span className="absolute w-[2px] bg-[#D8E8E4]"
            style={{ top: first ? 26 : 0, bottom: last ? undefined : 0, height: last ? 26 : undefined }} />
        )}
        <span className="relative mt-[10px] w-8 h-8 rounded-full flex items-center justify-center border-2"
          style={{ borderColor: color, background: trip ? color : "#fff", color: trip ? "#fff" : color }}>
          {trip ? <CarIcon size={15} /> : <ParkIcon size={15} />}
        </span>
      </div>
      <div className="flex-1 min-w-0 py-2.5 pr-1">
        <div className="text-[13.5px] font-semibold text-[#111B21]">{headline}</div>
        <div className="text-[12px] text-[#667781] mt-0.5 line-clamp-2" title={detail ?? undefined}>{detail}</div>
        {(tags.length > 0 || engineMs != null) && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {engineMs != null && (
              <span title="Engine on while parked"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                style={{ color: idling ? C.warning : C.muted, background: idling ? "#F59E0B1F" : "#6677811F" }}>
                <KeyIcon />{engineMs < 60_000 ? `${Math.floor(engineMs / 1000)} s` : span(engineMs)}
              </span>
            )}
            {tags.map((t) => (
              <span key={t} className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                style={{ color: trip ? "#128C4A" : "#0B7DB5", background: `${color}1F` }}>{t}</span>
            ))}
          </div>
        )}
      </div>
      {trip ? (
        <button type="button" title="Play this trip" aria-label={`Play the trip from ${hhmm(s.start)}`}
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className="self-center shrink-0 mr-2 w-9 h-9 rounded-full bg-[#25D366] text-[#053B33] flex items-center justify-center border-none cursor-pointer hover:brightness-105">
          <PlayIcon size={15} />
        </button>
      ) : <span className="w-4 shrink-0" />}
    </div>
  );
}
