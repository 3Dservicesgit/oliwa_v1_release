/**
 * events.types.ts — TypeScript types for the Events & Notifications module.
 *
 * Maps to backend table: dll_device_events
 * Backend routes in: endpoints/devices.py (/events/*)
 */

// ── Condition types ─────────────────────────────────────────────────────────

export type EventCondition =
  | "speed_threshold"
  | "geofence_breach"
  | "ignition_change"
  | "low_battery"
  | "device_offline";

export const EVENT_CONDITION_LABELS: Record<EventCondition, string> = {
  speed_threshold:  "Speed Threshold",
  geofence_breach:  "Geofence Breach",
  ignition_change:  "Ignition Change",
  low_battery:      "Low Battery",
  device_offline:   "Device Offline",
};

export const EVENT_CONDITION_DESCRIPTIONS: Record<EventCondition, string> = {
  speed_threshold:  "Triggers when a device exceeds a specified speed (km/h)",
  geofence_breach:  "Triggers when a device enters or exits a geofence zone",
  ignition_change:  "Triggers when the ignition state changes (on/off)",
  low_battery:      "Triggers when the device battery drops below a threshold (%)",
  device_offline:   "Triggers when a device goes offline for a duration (minutes)",
};

// ── Event model ─────────────────────────────────────────────────────────────

export interface DeviceEvent {
  event_uid: string;
  event_name: string;
  description: string;
  condition: EventCondition;
  condition_value: string;
  date_created: string;
  device_count: string;
  alert_methods: string;       // JSON string of alert channels
  alert_email: string;
  alert_phone_numbers: string;
  /** Only present in ussrx (admin) load level */
  event_owner?: string;
}

// ── Request payloads ────────────────────────────────────────────────────────

export interface CreateEventRequest {
  event_name: string;
  event_description: string;
  event_condition: EventCondition;
  event_condition_value: string;
  alert_email: string;
  alert_phone_numbers: string;
  alert_channels: string[];
  event_owner_uid: string;
}

export interface UpdateEventRequest {
  event_name: string;
  event_description: string;
  event_condition: EventCondition;
  event_condition_value: string;
  alert_email: string;
  alert_phone_numbers: string;
  alert_channels: string[];
}

export type EventLoadLevel = "usri" | "ussrx";

export interface GetEventsRequest {
  load_level: EventLoadLevel;
  owner_uid: string;
}
