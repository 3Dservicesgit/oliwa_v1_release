/**
 * AlarmFactoryPage — Screen 04: NAVAS ALARM FACTORY — Alarm Center
 *
 * Rebuilt to match v26 mockup screenshots pixel-accurately:
 *   TOP SCROLL:    6 LIVE KPI cards → Auto-correlation → Live Alerts table
 *   MID SCROLL:    Rules Library → Correlation Clusters + Costs → VEBA Governance
 *   BOTTOM SCROLL: Incident Timeline → Delivery Audit + Trash → Runbooks
 *   MODALS:        Create Rule (7-tab HITL wizard)
 *
 * Right panel: WaswaTriagePanel (shared component, already matches mockup)
 */
import React, { useState } from "react";
import { SampleDataNotice } from "../../components/ui";
import { WaswaTriagePanel, useWaswa } from "../../components/waswa";

// ─────────────────────────────────────────────────────────────────────────────
// Colour helpers
// ─────────────────────────────────────────────────────────────────────────────
const sevDot: Record<string, string> = {
  P1: "bg-[#EF4444]", P2: "bg-[#F97316]", P3: "bg-[#FBBF24]", P4: "bg-[#25D366]",
};
const sevText: Record<string, string> = {
  P1: "text-[#EF4444] font-extrabold", P2: "text-[#F97316] font-extrabold",
  P3: "text-[#FBBF24] font-extrabold", P4: "text-[#25D366] font-extrabold",
};
const statusCls: Record<string, string> = {
  Unacked: "bg-[#FFEBEE] text-[#C62828]", Ack: "bg-[#EAFBEF] text-[#1A7A3A]",
};
const costCls: Record<string, string> = {
  H: "bg-[#128C7E] text-white", M: "bg-[#F97316] text-white", L: "bg-[#FBBF24] text-[#111]",
};
const clusterCls: Record<string, string> = {
  A: "bg-[#128C7E]", B: "bg-[#F97316]", C: "bg-[#FBBF24]",
};

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data — matches mockup screenshots exactly
// ─────────────────────────────────────────────────────────────────────────────
const KPI_CARDS = [
  { label: "P1 Critical",        value: "3",           sub: "Unacked > 30m"  },
  { label: "P2 Alarm",           value: "19",          sub: "Unacked > 10m"  },
  { label: "Noise Index",        value: "41/unit/day", sub: "Target < 20"    },
  { label: "Delivery Fail",      value: "6.2%",        sub: "WhatsApp/SMS"   },
  { label: "Token Burn (alerts)",value: "0.11 TK/s",   sub: "Messaging costs"},
  { label: "VEBA Leakage",       value: "↑ 12%",       sub: "Boda sector"    },
];

const CORRELATION_BULLETS = [
  { label: "Revenue leakage risk:", text: "VEBA Boda: contact unlocks +32% WoW; bookings -11% (possible offline bypass)." },
  { label: "System health impact:", text: "Kafka lag peaked at 6.4s (12:57) causing alert delays; now stable 1.2s." },
  { label: "Tokenized billing:",    text: "Messaging bundle burn ↑; route P3/P4 to digest to control spend." },
  { label: "Action:",               text: "Promote Leakage Guard to 🔴 Critical + enable HITL approval for suspensions." },
];

const LIVE_ALERTS = [
  { sev:"P1", time:"13:38", product:"VEBA",  tenant:"Acme/Boda",   asset:"BODA-019", trigger:"Leakage Guard: contact shared pre-b…", status:"Unacked", cost:"H" },
  { sev:"P2", time:"13:37", product:"OLIWA", tenant:"Acme/Trucks", asset:"KDH-221X", trigger:"Fuel Drop > 18L (engine off)",          status:"Ack",     cost:"M" },
  { sev:"P2", time:"13:36", product:"CORE",  tenant:"Platform",    asset:"Kafka",    trigger:"Consumer lag > 5s",                     status:"Unacked", cost:"L" },
  { sev:"P3", time:"13:33", product:"PAY",   tenant:"Acme",        asset:"MTN-UG",   trigger:"Webhook retries > 30",                  status:"Ack",     cost:"M" },
  { sev:"P3", time:"13:30", product:"PIKI",  tenant:"Acme/Boda",   asset:"PIK-044",  trigger:"Overspeed > 90kph (3m)",                status:"Unacked", cost:"L" },
  { sev:"P3", time:"13:29", product:"VEBA",  tenant:"Acme/Dozers", asset:"D8-004",   trigger:"Tender timeout > 2m (no driver)",       status:"Unacked", cost:"M" },
  { sev:"P4", time:"13:28", product:"CORE",  tenant:"Platform",    asset:"API",      trigger:"5xx > 1% (p95 1.4s)",                   status:"Ack",     cost:"L" },
];

const RULES = [
  { name:"Leakage Guard (VEBA)",   family:"billing", sev:"P1", channel:"WA+InApp", hitl:true  },
  { name:"Fuel Theft — Drop",      family:"fuel",    sev:"P2", channel:"WA+SMS",   hitl:true  },
  { name:"Offline Spike Detector", family:"conn",    sev:"P2", channel:"InApp",    hitl:false },
  { name:"Overspeed (PIKI)",       family:"safety",  sev:"P3", channel:"InApp",    hitl:false },
  { name:"SIM Roaming w/o Pack",   family:"conn",    sev:"P3", channel:"InApp",    hitl:false },
  { name:"VEBA Tender Timeout",    family:"ops",     sev:"P3", channel:"InApp",    hitl:false },
  { name:"WhatsApp Flood Guard",   family:"msg",     sev:"P2", channel:"WA",       hitl:false },
  { name:"API 5xx Threshold",      family:"infra",   sev:"P2", channel:"InApp",    hitl:false },
];

const CLUSTERS = [
  { id:"A", title:"Kafka lag → alert delays",          impact:"Impact: P2 spikes"  },
  { id:"B", title:"Leakage Guard → booking drop",      impact:"Impact: VEBA margin"},
  { id:"C", title:"MTN retry queue → token top-ups",   impact:"Impact: churn risk" },
];

const INCIDENTS = [
  { sev:"P1", time:"13:38", title:"P1 Leakage Guard triggered (VEBA Boda)", sub:"HITL pending: suspend listing?" },
  { sev:"P2", time:"13:36", title:"Kafka lag crossed 5s threshold",          sub:"AI suggests autoscale consumers" },
  { sev:"P3", time:"13:33", title:"MTN retry queue 42",                      sub:"Auto-retry + notify finance" },
  { sev:"P3", time:"13:29", title:"Tender timeout for D8-004",               sub:"" },
];

const DELIVERY = [
  { channel:"WhatsApp", success:"95.2%", latency:"2.8s" },
  { channel:"SMS",      success:"91.0%", latency:"5.1s" },
  { channel:"In-app",   success:"99.3%", latency:"0.9s" },
];

const TRASH = [
  { name:"WhatsApp Flood Guard", age:"2d"  },
  { name:"Old Fuel Rule v1",     age:"6d"  },
  { name:"Legacy SIM Alert",     age:"12d" },
];

const RUNBOOKS = [
  { title:"Kafka Lag Spike",            steps:"Scale consumers • check broker disk • verify topic partitions • notify on-call" },
  { title:"VEBA Leakage Spike",         steps:"Enable contact gating • enforce escrow • flag repeat offenders • soft suspensions (HITL)" },
  { title:"Mobile Money Callback Gap",  steps:"Inspect webhook queue • replay callbacks • credit tokens idempotently • issue receipt" },
  { title:"Alarm Fatigue",              steps:"Reduce noisy rules • shift P3/P4 to digest • cap WhatsApp sends per unit/day" },
];

const MODAL_TABS = ["Basics","Trigger","Conditions","Channels","Token Cost","Escalation","Audit"];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export function AlarmFactoryPage() {
  const [createRuleOpen, setCreateRuleOpen] = useState(false);
  const [modalTab, setModalTab] = useState("Conditions");
  const waswa = useWaswa();

  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">

      {/* ── Main scrollable content ─────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-3 p-3">

          <SampleDataNotice />

          {/* ── Page Header ──────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <nav className="text-[11px] text-[#667781] mb-1">Home &rsaquo; Ops &rsaquo; Alarm Center &rsaquo; Rules + Alerts + Incidents</nav>
            <div className="font-black text-[16px] text-[#111B21]">
              NAVAS ALARM FACTORY — Alarm Center
            </div>
            <div className="flex gap-2 flex-wrap mt-2">
              <Pill color="green" onClick={() => setCreateRuleOpen(true)}>+ New Rule</Pill>
              <Pill color="azure">Edit → Save</Pill>
              <Pill>Move to Trash</Pill>
              <Pill>Trash → Restore</Pill>
              <Pill>Export</Pill>
            </div>
          </div>

          {/* ════════════════════ TOP SCROLL ════════════════════════════════════ */}

          {/* ── 6 KPI Cards (3 + 3) ──────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            {KPI_CARDS.map((c) => (
              <div key={c.label} className="bg-white border border-[#E9EDEF] rounded-xl p-4 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[#667781] font-extrabold">{c.label}</span>
                  <span className="text-[9px] font-black bg-[#25D366] text-white px-2 py-0.5 rounded-full">LIVE</span>
                </div>
                <div className="text-[26px] font-black text-[#111B21] mt-1 leading-tight">{c.value}</div>
                <div className="text-[11px] text-[#667781] mt-0.5">{c.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Waswa AI Auto-correlation ─────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E9EDEF]">
              <span className="font-black text-[13px] text-[#111B21]">Waswa AI: What changed? (Auto-correlation)</span>
              <span className="text-[10px] font-black bg-[#25D366] text-white px-3 py-1 rounded-full">Auto</span>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2">
              {CORRELATION_BULLETS.map((b, i) => (
                <div key={i} className="flex gap-2 text-[12px] leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#128C7E] shrink-0 mt-[7px]" />
                  <span><strong className="text-[#111B21]">{b.label}</strong>{" "}<span className="text-[#667781]">{b.text}</span></span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Live Alerts Table ─────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E9EDEF]">
              <span className="font-black text-[13px] text-[#111B21]">Live Alerts (Rules + Incidents)</span>
              <div className="flex gap-2">
                <Pill>Ack All (low)</Pill>
                <Pill>Snooze</Pill>
                <Pill color="teal">Create Incident</Pill>
              </div>
            </div>
            <table className="w-full text-[12px] table-fixed">
              <colgroup>
                <col className="w-[52px]" />   {/* Sev */}
                <col className="w-[50px]" />   {/* Time */}
                <col className="w-[60px]" />   {/* Product */}
                <col className="w-[90px]" />   {/* Tenant */}
                <col className="w-[76px]" />   {/* Asset */}
                <col />                         {/* Trigger — fills remaining */}
                <col className="w-[68px]" />   {/* Status */}
                <col className="w-[42px]" />   {/* Cost */}
              </colgroup>
              <thead>
                <tr className="bg-[#F8F9FA] border-b border-[#E9EDEF]">
                  {["Sev","Time","Product","Tenant","Asset","Trigger","Status","Cost"].map(h => (
                    <th key={h} className="text-left px-2 py-2.5 text-[11px] font-extrabold text-[#667781] whitespace-nowrap overflow-hidden">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LIVE_ALERTS.map((a, i) => (
                  <tr key={i} className="border-b border-[#E9EDEF] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${sevDot[a.sev]}`} />
                        <span className={sevText[a.sev]}>{a.sev}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[#667781] whitespace-nowrap">{a.time}</td>
                    <td className="px-2 py-2.5 font-extrabold text-[#111B21] truncate">{a.product}</td>
                    <td className="px-2 py-2.5 text-[#667781] truncate">{a.tenant}</td>
                    <td className="px-2 py-2.5 font-mono text-[#111B21] truncate">{a.asset}</td>
                    <td className="px-2 py-2.5 text-[#667781] truncate">{a.trigger}</td>
                    <td className="px-2 py-2.5">
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full whitespace-nowrap ${statusCls[a.status]}`}>{a.status}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className={`w-6 h-6 rounded-full text-[10px] font-black inline-grid place-items-center ${costCls[a.cost]}`}>{a.cost}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ════════════════════ MID SCROLL ════════════════════════════════════ */}
          {/* 2-col: Rules Library (left) │ Clusters + Costs + VEBA (right) */}
          <div className="grid grid-cols-[1.1fr_0.9fr] gap-3">

            {/* ── LEFT: Rules Library ──────────────────────────────────────────── */}
            <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-[#E9EDEF]">
                <div className="font-black text-[13px] text-[#111B21]">Rules Library (Templates + Overrides)</div>
                <div className="text-[11px] text-[#667781] mt-0.5">Tip: Tune weekly to reduce fatigue. Any pricing/penalty rule → HITL.</div>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E9EDEF]">
                <div className="flex gap-2">
                  <Pill color="green" onClick={() => setCreateRuleOpen(true)}>+ New Rule</Pill>
                  <Pill>Import</Pill>
                  <Pill>Bulk Edit</Pill>
                  <Pill>Trash (12)</Pill>
                </div>
                <span className="text-[11px] text-[#667781]">Scope: Acme/Boda &nbsp;&nbsp; Range: 24h</span>
              </div>
              <div className="px-4 py-2 border-b border-[#E9EDEF] bg-[#F8F9FA]">
                <span className="font-black text-[12px] text-[#111B21]">Rule Set (Wialon-style discipline)</span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[#E9EDEF] bg-[#F8F9FA]">
                    {["Rule","Family","Sev","Channel","HITL",""].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-[11px] font-extrabold text-[#667781]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RULES.map((r, i) => (
                    <tr key={i} className="border-b border-[#E9EDEF] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${sevDot[r.sev]}`} />
                          <span className="font-extrabold text-[#111B21]">{r.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[#667781]">{r.family}</td>
                      <td className="px-3 py-2.5"><span className={sevText[r.sev]}>{r.sev}</span></td>
                      <td className="px-3 py-2.5 text-[#667781]">{r.channel}</td>
                      <td className="px-3 py-2.5">
                        {r.hitl && <span className="text-[9px] font-extrabold bg-[#34B7F1] text-white px-1.5 py-0.5 rounded-full">HITL</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button className="text-[#667781] hover:text-[#111B21] text-[14px] leading-none border-none bg-transparent cursor-pointer">⋮</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── RIGHT: Clusters + Costs + VEBA stacked ───────────────────────── */}
            <div className="flex flex-col gap-3">

              {/* Correlation Clusters */}
              <div className="bg-white border border-[#E9EDEF] rounded-xl">
                <div className="px-4 py-3 border-b border-[#E9EDEF] font-black text-[13px] text-[#111B21]">
                  Correlation Clusters (Root Cause)
                </div>
                <div className="px-4 py-3 flex flex-col gap-4">
                  {CLUSTERS.map(c => (
                    <div key={c.id} className="flex items-start gap-3">
                      <span className={`text-[10px] font-black text-white px-2 py-1 rounded-md shrink-0 ${clusterCls[c.id]}`}>Cluster {c.id}</span>
                      <div>
                        <div className="font-extrabold text-[12px] text-[#111B21]">{c.title}</div>
                        <div className="text-[11px] text-[#667781] mt-0.5">{c.impact}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tokenized Alerting Costs */}
              <div className="bg-white border border-[#E9EDEF] rounded-xl">
                <div className="px-4 py-3 border-b border-[#E9EDEF]">
                  <div className="font-black text-[13px] text-[#111B21]">Tokenized Alerting Costs (PAYG)</div>
                  <div className="text-[11px] text-[#667781] mt-0.5">Burn drivers: WhatsApp templates, SMS, AI summaries, evidence…</div>
                </div>
                <div className="px-4 py-3">
                  <div className="h-4 rounded-full overflow-hidden flex mb-3">
                    <div className="bg-[#25D366] h-full" style={{width:"45%"}} />
                    <div className="bg-[#F97316] h-full" style={{width:"20%"}} />
                    <div className="bg-[#34B7F1] h-full" style={{width:"25%"}} />
                    <div className="bg-[#E9EDEF] h-full flex-1" />
                  </div>
                  <div className="flex flex-col gap-1.5 text-[12px]">
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#25D366]" /><span className="text-[#111B21]">WhatsApp: 45%</span></div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#F97316]" /><span className="text-[#111B21]">SMS: 20%</span></div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#34B7F1]" /><span className="text-[#111B21]">AI Summary: 25%</span></div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Pill color="teal">Top-up Tokens</Pill>
                    <Pill color="teal">Bundle Suggest</Pill>
                  </div>
                </div>
              </div>

              {/* VEBA Governance */}
              <div className="bg-white border border-[#E9EDEF] rounded-xl">
                <div className="px-4 py-3 border-b border-[#E9EDEF] font-black text-[13px] text-[#111B21]">
                  VEBA Governance: Assignment &amp; Tendering
                </div>
                <div className="px-4 py-3 flex flex-col gap-3">
                  {[
                    { n:"1", title:"Request enters queue",  sub:"Hirer pays escrow (MoMo/Tokens)" },
                    { n:"2", title:"AI ranks operators",    sub:"distance + rating + availability" },
                  ].map(s => (
                    <div key={s.n} className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-full bg-[#128C7E] text-white text-[12px] font-black grid place-items-center shrink-0">{s.n}</span>
                      <div>
                        <div className="font-extrabold text-[12px] text-[#111B21]">{s.title}</div>
                        <div className="text-[11px] text-[#667781]">{s.sub}</div>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-1">
                    <Pill color="teal">Open VEBA Ops</Pill>
                    <Pill color="teal">Edit Tender Rules</Pill>
                  </div>
                  <div className="text-[10px] text-[#667781] italic">if no accept &lt; 2m → escalate</div>
                </div>
              </div>
            </div>
          </div>

          {/* ════════════════════ BOTTOM SCROLL ═════════════════════════════════ */}

          {/* ── Incident Timeline ─────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl">
            <div className="px-4 py-3 border-b border-[#E9EDEF]">
              <div className="font-black text-[13px] text-[#111B21]">Incident Timeline (P1/P2) + Audit Proof</div>
              <div className="text-[11px] text-[#667781] mt-0.5">Irrefutable logging: acknowledgements, snoozes, penalties are hash-chained.</div>
            </div>
            <div className="px-4 py-3 flex flex-col gap-0">
              {INCIDENTS.map((inc, i) => (
                <div key={i} className="flex items-start gap-3 py-2.5 border-b border-[#E9EDEF] last:border-0">
                  <span className={`w-3 h-3 rounded-full shrink-0 mt-0.5 ${sevDot[inc.sev]}`} />
                  <span className="text-[12px] font-mono text-[#667781] shrink-0 w-[42px]">{inc.time}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-[12px] text-[#111B21]">{inc.title}</div>
                    {inc.sub && <div className="text-[11px] text-[#667781] mt-0.5">{inc.sub}</div>}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 mt-3 justify-end">
                <Pill color="teal">Generate Postmortem</Pill>
                <Pill color="teal">Export PDF</Pill>
              </div>
            </div>
          </div>

          {/* ── Delivery Audit + Trash (2-col) ───────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">

            {/* Delivery Audit */}
            <div className="bg-white border border-[#E9EDEF] rounded-xl">
              <div className="px-4 py-3 border-b border-[#E9EDEF]">
                <div className="font-black text-[13px] text-[#111B21]">Delivery Audit (WhatsApp/SMS/In-app)</div>
                <div className="text-[11px] text-[#667781] mt-0.5">Success: 93.8% • Fail: 6.2% • Cost today: 1,210 TK</div>
              </div>
              <div className="px-4 py-3">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[#E9EDEF]">
                      {["Channel","Success","Latency"].map(h => (
                        <th key={h} className="text-left py-2 text-[11px] font-extrabold text-[#667781]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DELIVERY.map((d) => (
                      <tr key={d.channel} className="border-b border-[#E9EDEF] last:border-0">
                        <td className="py-2.5 font-extrabold text-[#111B21]">{d.channel}</td>
                        <td className="py-2.5">
                          <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${
                            parseFloat(d.success) >= 95 ? "bg-[#25D366] text-white" :
                            parseFloat(d.success) >= 93 ? "bg-[#F97316] text-white" :
                            "bg-[#EF4444] text-white"
                          }`}>{d.success}</span>
                        </td>
                        <td className="py-2.5 text-[#667781]">{d.latency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3">
                  <Pill color="teal">Tune Noise Rules</Pill>
                </div>
              </div>
            </div>

            {/* Trash & Restore */}
            <div className="bg-white border border-[#E9EDEF] rounded-xl">
              <div className="px-4 py-3 border-b border-[#E9EDEF]">
                <div className="font-black text-[13px] text-[#111B21]">Trash &amp; Restore (Soft Delete)</div>
                <div className="text-[11px] text-[#667781] mt-0.5">Deleted rules retained 30 days. Restore requires HITL if $$ impact.</div>
              </div>
              <div className="px-4 py-3">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[#E9EDEF]">
                      {["Deleted Item","Age",""].map((h,i) => (
                        <th key={i} className="text-left py-2 text-[11px] font-extrabold text-[#667781]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TRASH.map((t) => (
                      <tr key={t.name} className="border-b border-[#E9EDEF] last:border-0">
                        <td className="py-2.5 font-extrabold text-[#111B21]">{t.name}</td>
                        <td className="py-2.5 text-[#667781]">{t.age}</td>
                        <td className="py-2.5">
                          <span className="text-[10px] font-extrabold bg-[#F97316] text-white px-2 py-0.5 rounded-full cursor-pointer hover:brightness-110">Restore</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3">
                  <Pill color="teal">Open Audit Logs</Pill>
                </div>
              </div>
            </div>
          </div>

          {/* ── Runbooks ──────────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl">
            <div className="px-4 py-3 border-b border-[#E9EDEF] font-black text-[13px] text-[#111B21]">
              Runbooks (Actionable, East Africa-ready)
            </div>
            <div className="px-4 py-3 flex flex-col gap-3">
              {RUNBOOKS.map((rb) => (
                <div key={rb.title} className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#128C7E] text-white text-[10px] font-black grid place-items-center shrink-0">RB</span>
                  <div>
                    <div className="font-extrabold text-[12px] text-[#111B21]">{rb.title}</div>
                    <div className="text-[11px] text-[#667781] mt-0.5">{rb.steps}</div>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 mt-2 justify-end">
                <Pill color="teal">Create Runbook</Pill>
                <Pill color="teal">Assign Owner</Pill>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* ── Waswa AI Triage Blade (right panel) ─────────────────────────────── */}
      <WaswaTriagePanel waswaOn={waswa.on} onToggleWaswa={waswa.toggle} />

      {/* ── Create Rule Modal ───────────────────────────────────────────────── */}
      {createRuleOpen && (
        <div className="fixed inset-0 z-[9000] bg-[#111B21]/30 flex items-center justify-center p-4" onClick={() => setCreateRuleOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[720px] max-h-[85vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E9EDEF] shrink-0">
              <span className="font-black text-[16px] text-[#111B21]">Create Rule (HITL protected)</span>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-black bg-[#EF4444] text-white px-3 py-1 rounded-full">High-Risk</span>
                <button onClick={() => setCreateRuleOpen(false)} className="w-8 h-8 rounded-full bg-[#F0F2F5] text-[#667781] border-none cursor-pointer hover:bg-[#E9EDEF] grid place-items-center text-[16px]">✕</button>
              </div>
            </div>

            {/* Modal body: sidebar + content */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Left tab nav */}
              <div className="w-[140px] bg-[#F8F9FA] border-r border-[#E9EDEF] py-3 shrink-0 flex flex-col">
                {MODAL_TABS.map(t => (
                  <button
                    key={t}
                    onClick={() => setModalTab(t)}
                    className={`w-full text-left px-4 py-2.5 text-[13px] border-none cursor-pointer transition-colors ${
                      modalTab === t
                        ? "font-black text-[#128C7E] bg-white border-l-[3px] border-l-[#128C7E]"
                        : "font-semibold text-[#667781] bg-transparent hover:bg-[#F0F2F5]"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Right content (scrollable) */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="border border-[#E9EDEF] rounded-xl p-5">
                  <div className="text-[12px] font-extrabold text-[#667781] mb-4">Conditions (AND / OR)</div>
                  <div className="flex flex-col gap-4">
                    {[
                      { label:"Product",       value:"VEBA" },
                      { label:"Family",        value:"billing / leakage" },
                      { label:"Rule ID",       value:"ALM-VEBA-LEAK-001" },
                      { label:"Owner",         value:"SRE/Billing" },
                      { label:"Data Source",   value:"Kafka: navas.alerts + navas.usage_events" },
                      { label:"Denominator",   value:"per tenant / per active listing" },
                      { label:"Severity",      value:"🔴 Critical (P1)" },
                      { label:"HITL Required", value:"YES (approval for suspend/penalty)" },
                      { label:"Condition 1",   value:"Detect phone/WhatsApp link before booking confirmed" },
                      { label:"Condition 2",   value:"Payment attempts > 3 & escrow not funded" },
                      { label:"Condition 3",   value:"Booking conversion drop > 10% WoW (same tenant)" },
                      { label:"Condition 4",   value:"Contact unlocks > 2× baseline" },
                    ].map(f => (
                      <div key={f.label}>
                        <label className="text-[12px] font-extrabold text-[#111B21] mb-1.5 block">{f.label}</label>
                        <input
                          defaultValue={f.value}
                          className="w-full h-10 rounded-lg border border-[#E9EDEF] bg-white px-3 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E] transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#E9EDEF] bg-[#F8F9FA] shrink-0">
              <span className="text-[11px] text-[#667781]">Audit: ON • This change will be hash-chained. Approver required.</span>
              <div className="flex gap-2">
                <button onClick={() => setCreateRuleOpen(false)} className="h-9 px-4 rounded-lg bg-[#EF4444] text-white text-[12px] font-extrabold border-none cursor-pointer hover:brightness-110 transition-all">Request Approval (H)</button>
                <button onClick={() => setCreateRuleOpen(false)} className="h-9 px-4 rounded-lg bg-[#128C7E] text-white text-[12px] font-extrabold border-none cursor-pointer hover:brightness-110 transition-all">Save Draft</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pill — reusable action button
// ─────────────────────────────────────────────────────────────────────────────
const pillStyles: Record<string, string> = {
  green: "bg-[#25D366] text-[#075E54]",
  azure: "bg-[#34B7F1] text-white",
  teal:  "bg-[#128C7E] text-white",
  ghost: "bg-white border border-[#E9EDEF] text-[#667781]",
};

function Pill({ color = "ghost", onClick, children }: { color?: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3.5 rounded-full text-[12px] font-extrabold border-none cursor-pointer hover:brightness-105 active:opacity-85 transition-all whitespace-nowrap ${pillStyles[color] ?? pillStyles.ghost}`}
    >
      {children}
    </button>
  );
}