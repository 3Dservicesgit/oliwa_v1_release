/**
 * WaswaTriagePanel — Waswa AI Triage Blade (Right Panel)
 *
 * Distinct from WaswaAIPanel. Matches ALL Alarm Factory screenshots (right side):
 *
 *   Header:          "Waswa AI • Triage Blade" + ON toggle
 *   AI Daily Brief:  System Health / Leakage Signal / Token Advice / Next Action (truncated rows)
 *                    Footer: Review HITL (7) | Open AI Console
 *   Infra Snapshot:  "Socket→Kafka→Cassandra" + Resource Usage CPU/RAM/DISK bars
 *   Mobile Money:    M-Pesa KE / MTN UG / Airtel UG / Airtel KE rows with notes + SR% badge
 *   AI Action Queue: HITL/HIC items with coloured badges + Approve Selected | View Audit Proof
 *
 * All styles: Tailwind utility classes only.
 */
import React from "react";
import { useAssistantName } from "../../branding/branding";

/* ── Sub-types ─────────────────────────────────────────────────────────────── */

export interface AiQueueItem {
  id:     string;
  badge:  "HITL" | "HIC";
  title:  string;
  sub:    string;
}

export interface MoMoRow {
  id:      string;
  name:    string;
  note:    string;
  sr:      string;
  srTone:  "ok" | "warn" | "alarm";
}

export interface ResourceBar {
  label: string;
  pct:   number;
  tone:  "ok" | "warn" | "alarm";
}

interface WaswaTriagePanelProps {
  waswaOn?:          boolean;
  onToggleWaswa?:    () => void;
  onReviewHitl?:     () => void;
  onOpenAiConsole?:  () => void;
  onApproveSelected?:() => void;
  onViewAuditProof?: () => void;
  hitlCount?:        number;
  briefRows?:        { label: string; value: string }[];
  resources?:        ResourceBar[];
  momoRows?:         MoMoRow[];
  queueItems?:       AiQueueItem[];
}

/* ── Defaults ──────────────────────────────────────────────────────────────── */

const DEFAULT_BRIEF = [
  { label: "System Health:", value: "99.8% • CPU 62% • RAM 7…"        },
  { label: "Leakage Signal:",value: "VEBA Boda: contact unloc…"        },
  { label: "Token Advice:",  value: "Recommend mint 5,000 T…"          },
  { label: "Next Action:",   value: "Promote Leakage Guard…"           },
];

const DEFAULT_RESOURCES: ResourceBar[] = [
  { label: "CPU",  pct: 62, tone: "warn" },
  { label: "RAM",  pct: 74, tone: "warn" },
  { label: "DISK", pct: 38, tone: "ok"   },
];

const DEFAULT_MOMO: MoMoRow[] = [
  { id: "mpesa",  name: "M-Pesa KE", note: "Webhook OK",  sr: "SR 98.4%", srTone: "ok"   },
  { id: "mtn",    name: "MTN UG",    note: "Retry q=42",  sr: "SR 96.1%", srTone: "ok"   },
  { id: "airtelug",name:"Airtel UG", note: "Lat 8.2s",    sr: "SR 93.3%", srTone: "warn" },
  { id: "airtelke",name:"Airtel KE", note: "OK",          sr: "SR 97.2%", srTone: "ok"   },
];

const DEFAULT_QUEUE: AiQueueItem[] = [
  { id: "q1", badge: "HITL", title: "Promote Leakage Guard to 🔴 Criti…", sub: "VEBA • Boda"      },
  { id: "q2", badge: "HITL", title: "Auto-ack 112 low-value alerts (n…",  sub: "Ops"              },
  { id: "q3", badge: "HIC",  title: "Kill-switch ready (immobilize)",      sub: "Ambulance • Safety"},
  { id: "q4", badge: "HITL", title: "Mint 5,000 TK • prevent run-out …",  sub: "Billing"          },
];

/* ── Colour helpers ─────────────────────────────────────────────────────────── */

const badgeCls: Record<string, string> = {
  HITL: "bg-[#34B7F1] text-white",
  HIC:  "bg-[#EF4444] text-white",
};

const srToneCls: Record<string, string> = {
  ok:   "bg-[#25D366] text-white",
  warn: "bg-[#F97316] text-white",
  alarm:"bg-[#EF4444] text-white",
};

const barTone: Record<string, string> = {
  ok:   "bg-[#25D366]",
  warn: "bg-[#F97316]",
  alarm:"bg-[#EF4444]",
};

/* ── Component ─────────────────────────────────────────────────────────────── */

export function WaswaTriagePanel({
  waswaOn           = true,
  onToggleWaswa,
  onReviewHitl,
  onOpenAiConsole,
  onApproveSelected,
  onViewAuditProof,
  hitlCount         = 7,
  briefRows         = DEFAULT_BRIEF,
  resources         = DEFAULT_RESOURCES,
  momoRows          = DEFAULT_MOMO,
  queueItems        = DEFAULT_QUEUE,
}: WaswaTriagePanelProps) {
  const assistantName = useAssistantName();
  return (
    <aside className="hidden xl:flex flex-col w-[300px] shrink-0 bg-white border-l border-[#E9EDEF] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E9EDEF] sticky top-0 bg-white z-10">
        <div className="font-black text-[13px] text-[#111B21]">{assistantName} AI • Triage Blade</div>
        <button
          onClick={onToggleWaswa}
          aria-pressed={waswaOn}
          className={`
            h-7 px-3 rounded-full border-none text-[11px] font-black cursor-pointer transition-all
            ${waswaOn ? "bg-[var(--accent)] text-[var(--on-accent)]" : "bg-[#E9EDEF] text-[#667781]"}
          `}
        >
          {waswaOn ? "ON" : "OFF"}
        </button>
      </div>

      {/* ── AI Daily Brief ──────────────────────────────────────────────────── */}
      <section className="px-4 py-3 border-b border-[#E9EDEF]">
        <div className="font-extrabold text-[12px] text-[#111B21] mb-2">AI Daily Brief</div>
        <div className="flex flex-col gap-1.5">
          {briefRows.map((row, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] leading-snug">
              <span className="shrink-0 font-extrabold text-[#667781] w-[90px]">{row.label}</span>
              <span className="text-[#111B21] truncate flex-1">{row.value}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <button
            onClick={onReviewHitl}
            className="h-7 px-3 rounded-full bg-[#34B7F1] text-white text-[10px] font-extrabold border-none cursor-pointer hover:brightness-105 transition-all whitespace-nowrap"
          >
            Review HITL ({hitlCount})
          </button>
          <button
            onClick={onOpenAiConsole}
            className="h-7 px-3 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[10px] font-extrabold border-none cursor-pointer hover:brightness-105 transition-all whitespace-nowrap"
          >
            Open AI Console
          </button>
        </div>
      </section>

      {/* ── Infra Snapshot ──────────────────────────────────────────────────── */}
      <section className="px-4 py-3 border-b border-[#E9EDEF]">
        <div className="font-extrabold text-[12px] text-[#111B21] mb-2">
          Infra Snapshot (Socket→Kafka→Cassandra)
        </div>
        <div className="font-extrabold text-[11px] text-[#667781] mb-2">Resource Usage</div>
        <div className="flex flex-col gap-2">
          {resources.map((r) => (
            <div key={r.label} className="flex items-center gap-2">
              <span className="text-[11px] text-[#667781] w-8 shrink-0">{r.label}</span>
              <div className="flex-1 h-2 rounded-full bg-[#F0F2F5] overflow-hidden">
                <div
                  className={`h-full rounded-full ${barTone[r.tone]}`}
                  style={{ width: `${r.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Mobile Money + ePayment ─────────────────────────────────────────── */}
      <section className="px-4 py-3 border-b border-[#E9EDEF]">
        <div className="font-extrabold text-[12px] text-[#111B21] mb-2">Mobile Money + ePayment</div>
        <div className="flex flex-col gap-1.5">
          {momoRows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold text-[#111B21] whitespace-nowrap w-[70px] shrink-0">
                {row.name}
              </span>
              <span className="text-[11px] text-[#667781] flex-1 truncate">{row.note}</span>
              <span className={`shrink-0 text-[9px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap ${srToneCls[row.srTone]}`}>
                {row.sr}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI Action Queue (HITL/HIC) ──────────────────────────────────────── */}
      <section className="px-4 py-3 flex flex-col gap-3">
        <div className="font-extrabold text-[12px] text-[#111B21]">AI Action Queue (HITL/HIC)</div>

        <div className="flex flex-col gap-2">
          {queueItems.map((item) => (
            <div key={item.id} className="flex items-start gap-2">
              <span className={`shrink-0 text-[9px] font-extrabold px-2 py-0.5 rounded-full mt-0.5 ${badgeCls[item.badge]}`}>
                {item.badge}
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold text-[#111B21] truncate leading-snug">{item.title}</div>
                <div className="text-[10px] text-[#667781]">{item.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 flex-wrap pt-1">
          <button
            onClick={onApproveSelected}
            className="h-7 px-3 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[10px] font-extrabold border-none cursor-pointer hover:brightness-105 transition-all whitespace-nowrap"
          >
            Approve Selected
          </button>
          <button
            onClick={onViewAuditProof}
            className="h-7 px-3 rounded-full bg-[#34B7F1] text-white text-[10px] font-extrabold border-none cursor-pointer hover:brightness-105 transition-all whitespace-nowrap"
          >
            View Audit Proof
          </button>
        </div>
      </section>
    </aside>
  );
}