/**
 * api/client.ts — Centralised HTTP client for NAVAS CMS.
 *
 * Thin wrapper around native `fetch` that handles:
 *  - Base URL resolution (from VITE_API_BASE_URL env var)
 *  - JSON content-type headers
 *  - Auth token injection (reads JWT from cookie or falls back to account_uid)
 *  - 401 response interception with automatic token refresh
 *  - Generic ApiResponse<T> envelope parsing
 *  - Consistent error handling via ApiError
 *
 * Public surface:  get · getRaw · post · put · patch · del
 */

import type { ApiResponse, RequestOptions } from "./types";
import { ApiError } from "./types";
import { getCookie, clearAllCookies } from "../utils/cookies";

// ── Base URL ─────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ── Auth token management ────────────────────────────────────────────────────

/**
 * In-memory JWT access token.
 * Preferred over cookies for XSS resistance — the token never touches
 * `document.cookie` or `localStorage`.
 *
 * Falls back to reading `_nvxs_account_uid` cookie while the backend
 * is still in the interim (pre-JWT) phase.
 */
let accessToken: string | null = null;

/** Set the in-memory access token (called after login or refresh). */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Check whether we currently hold a valid in-memory JWT. */
export function hasAccessToken(): boolean {
  return accessToken !== null;
}

/** Get the current auth token. Prefers in-memory JWT, falls back to cookie. */
function getAuthToken(): string | null {
  if (accessToken) return accessToken;
  // Interim fallback: read account_uid from cookie
  return getCookie("_nvxs_account_uid") ?? null;
}

/**
 * Exported read of the current auth token.
 * Use in non-standard HTTP clients (e.g. fleet SSE / external APIs)
 * that cannot go through the central baseFetch helper.
 */
export function getStoredAuthToken(): string | null {
  return getAuthToken();
}

// ── Token refresh ────────────────────────────────────────────────────────────

let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempt a silent token refresh.
 * Deduplicates concurrent refresh attempts (only one in-flight at a time).
 */
async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const url = new URL("/auth/refresh", BASE_URL);
      const resp = await fetch(url.toString(), {
        method: "POST",
        credentials: "include", // send HttpOnly refresh-token cookie
        headers: { "Content-Type": "application/json" },
      });

      if (!resp.ok) return false;

      const json = await resp.json();
      if (json?.data?.access_token) {
        setAccessToken(json.data.access_token);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ── Shared fetch logic ───────────────────────────────────────────────────────

async function baseFetch(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<Response> {
  const { params, headers: extraHeaders, ...fetchOpts } = opts;

  const url = new URL(path, BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders as Record<string, string>),
  };

  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
    credentials: "include", // always send cookies (for HttpOnly refresh token)
    ...fetchOpts,
  });

  // ── 401 interceptor: attempt silent refresh then retry once ──────────
  if (response.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Retry the original request with the new token
      const retryHeaders = { ...headers };
      const newToken = getAuthToken();
      if (newToken) {
        retryHeaders["Authorization"] = `Bearer ${newToken}`;
      }
      return fetch(url.toString(), {
        method,
        headers: retryHeaders,
        body: body != null ? JSON.stringify(body) : undefined,
        credentials: "include",
        ...fetchOpts,
      });
    }

    // Refresh failed — session is dead, force logout
    clearAllCookies();
    setAccessToken(null);
    sessionStorage.removeItem("_nvxs_redirect_in_progress");
    window.location.href = "/";
  }

  return response;
}

// ── Envelope request (expects { data, message, status }) ─────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const response = await baseFetch(method, path, body, opts);

  let json: ApiResponse<T>;
  try {
    json = await response.json();
  } catch {
    throw new ApiError(
      `${method} ${path} — failed to parse response`,
      response.status,
      response.statusText,
    );
  }

  if (!response.ok) {
    throw new ApiError(
      json.message ?? `${method} ${path} failed`,
      response.status,
      response.statusText,
      json.message,
    );
  }

  if (json.status !== "success") {
    throw new ApiError(
      json.message ?? "Request failed",
      response.status,
      response.statusText,
      json.message,
    );
  }

  return json;
}

// ── Raw request (no envelope) ────────────────────────────────────────────────

/**
 * Returns the JSON body directly without expecting the
 * `{ data, message, status }` envelope.
 * Use for endpoints that return raw payloads (e.g. /metrics/server).
 */
async function requestRaw<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const response = await baseFetch(method, path, body, opts);

  let json: T;
  try {
    json = await response.json();
  } catch {
    throw new ApiError(
      `${method} ${path} — failed to parse response`,
      response.status,
      response.statusText,
    );
  }

  if (!response.ok) {
    throw new ApiError(
      `${method} ${path} failed`,
      response.status,
      response.statusText,
    );
  }

  return json;
}

// ── Multipart upload (FormData) ──────────────────────────────────────────────

/**
 * Upload a FormData body (multipart/form-data).
 * Unlike baseFetch this does NOT set Content-Type — the browser sets the
 * multipart boundary automatically when the body is a FormData instance.
 * Expects the same { data, message, status } envelope as regular requests.
 */
export async function postMultipart<T>(
  path: string,
  formData: FormData,
  opts: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const { params, headers: extraHeaders, ...fetchOpts } = opts;

  const url = new URL(path, BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  // No Content-Type — browser auto-sets the multipart boundary.
  const headers: Record<string, string> = {
    ...(extraHeaders as Record<string, string>),
  };
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response = await fetch(url.toString(), {
    method: "POST",
    headers,
    body: formData,
    credentials: "include",
    ...fetchOpts,
  });

  // 401 interceptor (same as baseFetch)
  if (response.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const retryHeaders = { ...headers };
      const newToken = getAuthToken();
      if (newToken) {
        retryHeaders["Authorization"] = `Bearer ${newToken}`;
      }
      response = await fetch(url.toString(), {
        method: "POST",
        headers: retryHeaders,
        body: formData,
        credentials: "include",
        ...fetchOpts,
      });
    } else {
      clearAllCookies();
      setAccessToken(null);
      sessionStorage.removeItem("_nvxs_redirect_in_progress");
      window.location.href = "/";
    }
  }

  let json: ApiResponse<T>;
  try {
    json = await response.json();
  } catch {
    throw new ApiError(
      `POST ${path} — failed to parse response`,
      response.status,
      response.statusText,
    );
  }

  if (!response.ok) {
    throw new ApiError(
      json.message ?? `POST ${path} failed`,
      response.status,
      response.statusText,
      json.message,
    );
  }

  if (json.status !== "success") {
    throw new ApiError(
      json.message ?? "Upload failed",
      response.status,
      response.statusText,
      json.message,
    );
  }

  return json;
}

// ── Public helpers ───────────────────────────────────────────────────────────

export function get<T>(path: string, opts?: RequestOptions) {
  return request<T>("GET", path, undefined, opts);
}

export function getRaw<T>(path: string, opts?: RequestOptions) {
  return requestRaw<T>("GET", path, undefined, opts);
}

export function post<T>(path: string, body: unknown, opts?: RequestOptions) {
  return request<T>("POST", path, body, opts);
}

export function put<T>(path: string, body: unknown, opts?: RequestOptions) {
  return request<T>("PUT", path, body, opts);
}

export function patch<T>(path: string, body: unknown, opts?: RequestOptions) {
  return request<T>("PATCH", path, body, opts);
}

export function del<T>(path: string, body?: unknown, opts?: RequestOptions) {
  return request<T>("DELETE", path, body, opts);
}
