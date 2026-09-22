/**
 * FirmwarePage — Screen 14: PATCH ORCHESTRATOR — Firmware & OTA Manager
 *
 * Matches v26 mockups (7 screenshots):
 *   TOP:    Header + 4 KPIs → 2-col (Fleet Version Distribution | Emergency Patch Readiness)
 *           → OTA Campaigns table (5 rows)
 *   MID:    OTA table cont. → 2-col (Failure Clusters | VEBA Rental Conflict Detector)
 *           → Token & Data Cost Attribution
 *   BOTTOM: Action buttons → Guardrails → 2-col (Firmware Library | ePayment hooks)
 *           → Metrics & Limits — OTA Guardrails
 *   BLADE:  OTA Campaign detail (Registry, Billing Hooks, Approval Gate, Audit Trail)
 *   MODAL:  New OTA Campaign wizard (5 steps, Billing & Approval active)
 */
import React, { useState } from "react";
import { SampleDataNotice } from "../../components/ui";

// ─── Status badge styles ─────────────────────────────────────────────────────
const sBadge: Record<string, string> = {
  OK:    "bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30",
  WARN:  "bg-[#F97316]/15 text-[#F97316] border border-[#F97316]/30",
  ALARM: "bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30",
};
const stageBadge: Record<string, string> = {
  RUNNING:   "text-[#25D366]",
  SCHEDULED: "text-[#34B7F1]",
  PAUSED:    "text-[#F97316]",
  COMPLETED: "text-[#128C7E]",
  FAILED:    "text-[#EF4444]",
};

// ─── Mock Data ───────────────────────────────────────────────────────────────
const FLEET_VERSIONS = [
  { fw:"FMB920 v2.3.1", count:"18,420", pct:85, dot:"bg-[#25D366]" },
  { fw:"FMB920 v2.3.0", count:"1,560",  pct:15, dot:"bg-[#128C7E]" },
  { fw:"TK110 v1.9.7",  count:"8,240",  pct:55, dot:"bg-[#25D366]" },
  { fw:"Ruptela v5.4.2",count:"3,320",  pct:35, dot:"bg-[#25D366]" },
  { fw:"Unknown/Drift",  count:"420",   pct:5,  dot:"bg-[#EF4444]" },
];

const PATCH_READINESS = [
  { k:"Signed Packages", v:"Enforced",             dot:"bg-[#128C7E]" },
  { k:"Canary Pool",     v:"5% (2,140 devices)",   dot:"bg-[#128C7E]" },
  { k:"Rollback Ready",  v:"v2.3.0 available",     dot:"bg-[#128C7E]" },
  { k:"Kill Switch",     v:"ARMED (HIC)",          dot:"bg-[#F97316]" },
  { k:"Approval SLA",    v:"< 15 min (P1)",        dot:"bg-[#25D366]" },
];

const OTA_CAMPAIGNS = [
  { id:"OTA-UG-KLA-0225", model:"FMB920", fw:"2.3.1", stage:"RUNNING",   success:"96.1%", window:"22:00-04:00", tok:"12" },
  { id:"OTA-KE-NBO-0225", model:"TK110",  fw:"1.9.8", stage:"SCHEDULED", success:"—",     window:"01:00-03:00", tok:"4.2" },
  { id:"OTA-UG-GUL-0224", model:"Ruptela", fw:"5.4.2",stage:"PAUSED",    success:"92.4%", window:"23:00-02:00", tok:"8.1" },
  { id:"OTA-UG-KLA-0223", model:"FMB920", fw:"2.3.0", stage:"COMPLETED", success:"98.8%", window:"—",           tok:"10" },
  { id:"OTA-UG-MBR-0222", model:"FMB140", fw:"3.1.0", stage:"FAILED",    success:"71.2%", window:"00:00-02:00", tok:"6.3" },
];

const FAILURE_CLUSTERS = [
  { k:"CRC mismatch",  v:"FMB920 • 2.6% fail",       dot:"bg-[#EF4444]" },
  { k:"Low RSSI / 2G", v:"Rural • retries ↑",         dot:"bg-[#F97316]" },
  { k:"Battery dip",   v:"Reboots during flash",      dot:"bg-[#F97316]" },
  { k:"Storage full",  v:"Clip cache not cleared",     dot:"bg-[#FBBF24]" },
  { k:"Time drift",    v:"NTP offset > 90s",           dot:"bg-[#25D366]" },
];

const FW_LIBRARY = [
  { model:"FMB920", ver:"2.3.1", sig:"sig✓", size:"2.8MB" },
  { model:"FMB920", ver:"2.3.0", sig:"sig✓", size:"2.7MB" },
  { model:"TK110",  ver:"1.9.8", sig:"sig✓", size:"1.2MB" },
  { model:"Ruptela",ver:"5.4.2", sig:"sig✓", size:"3.6MB" },
  { model:"FMB140", ver:"3.1.0", sig:"sig✗", size:"3.1MB" },
];

const EPAY_HOOKS = [
  { name:"M-Pesa (KE)",              status:"OK",   dot:"bg-[#25D366]" },
  { name:"MTN MoMo (UG)",            status:"OK",   dot:"bg-[#25D366]" },
  { name:"Airtel Money (UG/KE)",     status:"WARN", dot:"bg-[#F97316]" },
  { name:"Card Gateway (DPO/Pesapal)", status:"OK", dot:"bg-[#25D366]" },
  { name:"Webhook backlog",          status:"12",   dot:"bg-[#F97316]" },
];

const GUARDRAILS = [
  { k:"OTA failure rate",       v:"<2% OK • >2% WARN • >5% ALARM • >10% CRITICAL" },
  { k:"Post-update offline spike", v:"ALARM if >2× baseline (10m)" },
  { k:"Devices stuck updating", v:"ALARM >30m • CRITICAL >2h" },
  { k:"Data usage during OTA",  v:"WARN if > plan cap • token burn spike >2×" },
  { k:"Emergency patch",        v:"Any deploy/rollback without approval → CRITICAL (HIC)" },
];

const BLADE_AUDIT = [
  { ts:"2026-02-25 09:12", actor:"Waswa",        action:"Suggested auto-pause (fail>2%)" },
  { ts:"2026-02-25 09:14", actor:"SYS_ADMIN",    action:"Opened evidence pack" },
  { ts:"2026-02-25 09:16", actor:"SYS_ADMIN",    action:"Requested approval (pause + canary rollback)" },
  { ts:"2026-02-25 09:18", actor:"SRE",           action:"Acknowledged (SLA 15m)" },
  { ts:"2026-02-25 09:21", actor:"Token Engine",  action:"Reserved 12.4k TKN (escrow)" },
];

const COST_ESTIMATE = [
  { k:"Data per device",  v:"2.8 MB",     note:"High variable cost" },
  { k:"Token per device", v:"5.2 TKN",    note:"includes data + retries" },
  { k:"Devices targeted", v:"2,140",      note:"canary 5%" },
  { k:"Total reserve",    v:"12.4k TKN",  note:"UGX 3.2M" },
  { k:"Soft cap",         v:"80% alert",  note:"prevent runaway spend" },
];

const PAY_CHANNELS = [
  { name:"MTN MoMo (UG)",        status:"Connected", dot:"bg-[#25D366]" },
  { name:"Airtel Money (UG/KE)", status:"Degraded",  dot:"bg-[#F97316]" },
  { name:"M-Pesa (KE)",          status:"Connected", dot:"bg-[#25D366]" },
  { name:"Card (DPO/Pesapal)",   status:"Connected", dot:"bg-[#25D366]" },
  { name:"Webhook retries",      status:"12 pending",dot:"bg-[#F97316]" },
];

// ─── Page ────────────────────────────────────────────────────────────────────
export function FirmwarePage() {
  const [bladeOpen, setBladeOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden relative">
      {/* ── Main ─────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-3 p-3">

          <SampleDataNotice />

          {/* Header */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-baseline gap-3">
                <span className="font-black text-[18px] text-[#111B21] tracking-wide">PATCH ORCHESTRATOR</span>
                <span className="text-[13px] text-[#667781]">— Firmware &amp; OTA Manager</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <Pill color="green" onClick={() => setModalOpen(true)}>+ New Campaign</Pill>
                <Pill>Upload FW</Pill>
              </div>
            </div>
          </div>

          {/* ════════════ TOP SCROLL ════════════════════════════════ */}

          {/* 4 KPIs */}
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Fleet Compliance" value="72%" sub="Target 90% • 7…" badge="WARN"  code="FW-01" />
            <KpiCard label="OTA Campaigns"    value="3"   sub="Running now"     badge="OK"    code="FW-02" />
            <KpiCard label="OTA Success (24h)" value="96.4%" sub="p95 4m • retries …" badge="OK" code="FW-03" />
            <KpiCard label="Stuck >30m"       value="42"  sub="Critical for 8 …" badge="ALARM" code="FW-04" />
          </div>

          {/* 2-col: Fleet Version Distribution | Emergency Patch Readiness */}
          <div className="grid grid-cols-2 gap-3">
            {/* Fleet Version Distribution */}
            <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
              <div className="font-black text-[13px] text-[#111B21]">Fleet Version Distribution</div>
              <div className="text-[11px] text-[#667781] mt-0.5 mb-3">Top firmware versions (last 24h pings)</div>
              {FLEET_VERSIONS.map(f => (
                <div key={f.fw} className="mb-2.5 last:mb-0">
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span className="font-black text-[#111B21]">{f.fw}</span>
                    <span className="flex items-center gap-2"><span className="text-[#667781]">{f.count}</span><span className={`w-2.5 h-2.5 rounded-full ${f.dot}`} /></span>
                  </div>
                  <div className="h-2 bg-[#F0F2F5] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${f.dot === "bg-[#EF4444]" ? "bg-[#EF4444]" : "bg-[#128C7E]"}`} style={{ width:`${f.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Emergency Patch Readiness */}
            <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
              <div className="font-black text-[13px] text-[#111B21]">Emergency Patch Readiness</div>
              <div className="text-[11px] text-[#667781] mt-0.5 mb-3">HIC controls armed • rollback packages verified</div>
              {PATCH_READINESS.map(r => (
                <div key={r.k} className="flex items-center justify-between mb-3 last:mb-0 text-[12px]">
                  <span className="flex items-center gap-2"><span className="font-black text-[#111B21]">{r.k}</span><span className="text-[#667781]">{r.v}</span></span>
                  <span className={`w-2.5 h-2.5 rounded-full ${r.dot} shrink-0`} />
                </div>
              ))}
            </div>
          </div>

          {/* OTA Campaigns */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E9EDEF]">
              <div className="font-black text-[13px] text-[#111B21]">OTA Campaigns</div>
              <div className="text-[11px] text-[#667781] mt-0.5">Phased rollouts • retries • rollback triggers • tokenized data cost</div>
            </div>
            <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full text-[12px] min-w-[900px]">
              <thead><tr className="border-b border-[#E9EDEF] bg-[#F8FAFC]">
                {["Campaign","Model","Firmware","Stage","Success","Window","Tok"].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-black text-[#667781]">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {OTA_CAMPAIGNS.map(c => (
                  <tr key={c.id} onClick={() => setBladeOpen(true)} className="border-b border-[#E9EDEF] last:border-0 hover:bg-[#F8FAFC] cursor-pointer">
                    <td className="px-3 py-2.5 font-black text-[#111B21]">{c.id}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{c.model}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{c.fw}</td>
                    <td className="px-3 py-2.5"><span className={`font-black ${stageBadge[c.stage] ?? "text-[#667781]"}`}>{c.stage}</span></td>
                    <td className="px-3 py-2.5 text-[#667781]">{c.success}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{c.window}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{c.tok}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* ════════════ MID SCROLL ════════════════════════════════ */}

          {/* 2-col: Failure Clusters | VEBA Rental Conflict Detector */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
              <div className="font-black text-[13px] text-[#111B21]">Failure Clusters (Root Cause)</div>
              <div className="text-[11px] text-[#667781] mt-0.5 mb-3">Waswa correlation groups • noise suppression • runbooks</div>
              {FAILURE_CLUSTERS.map(f => (
                <div key={f.k} className="flex items-center justify-between mb-3 last:mb-0 text-[12px]">
                  <span className="flex items-center gap-3"><span className="font-black text-[#111B21]">{f.k}</span><span className="text-[#667781]">{f.v}</span></span>
                  <span className={`w-2.5 h-2.5 rounded-full ${f.dot} shrink-0`} />
                </div>
              ))}
            </div>
            <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
              <div className="font-black text-[13px] text-[#111B21]">VEBA Rental Conflict Detector</div>
              <div className="text-[11px] text-[#667781] mt-0.5 mb-3">Prevents downtime during active bookings • auto-reschedule</div>
              <div className="border border-[#E9EDEF] rounded-xl p-3 mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-[#667781]">Conflicts next 24h</span>
                  <span className="font-black text-[20px] text-[#25D366]">12</span>
                </div>
                <div className="text-[11px] text-[#667781]">Suggested safe window: 03:30-05:00 (UGX token cost ↓</div>
              </div>
              <div className="border border-[#E9EDEF] rounded-xl p-3 mb-3">
                <div className="font-black text-[12px] text-[#111B21] mb-1">Policy</div>
                <div className="text-[11px] text-[#667781]">• Exclude assets with active escrow bookings<br/>• Require approval to auto-reschedule (HITL)</div>
              </div>
              <div className="flex gap-2">
                <button className="h-7 px-3 rounded-lg bg-[#25D366] text-[#075E54] text-[11px] font-black border-none cursor-pointer">Request Reschedule</button>
                <button className="h-7 px-3 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-[11px] font-black cursor-pointer">Disable VEBA Guard (HIC)</button>
              </div>
            </div>
          </div>

          {/* Token & Data Cost Attribution */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
            <div className="font-black text-[13px] text-[#111B21]">Token &amp; Data Cost Attribution</div>
            <div className="text-[11px] text-[#667781] mt-0.5 mb-3">Token-first monetization • FIFO wallet • multi-currency (UGX/KES/USD)</div>
            <div className="border border-[#E9EDEF] rounded-xl p-4 mb-3">
              <div className="text-[12px] font-black text-[#667781] mb-2">Estimate</div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[12px]">
                <div><span className="text-[#667781]">Data per device:</span> <span className="font-black text-[#111B21] ml-2">2.8 MB</span></div>
                <div><span className="text-[#667781]">Cap:</span> <span className="font-black text-[#111B21] ml-2">Daily 2.0M TKN • Soft 80% alert</span></div>
                <div><span className="text-[#667781]">Token burn (per device):</span> <span className="font-black text-[#111B21] ml-2">5.2 TKN</span></div>
                <div><span className="text-[#667781]">Unbilled backlog:</span> <span className="font-black text-[#25D366] ml-2">12 min (OK)</span></div>
                <div><span className="text-[#667781]">Cost floor (UGX):</span> <span className="font-black text-[#111B21] ml-2">UGX 320</span></div>
                <div><span className="text-[#667781]">Usage event topic:</span> <span className="font-black text-[#111B21] ml-2">usage_events.ota_update (Kafka)</span></div>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="h-9 px-5 rounded-lg bg-[#25D366] text-[#075E54] text-[12px] font-black border-none cursor-pointer">Open Token Engine</button>
              <button className="h-9 px-5 rounded-lg bg-[#128C7E] text-white text-[12px] font-black border-none cursor-pointer">Top-up Wallet</button>
              <button className="h-9 px-5 rounded-lg bg-[#F97316]/15 border border-[#F97316]/30 text-[#F97316] text-[12px] font-black cursor-pointer">Pause Campaigns (HITL)</button>
            </div>
          </div>

          {/* Guardrails */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
            <div className="font-black text-[13px] text-[#111B21] mb-2">Guardrails</div>
            <div className="text-[12px] text-[#111B21] leading-relaxed">
              • Any price/token rule change without approval → CRITICAL (HIC)<br/>
              • OTA failure &gt; 2% triggers auto-pause suggestion (HITL) + audit trail
            </div>
          </div>

          {/* ════════════ BOTTOM SCROLL ═════════════════════════════ */}

          {/* 2-col: Firmware Library | ePayment hooks */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E9EDEF]">
                <div className="font-black text-[13px] text-[#111B21]">Firmware Library</div>
                <div className="text-[11px] text-[#667781] mt-0.5">Signed artifacts • checksums • compatibility matrix</div>
              </div>
              <table className="w-full text-[12px]">
                <tbody>
                  {FW_LIBRARY.map((f,i) => (
                    <tr key={i} className="border-b border-[#E9EDEF] last:border-0">
                      <td className="px-3 py-2.5 font-black text-[#111B21]">{f.model}</td>
                      <td className="px-3 py-2.5 text-[#667781]">{f.ver}</td>
                      <td className="px-3 py-2.5"><span className={f.sig.includes("✓") ? "text-[#25D366]" : "text-[#EF4444]"}>{f.sig}</span></td>
                      <td className="px-3 py-2.5 text-[#667781]">{f.size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E9EDEF]">
                <div className="font-black text-[13px] text-[#111B21]">ePayment + Mobile Money Hooks</div>
                <div className="text-[11px] text-[#667781] mt-0.5">Top-ups &amp; settlements • webhook health • reconciliation</div>
              </div>
              <table className="w-full text-[12px]">
                <tbody>
                  {EPAY_HOOKS.map((e,i) => (
                    <tr key={i} className="border-b border-[#E9EDEF] last:border-0">
                      <td className="px-3 py-2.5 flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${e.dot} shrink-0`} /><span className="text-[#111B21]">{e.name}</span></td>
                      <td className="px-3 py-2.5 text-right text-[#667781]">{e.status}</td>
                      <td className="px-3 py-2.5 text-right"><span className={`w-2.5 h-2.5 rounded-full inline-block ${e.dot}`} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Metrics & Limits — OTA Guardrails */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E9EDEF]">
              <div className="font-black text-[13px] text-[#111B21]">Metrics &amp; Limits — OTA Guardrails</div>
              <div className="text-[11px] text-[#667781] mt-0.5">Configurable thresholds per product/plan/country • reduces blast radius</div>
            </div>
            <table className="w-full text-[12px]">
              <tbody>
                {GUARDRAILS.map(g => (
                  <tr key={g.k} className="border-b border-[#E9EDEF] last:border-0">
                    <td className="px-4 py-3 font-black text-[#111B21] w-[200px]">{g.k}</td>
                    <td className="px-3 py-3 text-[#667781]">{g.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </main>

      {/* ── Right: Waswa AI / Blade ──────────────────────────────── */}
      <aside className={`${bladeOpen ? "w-[440px]" : "w-[380px]"} shrink-0 bg-white border-l border-[#E9EDEF] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex flex-col`}>
        {bladeOpen ? (
          /* ── Blade: OTA Campaign Detail ─────────────────────────── */
          <>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#E9EDEF] shrink-0">
              <div>
                <span className="text-[10px] font-black bg-[#128C7E] text-white px-2 py-0.5 rounded">BLADE</span>
                <span className="font-black text-[13px] text-[#111B21] ml-2">OTA Campaign</span>
              </div>
              <button onClick={() => setBladeOpen(false)} className="w-7 h-7 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[#667781] font-black text-[13px] cursor-pointer grid place-items-center">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-5 py-4">
              {/* Registry */}
              <BSection title="Registry">
                <div className="p-4 text-[12px] text-[#111B21] leading-relaxed">
                  <div className="font-black mb-1">Firmware: FMB920 v2.3.1 (signed)</div>
                  <div>Rollout: phased 5% → 25% → 100% &ensp;| &ensp;Window: 22:00-04:00</div>
                  <div>Rollback: v2.3.0 ready &ensp;| &ensp;Retries: 2 &ensp;| &ensp;Auto-pause &gt;2% fail (HITL)</div>
                </div>
              </BSection>

              {/* Billing Hooks */}
              <BSection title="Billing Hooks (Token Engine)">
                <div className="p-4 text-[12px] text-[#111B21] leading-relaxed">
                  <div>Domain: ota_update &ensp;• &ensp;Topic: usage_events.ota_update (Kafka)</div>
                  <div>Token type: Type-A Telematics + Data bundle multipliers</div>
                  <div className="border border-[#E9EDEF] rounded-lg p-3 mt-2 text-[12px]">
                    <div><span className="text-[#667781]">Est. data/device:</span> <span className="font-black ml-2">2.8 MB</span></div>
                    <div><span className="text-[#667781]">Est. token/device:</span> <span className="font-black ml-2">5.2 TKN</span></div>
                    <div><span className="text-[#667781]">Est. total:</span> <span className="font-black ml-2">12.4k TKN (UGX 3.2M)</span></div>
                  </div>
                </div>
              </BSection>

              {/* Approval Gate */}
              <BSection title="Approval Gate (HITL/HIC)">
                <div className="p-4">
                  <div className="text-[11px] text-[#667781] mb-3">High-risk action: OTA at scale can cause downtime &amp; costs.</div>
                  {[
                    { role:"SYS_ADMIN",  status:"Pending", dot:"bg-[#F97316]" },
                    { role:"SRE On-Call", status:"Pending", dot:"bg-[#F97316]" },
                    { role:"Security",   status:"Not required (dr…)", dot:"bg-[#25D366]" },
                  ].map(a => (
                    <div key={a.role} className="flex items-center justify-between border border-[#E9EDEF] rounded-lg px-3 py-2.5 mb-2 text-[12px]">
                      <span className="font-black text-[#111B21]">{a.role}</span>
                      <span className="flex items-center gap-2 text-[#667781]">{a.status}<span className={`w-2.5 h-2.5 rounded-full ${a.dot}`} /></span>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-2">
                    <button className="h-7 px-3 rounded-lg bg-[#25D366] text-[#075E54] text-[11px] font-black border-none cursor-pointer">Request Approval</button>
                    <Pill>Dry Run</Pill>
                    <button className="h-7 px-3 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-[11px] font-black cursor-pointer">Pause Now (HIC)</button>
                  </div>
                </div>
              </BSection>

              {/* Audit Trail */}
              <BSection title="Audit Trail (Irrefutable)">
                <div className="p-4">
                  <div className="text-[11px] text-[#667781] mb-3">Cryptographic hashchain • who did what • when • why</div>
                  {BLADE_AUDIT.map((a,i) => (
                    <div key={i} className="border border-[#E9EDEF] rounded-lg px-3 py-2 mb-2 text-[12px] flex items-start justify-between gap-2">
                      <span className="text-[#667781] whitespace-nowrap shrink-0">{a.ts}</span>
                      <span className="font-black text-[#111B21] shrink-0">{a.actor}</span>
                      <span className="text-[#667781] text-right">{a.action}</span>
                    </div>
                  ))}
                </div>
              </BSection>
            </div>
          </>
        ) : (
          /* ── Waswa AI Co-Pilot ──────────────────────────────────── */
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-black text-[13px] text-[#111B21]">Waswa AI Co-Pilot</span>
              <span className="text-[11px] font-black text-[#25D366] border border-[#25D366]/30 px-2 py-0.5 rounded-full">AI: ON</span>
            </div>

            <div className="bg-[#128C7E]/10 border border-[#128C7E]/20 rounded-xl p-3">
              <div className="font-black text-[12px] text-[#128C7E] mb-1">Insight</div>
              <div className="text-[12px] text-[#111B21] leading-relaxed">
                <strong>Failure cluster detected (FMB920 v2.3.1):</strong><br/>
                CRC mismatch → 2.6% fails • risk: bricking + refunds.<br/>
                Suggested: pause rollout, canary rollback v2.3.0 (5%).<br/>
                VEBA conflicts: 12 bookings in next 24h → reschedule window.
              </div>
            </div>

            <div className="font-black text-[13px] text-[#111B21]">Recommended Actions</div>
            <button className="w-full h-9 rounded-lg bg-[#25D366] text-[#075E54] text-[12px] font-black border-none cursor-pointer">Approve Pause + Canary Rollback (HITL)</button>

            <div className="font-black text-[13px] text-[#111B21]">Quick Links</div>
            <div className="flex items-center justify-between border border-[#128C7E]/20 rounded-lg px-3 py-2.5 text-[12px] font-black text-[#111B21] cursor-pointer hover:bg-[#128C7E]/5">Token Top-Up (MoMo/Card)<span className="w-2.5 h-2.5 rounded-full bg-[#128C7E]" /></div>
            <div className="flex items-center justify-between border border-[#128C7E]/20 rounded-lg px-3 py-2.5 text-[12px] font-black text-[#111B21] cursor-pointer hover:bg-[#128C7E]/5">VEBA Bookings Ops<span className="w-2.5 h-2.5 rounded-full bg-[#128C7E]" /></div>

            <button className="w-full h-9 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-[12px] font-black cursor-pointer mt-1">Kill Switch: Disable OTA Engine (HIC)</button>

            <input placeholder={'Ask Waswa... e.g. "Why did OTA fail in UG today?"'} className="w-full h-8 rounded-lg border border-[#E9EDEF] px-3 text-[11px] text-[#111B21] placeholder:text-[#667781] outline-none mt-auto" />
          </div>
        )}
      </aside>

      {/* ── Modal: New OTA Campaign ───────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/35 z-50 grid place-items-center" onClick={() => setModalOpen(false)}>
          <div className="w-[min(760px,calc(100vw-24px))] max-h-[calc(100vh-24px)] bg-white rounded-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#E9EDEF] flex items-center justify-between shrink-0">
              <div className="font-black text-[16px] text-[#111B21]">New OTA Campaign</div>
              <button onClick={() => setModalOpen(false)} className="w-8 h-8 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[#667781] font-black text-[14px] cursor-pointer grid place-items-center">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-5">

              {/* Steps */}
              <div className="flex gap-2 mb-5">
                {["1 Package","2 Targets","3 Rollout","4 Billing & Approval","5 Review"].map((s,i) => (
                  <span key={s} className={`flex-1 h-9 rounded-lg text-[12px] font-black flex items-center justify-center border cursor-pointer ${i === 3 ? "bg-[#128C7E]/10 border-[#128C7E]/30 text-[#128C7E]" : "bg-white border-[#E9EDEF] text-[#667781]"}`}>{s}</span>
                ))}
              </div>

              {/* Billing preset */}
              <div className="text-[13px] font-black text-[#111B21] mb-1">Billing preset</div>
              <div className="text-[12px] text-[#667781] mb-1">Token domain: ota_update &ensp;• &ensp;FIFO wallet consumption &ensp;• &ensp;multi-currency</div>
              <div className="text-[12px] text-[#667781] mb-3">Reserve on START → burn on COMPLETE → refund on FAILED (policy)</div>
              <button className="h-8 px-4 rounded-lg bg-[#25D366] text-[#075E54] text-[11px] font-black border-none cursor-pointer mb-4">Auto-estimate cost</button>

              {/* Cost Estimate */}
              <div className="font-black text-[13px] text-[#111B21] mb-2">Cost Estimate</div>
              <div className="border border-[#E9EDEF] rounded-xl overflow-hidden mb-4">
                {COST_ESTIMATE.map(c => (
                  <div key={c.k} className="flex items-center border-b border-[#E9EDEF] last:border-0 px-4 py-2.5 text-[12px]">
                    <span className="font-black text-[#111B21] w-[160px] shrink-0">{c.k}</span>
                    <span className="font-black text-[#111B21] w-[100px]">{c.v}</span>
                    <span className="text-[#667781]">{c.note}</span>
                  </div>
                ))}
              </div>

              {/* Payment Channels */}
              <div className="font-black text-[13px] text-[#111B21] mb-1">Payment Channels</div>
              <div className="text-[11px] text-[#667781] mb-2">Top-up options (UG/KE) — mobile money + cards</div>
              <div className="border border-[#E9EDEF] rounded-xl overflow-hidden mb-4">
                {PAY_CHANNELS.map(p => (
                  <div key={p.name} className="flex items-center justify-between border-b border-[#E9EDEF] last:border-0 px-4 py-2.5 text-[12px]">
                    <span className="font-black text-[#111B21]">{p.name}</span>
                    <span className="flex items-center gap-2 text-[#667781]">{p.status}<span className={`w-2.5 h-2.5 rounded-full ${p.dot}`} /></span>
                  </div>
                ))}
              </div>

              {/* High-Risk Action Guardrails */}
              <div className="bg-[#FEF3C7] border border-[#FBBF24]/30 rounded-xl p-4 mb-4">
                <div className="font-black text-[12px] text-[#EF4444] mb-2">High-Risk Action Guardrails</div>
                <div className="text-[12px] text-[#111B21] mb-2">Launching OTA at scale can cause downtime, data cost spikes and safety risk.</div>
                <div className="text-[12px] text-[#111B21] leading-relaxed">
                  • Requires HITL approval (SYS_ADMIN + SRE).<br/>
                  • Every action is cryptographically logged (Irrefutable).<br/>
                  • Kill switch always available (HIC) and cannot be bypassed.
                </div>
                <div className="flex items-center gap-2 mt-3 border border-[#E9EDEF] rounded-lg px-3 py-2 bg-white">
                  <span className="w-4 h-4 rounded border border-[#128C7E] bg-[#128C7E] text-white grid place-items-center text-[10px] font-black shrink-0">✓</span>
                  <span className="text-[12px] font-black text-[#111B21]">I understand and request approval</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#E9EDEF] bg-white shrink-0">
              <button onClick={() => setModalOpen(false)} className="h-10 px-6 rounded-lg bg-white border border-[#E9EDEF] text-[13px] font-black text-[#111B21] cursor-pointer">Save Draft</button>
              <button onClick={() => setModalOpen(false)} className="h-10 px-6 rounded-lg bg-[#25D366] text-[#075E54] text-[13px] font-black border-none cursor-pointer hover:brightness-105">Request Approval</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reusable ────────────────────────────────────────────────────────────────
const pillStyles: Record<string, string> = {
  green: "bg-[#25D366] text-[#075E54]",
  ghost: "bg-white border border-[#E9EDEF] text-[#667781]",
};

function Pill({ color = "ghost", onClick, children }: { color?: string; onClick?: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`h-7 px-3 rounded-full text-[11px] font-black border-none cursor-pointer hover:brightness-105 active:opacity-85 transition-all whitespace-nowrap ${pillStyles[color] ?? pillStyles.ghost}`}>{children}</button>;
}

function KpiCard({ label, value, sub, badge, code }: { label: string; value: string; sub: string; badge: string; code: string }) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl p-3 relative">
      <span className={`absolute top-3 right-3 px-1.5 py-0.5 rounded-full text-[9px] font-black ${sBadge[badge]}`}>{badge}</span>
      <div className="text-[11px] text-[#667781]">{label}<span className="text-[9px] ml-1 opacity-60">{code}</span></div>
      <div className="text-[22px] font-black text-[#111B21] mt-1 leading-tight">{value}</div>
      <div className="text-[10px] text-[#667781] mt-1">{sub}</div>
    </div>
  );
}

function BSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 border border-[#E9EDEF] rounded-xl overflow-hidden bg-white">
      <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E9EDEF]"><div className="font-black text-[12px] text-[#111B21]">{title}</div></div>
      {children}
    </div>
  );
}
