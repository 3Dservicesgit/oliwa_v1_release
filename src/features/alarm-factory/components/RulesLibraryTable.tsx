/**
 * RulesLibraryTable — Rules Library (Templates + Overrides)
 *
 * Matches MID screenshot:
 *   Toolbar: + New Rule | Import | Bulk Edit | Trash (12) | Scope: Acme/Boda | Range: 24h
 *   Table: Rule | Family | Sev | Channel | HITL | ⋮ menu
 *   Severity dot colours: P1=red, P2=orange, P3=yellow
 *
 * All styles: Tailwind utility classes only.
 */
import React from "react";

export type RuleSev = "P1" | "P2" | "P3" | "P4";

export interface RuleRow {
  id:      string;
  name:    string;
  family:  string;
  sev:     RuleSev;
  channel: string;
  hitl?:   boolean;
}

interface RulesLibraryTableProps {
  rows?:          RuleRow[];
  scope?:         string;
  range?:         string;
  trashCount?:    number;
  onNewRule?:     () => void;
  onImport?:      () => void;
  onBulkEdit?:    () => void;
  onTrash?:       () => void;
  onEditRow?:     (id: string) => void;
}

const sevDot: Record<RuleSev, string> = {
  P1: "bg-[#EF4444]",
  P2: "bg-[#F97316]",
  P3: "bg-[#FBBF24]",
  P4: "bg-[#25D366]",
};

const DEFAULT_ROWS: RuleRow[] = [
  { id: "r1", name: "Leakage Guard (VEBA)",  family: "billing", sev: "P1", channel: "WA+InApp", hitl: true  },
  { id: "r2", name: "Fuel Theft — Drop",      family: "fuel",    sev: "P2", channel: "WA+SMS",  hitl: false },
  { id: "r3", name: "Offline Spike Detector", family: "conn",    sev: "P2", channel: "InApp",   hitl: false },
  { id: "r4", name: "Overspeed (PIKI)",        family: "safety",  sev: "P3", channel: "InApp",   hitl: false },
  { id: "r5", name: "SIM Roaming w/o Pack",   family: "conn",    sev: "P3", channel: "InApp",   hitl: false },
  { id: "r6", name: "VEBA Tender Timeout",     family: "ops",     sev: "P3", channel: "InApp",   hitl: false },
  { id: "r7", name: "WhatsApp Flood Guard",    family: "msg",     sev: "P2", channel: "WA",      hitl: false },
  { id: "r8", name: "API 5xx Threshold",       family: "infra",   sev: "P2", channel: "InApp",   hitl: false },
];

export function RulesLibraryTable({
  rows        = DEFAULT_ROWS,
  scope       = "Acme/Boda",
  range       = "24h",
  trashCount  = 12,
  onNewRule,
  onImport,
  onBulkEdit,
  onTrash,
  onEditRow,
}: RulesLibraryTableProps) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden flex flex-col">
      {/* Section header */}
      <div className="px-4 py-3 border-b border-[#E9EDEF]">
        <div className="font-black text-[13px] text-[#111B21]">Rules Library (Templates + Overrides)</div>
        <div className="text-[11px] text-[#667781] mt-0.5">
          Tip: Tune weekly to reduce fatigue. Any pricing/penalty rule → HITL.
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-2.5 border-b border-[#E9EDEF] flex flex-wrap items-center gap-2">
        <button
          onClick={onNewRule}
          className="h-7 px-3 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[11px] font-extrabold border-none cursor-pointer hover:brightness-105 transition-all whitespace-nowrap"
        >
          + New Rule
        </button>
        <button
          onClick={onImport}
          className="h-7 px-3 rounded-full bg-[#F0F2F5] text-[#111B21] text-[11px] font-extrabold border-none cursor-pointer hover:bg-[#E9EDEF] transition-all"
        >
          Import
        </button>
        <button
          onClick={onBulkEdit}
          className="h-7 px-3 rounded-full bg-[#F0F2F5] text-[#111B21] text-[11px] font-extrabold border-none cursor-pointer hover:bg-[#E9EDEF] transition-all"
        >
          Bulk Edit
        </button>
        <button
          onClick={onTrash}
          className="h-7 px-3 rounded-full bg-[#F0F2F5] text-[#111B21] text-[11px] font-extrabold border-none cursor-pointer hover:bg-[#E9EDEF] transition-all"
        >
          Trash ({trashCount})
        </button>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-[#667781]">
          <span>Scope: <strong className="text-[#111B21]">{scope}</strong></span>
          <span>Range: <strong className="text-[#111B21]">{range}</strong></span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[#E9EDEF] bg-[#F8F9FA]">
              {["Rule", "Family", "Sev", "Channel", "HITL", ""].map((h, i) => (
                <th key={i} className="text-left px-3 py-2.5 text-[11px] font-extrabold text-[#667781] whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id}
                className={`border-b border-[#E9EDEF] last:border-0 hover:bg-[#F8F9FA] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"}`}
              >
                {/* Rule name */}
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${sevDot[row.sev]}`} />
                    <span className="font-extrabold text-[#111B21] whitespace-nowrap">{row.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-[#667781] whitespace-nowrap">{row.family}</td>
                <td className="px-3 py-2.5 font-extrabold text-[#111B21] whitespace-nowrap">{row.sev}</td>
                <td className="px-3 py-2.5 text-[#667781] whitespace-nowrap">{row.channel}</td>
                <td className="px-3 py-2.5">
                  {row.hitl && (
                    <span className="text-[10px] font-extrabold bg-[#34B7F1] text-white px-2 py-0.5 rounded-full">
                      HITL
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => onEditRow?.(row.id)}
                    className="w-6 h-6 rounded-md bg-[#F0F2F5] text-[#667781] text-[12px] font-extrabold border-none cursor-pointer hover:bg-[#E9EDEF] transition-all grid place-items-center"
                  >
                    ⋮
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}