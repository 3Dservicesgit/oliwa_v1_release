/**
 * AegisDashboard — Screen 01: AEGIS Command Centre (Ops + Biz Dashboard)
 *
 * Matches all 7 screenshots pixel-accurately.
 *
 * ── Existing reused components ──────────────────────────────────────────────
 *   NavRail              → primary side icon rail (desktop vertical / mobile bottom tabs)
 *   AccordionSidebar     → grouped collapsible module navigation (left sidebar)
 *   OpsKpiCard           → 3-column KPI cards (top grid: active units, token burn, payments)
 *   WaswaAIPanel         → right-side AI panel (persistent in layout, hidden on mobile)
 *   HITLApprovalTable    → HITL approvals queue table (bottom section)
 *
 * ── New components built for this screen ───────────────────────────────────
 *   AegisTopBar          → unique top bar: tenant selector, wallet, burn, live ticker, Waswa toggle
 *   AegisStatusStrip     → secondary context strip below top bar
 *   TaskManagerTable     → system health live task manager (CPU/RAM/restarts/lag/status)
 *   PaymentGatewaysCard  → Mobile Money + ePayment gateways health
 *   TokenEngineCard      → Token Engine dual economy card
 *   VebaGovernanceTable  → VEBA marketplace governance / leakage prevention table
 *   AuditTrailCard       → Audit-grade trail (irrefutable) with timestamped entries
 *   WaswaDrawer          → floating slide-in Waswa AI chat drawer
 *   TokenTopupModal      → Top-up tokens via MoMo + ePayment (rebuilt to match screenshot)
 *
 * ── Airlock modal overlay ───────────────────────────────────────────────────
 *   Per screenshots 1+2: the login/MFA form renders as a centred modal over the
 *   blurred dashboard — NOT as a separate full-page route.
 *   AirlockModal is an inline component below.
 */
import React, { useState, useEffect } from "react";

// ── Existing shared components ───────────────────────────────────────────────
import { NavRail }           from "../../components/navigation";
import { AccordionSidebar }  from "../../components/navigation";
// import { WaswaAIPanel }      from "../../components/waswa";
import type { ApprovalRow }  from "./components/HITLApprovalTable";
import { HITLApprovalTable } from "./components/HITLApprovalTable";

// ── New components ───────────────────────────────────────────────────────────
// import { AegisStatusStrip }      from "./components/AegisStatusStrip";
import { TaskManagerTable }      from "./components/TaskManagerTable";
import { VebaGovernanceTable }   from "./components/VebaGovernanceTable";
import { AuditTrailCard }        from "./components/AuditTrailCard";
import { TokenTopupModal }       from "../tokens/components/TokenTopupModal";

// ── Auth & API ──────────────────────────────────────────────────────────────
import { useAuth } from "../../auth/AuthContext";
import { getCookie } from "../../utils/cookies";
import { getRaw } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";

// ─────────────────────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────────────────────

// const AEGIS_TICKER = [
//   "Forecast: Healthy",
//   "API 99.95%",
//   "Socket Threads-Open: 5",
// ];

const AEGIS_NAV_ITEMS = [
  { key: "home",     glyph: "⌂",  label: "Home",         path: "/"         },
  { key: "health",   glyph: "♥",  label: "Health",       path: "/health"   },
  { key: "alarms",   glyph: "!",  label: "Alarms",       path: "/alarms"   },
  { key: "tokens",   glyph: "T",  label: "Tokens",       path: "/tokens"   },
  { key: "billing",  glyph: "$",  label: "Billing",      path: "/billing"  },
  { key: "veba",     glyph: "V",  label: "VEBA",         path: "/veba"     },
  { key: "waswa",    glyph: "W",  label: "Waswa AI",     path: "/ai"       },
  { key: "rbac",     glyph: "R",  label: "RBAC",         path: "/rbac"     },
  { key: "settings", glyph: "⚙",  label: "Settings",     path: "/audit"    },
  { key: "mobile",   glyph: "📱", label: "Mobile",       path: "/payments" },
];

const AEGIS_SIDEBAR_GROUPS = [
  {
    id: "cmd",
    title: "Command & Control",
    icon: "⌂",
    items: [
      { id: "login",   label: "Login & SSO",        path: "/airlock" },
      { id: "ops",     label: "Ops + Biz Dash",     path: "/aegis"   },
      { id: "syshealth",label:"System Health CMS",  path: "/health"  },
      { id: "alarms",  label: "Alarm Center",       path: "/alarms"  },
      { id: "ai",      label: "AI Console",         path: "/ai"      },
      { id: "logout",  label: "Logout Trail",       path: "/audit"   },
    ],
  },
  {
    id: "tokenomics",
    title: "Tokenomics & Revenue",
    icon: "₳",
    items: [
      { id: "tokens",   label: "Token Engine",       path: "/tokens"   },
      { id: "payments", label: "Payments Gateways",  path: "/payments" },
      { id: "billing",  label: "Billing",            path: "/billing"  },
    ],
  },
  {
    id: "infra",
    title: "Infrastructure & Connectivity",
    icon: "⚙",
    items: [
      { id: "kafka", label: "Kafka / Queues", path: "/health" },
      { id: "redis", label: "Redis / Cache",  path: "/health" },
      { id: "dbs",   label: "Databases",     path: "/health" },
    ],
  },
  {
    id: "asset",
    title: "Asset & Resource Governance",
    icon: "V",
    items: [
      { id: "veba-gov",   label: "VEBA Governance",  path: "/veba"  },
      { id: "veba-books", label: "VEBA Bookings Ops",path: "/veba"  },
    ],
  },
  {
    id: "telem",
    title: "Telematics & GIS Ops",
    icon: "📡",
    items: [
      { id: "gis",  label: "GIS Live Intelligence", path: "/veba"  },
      { id: "track",label: "Fleet Tracking",        path: "/veba"  },
    ],
  },
  {
    id: "veba-mkt",
    title: "VEBA Marketplace",
    icon: "🏪",
    items: [
      { id: "veba-mkt-home", label: "Rental Ops",  path: "/veba" },
      { id: "leakage",       label: "Leakage Ops", path: "/veba" },
    ],
  },
  {
    id: "utility",
    title: "Utility & Support",
    icon: "?",
    items: [
      { id: "ecosystem", label: "The Ecosystem", path: "/audit" },
      { id: "rbac",      label: "RBAC",          path: "/rbac"  },
      { id: "audit",     label: "Audit Trail",   path: "/audit" },
    ],
  },
];

const HITL_ROWS: ApprovalRow[] = [
  { id: "h1", time: "09:14", action: "Price rule change (OLIWA-PLUS) — +10%",   state: "Pending",  actor: "Waswa AI"    },
  { id: "h2", time: "09:02", action: "Refund > UGX 2,000,000 — INV-8841",       state: "Pending",  actor: "Billing Bot" },
  { id: "h3", time: "08:51", action: "VEBA dispute payout hold — BK-1192",      state: "Pending",  actor: "Waswa AI"    },
  { id: "h4", time: "08:40", action: "Data export (10k rows) — Reports",         state: "Approved", actor: "Admin SA"    },
  { id: "h5", time: "08:22", action: "AI model deploy (Waswa-SLM v2.6)",         state: "Pending",  actor: "Waswa AI"    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────



export function AegisDashboard() {
  const { state }              = useAuth();
  const [topupOpen,      setTopupOpen]      = useState(false);
  // Show Airlock modal if not authenticated
  const [airlockOpen,    setAirlockOpen]    = useState(() => !getCookie("account_uid"));
  // Statistics metrics state
  const [unitsOnline,    setUnitsOnline]    = useState({ count: 0, total: 0 });
  const [unitsOffline,   setUnitsOffline]   = useState({ count: 0 });
  const [vebaEnabled,    setVebaEnabled]    = useState(0);
  const [vebaDisabled,   setVebaDisabled]   = useState(0);
  const [vebaTokensActive, setVebaTokensActive] = useState(0);
  const [vebaTokensExpired, setVebaTokensExpired] = useState(0);

  // Loading states
  const [loadingUnitsOnline, setLoadingUnitsOnline] = useState(true);
  const [loadingUnitsOffline, setLoadingUnitsOffline] = useState(true);
  const [loadingVebaEnabled, setLoadingVebaEnabled] = useState(true);
  const [loadingVebaDisabled, setLoadingVebaDisabled] = useState(true);
  const [loadingVebaTokensActive, setLoadingVebaTokensActive] = useState(true);
  const [loadingVebaTokensExpired, setLoadingVebaTokensExpired] = useState(true);

  // Fetch all statistics via centralised API client
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [onlineRes, offlineRes, enabledRes, disabledRes, activeRes, expiredRes] = await Promise.all([
          getRaw<{ status: string; data: { count: number; total_configured_units: number } }>(ENDPOINTS.STATISTICS.UNITS_ONLINE),
          getRaw<{ status: string; data: { count: number } }>(ENDPOINTS.STATISTICS.UNITS_OFFLINE),
          getRaw<{ status: string; data: { count: number } }>(ENDPOINTS.STATISTICS.VEBA_UNITS_ENABLED),
          getRaw<{ status: string; data: { count: number } }>(ENDPOINTS.STATISTICS.VEBA_UNITS_DISABLED),
          getRaw<{ status: string; data: { count: number } }>(ENDPOINTS.STATISTICS.VEBA_TOKENS_ACTIVE),
          getRaw<{ status: string; data: { count: number } }>(ENDPOINTS.STATISTICS.VEBA_TOKENS_EXPIRED),
        ]);

        if (onlineRes?.status === "success") {
          setUnitsOnline({ count: onlineRes.data?.count ?? 0, total: onlineRes.data?.total_configured_units ?? 0 });
        }
        setLoadingUnitsOnline(false);

        if (offlineRes?.status === "success") {
          setUnitsOffline({ count: offlineRes.data?.count ?? 0 });
        }
        setLoadingUnitsOffline(false);

        if (enabledRes?.status === "success") {
          setVebaEnabled(enabledRes.data?.count ?? 0);
        }
        setLoadingVebaEnabled(false);

        if (disabledRes?.status === "success") {
          setVebaDisabled(disabledRes.data?.count ?? 0);
        }
        setLoadingVebaDisabled(false);

        if (activeRes?.status === "success") {
          setVebaTokensActive(activeRes.data?.count ?? 0);
        }
        setLoadingVebaTokensActive(false);

        if (expiredRes?.status === "success") {
          setVebaTokensExpired(expiredRes.data?.count ?? 0);
        }
        setLoadingVebaTokensExpired(false);
      } catch (e) {
        console.error("Failed to fetch statistics", e);
        setLoadingUnitsOnline(false);
        setLoadingUnitsOffline(false);
        setLoadingVebaEnabled(false);
        setLoadingVebaDisabled(false);
        setLoadingVebaTokensActive(false);
        setLoadingVebaTokensExpired(false);
      }
    };

    fetchStats();
  }, []);
  return (
    <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col gap-3 p-3 pb-14 md:pb-3 bg-[#F0F2F5]">

          {/* Page heading */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3 flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <nav className="text-[11px] text-[#667781] mb-1">
                Home &rsaquo; Ops + Biz Dash &rsaquo; AEGIS Overview
              </nav>
              <div className="font-black text-[16px] text-[#111B21]">
                Ops + Biz Dashboard — Strategic Overseer
              </div>
              <div className="text-[11px] text-[#667781] mt-0.5">
                Live: Kafka→Redis→SSE (≤3s). All high-risk actions require HITL/HIC approval + audit.
              </div>
            </div>
            {/* <div className="flex gap-2 flex-wrap ml-auto shrink-0">
              <ActionPill color="green">+ New…</ActionPill>
              <ActionPill color="azure">Open Approvals</ActionPill>
              <ActionPill color="ghost">⋮</ActionPill>
            </div> */}
          </div>

          {/* KPI grid — 3 large cards matching screenshot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <BigKpiCard
              label="Active units online (all tenants)"
              value={`${unitsOnline.count.toLocaleString()} / ${unitsOnline.total.toLocaleString()}`}
              delta="+0.6% vs 1h"
              deltaColor="green"
              isLoading={loadingUnitsOnline}
            />
            <BigKpiCard
              label="Units Offline (all tenants)"
              value={unitsOffline.count.toLocaleString()}
              delta="+12% spike"
              deltaColor="green"
              isLoading={loadingUnitsOffline}
            />
            <BigKpiCard
              label="VEBA Enabled Units (all tenants)"
              value={vebaEnabled.toLocaleString()}
              delta="-1.2%"
              deltaColor="red"
              isLoading={loadingVebaEnabled}
            />
          </div>

          {/* Second KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <BigKpiCard label="VEBA Disabled Units (all tenants)"  value={vebaDisabled.toLocaleString()}  delta="+8.4%"  deltaColor="green" isLoading={loadingVebaDisabled} />
            <BigKpiCard label="VEBA Tokens Expired (all tenants)"       value={vebaTokensExpired.toLocaleString()}    delta="±0%"    deltaColor="muted" isLoading={loadingVebaTokensExpired}  />
            <BigKpiCard label="VEBA Tokens Active (all tenants)"          value={vebaTokensActive.toLocaleString()}      delta="+2"     deltaColor="green" isLoading={loadingVebaTokensActive}  />
          </div>

          {/* Task manager table */}
          <TaskManagerTable />

          {/* VEBA Governance table */}
          <VebaGovernanceTable />

          {/* HITL Approvals Table — full data table */}
          <HITLApprovalTable rows={HITL_ROWS} />

          {/* Audit trail */}
          <AuditTrailCard />

          {/* System metrics footer */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <div className="text-[11px] text-[#667781]">
              Kafka: 12s lag&nbsp;•&nbsp;Redis: 97% hit&nbsp;•&nbsp;Cassandra write p95 9ms&nbsp;•&nbsp;MoMo retries 41&nbsp;•&nbsp;UI refresh 30s
            </div>
          </div>
      {/* Floating Waswa W button */}
      <button
        onClick={() => setWaswaDrawerOpen(true)}
        aria-label="Open Waswa AI"
        className="
          fixed right-5 bottom-20 z-[300] lg:bottom-5
          w-14 h-14 rounded-full border-none
          bg-[#25D366] text-white font-black text-[22px]
          shadow-[0_12px_30px_rgba(0,0,0,0.18)]
          cursor-pointer hover:brightness-105 active:scale-95 transition-all
          grid place-items-center
        "
      >
        W
      </button>

      {/* Modals + drawers */}
      <TokenTopupModal open={topupOpen} onClose={() => setTopupOpen(false)} />

      {/* Airlock login modal overlay */}
      <AirlockModal open={airlockOpen} onClose={() => setAirlockOpen(false)} />
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BigKpiCard — large 2-line KPI card matching screenshot top grid
// ─────────────────────────────────────────────────────────────────────────────

function BigKpiCard({
  label,
  value,
  delta,
  deltaColor = "green",
  isLoading = false,
}: {
  label:       string;
  value:       string;
  delta:       string;
  deltaColor?: "green" | "red" | "muted";
  isLoading?:  boolean;
}) {
  const deltaCls = {
    green: "text-[#25D366]",
    red:   "text-[#EF4444]",
    muted: "text-[#667781]",
  }[deltaColor];

  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl p-4 min-h-[90px] flex flex-col gap-1">
      <div className="text-[11px] text-[#667781]">{label}</div>
      {isLoading ? (
        <>
          <div className="h-7 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-4 bg-gray-200 rounded-lg animate-pulse" />
        </>
      ) : (
        <>
          <div className="text-[24px] font-black text-[#111B21] leading-tight">{value}</div>
          <div className={`text-[12px] font-extrabold ${deltaCls}`}>{delta}</div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActionPill — header action buttons
// ─────────────────────────────────────────────────────────────────────────────

const pillCls: Record<string, string> = {
  green: "bg-[#25D366] text-[#075E54]",
  azure: "bg-[#34B7F1] text-white",
  ghost: "bg-white border border-[#E9EDEF] text-[#667781]",
};

function ActionPill({ color = "ghost", onClick, children }: { color?: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-4 rounded-full text-[12px] font-extrabold border-none cursor-pointer hover:brightness-105 active:opacity-85 transition-all whitespace-nowrap ${pillCls[color]}`}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AirlockModal — login / MFA overlay matching screenshots 1 & 2
// Renders over the blurred dashboard background
// ─────────────────────────────────────────────────────────────────────────────

function AirlockModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, login, verifyMfa, resendMfa } = useAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [mfa,      setMfa]      = useState("");
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    // Close modal if auth state indicates authenticated OR if account_uid cookie exists
    if (state.status === "authenticated" || getCookie("_nvxs_account_uid")) { onClose(); }
  }, [state.status]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  if (!open) return null;

  const handleLogin = async () => {
    setBusy(true); setErr(null);
    try {
      await login(email, password);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally { setBusy(false); }
  };

  const handleVerify = async () => {
    setBusy(true); setErr(null);
    try { await verifyMfa(mfa); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "MFA failed"); }
    finally { setBusy(false); }
  };

  const handleResendMfa = async () => {
    if (resendCooldown > 0) return;
    try {
      await resendMfa();
      setResendCooldown(60);
    } catch {
      setErr("Failed to resend code. Try again.");
    }
  };

  const handleForgotPassword = () => {
    // TODO: Implement forgot password modal/flow once backend supports it
    alert("Password reset is not yet available. Please contact your administrator.");
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center pt-[60px] px-4">
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />

      {/* Modal card */}
      <div className="relative z-[1] w-full max-w-[560px] bg-white rounded-2xl border border-[#E9EDEF] shadow-[0_20px_60px_rgba(0,0,0,0.18)] overflow-hidden">

        {/* Card header */}
        <div className="px-6 pt-5 pb-4">
          <div className="font-black text-[18px] text-[#111B21]">
            3D SERVICES: Login &amp; Authentication
          </div>
          <div className="text-[12px] text-[#667781] mt-1">
            Please Enter Your Credentials to Access the System
          </div>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-4">

          {/* Step 1: credentials */}
          {state.status === "logged_out" && (
            <>
              <AirlockField label="Enter Username">
                <AirlockInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="Username"
                />
              </AirlockField>

              <AirlockField label="Enter Password">
                <AirlockInput
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </AirlockField>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-[12px] text-[#667781] cursor-pointer">
                  <input type="checkbox" defaultChecked className="accent-[#128C7E]" />
                  Remember device (30 days)
                </label>
                <button
                  onClick={handleForgotPassword}
                  className="text-[12px] font-extrabold text-[#34B7F1] bg-transparent border-none cursor-pointer hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              {err && <div className="text-[12px] font-extrabold text-[#EF4444]">{err}</div>}

              <AirlockPrimaryBtn onClick={handleLogin} disabled={busy}>
                {busy ? "Signing in…" : "Login →"}
              </AirlockPrimaryBtn>

             

              {/* Security notice */}
              <div className="bg-[#E8F5F2] border border-[#BFE7E0] rounded-xl px-4 py-3">
                <div className="font-black text-[12px] text-[#128C7E]">Security</div>
                <ul className="mt-1.5 text-[11px] text-[#128C7E] flex flex-col gap-1 list-disc pl-4">
                  <li>MFA required for SYS_ADMIN</li>
                  <li>Suspicious logins trigger step-up auth</li>
                  <li>All actions audit-logged (Irrefutable)</li>
                </ul>
              </div>
            </>
          )}

          {/* Step 2: MFA */}
          {state.status === "mfa_required" && (
            <>
              <div>
                <div className="font-extrabold text-[13px] text-[#111B21]">
                  Step 2/2 — Multi‑Factor Authentication
                </div>
                <div className="text-[11px] text-[#667781] mt-1">
                  We sent a one-time code to WhatsApp +256 *** **45 (fallback SMS).
                </div>
              </div>

              <AirlockField label="Enter 6-digit code:">
                <AirlockInput
                  type="text"
                  value={mfa}
                  onChange={(e) => setMfa(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  className="text-center tracking-[0.3em] font-black text-[18px]"
                />
              </AirlockField>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-[12px] text-[#667781] cursor-pointer">
                  <input type="checkbox" defaultChecked className="accent-[#128C7E]" />
                  Trust this device (admin policy: 30d)
                </label>
                <button
                  onClick={handleResendMfa}
                  disabled={resendCooldown > 0}
                  className="text-[12px] font-extrabold text-[#34B7F1] bg-transparent border-none cursor-pointer hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
                </button>
              </div>

              {err && <div className="text-[12px] font-extrabold text-[#EF4444]">{err}</div>}

              <AirlockPrimaryBtn onClick={handleVerify} disabled={busy}>
                {busy ? "Verifying…" : "Verify & Enter →"}
              </AirlockPrimaryBtn>

              {/* Login watchlist */}
              <div className="bg-[#F8F9FA] border border-[#E9EDEF] rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#E9EDEF]">
                  <div className="font-extrabold text-[12px] text-[#111B21]">Login &amp; SSO Watchlist (last 15m)</div>
                </div>
                <div className="flex flex-col divide-y divide-[#E9EDEF]">
                  {[
                    { dot: "bg-[#25D366]", label: "Auth latency p95",       val: "1.6s"  },
                    { dot: "bg-[#FBBF24]", label: "Failed logins",          val: "12/min"},
                    { dot: "bg-[#25D366]", label: "MFA delivery failures",  val: "1.8%"  },
                    { dot: "bg-[#FBBF24]", label: "Suspicious geo logins",  val: "2"     },
                    { dot: "bg-[#25D366]", label: "Privilege elevation attempts", val: "0"},
                  ].map((row, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${row.dot}`} />
                      <span className="flex-1 text-[12px] text-[#111B21]">{row.label}</span>
                      <span className="text-[12px] font-extrabold text-[#111B21]">{row.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* HIC note */}
              <div className="bg-[#FFF8E1] border border-[#FFE08A] rounded-xl px-4 py-3">
                <div className="font-extrabold text-[12px] text-[#7A5E00]">HIC note</div>
                <div className="text-[12px] text-[#7A5E00] mt-1 leading-snug">
                  High-risk actions (pricing, refunds, suspend, exports, kill-switch) require approval + audit trail.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Airlock sub-components ───────────────────────────────────────────────────

function AirlockField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] text-[#667781]">{label}</label>
      {children}
    </div>
  );
}

function AirlockInput(props: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-xl border border-[#E9EDEF] bg-white px-4 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E] transition-colors ${props.className ?? ""}`}
    />
  );
}

function AirlockPrimaryBtn({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full h-12 rounded-xl border-none bg-[#25D366] text-[#075E54] font-black text-[15px] cursor-pointer hover:brightness-105 active:opacity-85 transition-all disabled:opacity-50"
    >
      {children}
    </button>
  );
}