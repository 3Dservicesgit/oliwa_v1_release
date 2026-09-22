/**
 * auth/PermissionsContext.tsx — Frontend RBAC permissions provider.
 *
 * Synchronized with AuthContext:
 *   - Fetches permissions from the server when auth status becomes "authenticated"
 *   - Clears permissions on logout
 *
 * Who someone is comes from the server (GET /rbac/users/{uid}/permissions →
 * role, account_type, is_customer, permissions), never from a cookie: a
 * cookie can be edited in the browser, so it can't decide access.
 *
 *   - super_admin / system staff: every permission.
 *   - Customers (customer roles, or a customer account type such as a
 *     customer org's "admin"): the set for their team role — Viewer,
 *     Operator or Administrator (see customerAccess.ts) — for their own
 *     fleet only.
 *   - Other staff: the permissions of their role.
 *
 * If the check fails (network, server), access fails closed and `error` is
 * set so the page can offer a retry instead of a bare "Access Denied".
 *
 * Exposes:
 *   - permissions: string[]        — list of permission names (e.g. "audit.view")
 *   - role: string                 — user's role name (from the server)
 *   - isCustomer: boolean
 *   - hasPermission(p): boolean    — check a single permission
 *   - hasAnyPermission(ps): boolean — check if user has at least one
 *   - loading / error / refetch
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
import {
  customerPermissionsFor,
  STAFF_BYPASS_ROLES,
  isCustomerAccount,
} from "./customerAccess";

// ── Context shape ────────────────────────────────────────────────────────────

/** Who is signed in, as the server knows them. */
export interface AccountProfile {
  displayName: string;
  username: string;
  /** The client account this login belongs to (its account_root). */
  clientUid: string;
  /** e.g. "Mukwano Co Ltd"; empty when the login isn't linked to a client. */
  clientName: string;
}

const EMPTY_PROFILE: AccountProfile = { displayName: "", username: "", clientUid: "", clientName: "" };

interface PermissionsContextValue {
  permissions: string[];
  role: string;
  isCustomer: boolean;
  profile: AccountProfile;
  loading: boolean;
  /** The access check itself failed (network / server) — not a denial. */
  error: string | null;
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
  const [isCustomer, setIsCustomer] = useState(false);
  const [profile, setProfile] = useState<AccountProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isFetchingRef = useRef(false);
  const accountUidRef = useRef(authState.accountUid);
  useEffect(() => { accountUidRef.current = authState.accountUid; }, [authState.accountUid]);

  const clear = useCallback(() => {
    setPermissions([]);
    setRole("");
    setIsCustomer(false);
    setProfile(EMPTY_PROFILE);
  }, []);

  const fetchPermissions = useCallback(async () => {
    if (isFetchingRef.current) return;       // prevent concurrent calls

    const accountUid = accountUidRef.current || getCookie("_nvxs_account_uid");
    if (!accountUid) {
      clear();
      setError(null);
      setLoading(false);
      return;
    }

    isFetchingRef.current = true;
    setLoading(true);
    try {
      const res = await getUserPermissions(accountUid);
      const data = res.data;
      const serverRole = data.role ?? "";
      const customer = data.is_customer ?? isCustomerAccount(serverRole, data.account_type);
      setRole(serverRole);
      setIsCustomer(customer);
      setProfile({
        displayName: data.display_name ?? "",
        username: data.username ?? "",
        clientUid: data.client_uid ?? "",
        clientName: data.client_name ?? "",
      });
      setPermissions(
        customer
          ? [...customerPermissionsFor(serverRole)]
          : (data.permissions ?? []).map((p) => p.permission_name),
      );
      setError(null);
    } catch {
      // Fail closed: no permissions, but say why so the page can offer a retry.
      clear();
      setError("We couldn't check your access right now.");
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [clear]);

  // React to auth state changes (and cookie rehydration on mount)
  useEffect(() => {
    if (authState.status === "authenticated" || getCookie("_nvxs_account_uid")) {
      void fetchPermissions();
    } else if (authState.status === "logged_out") {
      clear();
      setError(null);
      setLoading(false);
    }
  }, [authState.status, fetchPermissions, clear]);

  const isStaffAdmin = !isCustomer && STAFF_BYPASS_ROLES.includes(role);

  const hasPermission = useCallback(
    (permission: string): boolean => isStaffAdmin || permissions.includes(permission),
    [permissions, isStaffAdmin],
  );

  const hasAnyPermission = useCallback(
    (perms: string[]): boolean => isStaffAdmin || perms.some((p) => permissions.includes(p)),
    [permissions, isStaffAdmin],
  );

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        role,
        isCustomer,
        profile,
        loading,
        error,
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

// eslint-disable-next-line react-refresh/only-export-components
export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext);
  if (!ctx)
    throw new Error("usePermissions must be used inside <PermissionsProvider>");
  return ctx;
}
