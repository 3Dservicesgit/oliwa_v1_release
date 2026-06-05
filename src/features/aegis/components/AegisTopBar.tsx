/**
 * AegisTopBar — AEGIS Command Centre Primary Navigation Bar
 *
 * Distinct from the generic TopBar. Matches the screenshot exactly:
 *   Left:   Tenant selector pill (BAC: SYS_ADMIN badge) + Wallet balance + Top-up link + Burn rate
 *   Centre: Live scrolling status ticker (API uptime, Kafka lag, Redis hit rate…)
 *   Right:  Waswa AI toggle + icon buttons (?, bell, settings) + avatar + name
 *
 * All styles: Tailwind utility classes only.
 */
import React, { useState, useEffect } from "react";
import { getRaw } from "../../../api/client";
import { ENDPOINTS } from "../../../api/endpoints";
import { useAuth } from "../../../auth/AuthContext";

interface AegisTopBarProps {
  tenant?:       string;
  walletBalance?: string;
  burnRate?:     string;
  waswaOn?:      boolean;
  onToggleWaswa?: () => void;
  onOpenTopup?:  () => void;
  avatarInitial?: string;
  whoLabel?:     string;
  tickerItems?:  string[];
}

const DEFAULT_TICKER = [
  "Primary-Systems: Stable",
  "Server: Online",
  "Bandwidth: 120 Gbps",
  "Bandwidth-Burn: 85 Gbps",
  "Systemd-Process: Running",
  "SSE-Connections: 4,812",
  "Uptime 99.9%"
];

const hideScrollbar: React.CSSProperties = {
  overflowX: "auto",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
};

export function AegisTopBar({
  tenant        = "3D-Services (TOP)",
  walletBalance = "1,284,500 T",
  burnRate      = "2.4 T/s",
  waswaOn       = true,
  onToggleWaswa,
  onOpenTopup,
  avatarInitial = "?",
  whoLabel      = "",
  tickerItems   = DEFAULT_TICKER,
}: AegisTopBarProps) {
  const { state: authState } = useAuth();
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const accountUid = authState.accountUid;
    if (!accountUid) {
      setUserDetails(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchUserDetails = async () => {
      try {
        const json = await getRaw<{ status: string; data: any }>(
          `${ENDPOINTS.AUTH.USER_DETAILS}/${accountUid}/details`
        );
        if (!cancelled && json?.status === "success" && json?.data) {
          setUserDetails(json.data);
        }
      } catch (e) {
        console.error("Failed to fetch user details", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    fetchUserDetails();
    return () => { cancelled = true; };
  }, [authState.accountUid]);

  // Derive display values
  const displayTenant = userDetails?.primary_account || tenant;
  const displayAvatarInitial = userDetails?.account_name
    ? userDetails.account_name.charAt(0).toUpperCase()
    : avatarInitial;
  const displayWhoLabel = userDetails
    ? `${userDetails.account_name} • ${userDetails.account_role?.toUpperCase().replace(/_/g, " ")}`
    : whoLabel;

  return (
    <header className="h-12 flex items-center gap-0 bg-[#075E54] text-white sticky top-0 z-[100] shrink-0 overflow-hidden">

      {/* Left: Tenant + wallet */}
      <div className="flex items-center gap-2 px-3 shrink-0 border-r border-white/10 h-full">
        {/* Tenant selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-extrabold bg-[#25D366] text-[#075E54] px-2 py-0.5 rounded-full whitespace-nowrap">
            BAC: {userDetails?.account_role?.substring(0, 7).toUpperCase() || "SYS_ADMI"}
          </span>
          <span className="text-[12px] font-extrabold opacity-90 whitespace-nowrap hidden sm:block">
            {displayTenant}
          </span>
          <span className="text-white/50 text-[11px]">▾</span>
        </div>

        {/* Wallet */}
        <div className="hidden md:flex items-center gap-1.5 border-l border-white/10 pl-2">
          <span className="text-[11px] opacity-70">Wallet</span>
          <span className="text-[12px] font-extrabold">{walletBalance}</span>
          <button
            onClick={onOpenTopup}
            className="text-[11px] font-extrabold text-[#25D366] hover:text-white transition-colors cursor-pointer bg-transparent border-none"
          >
            Top-up
          </button>
        </div>

        {/* Burn */}
        <div className="hidden lg:flex items-center gap-1.5 border-l border-white/10 pl-2">
          <span className="text-[11px] opacity-70">Burn:</span>
          <span className="text-[12px] font-extrabold text-[#FBBF24]">{burnRate}</span>
        </div>
      </div>

      {/* Centre: live scrolling ticker */}
      <div className="flex-1 min-w-0 h-full flex items-center px-3" style={hideScrollbar}>
        <div className="flex items-center gap-3 whitespace-nowrap text-[11px] opacity-75">
          {tickerItems.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="opacity-30">•</span>}
              <span>{item}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Right: Waswa toggle + icons + user */}
      <div className="flex items-center gap-2 px-3 shrink-0 border-l border-white/10 h-full">
        {/* Waswa AI toggle */}
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="text-[11px] opacity-70">Waswa AI</span>
          <button
            onClick={onToggleWaswa}
            aria-pressed={waswaOn}
            className={`
              relative w-10 h-5 rounded-full border-none cursor-pointer transition-colors duration-200 shrink-0
              ${waswaOn ? "bg-[#25D366]" : "bg-white/20"}
            `}
          >
            <span className={`
              absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
              ${waswaOn ? "translate-x-5" : "translate-x-0.5"}
            `} />
          </button>
          <span className="text-[10px] opacity-50">›</span>
        </div>

        {/* Icon buttons */}
        <button className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 transition-colors grid place-items-center text-[13px] border-none cursor-pointer">?</button>
        <button className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 transition-colors grid place-items-center text-[13px] border-none cursor-pointer">🔔</button>
        <button className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 transition-colors grid place-items-center text-[13px] border-none cursor-pointer">⚙</button>

        {/* Avatar + name */}
        <div className="flex items-center gap-1.5 border-l border-white/10 pl-2">
          <div className="w-7 h-7 rounded-full bg-[#128C7E] grid place-items-center font-bold text-[12px] shrink-0">
            {displayAvatarInitial}
          </div>
          <span className="hidden sm:block text-[11px] font-extrabold opacity-90 whitespace-nowrap">
            {displayWhoLabel}
          </span>
        </div>
      </div>
    </header>
  );
}
