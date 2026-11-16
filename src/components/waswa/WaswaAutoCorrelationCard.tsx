/**
 * WaswaAutoCorrelationCard — "Waswa AI: What changed? (Auto-correlation)"
 *
 * Matches TOP screenshot: card with "Auto" badge + 4 bullet rows each with
 * a bold label and a descriptive value (truncated with ellipsis).
 *
 * All styles: Tailwind utility classes only.
 */
import React from "react";

export interface CorrelationBullet {
  id:    string;
  label: string;
  value: string;
}

interface WaswaAutoCorrelationCardProps {
  bullets?: CorrelationBullet[];
  onAuto?:  () => void;
}

const DEFAULT_BULLETS: CorrelationBullet[] = [
  {
    id: "leakage",
    label: "Revenue leakage risk:",
    value: "VEBA Boda: contact unlocks +32% WoW; bookings -11% (possible offline bypass).",
  },
  {
    id: "health",
    label: "System health impact:",
    value: "Kafka lag peaked at 6.4s (12:57) causing alert delays; now stable 1.2s.",
  },
  {
    id: "billing",
    label: "Tokenized billing:",
    value: "Messaging bundle burn ↑; route P3/P4 to digest to control spend.",
  },
  {
    id: "action",
    label: "Action:",
    value: "Promote Leakage Guard to 🔴 Critical + enable HITL approval for suspensions.",
  },
];

export function WaswaAutoCorrelationCard({
  bullets = DEFAULT_BULLETS,
  onAuto,
}: WaswaAutoCorrelationCardProps) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#E9EDEF] flex items-center justify-between">
        <div className="font-black text-[13px] text-[#111B21]">
          Waswa AI: What changed? (Auto-correlation)
        </div>
        <button
          onClick={onAuto}
          className="text-[11px] font-extrabold bg-[var(--brand)] text-[var(--on-brand)] px-3 py-1 rounded-full border-none cursor-pointer hover:brightness-105 transition-all"
        >
          Auto
        </button>
      </div>

      {/* Bullets */}
      <div className="px-4 py-3 flex flex-col gap-2.5">
        {bullets.map((b) => (
          <div key={b.id} className="flex items-start gap-2 text-[12px] leading-relaxed">
            <span className="text-[var(--brand)] shrink-0 mt-0.5">•</span>
            <span>
              <span className="font-extrabold text-[#111B21]">{b.label}</span>
              <span className="text-[#667781]"> {b.value}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}