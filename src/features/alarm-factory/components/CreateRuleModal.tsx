/**
 * CreateRuleModal — Create Rule (HITL protected)
 *
 * Matches screenshots 3 & 4 exactly:
 *   Header: "Create Rule (HITL protected)" + "High-Risk" orange badge + × close
 *   Left nav: Basics | Trigger | Conditions (active) | Channels | Token Cost | Escalation | Audit
 *   Right panel: scrollable form section per tab
 *   Footer (sticky): "Audit: ON • This change will be hash-chained. Approver required."
 *                    + "Request Approval (HITL)" (teal) + "Save Draft" (green)
 *
 * All styles: Tailwind utility classes only.
 */
import React, { useState } from "react";

type Tab = "Basics" | "Trigger" | "Conditions" | "Channels" | "Token Cost" | "Escalation" | "Audit";

const TABS: Tab[] = ["Basics", "Trigger", "Conditions", "Channels", "Token Cost", "Escalation", "Audit"];

interface CreateRuleModalProps {
  open:              boolean;
  onClose:           () => void;
  onRequestApproval?:() => void;
  onSaveDraft?:      () => void;
}

/* ── Reusable form primitives ─────────────────────────────────────────────── */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] font-extrabold text-[#111B21]">{children}</div>;
}

function FieldInput({ value, placeholder, onChange }: { value?: string; placeholder?: string; onChange?: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className="w-full h-10 px-3 rounded-lg border border-[#E9EDEF] bg-white text-[12px] text-[#111B21] outline-none focus:border-[var(--brand)] transition-colors"
    />
  );
}

function FieldSelect({ value, options, onChange }: { value?: string; options: string[]; onChange?: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className="w-full h-10 px-3 rounded-lg border border-[#E9EDEF] bg-white text-[12px] text-[#111B21] outline-none focus:border-[var(--brand)] transition-colors cursor-pointer"
    >
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

/* ── Tab panels ───────────────────────────────────────────────────────────── */

function BasicsPanel() {
  return (
    <div className="flex flex-col gap-4">
      <div className="font-black text-[14px] text-[#111B21]">Basics</div>
      <FormRow label="Rule Name">
        <FieldInput placeholder="e.g. Leakage Guard (VEBA Boda)" />
      </FormRow>
      <FormRow label="Description">
        <textarea
          className="w-full h-20 px-3 py-2 rounded-lg border border-[#E9EDEF] bg-white text-[12px] text-[#111B21] outline-none focus:border-[var(--brand)] transition-colors resize-none"
          placeholder="Describe what this rule detects and why it matters…"
        />
      </FormRow>
      <FormRow label="Product">
        <FieldSelect value="VEBA" options={["VEBA", "OLIWA", "PIKI", "CORE", "PAY"]} />
      </FormRow>
      <FormRow label="Family">
        <FieldInput value="billing / leakage" />
      </FormRow>
      <FormRow label="Rule ID">
        <FieldInput value="ALM-VEBA-LEAK-001" />
      </FormRow>
      <FormRow label="Owner">
        <FieldInput value="SRE/Billing" />
      </FormRow>
    </div>
  );
}

function TriggerPanel() {
  return (
    <div className="flex flex-col gap-4">
      <div className="font-black text-[14px] text-[#111B21]">Trigger</div>
      <FormRow label="Trigger Type">
        <FieldSelect value="Threshold" options={["Threshold", "Anomaly", "Pattern", "Rate of change"]} />
      </FormRow>
      <FormRow label="Metric">
        <FieldInput placeholder="e.g. contact_unlock_rate" />
      </FormRow>
      <FormRow label="Operator">
        <FieldSelect value="> (greater than)" options={["> (greater than)", "< (less than)", "= (equals)", "!= (not equal)", ">= (gte)", "<= (lte)"]} />
      </FormRow>
      <FormRow label="Threshold Value">
        <FieldInput placeholder="e.g. 2.0" />
      </FormRow>
      <FormRow label="Window">
        <FieldSelect value="15 min" options={["5 min", "15 min", "30 min", "1h", "6h", "24h"]} />
      </FormRow>
      <FormRow label="Evaluation Frequency">
        <FieldSelect value="1 min" options={["30s", "1 min", "5 min", "15 min"]} />
      </FormRow>
    </div>
  );
}

function ConditionsPanel() {
  return (
    <div className="flex flex-col gap-4">
      <div className="font-black text-[14px] text-[#111B21]">Conditions (AND / OR)</div>

      <FormRow label="Product">
        <FieldInput value="VEBA" />
      </FormRow>
      <FormRow label="Family">
        <FieldInput value="billing / leakage" />
      </FormRow>
      <FormRow label="Rule ID">
        <FieldInput value="ALM-VEBA-LEAK-001" />
      </FormRow>
      <FormRow label="Owner">
        <FieldInput value="SRE/Billing" />
      </FormRow>
      <FormRow label="Data Source">
        <FieldInput value="Kafka: navas.alerts + navas.usage_events" />
      </FormRow>
      <FormRow label="Denominator">
        <FieldInput value="per tenant / per active listing" />
      </FormRow>
      <FormRow label="Severity">
        <FieldInput value="🔴 Critical (P1)" />
      </FormRow>
      <FormRow label="HITL Required">
        <FieldInput value="YES (approval for suspend/penalty)" />
      </FormRow>
      <FormRow label="Condition 1">
        <FieldInput value="Detect phone/WhatsApp link before booking confirmed" />
      </FormRow>
      <FormRow label="Condition 2">
        <FieldInput value="Payment attempts > 3 & escrow not funded" />
      </FormRow>
      <FormRow label="Condition 3">
        <FieldInput value="Booking conversion drop > 10% WoW (same tenant)" />
      </FormRow>
      <FormRow label="Condition 4">
        <FieldInput value="Contact unlocks > 2× baseline" />
      </FormRow>
    </div>
  );
}

function ChannelsPanel() {
  const channels = ["WhatsApp", "SMS", "In-app", "Email", "Webhook"];
  const [selected, setSelected] = useState<string[]>(["WhatsApp", "In-app"]);

  const toggle = (ch: string) => {
    setSelected((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="font-black text-[14px] text-[#111B21]">Channels</div>
      <div className="text-[12px] text-[#667781]">Select which channels this rule fires on. Token costs vary per channel.</div>
      <div className="flex flex-col gap-2">
        {channels.map((ch) => (
          <label key={ch} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(ch)}
              onChange={() => toggle(ch)}
              className="accent-[var(--brand)] w-4 h-4"
            />
            <span className="text-[12px] font-extrabold text-[#111B21]">{ch}</span>
          </label>
        ))}
      </div>
      <FormRow label="Throttle (max per unit/day)">
        <FieldInput placeholder="e.g. 3" />
      </FormRow>
      <FormRow label="Digest (bundle low-sev)">
        <FieldSelect value="P3/P4 → digest" options={["Off", "P3/P4 → digest", "All → digest"]} />
      </FormRow>
    </div>
  );
}

function TokenCostPanel() {
  return (
    <div className="flex flex-col gap-4">
      <div className="font-black text-[14px] text-[#111B21]">Token Cost</div>
      <div className="bg-[#FFF8E1] border border-[#FFE08A] rounded-xl px-4 py-3 text-[12px] text-[#7A5E00]">
        Token costs are PAYG per delivery. WhatsApp = highest cost. Route P3/P4 to digest to reduce spend.
      </div>
      <FormRow label="WhatsApp cost per fire">
        <FieldInput value="0.04 TK" />
      </FormRow>
      <FormRow label="SMS cost per fire">
        <FieldInput value="0.02 TK" />
      </FormRow>
      <FormRow label="In-app cost per fire">
        <FieldInput value="0.005 TK" />
      </FormRow>
      <FormRow label="AI summary cost (P1 only)">
        <FieldInput value="0.12 TK" />
      </FormRow>
      <FormRow label="Estimated daily spend">
        <FieldInput placeholder="Auto-calculated on save" />
      </FormRow>
      <FormRow label="Budget cap (alert me at)">
        <FieldInput placeholder="e.g. 50 TK/day" />
      </FormRow>
    </div>
  );
}

function EscalationPanel() {
  return (
    <div className="flex flex-col gap-4">
      <div className="font-black text-[14px] text-[#111B21]">Escalation</div>
      <FormRow label="Auto-escalate after (unacked)">
        <FieldSelect value="30 min" options={["5 min", "15 min", "30 min", "1h", "2h", "Manual only"]} />
      </FormRow>
      <FormRow label="Escalate to">
        <FieldInput placeholder="e.g. SRE-On-Call, Billing Lead" />
      </FormRow>
      <FormRow label="HITL required for">
        <FieldSelect value="Suspend + Penalty" options={["All actions", "Suspend + Penalty", "Penalty only", "None"]} />
      </FormRow>
      <FormRow label="Auto-ack low-severity (P4)">
        <FieldSelect value="Yes — after 10m" options={["Yes — after 10m", "Yes — after 30m", "No"]} />
      </FormRow>
      <FormRow label="Penalty: soft suspend (VEBA)">
        <FieldInput placeholder="e.g. 72h listing pause" />
      </FormRow>
      <FormRow label="Penalty: token deduction">
        <FieldInput placeholder="e.g. 25 TK fee" />
      </FormRow>
    </div>
  );
}

function AuditPanel() {
  return (
    <div className="flex flex-col gap-4">
      <div className="font-black text-[14px] text-[#111B21]">Audit</div>
      <div className="bg-[#E8F5F2] border border-[#BFE7E0] rounded-xl px-4 py-3 text-[12px] text-[var(--brand)] leading-relaxed">
        All changes to this rule are hash-chained into the NAVAS irrefutable audit trail.
        Any activation, modification, or deletion requires Approver sign-off and is permanently logged.
      </div>
      <FormRow label="Audit trail: ON / OFF">
        <FieldSelect value="ON (required for P1/P2)" options={["ON (required for P1/P2)", "ON (all)", "OFF (P4 only)"]} />
      </FormRow>
      <FormRow label="Hash-chain: ON / OFF">
        <FieldSelect value="ON" options={["ON", "OFF (not recommended)"]} />
      </FormRow>
      <FormRow label="Retention period">
        <FieldSelect value="365 days" options={["90 days", "180 days", "365 days", "Forever"]} />
      </FormRow>
      <FormRow label="Approver role required">
        <FieldSelect value="SYS_ADMIN" options={["SYS_ADMIN", "SRE_LEAD", "BILLING_ADMIN", "ANY_ADMIN"]} />
      </FormRow>
    </div>
  );
}

/* ── Modal ────────────────────────────────────────────────────────────────── */

export function CreateRuleModal({ open, onClose, onRequestApproval, onSaveDraft }: CreateRuleModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Conditions");

  if (!open) return null;

  const renderPanel = () => {
    switch (activeTab) {
      case "Basics":      return <BasicsPanel />;
      case "Trigger":     return <TriggerPanel />;
      case "Conditions":  return <ConditionsPanel />;
      case "Channels":    return <ChannelsPanel />;
      case "Token Cost":  return <TokenCostPanel />;
      case "Escalation":  return <EscalationPanel />;
      case "Audit":       return <AuditPanel />;
    }
  };

  return (
    <div className="fixed inset-0 z-[9000] flex items-start justify-center pt-[60px] px-4 pb-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative z-[1] w-full max-w-[820px] bg-white rounded-2xl border border-[#E9EDEF] shadow-[0_24px_60px_rgba(0,0,0,0.18)] flex flex-col max-h-[85vh]">

        {/* ── Modal header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E9EDEF] shrink-0">
          <div className="font-black text-[16px] text-[#111B21]">
            Create Rule (HITL protected)
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-extrabold bg-[#F97316] text-white px-3 py-1 rounded-full">
              High-Risk
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#F0F2F5] border-none text-[#667781] text-[16px] cursor-pointer hover:bg-[#E9EDEF] transition-all grid place-items-center"
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Body: left tabs + right form ─────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left tab nav */}
          <nav className="w-[160px] shrink-0 border-r border-[#E9EDEF] flex flex-col py-2 overflow-y-auto">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`
                  text-left px-4 py-2.5 text-[13px] font-extrabold border-none cursor-pointer transition-colors
                  ${activeTab === tab
                    ? "bg-[var(--brand)] text-white"
                    : "bg-transparent text-[#667781] hover:bg-[#F0F2F5]"}
                `}
              >
                {tab}
              </button>
            ))}
          </nav>

          {/* Right scrollable form */}
          <div className="flex-1 min-w-0 overflow-y-auto p-6">
            {renderPanel()}
          </div>
        </div>

        {/* ── Sticky footer ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 px-6 py-3 border-t border-[#E9EDEF] bg-[#F8F9FA] shrink-0">
          <div className="text-[11px] text-[#667781]">
            Audit: ON&nbsp;•&nbsp;This change will be hash-chained. Approver required.
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onRequestApproval}
              className="h-9 px-4 rounded-xl bg-[#34B7F1] text-white text-[12px] font-extrabold border-none cursor-pointer hover:brightness-105 transition-all whitespace-nowrap"
            >
              Request Approval (HITL)
            </button>
            <button
              onClick={onSaveDraft}
              className="h-9 px-4 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] text-[12px] font-extrabold border-none cursor-pointer hover:brightness-105 transition-all whitespace-nowrap"
            >
              Save Draft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}