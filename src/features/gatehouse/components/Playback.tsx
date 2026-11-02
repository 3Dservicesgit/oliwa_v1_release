/**
 * Playback.tsx — the panel under the map while a trip plays, as the OLIWA
 * mobile app's playback sheet: the trip's figures, the speed chart (which is
 * also the scrubber), what the route colours mean, speed now and distance so
 * far, where the vehicle is, and the controls.
 */
import React, { useMemo, useRef } from "react";
import {
  bandOf, coordsText, hhmm, MAX_PLAUSIBLE_KMH, profilePath, SPEED_BANDS, span, speedY, topSpeed,
  TripTimeline, zoneAt, placeOf,
  type NamedZone, type TimedPoint,
} from "../trip";
import { PlayIcon } from "./DayHistory";

const CHART_W = 1000;
const CHART_H = 64;

/** The trip's figures. */
export interface PlaybackStats {
  distanceKm: number;
  maxSpeedKmh: number;
  stops: number;
}

const svg = (size: number, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{children}</svg>
);
const PauseIcon = () => svg(22, <><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></>);
const PrevIcon = () => svg(22, <><rect x="5" y="5" width="2.5" height="14" rx="1" /><polygon points="19,5 9,12 19,19" /></>);
const NextIcon = () => svg(22, <><rect x="16.5" y="5" width="2.5" height="14" rx="1" /><polygon points="5,5 15,12 5,19" /></>);

/** Speed over the trip with a cursor at the moment shown; click or drag
 *  along it to move through the trip. */
function SpeedProfile({ timeline, progress, onScrub }: {
  timeline: TripTimeline;
  progress: number;
  onScrub: (fraction: number) => void;
}) {
  // Drawn once per trip; only the cursor moves as playback runs.
  const { line, area } = useMemo(() => profilePath(timeline, CHART_W, CHART_H), [timeline]);
  const maxV = useMemo(() => topSpeed(timeline), [timeline]);
  const box = useRef<HTMLDivElement>(null);
  const cursorPoint = timeline.points[timeline.indexAt(timeline.timeAt(progress))];
  const cursorY = (speedY(cursorPoint.speedKmh, maxV, CHART_H) / CHART_H) * 100;

  const scrubAt = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (r && r.width > 0) onScrub(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
  };

  return (
    <div
      ref={box}
      role="slider"
      tabIndex={0}
      aria-label="Speed profile. Drag to move through the trip."
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      className="relative h-16 cursor-pointer select-none touch-none outline-none focus-visible:ring-2 focus-visible:ring-[#128C7E] rounded"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); scrubAt(e.clientX); }}
      onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) scrubAt(e.clientX); }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.1 : 0.01;
        if (e.key === "ArrowRight") onScrub(Math.min(1, progress + step));
        else if (e.key === "ArrowLeft") onScrub(Math.max(0, progress - step));
        else if (e.key === "Home") onScrub(0);
        else if (e.key === "End") onScrub(1);
        else return;
        e.preventDefault();
      }}
    >
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <defs>
          <linearGradient id="tp-speed-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#128C7E" stopOpacity="0.28" />
            <stop offset="1" stopColor="#128C7E" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#tp-speed-fill)" />
        <path d={line} fill="none" stroke="#128C7E" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      {/* The cursor: drawn in HTML so its dot stays round on a stretched chart. */}
      <div className="absolute top-0 bottom-0 w-[2px] bg-[#111B21] -translate-x-1/2 pointer-events-none" style={{ left: `${progress * 100}%` }} />
      <div className="absolute w-3.5 h-3.5 rounded-full bg-white border-[3px] border-[#111B21] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ left: `${progress * 100}%`, top: `${cursorY}%` }} />
    </div>
  );
}

export function PlaybackPanel({
  timeline, t, playing, rate, soFar, stats, zones,
  onRate, onToggle, onSkip, onScrub,
}: {
  timeline: TripTimeline;
  /** The moment shown. */
  t: number;
  playing: boolean;
  rate: number;
  /** Distance driven up to each of the timeline's points (km). */
  soFar: number[];
  stats: PlaybackStats;
  zones: NamedZone[];
  onRate: (rate: number) => void;
  onToggle: () => void;
  onSkip: (forward: boolean) => void;
  onScrub: (fraction: number) => void;
}) {
  const index = timeline.indexAt(t);
  const fix: TimedPoint = timeline.points[index];
  const where = timeline.positionAt(t);
  const progress = timeline.progressOf(t);

  // "14:32", or "14:32 · parked 25 min" while the vehicle stands still.
  const still = timeline.standStillAt(t);
  const timeLabel = still ? `${hhmm(t)} · parked ${span(still.end - still.start)}` : hhmm(t);

  const faulty = fix.speedKmh > MAX_PLAUSIBLE_KMH;
  const band = SPEED_BANDS[bandOf(faulty ? 0 : fix.speedKmh)];
  const driven = soFar[Math.min(index, soFar.length - 1)] ?? 0;
  const total = soFar[soFar.length - 1] ?? 0;

  const fence = zoneAt(where, zones);
  const place = fence ? `Inside ${fence}` : placeOf(fix, zones) ?? coordsText(where);

  const cell = (label: string, value: React.ReactNode, now = false) => (
    <div className={`min-w-0 rounded-xl px-3 py-2 ${now ? "bg-white border border-[#D8E8E4]" : "bg-[#F5F7F8]"}`}>
      <div className="text-[10px] font-black tracking-wide text-[#667781] whitespace-nowrap">{label}</div>
      <div className="text-[15px] font-semibold text-[#111B21] whitespace-nowrap">{value}</div>
    </div>
  );

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-2">
        {cell("DISTANCE", `${stats.distanceKm.toFixed(1)} km`)}
        {cell("MAX SPEED", `${stats.maxSpeedKmh.toFixed(0)} km/h`)}
        {cell("STOPS", String(stats.stops))}
        {cell("DURATION", span(timeline.span))}
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_290px] gap-4">
        {/* The trip in time: speed chart, legend. */}
        <div className="min-w-0 flex flex-col gap-2.5">
          <div className="rounded-xl bg-[#F5F7F8] px-3 pt-2 pb-1.5">
            <div className="text-[11px] font-medium text-[#667781] mb-1">Speed · drag to move through the trip</div>
            <SpeedProfile timeline={timeline} progress={progress} onScrub={onScrub} />
            <div className="flex items-center justify-between mt-1 text-[11px]">
              <span className="text-[#667781]">{hhmm(timeline.start)}</span>
              <span className="font-semibold text-[#111B21]">{timeLabel}</span>
              <span className="text-[#667781]">{hhmm(timeline.end)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#667781]">
            {SPEED_BANDS.map((b) => (
              <span key={b.label} className="inline-flex items-center gap-1">
                <span className="w-3.5 h-[5px] rounded-sm" style={{ background: b.color }} />{b.label}
              </span>
            ))}
            <span className="font-semibold">km/h</span>
          </div>
        </div>

        {/* Now: speed, distance so far, where it is, and the controls. */}
        <div className="min-w-0 flex flex-col justify-between gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            {cell("SPEED NOW", <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: band.color }} />
              {faulty ? "—" : `${Math.round(fix.speedKmh)} km/h`}
            </span>, true)}
            {cell("DRIVEN", `${driven.toFixed(1)} of ${total.toFixed(1)} km`, true)}
          </div>
          <div className="flex items-center gap-2.5">
            <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${fence ? "bg-[#E7F3F1] text-[#075E54]" : "bg-[#F5F7F8] text-[#667781]"}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" />
              </svg>
            </span>
            <span className={`text-[13px] font-medium line-clamp-2 ${fence ? "text-[#111B21]" : "text-[#667781]"}`} title={place}>{place}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="sr-only" htmlFor="tp-rate">Playback speed</label>
            <select id="tp-rate" value={rate} onChange={(e) => onRate(Number(e.target.value))} title="Playback speed"
              className="h-10 rounded-xl bg-[#F0F3F4] border-none px-3 text-[13px] font-semibold text-[#075E54] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#128C7E]">
              {TripTimeline.rates.map((r) => (
                <option key={r} value={r}>×{r}{r === TripTimeline.defaultRate ? " (normal)" : ""}</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <button type="button" title="Previous stop" aria-label="Previous stop" onClick={() => onSkip(false)}
                className="w-10 h-10 rounded-full bg-transparent border-none text-[#075E54] cursor-pointer hover:bg-[#F0F3F4] flex items-center justify-center">
                <PrevIcon />
              </button>
              <button type="button" title={playing ? "Pause" : "Play"} aria-label={playing ? "Pause" : "Play"} onClick={onToggle}
                className="w-12 h-12 rounded-2xl bg-[#25D366] text-[#053B33] border-none cursor-pointer hover:brightness-105 flex items-center justify-center shadow-[0_4px_14px_rgba(37,211,102,0.35)]">
                {playing ? <PauseIcon /> : <PlayIcon size={22} />}
              </button>
              <button type="button" title="Next stop" aria-label="Next stop" onClick={() => onSkip(true)}
                className="w-10 h-10 rounded-full bg-transparent border-none text-[#075E54] cursor-pointer hover:bg-[#F0F3F4] flex items-center justify-center">
                <NextIcon />
              </button>
            </div>
          </div>
          <div className="flex gap-3 text-[10.5px] text-[#667781]">
            <span title="Coordinates">{coordsText(where)}</span>
            {fix.satellites != null && <span>{fix.satellites} satellites</span>}
            {fix.hdop && <span>HDOP {fix.hdop}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
