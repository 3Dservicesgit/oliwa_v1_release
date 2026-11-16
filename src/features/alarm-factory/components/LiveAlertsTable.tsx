/**
 * LiveAlertsTable — Live Alerts (Rules + Incidents) Table
 *
 * Matches TOP screenshot exactly:
 *   Header: "Live Alerts (Rules + Incid…)" + "Ack All (low)" + "Snooze" + "Create Incident"
 *   Columns: Sev (coloured dot + P1/P2/P3/P4) | Time | Product | Tenant | Asset | Trigger | Status | Cost
 *   Status badges: "Unacked" (orange) | "Ack" (green)
 *   Cost: coloured circle (H/M/L)
 *
 * All styles: Tailwind utility classes only.
 */
import React from "react";

export type AlertSev    = "P1" | "P2" | "P3" | "P4";
export type AlertStatus = "Unacked" | "Ack" | "Escalated";

export interface LiveAlertRow {
  id:       string;
  sev:      AlertSev;
  time:     string;
  product:  string;
  tenant:   string;
  asset:    string;
  trigger:  string;
  status:   AlertStatus;
  cost:     "H" | "M" | "L";
}

interface LiveAlertsTableProps {
  rows?:            LiveAlertRow[];
  onAckAll?:        () => void;
  onSnooze?:        () => void;
  onCreateIncident?:() => void;
  onRowClick?:      (id: string) => void;
}

const sevDot: Record<AlertSev, string> = {
  P1: "bg-[#EF4444]",
  P2: "bg-[#F97316]",
  P3: "bg-[#FBBF24]",
  P4: "bg-[#25D366]",
};

const statusCls: Record<AlertStatus, string> = {
  Unacked:  "bg-[#FFF0E6] text-[#C2410C] border border-[#FDDCBB]",
  Ack:      "bg-[#EAFBEF] text-[#1A7A3A] border border-[#C7F2D4]",
  Escalated:"bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]",
};

const costCls: Record<string, string> = {
  H: "bg-[#EF4444] text-white",
  M: "bg-[#F97316] text-white",
  L: "bg-[#25D366] text-white",
};

const DEFAULT_ROWS: LiveAlertRow[] = [
  { id: "a1", sev: "P1", time: "13:38", product: "VEBA",  tenant: "Acme/Boda",   asset: "BODA-019",  trigger: "Leakage Guard: contact shared pre-b…", status: "Unacked", cost: "H" },
  { id: "a2", sev: "P2", time: "13:37", product: "OLIWA", tenant: "Acme/Trucks", asset: "KDH-221X",  trigger: "Fuel Drop > 18L (engine off)",          status: "Ack",     cost: "M" },
  { id: "a3", sev: "P2", time: "13:36", product: "CORE",  tenant: "Platform",    asset: "Kafka",     trigger: "Consumer lag > 5s",                    status: "Unacked", cost: "L" },
  { id: "a4", sev: "P3", time: "13:33", product: "PAY",   tenant: "Acme",        asset: "MTN-UG",    trigger: "Webhook retries > 30",                 status: "Ack",     cost: "M" },
  { id: "a5", sev: "P3", time: "13:30", product: "PIKI",  tenant: "Acme/Boda",   asset: "PIK-044",   trigger: "Overspeed > 90kph (3m)",               status: "Unacked", cost: "L" },
  { id: "a6", sev: "P3", time: "13:29", product: "VEBA",  tenant: "Acme/Dozers", asset: "D8-004",    trigger: "Tender timeout > 2m (no driver)",      status: "Unacked", cost: "M" },
  { id: "a7", sev: "P4", time: "13:28", product: "CORE",  tenant: "Platform",    asset: "API",       trigger: "5xx > 1% (p95 1.4s)",                 status: "Ack",     cost: "L" },
];

export function LiveAlertsTable({
  rows              = DEFAULT_ROWS,
  onAckAll,
  onSnooze,
  onCreateIncident,
  onRowClick,
}: LiveAlertsTableProps) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#E9EDEF] flex flex-wrap items-center gap-2">
        <div className="font-black text-[13px] text-[#111B21] flex-1 min-w-0 truncate">
          Live Alerts (Rules + Incidents)
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={onAckAll}
            className="h-7 px-3 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[11px] font-extrabold border-none cursor-pointer hover:brightness-105 transition-all whitespace-nowrap"
          >
            Ack All (low)
          </button>
          <button
            onClick={onSnooze}
            className="h-7 px-3 rounded-full bg-[#F0F2F5] text-[#111B21] text-[11px] font-extrabold border-none cursor-pointer hover:bg-[#E9EDEF] transition-all"
          >
            Snooze
          </button>
          <button
            onClick={onCreateIncident}
            className="h-7 px-3 rounded-full bg-[#34B7F1] text-white text-[11px] font-extrabold border-none cursor-pointer hover:brightness-105 transition-all whitespace-nowrap"
          >
            Create Incident
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[#E9EDEF] bg-[#F8F9FA]">
              {["Sev", "Time", "Product", "Tenant", "Asset", "Trigger", "Status", "Cost"].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-[11px] font-extrabold text-[#667781] whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row.id)}
                className={`border-b border-[#E9EDEF] last:border-0 hover:bg-[#F8F9FA] transition-colors cursor-pointer ${i % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"}`}
              >
                {/* Sev */}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${sevDot[row.sev]}`} />
                    <span className="font-extrabold text-[#111B21]">{row.sev}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-[#667781] whitespace-nowrap font-mono">{row.time}</td>
                <td className="px-3 py-2.5 font-extrabold text-[#111B21] whitespace-nowrap">{row.product}</td>
                <td className="px-3 py-2.5 text-[#111B21] whitespace-nowrap">{row.tenant}</td>
                <td className="px-3 py-2.5 text-[#111B21] whitespace-nowrap font-mono">{row.asset}</td>
                {/* Trigger — truncated */}
                <td className="px-3 py-2.5 text-[#667781] max-w-[220px] truncate">{row.trigger}</td>
                {/* Status badge */}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${statusCls[row.status]}`}>
                    {row.status}
                  </span>
                </td>
                {/* Cost circle */}
                <td className="px-3 py-2.5">
                  <span className={`w-6 h-6 rounded-full text-[10px] font-extrabold grid place-items-center ${costCls[row.cost]}`}>
                    {row.cost}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}