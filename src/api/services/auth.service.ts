/**
 * Authentication Service
 *
 * Event-driven session monitoring — replaces the old 1-second polling approach.
 *
 * Session validity is now detected via:
 *   1. 401 responses intercepted by the API client (automatic)
 *   2. `visibilitychange` event — revalidates when user returns to tab
 *   3. `storage` event — syncs logout across browser tabs
 *   4. Manual `isUserLoggedIn()` check on startup
 */
import { getCookie } from "../../utils/cookies";

const ACCOUNT_COOKIE_NAME = "_nvxs_account_uid";
const LOGOUT_SIGNAL_KEY = "_nvxs_logout_signal";

/**
 * Check if user is currently logged in (cookie exists).
 */
export function isUserLoggedIn(): boolean {
  return getCookie(ACCOUNT_COOKIE_NAME) !== null;
}

/**
 * Get account UID from cookie.
 */
export function getAccountUid(): string | null {
  return getCookie(ACCOUNT_COOKIE_NAME);
}

/**
 * Broadcast a logout signal to other tabs via localStorage.
 */
export function broadcastLogout(): void {
  try {
    localStorage.setItem(LOGOUT_SIGNAL_KEY, Date.now().toString());
    localStorage.removeItem(LOGOUT_SIGNAL_KEY);
  } catch {
    // localStorage may be unavailable in private browsing
  }
}

/**
 * Start event-driven session monitoring.
 * Returns a cleanup function (call it in useEffect teardown).
 *
 * @param onSessionInvalid — callback fired when session is detected as expired
 */
export function startSessionMonitor(
  onSessionInvalid?: () => void,
): () => void {
  const handleInvalid = () => {
    if (!sessionStorage.getItem("_nvxs_redirect_in_progress")) {
      sessionStorage.setItem("_nvxs_redirect_in_progress", "true");
      if (onSessionInvalid) {
        onSessionInvalid();
      } else {
        window.location.href = "/";
      }
    }
  };

  // Initial check
  if (!isUserLoggedIn()) {
    handleInvalid();
  } else {
    sessionStorage.removeItem("_nvxs_redirect_in_progress");
  }

  // Re-validate when user returns to the tab
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible" && !isUserLoggedIn()) {
      handleInvalid();
    }
  };

  // Cross-tab logout sync
  const onStorage = (e: StorageEvent) => {
    if (e.key === LOGOUT_SIGNAL_KEY) {
      handleInvalid();
    }
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("storage", onStorage);

  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * @deprecated Use the cleanup function returned by `startSessionMonitor` instead.
 */
export function stopSessionMonitor(_intervalId: number): void {
  // No-op — kept for backward compat during transition.
}
