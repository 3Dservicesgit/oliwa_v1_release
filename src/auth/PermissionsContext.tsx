/**
 * auth/PermissionsContext.tsx — Frontend RBAC permissions provider.
 *
 * Synchronized with AuthContext:
 *   - Fetches permissions when auth status becomes "authenticated"
 *   - Clears permissions on logout
 *   - Uses accountUid from AuthContext only (no cookie fallback)
 *
 * Exposes:
 *   - permissions: string[]        — list of permission names (e.g. "audit.view")
 *   - role: string                 — user's role name
 *   - hasPermission(p): boolean    — check a single permission (alias-aware, Slice 3)
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
  useMemo,
  ReactNode,
} from "react";
import { getUserPermissions } from "../api/services/rbac.service";
import { useAuth } from "./AuthContext";
import { legacyAliasMemo, catalogAliasesMemo } from "./permissionAliases";

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

  const fetchPermissions = useCallback(async () => {
    const accountUid = authState.accountUid;

    if (!accountUid) {
      setPermissions([]);
      setRole("");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await getUserPermissions(accountUid);
      const data = res.data;
      setRole(data.role ?? "");
      setPermissions(
        (data.permissions ?? []).map((p) => p.permission_name),
      );
    } catch {
      setPermissions([]);
      setRole("");
    } finally {
      setLoading(false);
    }
  }, [authState.accountUid]);

  useEffect(() => {
    if (authState.status === "authenticated") {
      fetchPermissions();
    } else if (authState.status === "logged_out") {
      setPermissions([]);
      setRole("");
      setLoading(false);
    }
  }, [authState.status, fetchPermissions]);

  // Build a Set for O(1) lookup; rebuilt only when the underlying list changes.
  const permissionSet = useMemo(() => new Set(permissions), [permissions]);

  /**
   * Returns true if the user is granted `permission`, checking:
   *   1. Literal key match
   *   2. Forward alias: can_* → module.action (legacy backend)
   *   3. Reverse alias: module.action → can_* (future backend with catalog keys)
   *
   * A user with `rbac.create` satisfies `can_create_user`, and vice-versa.
   */
  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (BYPASS_ROLES.includes(role)) return true;
      // 1. Literal match
      if (permissionSet.has(permission)) return true;
      // 2. Forward: can_* → module.action
      const alias = legacyAliasMemo(permission);
      if (alias && permissionSet.has(alias)) return true;
      // 3. Reverse: module.action → can_* (any match suffices)
      const reverseAliases = catalogAliasesMemo(permission);
      for (const ra of reverseAliases) {
        if (permissionSet.has(ra)) return true;
      }
      return false;
    },
    [permissionSet, role],
  );

  const hasAnyPermission = useCallback(
    (perms: string[]): boolean => {
      if (BYPASS_ROLES.includes(role)) return true;
      for (const p of perms) {
        if (permissionSet.has(p)) return true;
        const alias = legacyAliasMemo(p);
        if (alias && permissionSet.has(alias)) return true;
        const reverseAliases = catalogAliasesMemo(p);
        for (const ra of reverseAliases) {
          if (permissionSet.has(ra)) return true;
        }
      }
      return false;
    },
    [permissionSet, role],
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
