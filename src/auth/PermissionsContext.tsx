/**
 * auth/PermissionsContext.tsx — Frontend RBAC permissions provider.
 *
 * Synchronized with AuthContext:
 *   - Fetches permissions when auth status becomes "authenticated"
 *   - Clears permissions on logout
 *   - Falls back to reading _nvxs_account_uid cookie for backward compat
 *
 * Exposes:
 *   - permissions: string[]        — list of permission names (e.g. "audit.view")
 *   - role: string                 — user's role name
 *   - hasPermission(p): boolean    — check a single permission
 *   - hasAnyPermission(ps): boolean — check if user has at least one
 *   - loading: boolean
 *
 * super_admin and system roles bypass all permission checks (full access).
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { getUserPermissions } from "../api/services/rbac.service";
import { useAuth } from "./AuthContext";
import { getCookie } from "../utils/cookies";

// ── Bypass roles (full access, no permission checks needed) ──────────────────

const BYPASS_ROLES = ["super_admin", "system", "customer_tracker"];

// ── Context shape ────────────────────────────────────────────────────────────

interface PermissionsContextValue {
  permissions: string[];
  role: string;
  loading: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  refetch: () => void;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

/**
 * Reads the role cookie and, if it's a bypass role, returns it immediately
 * so we can skip the permissions API round-trip entirely.  This avoids the
 * 401→refresh→retry race condition that previously caused infinite loading
 * for super_admin / system users on page reload.
 */
function getBypassRoleFromCookie(): string | null {
  const cookieRole = getCookie("_nvxs_account_role");
  if (cookieRole && BYPASS_ROLES.includes(cookieRole)) return cookieRole;
  return null;
}

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { state: authState } = useAuth();

  // ── Fast-path: bypass role from cookie → skip API entirely ────────────
  const bypassRole = getBypassRoleFromCookie();

  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState<string>(bypassRole ?? "");
  // If we already know the role is a bypass role, no loading needed
  const [loading, setLoading] = useState(!bypassRole);

  const isFetchingRef = useRef(false);
  const accountUidRef = useRef(authState.accountUid);
  accountUidRef.current = authState.accountUid;

  const fetchPermissions = useCallback(async () => {
    // Bypass roles never need to fetch — they have full access
    const currentBypass = getBypassRoleFromCookie();
    if (currentBypass) {
      setRole(currentBypass);
      setLoading(false);
      return;
    }

    // Prevent concurrent calls
    if (isFetchingRef.current) return;

    const accountUid =
      accountUidRef.current || getCookie("_nvxs_account_uid");

    if (!accountUid) {
      setPermissions([]);
      setRole("");
      setLoading(false);
      return;
    }

    isFetchingRef.current = true;
    setLoading(true);
    try {
      const res = await getUserPermissions(accountUid);
      const data = res.data;
      setRole(data.role ?? "");
      setPermissions(
        (data.permissions ?? []).map((p) => p.permission_name),
      );
    } catch {
      // API error — default to no permissions (safe fail-closed)
      setPermissions([]);
      setRole("");
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []); // stable — reads accountUid from ref

  // React to auth state changes + handle cookie rehydration on mount
  useEffect(() => {
    // If bypass role is already set, skip entirely
    if (getBypassRoleFromCookie()) {
      setRole(getBypassRoleFromCookie()!);
      setLoading(false);
      return;
    }

    if (authState.status === "authenticated") {
      fetchPermissions();
    } else if (authState.status === "logged_out") {
      const cookieUid = getCookie("_nvxs_account_uid");
      if (cookieUid) {
        fetchPermissions();
      } else {
        setPermissions([]);
        setRole("");
        setLoading(false);
      }
    }
  }, [authState.status, fetchPermissions]);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (BYPASS_ROLES.includes(role)) return true;
      return permissions.includes(permission);
    },
    [permissions, role],
  );

  const hasAnyPermission = useCallback(
    (perms: string[]): boolean => {
      if (BYPASS_ROLES.includes(role)) return true;
      return perms.some((p) => permissions.includes(p));
    },
    [permissions, role],
  );

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        role,
        loading,
        hasPermission,
        hasAnyPermission,
        refetch: fetchPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext);
  if (!ctx)
    throw new Error("usePermissions must be used inside <PermissionsProvider>");
  return ctx;
}
