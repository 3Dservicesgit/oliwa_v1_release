/**
 * TopBar — Primary Navigation Bar
 *
 * Renders the application header containing the brand identity, global
 * search input, notification bell, and the current user's RBAC role
 * badges and avatar.
 *
 * User identity is derived from AuthContext (the logged-in user), NOT
 * from hardcoded defaults. Falls back to fetching /users/{uid}/details
 * for display_name if the auth state only has UIDs.
 */
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getUnreadCount, getNotifications, markNotificationRead, markAllNotificationsRead } from "../../api/services/notifications.service";
import { getCookie } from "../../utils/cookies";
import { EVENT_CONDITION_LABELS } from "../../api/types/events.types";
import type { EventCondition, EventNotification } from "../../api/types";

// ── Pill variant map ────────────────────────────────────────────────────────
const pillVariant: Record<string, string> = {
  teal:  "bg-[#128C7E] text-white",
  azure: "bg-[#34B7F1] text-white",
  green: "bg-[#25D366] text-white",
};

// ── Notification Bell ──────────────────────────────────────────────────────

function NotificationBell() {
  const { state: authState } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<EventNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const ownerUid =
    authState.accountRoot || getCookie("_nvxs_account_root") ||
    authState.accountUid || getCookie("_nvxs_account_uid") || "";

  // Fetch unread count periodically
  const fetchCount = useCallback(async () => {
    if (!ownerUid) return;
    try {
      const res = await getUnreadCount(ownerUid);
      setUnreadCount(
        typeof res.data === "object" && res.data !== null
          ? (res.data as { count: number }).count
          : 0,
      );
    } catch {
      /* silently ignore polling errors */
    }
  }, [ownerUid]);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000); // every 30s
    return () => clearInterval(interval);
  }, [fetchCount]);

  // Load notifications when dropdown opens & mark all as read
  useEffect(() => {
    if (!open || !ownerUid) return;
    let cancelled = false;
    setLoading(true);
    getNotifications(ownerUid)
      .then((res) => { if (!cancelled) setNotifications(res.data ?? []); })
      .catch(() => { if (!cancelled) setNotifications([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    // Mark all as read when the bell is opened — clears the badge
    if (unreadCount > 0) {
      markAllNotificationsRead(ownerUid)
        .then(() => {
          if (!cancelled) {
            setUnreadCount(0);
            // Mark all local notifications as read too
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
          }
        })
        .catch(() => { /* silently ignore */ });
    }

    return () => { cancelled = true; };
  }, [open, ownerUid]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleMarkRead = async (uid: string) => {
    try {
      await markNotificationRead(uid);
      setNotifications((prev) =>
        prev.map((n) => (n.notification_uid === uid ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* ignore */ }
  };

  const recentNotifs = notifications.slice(0, 10);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-[30px] h-[30px] rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-white border-none cursor-pointer transition-colors relative"
        title="Notifications"
      >
        <span className="text-[14px]">&#128276;</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#EF4444] rounded-full text-[9px] font-black text-white grid place-items-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[36px] w-[360px] max-h-[420px] bg-white rounded-xl shadow-xl border border-[#E9EDEF] overflow-hidden z-[200] flex flex-col">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-[#E9EDEF] flex items-center justify-between shrink-0">
            <span className="font-black text-[13px] text-[#111B21]">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[11px] font-black text-[#128C7E] bg-[#128C7E]/10 px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto [scrollbar-width:thin]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : recentNotifs.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-[24px] mb-2">&#128276;</div>
                <p className="text-[12px] text-[#667781]">No notifications yet</p>
              </div>
            ) : (
              recentNotifs.map((n) => (
                <div
                  key={n.notification_uid}
                  onClick={() => !n.is_read && handleMarkRead(n.notification_uid)}
                  className={`px-4 py-2.5 border-b border-[#E9EDEF] cursor-pointer hover:bg-[#F0F2F5] transition-colors ${
                    !n.is_read ? "bg-[#128C7E]/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#128C7E] shrink-0" />}
                    <span className="font-black text-[12px] text-[#111B21] truncate">{n.event_name}</span>
                  </div>
                  <p className="text-[11px] text-[#667781] truncate">
                    {n.device_name || n.device_imei}
                    {n.geozone_name && (
                      <span>
                        {" — "}
                        {n.breach_type === "enter" ? "entered" : "exited"} {n.geozone_name}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-[#667781]">{n.date_triggered}</span>
                    <span className="text-[10px] font-black text-[#128C7E]">
                      {EVENT_CONDITION_LABELS[n.condition as EventCondition] ?? n.condition}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {recentNotifs.length > 0 && (
            <div className="px-4 py-2 border-t border-[#E9EDEF] shrink-0">
              <button
                onClick={() => setOpen(false)}
                className="w-full text-center text-[12px] font-black text-[#128C7E] border-none bg-transparent cursor-pointer hover:underline"
              >
                View all in Events &amp; Notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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

  // Derive display values from auth state (populated during login) → safe fallbacks
  const displayName = authState.accountName || getCookie("_nvxs_account_name") || "User";
  const displayRole = authState.role || getCookie("_nvxs_account_role") || "";
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

        {/* Notification Bell */}
        <NotificationBell />

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
