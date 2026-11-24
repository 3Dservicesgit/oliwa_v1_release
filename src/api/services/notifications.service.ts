/**
 * notifications.service.ts — Event Notifications API service.
 *
 * Endpoints:
 *   POST   /notifications/log                     → logNotification
 *   GET    /notifications/{owner_uid}/list         → getNotifications
 *   PUT    /notifications/{notification_uid}/read  → markNotificationRead
 *   GET    /notifications/{owner_uid}/unread-count → getUnreadCount
 */

import { post, get, put } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ApiResponse, RequestOptions } from "../types";
import type {
  EventNotification,
  LogNotificationRequest,
} from "../types";

/** Log a triggered notification. */
export function logNotification(
  payload: LogNotificationRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return post<string>(ENDPOINTS.NOTIFICATIONS.LOG, { data: payload }, opts);
}

/** Fetch notification history for an owner. */
export function getNotifications(
  ownerUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<EventNotification[]>> {
  return get<EventNotification[]>(
    `${ENDPOINTS.NOTIFICATIONS.LIST}/${ownerUid}/list`,
    opts,
  );
}

/** Mark a notification as read. */
export function markNotificationRead(
  notificationUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return put<string>(
    `${ENDPOINTS.NOTIFICATIONS.MARK_READ}/${notificationUid}/read`,
    {},
    opts,
  );
}

/** Mark all notifications as read for an owner. */
export function markAllNotificationsRead(
  ownerUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<{ updated: number }>> {
  return put<{ updated: number }>(
    `${ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ}/${ownerUid}/mark-all-read`,
    {},
    opts,
  );
}

/** Get unread notification count. */
export function getUnreadCount(
  ownerUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<{ count: number }>> {
  return get<{ count: number }>(
    `${ENDPOINTS.NOTIFICATIONS.COUNT}/${ownerUid}/unread-count`,
    opts,
  );
}

// ── Every owner id the signed-in user's alerts are filed under ───────────────
//
// An alert's owner_uid is the owner of the rule that raised it. Rules are
// created under the user's account_uid (console and app both send
// event_owner_uid = account_uid), while other alerts are filed under the
// client (account_root). Reading one id alone misses the rest, so the
// functions below ask for both and merge.

/** The client (account_root) first, then the user's own account_uid. */
export function alertOwnerIds(accountRoot?: string | null, accountUid?: string | null): string[] {
  return [...new Set([accountRoot, accountUid].map((v) => (v ?? "").trim()).filter(Boolean))];
}

/** Settled pages from every owner; throws only when every owner failed. */
async function fromAll<T>(owners: string[], call: (owner: string) => Promise<ApiResponse<T>>): Promise<T[]> {
  const pages = await Promise.allSettled(owners.map(call));
  const ok = pages.filter((p): p is PromiseFulfilledResult<ApiResponse<T>> => p.status === "fulfilled");
  if (!ok.length && pages.length) throw (pages[0] as PromiseRejectedResult).reason;
  return ok.map((p) => p.value.data);
}

/** Notification history across owners: merged, de-duplicated, newest first. */
export async function getNotificationsForOwners(owners: string[]): Promise<EventNotification[]> {
  const seen = new Set<string>();
  return (await fromAll(owners, (o) => getNotifications(o)))
    .flatMap((rows) => (Array.isArray(rows) ? rows : []))
    .filter((n) => {
      if (!n.notification_uid) return true;
      if (seen.has(n.notification_uid)) return false;
      seen.add(n.notification_uid);
      return true;
    })
    .sort((a, b) => String(b.date_triggered ?? "").localeCompare(String(a.date_triggered ?? "")));
}

/** Unread alerts across owners. Each alert has one owner, so counts add up. */
export async function getUnreadCountForOwners(owners: string[]): Promise<number> {
  return (await fromAll(owners, (o) => getUnreadCount(o)))
    .reduce((sum, d) => sum + (typeof d === "object" && d !== null ? Number(d.count) || 0 : 0), 0);
}

/** Mark every owner's alerts read. */
export async function markAllNotificationsReadForOwners(owners: string[]): Promise<void> {
  await fromAll(owners, (o) => markAllNotificationsRead(o));
}
