/**
 * VebaAssignmentCard — VEBA Governance: Assignment & Tendering
 *
 * Matches MID screenshot:
 *   Numbered steps with title + sub-description
 *   Footer: Open VEBA Ops | Edit Tender Rules buttons + escalation note
 *
 * All styles: Tailwind utility classes only.
 */
import React from "react";

export interface AssignmentStep {
  number: number;
  title:  string;
  sub:    string;
}

interface VebaAssignmentCardProps {
  steps?:           AssignmentStep[];
  escalationNote?:  string;
  onOpenVeba?:      () => void;
  onEditTender?:    () => void;
}

const DEFAULT_STEPS: AssignmentStep[] = [
  { number: 1, title: "Request enters queue",   sub: "Hirer pays escrow (MoMo/Tokens)" },
  { number: 2, title: "AI ranks operators",      sub: "distance + rating + availability" },
  { number: 3, title: "Operator accepts / declines", sub: "< 2m window, else escalate"  },
  { number: 4, title: "Trip activated",          sub: "Token escrow released on completion" },
];

export function VebaAssignmentCard({
  steps          = DEFAULT_STEPS,
  escalationNote = "if no accept < 2m → escalate",
  onOpenVeba,
  onEditTender,
}: VebaAssignmentCardProps) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#E9EDEF]">
        <div className="font-black text-[13px] text-[#111B21]">VEBA Governance: Assignment & Tendering</div>
      </div>

      {/* Steps */}
      <div className="flex flex-col divide-y divide-[#E9EDEF] flex-1">
        {steps.map((step) => (
          <div key={step.number} className="px-4 py-3 flex items-start gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--brand)] text-white text-[11px] font-extrabold grid place-items-center">
              {step.number}
            </span>
            <div>
              <div className="font-extrabold text-[12px] text-[#111B21]">{step.title}</div>
              <div className="text-[11px] text-[#667781] mt-0.5">{step.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#E9EDEF] flex flex-col gap-2">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={onOpenVeba}
            className="h-8 px-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[11px] font-extrabold border-none cursor-pointer hover:brightness-105 transition-all whitespace-nowrap"
          >
            Open VEBA Ops
          </button>
          <button
            onClick={onEditTender}
            className="h-8 px-4 rounded-full bg-[#34B7F1] text-white text-[11px] font-extrabold border-none cursor-pointer hover:brightness-105 transition-all whitespace-nowrap"
          >
            Edit Tender Rules
          </button>
        </div>
        <div className="text-[11px] text-[#667781]">{escalationNote}</div>
      </div>
    </div>
  );
}