/**
 * PaymentsPage — Screen 08: MONETIZATION SWITCHBOARD
 *
 * Matches v26 mockups:
 *   TOP:    Header + 4 KPI stat cards → Provider Health Matrix → 2-col (Recent Payments | VEBA Settlement)
 *   MID:    Approval Queue → 2-col (Realtime Metering | Reconciliation & FX) → Waswa AI Recommendations
 *   BOTTOM: Audit Log + Ops Controls
 *   BLADE:  Top-up & Settlement (tabs: Token Top-up, VEBA Escrow, Refunds, Config)
 */
import React, { useState } from "react";
import { SampleDataNotice } from "../../components/ui";

// ─── Colour helpers ──────────────────────────────────────────────────────────
// const okBg    = "bg-[#25D366] text-[#053B33]";
const critBg  = "bg-[#EF4444] text-white";

const statusDot: Record<string, string> = {
  Online:   "bg-[#25D366]",
  Degraded: "bg-[#F97316]",
  Latency:  "bg-[#F97316]",
};

const resultDot: Record<string, string> = {
  Credited: "bg-[#25D366]",
  Pending:  "bg-[#FBBF24]",
  Failed:   "bg-[#EF4444]",
};

const stageDot: Record<string, string> = {
  "Awaiting Proof": "bg-[#FBBF24]",
  "Ready to Settle":"bg-[#25D366]",
  "Dispute Open":  "bg-[#EF4444]",
  "Settled":       "bg-[#25D366]",
  "KYC Pending":   "bg-[#F97316]",
};

const approvalDot: Record<string, string> = {
  "Pending Approval":"bg-[#FBBF24]",
  "Review":          "bg-[#F97316]",
  "Needs Human":     "bg-[#EF4444]",
  "Queued":          "bg-[#25D366]",
};

// ─── Mock Data ───────────────────────────────────────────────────────────────
const PROVIDERS = [
  { provider:"M-Pesa (Safaricom)", region:"KE", status:"Online",   success:"98.2%", p95:"1.1s", whFail:"0.8%", settle:"T+0"   },
  { provider:"Airtel Money",       region:"UG", status:"Degraded", success:"94.6%", p95:"2.8s", whFail:"2.6%", settle:"T+1h"  },
  { provider:"MTN MoMo",           region:"UG", status:"Online",   success:"97.4%", p95:"1.4s", whFail:"1.2%", settle:"T+15m" },
  { provider:"Airtel Money",       region:"KE", status:"Online",   success:"96.9%", p95:"1.9s", whFail:"1.5%", settle:"T+30m" },
  { provider:"Cards (DPO/Pesapal)",region:"EA", status:"Latency",  success:"92.8%", p95:"4.6s", whFail:"3.9%", settle:"T+1d"  },
  { provider:"Flutterwave",        region:"EA", status:"Online",   success:"95.1%", p95:"2.0s", whFail:"1.7%", settle:"T+2h"  },
];

const PAYMENTS = [
  { time:"10:14", channel:"M-Pesa",      ref:"MPX-8821", amount:"KES 45,000",    result:"Credited" },
  { time:"10:09", channel:"MTN MoMo",    ref:"MTN-7712", amount:"UGX 1,200,000", result:"Credited" },
  { time:"09:55", channel:"Card",        ref:"DPO-1288", amount:"USD 320",       result:"Pending"  },
  { time:"09:41", channel:"Airtel",      ref:"AIR-4401", amount:"UGX 240,000",   result:"Failed"   },
  { time:"09:30", channel:"Flutterwave", ref:"FLW-9002", amount:"KES 12,500",    result:"Credited" },
];

const VEBA_SETTLE = [
  { booking:"VEBA-B-10021", stage:"Awaiting Proof",  escrow:"KES 90,000",  payout:"—"         },
  { booking:"VEBA-E-20077", stage:"Ready to Settle", escrow:"UGX 650,000", payout:"Split 95/5"},
  { booking:"VEBA-C-30111", stage:"Dispute Open",    escrow:"KES 55,000",  payout:"Hold"      },
  { booking:"VEBA-H-50209", stage:"Settled",          escrow:"UGX 180,000", payout:"Sent"      },
  { booking:"VEBA-D-44018", stage:"KYC Pending",      escrow:"KES 12,000",  payout:"—"         },
];

const APPROVALS = [
  { action:"Manual token mint +UGX 2,000,000 (compensation)", scope:"Tenant: KLA_LOGISTICS", by:"cs.lead",      hitl:"Required", status:"Pending Approval", age:"1h 12m" },
  { action:"Refund KES 45,000 (chargeback reversal)",          scope:"Booking: VEBA-C-30111",by:"finance.ops",   hitl:"Required", status:"Review",           age:"38m"    },
  { action:"Price rule change (AI suggestion +12% peak)",      scope:"Token: VEBA-BODA",     by:"waswa.ai",      hitl:"Required", status:"Needs Human",      age:"22m"    },
  { action:"Bulk payout batch (37 owners)",                    scope:"Region: UG",           by:"veba.settle",   hitl:"Required", status:"Queued",           age:"6m"     },
];

const STREAMS = [
  { stream:"Usage Events (US-03)", kafka:"usage_events",      rate:"2,120/min" },
  { stream:"Payments Webhooks",    kafka:"payment_webhooks",   rate:"340/min"   },
  { stream:"Token Burn Ledger",    kafka:"token_ledger",       rate:"9,440/min" },
];

const WASWA_RECS = [
  { tag:"🔴", title:"Revenue leakage:", detail:"Repeated contact-sharing attempts in VEBA (Boda) before escrow. Suggest: info-gating + connection tokens." },
  { tag:"🟠", title:"Gateway tuning:",  detail:"Airtel UG latency spike correlated with webhook retries. Suggest: increase retry backoff + temporary routing to MTN for UGX." },
  { tag:"🟠", title:"Token optimization:", detail:"High burn from maps routing in Live Dispatch. Suggest: cache tiles + raise per-route token multiplier for heavy users." },
  { tag:"🟡", title:"Fraud guard:",     detail:"3 tenants show repeated \"paid not credited\" disputes. Suggest: idempotency key enforcement." },
];

const AUDIT_LOG = [
  { ts:"10:16:22", tag:"HITL_REQUEST",   detail:"Refund KES 45,000 • booking VEBA-C-30111",           who:"finance.ops" },
  { ts:"10:14:05", tag:"TOKEN_CREDIT",   detail:"Top-up credited • MPX-8821 • KES 45,000",            who:"system"      },
  { ts:"10:12:44", tag:"WEBHOOK_RETRY",  detail:"AirtelUG callback retry scheduled • id=cb_771",      who:"payments"    },
  { ts:"10:10:12", tag:"AI_FLAG",        detail:"Leakage attempt detected • masked phone number",     who:"waswa.ai"    },
  { ts:"10:08:31", tag:"SETTLEMENT_OK",  detail:"Payout sent • VEBA-H-50209 • UGX 180,000",           who:"veba.settle" },
];

const BLADE_TABS = ["Token Top-up","VEBA Escrow","Refunds","Config"];

// ─── Page ────────────────────────────────────────────────────────────────────
export function PaymentsPage() {
  const [bladeOpen, setBladeOpen] = useState(false);
  const [bladeTab, setBladeTab] = useState("Token Top-up");

  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden relative">
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-3 p-3">

          <SampleDataNotice />

          {/* ── Page Header ────────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <div className="text-[10px] font-black text-[#128C7E] bg-[#EAF7F3] border border-[#128C7E] px-2 py-0.5 rounded-full inline-block mb-1">SCREEN 08 • Tokenomics &amp; Revenue</div>
            <div className="font-black text-[16px] text-[#111B21]">Monetization Switchboard</div>
            <nav className="text-[11px] text-[#667781] mt-0.5">Tokenomics &amp; Revenue &rsaquo; Payments &amp; Mobile Money Gateways</nav>
          </div>

          {/* ── Quick Actions ──────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-2.5 flex items-center gap-2 justify-end">
            <Pill color="dark">+ New</Pill>
            <Pill color="dark">Reconcile</Pill>
            <Pill color="green" onClick={() => setBladeOpen(true)}>Top-up Tokens</Pill>
            <Pill>Export</Pill>
          </div>

          {/* ════════════════════ TOP SCROLL ════════════════════════════════════ */}

          {/* ── 4 KPI Stat Cards ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard id="TOK-01" title="Token Treasury (FIFO)" dotColor="bg-[#25D366]" rows={[
              { k:"Pool Balance",     v:"12,450,900" },
              { k:"Burn Rate",        v:"2.4 tok/s"  },
              { k:"Run-out Forecast", v:"3d 4h",       tone:"text-[#F97316]" },
              { k:"Unbilled Backlog", v:"UGX 4.2M",    tone:"text-[#128C7E]" },
            ]} chart />
            <StatCard id="PAY-01" title="Gateway Health" dotColor="bg-[#F97316]" rows={[
              { k:"Success Rate (24h)",  v:"96.8%"  },
              { k:"Webhook Failures",    v:"1.9%",    tone:"text-[#F97316]" },
              { k:"Settlement Delay p95",v:"38m",     tone:"text-[#F97316]" },
              { k:"Retry Queue Depth",   v:"124",     tone:"text-[#EF4444]" },
            ]} chart />
            <StatCard id="VEBA-01" title="VEBA Escrow & Settlement" dotColor="bg-[#25D366]" rows={[
              { k:"Escrow Balance",    v:"KES 18.4M" },
              { k:"In-flight Bookings",v:"214"       },
              { k:"Disputes Aging >7d",v:"12"        },
              { k:"Leakage Prevented", v:"UGX 3.1M"  },
            ]} />
            <StatCard id="AI-01" title="Waswa AI Revenue Guard" dotColor="bg-[#34B7F1]" rows={[
              { k:"Insights Today",  v:"7"   },
              { k:"Auto-Resolved",   v:"41%" },
              { k:"HITL Pending",    v:"5"   },
              { k:"Fraud Flags",     v:"3",    tone:"text-[#EF4444]" },
            ]} />
          </div>

          {/* ── Provider Health Matrix ────────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E9EDEF]">
              <div className="font-black text-[13px] text-[#111B21]">Provider Health Matrix (Realtime)</div>
            </div>
            <table className="w-full text-[12px] table-fixed">
              <thead><tr className="bg-[#F8FAFC] border-b border-[#E9EDEF]">
                {["Provider","Region","Status","Success%","p95 Latency","Webhook Fail%","Settlement"].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-black text-[#667781]">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {PROVIDERS.map((p, i) => (
                  <tr key={i} className="border-b border-[#E9EDEF] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="px-3 py-2.5 font-extrabold text-[#111B21]">{p.provider}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{p.region}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${statusDot[p.status] ?? "bg-[#667781]"}`} />
                        <span className={p.status !== "Online" ? "text-[#F97316] font-black" : "text-[#111B21]"}>{p.status}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[#111B21]">{p.success}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{p.p95}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{p.whFail}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{p.settle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── 2-col: Recent Payments | VEBA Settlement ─────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E9EDEF]">
                <div className="font-black text-[13px] text-[#111B21]">Recent Top-ups &amp; Payments (24h)</div>
              </div>
              <table className="w-full text-[12px]">
                <thead><tr className="bg-[#F8FAFC] border-b border-[#E9EDEF]">
                  {["Time","Channel","Ref","Amount","Result"].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-black text-[#667781]">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {PAYMENTS.map((p, i) => (
                    <tr key={i} className="border-b border-[#E9EDEF] last:border-0">
                      <td className="px-3 py-2.5 font-mono text-[#667781]">{p.time}</td>
                      <td className="px-3 py-2.5 text-[#111B21]">{p.channel}</td>
                      <td className="px-3 py-2.5 font-mono text-[#667781]">{p.ref}</td>
                      <td className="px-3 py-2.5 font-extrabold text-[#111B21]">{p.amount}</td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${resultDot[p.result] ?? "bg-[#667781]"}`} />
                          <span className={p.result === "Failed" ? "text-[#EF4444] font-black" : "text-[#111B21]"}>{p.result}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E9EDEF]">
                <div className="font-black text-[13px] text-[#111B21]">VEBA Settlement Queue (Escrow)</div>
              </div>
              <table className="w-full text-[12px]">
                <thead><tr className="bg-[#F8FAFC] border-b border-[#E9EDEF]">
                  {["Booking","Stage","Escrow","Payout"].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-black text-[#667781]">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {VEBA_SETTLE.map(v => (
                    <tr key={v.booking} className="border-b border-[#E9EDEF] last:border-0">
                      <td className="px-3 py-2.5 font-extrabold text-[#111B21]">{v.booking}</td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${stageDot[v.stage] ?? "bg-[#667781]"}`} />
                          <span className="text-[#111B21]">{v.stage}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[#111B21]">{v.escrow}</td>
                      <td className="px-3 py-2.5 text-[#667781]">{v.payout}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ════════════════════ MID SCROLL ════════════════════════════════════ */}

          {/* ── Approval Queue ────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E9EDEF]">
              <div className="font-black text-[13px] text-[#111B21]">Approval Queue (HITL / HIC Required)</div>
            </div>
            <table className="w-full text-[12px] table-fixed">
              <thead><tr className="bg-[#F8FAFC] border-b border-[#E9EDEF]">
                {["Risk Action","Scope","Requested By","HITL","Status","Age"].map(h => (
                  <th key={h} className={`text-left px-3 py-2 font-black ${h==="Risk Action"?"text-[#F97316]":"text-[#667781]"}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {APPROVALS.map((a, i) => (
                  <tr key={i} className="border-b border-[#E9EDEF] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="px-3 py-2.5 text-[#111B21]">{a.action}</td>
                    <td className="px-3 py-2.5 text-[#667781] truncate">{a.scope}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{a.by}</td>
                    <td className="px-3 py-2.5 text-[#111B21]">{a.hitl}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${approvalDot[a.status] ?? "bg-[#667781]"}`} />
                        <span className="text-[#111B21]">{a.status}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[#667781]">{a.age}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── 2-col: Realtime Metering | Reconciliation & FX ───────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E9EDEF]">
                <div className="font-black text-[13px] text-[#111B21]">Realtime Metering &amp; Streams</div>
              </div>
              <table className="w-full text-[12px]">
                <thead><tr className="bg-[#F8FAFC] border-b border-[#E9EDEF]">
                  {["Stream","Kafka Topic","Rate"].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-black text-[#667781]">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {STREAMS.map(s => (
                    <tr key={s.stream} className="border-b border-[#E9EDEF] last:border-0">
                      <td className="px-3 py-2.5 text-[#111B21]">{s.stream}</td>
                      <td className="px-3 py-2.5 font-mono text-[#667781]">{s.kafka}</td>
                      <td className="px-3 py-2.5 text-[#111B21]">{s.rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E9EDEF]">
                <div className="font-black text-[13px] text-[#111B21]">Reconciliation &amp; FX Console</div>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between text-[12px] mb-1.5">
                  <span className="text-[#667781]">Reconciliation mismatch</span>
                  <span className="font-black text-[#EF4444]">0.48% value</span>
                </div>
                <div className="flex items-center justify-between text-[12px] mb-1.5">
                  <span className="text-[#667781]">Unbilled usage backlog age</span>
                  <span className="font-black text-[#F97316]">2h 10m</span>
                </div>
                <div className="flex items-center justify-between text-[12px] mb-3">
                  <span className="text-[#667781]">FX policy</span>
                  <span className="font-black text-[#111B21]">Per-tenant • UGX/KES/USD/EUR</span>
                </div>
                <div className="bg-[#F8FAFC] border border-[#E9EDEF] rounded-lg p-3 font-mono text-[11px] text-[#667781] leading-relaxed">
                  <div className="flex justify-between"><span>USD/UGX  3,880</span><span>EUR/UGX  4,230</span></div>
                  <div className="flex justify-between"><span>USD/KES  156.2</span><span>EUR/KES  168.5</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Waswa AI Recommendations ──────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E9EDEF]">
              <div className="font-black text-[13px] text-[#111B21]">Waswa AI • Recommendations (Human-in-Control)</div>
            </div>
            <div className="flex flex-col gap-3 p-4">
              {WASWA_RECS.map((r, i) => (
                <div key={i} className="flex gap-3 text-[12px]">
                  <span className="text-[16px] leading-none shrink-0 mt-0.5">{r.tag}</span>
                  <div>
                    <span className="font-black text-[#111B21]">{r.title}</span>{" "}
                    <span className="text-[#667781]">{r.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ════════════════════ BOTTOM SCROLL ═════════════════════════════════ */}

          {/* ── 2-col: Audit Log | Ops Controls ──────────────────────────────── */}
          <div className="grid grid-cols-[1.4fr_0.6fr] gap-3">
            <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E9EDEF]">
                <div className="font-black text-[13px] text-[#111B21]">Audit Log (Irrefutable)</div>
              </div>
              <div className="flex flex-col">
                {AUDIT_LOG.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-2.5 border-b border-[#E9EDEF] last:border-0">
                    <span className="font-mono text-[11px] text-[#667781] w-[56px] shrink-0 mt-0.5">{a.ts}</span>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded shrink-0 ${a.tag.includes("AI") ? "bg-[#F0F2F5] text-[#111B21]" : "text-[#111B21]"}`}>{a.tag}</span>
                    <span className="text-[12px] text-[#111B21] flex-1">{a.detail}</span>
                    <span className="text-[11px] text-[#667781] font-mono shrink-0">{a.who}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E9EDEF]">
                <div className="font-black text-[13px] text-[#111B21]">Ops Controls</div>
              </div>
              <div className="flex flex-col gap-3 p-4">
                {[
                  { label:"Auto-credit tokens on payment webhook", on:true  },
                  { label:"Soft cap alerts at 80% token burn budget", on:true },
                  { label:"Route payments via best-health provider (UG)", on:false },
                  { label:"Odoo ERP invoice sync (daily)",         on:true  },
                ].map(c => (
                  <div key={c.label} className="flex items-center justify-between gap-3">
                    <span className="text-[12px] text-[#111B21]">{c.label}</span>
                    <Toggle on={c.on} />
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <Pill color="green" onClick={() => setBladeOpen(true)}>Open Blade</Pill>
                  <Pill>View Runbooks</Pill>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-[#667781] italic px-1 pb-2">
            Footer: Kafka/Redis latency • uptime • token burn enforcement runs in realtime (US-03).
          </div>

        </div>
      </main>

      {/* ── Right Blade: Top-up & Settlement ──────────────────────────────── */}
      {bladeOpen && (
        <div className="w-[440px] shrink-0 bg-white border-l border-[#E9EDEF] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#E9EDEF] shrink-0">
            <div>
              <div className="font-black text-[14px] text-[#111B21]">Top-up &amp; Settlement Blade</div>
              <div className="text-[10px] text-[#667781]">Mobile Money • Cards • VEBA escrow • HITL approvals</div>
            </div>
            <button onClick={() => setBladeOpen(false)} className="w-7 h-7 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[#667781] font-black text-[13px] cursor-pointer grid place-items-center hover:bg-[#E9EDEF]">✕</button>
          </div>

          <div className="flex gap-1.5 px-5 py-2.5 border-b border-[#E9EDEF] shrink-0">
            {BLADE_TABS.map(t => (
              <button key={t} onClick={() => setBladeTab(t)} className={`h-8 px-3 rounded-full text-[11px] font-black border-none cursor-pointer transition-all ${bladeTab === t ? "bg-[#128C7E] text-white" : "bg-[#F0F2F5] text-[#667781] hover:bg-[#E9EDEF]"}`}>{t}</button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-5 py-4">
            {bladeTab === "Token Top-up" && (
              <>
                <BladeSection title="Token Top-up (HITL-Gated)">
                  <div className="grid grid-cols-2 gap-3 p-4">
                    <BField label="Tenant" value="3D Services (TOP) ▾" />
                    <BField label="Wallet Type" value="Type A (Telematics) ▾" />
                    <BField label="Product Scope" value="OLIWA / PIKI / VEBA ▾" />
                    <BField label="Currency" value="UGX ▾  (FX Auto)" />
                  </div>
                  <div className="px-4 pb-4">
                    <div className="text-[10px] font-black text-[#667781] mb-1">Top-up Amount</div>
                    <div className="font-black text-[13px] text-[#111B21]">UGX 1,200,000  (≈ 42,000 tokens)</div>
                    <div className="h-2.5 rounded-full bg-[#E9EDEF] mt-2 overflow-hidden">
                      <div className="h-full rounded-full bg-[#25D366]" style={{width:"60%"}} />
                    </div>
                  </div>
                </BladeSection>

                <BladeSection title="Payment Channel">
                  <div className="p-4 flex flex-col gap-3">
                    {["M-Pesa","MTN MoMo","Airtel Money","Cards (DPO/Pesapal)","Flutterwave"].map((c, i) => (
                      <div key={c} className="flex items-center justify-between">
                        <span className="text-[12px] text-[#111B21]">{c}</span>
                        <Toggle on={i < 2} />
                      </div>
                    ))}
                  </div>
                </BladeSection>

                <BladeSection title="Provider Details">
                  <div className="grid grid-cols-2 gap-3 p-4">
                    <BField label="MSISDN / Wallet" value="+256 7XX XXX XXX" />
                    <BField label="Reference" value="AUTO-GEN (idempotency key)" />
                  </div>
                </BladeSection>

                <BladeSection title="Safeguards (US-02 / US-03)">
                  <div className="p-4 flex flex-col gap-2.5">
                    {[
                      { k:"Daily cap",            v:"UGX 5,000,000"   },
                      { k:"Monthly cap",           v:"UGX 80,000,000"  },
                      { k:"Soft alert at 80%",     v:"Enabled"         },
                      { k:"Auto lock on critical", v:"HIC required"    },
                    ].map(s => (
                      <div key={s.k} className="flex items-center justify-between text-[12px]">
                        <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#25D366]" /><span className="text-[#111B21]">{s.k}</span></span>
                        <span className="font-black text-[#111B21]">{s.v}</span>
                      </div>
                    ))}
                  </div>
                </BladeSection>

                <BladeSection title="VEBA Escrow Release (Optional)">
                  <div className="grid grid-cols-2 gap-3 p-4">
                    <BField label="Booking ID" value="VEBA-E-20077" />
                    <BField label="Escrow Amount" value="UGX 650,000" />
                  </div>
                  <div className="px-4 pb-4">
                    <BField label="Release Condition" value="Trip completed + proof OK ▾" />
                  </div>
                </BladeSection>

                <BladeSection title="HITL Approval (Required for funds movement)">
                  <div className="grid grid-cols-2 gap-3 p-4">
                    <BField label="Approver" value="super.admin@3d.co.ug ▾" />
                    <BField label="Reason Code" value="Customer top-up / settlement" />
                  </div>
                  <div className="px-4 pb-4">
                    <div className="text-[10px] font-black text-[#667781] mb-1">Audit Note (Irrefutable)</div>
                    <textarea defaultValue="Manual top-up requested due to delayed webhook confirmation. Attach evidence. Funds release will be logged immutably." className="w-full rounded-lg border border-[#E9EDEF] bg-[#F8FAFC] p-3 text-[12px] text-[#111B21] outline-none min-h-[80px] resize-y" />
                  </div>
                </BladeSection>

                <div className="flex gap-3 mt-3">
                  <button onClick={() => setBladeOpen(false)} className="flex-1 h-10 rounded-lg bg-white border border-[#E9EDEF] text-[13px] font-black text-[#111B21] cursor-pointer hover:bg-[#F8FAFC]">Cancel</button>
                  <button className={`flex-1 h-10 rounded-lg border-none text-[13px] font-black cursor-pointer hover:brightness-110 ${critBg}`}>Submit for Approval</button>
                </div>
                <div className="text-[10px] text-[#667781] italic mt-2">Tip: Waswa AI can pre-fill refs + detect fraud patterns before you approve.</div>
              </>
            )}

            {bladeTab === "VEBA Escrow" && (
              <BladeSection title="VEBA Escrow Management">
                <div className="p-4 text-[12px] text-[#667781]">Manage escrow holds, releases, and dispute resolutions. All settlements require HITL approval for amounts above UGX 500,000.</div>
              </BladeSection>
            )}
            {bladeTab === "Refunds" && (
              <BladeSection title="Refund Processing">
                <div className="p-4 text-[12px] text-[#667781]">Process chargebacks, dispute refunds, and compensation credits. All refunds above threshold require HIC approval + immutable audit chain.</div>
              </BladeSection>
            )}
            {bladeTab === "Config" && (
              <BladeSection title="Gateway Configuration">
                <div className="p-4 text-[12px] text-[#667781]">Configure payment routing rules, webhook endpoints, retry policies, and settlement schedules per provider and region.</div>
              </BladeSection>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reusable components ─────────────────────────────────────────────────────
const pillStyles: Record<string, string> = {
  green: "bg-[#25D366] text-[#075E54]",
  dark:  "bg-[#075E54] text-white",
  ghost: "bg-white border border-[#E9EDEF] text-[#667781]",
};

function Pill({ color = "ghost", onClick, children }: { color?: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`h-7 px-3 rounded-full text-[11px] font-black border-none cursor-pointer hover:brightness-105 active:opacity-85 transition-all whitespace-nowrap ${pillStyles[color] ?? pillStyles.ghost}`}>{children}</button>
  );
}

function StatCard({ id, title, dotColor, rows, chart }: {
  id: string; title: string; dotColor: string;
  rows: { k: string; v: string; tone?: string }[];
  chart?: boolean;
}) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl p-3 relative">
      <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${dotColor}`} />
      <div className="text-[10px] font-black text-[#667781]">{id}</div>
      <div className="font-black text-[12px] text-[#111B21] mt-0.5">{title}</div>
      <div className="flex flex-col gap-1.5 mt-2">
        {rows.map(r => (
          <div key={r.k} className="flex items-center justify-between text-[11px]">
            <span className="text-[#667781]">{r.k}</span>
            <span className={`font-black ${r.tone ?? "text-[#111B21]"}`}>{r.v}</span>
          </div>
        ))}
      </div>
      {chart && (
        <div className="mt-2 h-[30px] flex items-end gap-[2px]">
          {[40,35,42,38,45,50,48,52,46,55,58,52,60,55,48,52,58,62].map((h, i) => (
            <div key={i} className="flex-1 bg-[#128C7E]/30 rounded-sm" style={{height:`${h}%`}} />
          ))}
        </div>
      )}
    </div>
  );
}

function BladeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 border border-[#E9EDEF] rounded-xl overflow-hidden bg-white">
      <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E9EDEF]">
        <div className="font-black text-[12px] text-[#111B21]">{title}</div>
      </div>
      {children}
    </div>
  );
}

function BField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-black text-[#667781] mb-1">{label}</div>
      <input defaultValue={value} className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-[#F8FAFC] px-3 text-[12px] font-black text-[#111B21] outline-none focus:border-[#128C7E]" />
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors shrink-0 ${on ? "bg-[#128C7E]" : "bg-[#D1D5DB]"}`}>
      <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all shadow-sm ${on ? "left-[22px]" : "left-0.5"}`} />
    </div>
  );
}