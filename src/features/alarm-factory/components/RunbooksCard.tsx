/**
 * RunbooksCard — Runbooks (Actionable, East Africa-ready)
 *
 * Matches BOTTOM screenshot:
 *   4 runbook entries, each with:
 *     RB badge | title | steps summary (bullet-separated)
 *   Footer: Create Runbook | Assign Owner
 *
 * All styles: Tailwind utility classes only.
 */
import React from "react";

export interface Runbook {
  id:    string;
  title: string;
  steps: string;
}

interface RunbooksCardProps {
  runbooks?:        Runbook[];
  onCreateRunbook?: () => void;
  onAssignOwner?:   () => void;
}

const DEFAULT_RUNBOOKS: Runbook[] = [
  {
    id:    "rb1",
    title: "Kafka Lag Spike",
    steps: "Scale consumers • check broker disk • verify topic partitions • notify on-call",
  },
  {
    id:    "rb2",
    title: "VEBA Leakage Spike",
    steps: "Enable contact gating • enforce escrow • flag repeat offenders • soft suspensions (HITL)",
  },
  {
    id:    "rb3",
    title: "Mobile Money Callback Gap",
    steps: "Inspect webhook queue • replay callbacks • credit tokens idempotently • issue receipt",
  },
  {
    id:    "rb4",
    title: "Alarm Fatigue",
    steps: "Reduce noisy rules • shift P3/P4 to digest • cap WhatsApp sends per unit/day",
  },
];

export function RunbooksCard({
  runbooks        = DEFAULT_RUNBOOKS,
  onCreateRunbook,
  onAssignOwner,
}: RunbooksCardProps) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#E9EDEF]">
        <div className="font-black text-[13px] text-[#111B21]">Runbooks (Actionable, East Africa-ready)</div>
      </div>

      {/* Runbook list */}
      <div className="flex flex-col divide-y divide-[#E9EDEF] flex-1">
        {runbooks.map((rb) => (
          <div key={rb.id} className="px-4 py-3 flex items-start gap-3">
            <span className="shrink-0 text-[10px] font-extrabold bg-[var(--brand)] text-white px-2 py-0.5 rounded-full">
              RB
            </span>
            <div className="min-w-0">
              <div className="font-extrabold text-[12px] text-[#111B21]">{rb.title}</div>
              <div className="text-[11px] text-[#667781] mt-0.5 leading-relaxed">{rb.steps}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#E9EDEF] flex gap-2 flex-wrap justify-end">
        <button
          onClick={onCreateRunbook}
          className="h-8 px-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[11px] font-extrabold border-none cursor-pointer hover:brightness-105 transition-all whitespace-nowrap"
        >
          Create Runbook
        </button>
        <button
          onClick={onAssignOwner}
          className="h-8 px-4 rounded-full bg-[#34B7F1] text-white text-[11px] font-extrabold border-none cursor-pointer hover:brightness-105 transition-all whitespace-nowrap"
        >
          Assign Owner
        </button>
      </div>
    </div>
  );
}