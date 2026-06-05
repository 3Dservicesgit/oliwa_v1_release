/**
 * events.service.ts — Device Events & Notifications API service.
 *
 * Endpoints:
 *   POST   /events/create                → createEvent
 *   POST   /events/{event_uid}/update    → updateEvent
 *   POST   /events/getall                → getEvents
 *   GET    /events/{event_id}/details    → getEventDetails
 *   DELETE /events/{event_uid}/delete    → deleteEvent
 */

import { post, get, del } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ApiResponse, RequestOptions } from "../types";
import type {
  DeviceEvent,
  CreateEventRequest,
  UpdateEventRequest,
  EventLoadLevel,
} from "../types";

// ── CRUD ────────────────────────────────────────────────────────────────────

/** Create a new device event rule. */
export function createEvent(
  payload: CreateEventRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return post<string>(ENDPOINTS.DEVICE_EVENTS.CREATE, { data: payload }, opts);
}

/** Update an existing event rule. */
export function updateEvent(
  eventUid: string,
  payload: UpdateEventRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return post<string>(
    `${ENDPOINTS.DEVICE_EVENTS.UPDATE}/${eventUid}/update`,
    { data: payload },
    opts,
  );
}

/**
 * Fetch all events for an owner.
 * @param ownerUid   The account UID
 * @param loadLevel  "usri" for tenant-scoped, "ussrx" for all (admin)
 */
export function getEvents(
  ownerUid: string,
  loadLevel: EventLoadLevel = "usri",
  opts?: RequestOptions,
): Promise<ApiResponse<DeviceEvent[]>> {
  return post<DeviceEvent[]>(
    ENDPOINTS.DEVICE_EVENTS.GET_ALL,
    {
      data: {
        load_level: loadLevel,
        owner_uid: ownerUid,
      },
    },
    opts,
  );
}

/** Fetch details for a single event. */
export function getEventDetails(
  eventId: string,
  opts?: RequestOptions,
): Promise<ApiResponse<DeviceEvent>> {
  return get<DeviceEvent>(
    `${ENDPOINTS.DEVICE_EVENTS.DETAILS}/${eventId}/details`,
    opts,
  );
}

/** Delete an event rule. */
export function deleteEvent(
  eventUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return del<string>(
    `${ENDPOINTS.DEVICE_EVENTS.DELETE}/${eventUid}/delete`,
    undefined,
    opts,
  );
}
