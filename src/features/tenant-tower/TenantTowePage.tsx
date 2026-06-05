/**
 * TenantTowerPage — Screen 07: TENANT TOWER (Clients & Accounts)
 *
 * Matches v26 mockups pixel-accurately:
 *   TOP:    Breadcrumb + Quick Actions → 4 KPIs → 2-col (Hierarchy table | Selected Tenant blade)
 *   MID:    Usage Events Ledger → Approvals Queue (HITL/HIC)
 *   BOTTOM: Audit Trail → Policy Violations → Odoo ERP Sync
 *   MODAL:  Right blade — Create Tenant / Sub-Org (tabs: Basics, Billing, Modules, RBAC, Review)
 */
import React, { useEffect, useState } from "react";
import { getAllTenants, getAllClients, createClient, getClientDevices, getClientBalance, getExpiredTokens, getActiveSubscriptions, /* getApprovals, approveRequest, rejectRequest, */ saveDraft, requestDraftApproval, submitApprovedDraft, trashClient, updateClient, ApiError } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import type { Tenant, Client, ClientDevice, ClientTokenBalance, ExpiredTokensResponse, ActiveSubscriptionsResponse, /* Approval, */ TenantTier } from "../../api";

import { TrashRestoreModal } from "./components/TrashRestoreModal";
import { ImportTenantsModal } from "./components/ImportTenantsModal";
import { PermissionGate } from "../../auth/PermissionGate";
// import { CreateSubOrgModal } from "./components/CreateSubOrgModal";
import { TopUpModal } from "./components/TopUpModal";
import { AllocateModal } from "./components/AllocateModal";

// ─── Colour helpers ──────────────────────────────────────────────────────────
const okBg   = "bg-[#25D366] text-[#053B33]";
const alarmBg= "bg-[#F97316] text-white";
//const critBg = "bg-[#EF4444] text-white";
// const darkBg = "bg-[#075E54] text-white";

// ─── Mock Data ───────────────────────────────────────────────────────────────

// const VIOLATIONS = [
//   { icon:"⚠", title:"Hierarchy depth > 3 levels",               detail:"2 tenants (review recommended)"   },
//   { icon:"⚠", title:"Template drift: non-standard RBAC roles",  detail:"Kampala_Boda_Fleet"               },
//   { icon:"⚠", title:"FX mismatch: effective price deviates > 3%",detail:"Kisumu_Construction_Rentals"     },
//   { icon:"💡", title:"Opportunity: bundle recommendation available",detail:"Nairobi Logistics Client"      },
// ];

const MODAL_TABS = ["Basics","Billing & Tokens","Modules","RBAC","Review"];

// ─── Page ────────────────────────────────────────────────────────────────────
export function TenantTowerPage() {
  const { state: authState } = useAuth();
  const [bladeOpen, setBladeOpen] = useState(false);
  const [bladeTab, setBladeTab] = useState("Basics");
  const [trashOpen, setTrashOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // const [subOrgOpen, setSubOrgOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);
  // const [mintOpen, setMintOpen] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeSubStats, setActiveSubStats] = useState<ActiveSubscriptionsResponse | null>(null);
  const [expiredStats, setExpiredStats] = useState<ExpiredTokensResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  // const [approvals, setApprovals] = useState<Approval[]>([]);
  // const [approvalsLoading, setApprovalsLoading] = useState(true);

  useEffect(() => {
    getAllClients()
      .then((res) => {
        setClients(res.data);
        if (res.data.length > 0) setSelectedClientId(res.data[0].client_uid);
      })
      .catch(() => {});
    getActiveSubscriptions()
      .then((res) => setActiveSubStats(res.data))
      .catch(() => {});
    getExpiredTokens()
      .then((res) => setExpiredStats(res.data))
      .catch(() => {});
    // getApprovals()
    //   .then((res) => setApprovals(res.data))
    //   .catch(() => {})
    //   .finally(() => setApprovalsLoading(false));
    // getAllTenants()
    //   .then((res) => {
    //     setTenants(res.data);
    //     if (res.data.length > 0) setSelectedId(res.data[0].id);
    //   })
    //   .catch(() => {});
  }, []);

  const [clientDevices, setClientDevices] = useState<ClientDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  useEffect(() => {
    if (!selectedClientId) return;
    let cancelled = false;
    const fetchDevices = async () => {
      setDevicesLoading(true);
      try {
        const res = await getClientDevices(selectedClientId);
        if (!cancelled) setClientDevices(res.data);
      } catch {
        if (!cancelled) setClientDevices([]);
      } finally {
        if (!cancelled) setDevicesLoading(false);
      }
    };
    fetchDevices();
    return () => { cancelled = true; };
  }, [selectedClientId]);

  const [tokenBalance, setTokenBalance] = useState<ClientTokenBalance | null>(null);

  useEffect(() => {
    if (!selectedClientId) { setTokenBalance(null); return; }
    let cancelled = false;
    getClientBalance(selectedClientId)
      .then((res) => { if (!cancelled) setTokenBalance(res.data); })
      .catch(() => { if (!cancelled) setTokenBalance(null); });
    return () => { cancelled = true; };
  }, [selectedClientId]);

  // const [actioningId, setActioningId] = useState<string | null>(null);
  const [bladeDraftId, setBladeDraftId] = useState<string | null>(null);
  const [bladeApprovalStatus, setBladeApprovalStatus] = useState<string | null>(null);

  function refreshApprovals() {}

  // /** After approve/reject, check if the actioned item was a tenant_onboarding linked to the open blade draft */
  // function syncBladeAfterAction(actionedId: string, newStatus: "approved" | "rejected") {
  //   const match = approvals.find((a) => a.id === actionedId);
  //   if (match?.type === "tenant_onboarding" && match.draft_id && match.draft_id === bladeDraftId) {
  //     setBladeApprovalStatus(newStatus);
  //   }
  // }

  // function handleApprove(id: string) {
  //   if (!window.confirm("Approve this request? For mint requests, tokens will be credited immediately.")) return;
  //   setActioningId(id);
  //   approveRequest(id)
  //     .then(() => {
  //       syncBladeAfterAction(id, "approved");
  //       setApprovals((prev) => prev.filter((a) => a.id !== id));
  //       refreshWallet();
  //     })
  //     .catch(() => window.alert("Failed to approve"))
  //     .finally(() => setActioningId(null));
  // }

  // function handleReject(id: string) {
  //   if (!window.confirm("Reject this request? This action cannot be undone.")) return;
  //   setActioningId(id);
  //   rejectRequest(id)
  //     .then(() => {
  //       syncBladeAfterAction(id, "rejected");
  //       setApprovals((prev) => prev.filter((a) => a.id !== id));
  //     })
  //     .catch(() => window.alert("Failed to reject"))
  //     .finally(() => setActioningId(null));
  // }

  // function handleDeleteApproval(id: string) {
  //   if (!window.confirm("Remove this approval from the queue?")) return;
  //   setApprovals((prev) => prev.filter((a) => a.id !== id));
  // }

  // ── Blade form state ─────────────────────────────────────────────────────
  // Basics
  const [bladeName, setBladeName] = useState("");
  const [bladeEmail, setBladeEmail] = useState("");
  const [bladeTier, setBladeTier] = useState<TenantTier>("ORG");
  const [bladeParent, setBladeParent] = useState<string | null>(null);
  const [bladeCountry, setBladeCountry] = useState("UG");
  const [bladeCurrency, setBladeCurrency] = useState("UGX");
  const [bladeTimezone, setBladeTimezone] = useState("Africa/Kampala");
  // Billing & Tokens
  const [bladePlan, setBladePlan] = useState("OLIWA-PLUS");
  const [bladeRetention, setBladeRetention] = useState("90");
  const [bladeDailyCap, setBladeDailyCap] = useState("300000");
  const [bladeChannels, setBladeChannels] = useState<Record<string, boolean>>({
    "M-Pesa": true, "MTN MoMo": true, "Airtel Money": true, "Pesapal Cards": true, "Flutterwave": false,
  });
  // Modules
  const [bladeModules, setBladeModules] = useState<Record<string, boolean>>({
    "OLIWA Tracking": true, "PIKI (Motorcycle)": false, "VEBA Marketplace": true,
    "AI Console (Waswa)": true, "Messaging Portal (WhatsApp/SMS)": true,
    "Video Telematics": false, "Fuel & Sensors": true,
  });
  // RBAC
  const [bladeRoles, setBladeRoles] = useState<Record<string, boolean>>({
    "System Admin": true, "Fleet Manager": false, "Finance": false,
    "Read-Only Observer": false, "VEBA Ops": false, "Driver (mobile-only)": false,
  });
  // Submit
  const [bladeSubmitting, setBladeSubmitting] = useState(false);
  const [bladeResult, setBladeResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function resetBladeForm() {
    setBladeName(""); setBladeEmail(""); setBladeTier("ORG"); setBladeParent(null);
    setBladeCountry("UG"); setBladeCurrency("UGX"); setBladeTimezone("Africa/Kampala");
    setBladePlan("OLIWA-PLUS"); setBladeRetention("90"); setBladeDailyCap("300000");
    setBladeChannels({ "M-Pesa": true, "MTN MoMo": true, "Airtel Money": true, "Pesapal Cards": true, "Flutterwave": false });
    setBladeModules({ "OLIWA Tracking": true, "PIKI (Motorcycle)": false, "VEBA Marketplace": true, "AI Console (Waswa)": true, "Messaging Portal (WhatsApp/SMS)": true, "Video Telematics": false, "Fuel & Sensors": true });
    setBladeRoles({ "System Admin": true, "Fleet Manager": false, "Finance": false, "Read-Only Observer": false, "VEBA Ops": false, "Driver (mobile-only)": false });
    setBladeResult(null);
    setBladeDraftId(null);
    setBladeApprovalStatus(null);
  }

  function bladePayload() {
    return {
      name: bladeName.trim(),
      tier: bladeTier,
      parent_id: bladeParent,
      country: bladeCountry,
      currency: bladeCurrency,
      timezone: bladeTimezone,
      billing_plan: bladePlan,
      retention_days: parseInt(bladeRetention, 10),
      daily_token_cap: parseInt(bladeDailyCap, 10) || 300000,
      topup_channels: bladeChannels,
      modules: bladeModules,
      roles: bladeRoles,
      ...(bladeDraftId ? { draft_id: bladeDraftId } : {}),
    };
  }

  /** Save Draft — persists form to dll_tenant_drafts */
  function handleSaveDraft() {
    if (!bladeName.trim()) { window.alert("Tenant name is required"); return; }
    setBladeSubmitting(true);
    setBladeResult(null);
    saveDraft(bladePayload())
      .then((res) => {
        setBladeDraftId(res.data.draft_id);
        setBladeApprovalStatus(res.data.status);
        setBladeResult({ ok: true, msg: `Draft saved (${res.data.draft_id})` });
      })
      .catch((err) => {
        setBladeResult({ ok: false, msg: err?.message || "Failed to save draft" });
      })
      .finally(() => setBladeSubmitting(false));
  }

  /** Request HITL Approval — sends draft to admin queue */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleRequestApproval() {
    if (!bladeDraftId) {
      // Auto-save draft first, then request approval
      if (!bladeName.trim()) { window.alert("Tenant name is required"); return; }
      setBladeSubmitting(true);
      setBladeResult(null);
      saveDraft(bladePayload())
        .then((res) => {
          setBladeDraftId(res.data.draft_id);
          return requestDraftApproval(res.data.draft_id);
        })
        .then((res) => {
          setBladeApprovalStatus(res.data.status);
          setBladeResult({ ok: true, msg: `Approval requested — awaiting admin review (${res.data.approval_id})` });
          refreshApprovals();
        })
        .catch((err) => {
          setBladeResult({ ok: false, msg: err?.message || "Failed to request approval" });
        })
        .finally(() => setBladeSubmitting(false));
      return;
    }
    setBladeSubmitting(true);
    setBladeResult(null);
    requestDraftApproval(bladeDraftId)
      .then((res) => {
        setBladeApprovalStatus(res.data.status);
        setBladeResult({ ok: true, msg: `Approval requested — awaiting admin review (${res.data.approval_id})` });
        refreshApprovals();
      })
      .catch((err) => {
        setBladeResult({ ok: false, msg: err?.message || "Failed to request approval" });
      })
      .finally(() => setBladeSubmitting(false));
  }

  /** Submit (after approval) — creates actual tenant from approved draft */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleBladeSubmit() {
    if (!bladeDraftId) {
      window.alert("Please save a draft and request approval first.");
      return;
    }
    if (bladeApprovalStatus !== "approved") {
      window.alert("This draft must be approved by admin before submitting. Use 'Request HITL Approval' first.");
      return;
    }
    setBladeSubmitting(true);
    setBladeResult(null);
    submitApprovedDraft(bladeDraftId)
      .then((res) => {
        setBladeResult({ ok: true, msg: `Tenant created (ID: ${res.data.tenant_id})` });
        getAllClients()
          .then((r) => { setClients(r.data); if (r.data.length > 0 && !selectedClientId) setSelectedClientId(r.data[0].client_uid); })
          .catch(() => {});
        getAllTenants()
          .then((r) => { setTenants(r.data); if (r.data.length > 0 && !selectedId) setSelectedId(r.data[0].id); })
          .catch(() => {});
        setTimeout(() => { setBladeOpen(false); resetBladeForm(); }, 1500);
      })
      .catch((err) => {
        setBladeResult({ ok: false, msg: err?.message || "Failed to submit" });
      })
      .finally(() => setBladeSubmitting(false));
  }

  /** Create Client — calls POST /clients/create */
  function handleCreateClient() {
    if (!bladeName.trim()) { window.alert("Client name is required"); return; }
    if (!bladeEmail.trim()) { window.alert("Client email is required"); return; }
    const owner = authState.accountUid;
    if (!owner) { window.alert("You must be logged in to create a client"); return; }
    const payload = { client_name: bladeName.trim(), client_email: bladeEmail.trim(), client_owner: owner };
    setBladeSubmitting(true);
    setBladeResult(null);
    createClient(payload)
      .then(() => {
        setBladeResult({ ok: true, msg: `Client "${bladeName.trim()}" created successfully` });
        getAllClients()
          .then((r) => { setClients(r.data); if (r.data.length > 0 && !selectedClientId) setSelectedClientId(r.data[0].client_uid); })
          .catch(() => {});
        setTimeout(() => { setBladeOpen(false); resetBladeForm(); }, 1500);
      })
      .catch((err) => {
        console.error("[CreateClient] error:", err);
        setBladeResult({ ok: false, msg: err?.message || "Failed to create client" });
      })
      .finally(() => setBladeSubmitting(false));
  }

  const [clientSearch, setClientSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<"ALL" | "billing" | "subscription">("ALL");
  const [clientFilterOpen, setClientFilterOpen] = useState(false);

  const filteredClients = clients.filter((c) => {
    const q = clientSearch.toLowerCase();
    if (q && !c.client_name.toLowerCase().includes(q) && !c.client_email.toLowerCase().includes(q)) return false;
    return true;
  });

  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);

  const selectedClient = clients.find((c) => c.client_uid === selectedClientId) ?? null;

  // function exportUsageCsv() {
  //   const rows = [["Topic","Type","Tenant","Action","Tokens","Cost","Guardrail","Timestamp"]];
  //   usageEvents.forEach((e) => {
  //     rows.push([e.topic, e.type, e.tenant, e.action, String(e.tokens), e.cost, e.guardrail, e.timestamp]);
  //   });
  //   const csv = rows.map((r) => r.join(",")).join("\n");
  //   const blob = new Blob([csv], { type: "text/csv" });
  //   const url = URL.createObjectURL(blob);
  //   const a = document.createElement("a");
  //   a.href = url;
  //   a.download = "usage_events.csv";
  //   a.click();
  //   URL.revokeObjectURL(url);
  // }

  function refreshBalance() {
    if (!selectedClientId) return;
    getClientBalance(selectedClientId)
      .then((res) => setTokenBalance(res.data))
      .catch(() => {});
  }

  function exportCsv() {
    const rows = [["#","Client Name","Email","UID"]];
    clients.forEach((c, i) => {
      rows.push([String(i + 1), c.client_name, c.client_email, c.client_uid]);
    });
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clients.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden relative">
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-3 p-3">

          {/* ── Page Header ────────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <nav className="text-[11px] text-[#667781] mb-1">Asset &amp; Resource Governance &rsaquo; Clients &amp; Accounts</nav>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="font-black text-[16px] text-[#111B21]">Tenant Tower</div>
              <div className="text-[11px] text-[#667781]">Dealer → Client → Org • hard isolation enforced</div>
              {/* <div className="ml-auto flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-[#667781]">Tenant: ALL ▾</span>
                <span className={`text-[11px] font-black px-3 py-1 rounded-full ${darkBg}`}>RBAC: SYSTEM ADMIN</span>
                <span className="text-[11px] text-[#667781]">Tokens: 12.4M • Burn 22.1/s</span>
                <span className="text-[11px] text-[#667781]">Health: Kafka 1.2s • Redis 98%</span>
                <span className={`text-[11px] font-black px-3 py-1 rounded-full ${okBg}`}>Waswa</span>
              </div> */}
            </div>
          </div>

          {/* ── Quick Actions ──────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-2.5 flex items-center gap-3">
            <span className="font-black text-[13px] text-[#111B21] mr-2">Quick Actions</span>
            <PermissionGate permission="tenants.create">
              <Pill color="green" onClick={() => { resetBladeForm(); setBladeTab("Basics"); setBladeOpen(true); }}>+ New Tenant</Pill>
            </PermissionGate>
            {/* <Pill onClick={() => setSubOrgOpen(true)}>Create Sub-Org</Pill> */}
            <PermissionGate permission="tenants.create">
              <Pill onClick={() => setImportOpen(true)}>Import</Pill>
            </PermissionGate>
            <PermissionGate permission="tenants.delete">
              <Pill color="alarm" onClick={() => setTrashOpen(true)}>Trash/Restore</Pill>
            </PermissionGate>
          </div>

          {/* ════════════════════ TOP SCROLL ════════════════════════════════════ */}

          {/* ── 4 KPI Cards ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Total Clients",
                value: clients.length > 0 ? clients.length.toLocaleString() : "—",
                sub: clients.length > 0 ? `${clients.length} registered accounts` : "Loading...",
              },
              {
                label: "Total Subscriptions",
                value: activeSubStats ? activeSubStats.count.toLocaleString() : "—",
                sub: activeSubStats ? `${activeSubStats.count} active subscriptions` : "Loading...",
              },
              {
                label: "Expired Subscriptions",
                value: expiredStats ? new Set(expiredStats.subscriptions.map(s => s.client_uid)).size.toLocaleString() : "—",
                sub: expiredStats ? `${new Set(expiredStats.subscriptions.map(s => s.client_uid)).size} clients with expired subscriptions` : "Loading...",
              },
            ].map(k => (
              <div key={k.label} className="bg-white border border-[#E9EDEF] rounded-xl p-4">
                <div className="text-[12px] text-[#667781] font-extrabold">{k.label}</div>
                <div className="text-[26px] font-black text-[#111B21] mt-1 leading-tight">{k.value}</div>
                <div className="text-[11px] text-[#667781] mt-0.5">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* ── 2-col: Hierarchy Table | Selected Tenant ─────────────────────── */}
          <div className="grid grid-cols-[1.2fr_0.8fr] gap-3 items-start">

            {/* LEFT: Service Hierarchy — Clients */}
            <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
              <div className="flex flex-col gap-2 px-4 py-3 border-b border-[#E9EDEF]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-black text-[13px] text-[#111B21]">Service Hierarchy — Accounts</div>
                    <div className="text-[11px] text-[#667781] mt-0.5">{filteredClients.length} of {clients.length} clients</div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Pill onClick={() => { getAllClients().then((r) => setClients(r.data)).catch(() => {}); }}>Refresh</Pill>
                    <Pill onClick={exportCsv}>Export</Pill>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Search by name or email…"
                    className="flex-1 h-8 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] placeholder:text-[#9CA3AF] outline-none focus:border-[#128C7E] transition-colors bg-[#F8FAFC]"
                  />
                  <div className="relative">
                    <Pill onClick={() => setClientFilterOpen((v) => !v)}>Filter: {clientFilter} ▾</Pill>
                    {clientFilterOpen && (
                      <div className="absolute right-0 top-9 z-20 bg-white border border-[#E9EDEF] rounded-xl shadow-lg py-1 min-w-[130px]">
                        {(["ALL", "billing", "subscription"] as const).map((f) => (
                          <button
                            key={f}
                            onClick={() => { setClientFilter(f); setClientFilterOpen(false); }}
                            className={`w-full text-left px-4 py-2 text-[11px] font-black border-none cursor-pointer transition-colors ${
                              clientFilter === f ? "bg-[#EAF7F3] text-[#128C7E]" : "bg-white text-[#111B21] hover:bg-[#F8FAFC]"
                            }`}
                          >{f === "ALL" ? "All Clients" : f === "billing" ? "Billing Active" : "Subscribed"}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <table className="w-full text-[12px] table-fixed">
                <thead><tr className="bg-[#F8FAFC] border-b border-[#E9EDEF]">
                  {["#","Client Name","Email","UID","Actions"].map(h => (
                    <th key={h} className={`text-left px-3 py-2 font-black text-[#667781] ${h==="#"?"w-[40px]":""} ${h==="UID"?"w-[180px]":""} ${h==="Actions"?"w-[100px] text-center":""}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredClients.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-[12px] text-[#667781]">{clients.length === 0 ? "Loading clients…" : "No clients match search"}</td></tr>
                  ) : filteredClients.map((c, i) => {
                    const isSelected = c.client_uid === selectedClientId;
                    return (
                      <tr key={c.client_uid} onClick={() => setSelectedClientId(c.client_uid)} className={`border-b border-[#E9EDEF] last:border-0 hover:bg-[#F8FAFC] cursor-pointer ${isSelected ? "bg-[#EAF7F3]" : ""}`}>
                        <td className="px-3 py-2.5 text-[#667781]">{i + 1}</td>
                        <td className={`px-3 py-2.5 font-extrabold ${isSelected ? "text-[#128C7E]" : "text-[#111B21]"}`}>{c.client_name}</td>
                        <td className="px-3 py-2.5 text-[#667781]">{c.client_email}</td>
                        <td className="px-3 py-2.5 text-[#667781] font-mono text-[10px] truncate">{c.client_uid}</td>
                        <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => { setEditingClient(c); setEditName(c.client_name); setEditEmail(c.client_email); }}
                              className="h-6 px-2 rounded-md text-[10px] font-black border border-[#E9EDEF] bg-white text-[#128C7E] cursor-pointer hover:bg-[#EAF7F3] transition-colors"
                            >Edit</button>
                            <button
                              onClick={() => setDeletingClient(c)}
                              className="h-6 px-2 rounded-md text-[10px] font-black border border-[#E9EDEF] bg-white text-[#EF4444] cursor-pointer hover:bg-[#FEF2F2] transition-colors"
                            >Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* RIGHT: Selected Client Panel */}
            <div className="flex flex-col gap-3">
              {/* Client header */}
              <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
                <div className="text-[11px] text-[#667781] font-black">Selected Client</div>
                {selectedClient ? (
                  <>
                    <div className="font-black text-[16px] text-[#111B21] mt-1">{selectedClient.client_name}</div>
                    <div className="flex gap-1.5 flex-wrap mt-1.5 text-[10px]">
                      <span className="bg-[#F0F2F5] px-2 py-0.5 rounded-full text-[#667781]">{selectedClient.client_email}</span>
                    </div>
                    <div className="text-[11px] text-[#667781] mt-2 font-mono">{selectedClient.client_uid}</div>
                  </>
                ) : (
                  <div className="text-[12px] text-[#667781] mt-2">Click a client row to view details</div>
                )}
              </div>

              {/* Token Wallet */}
              <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
                <div className="font-black text-[13px] text-[#111B21]">Token Wallet</div>
                {tokenBalance ? (
                  <>
                    <div className="font-black text-[20px] text-[#111B21] mt-1">{tokenBalance.token_hours_left.toLocaleString()} <span className="text-[12px] font-black text-[#667781]">hrs left</span></div>
                    <div className="text-[11px] text-[#667781] mt-0.5">{tokenBalance.token_name} • Used: {tokenBalance.token_hours_used}h</div>
                  </>
                ) : (
                  <div className="text-[12px] text-[#667781] mt-2">{selectedClient ? "Loading balance..." : "Select a client"}</div>
                )}
                <div className="flex gap-2 mt-2">
                  <Pill onClick={() => setTopUpOpen(true)}>Buy Tokens</Pill>
                  <Pill onClick={() => setAllocateOpen(true)}>Transfer</Pill>
                </div>
              </div>

              {/* Payments & Gateways */}
              {/* <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
                <div className="font-black text-[13px] text-[#111B21]">Payments &amp; Gateways</div>
                <div className="font-black text-[11px] text-[#111B21] mt-2">Mobile Money</div>
                <div className="flex flex-col gap-1.5 mt-1.5">
                  {[
                    { n:"M-Pesa",   sr:"98.4%", lat:"p95 6.1s",  tone:"bg-[#25D366]" },
                    { n:"MTN MoMo", sr:"93.1%", lat:"p95 11.8s", tone:"bg-[#FBBF24]" },
                    { n:"Airtel",   sr:"97.0%", lat:"p95 7.4s",  tone:"bg-[#25D366]" },
                  ].map(g => (
                    <div key={g.n} className="flex items-center gap-2 text-[11px]">
                      <span className={`w-2 h-2 rounded-full ${g.tone}`} />
                      <span className="font-black text-[#111B21] w-[70px]">{g.n}</span>
                      <span className="text-[#111B21]">{g.sr}</span>
                      <span className="text-[#667781] ml-auto">{g.lat}</span>
                    </div>
                  ))}
                </div>
                <div className="font-black text-[11px] text-[#111B21] mt-3">Cards / ePayments</div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-[#667781]">
                  <span>Pesapal • DPO • Flutterwave • Visa/Mast…</span>
                  <Pill>Retry webhooks</Pill>
                </div>
              </div> */}

              {/* Client Devices */}
              <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#E9EDEF]">
                  <div>
                    <div className="font-black text-[13px] text-[#111B21]">Client Devices</div>
                    <div className="text-[11px] text-[#667781] mt-0.5">{selectedClient ? `${clientDevices.length} device(s) for ${selectedClient.client_name}` : "Select a client"}</div>
                  </div>
                </div>
                <div className="max-h-[260px] overflow-auto">
                  {!selectedClient ? (
                    <div className="px-4 py-6 text-center text-[12px] text-[#667781]">Click a client row to view devices</div>
                  ) : devicesLoading ? (
                    <div className="px-4 py-6 text-center text-[12px] text-[#667781]">Loading devices…</div>
                  ) : clientDevices.length === 0 ? (
                    <div className="px-4 py-6 text-center text-[12px] text-[#667781]">No devices found</div>
                  ) : clientDevices.map((d) => (
                    <div key={d.device_imei} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#E9EDEF] last:border-0 hover:bg-[#F8FAFC]">
                      <div className="flex-1 min-w-0">
                        <div className="font-extrabold text-[12px] text-[#111B21] truncate">{d.device_name}</div>
                        <div className="text-[10px] text-[#667781]">{d.car_make} {d.car_model} • {d.car_type} • {d.hardware} {d.hardware_model}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] font-mono text-[#667781]">IMEI: {d.device_imei}</div>
                        <div className="text-[10px] text-[#667781]">SIM: {d.simcard}</div>
                      </div>
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${d.billing_status === "running" ? okBg : alarmBg}`}>{d.billing_status}</span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${d.subscription_status === "running" ? okBg : alarmBg}`}>{d.subscription_status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ════════════════════ MID SCROLL ════════════════════════════════════ */}

          {/* ── Usage Events Ledger (moved to Billing module as Device Status Overview) ──
          <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E9EDEF]">
              <div>
                <div className="font-black text-[13px] text-[#111B21]">Usage Events Ledger (US-03)</div>
                <div className="text-[11px] text-[#667781] mt-0.5">Kafka topic: usage_events • immutable • idempotent</div>
              </div>
              <Pill onClick={exportUsageCsv}>Download CSV</Pill>
            </div>
            <table className="w-full text-[12px] table-fixed">
              <thead><tr className="bg-[#F8FAFC] border-b border-[#E9EDEF]">
                {["Topic","Type","Tenant","Action","Tokens","Cost","Guardrail"].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-black text-[#667781]">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {usageEvents.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-[12px] text-[#667781]">Loading…</td></tr>
                ) : usageEvents.map((u) => (
                  <tr key={u.id} className="border-b border-[#E9EDEF] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="px-3 py-2.5 text-[#667781]">{u.topic}</td>
                    <td className="px-3 py-2.5 font-extrabold text-[#111B21]">{u.type}</td>
                    <td className="px-3 py-2.5 text-[#111B21] truncate">{u.tenant}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{u.action}</td>
                    <td className={`px-3 py-2.5 font-black ${u.tokens > 1 ? "text-[#F97316]" : "text-[#667781]"}`}>{u.tokens.toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{u.cost}</td>
                    <td className="px-3 py-2.5 text-[#667781]">{u.guardrail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div> */}

          {/* ── Approvals Queue ───────────────────────────────────────────────
          <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E9EDEF]">
              <div className="flex items-center gap-2">
                <div>
                  <div className="font-black text-[13px] text-[#111B21]">Approvals Queue (HITL/HIC)</div>
                  <div className="text-[11px] text-[#667781] mt-0.5">High-risk actions require approval + audit trail</div>
                </div>
                {approvals.filter((a) => a.status === "pending").length > 0 && (
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${alarmBg}`}>
                    {approvals.filter((a) => a.status === "pending").length} pending
                  </span>
                )}
              </div>
              <Pill onClick={refreshApprovals}>{approvalsLoading ? "Refreshing…" : "Refresh"}</Pill>
            </div>
            <div className="flex flex-col">
              {approvalsLoading ? (
                <div className="px-4 py-6 text-center text-[12px] text-[#667781]">Loading approvals…</div>
              ) : approvals.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12px] text-[#667781]">No approval requests</div>
              ) : approvals.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-[#E9EDEF] last:border-0">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 uppercase ${
                    a.type === "mint" ? "bg-[#DBEAFE] text-[#1E40AF]"
                      : a.type === "tenant_onboarding" ? "bg-[#F3E8FF] text-[#7C3AED]"
                      : a.type === "hic" ? "bg-[#FEE2E2] text-[#991B1B]"
                      : "bg-[#FEF3C7] text-[#92400E]"
                  }`}>
                    {a.type === "tenant_onboarding" ? "ONBOARD" : a.type === "mint" ? "MINT" : a.type.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-[12px] text-[#111B21]">{a.title}</div>
                    <div className="text-[11px] text-[#667781] mt-0.5">
                      {a.tenant_name} • {a.requested_by}
                      {a.requested_at && <span className="ml-1 text-[10px] font-mono">{new Date(a.requested_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}</span>}
                    </div>
                  </div>
                  <span className={`text-[11px] font-black px-3 py-1 rounded-full whitespace-nowrap ${
                    a.requirement.includes("HIC") ? critBg : alarmBg
                  }`}>{a.requirement}</span>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      disabled={actioningId === a.id}
                      onClick={() => handleApprove(a.id)}
                      className={`h-7 px-3 rounded-full text-[11px] font-black border-none cursor-pointer transition-all ${okBg} hover:brightness-105 disabled:opacity-50`}
                    >{actioningId === a.id ? "…" : "Approve"}</button>
                    <button
                      disabled={actioningId === a.id}
                      onClick={() => handleReject(a.id)}
                      className={`h-7 px-3 rounded-full text-[11px] font-black border-none cursor-pointer transition-all ${critBg} hover:brightness-105 disabled:opacity-50`}
                    >{actioningId === a.id ? "…" : "Reject"}</button>
                    <button
                      onClick={() => handleDeleteApproval(a.id)}
                      className="h-7 px-3 rounded-full text-[11px] font-black border border-[#E9EDEF] bg-white text-[#667781] cursor-pointer hover:bg-[#F8FAFC] transition-all"
                    >Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div> */}

          {/* ════════════════════ BOTTOM SCROLL ═════════════════════════════════ */}

          {/* ── Audit Trail (Irrefutable) ─────────────────────────────────────
          <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E9EDEF]">
              <div className="font-black text-[13px] text-[#111B21]">Audit Trail (Irrefutable)</div>
              <div className="text-[11px] text-[#667781] mt-0.5">Hash-chained events • retention tied to plan</div>
            </div>
            <div className="flex flex-col">
              {auditTrail.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12px] text-[#667781]">Loading…</div>
              ) : auditTrail.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#E9EDEF] last:border-0">
                  <span className="text-[14px] text-[#667781]">☐</span>
                  <span className="text-[12px] font-mono text-[#667781] w-[60px] shrink-0">{a.timestamp ? new Date(a.timestamp).toLocaleTimeString("en-GB", { hour12: false }) : "—"}</span>
                  <span className="text-[11px] font-black text-[#128C7E] w-[40px] shrink-0">{a.tag}</span>
                  <span className="text-[12px] text-[#111B21] flex-1">{a.title}</span>
                  <span className="text-[11px] text-[#667781] font-mono">{a.actor}</span>
                  <span className="text-[10px] text-[#9CA3AF] font-mono" title={`prev: ${a.hash_prev}\nthis: ${a.hash_this}`}>#{a.hash_this.slice(0, 8)}</span>
                </div>
              ))}
            </div>
          </div> */}

          {/* ── Policy Violations & Opportunities ──────────────────────────────
          <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E9EDEF]">
              <div className="font-black text-[13px] text-[#111B21]">Policy Violations &amp; Opportunities</div>
              <div className="text-[11px] text-[#667781] mt-0.5">Hierarchy depth • template drift • leakage risk • FX anomalies</div>
            </div>
            <div className="flex flex-col">
              {VIOLATIONS.map((v, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[#E9EDEF] last:border-0 bg-[#F8FAFC]">
                  <span className="text-[14px]">{v.icon}</span>
                  <span className="font-extrabold text-[12px] text-[#111B21] flex-1">{v.title}</span>
                  <span className="text-[11px] text-[#667781]">{v.detail}</span>
                </div>
              ))}
            </div>
          </div> */}

          {/* ── Odoo ERP Sync ─────────────────────────────────────────────────── */}
          {/* <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3 flex items-center gap-4">
            <div className="font-black text-[13px] text-[#111B21]">Odoo ERP Sync</div>
            <div className="text-[11px] text-[#667781]">Invoices batch: 02:00 • Last sync: 10:12 • Failures: 0 • Webhook: /odoo/invoice</div>
            <span className={`text-[10px] font-black px-3 py-1 rounded-full ml-auto ${okBg}`}>Status: OK</span>
          </div> */}

        </div>
      </main>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <TrashRestoreModal open={trashOpen} onClose={() => setTrashOpen(false)} onRestored={() => { getAllClients().then((r) => setClients(r.data)).catch(() => {}); }} />
      <ImportTenantsModal open={importOpen} onClose={() => setImportOpen(false)} />
      {/* <CreateSubOrgModal open={subOrgOpen} onClose={() => setSubOrgOpen(false)} /> */}
      <TopUpModal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        clientUid={selectedClientId}
        clientName={selectedClient?.client_name ?? ""}
        tokenUid={tokenBalance?.token_uid ?? null}
        tokenName={tokenBalance?.token_name ?? ""}
        onSuccess={refreshBalance}
      />
      <AllocateModal
        open={allocateOpen}
        onClose={() => setAllocateOpen(false)}
        fromClientUid={selectedClientId}
        fromClientName={selectedClient?.client_name ?? ""}
        tokenBillingUid={tokenBalance?.token_billing_uid ?? null}
        onSuccess={refreshBalance}
      />

      {/* ── Edit Client Modal ───────────────────────────────────────────── */}
      {editingClient && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-[600]" onClick={() => setEditingClient(null)}>
          <div className="bg-white rounded-xl border border-[#E9EDEF] shadow-xl w-[400px] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="font-black text-[14px] text-[#111B21] mb-4">Edit Client</div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-black text-[#667781] mb-1 block">Client Name</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] bg-[#F8FAFC]" />
              </div>
              <div>
                <label className="text-[11px] font-black text-[#667781] mb-1 block">Client Email</label>
                <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] bg-[#F8FAFC]" />
              </div>
              <div className="text-[10px] text-[#667781] font-mono">UID: {editingClient.client_uid}</div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditingClient(null)} className="h-8 px-4 rounded-lg text-[12px] font-black border border-[#E9EDEF] bg-white text-[#667781] cursor-pointer hover:bg-[#F8FAFC]">Cancel</button>
              <button
                onClick={async () => {
                  const uid = editingClient.client_uid;
                  try {
                    await updateClient(uid, { client_name: editName, client_email: editEmail });
                    setClients((prev) => prev.map((c) => c.client_uid === uid ? { ...c, client_name: editName, client_email: editEmail } : c));
                    setEditingClient(null);
                  } catch (err) {
                    const msg = err instanceof ApiError ? (err.apiMessage ?? err.message) : "Failed to update client";
                    alert(msg);
                  }
                }}
                className="h-8 px-4 rounded-lg text-[12px] font-black border-none bg-[#128C7E] text-white cursor-pointer hover:brightness-105"
              >Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Client Confirmation ────────────────────────────────────── */}
      {deletingClient && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-[600]" onClick={() => setDeletingClient(null)}>
          <div className="bg-white rounded-xl border border-[#E9EDEF] shadow-xl w-[380px] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="font-black text-[14px] text-[#EF4444] mb-2">Delete Client</div>
            <div className="text-[12px] text-[#111B21] mb-1">
              Are you sure you want to delete <span className="font-black">{deletingClient.client_name}</span>?
            </div>
            <div className="text-[11px] text-[#667781] mb-4">The client will be moved to trash and can be restored within 30 days.</div>
            <div className="text-[10px] text-[#667781] font-mono mb-4">UID: {deletingClient.client_uid}</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeletingClient(null)} className="h-8 px-4 rounded-lg text-[12px] font-black border border-[#E9EDEF] bg-white text-[#667781] cursor-pointer hover:bg-[#F8FAFC]">Cancel</button>
              <button
                onClick={async () => {
                  const uid = deletingClient.client_uid;
                  const owner = authState.accountUid || "";
                  try {
                    await trashClient(uid, { deleted_by: owner });
                    setClients((prev) => prev.filter((c) => c.client_uid !== uid));
                    if (selectedClientId === uid) setSelectedClientId(null);
                    setDeletingClient(null);
                  } catch (err) {
                    const msg = err instanceof ApiError ? (err.apiMessage ?? err.message) : "Failed to delete client";
                    alert(msg);
                  }
                }}
                className="h-8 px-4 rounded-lg text-[12px] font-black border-none bg-[#EF4444] text-white cursor-pointer hover:brightness-105"
              >Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Right Blade: Create Tenant / Sub-Org ──────────────────────────── */}
      {bladeOpen && (
        <div className="w-[440px] shrink-0 bg-white border-l border-[#E9EDEF] flex flex-col overflow-hidden">
          {/* Blade header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#E9EDEF] shrink-0">
            <span className="font-black text-[14px] text-[#111B21]">Blade • Tenant Onboarding</span>
            <button onClick={() => setBladeOpen(false)} className="text-[11px] text-[#667781] bg-[#F0F2F5] border border-[#E9EDEF] rounded-lg px-3 py-1.5 cursor-pointer font-black hover:bg-[#E9EDEF]">ESC to close</button>
          </div>

          {/* Blade sub-header */}
          <div className="px-5 py-3 border-b border-[#E9EDEF] shrink-0">
            <div className="font-black text-[16px] text-[#111B21]">Create Tenant / Sub-Org</div>
            <div className="text-[11px] text-[#667781] mt-0.5">CRUD: Create • Update • Move to Trash • Restore</div>
            <div className="flex gap-1.5 mt-2">
              {MODAL_TABS.map(t => (
                <button
                  key={t}
                  onClick={() => setBladeTab(t)}
                  className={`h-8 px-3 rounded-full text-[11px] font-black border-none cursor-pointer transition-all ${
                    bladeTab === t ? "bg-[#128C7E] text-white" : "bg-[#F0F2F5] text-[#667781] hover:bg-[#E9EDEF]"
                  }`}
                >{t}</button>
              ))}
            </div>
          </div>

          {/* Blade body */}
          <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-5 py-4">

            {bladeTab === "Basics" && (
              <>
                <BladeSection title="Basics" sub="Hierarchy rules: Top cannot create units • dealer accounts should not host units">
                  <div className="grid grid-cols-2 gap-3 p-4">
                    <FormField label="Client / Tenant name" value={bladeName} onChange={setBladeName} placeholder="e.g. Kampala_Boda_Fleet" />
                    <FormField label="Email" value={bladeEmail} onChange={setBladeEmail} placeholder="e.g. admin@fleet.co" />
                    <SelectField label="Type" value={bladeTier} onChange={(v) => setBladeTier(v as TenantTier)} options={[
                      { value: "TOP", label: "TOP — Top-level" },
                      { value: "DEAL", label: "DEAL — Dealer" },
                      { value: "CLIENT", label: "CLIENT — Client" },
                      { value: "ORG", label: "ORG — Organisation" },
                    ]} />
                    <SelectField label="Parent account" value={bladeParent ?? ""} onChange={(v) => setBladeParent(v || null)} options={[
                      { value: "", label: "— None (root) —" },
                      ...tenants.map((t) => ({ value: t.id, label: `${t.name} (${t.tier})` })),
                    ]} />
                    <SelectField label="Country" value={bladeCountry} onChange={setBladeCountry} options={[
                      { value: "UG", label: "UG — Uganda" },
                      { value: "KE", label: "KE — Kenya" },
                      { value: "TZ", label: "TZ — Tanzania" },
                      { value: "RW", label: "RW — Rwanda" },
                      { value: "NG", label: "NG — Nigeria" },
                      { value: "GH", label: "GH — Ghana" },
                      { value: "ZA", label: "ZA — South Africa" },
                    ]} />
                    <SelectField label="Currency" value={bladeCurrency} onChange={setBladeCurrency} options={[
                      { value: "UGX", label: "UGX" },
                      { value: "KES", label: "KES" },
                      { value: "TZS", label: "TZS" },
                      { value: "RWF", label: "RWF" },
                      { value: "USD", label: "USD" },
                      { value: "EUR", label: "EUR" },
                      { value: "NGN", label: "NGN" },
                    ]} />
                    <SelectField label="Timezone" value={bladeTimezone} onChange={setBladeTimezone} options={[
                      { value: "Africa/Kampala", label: "Africa/Kampala" },
                      { value: "Africa/Nairobi", label: "Africa/Nairobi" },
                      { value: "Africa/Dar_es_Salaam", label: "Africa/Dar_es_Salaam" },
                      { value: "Africa/Kigali", label: "Africa/Kigali" },
                      { value: "Africa/Lagos", label: "Africa/Lagos" },
                      { value: "Africa/Johannesburg", label: "Africa/Johannesburg" },
                    ]} />
                  </div>
                </BladeSection>
              </>
            )}

            {bladeTab === "Billing & Tokens" && (
              <>
                <BladeSection title="Billing & Tokens (FIFO)" sub="US-02 FIFO queues per asset + domain • Safeguards: caps + 80% soft alert">
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Plan & Entitlements */}
                      <div>
                        <div className="font-black text-[12px] text-[#111B21] mb-2">Plan &amp; Entitlements</div>
                        <SelectField label="Billing plan" value={bladePlan} onChange={setBladePlan} options={[
                          { value: "OLIWA-BASIC", label: "OLIWA-BASIC" },
                          { value: "OLIWA-PLUS", label: "OLIWA-PLUS" },
                          { value: "OLIWA-PRO", label: "OLIWA-PRO" },
                          { value: "ENTERPRISE", label: "ENTERPRISE" },
                        ]} />
                        <SelectField label="History retention" value={bladeRetention} onChange={setBladeRetention} options={[
                          { value: "30", label: "30 days" },
                          { value: "60", label: "60 days" },
                          { value: "90", label: "90 days" },
                          { value: "180", label: "180 days" },
                          { value: "365", label: "365 days" },
                        ]} />
                        <FormField label="Daily token cap" value={bladeDailyCap} onChange={setBladeDailyCap} placeholder="e.g. 300000" />
                        <div className="text-[10px] text-[#667781] mt-1">Soft alert at 80% (configurable)</div>
                        <div className="text-[10px] text-[#667781] mt-1">Multi-currency: UGX/KES/USD/EUR/RWF/TZS</div>
                      </div>
                      {/* Top-Up Channels */}
                      <div>
                        <div className="font-black text-[12px] text-[#111B21] mb-2">Top-Up Channels</div>
                        {Object.entries(bladeChannels).map(([name, on]) => (
                          <div key={name} className="flex items-center justify-between py-1.5">
                            <span className="text-[12px] text-[#111B21]">{name}</span>
                            <Toggle on={on} onToggle={() => setBladeChannels(prev => ({ ...prev, [name]: !prev[name] }))} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </BladeSection>
              </>
            )}

            {bladeTab === "Modules" && (
              <BladeSection title="Modules & Add-Ons" sub="Enable/disable modules per tenant (RBAC-gated)">
                <div className="p-4 grid grid-cols-2 gap-3">
                  {Object.entries(bladeModules).map(([name, on]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-[12px] text-[#111B21]">{name}</span>
                      <Toggle on={on} onToggle={() => setBladeModules(prev => ({ ...prev, [name]: !prev[name] }))} />
                    </div>
                  ))}
                </div>
              </BladeSection>
            )}

            {bladeTab === "RBAC" && (
              <BladeSection title="RBAC Roles" sub="Assign roles from templates or create custom • Custom roles require HITL approval">
                <div className="p-4">
                  <div className="text-[10px] text-[#667781] mb-3">Select initial role templates for this tenant. Roles can be customised later.</div>
                  <div className="space-y-2">
                    {Object.entries(bladeRoles).map(([role, on]) => (
                      <div key={role} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[#F8FAFC]">
                        <div>
                          <span className="text-[12px] font-black text-[#111B21]">{role}</span>
                          <span className="text-[10px] text-[#667781] ml-2">
                            {role === "System Admin" && "Full access, all modules"}
                            {role === "Fleet Manager" && "OLIWA + PIKI + Fuel"}
                            {role === "Finance" && "Billing, wallet, reports"}
                            {role === "Read-Only Observer" && "View-only, no actions"}
                            {role === "VEBA Ops" && "Marketplace + AI console"}
                            {role === "Driver (mobile-only)" && "Mobile app, limited scope"}
                          </span>
                        </div>
                        <Toggle on={on} onToggle={() => setBladeRoles(prev => ({ ...prev, [role]: !prev[role] }))} />
                      </div>
                    ))}
                  </div>
                </div>
              </BladeSection>
            )}

            {bladeTab === "Review" && (
              <>
                <BladeSection title="Review & Submit (HITL/HIC)" sub="High-risk actions require approval + audit trail (Irreversible/Irrevocable/Irrefutable).">
                  <div className="p-4">
                    <div className="font-black text-[12px] text-[#111B21] mb-2">Risk checks</div>
                    {[
                      { check:"Cross-tenant share", result:"Blocked by policy" },
                      { check:"Price rule change",  result:"Requires approval" },
                      { check:"Refunds > threshold", result:"Requires HITL" },
                      { check:"Escrow payouts",     result:"Requires HIC if manual override" },
                      { check:"Data exports at scale",result:"Requires approval + logging" },
                    ].map(r => (
                      <div key={r.check} className="flex items-center gap-2 py-1.5 text-[11px]">
                        <span className="w-2 h-2 rounded-full bg-[#25D366] shrink-0" />
                        <span className="font-black text-[#111B21] w-[160px]">{r.check}</span>
                        <span className="text-[#667781]">{r.result}</span>
                      </div>
                    ))}
                  </div>
                </BladeSection>

                {/* Result feedback */}
                {bladeResult && (
                  <div className={`mx-4 mb-2 px-3 py-2 rounded-lg text-[11px] font-black ${bladeResult.ok ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>
                    {bladeResult.msg}
                  </div>
                )}

                {/* Summary of what will be created */}
                <BladeSection title="Summary" sub="Review the tenant details before submitting">
                  <div className="p-4 text-[12px] text-[#111B21] space-y-1.5">
                    <div className="font-black text-[11px] text-[#128C7E] mb-1">Basics</div>
                    <div><span className="text-[#667781] w-24 inline-block">Name:</span> <span className="font-black">{bladeName || "—"}</span></div>
                    <div><span className="text-[#667781] w-24 inline-block">Email:</span> <span className="font-black">{bladeEmail || "—"}</span></div>
                    <div><span className="text-[#667781] w-24 inline-block">Tier:</span> <span className="font-black">{bladeTier}</span></div>
                    <div><span className="text-[#667781] w-24 inline-block">Parent:</span> <span className="font-black">{bladeParent ? tenants.find(t => t.id === bladeParent)?.name ?? bladeParent : "None (root)"}</span></div>
                    <div><span className="text-[#667781] w-24 inline-block">Country:</span> <span className="font-black">{bladeCountry}</span></div>
                    <div><span className="text-[#667781] w-24 inline-block">Currency:</span> <span className="font-black">{bladeCurrency}</span></div>
                    <div><span className="text-[#667781] w-24 inline-block">Timezone:</span> <span className="font-black">{bladeTimezone}</span></div>

                    <div className="font-black text-[11px] text-[#128C7E] mt-3 mb-1">Billing & Tokens</div>
                    <div><span className="text-[#667781] w-24 inline-block">Plan:</span> <span className="font-black">{bladePlan}</span></div>
                    <div><span className="text-[#667781] w-24 inline-block">Retention:</span> <span className="font-black">{bladeRetention} days</span></div>
                    <div><span className="text-[#667781] w-24 inline-block">Daily cap:</span> <span className="font-black">{parseInt(bladeDailyCap, 10).toLocaleString()} tokens/day</span></div>
                    <div><span className="text-[#667781] w-24 inline-block">Channels:</span> <span className="font-black">{Object.entries(bladeChannels).filter(([,v]) => v).map(([k]) => k).join(", ") || "None"}</span></div>

                    <div className="font-black text-[11px] text-[#128C7E] mt-3 mb-1">Modules</div>
                    <div><span className="text-[#667781] w-24 inline-block">Enabled:</span> <span className="font-black">{Object.entries(bladeModules).filter(([,v]) => v).map(([k]) => k).join(", ") || "None"}</span></div>

                    <div className="font-black text-[11px] text-[#128C7E] mt-3 mb-1">RBAC Roles</div>
                    <div><span className="text-[#667781] w-24 inline-block">Assigned:</span> <span className="font-black">{Object.entries(bladeRoles).filter(([,v]) => v).map(([k]) => k).join(", ") || "None"}</span></div>
                  </div>
                </BladeSection>

                {/* Draft / Approval status indicator */}
                {bladeDraftId && (
                  <div className="mx-0 mb-2 px-3 py-2 rounded-lg text-[11px] font-black bg-[#F0F2F5] text-[#667781] flex items-center gap-2">
                    <span>Draft: {bladeDraftId}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                      bladeApprovalStatus === "approved" ? okBg
                        : bladeApprovalStatus === "pending_approval" ? alarmBg
                        : "bg-[#E9EDEF] text-[#667781]"
                    }`}>
                      {bladeApprovalStatus === "approved" ? "APPROVED" : bladeApprovalStatus === "pending_approval" ? "PENDING APPROVAL" : "DRAFT"}
                    </span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleSaveDraft}
                    disabled={bladeSubmitting || !bladeName.trim()}
                    className={`h-7 px-3 rounded-full text-[11px] font-black border-none cursor-pointer hover:brightness-105 active:opacity-85 transition-all whitespace-nowrap ${
                      bladeSubmitting || !bladeName.trim() ? "bg-[#D1D5DB] text-[#9CA3AF] cursor-not-allowed" : "bg-white border border-[#E9EDEF] text-[#667781]"
                    }`}
                  >
                    {bladeSubmitting && !bladeApprovalStatus ? "Saving…" : bladeDraftId ? "Update Draft" : "Save Draft"}
                  </button>
                  <button
                    onClick={handleCreateClient}
                    disabled={bladeSubmitting || !bladeName.trim() || !bladeEmail.trim()}
                    className={`h-7 px-3 rounded-full text-[11px] font-black border-none cursor-pointer transition-all whitespace-nowrap ${
                      bladeSubmitting || !bladeName.trim() || !bladeEmail.trim()
                        ? "bg-[#D1D5DB] text-[#9CA3AF] cursor-not-allowed"
                        : `${okBg} hover:brightness-110`
                    }`}
                  >
                    {bladeSubmitting ? "Creating…" : "Create Client"}
                  </button>
                </div>

                {/* Audit Proof */}
                <BladeSection title="Audit Proof" sub="Every change is hash-chained and retained per plan.">
                  <div className="p-4">
                    <pre className="text-[11px] text-[#667781] font-mono bg-[#F8FAFC] rounded-lg p-3 leading-relaxed whitespace-pre-wrap">
{`hash_prev: 6b2f…e91a
hash_this:  1c0d…7a22
actor: system_admin@tenant
action: create_tenant_draft
timestamp: 2026-02-24T10:22:18Z
sig: ed25519: 93af_0c1e`}
                    </pre>
                  </div>
                </BladeSection>
              </>
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
  alarm: "bg-[#F97316] text-white",
  ghost: "bg-white border border-[#E9EDEF] text-[#667781]",
};

function Pill({ color = "ghost", onClick, children }: { color?: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`h-7 px-3 rounded-full text-[11px] font-black border-none cursor-pointer hover:brightness-105 active:opacity-85 transition-all whitespace-nowrap ${pillStyles[color] ?? pillStyles.ghost}`}>
      {children}
    </button>
  );
}

function BladeSection({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 border border-[#E9EDEF] rounded-xl overflow-hidden bg-white">
      <div className="px-4 py-2.5 border-b border-[#E9EDEF]">
        <div className="font-black text-[13px] text-[#111B21]">{title}</div>
        {sub && <div className="text-[10px] text-[#667781] mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function FormField({ label, value, onChange, placeholder }: { label: string; value: string; onChange?: (v: string) => void; placeholder?: string }) {
  return (
    <div className="mb-2">
      <div className="text-[10px] font-black text-[#667781] mb-1">{label}</div>
      <input
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={!onChange}
        placeholder={placeholder}
        className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-[#F8FAFC] px-3 text-[12px] font-black text-[#111B21] outline-none focus:border-[#128C7E] transition-colors"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="mb-2">
      <div className="text-[10px] font-black text-[#667781] mb-1">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-[#F8FAFC] px-3 text-[12px] font-black text-[#111B21] outline-none focus:border-[#128C7E] transition-colors appearance-none cursor-pointer"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle?: () => void }) {
  return (
    <div
      onClick={onToggle}
      className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${on ? "bg-[#128C7E]" : "bg-[#D1D5DB]"}`}
    >
      <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all shadow-sm ${on ? "left-[22px]" : "left-0.5"}`} />
    </div>
  );
}