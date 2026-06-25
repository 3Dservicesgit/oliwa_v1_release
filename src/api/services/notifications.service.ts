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
