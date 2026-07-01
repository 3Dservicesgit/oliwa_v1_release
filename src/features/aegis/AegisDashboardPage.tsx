/**
 * AegisDashboard — Customer Dashboard
 *
 * Clean customer-facing overview showing:
 *   - KPI stat cards (devices, tokens, subscriptions)
 *   - Data fetched for the logged-in customer only
 *
 * SECURITY: All stats use the logged-in customer's ownerUid from AuthContext.
 */
import React, { useState, useEffect } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getCookie } from "../../utils/cookies";
import { getClientDevices, getClientBalance } from "../../api/services/clients.service";
import { getClientTransactions } from "../../api/services/billing.service";
import { TokenTopupModal } from "../tokens/components/TokenTopupModal";
import type { ClientDevice, ClientTokenBalance, ClientTransaction } from "../../api/types";

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export function AegisDashboard() {
  const { state, login, verifyMfa, resendMfa } = useAuth();
  const [topupOpen, setTopupOpen] = useState(false);
  const [airlockOpen, setAirlockOpen] = useState(() => !getCookie("_nvxs_account_uid"));

  // Customer's ownerUid (individual user) and clientUid (the client they belong to)
  const ownerUid = state.accountUid || getCookie("_nvxs_account_uid") || "";
  const clientUid = state.accountRoot || getCookie("_nvxs_account_root") || "";
  const customerName = getCookie("_nvxs_account_type") || "Customer";

  // Stats state
  const [devices, setDevices] = useState<ClientDevice[]>([]);
  const [balances, setBalances] = useState<ClientTokenBalance[]>([]);
  const [transactions, setTransactions] = useState<ClientTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch customer-specific stats
  // Devices belong to the CLIENT (accountRoot), not the individual user.
  useEffect(() => {
    if (!ownerUid) { setLoading(false); return; }
    // Must have a valid clientUid to fetch devices
    if (!clientUid) { setLoading(false); return; }

    let cancelled = false;

    const fetchStats = async () => {
      setLoading(true);
      console.log("[Dashboard] Fetching stats — ownerUid:", ownerUid, "clientUid:", clientUid);

      // Helper: call an API with a 10-second timeout.
      // Returns data on success, null on any error (incl. 400 "no data" or timeout).
      const safeFetch = async <T,>(fn: () => Promise<{ data: T }>, label: string): Promise<T | null> => {
        try {
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 10000),
          );
          const res = await Promise.race([fn(), timeout]) as { data: T };
          console.log(`[Dashboard] ${label} OK`);
          return res.data;
        } catch (err) {
          console.warn(`[Dashboard] ${label} failed:`, err);
          return null;
        }
      };

      // Use allSettled so one hanging/slow call doesn't block the rest
      const results = await Promise.allSettled([
        safeFetch(() => getClientDevices(clientUid), "devices"),
        safeFetch(() => getClientBalance(clientUid), "balance"),
        safeFetch(() => getClientTransactions(clientUid), "transactions"),
      ]);

      if (cancelled) return;

      const devData = results[0].status === "fulfilled" ? results[0].value : null;
      const balData = results[1].status === "fulfilled" ? results[1].value : null;
      const txnData = results[2].status === "fulfilled" ? results[2].value : null;

      if (devData) setDevices(Array.isArray(devData) ? devData : []);
      if (balData) {
        if (Array.isArray(balData)) setBalances(balData);
        else if (typeof balData === "object") setBalances([balData as ClientTokenBalance]);
      }
      if (txnData) setTransactions(Array.isArray(txnData) ? txnData : []);

      if (!cancelled) setLoading(false);
    };

    fetchStats();
    return () => { cancelled = true; };
  }, [ownerUid, clientUid]);

  // Derived stats
  const totalDevices = devices.length;
  const activeDevices = devices.filter(
    (d) => d.billing_status?.toLowerCase() === "running" || d.subscription_status?.toLowerCase() === "active",
  ).length;
  const pausedDevices = devices.filter(
    (d) => d.subscription_status?.toLowerCase() === "paused",
  ).length;

  // Coerce to number — backend may store deprecated string placeholders in these columns
  const safeNum = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const totalHoursLeft = balances.reduce((s, b) => s + safeNum(b.token_hours_left), 0);
  const totalHoursUsed = balances.reduce((s, b) => s + safeNum(b.token_hours_used), 0);
  const activeTokens = balances.filter((b) => safeNum(b.token_hours_left) > 0).length;
  const expiredTokens = balances.filter((b) => safeNum(b.token_hours_left) <= 0 && safeNum(b.token_hours_used) > 0).length;

  const totalTransactions = transactions.length;
  const successfulTxns = transactions.filter((t) => t.payment_status?.toLowerCase() === "success").length;
  const pendingTxns = transactions.filter((t) => t.payment_status?.toLowerCase() === "pending").length;

  return (
    <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col gap-3 p-3 pb-14 md:pb-3 bg-[#F0F2F5]">

      {/* Page heading */}
      <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
        <div className="font-black text-[16px] text-[#111B21]">
          Dashboard — Overview
        </div>
        <div className="text-[11px] text-[#667781] mt-0.5">
          Your devices, tokens, and subscription summary at a glance.
        </div>
      </div>

      {/* ── Device Stats ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <BigKpiCard
          label="Total Devices"
          value={totalDevices.toLocaleString()}
          sub="Configured units"
          color="teal"
          isLoading={loading}
        />
        <BigKpiCard
          label="Active Devices"
          value={activeDevices.toLocaleString()}
          sub="Tracking & reporting"
          color="green"
          isLoading={loading}
        />
        <BigKpiCard
          label="Paused Devices"
          value={pausedDevices.toLocaleString()}
          sub="Billing paused"
          color="orange"
          isLoading={loading}
        />
        <BigKpiCard
          label="Inactive"
          value={(totalDevices - activeDevices - pausedDevices).toLocaleString()}
          sub="No active subscription"
          color="muted"
          isLoading={loading}
        />
      </div>

      {/* ── Token Stats ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <BigKpiCard
          label="Token Hours Left"
          value={totalHoursLeft.toLocaleString()}
          sub="Total across all tokens"
          color="teal"
          isLoading={loading}
        />
        <BigKpiCard
          label="Token Hours Used"
          value={totalHoursUsed.toLocaleString()}
          sub="Consumed so far"
          color="muted"
          isLoading={loading}
        />
        <BigKpiCard
          label="Active Tokens"
          value={activeTokens.toLocaleString()}
          sub="With hours remaining"
          color="green"
          isLoading={loading}
        />
        <BigKpiCard
          label="Expired Tokens"
          value={expiredTokens.toLocaleString()}
          sub="Need renewal"
          color="red"
          isLoading={loading}
        />
      </div>

      {/* ── Transaction Stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <BigKpiCard
          label="Total Transactions"
          value={totalTransactions.toLocaleString()}
          sub="Payment records"
          color="teal"
          isLoading={loading}
        />
        <BigKpiCard
          label="Successful Payments"
          value={successfulTxns.toLocaleString()}
          sub="Completed"
          color="green"
          isLoading={loading}
        />
        <BigKpiCard
          label="Pending Payments"
          value={pendingTxns.toLocaleString()}
          sub="Awaiting confirmation"
          color="orange"
          isLoading={loading}
        />
      </div>

      {/* Modals */}
      <TokenTopupModal open={topupOpen} onClose={() => setTopupOpen(false)} />
      <AirlockModal open={airlockOpen} onClose={() => setAirlockOpen(false)} />
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BigKpiCard — stat card
// ─────────────────────────────────────────────────────────────────────────────

function BigKpiCard({
  label, value, sub, color = "teal", isLoading = false,
}: {
  label: string; value: string; sub?: string;
  color?: "teal" | "green" | "orange" | "red" | "muted";
  isLoading?: boolean;
}) {
  const valueColor = {
    teal:   "text-[#128C7E]",
    green:  "text-[#25D366]",
    orange: "text-[#F97316]",
    red:    "text-[#EF4444]",
    muted:  "text-[#667781]",
  }[color];

  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl p-4 min-h-[90px] flex flex-col gap-1">
      <div className="text-[11px] text-[#667781] font-black uppercase tracking-wide">{label}</div>
      {isLoading ? (
        <>
          <div className="h-7 bg-gray-200 rounded-lg animate-pulse w-20" />
          <div className="h-3 bg-gray-200 rounded-lg animate-pulse w-28" />
        </>
      ) : (
        <>
          <div className={`text-[24px] font-black leading-tight ${valueColor}`}>{value}</div>
          {sub && <div className="text-[11px] text-[#667781]">{sub}</div>}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AirlockModal — login overlay
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
    if (state.status === "authenticated" || getCookie("_nvxs_account_uid")) { onClose(); }
  }, [state.status]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  if (!open) return null;

  const handleLogin = async () => {
    setBusy(true); setErr(null);
    try { await login(email, password); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Login failed"); }
    finally { setBusy(false); }
  };

  const handleVerify = async () => {
    setBusy(true); setErr(null);
    try { await verifyMfa(mfa); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "MFA failed"); }
    finally { setBusy(false); }
  };

  const handleResendMfa = async () => {
    if (resendCooldown > 0) return;
    try { await resendMfa(); setResendCooldown(60); }
    catch { setErr("Failed to resend code. Try again."); }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center pt-[60px] px-4">
      <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />
      <div className="relative z-[1] w-full max-w-[560px] bg-white rounded-2xl border border-[#E9EDEF] shadow-[0_20px_60px_rgba(0,0,0,0.18)] overflow-hidden">
        <div className="px-6 pt-5 pb-4">
          <div className="font-black text-[18px] text-[#111B21]">3D SERVICES: Login &amp; Authentication</div>
          <div className="text-[12px] text-[#667781] mt-1">Please Enter Your Credentials to Access the System</div>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-4">
          {state.status === "logged_out" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-[#667781]">Enter Username</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} placeholder="Username" className="h-11 w-full rounded-xl border border-[#E9EDEF] bg-white px-4 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E] transition-colors" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-[#667781]">Enter Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} className="h-11 w-full rounded-xl border border-[#E9EDEF] bg-white px-4 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E] transition-colors" />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-[12px] text-[#667781] cursor-pointer">
                  <input type="checkbox" defaultChecked className="accent-[#128C7E]" />
                  Remember device (30 days)
                </label>
                <button onClick={() => alert("Password reset is not yet available. Please contact your administrator.")} className="text-[12px] font-extrabold text-[#34B7F1] bg-transparent border-none cursor-pointer hover:underline">Forgot password?</button>
              </div>
              {err && <div className="text-[12px] font-extrabold text-[#EF4444]">{err}</div>}
              <button onClick={handleLogin} disabled={busy} className="w-full h-12 rounded-xl border-none bg-[#25D366] text-[#075E54] font-black text-[15px] cursor-pointer hover:brightness-105 active:opacity-85 transition-all disabled:opacity-50">
                {busy ? "Signing in…" : "Login →"}
              </button>
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

          {state.status === "mfa_required" && (
            <>
              <div>
                <div className="font-extrabold text-[13px] text-[#111B21]">Step 2/2 — Multi-Factor Authentication</div>
                <div className="text-[11px] text-[#667781] mt-1">We sent a one-time code to your registered device.</div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-[#667781]">Enter 6-digit code:</label>
                <input type="text" value={mfa} onChange={(e) => setMfa(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleVerify()} className="h-11 w-full rounded-xl border border-[#E9EDEF] bg-white px-4 text-center tracking-[0.3em] font-black text-[18px] text-[#111B21] outline-none focus:border-[#128C7E] transition-colors" />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-[12px] text-[#667781] cursor-pointer">
                  <input type="checkbox" defaultChecked className="accent-[#128C7E]" />
                  Trust this device (30d)
                </label>
                <button onClick={handleResendMfa} disabled={resendCooldown > 0} className="text-[12px] font-extrabold text-[#34B7F1] bg-transparent border-none cursor-pointer hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
                  {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
                </button>
              </div>
              {err && <div className="text-[12px] font-extrabold text-[#EF4444]">{err}</div>}
              <button onClick={handleVerify} disabled={busy} className="w-full h-12 rounded-xl border-none bg-[#25D366] text-[#075E54] font-black text-[15px] cursor-pointer hover:brightness-105 active:opacity-85 transition-all disabled:opacity-50">
                {busy ? "Verifying…" : "Verify & Enter →"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
