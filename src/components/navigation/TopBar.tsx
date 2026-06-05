/**
 * TopBar — Primary Navigation Bar
 *
 * Renders the application header containing the brand identity, global
 * search input, and the current user's RBAC role badges and avatar.
 *
 * User identity is derived from AuthContext (the logged-in user), NOT
 * from hardcoded defaults. Falls back to fetching /users/{uid}/details
 * for display_name if the auth state only has UIDs.
 */
import React, { useEffect, useState } from "react";
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
  const { state: authState, logout } = useAuth();
  const [userDetails, setUserDetails] = useState<any>(null);

  useEffect(() => {
    if (!authState.accountUid) return;
    const fetchDetails = async () => {
      try {
        const json = await getRaw<{ status: string; data: any }>(
          `${ENDPOINTS.AUTH.USER_DETAILS}/${authState.accountUid}/details`
        );
        if (json?.status === "success" && json?.data) {
          setUserDetails(json.data);
        }
      } catch {
        // Silently fall back to auth state
      }
    };
    fetchDetails();
  }, [authState.accountUid]);

  // Derive display values from fetched details → auth state → safe fallbacks
  const displayName = userDetails?.account_name || authState.accountUid || "User";
  const displayRole = userDetails?.account_role || authState.role || "";
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const whoLabel = displayRole
    ? `${displayName} • ${displayRole.toUpperCase().replace(/_/g, " ")}`
    : displayName;

  // Build role pills from the actual user role
  const rolePills: { label: string; variant: "teal" | "azure" | "green" }[] = [];
  if (displayRole) {
    rolePills.push({
      label: displayRole.toUpperCase().replace(/_/g, " ").substring(0, 16),
      variant: "teal",
    });
  }

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
        {rolePills.map((r) => (
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

        {/* Logout button */}
        <button
          onClick={logout}
          className="hidden sm:inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold bg-white/10 hover:bg-white/20 text-white border-none cursor-pointer transition-colors"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
