/**
 * OpsBriefModal — Waswa Daily Ops Brief Modal
 *
 * Full-screen modal with 5 scrollable sections:
 *   1) System health summary (metric cards)
 *   2) Revenue + token risks
 *   3) VEBA marketplace governance
 *   4) Recommended actions (approve/reject per item)
 *   5) Approval log (irrefutable table)
 *
 * Header: HIC • APPROVAL REQUIRED badge, window toggle, refresh, WhatsApp send
 * Footer: Save PDF | Send WhatsApp | Close
 *
 * Matches NAVAS_v26_Screen03 modal scroll screenshots exactly.
 */
import React, { useState } from "react";

interface OpsBriefModalProps {
  tenant:          string;
  open:            boolean;
  onClose:         () => void;
  onSendWhatsApp?: () => void;
  onSavePDF?:      () => void;
}

// ── Approval log table data type ─────────────────────────────────────────────
interface ApprovalLogRow {
  time:   string;
  action: string;
  state:  "Pending" | "Approved" | "Rejected";
  actor:  string;
}

// ── Recommended action row data type ─────────────────────────────────────────
interface ActionItem {
  id:    string;
  dot:   "warn" | "alarm" | "critical";
  title: string;
  meta:  string;
}

// ── Static brief data (replace with API response) ────────────────────────────
const ACTIONS: ActionItem[] = [
  { id: "a1", dot: "warn",     title: "Set daily AI video cap",           meta: "Cap: 120k tokens/day • soft alert @80%" },
  { id: "a2", dot: "critical", title: "Enable M-Pesa fallback",           meta: "Route to alt callback endpoint + retry policy" },
  { id: "a3", dot: "warn",     title: "Tighten offline alert thresholds", meta: "Reduce alarm fatigue (20→12/unit/day)" },
];

const APPROVAL_LOG: ApprovalLogRow[] = [
  { time: "14:06", action: "Price rule edit", state: "Pending",  actor: "User: sysadmin" },
  { time: "13:52", action: "Refund",          state: "Pending",  actor: "User: finance"  },
  { time: "12:31", action: "Kill-switch",     state: "Approved", actor: "User: noclead"  },
];

const dotColor: Record<string, string> = {
  warn:     "bg-[#FBBF24]",
  alarm:    "bg-[#F97316]",
  critical: "bg-[#EF4444]",
};

const stateStyles: Record<string, string> = {
  Pending:  "bg-[#FFF8E1] text-[#7A5E00] border-[#FFE08A]",
  Approved: "bg-[#EAFBEF] text-[#1A7A3A] border-[#C7F2D4]",
  Rejected: "bg-[#FFEBEE] text-[#C62828] border-[#FFCDD2]",
};

export function OpsBriefModal({ tenant, open, onClose, onSendWhatsApp, onSavePDF }: OpsBriefModalProps) {
  const [timeWindow, setTimeWindow] = useState<"Last 24h" | "Last 7d">("Last 24h");

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Waswa Daily Ops Brief"
      className="fixed inset-0 bg-black/45 flex items-center justify-center z-[9999] p-4"
    >
      <div className="
        w-full max-w-[940px] bg-white border border-[#E9EDEF]
        rounded-2xl flex flex-col overflow-hidden
        shadow-[0_18px_60px_rgba(0,0,0,0.25)]
        max-h-[calc(100dvh-32px)]
      ">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#E9EDEF] shrink-0">
          <div className="min-w-0">
            <div className="font-black text-[16px] text-[#111B21]">Waswa Daily Ops Brief</div>
            <div className="text-[11px] text-[#667781] mt-0.5">
              Tenant: {tenant} • HIC + Approval Required
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-[#FFF8E1] border border-[#FFE08A] text-[#7A5E00]">
              HIC • APPROVAL REQUIRED
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-xl border border-[#E9EDEF] bg-white text-[#667781] cursor-pointer hover:bg-[#F0F2F5] transition-colors text-[14px]"
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Toolbar ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#E9EDEF] bg-[#F8F9FA] shrink-0 flex-wrap">
          <span className="text-[11px] font-extrabold text-[#667781] bg-white border border-[#E9EDEF] px-2.5 py-1 rounded-full">
            Window: {timeWindow}
          </span>
          <button
            onClick={() => setTimeWindow((w) => (w === "Last 24h" ? "Last 7d" : "Last 24h"))}
            className="h-7 px-2.5 rounded-full border border-[#E9EDEF] bg-white text-[11px] text-[#667781] cursor-pointer hover:bg-[#F0F2F5] transition-colors"
          >
            Toggle window
          </button>
          <button className="h-7 px-2.5 rounded-full border border-[#E9EDEF] bg-white text-[11px] text-[#667781] cursor-pointer hover:bg-[#F0F2F5] transition-colors">
            Refresh: 30s
          </button>
          <button
            onClick={onSendWhatsApp}
            className="h-7 px-3 rounded-full border-none bg-[var(--accent)] text-[var(--on-accent)] text-[11px] font-extrabold cursor-pointer hover:brightness-105 transition-all"
          >
            Send via WhatsApp
          </button>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-6">

          {/* 1) System health summary */}
          <BriefSection num="1" title="System health summary">
            <p className="text-[12px] text-[#667781] leading-relaxed m-0">
              Kafka consumer lag stabilized. Parser errors remain elevated for GT06N devices.
              API 5xx has returned to baseline after a rolling restart of{" "}
              <code className="bg-[#F0F2F5] px-1 rounded text-[11px]">navas-api</code>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <MetricCard label="Ingest delay p95" value="2m 10s" hint="Alarm if > 2m" tone="warn" />
              <MetricCard label="Redis hit ratio"   value="98.4%" hint="Stable"        tone="good" />
              <MetricCard label="M-Pesa callbacks"  value="Degraded" hint="p95 7.2s"  tone="warn" />
            </div>
          </BriefSection>

          {/* 2) Revenue + token risks */}
          <BriefSection num="2" title="Revenue + token risks">
            <ul className="text-[12px] text-[#667781] leading-relaxed m-0 pl-4 list-disc space-y-1.5">
              <li>Token burn spike driven by <strong>AI / Video</strong> retrieval and <strong>maps</strong> routing calls.</li>
              <li>Recommended daily cap: <strong>120k tokens/day</strong> with a soft alert at 80%.</li>
              <li>Unbilled usage backlog is within tolerance (age &lt; 1h).</li>
            </ul>
          </BriefSection>

          {/* 3) VEBA marketplace governance */}
          <BriefSection num="3" title="VEBA marketplace governance">
            <div className="bg-[#EAFBEF] border border-[#C7F2D4] rounded-xl p-3">
              <div className="font-extrabold text-[13px] text-[#1A7A3A]">Leakage prevented: 11</div>
              <p className="text-[12px] text-[#1A7A3A] mt-1 leading-relaxed m-0">
                Pattern: contact-share before payment unlock. Auto-blocked + logged.
                Next: require "Connection Token" unlock for high-risk actors.
              </p>
            </div>
          </BriefSection>

          {/* 4) Recommended actions */}
          <BriefSection num="4" title="Recommended actions (approve / reject)">
            <div className="flex flex-col gap-3">
              {ACTIONS.map((action) => (
                <div
                  key={action.id}
                  className="flex items-center gap-3 border border-dashed border-[#E9EDEF] rounded-xl p-3 bg-[#FBFBFB]"
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor[action.dot]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-[13px] text-[#111B21] leading-tight">{action.title}</div>
                    <div className="text-[11px] text-[#667781] mt-0.5">{action.meta}</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button className="h-8 px-3 rounded-lg border-none bg-[var(--accent)] text-[var(--on-accent)] text-[12px] font-extrabold cursor-pointer hover:brightness-105 transition-all">
                      Approve
                    </button>
                    <button className="h-8 px-3 rounded-lg border border-[#E9EDEF] bg-white text-[#667781] text-[12px] cursor-pointer hover:bg-[#F0F2F5] transition-colors">
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </BriefSection>

          {/* 5) Approval log */}
          <BriefSection num="5" title="Approval log (irrefutable)">
            <div className="overflow-x-auto rounded-xl border border-[#E9EDEF]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#F8F9FA]">
                    {["Time", "Action", "State", "Actor"].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[11px] text-[#667781] font-extrabold px-3 py-2.5 border-b border-[#E9EDEF]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {APPROVAL_LOG.map((row, i) => (
                    <tr key={i} className="hover:bg-[#FBFEFD] transition-colors">
                      <td className="px-3 py-2.5 border-b border-[#E9EDEF] text-[12px] text-[#667781] font-mono">
                        {row.time}
                      </td>
                      <td className="px-3 py-2.5 border-b border-[#E9EDEF] text-[12px] font-extrabold text-[#111B21]">
                        {row.action}
                      </td>
                      <td className="px-3 py-2.5 border-b border-[#E9EDEF]">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${stateStyles[row.state]}`}>
                          {row.state}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 border-b border-[#E9EDEF] text-[12px] text-[#667781]">
                        {row.actor}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BriefSection>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-[#E9EDEF] shrink-0 flex-wrap">
          <button
            onClick={onSavePDF}
            className="h-9 px-4 rounded-lg border border-[#E9EDEF] bg-white text-[12px] text-[#667781] cursor-pointer hover:bg-[#F8F9FA] transition-colors"
          >
            Save PDF
          </button>
          <button
            onClick={onSendWhatsApp}
            className="h-9 px-4 rounded-lg border-none bg-[var(--accent)] text-[var(--on-accent)] text-[12px] font-extrabold cursor-pointer hover:brightness-105 transition-all"
          >
            Send WhatsApp
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-[#E9EDEF] bg-white text-[12px] text-[#667781] cursor-pointer hover:bg-[#F8F9FA] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Internal sub-components ───────────────────────────────────────────────────
function BriefSection({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-black text-[14px] text-[#111B21] m-0 mb-3">
        {num}) {title}
      </h3>
      {children}
    </section>
  );
}

function MetricCard({
  label, value, hint, tone,
}: { label: string; value: string; hint: string; tone: "good" | "warn" | "bad" }) {
  const bg: Record<string, string> = {
    good: "bg-[#EAFBEF] border-[#C7F2D4]",
    warn: "bg-[#FFF8E1] border-[#FFE08A]",
    bad:  "bg-[#FFEBEE] border-[#FFCDD2]",
  };
  return (
    <div className={`rounded-xl border p-3 ${bg[tone]}`}>
      <div className="text-[11px] text-[#667781]">{label}</div>
      <div className="font-black text-[18px] text-[#111B21] mt-1">{value}</div>
      <div className="text-[11px] text-[#667781] mt-0.5">{hint}</div>
    </div>
  );
}
