/**
 * EventsPage — Events & Notifications management for clients.
 *
 * Lets users create event rules that monitor their devices for conditions
 * (speed, geofence breach, ignition, low battery, device offline) and fire
 * alerts via email, SMS, or push channels.
 *
 * Layout: Header + KPIs → Event Rules list → Create/Edit drawers.
 */
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useGuardedMutation } from "../../auth/guards";
import { GuardedButton } from "../../auth/guards";
import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from "../../api/services/events.service";
import {
  EVENT_CONDITION_LABELS,
  EVENT_CONDITION_DESCRIPTIONS,
} from "../../api/types/events.types";
import type {
  DeviceEvent,
  EventCondition,
  CreateEventRequest,
  UpdateEventRequest,
} from "../../api/types";
import { getCookie } from "../../utils/cookies";

// ── Condition icon map ──────────────────────────────────────────────────────

const CONDITION_ICONS: Record<EventCondition, string> = {
  speed_threshold:  "⚡",
  geofence_breach:  "📍",
  ignition_change:  "🔑",
  low_battery:      "🔋",
  device_offline:   "📡",
};

const CONDITION_COLORS: Record<EventCondition, string> = {
  speed_threshold:  "bg-[#F97316]/15 text-[#F97316] border-[#F97316]/30",
  geofence_breach:  "bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/30",
  ignition_change:  "bg-[#34B7F1]/15 text-[#34B7F1] border-[#34B7F1]/30",
  low_battery:      "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30",
  device_offline:   "bg-[#667781]/15 text-[#667781] border-[#667781]/30",
};

// ── Drawer: Create Event ────────────────────────────────────────────────────

function CreateEventDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { state: authState } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState<EventCondition>("speed_threshold");
  const [conditionValue, setConditionValue] = useState("");
  const [alertEmail, setAlertEmail] = useState("");
  const [alertPhone, setAlertPhone] = useState("");
  const [alertChannels, setAlertChannels] = useState<string[]>(["email"]);
  const [error, setError] = useState("");

  const ownerUid =
    authState.accountUid || getCookie("_nvxs_account_uid") || "";

  const create = useGuardedMutation("events.create", createEvent);

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    setError("");
    try {
      const payload: CreateEventRequest = {
        event_name: name.trim(),
        event_description: description.trim(),
        event_condition: condition,
        event_condition_value: conditionValue.trim(),
        alert_email: alertEmail.trim(),
        alert_phone_numbers: alertPhone.trim(),
        alert_channels: alertChannels,
        event_owner_uid: ownerUid,
      };
      await create.mutate(payload);
      // Reset form
      setName("");
      setDescription("");
      setCondition("speed_threshold");
      setConditionValue("");
      setAlertEmail("");
      setAlertPhone("");
      setAlertChannels(["email"]);
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create event.");
    }
  };

  const toggleChannel = (ch: string) => {
    setAlertChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-[480px] max-w-full h-full bg-white flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E9EDEF] shrink-0">
          <h2 className="font-black text-[16px] text-[#111B21]">Create Event Rule</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[#667781] font-black text-[14px] cursor-pointer grid place-items-center"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {error && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg px-3 py-2 text-[12px] text-[#EF4444]">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-[12px] font-black text-[#111B21] mb-1">Event Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Over Speed Alert"
              className="w-full h-10 rounded-lg border border-[#E9EDEF] px-3 text-[13px] text-[#111B21] placeholder:text-[#667781] outline-none focus:border-[#128C7E]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[12px] font-black text-[#111B21] mb-1">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this event rule monitors..."
              rows={3}
              className="w-full rounded-lg border border-[#E9EDEF] px-3 py-2 text-[13px] text-[#111B21] placeholder:text-[#667781] outline-none focus:border-[#128C7E] resize-none"
            />
          </div>

          {/* Condition Type */}
          <div>
            <label className="block text-[12px] font-black text-[#111B21] mb-2">Condition Type *</label>
            <div className="flex flex-col gap-2">
              {(Object.keys(EVENT_CONDITION_LABELS) as EventCondition[]).map((c) => (
                <label
                  key={c}
                  className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer transition-all ${
                    condition === c
                      ? "border-[#128C7E] bg-[#128C7E]/5"
                      : "border-[#E9EDEF] hover:border-[#128C7E]/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="condition"
                    value={c}
                    checked={condition === c}
                    onChange={() => setCondition(c)}
                    className="accent-[#128C7E]"
                  />
                  <span className="text-[16px]">{CONDITION_ICONS[c]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-black text-[#111B21]">
                      {EVENT_CONDITION_LABELS[c]}
                    </div>
                    <div className="text-[11px] text-[#667781]">
                      {EVENT_CONDITION_DESCRIPTIONS[c]}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Condition Value */}
          <div>
            <label className="block text-[12px] font-black text-[#111B21] mb-1">
              Threshold Value
            </label>
            <input
              value={conditionValue}
              onChange={(e) => setConditionValue(e.target.value)}
              placeholder={
                condition === "speed_threshold"
                  ? "e.g. 120 (km/h)"
                  : condition === "low_battery"
                    ? "e.g. 20 (%)"
                    : condition === "device_offline"
                      ? "e.g. 30 (minutes)"
                      : "Value"
              }
              className="w-full h-10 rounded-lg border border-[#E9EDEF] px-3 text-[13px] text-[#111B21] placeholder:text-[#667781] outline-none focus:border-[#128C7E]"
            />
            <p className="text-[11px] text-[#667781] mt-1">
              {condition === "speed_threshold" && "Speed in km/h. Alert fires when exceeded."}
              {condition === "geofence_breach" && "Enter geofence zone name or ID."}
              {condition === "ignition_change" && "Enter 'on' or 'off' to trigger on that state."}
              {condition === "low_battery" && "Battery percentage threshold (e.g. 20)."}
              {condition === "device_offline" && "Minutes before triggering offline alert."}
            </p>
          </div>

          {/* Alert Channels */}
          <div>
            <label className="block text-[12px] font-black text-[#111B21] mb-2">Alert Channels</label>
            <div className="flex gap-2">
              {["email", "sms", "push"].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={`h-8 px-4 rounded-full text-[12px] font-black border cursor-pointer transition-all ${
                    alertChannels.includes(ch)
                      ? "bg-[#128C7E]/10 border-[#128C7E]/30 text-[#128C7E]"
                      : "bg-white border-[#E9EDEF] text-[#667781]"
                  }`}
                >
                  {ch === "email" ? "Email" : ch === "sms" ? "SMS" : "Push"}
                </button>
              ))}
            </div>
          </div>

          {/* Alert Email */}
          {alertChannels.includes("email") && (
            <div>
              <label className="block text-[12px] font-black text-[#111B21] mb-1">Alert Email</label>
              <input
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                placeholder="alert@company.com"
                type="email"
                className="w-full h-10 rounded-lg border border-[#E9EDEF] px-3 text-[13px] text-[#111B21] placeholder:text-[#667781] outline-none focus:border-[#128C7E]"
              />
            </div>
          )}

          {/* Alert Phone */}
          {alertChannels.includes("sms") && (
            <div>
              <label className="block text-[12px] font-black text-[#111B21] mb-1">Phone Numbers</label>
              <input
                value={alertPhone}
                onChange={(e) => setAlertPhone(e.target.value)}
                placeholder="+256700123456, +254712345678"
                className="w-full h-10 rounded-lg border border-[#E9EDEF] px-3 text-[13px] text-[#111B21] placeholder:text-[#667781] outline-none focus:border-[#128C7E]"
              />
              <p className="text-[11px] text-[#667781] mt-1">Comma-separated phone numbers with country code.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#E9EDEF] shrink-0">
          <button
            onClick={onClose}
            className="h-10 px-5 rounded-lg bg-white border border-[#E9EDEF] text-[13px] font-black text-[#111B21] cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={create.isRunning}
            className="h-10 px-5 rounded-lg bg-[#25D366] text-[#075E54] text-[13px] font-black border-none cursor-pointer hover:brightness-105 disabled:opacity-50"
          >
            {create.isRunning ? "Creating..." : "Create Event"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Drawer: Edit Event ──────────────────────────────────────────────────────

function EditEventDrawer({
  open,
  event,
  onClose,
  onUpdated,
}: {
  open: boolean;
  event: DeviceEvent | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState<EventCondition>("speed_threshold");
  const [conditionValue, setConditionValue] = useState("");
  const [alertEmail, setAlertEmail] = useState("");
  const [alertPhone, setAlertPhone] = useState("");
  const [alertChannels, setAlertChannels] = useState<string[]>(["email"]);
  const [error, setError] = useState("");

  const update = useGuardedMutation(
    "events.update",
    (uid: string, payload: UpdateEventRequest) => updateEvent(uid, payload),
  );

  // Populate form when event changes
  useEffect(() => {
    if (event) {
      setName(event.event_name);
      setDescription(event.description);
      setCondition(event.condition);
      setConditionValue(event.condition_value);
      setAlertEmail(event.alert_email || "");
      setAlertPhone(event.alert_phone_numbers || "");
      try {
        const methods = JSON.parse(event.alert_methods || "[]");
        setAlertChannels(Array.isArray(methods) ? methods : ["email"]);
      } catch {
        setAlertChannels(["email"]);
      }
      setError("");
    }
  }, [event]);

  const handleSubmit = async () => {
    if (!event) return;
    if (!name.trim() || !description.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    setError("");
    try {
      const payload: UpdateEventRequest = {
        event_name: name.trim(),
        event_description: description.trim(),
        event_condition: condition,
        event_condition_value: conditionValue.trim(),
        alert_email: alertEmail.trim(),
        alert_phone_numbers: alertPhone.trim(),
        alert_channels: alertChannels,
      };
      await update.mutate(event.event_uid, payload);
      onUpdated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update event.");
    }
  };

  const toggleChannel = (ch: string) => {
    setAlertChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  };

  if (!open || !event) return null;

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-[480px] max-w-full h-full bg-white flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E9EDEF] shrink-0">
          <h2 className="font-black text-[16px] text-[#111B21]">Edit Event Rule</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[#667781] font-black text-[14px] cursor-pointer grid place-items-center"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {error && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg px-3 py-2 text-[12px] text-[#EF4444]">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-[12px] font-black text-[#111B21] mb-1">Event Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 rounded-lg border border-[#E9EDEF] px-3 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[12px] font-black text-[#111B21] mb-1">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[#E9EDEF] px-3 py-2 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E] resize-none"
            />
          </div>

          {/* Condition Type */}
          <div>
            <label className="block text-[12px] font-black text-[#111B21] mb-2">Condition Type *</label>
            <div className="flex flex-col gap-2">
              {(Object.keys(EVENT_CONDITION_LABELS) as EventCondition[]).map((c) => (
                <label
                  key={c}
                  className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer transition-all ${
                    condition === c
                      ? "border-[#128C7E] bg-[#128C7E]/5"
                      : "border-[#E9EDEF] hover:border-[#128C7E]/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="edit-condition"
                    value={c}
                    checked={condition === c}
                    onChange={() => setCondition(c)}
                    className="accent-[#128C7E]"
                  />
                  <span className="text-[16px]">{CONDITION_ICONS[c]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-black text-[#111B21]">
                      {EVENT_CONDITION_LABELS[c]}
                    </div>
                    <div className="text-[11px] text-[#667781]">
                      {EVENT_CONDITION_DESCRIPTIONS[c]}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Condition Value */}
          <div>
            <label className="block text-[12px] font-black text-[#111B21] mb-1">
              Threshold Value
            </label>
            <input
              value={conditionValue}
              onChange={(e) => setConditionValue(e.target.value)}
              className="w-full h-10 rounded-lg border border-[#E9EDEF] px-3 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E]"
            />
          </div>

          {/* Alert Channels */}
          <div>
            <label className="block text-[12px] font-black text-[#111B21] mb-2">Alert Channels</label>
            <div className="flex gap-2">
              {["email", "sms", "push"].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={`h-8 px-4 rounded-full text-[12px] font-black border cursor-pointer transition-all ${
                    alertChannels.includes(ch)
                      ? "bg-[#128C7E]/10 border-[#128C7E]/30 text-[#128C7E]"
                      : "bg-white border-[#E9EDEF] text-[#667781]"
                  }`}
                >
                  {ch === "email" ? "Email" : ch === "sms" ? "SMS" : "Push"}
                </button>
              ))}
            </div>
          </div>

          {/* Alert Email */}
          {alertChannels.includes("email") && (
            <div>
              <label className="block text-[12px] font-black text-[#111B21] mb-1">Alert Email</label>
              <input
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                type="email"
                className="w-full h-10 rounded-lg border border-[#E9EDEF] px-3 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E]"
              />
            </div>
          )}

          {/* Alert Phone */}
          {alertChannels.includes("sms") && (
            <div>
              <label className="block text-[12px] font-black text-[#111B21] mb-1">Phone Numbers</label>
              <input
                value={alertPhone}
                onChange={(e) => setAlertPhone(e.target.value)}
                className="w-full h-10 rounded-lg border border-[#E9EDEF] px-3 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E]"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#E9EDEF] shrink-0">
          <button
            onClick={onClose}
            className="h-10 px-5 rounded-lg bg-white border border-[#E9EDEF] text-[13px] font-black text-[#111B21] cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={update.isRunning}
            className="h-10 px-5 rounded-lg bg-[#128C7E] text-white text-[13px] font-black border-none cursor-pointer hover:brightness-105 disabled:opacity-50"
          >
            {update.isRunning ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirmation modal ───────────────────────────────────────────────

function DeleteConfirmModal({
  open,
  event,
  onClose,
  onDeleted,
}: {
  open: boolean;
  event: DeviceEvent | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const del = useGuardedMutation(
    "events.delete",
    (uid: string) => deleteEvent(uid),
  );

  const handleDelete = async () => {
    if (!event) return;
    try {
      await del.mutate(event.event_uid);
      onDeleted();
      onClose();
    } catch {
      // error handled by guard
    }
  };

  if (!open || !event) return null;

  return (
    <div className="fixed inset-0 bg-black/35 z-50 grid place-items-center" onClick={onClose}>
      <div
        className="w-[420px] max-w-[calc(100vw-24px)] bg-white rounded-xl overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 text-center">
          <div className="text-[36px] mb-3">&#x26A0;&#xFE0F;</div>
          <h3 className="font-black text-[16px] text-[#111B21] mb-2">Delete Event Rule</h3>
          <p className="text-[13px] text-[#667781] mb-1">
            Are you sure you want to delete <strong>{event.event_name}</strong>?
          </p>
          <p className="text-[12px] text-[#667781]">
            This action cannot be undone. All associated alert configurations will be removed.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#E9EDEF]">
          <button
            onClick={onClose}
            className="h-10 px-5 rounded-lg bg-white border border-[#E9EDEF] text-[13px] font-black text-[#111B21] cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={del.isRunning}
            className="h-10 px-5 rounded-lg bg-[#EF4444] text-white text-[13px] font-black border-none cursor-pointer hover:brightness-105 disabled:opacity-50"
          >
            {del.isRunning ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Event Card ──────────────────────────────────────────────────────────────

function EventCard({
  event,
  onEdit,
  onDelete,
}: {
  event: DeviceEvent;
  onEdit: (e: DeviceEvent) => void;
  onDelete: (e: DeviceEvent) => void;
}) {
  const condKey = event.condition as EventCondition;
  const label = EVENT_CONDITION_LABELS[condKey] ?? event.condition;
  const icon = CONDITION_ICONS[condKey] ?? "?";
  const colorClass = CONDITION_COLORS[condKey] ?? "bg-[#667781]/15 text-[#667781] border-[#667781]/30";

  // Parse alert channels
  let channels: string[] = [];
  try {
    const parsed = JSON.parse(event.alert_methods || "[]");
    channels = Array.isArray(parsed) ? parsed : [];
  } catch {
    channels = [];
  }

  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl p-4 hover:border-[#128C7E]/40 transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-10 h-10 rounded-xl border flex items-center justify-center text-[18px] shrink-0 ${colorClass}`}>
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="font-black text-[14px] text-[#111B21] truncate">{event.event_name}</h3>
            <p className="text-[12px] text-[#667781] truncate">{event.description}</p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <GuardedButton
            permission="events.update"
            onClick={() => onEdit(event)}
            className="w-8 h-8 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[#667781] text-[12px] cursor-pointer grid place-items-center hover:bg-[#128C7E]/10 hover:text-[#128C7E]"
          >
            &#9998;
          </GuardedButton>
          <GuardedButton
            permission="events.delete"
            onClick={() => onDelete(event)}
            className="w-8 h-8 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[#667781] text-[12px] cursor-pointer grid place-items-center hover:bg-[#EF4444]/10 hover:text-[#EF4444]"
          >
            &#128465;
          </GuardedButton>
        </div>
      </div>

      {/* Condition & Value */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${colorClass}`}>
          {label}
        </span>
        <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-[#F0F2F5] text-[#111B21] border border-[#E9EDEF]">
          Threshold: {event.condition_value}
        </span>
      </div>

      {/* Alert info row */}
      <div className="flex items-center gap-4 text-[11px] text-[#667781]">
        {channels.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="font-black">Channels:</span>
            {channels.map((ch) => (
              <span key={ch} className="bg-[#128C7E]/10 text-[#128C7E] px-1.5 py-0.5 rounded text-[10px] font-black">
                {ch}
              </span>
            ))}
          </span>
        )}
        {event.alert_email && (
          <span className="truncate max-w-[160px]" title={event.alert_email}>
            {event.alert_email}
          </span>
        )}
        {event.date_created && (
          <span className="ml-auto shrink-0">
            Created: {event.date_created}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export function EventsPage() {
  const { state: authState } = useAuth();
  const [events, setEvents] = useState<DeviceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<DeviceEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeviceEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const ownerUid =
    authState.accountUid || getCookie("_nvxs_account_uid") || "";
  const accountType =
    authState.accountType || getCookie("_nvxs_account_type") || "";

  const fetchEvents = useCallback(async () => {
    if (!ownerUid) return;
    setLoading(true);
    setError("");
    try {
      const loadLevel = accountType === "service_provider" ? "ussrx" as const : "usri" as const;
      const res = await getEvents(ownerUid, loadLevel);
      setEvents(res.data ?? []);
    } catch (e) {
      // 400 "No Events Found" is expected for empty state
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("No Events Found") || msg.includes("400")) {
        setEvents([]);
      } else {
        setError("Failed to load events.");
      }
    } finally {
      setLoading(false);
    }
  }, [ownerUid, accountType]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Filter events by search
  const filteredEvents = events.filter((ev) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      ev.event_name.toLowerCase().includes(q) ||
      ev.description.toLowerCase().includes(q) ||
      ev.condition.toLowerCase().includes(q)
    );
  });

  // KPI stats
  const totalEvents = events.length;
  const conditionCounts = events.reduce<Record<string, number>>((acc, ev) => {
    acc[ev.condition] = (acc[ev.condition] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <main className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-3 p-3">

          {/* Header */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-baseline gap-3">
                <span className="font-black text-[18px] text-[#111B21] tracking-wide">
                  EVENTS & NOTIFICATIONS
                </span>
                <span className="text-[13px] text-[#667781]">
                  — Device monitoring rules & alert configuration
                </span>
              </div>
              <GuardedButton
                permission="events.create"
                onClick={() => setCreateOpen(true)}
                className="h-8 px-4 rounded-full bg-[#25D366] text-[#075E54] text-[12px] font-black border-none cursor-pointer hover:brightness-105 whitespace-nowrap"
              >
                + New Event Rule
              </GuardedButton>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white border border-[#E9EDEF] rounded-xl p-3">
              <div className="text-[11px] text-[#667781]">Total Rules</div>
              <div className="text-[22px] font-black text-[#111B21] mt-1 leading-tight">{totalEvents}</div>
              <div className="text-[10px] text-[#667781] mt-1">Active event rules</div>
            </div>
            <div className="bg-white border border-[#E9EDEF] rounded-xl p-3">
              <div className="text-[11px] text-[#667781]">Speed Alerts</div>
              <div className="text-[22px] font-black text-[#F97316] mt-1 leading-tight">{conditionCounts["speed_threshold"] ?? 0}</div>
              <div className="text-[10px] text-[#667781] mt-1">Speed threshold rules</div>
            </div>
            <div className="bg-white border border-[#E9EDEF] rounded-xl p-3">
              <div className="text-[11px] text-[#667781]">Geofence Alerts</div>
              <div className="text-[22px] font-black text-[#8B5CF6] mt-1 leading-tight">{conditionCounts["geofence_breach"] ?? 0}</div>
              <div className="text-[10px] text-[#667781] mt-1">Zone breach rules</div>
            </div>
            <div className="bg-white border border-[#E9EDEF] rounded-xl p-3">
              <div className="text-[11px] text-[#667781]">Other Alerts</div>
              <div className="text-[22px] font-black text-[#128C7E] mt-1 leading-tight">
                {(conditionCounts["ignition_change"] ?? 0) +
                  (conditionCounts["low_battery"] ?? 0) +
                  (conditionCounts["device_offline"] ?? 0)}
              </div>
              <div className="text-[10px] text-[#667781] mt-1">Ignition / Battery / Offline</div>
            </div>
          </div>

          {/* Search bar */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-2.5 flex items-center gap-3">
            <span className="text-[14px] text-[#667781]">&#128269;</span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search event rules by name, description, or condition..."
              className="flex-1 h-8 text-[13px] text-[#111B21] placeholder:text-[#667781] outline-none border-none bg-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-[12px] text-[#667781] cursor-pointer border-none bg-transparent"
              >
                Clear
              </button>
            )}
          </div>

          {/* Event List */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
                <span className="text-[13px] text-[#667781]">Loading events...</span>
              </div>
            </div>
          ) : error ? (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl px-4 py-3 text-[13px] text-[#EF4444]">
              {error}
              <button
                onClick={fetchEvents}
                className="ml-3 text-[12px] font-black underline cursor-pointer border-none bg-transparent text-[#EF4444]"
              >
                Retry
              </button>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 text-center">
              <div className="text-[36px] mb-3">&#9889;</div>
              <h3 className="font-black text-[16px] text-[#111B21] mb-2">
                {searchQuery ? "No matching events" : "No Event Rules Yet"}
              </h3>
              <p className="text-[13px] text-[#667781] mb-4">
                {searchQuery
                  ? "Try adjusting your search query."
                  : "Create your first event rule to start monitoring your devices for important conditions like speed, geofence breaches, and more."}
              </p>
              {!searchQuery && (
                <GuardedButton
                  permission="events.create"
                  onClick={() => setCreateOpen(true)}
                  className="h-10 px-6 rounded-lg bg-[#25D366] text-[#075E54] text-[13px] font-black border-none cursor-pointer hover:brightness-105"
                >
                  Create First Event Rule
                </GuardedButton>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filteredEvents.map((ev) => (
                <EventCard
                  key={ev.event_uid}
                  event={ev}
                  onEdit={setEditEvent}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Drawers & Modals */}
      <CreateEventDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={fetchEvents}
      />
      <EditEventDrawer
        open={!!editEvent}
        event={editEvent}
        onClose={() => setEditEvent(null)}
        onUpdated={fetchEvents}
      />
      <DeleteConfirmModal
        open={!!deleteTarget}
        event={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={fetchEvents}
      />
    </div>
  );
}
