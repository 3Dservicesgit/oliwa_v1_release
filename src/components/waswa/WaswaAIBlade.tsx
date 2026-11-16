/**
 * WaswaAIBlade — Waswa AI Proactive Co-Pilot Blade
 *
 * Displays the AI recommendation chat bubble, action buttons,
 * and the natural-language prompt input bar.
 */
import React, { useState } from "react";
import { useAssistantName } from "../../branding/branding";
import { Card } from "../ui";

interface WaswaAIBladeProps {
  /** The AI-generated recommendation message (supports JSX) */
  message?:      React.ReactNode;
  onApproveMint?: () => void;
}

export function WaswaAIBlade({ message, onApproveMint }: WaswaAIBladeProps) {
  const assistantName = useAssistantName();
  const [prompt, setPrompt] = useState("");

  const defaultMessage = (
    <>
      <strong>System Health 99.8%</strong> | Detected potential revenue leakage in VEBA Boda
      sector. Recommend minting <strong>5,000 tokens</strong> to Tenant{" "}
      <strong>BodaUnion‑KLA</strong> to avoid run‑out in 19h.
    </>
  );

  return (
    <Card
      title={`${assistantName} AI — Proactive Co‑Pilot`}
      subtitle="Humans approve high-risk moves (HITL/HIC)."
    >
      {/* AI-FIRST badge row */}
      <div className="-mt-2 mb-1">
        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-[#EAFBEF] border-[#C7F2D4] text-[#1A7A3A]">
          AI‑FIRST
        </span>
      </div>

      {/* Recommendation bubble */}
      <div className="bg-[#E8F5F2] border border-[#BFE7E0] rounded-xl p-3 text-[13px] text-[#111B21] leading-relaxed">
        {message ?? defaultMessage}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mt-1">
        <ActionBtn variant="teal">Open Leakage Case</ActionBtn>
        <ActionBtn variant="green" onClick={onApproveMint}>Approve Mint (HITL)</ActionBtn>
        <ActionBtn variant="azure">Set Burn Cap</ActionBtn>
        <ActionBtn variant="dark">Export Brief</ActionBtn>
      </div>

      {/* Ask Waswa prompt */}
      <div className="flex gap-2 mt-1">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={`Ask ${assistantName}… e.g., "Show auth anomalies for MTN customers in UG last 24h"`}
          className="
            flex-1 min-w-0 h-[42px] rounded-xl border border-[#E9EDEF]
            bg-[#F8F9FA] px-3 text-[12px] outline-none
            focus:border-[var(--brand)] transition-colors
          "
        />
        <button
          className="
            w-11 h-[42px] rounded-xl border-none shrink-0
            bg-[var(--accent)] text-[var(--on-accent)] font-black text-[16px]
            cursor-pointer hover:brightness-105 active:opacity-85 transition-all
          "
        >
          ➤
        </button>
      </div>
    </Card>
  );
}

// ── Internal button helper ──────────────────────────────────────────────────
const variantCls: Record<string, string> = {
  green: "bg-[var(--accent)] text-[var(--on-accent)]",
  teal:  "bg-[var(--brand)] text-[var(--on-brand)]",
  azure: "bg-[#34B7F1] text-white",
  dark:  "bg-[#111B21] text-white",
};

function ActionBtn({
  variant = "teal",
  onClick,
  children,
}: {
  variant?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        h-[34px] rounded-lg px-3 text-[12px] font-extrabold border-none
        cursor-pointer transition-all hover:brightness-105 active:opacity-85
        ${variantCls[variant]}
      `}
    >
      {children}
    </button>
  );
}
