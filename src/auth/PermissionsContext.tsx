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

const BYPASS_ROLES = ["super_admin", "system"];

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

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { state: authState } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);

  /**
   * Fetch-generation counter: prevents stale responses from concurrent calls
   * (e.g. React StrictMode double-fires effects in dev). Only the latest
   * call's result is applied; earlier calls silently discard their results.
   */
  const fetchGenRef = useRef(0);

  const fetchPermissions = useCallback(async () => {
    // Get account UID from AuthContext state or fall back to cookie
    const accountUid =
      authState.accountUid || getCookie("_nvxs_account_uid");

    if (!accountUid) {
      // Not logged in — clear state
      setPermissions([]);
      setRole("");
      setLoading(false);
      return;
    }

    const gen = ++fetchGenRef.current;
    setLoading(true);
    try {
      const res = await getUserPermissions(accountUid);
      // Only apply if this is still the latest fetch
      if (gen !== fetchGenRef.current) return;
      const data = res.data;
      setRole(data.role ?? "");
      setPermissions(
        (data.permissions ?? []).map((p) => p.permission_name),
      );
    } catch {
      // Only apply if this is still the latest fetch
      if (gen !== fetchGenRef.current) return;
      // API error — default to no permissions (safe fail-closed)
      setPermissions([]);
      setRole("");
    } finally {
      if (gen === fetchGenRef.current) {
        setLoading(false);
      }
    }
  }, [authState.accountUid]);

  // React to auth state changes
  useEffect(() => {
    if (authState.status === "authenticated") {
      fetchPermissions();
    } else if (authState.status === "logged_out") {
      setPermissions([]);
      setRole("");
      setLoading(false);
    }
  }, [authState.status, fetchPermissions]);

  // Initial fetch on mount (handles page refresh when cookie exists but AuthContext is fresh)
  useEffect(() => {
    const accountUid = getCookie("_nvxs_account_uid");
    if (accountUid && authState.status === "logged_out") {
      fetchPermissions();
    }
  }, []);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      // Bypass roles have full access
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
