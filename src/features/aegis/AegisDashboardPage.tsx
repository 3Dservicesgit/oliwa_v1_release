/**
 * AegisDashboard — Customer Dashboard
 *
 * One scrollable page with everything on it, in plain sections: Fleet
 * status, Geofence presence, Alerts, Tokens (features/fleet-dashboard). The
 * figures match the OLIWA mobile app's and refresh live.
 *
 * SECURITY: every figure is the signed-in customer's own (account root); the
 * backend's access guard refuses any other client.
 */
import React, { useState, useEffect } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getCookie } from "../../utils/cookies";
import { FleetDashboard } from "../fleet-dashboard";

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export function AegisDashboard() {
  const [airlockOpen, setAirlockOpen] = useState(() => !getCookie("_nvxs_account_uid"));

  return (
    <main className="flex-1 min-w-0 overflow-x-clip bg-[#F4F6F8]">
      <div className="mx-auto max-w-[1200px] px-5 py-5 pb-16 md:pb-8">
        <FleetDashboard />
      </div>
      <AirlockModal open={airlockOpen} onClose={() => setAirlockOpen(false)} />
    </main>
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
