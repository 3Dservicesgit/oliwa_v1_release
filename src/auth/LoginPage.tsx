/**
 * auth/LoginPage.tsx — Full-screen login page.
 *
 * Shown as the FIRST screen when a user is not authenticated.
 * No app shell (TopBar, NavRail, Sidebar) is rendered — just
 * a clean, centered login card on a branded background.
 */
import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { state, login, verifyMfa, resendMfa } = useAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [mfa,      setMfa]      = useState("");
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

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
    <div
      className="min-h-dvh w-full flex flex-col items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #075E54, #128C7E, #25D366)" }}
    >
      {/* Brand header */}
      <div className="mb-6 text-center">
        <h1 className="text-white text-[28px] font-black tracking-wide">
          3D SERVICES
        </h1>
        <p className="text-white/70 text-[13px] mt-1">
          Tracking Console
        </p>
      </div>

      {/* Login card */}
      <div className="w-full max-w-[480px] bg-white rounded-2xl border border-[#E9EDEF] shadow-[0_20px_60px_rgba(0,0,0,0.25)] overflow-hidden">
        <div className="px-6 pt-5 pb-4">
          <div className="font-black text-[18px] text-[#111B21]">
            Login &amp; Authentication
          </div>
          <div className="text-[12px] text-[#667781] mt-1">
            Please enter your credentials to access the system
          </div>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-4">
          {/* ── Login form ────────────────────────────────────── */}
          {state.status === "logged_out" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-[#667781]">Username</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="Enter your username"
                  className="h-11 w-full rounded-xl border border-[#E9EDEF] bg-white px-4 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E] transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-[#667781]">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="Enter your password"
                  className="h-11 w-full rounded-xl border border-[#E9EDEF] bg-white px-4 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E] transition-colors"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-[12px] text-[#667781] cursor-pointer">
                  <input type="checkbox" defaultChecked className="accent-[#128C7E]" />
                  Remember device (30 days)
                </label>
                <button
                  onClick={() => alert("Password reset is not yet available. Please contact your administrator.")}
                  className="text-[12px] font-extrabold text-[#34B7F1] bg-transparent border-none cursor-pointer hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              {err && (
                <div className="text-[12px] font-extrabold text-[#EF4444]">{err}</div>
              )}
              <button
                onClick={handleLogin}
                disabled={busy}
                className="w-full h-12 rounded-xl border-none bg-[#25D366] text-[#075E54] font-black text-[15px] cursor-pointer hover:brightness-105 active:opacity-85 transition-all disabled:opacity-50"
              >
                {busy ? "Signing in..." : "Login"}
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

          {/* ── MFA form ──────────────────────────────────────── */}
          {state.status === "mfa_required" && (
            <>
              <div>
                <div className="font-extrabold text-[13px] text-[#111B21]">
                  Step 2/2 — Multi-Factor Authentication
                </div>
                <div className="text-[11px] text-[#667781] mt-1">
                  We sent a one-time code to your registered device.
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-[#667781]">Enter 6-digit code:</label>
                <input
                  type="text"
                  value={mfa}
                  onChange={(e) => setMfa(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  className="h-11 w-full rounded-xl border border-[#E9EDEF] bg-white px-4 text-center tracking-[0.3em] font-black text-[18px] text-[#111B21] outline-none focus:border-[#128C7E] transition-colors"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-[12px] text-[#667781] cursor-pointer">
                  <input type="checkbox" defaultChecked className="accent-[#128C7E]" />
                  Trust this device (30d)
                </label>
                <button
                  onClick={handleResendMfa}
                  disabled={resendCooldown > 0}
                  className="text-[12px] font-extrabold text-[#34B7F1] bg-transparent border-none cursor-pointer hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
                </button>
              </div>
              {err && (
                <div className="text-[12px] font-extrabold text-[#EF4444]">{err}</div>
              )}
              <button
                onClick={handleVerify}
                disabled={busy}
                className="w-full h-12 rounded-xl border-none bg-[#25D366] text-[#075E54] font-black text-[15px] cursor-pointer hover:brightness-105 active:opacity-85 transition-all disabled:opacity-50"
              >
                {busy ? "Verifying..." : "Verify & Enter"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-[11px] text-white/50">
        3D Services Ltd &bull; Secure Access Portal
      </p>
    </div>
  );
}
