/**
 * SimPage — Screen 15: SIGNAL VAULT — SIM Cards & Connectivity Console
 *
 * Matches v26 mockups (7 screenshots):
 *   TOP:    Header + actions → 5 KPIs → Waswa AI Risk → SIM Inventory (9 rows, 10 cols)
 *   MID:    SIM table cont. → Roaming Cost Radar (bar chart) + Top 20 SIMs
 *           → APN Compliance table (4 rows)
 *   BOTTOM: SIM Suspend/Reactivate Queue (3 rows) → Reports & Exports
 *   BLADE:  SIM Details (Mapping Integrity, Actions HITL/HIC, Telemetry & Costs, Events)
 *   MODAL:  Link Telco Private APN (HITL) — 5-step wizard
 */
import React, { useState, useEffect, useMemo } from "react";
import { getAllSimCards, getSimStatistics, ApiError } from "../../api";
import type { SimCard, SimStatistics } from "../../api";
import { CreateSimDialog } from "./components";

// ─── Status badge styles ─────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  "active":   "bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30",
  "in-stock": "bg-[#F97316]/15 text-[#F97316] border border-[#F97316]/30",
  "inactive": "bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30",
  "used":     "bg-[#F97316]/15 text-[#F97316] border border-[#F97316]/30",
};

const STATUS_DOT: Record<string, string> = {
  "active":   "bg-[#25D366]",
  "in-stock": "bg-[#F97316]",
  "inactive": "bg-[#EF4444]",
  "used":     "bg-[#F97316]",
};

// ─── Mock Data ───────────────────────────────────────────────────────────────

// const TOP20 = [
//   { id:"...5690", cost:"UGX 4.8/MB", dot:"bg-[#EF4444]" },
//   { id:"...5691", cost:"UGX 4.5/MB", dot:"bg-[#EF4444]" },
//   { id:"...5692", cost:"UGX 4.2/MB", dot:"bg-[#F97316]" },
//   { id:"...5693", cost:"UGX 3.9/MB", dot:"bg-[#F97316]" },
//   { id:"...5694", cost:"UGX 3.6/MB", dot:"bg-[#FBBF24]" },
//   { id:"...5695", cost:"UGX 3.3/MB", dot:"bg-[#FBBF24]" },
//   { id:"...5696", cost:"UGX 3.0/MB", dot:"bg-[#FBBF24]" },
// ];

// const APN_LINKS = [
//   { apn:"mtn.private.apn",  telco:"MTN",       tenants:"3D DEMO, TEP", sync:"2m ago",  status:"OK",    action:"Edit • Rotate" },
//   { apn:"airtel.corp.apn",  telco:"Airtel",     tenants:"3D DEMO",      sync:"5m ago",  status:"OK",    action:"Edit • Rotate" },
//   { apn:"saf.vpn.apn",      telco:"Safaricom",  tenants:"VEBA-OPS",     sync:"41m ago", status:"WARN",  action:"Test Ping" },
//   { apn:"mtn.roam.apn",     telco:"MTN",        tenants:"KE-Logistics", sync:"1h ago",  status:"ALARM", action:"Disable" },
// ];

// // const SUSPEND_Q = [
//   { req:"Suspend",    iccid:"…5692", reason:"Roaming without bundle",  by:"waswa-ai", state:"PENDING" },
//   { req:"Reactivate", iccid:"…5690", reason:"Payment settled",         by:"finance",  state:"APPROVE" },
//   { req:"Suspend",    iccid:"…5695", reason:"Fraud ring pattern",      by:"risk",     state:"REVIEW"  },
// ];

const BLADE_EVENTS = [
  { time:"09:12", event:"Roam Enter",  note:"MCC 639 → KE" },
  { time:"09:14", event:"Bundle <10%", note:"soft alert" },
  { time:"09:21", event:"Cost Spike",  note:"+2x baseline" },
  { time:"09:30", event:"APN Reject",  note:"policy mismatch" },
];

// const BAR_DAYS = [
//   { day:"M", h:55, color:"bg-[#128C7E]" }, { day:"T", h:50, color:"bg-[#128C7E]" },
//   { day:"W", h:60, color:"bg-[#128C7E]" }, { day:"T", h:80, color:"bg-[#25D366]" },
//   { day:"F", h:70, color:"bg-[#F97316]" }, { day:"S", h:65, color:"bg-[#F97316]" },
//   { day:"S", h:72, color:"bg-[#25D366]" },
// ];

// ─── Page ────────────────────────────────────────────────────────────────────
export function SimPage() {
  const [bladeOpen, setBladeOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [createSimOpen, setCreateSimOpen] = useState(false);

  // ── Filters ─────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [telcoFilter, setTelcoFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // ── SIM statistics from API ─────────────────────────────────────────────
  const [stats, setStats] = useState<SimStatistics | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── SIM inventory from API ───────────────────────────────────────────────
  const [sims, setSims] = useState<SimCard[]>([]);
  const [simsLoading, setSimsLoading] = useState(true);
  const [simsError, setSimsError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getAllSimCards({ signal: controller.signal })
      .then((res) => {
        setSims(res.data);
        setSimsLoading(false);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSimsError(err instanceof ApiError ? err.message : "Failed to load SIM cards");
        setSimsLoading(false);
      });

    getSimStatistics({ signal: controller.signal })
      .then((res) => {
        setStats(res.data);
        setStatsLoading(false);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatsLoading(false);
      });

    return () => controller.abort();
  }, []);

  // ── Derived filter options + filtered list ──────────────────────────────
  const telcoOptions = useMemo(() => [...new Set(sims.map((s) => s.telecom))].sort(), [sims]);
  const statusOptions = useMemo(() => [...new Set(sims.map((s) => s.simcard_status))].sort(), [sims]);

  const filteredSims = useMemo(() => {
    let result = sims;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.simcard_number.toLowerCase().includes(q) ||
          s.simcard_uid.toLowerCase().includes(q) ||
          s.telecom.toLowerCase().includes(q),
      );
    }
    if (telcoFilter !== "all") result = result.filter((s) => s.telecom === telcoFilter);
    if (statusFilter !== "all") result = result.filter((s) => s.simcard_status === statusFilter);
    return result;
  }, [sims, search, telcoFilter, statusFilter]);

  /** Download the SIM inventory as a CSV file. */
  function downloadSimLedgerCsv() {
    if (sims.length === 0) return;
    const header = ["SIM Number", "Telecom", "Status", "Date Created", "UID"];
    const rows = sims.map((s) => [
      s.simcard_number,
      s.telecom,
      s.simcard_status,
      s.date_created,
      s.simcard_uid,
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sim-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Re-fetch after creating a new SIM. */
  function refreshSims() {
    setSimsLoading(true);
    setSimsError(null);
    setStatsLoading(true);
    getAllSimCards()
      .then((res) => {
        setSims(res.data);
        setSimsLoading(false);
      })
      .catch((err) => {
        setSimsError(err instanceof ApiError ? err.message : "Failed to load SIM cards");
        setSimsLoading(false);
      });
    getSimStatistics()
      .then((res) => {
        setStats(res.data);
        setStatsLoading(false);
      })
      .catch(() => setStatsLoading(false));
  }

  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden relative">
      {/* ── Main ─────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-3 p-3">

          {/* Header */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-black text-[16px] text-[#111B21]">Signal Vault</div>
                <div className="text-[11px] text-[#667781] mt-0.5">Infrastructure &amp; Connectivity &gt; SIM Cards &amp; Connectivity Console</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Pill color="green" onClick={() => setCreateSimOpen(true)}>+ New SIM</Pill>
                {/* <Pill color="green">Top-up Bundle</Pill>
                <Pill color="green" onClick={() => setModalOpen(true)}>APN Link</Pill> */}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ICCID / IMEI / MSISDN"
              className="flex-1 min-w-[180px] max-w-[240px] h-8 px-3 rounded-lg bg-white border border-[#E9EDEF] text-[11px] text-[#111B21] outline-none focus:border-[#128C7E] transition-colors placeholder:text-[#667781]"
            />
            <select
              value={telcoFilter}
              onChange={(e) => setTelcoFilter(e.target.value)}
              className="h-8 px-3 rounded-lg bg-white border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] transition-colors cursor-pointer"
            >
              <option value="all">Telco: All</option>
              {telcoOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-3 rounded-lg bg-white border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] transition-colors cursor-pointer"
            >
              <option value="all">Status: All</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {(search || telcoFilter !== "all" || statusFilter !== "all") && (
              <button
                onClick={() => { setSearch(""); setTelcoFilter("all"); setStatusFilter("all"); }}
                className="h-7 px-3 rounded-full bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-[11px] font-black cursor-pointer"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* ════════════ TOP SCROLL ════════════════════════════════ */}

          {/* 5 KPIs — from statistics API */}
          <div className="grid grid-cols-5 gap-3">
            <KpiCard label="Total SIMs"   value={statsLoading || !stats ? "—" : stats.total_sims.toLocaleString()} sub="All registered" subColor="text-[#667781]" dot="bg-[#25D366]" />
            <KpiCard label="Active"       value={statsLoading || !stats ? "—" : stats.active.toLocaleString()}     sub="Operational"    subColor="text-[#25D366]" dot="bg-[#25D366]" />
            <KpiCard label="In-stock"     value={statsLoading || !stats ? "—" : stats.in_stock.toLocaleString()}   sub="Available"      subColor="text-[#34B7F1]" dot="bg-[#34B7F1]" />
            <KpiCard label="Used"         value={statsLoading || !stats ? "—" : stats.used.toLocaleString()}       sub="Consumed"       subColor="text-[#F97316]" dot="bg-[#F97316]" />
            <KpiCard label="Inactive"     value={statsLoading || !stats ? "—" : stats.inactive.toLocaleString()}   sub="Disabled"       subColor="text-[#EF4444]" dot="bg-[#EF4444]" />
          </div>

          {/* Waswa AI — Connectivity Risk */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
            <div className="font-black text-[13px] text-[#111B21] mb-1">Waswa AI — Connectivity Risk</div>
            <div className="text-[12px] text-[#111B21] leading-relaxed mb-2">
              Detected roaming spike near KE border (MCC 639). 42 SIMs burning bundles 3.8× baseline.<br/>
              Suggestion: auto-purchase "Roaming Packet Bundle" (Tokens A) + enforce APN policy. HITL approval required.
            </div>
            <div className="flex gap-2">
              <span className="h-7 px-3 rounded-full border border-[#128C7E]/30 text-[#128C7E] text-[11px] font-black flex items-center cursor-pointer">Evidence</span>
              <span className="h-7 px-3 rounded-full border border-[#128C7E]/30 text-[#128C7E] text-[11px] font-black flex items-center cursor-pointer">Create Rule</span>
              <div className="ml-auto flex gap-2">
                <button className="h-7 px-3 rounded-lg bg-[#128C7E] text-white text-[11px] font-black border-none cursor-pointer">Review</button>
                <button className="h-7 px-3 rounded-lg bg-[#25D366] text-[#075E54] text-[11px] font-black border-none cursor-pointer">Approve (HITL)</button>
              </div>
            </div>
          </div>

          {/* SIM Inventory */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E9EDEF] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-black text-[13px] text-[#111B21]">SIM Inventory</span>
                <span className="text-[11px] text-[#667781]">• mapping integrity: 98.7%</span>
              </div>
              <div className="flex gap-2">
                <span className="h-7 px-3 rounded-full border border-[#128C7E]/30 text-[#128C7E] text-[11px] font-black flex items-center cursor-pointer">Import</span>
                <span className="h-7 px-3 rounded-full border border-[#128C7E]/30 text-[#128C7E] text-[11px] font-black flex items-center cursor-pointer">Export</span>
              </div>
            </div>
            <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full text-[12px] min-w-[800px]">
              <thead><tr className="border-b border-[#E9EDEF] bg-[#F8FAFC]">
                {["","SIM Number","Telecom","Status","Date Created","UID"].map((h,i) => (
                  <th key={i} className="text-left px-2 py-2 font-black text-[#667781]">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {simsLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[12px] text-[#667781]">Loading SIM cards…</td></tr>
                ) : simsError ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[12px] text-[#EF4444]">{simsError}</td></tr>
                ) : sims.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[12px] text-[#667781]">No SIM cards registered yet.</td></tr>
                ) : filteredSims.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[12px] text-[#667781]">No SIM cards match the current filters.</td></tr>
                ) : (
                  filteredSims.map((s) => (
                    <tr key={s.simcard_uid} onClick={() => setBladeOpen(true)} className="border-b border-[#E9EDEF] last:border-0 hover:bg-[#F8FAFC] cursor-pointer">
                      <td className="px-2 py-2"><span className={`w-2.5 h-2.5 rounded-full inline-block ${STATUS_DOT[s.simcard_status] ?? "bg-[#667781]"}`} /></td>
                      <td className="px-2 py-2 font-mono text-[#111B21] text-[11px]">{s.simcard_number}</td>
                      <td className="px-2 py-2 text-[#667781]">{s.telecom}</td>
                      <td className="px-2 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${STATUS_BADGE[s.simcard_status] ?? "text-[#667781]"}`}>{s.simcard_status}</span></td>
                      <td className="px-2 py-2 text-[#667781]">{s.date_created}</td>
                      <td className="px-2 py-2 text-[#667781] font-mono text-[10px]">{s.simcard_uid}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* ════════════ MID SCROLL ════════════════════════════════ */}

          {/* Roaming Cost Radar + Top 20 */}
          {/* <div className="grid grid-cols-[1fr_340px] gap-3">
            <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
              <div className="font-black text-[13px] text-[#111B21] mb-3">Roaming Cost Radar (7d)</div>
              <div className="flex items-end gap-3 h-[120px]">
                {BAR_DAYS.map((b,i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div className={`w-full rounded-t-md ${b.color}`} style={{ height:`${b.h}%` }} />
                    <span className="text-[10px] text-[#667781] mt-1">{b.day}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
              <div className="font-black text-[13px] text-[#111B21]">Top 20 SIMs by Cost</div>
              <div className="text-[11px] text-[#667781] mt-0.5 mb-3">(last 24h • normalized)</div>
              {TOP20.map(t => (
                <div key={t.id} className="flex items-center justify-between mb-1.5 text-[12px]">
                  <span className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${t.dot} shrink-0`} /><span className="text-[#111B21]">ICCID {t.id}</span></span>
                  <span className="font-black text-[#F97316]">{t.cost}</span>
                </div>
              ))}
            </div>
          </div> */}

          {/* APN Compliance & Private APN Links */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
            {/* <div className="px-4 py-3 border-b border-[#E9EDEF] flex items-center justify-between">
              <div>
                <div className="font-black text-[13px] text-[#111B21]">APN Compliance &amp; Private APN Links</div>
                <div className="text-[11px] text-[#667781] mt-0.5">Link telco private APNs to tenants • rotate credentials • test ping</div>
              </div>
              <Pill color="green" onClick={() => setModalOpen(true)}>Link Private APN</Pill>
            </div> */}
            <table className="w-full text-[12px]">
              {/* <thead><tr className="border-b border-[#E9EDEF] bg-[#F8FAFC]">
                {["APN","Telco","Tenants","Last Sync","Status","Actions"].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-black text-[#667781]">{h}</th>
                ))}
              </tr></thead> */}
              <tbody>
                {/* {APN_LINKS.map(a => (
                  <tr key={a.apn} className="border-b border-[#E9EDEF] last:border-0">
                    <td className="px-3 py-2.5 font-black text-[#111B21]">{a.apn}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{a.telco}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{a.tenants}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{a.sync}</td>
                    <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${stBadge[a.status]}`}>{a.status}</span></td>
                    <td className="px-3 py-2.5 text-[#667781]">{a.action}</td>
                  </tr>
                ))} */}
              </tbody>
            </table>
          </div>

          {/* ════════════ BOTTOM SCROLL ═════════════════════════════ */}

          {/* SIM Suspend / Reactivate Queue */}
          {/* <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E9EDEF] flex items-center justify-between">
              <div>
                <div className="font-black text-[13px] text-[#111B21]">SIM Suspend / Reactivate Queue (HIC)</div>
                <div className="text-[11px] text-[#667781] mt-0.5">High-risk actions require approval + audit trail</div>
              </div>
              <button className="h-7 px-3 rounded-lg bg-[#25D366] text-[#075E54] text-[11px] font-black border-none cursor-pointer">Open Approvals</button>
            </div>
            <table className="w-full text-[12px]">
              <thead><tr className="border-b border-[#E9EDEF] bg-[#F8FAFC]">
                {["Request","ICCID","Reason","Requested By","State"].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-black text-[#667781]">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {SUSPEND_Q.map((s,i) => (
                  <tr key={i} className="border-b border-[#E9EDEF] last:border-0">
                    <td className="px-3 py-2.5 font-black text-[#111B21]">{s.req}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{s.iccid}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{s.reason}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{s.by}</td>
                    <td className="px-3 py-2.5"><span className={`font-black ${stBadge[s.state] ?? "text-[#667781]"}`}>{s.state}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div> */}

          {/* Reports & Exports */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
            <div className="font-black text-[13px] text-[#111B21]">Reports &amp; Exports</div>
            <div className="text-[11px] text-[#667781] mt-0.5 mb-3">CSV / Excel / PDF • schedule email delivery • PowerBI dataset</div>
            <div className="flex gap-2 mb-3">
              <button onClick={downloadSimLedgerCsv} disabled={simsLoading || sims.length === 0} className="h-8 px-4 rounded-lg bg-[#25D366] text-[#075E54] text-[11px] font-black border-none cursor-pointer disabled:opacity-50">Download SIM Ledger (CSV)</button>
              {/* <button className="h-8 px-4 rounded-lg bg-[#128C7E] text-white text-[11px] font-black border-none cursor-pointer">Export Roaming Costs (XLSX)</button>
              <button className="h-8 px-4 rounded-lg bg-[#34B7F1] text-white text-[11px] font-black border-none cursor-pointer">Schedule Weekly Email</button> */}
            </div>
            <div className="border border-[#E9EDEF] rounded-lg px-3 py-2 text-[11px] text-[#667781]">
              Usage Metering (US-03): all SIM events emit immutable usage events to Kafka topic: usage.connectivity
            </div>
          </div>
        </div>
      </main>

      {/* ── Blade: SIM Details ───────────────────────────────────── */}
      {bladeOpen && (
        <aside className="w-[420px] shrink-0 bg-white border-l border-[#E9EDEF] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex flex-col">
          <div className="bg-[#128C7E] text-white px-5 py-3 flex items-center justify-between shrink-0">
            <span className="font-black text-[13px]">SIM Details • ICCID …5692</span>
            <button onClick={() => setBladeOpen(false)} className="w-7 h-7 rounded-lg bg-white/15 text-white font-black text-[13px] cursor-pointer grid place-items-center border-none">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-5 py-4">

            {/* Mapping Integrity */}
            <BSection title="Mapping Integrity">
              <div className="p-4 text-[12px] text-[#111B21] leading-relaxed">
                <div>ICCID ↔ IMEI: OK</div>
                <div className="text-[#667781]">Last seen: 12s ago</div>
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#F97316]/15 border border-[#F97316]/30 text-[#F97316]">ROAMING: KE</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444]">Bundle Rem: 7%</span>
                </div>
              </div>
            </BSection>

            {/* Actions */}
            <BSection title="Actions (HITL/HIC)">
              <div className="p-4 text-[12px] text-[#111B21] leading-relaxed">
                <div>• Buy roaming bundle (Tokens A) via MTN/Airtel/M-Pesa</div>
                <div>• Suspend SIM (HIC) — requires approval + audit log</div>
                <div>• Force APN policy (private APN)</div>
                <div className="flex gap-2 mt-3">
                  <button className="h-7 px-3 rounded-lg bg-[#25D366] text-[#075E54] text-[11px] font-black border-none cursor-pointer">Top-up Bundle</button>
                  <button className="h-7 px-3 rounded-lg bg-[#EF4444] text-white text-[11px] font-black border-none cursor-pointer">Suspend (HIC)</button>
                  <button className="h-7 px-3 rounded-lg bg-[#128C7E] text-white text-[11px] font-black border-none cursor-pointer">Open Logs</button>
                </div>
              </div>
            </BSection>

            {/* Telemetry & Costs */}
            <BSection title="Telemetry & Costs (24h)">
              <div className="p-4">
                <div className="flex items-center gap-4 mb-3 text-[12px]">
                  <span><span className="text-[#667781]">Data MB</span> <span className="font-black text-[18px] text-[#111B21] ml-2">92</span></span>
                  <span><span className="text-[#667781]">Cost</span> <span className="font-black text-[18px] text-[#25D366] ml-2">UGX 381</span></span>
                </div>
                <table className="w-full text-[12px]">
                  <thead><tr className="border-b border-[#E9EDEF]">
                    {["Time","Event","Note"].map(h => <th key={h} className="text-left px-2 py-1.5 text-[#667781] font-black">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {BLADE_EVENTS.map((e,i) => (
                      <tr key={i} className="border-b border-[#E9EDEF] last:border-0">
                        <td className="px-2 py-1.5 font-mono text-[#667781]">{e.time}</td>
                        <td className="px-2 py-1.5 font-black text-[#111B21]">{e.event}</td>
                        <td className="px-2 py-1.5 text-[#667781]">{e.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </BSection>
          </div>
        </aside>
      )}

      {/* ── Modal: Link Telco Private APN ────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/35 z-50 grid place-items-center" onClick={() => setModalOpen(false)}>
          <div className="w-[min(760px,calc(100vw-24px))] max-h-[calc(100vh-24px)] bg-white rounded-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-[#075E54] text-white px-5 py-4 flex items-center justify-between shrink-0">
              <span className="font-black text-[15px]">Link Telco Private APN (HITL)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#F97316] text-white">Requires Approval</span>
            </div>
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-5">

              {/* Steps */}
              <div className="flex gap-2 mb-5">
                {["1  Provider","2  Creds","3  Mapping","4  Test","5  Approval"].map((s,i) => (
                  <span key={s} className={`flex-1 h-9 rounded-lg text-[12px] font-black flex items-center justify-center gap-1.5 border cursor-pointer ${i < 3 ? "bg-[#128C7E]/10 border-[#128C7E]/30 text-[#128C7E]" : "bg-white border-[#E9EDEF] text-[#667781]"}`}>
                    {i < 3 && <span className="w-5 h-5 rounded-full bg-[#128C7E] text-white text-[10px] font-black grid place-items-center">{i+1}</span>}
                    {s.split("  ")[1]}
                  </span>
                ))}
              </div>

              {/* 1) Provider */}
              <div className="font-black text-[13px] text-[#111B21] mb-2">1) Provider</div>
              <div className="grid grid-cols-3 gap-3 mb-1">
                <FField label="Telco" value="MTN" />
                <FField label="Country" value="UG / KE" />
                <FField label="APN Name" value="mtn.private.apn" />
              </div>
              <div className="text-[11px] text-[#667781] mb-4">Tip: keep one private APN per tenant tree (Dealer→Client→Org).</div>

              {/* 2) Credentials */}
              <div className="font-black text-[13px] text-[#111B21] mb-2">2) Credentials (stored encrypted)</div>
              <div className="grid grid-cols-2 gap-3 mb-1">
                <FField label="API Key" value="••••••••••••" />
                <FField label="API Secret" value="••••••••••••" />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-1">
                <FField label="Callback URL" value="https://api.navas/ telco/callback" />
                <FField label="Rotate" value="Every 30 days ▾" />
              </div>
              <div className="text-[11px] text-[#667781] mb-4">Audit: any credential change emits event → Kafka topic: audit.security</div>

              {/* 3) Tenant Mapping */}
              <div className="font-black text-[13px] text-[#111B21] mb-2">3) Tenant Mapping</div>
              <div className="grid grid-cols-3 gap-3 mb-1">
                <FField label="Tenant" value="3D DEMO • TOP ▾" />
                <FField label="Scope" value="Dealer subtree ▾" />
                <FField label="Policy" value="Force APN ▾" />
              </div>
              <div className="text-[11px] text-[#667781] mb-2">Billing: allocate Connectivity Tokens to cover APN sync + roaming bundles.</div>
              <div className="border border-[#E9EDEF] rounded-lg px-3 py-2 text-[11px] text-[#667781] mb-4">
                Reserve: 12,000 Tokens A &ensp;| &ensp;Auto top-up via MTN/Airtel/M-Pesa &ensp;| &ensp;Currency: UGX/KES/USD
              </div>

              {/* 4) Test Connection */}
              <div className="font-black text-[13px] text-[#111B21] mb-2">4) Test Connection</div>
              <div className="text-[12px] text-[#667781] mb-2">Run a dry-run sync: fetch SIM inventory + verify APN policy against sample ICCIDs.</div>
              <div className="flex items-center gap-3 mb-1">
                <button className="h-8 px-4 rounded-lg bg-[#128C7E] text-white text-[11px] font-black border-none cursor-pointer">Run Test</button>
                <span className="px-3 py-1 rounded-lg bg-[#25D366]/15 border border-[#25D366]/30 text-[11px] font-black text-[#25D366]">Last test: PASS • latency 410ms • 0 schema errors</span>
              </div>
              <div className="text-[11px] text-[#667781] mb-4">If FAIL: create incident in Alarm Center (auto) + notify via WhatsApp.</div>

              {/* 5) Approval (HITL) */}
              <div className="font-black text-[13px] text-[#111B21] mb-2">5) Approval (HITL)</div>
              <div className="text-[12px] text-[#667781] mb-2">This action can impact data leakage + costs. Require System Admin approval + audit.</div>
              <div className="bg-[#FEF3C7] border border-[#FBBF24]/30 rounded-lg px-3 py-2 text-[11px] font-black text-[#F97316]">
                Checklist: RBAC scope verified • token reserve set • rollback plan ready
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#E9EDEF] bg-white shrink-0">
              <button onClick={() => setModalOpen(false)} className="h-10 px-6 rounded-lg bg-white border border-[#E9EDEF] text-[13px] font-black text-[#111B21] cursor-pointer">Cancel</button>
              <button onClick={() => setModalOpen(false)} className="h-10 px-6 rounded-lg bg-[#25D366] text-[#075E54] text-[13px] font-black border-none cursor-pointer hover:brightness-105">Submit for Approval</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create SIM Dialog ──────────────────────────────────── */}
      <CreateSimDialog
        open={createSimOpen}
        onClose={() => setCreateSimOpen(false)}
        onCreated={() => refreshSims()}
      />

      {/* Floating AI button */}
      <button className="fixed right-5 bottom-5 w-14 h-14 rounded-full bg-[#25D366] text-white font-black text-[14px] border-none cursor-pointer grid place-items-center z-40 shadow-lg">AI</button>
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

function KpiCard({ label, value, sub, subColor, dot }: { label: string; value: string; sub: string; subColor: string; dot: string }) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl p-3 relative">
      <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${dot}`} />
      <div className="text-[11px] text-[#667781]">{label}</div>
      <div className="text-[22px] font-black text-[#111B21] mt-1 leading-tight">{value}</div>
      <div className={`text-[10px] mt-1 ${subColor}`}>{sub}</div>
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

function FField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#E9EDEF] rounded-lg px-3 py-2">
      <div className="text-[10px] text-[#667781]">{label}</div>
      <div className="text-[12px] font-black text-[#111B21] mt-0.5">{value}</div>
    </div>
  );
}
