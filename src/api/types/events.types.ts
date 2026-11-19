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
  | "device_offline"
  // Checked when fuel is recorded in FuelMath (no fuel sensor needed).
  | "fuel_issue_flagged"
  | "high_fuel_consumption"
  // Client-wide: about the client's drivers, never attached to vehicles.
  | "driver_permit_expiry"
  | "driver_unauthorised";

export const EVENT_CONDITION_LABELS: Record<EventCondition, string> = {
  speed_threshold:  "Speed Threshold",
  geofence_breach:  "Geofence Entry/Exit",
  ignition_change:  "Ignition Change",
  low_battery:      "Low Battery",
  device_offline:   "Device Offline",
  fuel_issue_flagged:    "Fuel Issue Flagged",
  high_fuel_consumption: "High Fuel Consumption",
  driver_permit_expiry:  "Driver Permit Expiry",
  driver_unauthorised:   "Unauthorised Driver",
};

export const EVENT_CONDITION_DESCRIPTIONS: Record<EventCondition, string> = {
  // As the OLIWA mobile app words them (lib/models/device_event.dart).
  speed_threshold:  "Triggers once each time a device goes over the speed limit (km/h), not again until it slows down.",
  geofence_breach:  "Triggers when a device enters or exits a geofence zone.",
  ignition_change:  "Triggers when the ignition is switched on or off. Needs the unit's ignition input to be set up.",
  low_battery:      "Not available yet: battery readings from the trackers do not reach the server.",
  device_offline:   "Triggers once when a device has sent nothing for the minutes you set, and not again until it reports.",
  fuel_issue_flagged:    "Triggers when fuel recorded in Fuel Refill for the vehicle does not match the tracker or the vehicle, e.g. it was not stopped at the pump. Works without a fuel sensor.",
  high_fuel_consumption: "Triggers when a full tank shows the vehicle used more fuel than its expected km/L allows since the last full tank (at least 100 km). Needs a fuel profile; works without a fuel sensor.",
  driver_permit_expiry:  "Covers all your drivers. Triggers once when a driver's permit comes within the days you set of expiring, and once more when it expires. Replaces the built-in permit reminders for your account.",
  driver_unauthorised:   "Covers all your drivers. Triggers when a driver keeps a vehicle after their permit has expired, or when someone tries to assign a suspended, blacklisted, inactive or expired-permit driver and is refused.",
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

// ── Notification types ─────────────────────────────────────────────────────

export interface EventNotification {
  notification_uid: string;
  event_uid: string;
  event_name: string;
  device_imei: string;
  device_name: string;
  condition: EventCondition;
  trigger_value: string;
  geozone_name?: string;
  breach_type?: "enter" | "exit";
  alert_channels: string;
  date_triggered: string;
  is_read: boolean;
  /** The driver the alert is about (navas-core-apis migration 060): the one
   *  assigned to the vehicle when it fired, the one fuel was issued to, or
   *  the subject of a driver rule. "" when none. */
  driver_uid?: string;
  driver_name?: string;
}

export interface LogNotificationRequest {
  event_uid: string;
  event_name: string;
  device_imei: string;
  device_name: string;
  condition: EventCondition;
  trigger_value: string;
  geozone_name?: string;
  breach_type?: string;
  alert_channels: string[];
  owner_uid: string;
}
