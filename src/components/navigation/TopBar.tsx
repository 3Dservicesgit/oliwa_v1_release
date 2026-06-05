/**
 * TopBar — Primary Navigation Bar
 *
 * Renders the application header containing the brand identity, global
 * search input, and the current user's RBAC role badges and avatar.
 */
import React, { useState, useEffect } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getRaw } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";

// ── Pill variant map ────────────────────────────────────────────────────────
const pillVariant: Record<string, string> = {
  teal:  "bg-[#128C7E] text-white",
  azure: "bg-[#34B7F1] text-white",
  green: "bg-[#25D366] text-white",
};

interface TopBarProps {
  brandName?:        string;
  pageTitle?:        string;
  searchPlaceholder?: string;
}

export function TopBar({
  brandName         = "3D SERVICES",
  pageTitle         = "TRACKING CONSOLE",
  searchPlaceholder = "Search tenants, units, tokens, incidents…",
}: TopBarProps) {
  const { state: authState } = useAuth();
  const [userDetails, setUserDetails] = useState<any>(null);

  useEffect(() => {
    const accountUid = authState.accountUid;
    if (!accountUid) { setUserDetails(null); return; }

    let cancelled = false;
    (async () => {
      try {
        const json = await getRaw<{ status: string; data: any }>(
          `${ENDPOINTS.AUTH.USER_DETAILS}/${accountUid}/details`
        );
        if (!cancelled && json?.status === "success" && json?.data) {
          setUserDetails(json.data);
        }
      } catch {
        // best-effort — the bar still renders with auth context values
      }
    })();
    return () => { cancelled = true; };
  }, [authState.accountUid]);

  // Derive display values from fetched details, falling back to auth context
  const displayName = userDetails?.account_name || "User";
  const displayRole = (userDetails?.account_role || authState.role || "").toUpperCase().replace(/_/g, " ");
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const whoLabel = `${displayName} • ${displayRole}`;
  const roles = [
    { label: displayRole || "USER", variant: "teal" as const },
  ];
  return (
    <header className="
      h-12 flex items-center gap-3 px-4
      bg-[#075E54] text-white
      sticky top-0 z-[100] shrink-0
    ">
      {/* Brand */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-bold opacity-90 whitespace-nowrap">{brandName}</span>
        <span className="opacity-70">•</span>
        <span className="font-bold whitespace-nowrap hidden sm:inline">{pageTitle}</span>
      </div>

      {/* Search */}
      <div className="flex-1 min-w-0 max-w-xl hidden xs:block">
        <input
          placeholder={searchPlaceholder}
          className="
            w-full h-[30px] rounded-full border-none
            px-4 text-[13px] outline-none
            bg-white/15 text-white placeholder-white/60
            focus:bg-white/25 transition-colors
          "
        />
      </div>

      {/* RBAC / user */}
      <div className="flex items-center gap-2 ml-auto shrink-0">
        {roles.map((r) => (
          <span
            key={r.label}
            className={`
              hidden sm:inline-flex items-center
              rounded-full px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap
              ${pillVariant[r.variant]}
            `}
          >
            {r.label}
          </span>
        ))}

        {/* Avatar */}
        <div className="
          w-[30px] h-[30px] rounded-full bg-[#0B7B6E]
          grid place-items-center font-bold text-sm shrink-0
        ">
          {avatarInitial}
        </div>

        <span className="hidden sm:block text-xs opacity-90 whitespace-nowrap">
          {whoLabel}
        </span>
      </div>
    </header>
  );
}
