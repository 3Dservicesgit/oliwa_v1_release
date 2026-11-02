/**
 * ConditionFields — an event rule's condition: a grouped dropdown (Driving,
 * Places, Device health, Fuel · all vehicles), as in the OLIWA mobile app,
 * and below it the one control that condition needs. Used by the create
 * and edit forms.
 */
import React from "react";
import {
  EVENT_CONDITION_DESCRIPTIONS, EVENT_CONDITION_LABELS,
  type EventCondition,
} from "../../api/types/events.types";
import {
  CONDITION_GROUPS, CONDITION_SUMMARY, FUEL_CODES, FUEL_DISCREPANCY_LABELS,
  fuelCodes, fuelValue, ignitionDirection, isAvailable,
} from "./eventConditions";

const LABEL = "block text-[12px] font-black text-[#111B21] mb-1";
const INPUT = "w-full h-10 rounded-lg border border-[#E9EDEF] px-3 text-[13px] text-[#111B21] " +
  "placeholder:text-[#667781] outline-none focus:border-[#128C7E]";
const HINT = "text-[11px] text-[#667781] mt-1";

export function ConditionFields({ condition, onCondition, value, onValue, icons, geofence, savedUnavailable }: {
  condition: EventCondition;
  onCondition: (c: EventCondition) => void;
  value: string;
  onValue: (v: string) => void;
  icons: Record<EventCondition, string>;
  /** The zone selector, shown for geofence rules. */
  geofence: React.ReactNode;
  /** An existing rule saved with a condition no longer offered: it is shown
   *  so the rule can be read and moved to another condition. */
  savedUnavailable?: boolean;
}) {
  const chip = (on: boolean) =>
    `h-8 px-4 rounded-full text-[12px] font-black border cursor-pointer transition-all ${
      on ? "bg-[#128C7E]/10 border-[#128C7E]/30 text-[#128C7E]" : "bg-white border-[#E9EDEF] text-[#667781]"}`;

  const codes = condition === "fuel_issue_flagged" ? fuelCodes(value) : [];
  // "none" when every check is unticked, so the form asks for one instead of
  // quietly going back to all of them.
  const toggleCode = (code: string) => {
    const next = codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code];
    onValue(next.length ? fuelValue(next) : "none");
  };

  return (
    <>
      <div>
        <label className={LABEL} htmlFor="event-condition">Condition Type *</label>
        <select id="event-condition" value={condition} onChange={(e) => onCondition(e.target.value as EventCondition)}
          className={`${INPUT} cursor-pointer bg-white font-black`}>
          {CONDITION_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.conditions.map((c) => (
                <option key={c} value={c} disabled={!isAvailable(c) && !(savedUnavailable && c === condition)}>
                  {icons[c]} {EVENT_CONDITION_LABELS[c]} — {CONDITION_SUMMARY[c]}
                  {!isAvailable(c) ? " (not available yet)" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className={HINT}>{EVENT_CONDITION_DESCRIPTIONS[condition]}</p>
      </div>

      {condition === "geofence_breach" && geofence}

      {condition === "speed_threshold" && (
        <div>
          <label className={LABEL} htmlFor="event-value">Speed limit (km/h) *</label>
          <input id="event-value" inputMode="numeric" value={value} onChange={(e) => onValue(e.target.value)}
            placeholder="e.g. 80" className={INPUT} />
          <p className={HINT}>5 to 250 km/h. Alerts once each time it is exceeded, not again until the vehicle slows down.</p>
        </div>
      )}

      {condition === "device_offline" && (
        <div>
          <label className={LABEL} htmlFor="event-value">Minutes without a report *</label>
          <input id="event-value" inputMode="numeric" value={value} onChange={(e) => onValue(e.target.value)}
            placeholder="e.g. 30" className={INPUT} />
          <p className={HINT}>At least 5. Paused vehicles are not checked.</p>
        </div>
      )}

      {condition === "ignition_change" && (
        <div>
          <div className={LABEL}>Alert when the ignition is switched</div>
          <div className="flex gap-2" role="radiogroup" aria-label="Ignition">
            {(["on", "off", "both"] as const).map((d) => (
              <button key={d} type="button" role="radio" aria-checked={ignitionDirection(value) === d}
                onClick={() => onValue(d)} className={chip(ignitionDirection(value) === d)}>
                {d === "on" ? "On" : d === "off" ? "Off" : "On or off"}
              </button>
            ))}
          </div>
          <p className={HINT}>Needs the vehicle's ignition input to be set up.</p>
        </div>
      )}

      {condition === "fuel_issue_flagged" && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] font-black text-[#111B21]">
              Fuel checks {codes.length === FUEL_CODES.length ? "(any of all 9)" : `(${codes.length} chosen)`}
            </span>
            <button type="button" onClick={() => onValue("all")}
              className="text-[11px] font-black text-[#128C7E] bg-transparent border-0 cursor-pointer">
              Select all
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {FUEL_CODES.map((code) => (
              <label key={code} className={`flex items-center gap-2 border rounded-lg px-2.5 py-2 cursor-pointer text-[12px] ${
                codes.includes(code) ? "border-[#128C7E] bg-[#128C7E]/5" : "border-[#E9EDEF]"}`}>
                <input type="checkbox" checked={codes.includes(code)} onChange={() => toggleCode(code)} className="accent-[#128C7E]" />
                {FUEL_DISCREPANCY_LABELS[code]}
              </label>
            ))}
          </div>
          <p className={HINT}>Checked each time fuel is recorded in FuelMath. Works without a fuel sensor.</p>
        </div>
      )}

      {condition === "high_fuel_consumption" && (
        <div>
          <label className={LABEL} htmlFor="event-value">More fuel than expected by (%)</label>
          <input id="event-value" inputMode="numeric" value={value} onChange={(e) => onValue(e.target.value)}
            placeholder="Leave empty to use each vehicle's tolerance" className={INPUT} />
          <p className={HINT}>
            5 to 100, or empty to use the tolerance in each vehicle's fuel profile. Only vehicles with a fuel
            profile are checked (FuelMath → Vehicles).
          </p>
        </div>
      )}

      {condition === "low_battery" && (
        <div className="text-[12px] rounded-lg px-3 py-2 bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E]">
          Low battery alerts are not available yet: battery readings from the trackers do not reach the server.
          {savedUnavailable ? " Choose another condition to keep this rule working." : ""}
        </div>
      )}
    </>
  );
}
