/**
 * WaswaAIPanel — Waswa AI Co-Pilot Right Panel
 *
 * The full-height right AI panel used in the OPS WAR ROOM.
 * Contains:
 *   - ON/OFF toggle header
 *   - Proactive insights list (coloured dots)
 *   - HITL queue (coloured dots + labels)
 *   - Chat input bar with Send button
 *
 * Different from WaswaAIBlade (which is a card in the main content area):
 * this is a tall aside panel fixed to the right of the workspace.
 */
import React, { useRef, useState } from "react";
import { useAssistantName } from "../../branding/branding";

export interface WaswaInsight {
  id:    string;
  sev:   "warn" | "alarm" | "critical";
  title: string;
  body:  string;
}

export interface WaswaHITLItem {
  id:    string;
  sev:   "warn" | "alarm" | "critical";
  title: string;
  sub:   string;
}

interface WaswaAIPanelProps {
  insights?:         WaswaInsight[];
  hitlItems?:        WaswaHITLItem[];
  onGenerateBrief?:  () => void;
  onAlertTuning?:    () => void;
  onDetectLeakage?:  () => void;
  onSendChat?:       (msg: string) => void;
}

const sevDot: Record<string, string> = {
  warn:     "bg-[#FBBF24]",
  alarm:    "bg-[#F97316]",
  critical: "bg-[#EF4444]",
};

const DEFAULT_INSIGHTS: WaswaInsight[] = [
  { id: "i1", sev: "alarm",    title: "Token burn spike",   body: "Video AI + maps up 3.6× baseline" },
  { id: "i2", sev: "warn",     title: "Revenue leakage",    body: "11 contact-share attempts blocked" },
  { id: "i3", sev: "critical", title: "Gateway risk",       body: "M-Pesa webhooks failing (p95 9.4s)" },
];

const DEFAULT_HITL: WaswaHITLItem[] = [
  { id: "h1", sev: "warn",     title: "Price rule change", sub: "OLIWA-PLUS +5% (UG)" },
  { id: "h2", sev: "critical", title: "Refund request",    sub: "Invoice #INV-00912" },
  { id: "h3", sev: "warn",     title: "VEBA dispute",      sub: "Booking #VB-7741" },
];

export function WaswaAIPanel({
  insights      = DEFAULT_INSIGHTS,
  hitlItems     = DEFAULT_HITL,
  onGenerateBrief,
  onAlertTuning,
  onDetectLeakage,
  onSendChat,
}: WaswaAIPanelProps) {
  const assistantName = useAssistantName();
  const [aiOn, setAiOn] = useState(true);
  const [chat, setChat] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const msg = chat.trim();
    if (!msg) return;
    onSendChat?.(msg);
    setChat("");
    inputRef.current?.focus();
  };

  return (
    <aside className="
      hidden lg:flex flex-col w-[320px] shrink-0 min-h-0
      bg-white border-l border-[#E9EDEF]
    ">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E9EDEF] shrink-0">
        <div>
          <div className="font-black text-[14px] text-[#111B21]">{assistantName} AI • Co-Pilot</div>
          <div className="text-[11px] text-[#667781]">Human-in-Control • Audit-logged</div>
        </div>
        <button
          onClick={() => setAiOn((v) => !v)}
          aria-pressed={aiOn}
          className={`
            h-7 min-w-[46px] px-3 rounded-full border-none text-[11px] font-black
            cursor-pointer transition-all
            ${aiOn ? "bg-[var(--accent)] text-[var(--on-accent)]" : "bg-[#F0F2F5] text-[#667781]"}
          `}
        >
          {aiOn ? "ON" : "OFF"}
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">

        {/* Proactive insights */}
        <div className="px-4 pt-4 pb-2">
          <div className="text-[11px] font-extrabold text-[#667781] uppercase tracking-wide mb-2">
            Proactive insights
          </div>
          <div className="flex flex-col gap-2">
            {insights.map((insight) => (
              <div key={insight.id} className="flex items-start gap-2.5">
                <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${sevDot[insight.sev]}`} />
                <div className="min-w-0">
                  <div className="font-extrabold text-[12px] text-[#111B21] leading-tight">{insight.title}</div>
                  <div className="text-[11px] text-[#667781] mt-0.5 leading-snug">{insight.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* HITL queue */}
        <div className="px-4 pt-2 pb-3 border-t border-[#E9EDEF] mt-2">
          <div className="text-[11px] font-extrabold text-[#667781] uppercase tracking-wide mb-2">
            HITL queue (requires approval)
          </div>
          <div className="flex flex-col gap-2">
            {hitlItems.map((item) => (
              <div key={item.id} className="flex items-start gap-2.5">
                <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${sevDot[item.sev]}`} />
                <div className="min-w-0">
                  <div className="font-extrabold text-[12px] text-[#111B21] leading-tight">{item.title}</div>
                  <div className="text-[11px] text-[#667781] mt-0.5">{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="px-4 pb-4 border-t border-[#E9EDEF] mt-auto pt-3 flex flex-col gap-2">
          <div className="text-[11px] font-extrabold text-[#667781] uppercase tracking-wide mb-1">
            Quick actions
          </div>
          <button
            onClick={onGenerateBrief}
            className="w-full h-8 rounded-lg border border-[#C7F2D4] bg-[#EAFBEF] text-[12px] font-extrabold text-[#1A7A3A] cursor-pointer hover:brightness-95 transition-all"
          >
            Generate Ops Brief
          </button>
          <button
            onClick={onAlertTuning}
            className="w-full h-8 rounded-lg border border-[#E9EDEF] bg-white text-[12px] text-[#667781] cursor-pointer hover:bg-[#F8F9FA] transition-colors"
          >
            Suggest alert tuning
          </button>
          <button
            onClick={onDetectLeakage}
            className="w-full h-8 rounded-lg border border-[#E9EDEF] bg-white text-[12px] text-[#667781] cursor-pointer hover:bg-[#F8F9FA] transition-colors"
          >
            Detect leakage
          </button>
        </div>
      </div>

      {/* Chat input — pinned to bottom */}
      <div className="flex gap-2 px-4 py-3 border-t border-[#E9EDEF] shrink-0">
        <input
          ref={inputRef}
          value={chat}
          onChange={(e) => setChat(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={`Ask ${assistantName}… e.g., 'Why did burn spike?'`}
          className="
            flex-1 min-w-0 h-9 rounded-xl border border-[#E9EDEF]
            bg-[#F8F9FA] px-3 text-[12px] outline-none
            focus:border-[var(--brand)] transition-colors
          "
        />
        <button
          onClick={handleSend}
          className="
            h-9 px-3 rounded-xl border-none shrink-0
            bg-[var(--accent)] text-[var(--on-accent)] font-black text-[12px]
            cursor-pointer hover:brightness-105 active:opacity-85 transition-all
          "
        >
          Send
        </button>
      </div>
    </aside>
  );
}
