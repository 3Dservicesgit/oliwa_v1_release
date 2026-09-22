/**
 * InvoicingPage — Screen 06: BILLING BRIDGE · Billing & Invoicing
 *
 * Matches v26 mockups (4 screenshots):
 *   TOP:    Header + 4 KPIs → Tabs + Filters → Invoice Worklist table (8 rows)
 *   MID:    2-col: Dunning & Service Cut-Off | Waswa AI Billing Insights
 *   RIGHT:  Invoice Details panel (always visible): amount, line items, actions, audit trail
 *   MODAL:  HIC Approval Required (dual-control checklist + reason/notes)
 */
import React, { useState } from "react";
import { SampleDataNotice } from "../../components/ui";

// ─── Status colors ───────────────────────────────────────────────────────────
const stColor: Record<string, string> = {
  OVERDUE: "bg-[#F97316] text-white",
  SENT:    "bg-[#34B7F1]/15 text-[#34B7F1] border border-[#34B7F1]/30",
  DISPUTE: "bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30",
  PAID:    "bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30",
  DUNNING: "bg-[#FBBF24]/15 text-[#92400E] border border-[#FBBF24]/30",
};

// ─── Mock Data ───────────────────────────────────────────────────────────────
const INVOICES = [
  { id:"INV-2601-0041", tenant:"UKO OLIWA", plan:"UKO Pro",  period:"Jan", amount:"UGX 2.34M",   status:"OVERDUE", delivery:"WA ✓"    },
  { id:"INV-2601-0038", tenant:"PIKI",      plan:"PIKI Std", period:"Jan", amount:"KES 89,000",   status:"SENT",    delivery:"Email ✓"  },
  { id:"INV-2601-0032", tenant:"KLA LOG",   plan:"UKO Pro",  period:"Jan", amount:"UGX 1.10M",    status:"DISPUTE", delivery:"WA ⚠"    },
  { id:"INV-2601-0027", tenant:"MOMBASA",   plan:"UKO Pro",  period:"Jan", amount:"KES 140,000",  status:"PAID",    delivery:"WA ✓"    },
  { id:"INV-2601-0019", tenant:"BW-HAUL",   plan:"UKO Pro",  period:"Jan", amount:"UGX 780k",     status:"OVERDUE", delivery:"SMS ⚠"   },
  { id:"INV-2601-0011", tenant:"NIG-OPS",   plan:"PIKI Std", period:"Jan", amount:"NGN 520k",     status:"DUNNING", delivery:"Email ⚠"  },
  { id:"INV-2601-0007", tenant:"TZ-CARGO",  plan:"UKO Pro",  period:"Jan", amount:"TZS 1.9M",    status:"SENT",    delivery:"WA ✓"    },
  { id:"INV-2601-0002", tenant:"GH-FLEET",  plan:"UKO Pro",  period:"Jan", amount:"GHS 22,000",   status:"PAID",    delivery:"Email ✓"  },
];

const TABS = ["Invoices","Billing Plans","Credit Notes","Disputes","Trash"];

const LINE_ITEMS = [
  { label:"Subscription (UKO Pro)",       value:"UGX 1.80M" },
  { label:"Tokens — Maps API (overage)",  value:"UGX 420k"  },
  { label:"Tokens — WhatsApp msgs",       value:"UGX 60k"   },
  { label:"VAT",                          value:"UGX 60k"   },
];

// ─── Page ────────────────────────────────────────────────────────────────────
export function InvoicingPage() {
  const [activeTab, setActiveTab] = useState("Invoices");
  const [selectedId, setSelectedId] = useState("INV-2601-0041");
  const [modalOpen, setModalOpen] = useState(false);

  const selected = INVOICES.find(i => i.id === selectedId) ?? INVOICES[0];

  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden relative">

      {/* ── Left: Main Content ────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-3 p-3">

          <SampleDataNotice />

          {/* Header */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <div className="text-[10px] text-[#667781] mb-0.5">SCREEN 06 · BILLING BRIDGE · Billing &amp; Invoicing · TOP SCROLL</div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-black text-[16px] text-[#111B21]">Billing &amp; Invoicing</div>
                <div className="text-[11px] text-[#667781] mt-0.5">Unified invoicing + tokens reconciliation + dunning + audit (WhatsApp/Email/SMS)</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Pill color="green">+ New Invoice</Pill>
                <Pill>Send Reminder</Pill>
                <Pill>Export</Pill>
              </div>
            </div>
          </div>

          {/* ════════════════════ TOP SCROLL ════════════════════════════ */}

          {/* 4 KPIs */}
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Invoices (24h)" value="312"   delta="+6%"          dot="bg-[#25D366]" />
            <KpiCard label="Overdue"         value="41"    delta="Aging ↑"      dot="bg-[#F97316]" />
            <KpiCard label="Delivery success"value="98.3%" delta="WA 99%"       dot="bg-[#25D366]" />
            <KpiCard label="Recon mismatches"value="7"     delta="Needs review" dot="bg-[#FBBF24]" />
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {TABS.map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`h-8 px-3.5 rounded-full text-[12px] font-black border cursor-pointer transition-all ${activeTab === t ? "bg-[#128C7E]/10 border-[#128C7E]/30 text-[#128C7E]" : "bg-white border-[#E9EDEF] text-[#667781] hover:bg-[#F8FAFC]"}`}>{t}</button>
            ))}
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {["Status: Overdue","Currency: UGX","Channel: WhatsApp","Plan: UKO/PIKI","Period: Jan 2026"].map(f => (
              <span key={f} className="h-7 px-3 rounded-full bg-white border border-[#E9EDEF] text-[11px] text-[#111B21] font-black flex items-center">{f}</span>
            ))}
            <span className="h-7 px-3 rounded-full bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] text-[#667781] font-black flex items-center cursor-pointer">Reset</span>
          </div>

          {/* Invoice Worklist */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
            <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full text-[12px] min-w-[800px]">
              <thead><tr className="border-b-2 border-[#128C7E]/30">
                {["Invoice","Tenant","Plan","Period","Amount","Status","Delivery"].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-black text-[#128C7E]">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {INVOICES.map(inv => (
                  <tr key={inv.id} onClick={() => setSelectedId(inv.id)} className={`border-b border-[#E9EDEF] last:border-0 cursor-pointer transition-colors ${selectedId === inv.id ? "bg-[#128C7E]/5" : "hover:bg-[#F8FAFC]"}`}>
                    <td className="px-3 py-2.5 font-black text-[#111B21]">{inv.id}</td>
                    <td className="px-3 py-2.5 text-[#111B21]">{inv.tenant}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{inv.plan}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{inv.period}</td>
                    <td className="px-3 py-2.5 font-black text-[#111B21]">{inv.amount}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${stColor[inv.status] ?? "bg-[#E9EDEF] text-[#667781]"}`}>{inv.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[#667781]">{inv.delivery}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* ════════════════════ MID / BOTTOM ══════════════════════════ */}

          {/* 2-col: Dunning | Waswa AI */}
          <div className="grid grid-cols-2 gap-3">
            {/* Dunning & Service Cut-Off */}
            <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="font-black text-[13px] text-[#111B21]">Dunning &amp; Service Cut-Off</div>
                  <div className="text-[11px] text-[#667781] mt-0.5">Automation with Human-in-the-Loop gating</div>
                </div>
              </div>
              <div className="text-[12px] text-[#111B21] leading-relaxed mb-3">
                <div>• Stage 1: Reminder (T+1) → WA/Email</div>
                <div>• Stage 2: Final notice (T+7) → HIC approval required</div>
                <div>• Stage 3: Suspend services (T+14) → Dual-control</div>
              </div>
              <span className="inline-block px-3 py-1 rounded-full bg-[#FBBF24]/15 border border-[#FBBF24]/30 text-[11px] font-black text-[#92400E]">HIC Queue: 3</span>
            </div>

            {/* Waswa AI Billing Insights */}
            <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-black text-[13px] text-[#111B21]">Waswa AI — Billing Insights</div>
                <span className="px-2 py-0.5 rounded-full bg-[#34B7F1]/15 border border-[#34B7F1]/30 text-[10px] font-black text-[#34B7F1]">Explain</span>
              </div>
              <div className="text-[12px] text-[#111B21] leading-relaxed mb-1">
                <div className="font-black">Recon gap detected: INV-2601-0041</div>
                <div className="text-[#667781] mt-1">Likely cause: Token overage not billed (Maps API).</div>
                <div className="text-[#667781]">Suggested action: Run 'Token→Invoice reconcile' job.</div>
              </div>
              <div className="flex gap-2 mt-3">
                <Pill>Create ticket</Pill>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* ── Right: Invoice Detail Panel ───────────────────────────── */}
      <aside className="w-[380px] shrink-0 bg-white border-l border-[#E9EDEF] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-4 flex flex-col gap-3">

        {/* Invoice Details */}
        <div className="border border-[#E9EDEF] rounded-xl p-4">
          <div className="font-black text-[14px] text-[#111B21]">Invoice Details</div>
          <div className="text-[11px] text-[#667781] mt-0.5">{selected.id} · {selected.tenant}</div>
          <div className="flex gap-2 mt-2.5">
            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black ${stColor[selected.status] ?? "bg-[#E9EDEF] text-[#667781]"}`}>{selected.status}</span>
            <span className="inline-block px-2.5 py-1 rounded-full bg-[#25D366]/15 border border-[#25D366]/30 text-[10px] font-black text-[#25D366]">WA SENT</span>
          </div>
          <div className="mt-3">
            <div className="text-[11px] text-[#667781]">Amount</div>
            <div className="font-black text-[22px] text-[#111B21] leading-tight">UGX 2,340,000</div>
          </div>
          <div className="mt-2">
            <div className="text-[11px] text-[#667781]">Period</div>
            <div className="text-[12px] text-[#111B21]">2026-01-01 → 2026-01-31</div>
          </div>
        </div>

        {/* Line Items */}
        <div className="border border-[#E9EDEF] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E9EDEF]">
            <div className="font-black text-[13px] text-[#111B21]">Line Items</div>
          </div>
          <div className="p-4 flex flex-col gap-2">
            {LINE_ITEMS.map(li => (
              <div key={li.label} className="flex items-center justify-between text-[12px]">
                <span className="text-[#111B21]">{li.label}</span>
                <span className="font-black text-[#111B21]">{li.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Pill color="green">Resend WhatsApp</Pill>
          <Pill>Send Email</Pill>
          <Pill onClick={() => setModalOpen(true)}>Issue Credit Note</Pill>
        </div>

        {/* Audit Trail */}
        <div className="border border-[#E9EDEF] rounded-xl p-4">
          <div className="font-black text-[13px] text-[#111B21] mb-2">Audit Trail</div>
          <div className="text-[12px] text-[#111B21] leading-relaxed">
            <div>• 11:02 — Reminder sent (WA) by sysadmin</div>
            <div>• 11:04 — Recon mismatch flagged by Waswa</div>
            <div className="text-[#667781]">• 11:06 — HIC approval requested (cut-off)</div>
          </div>
        </div>

        {/* Billing Plan Governance */}
        <div className="border border-[#E9EDEF] rounded-xl p-4">
          <div className="font-black text-[13px] text-[#111B21] mb-2">Billing Plan Governance</div>
          <div className="text-[11px] text-[#667781] mb-2">Wialon-style plan entitlements + limits</div>
          <div className="flex flex-col gap-2">
            {[
              { k:"History retention",     v:"365 days",       tone:"bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30" },
              { k:"Trip Playback exports", v:"HITL threshold 200 trips", tone:"bg-[#FBBF24]/15 text-[#92400E] border border-[#FBBF24]/30" },
              { k:"Maps API daily cap",    v:"Near limit",     tone:"bg-[#F97316]/15 text-[#F97316] border border-[#F97316]/30" },
            ].map(r => (
              <div key={r.k} className="flex items-center justify-between text-[12px]">
                <span className="text-[#111B21]">{r.k}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${r.tone}`}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Modal: HIC Approval Required ─────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/35 z-50 grid place-items-center" onClick={() => setModalOpen(false)}>
          <div className="w-[min(700px,calc(100vw-24px))] max-h-[calc(100vh-24px)] bg-white rounded-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E9EDEF] shrink-0">
              <div className="font-black text-[18px] text-[#111B21]">HIC Approval Required</div>
              <div className="text-[12px] text-[#667781] mt-0.5">Action: Suspend services for tenant UKO OLIWA (Stage 3)</div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-6">
              {/* Warning banner */}
              <div className="bg-[#FEF3C7] border border-[#FBBF24]/30 rounded-xl p-4 mb-4">
                <div className="text-[12px] text-[#92400E]">Dual-control: requires 2 approvers. Suspension triggers device command freeze.</div>
              </div>

              {/* Checklist */}
              <div className="border border-[#E9EDEF] rounded-xl p-4 mb-4">
                <div className="font-black text-[14px] text-[#111B21] mb-3">Checklist</div>
                <div className="flex flex-col gap-2.5 text-[12px] text-[#111B21]">
                  <div>☑ Invoice INV-2601-0041 overdue by 14 days</div>
                  <div>☑ Dunning Stage 2 complete (final notice sent)</div>
                  <div>☑ Customer contacted: WA + Email</div>
                  <div>☑ Recon mismatch resolved OR accepted as risk</div>
                  <div>☑ Rollback plan documented</div>
                </div>
              </div>

              {/* Reason / Notes */}
              <div className="border border-[#E9EDEF] rounded-xl p-4">
                <div className="font-black text-[14px] text-[#111B21] mb-2">Reason / Notes (logged)</div>
                <input placeholder="e.g., customer confirmed payment date; proceed with 24h grace…" className="w-full h-9 rounded-lg border border-[#E9EDEF] px-3 text-[12px] text-[#111B21] outline-none focus:border-[#128C7E]/50" />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-center gap-3 px-6 py-3 border-t border-[#E9EDEF] bg-white shrink-0">
              <button onClick={() => setModalOpen(false)} className="h-10 px-5 rounded-lg bg-white border border-[#E9EDEF] text-[13px] font-black text-[#111B21] cursor-pointer hover:bg-[#F8FAFC]">Cancel</button>
              <button className="h-10 px-5 rounded-lg bg-white border border-[#128C7E]/30 text-[13px] font-black text-[#128C7E] cursor-pointer hover:bg-[#128C7E]/5">Request Co-Approve</button>
              <button onClick={() => setModalOpen(false)} className="h-10 px-5 rounded-lg bg-[#25D366] text-[#075E54] text-[13px] font-black border-none cursor-pointer hover:brightness-105">Approve</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reusable Components ─────────────────────────────────────────────────────
const pillStyles: Record<string, string> = {
  green: "bg-[#25D366] text-[#075E54]",
  dark:  "bg-[#075E54] text-white",
  ghost: "bg-white border border-[#E9EDEF] text-[#667781]",
};

function Pill({ color = "ghost", onClick, children }: { color?: string; onClick?: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`h-7 px-3 rounded-full text-[11px] font-black border-none cursor-pointer hover:brightness-105 active:opacity-85 transition-all whitespace-nowrap ${pillStyles[color] ?? pillStyles.ghost}`}>{children}</button>;
}

function KpiCard({ label, value, delta, dot }: { label: string; value: string; delta: string; dot: string }) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] text-[#667781]">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[22px] font-black text-[#111B21] leading-tight">{value}</span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span className="text-[11px] text-[#667781]">{delta}</span>
      </div>
    </div>
  );
}