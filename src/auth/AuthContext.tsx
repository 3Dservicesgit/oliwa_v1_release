/**
 * auth/AuthContext.tsx
 *
 * Auth state machine for NAVAS CMS.
 *
 * States:
 *   logged_out    → user hasn't submitted credentials yet
 *   mfa_required  → credentials accepted, OTP step pending
 *   authenticated → fully verified, redirect to app
 *
 * login()      — calls POST /users/auth, advances to mfa_required or authenticated
 * verifyMfa()  — validates OTP, advances to authenticated
 * logout()     — calls POST /auth/logout, resets to logged_out
 */
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { post, setAccessToken, hasAccessToken } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import { getCookie, setCookie, clearAllCookies } from "../utils/cookies";
import { broadcastLogout } from "../api/services/auth.service";

// ── Types ────────────────────────────────────────────────────────────────────

export type AuthStatus = "logged_out" | "mfa_required" | "authenticated";

export interface AuthState {
  status:      AuthStatus;
  tenant:      string;
  role:        string;
  accountType: string;
  accountUid:  string | null;
  accountRoot: string | null;
  accountName: string;
  loginHint:   { email: string } | null;
  error:       string | null;
}

interface AuthContextValue {
  state:       AuthState;
  login:       (email: string, password: string) => Promise<void>;
  verifyMfa:   (code: string) => Promise<void>;
  resendMfa:   () => Promise<void>;
  logout:      () => void;
}

// ── Initial state ─────────────────────────────────────────────────────────────

/**
 * Build initial auth state from cookies.
 * On page refresh the React state is lost, but the cookies set during login
 * survive. Re-hydrating here avoids the "logged_out with null accountRoot"
 * problem that breaks every API call relying on authState.accountRoot.
 */
function buildInitialState(): AuthState {
  const uid  = getCookie("_nvxs_account_uid");
  const root = getCookie("_nvxs_account_root");
  const type = getCookie("_nvxs_account_type");
  const role = getCookie("_nvxs_account_role");
  const name = getCookie("_nvxs_account_name");

  if (uid) {
    return {
      status:      "authenticated",
      tenant:      root || "",
      role:        role || "",
      accountType: type || "",
      accountUid:  uid,
      accountRoot: root || null,
      accountName: name || "",
      loginHint:   null,
      error:       null,
    };
  }

  return {
    status:      "logged_out",
    tenant:      "",
    role:        "",
    accountType: "",
    accountUid:  null,
    accountRoot: null,
    accountName: "",
    loginHint:   null,
    error:       null,
  };
}

const INITIAL_STATE: AuthState = buildInitialState();

// ── Reducer ───────────────────────────────────────────────────────────────────

type AuthAction =
  | { type: "MFA_REQUIRED"; payload: { email: string } }
  | {
      type: "AUTHENTICATED";
      payload: {
        accountUid: string;
        accountRoot: string;
        accountType: string;
        accountName: string;
        tenant: string;
        role: string;
      };
    }
  | { type: "LOGOUT" }
  | { type: "ERROR"; payload: string };

function reducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "MFA_REQUIRED":
      return {
        ...state,
        status: "mfa_required",
        loginHint: { email: action.payload.email },
        error: null,
      };
    case "AUTHENTICATED":
      return {
        ...state,
        status: "authenticated",
        accountUid: action.payload.accountUid,
        accountRoot: action.payload.accountRoot,
        accountType: action.payload.accountType,
        accountName: action.payload.accountName,
        tenant: action.payload.tenant,
        role: action.payload.role,
        error: null,
      };
    case "LOGOUT":
      return {
        status:      "logged_out",
        tenant:      "",
        role:        "",
        accountType: "",
        accountUid:  null,
        accountRoot: null,
        accountName: "",
        loginHint:   null,
        error:       null,
      };
    case "ERROR":
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [authReady, setAuthReady] = useState(false);

  /**
   * Boot-time JWT refresh.
   * On page refresh the in-memory JWT is lost. If we have cookies (user was
   * logged in), proactively refresh the JWT BEFORE any API calls fire.
   * This prevents the 401 → refresh → retry cascade on every page load.
   */
  useEffect(() => {
    if (hasAccessToken()) {
      setAuthReady(true);
      return;
    }

    const uid = getCookie("_nvxs_account_uid");
    if (!uid) {
      setAuthReady(true);
      return;
    }

    // Have cookies but no JWT — try to silently refresh.
    // IMPORTANT: If refresh fails, DO NOT clear cookies or log out.
    // The session cookies are still valid for routing — buildInitialState()
    // already set status="authenticated". Individual API calls will handle
    // 401s via the interceptor in client.ts, which tries refresh again
    // and only then forces logout if it truly fails.
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    (async () => {
      try {
        const BASE_URL = import.meta.env.VITE_API_BASE_URL;
        const url = new URL("/auth/refresh", BASE_URL);
        const resp = await fetch(url.toString(), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });

        if (cancelled) return;

        if (resp.ok) {
          const json = await resp.json();
          if (json?.data?.access_token) {
            setAccessToken(json.data.access_token);
            console.log("[Auth] Boot-time JWT refresh succeeded");
          } else {
            // 200 OK but no token — proceed without JWT, API interceptor will retry
            console.warn("[Auth] Refresh returned OK but no access_token — proceeding with cookies only");
          }
        } else {
          // Refresh endpoint returned an error — proceed without JWT.
          // Don't kill the session — the user's cookies are still valid.
          console.warn("[Auth] Boot-time refresh returned", resp.status, "— proceeding with cookies only");
        }
      } catch {
        if (cancelled) return;
        // Network error or timeout — proceed without JWT
        console.warn("[Auth] Boot-time refresh failed (network/timeout) — proceeding with cookies only");
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setAuthReady(true);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  /**
   * login — Submit email + password to the backend.
   * On success: sets non-sensitive cookies (account_type, account_root, account_role)
   * for UI hints, and transitions to `authenticated`.
   *
   * NOTE: The auth token (account_uid) is still stored as a JS-readable cookie
   * until the backend implements HttpOnly cookie-based JWT. This is a known
   * interim state — see TODO 1.1 / 1.5 in the auth improvement plan.
   */
  const login = useCallback(async (email: string, password: string) => {
    if (!email.trim() || !password.trim()) {
      throw new Error("Email and password are required.");
    }

    // Use raw fetch instead of post() to bypass the 401 interceptor.
    // The login endpoint doesn't need auth, and the interceptor can
    // interfere (clear cookies, schedule redirects) if anything goes wrong.
    const BASE_URL = import.meta.env.VITE_API_BASE_URL;
    const url = new URL(ENDPOINTS.AUTH.LOGIN, BASE_URL);

    const resp = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // so backend can set HttpOnly refresh cookie
      body: JSON.stringify({ data: { username: email, password } }),
    });

    let json: { status: string; message: string; data: {
      account_uid: string;
      account_type: string;
      account_root: string;
      account_role: string;
      account_name: string;
      primary_account: string;
      access_token: string;
    }};

    try {
      json = await resp.json();
    } catch {
      throw new Error("Server error — could not parse response");
    }

    if (!resp.ok || json.status !== "success") {
      throw new Error(json.message || "Invalid credentials, try again");
    }

    const d = json.data;

    if (!d?.account_uid) {
      throw new Error(json.message || "Invalid credentials, try again");
    }

    // Store JWT access token in memory (not in cookies/localStorage for XSS resistance).
    // The refresh token is set as an HttpOnly cookie by the backend automatically.
    if (d.access_token) {
      setAccessToken(d.access_token);
    }

    // Store session hint cookies (non-auth, UI display only).
    setCookie("_nvxs_account_uid", d.account_uid);
    setCookie("_nvxs_account_type", d.account_type || "");
    setCookie("_nvxs_account_root", d.account_root || "");
    setCookie("_nvxs_account_role", d.account_role || "");
    setCookie("_nvxs_account_name", d.account_name || "");

    dispatch({
      type: "AUTHENTICATED",
      payload: {
        accountUid: d.account_uid,
        accountRoot: d.account_root || "",
        accountType: d.account_type || "",
        accountName: d.account_name || "",
        tenant: d.primary_account || d.account_root || "",
        role: d.account_role || "",
      },
    });
  }, []);

  /**
   * verifyMfa — Submit 6-digit OTP.
   * TODO: Wire to POST /auth/mfa/verify once backend supports MFA.
   */
  const verifyMfa = useCallback(async (code: string) => {
    if (!/^\d{6}$/.test(code)) {
      throw new Error("Enter a valid 6-digit code.");
    }
    // TODO: Replace with real MFA verification API call
    // await post(ENDPOINTS.AUTH.MFA_VERIFY, { code });
    await new Promise((r) => setTimeout(r, 600));
    dispatch({
      type: "AUTHENTICATED",
      payload: {
        accountUid: state.accountUid || "",
        accountRoot: state.accountRoot || "",
        accountType: state.accountType,
        accountName: state.accountName,
        tenant: state.tenant,
        role: state.role,
      },
    });
  }, [state.accountUid, state.accountRoot, state.accountName, state.tenant, state.role]);

  /**
   * resendMfa — Request a new MFA code.
   * TODO: Wire to POST /auth/mfa/resend once backend supports it.
   */
  const resendMfa = useCallback(async () => {
    // TODO: Replace with real API call
    // await post(ENDPOINTS.AUTH.MFA_RESEND, {});
    await new Promise((r) => setTimeout(r, 400));
  }, []);

  /**
   * logout — Notify backend to revoke tokens, then clear all local state.
   *
   * The backend call:
   *   1. Revokes the refresh token (HttpOnly cookie, sent automatically).
   *   2. Blacklists the current JWT access token (sent via Authorization header).
   * Both happen best-effort — we clear local state regardless.
   */
  const logout = useCallback(() => {
    // Fire backend logout (best-effort — don't block on failure)
    post(ENDPOINTS.AUTH.LOGOUT, {}).catch(() => {});

    // Clear in-memory JWT
    setAccessToken(null);

    // Notify other browser tabs
    broadcastLogout();

    // Clear all JS-visible cookies
    clearAllCookies();
    sessionStorage.removeItem("_nvxs_redirect_in_progress");

    dispatch({ type: "LOGOUT" });
    window.location.href = "/";
  }, []);

  // Don't render children until the boot-time JWT refresh completes.
  // This prevents a storm of 401s from every component on page refresh.
  if (!authReady) {
    return null; // Brief flash — refresh typically takes <200ms
  }

  return (
    <AuthContext.Provider value={{ state, login, verifyMfa, resendMfa, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
