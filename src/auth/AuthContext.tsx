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
  ReactNode,
} from "react";
import { post, setAccessToken } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import { setCookie, clearAllCookies } from "../utils/cookies";
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

const INITIAL_STATE: AuthState = {
  status:      "logged_out",
  tenant:      "",
  role:        "",
  accountType: "",
  accountUid:  null,
  accountRoot: null,
  loginHint:   null,
  error:       null,
};

// ── Reducer ───────────────────────────────────────────────────────────────────

type AuthAction =
  | { type: "MFA_REQUIRED"; payload: { email: string } }
  | {
      type: "AUTHENTICATED";
      payload: {
        accountUid: string;
        accountRoot: string;
        accountType: string;
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
        tenant: action.payload.tenant,
        role: action.payload.role,
        error: null,
      };
    case "LOGOUT":
      return { ...INITIAL_STATE };
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

    const res = await post<{
      account_uid: string;
      account_type: string;
      account_root: string;
      account_role: string;
      account_name: string;
      primary_account: string;
      access_token: string;
    }>(ENDPOINTS.AUTH.LOGIN, {
      data: { username: email, password },
    });

    const d = res.data;

    if (!d?.account_uid) {
      throw new Error(res.message || "Invalid credentials, try again");
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

    dispatch({
      type: "AUTHENTICATED",
      payload: {
        accountUid: d.account_uid,
        accountRoot: d.account_root || "",
        accountType: d.account_type || "",
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
        tenant: state.tenant,
        role: state.role,
      },
    });
  }, [state.accountUid, state.accountRoot, state.tenant, state.role]);

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
