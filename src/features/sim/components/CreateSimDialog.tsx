/**
 * CreateSimDialog — Modal dialog for registering a new SIM card.
 *
 * Calls POST /devices/simcards/create and reports success/error
 * back to the parent via onCreated / inline error state.
 */
import React, { useState } from "react";
import { createSimCard, ApiError } from "../../../api";
import type { CreateSimCardRequest } from "../../../api";

interface CreateSimDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const TELECOM_OPTIONS = ["mtn_ug", "mtn_ke", "airtel_ug", "airtel_ke", "safaricom"];

const INITIAL_FORM: CreateSimCardRequest = {
  telecom: TELECOM_OPTIONS[0],
  simcard_number: "",
  simcard_owner: "",
  simcard_owner_parent: "",
};

export function CreateSimDialog({ open, onClose, onCreated }: CreateSimDialogProps) {
  const [form, setForm] = useState<CreateSimCardRequest>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function update<K extends keyof CreateSimCardRequest>(key: K, value: CreateSimCardRequest[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetAndClose() {
    setForm(INITIAL_FORM);
    setError(null);
    setSubmitting(false);
    onClose();
  }

  async function handleSubmit() {
    if (!form.simcard_number.trim()) {
      setError("SIM card number is required.");
      return;
    }
    if (!form.simcard_owner.trim()) {
      setError("SIM card owner is required.");
      return;
    }
    if (!form.simcard_owner_parent.trim()) {
      setError("Owner parent is required.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await createSimCard(form);
      onCreated?.();
      resetAndClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.apiMessage ?? err.message : "Failed to create SIM card.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/35 z-300 grid place-items-center" onClick={resetAndClose}>
      <div
        className="w-[min(540px,calc(100vw-24px))] max-h-[calc(100vh-24px)] bg-white rounded-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[var(--brand-dark)] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <span className="font-black text-[15px]">Register New SIM Card</span>
          <button
            onClick={resetAndClose}
            className="w-7 h-7 rounded-lg bg-white/15 text-white font-black text-[13px] cursor-pointer grid place-items-center border-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-5">
          <div className="flex flex-col gap-4">

            {/* Telecom */}
            <div className="flex flex-col gap-1.5">
              <div className="text-[12px] font-extrabold text-[#111B21]">Telecom Provider</div>
              <select
                value={form.telecom}
                onChange={(e) => update("telecom", e.target.value)}
                disabled={submitting}
                className="w-full h-10 px-3 rounded-lg border border-[#E9EDEF] bg-white text-[12px] text-[#111B21] outline-none focus:border-[var(--brand)] transition-colors cursor-pointer"
              >
                {TELECOM_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* SIM Card Number */}
            <div className="flex flex-col gap-1.5">
              <div className="text-[12px] font-extrabold text-[#111B21]">SIM Card Number</div>
              <input
                type="text"
                value={form.simcard_number}
                onChange={(e) => update("simcard_number", e.target.value)}
                placeholder="e.g. 256776497380"
                disabled={submitting}
                className="w-full h-10 px-3 rounded-lg border border-[#E9EDEF] bg-white text-[12px] text-[#111B21] outline-none focus:border-[var(--brand)] transition-colors"
              />
            </div>

            {/* SIM Card Owner */}
            <div className="flex flex-col gap-1.5">
              <div className="text-[12px] font-extrabold text-[#111B21]">SIM Card Owner</div>
              <input
                type="text"
                value={form.simcard_owner}
                onChange={(e) => update("simcard_owner", e.target.value)}
                placeholder="Owner UID"
                disabled={submitting}
                className="w-full h-10 px-3 rounded-lg border border-[#E9EDEF] bg-white text-[12px] text-[#111B21] outline-none focus:border-[var(--brand)] transition-colors"
              />
            </div>

            {/* Owner Parent */}
            <div className="flex flex-col gap-1.5">
              <div className="text-[12px] font-extrabold text-[#111B21]">Owner Parent</div>
              <input
                type="text"
                value={form.simcard_owner_parent}
                onChange={(e) => update("simcard_owner_parent", e.target.value)}
                placeholder="e.g. sentinel"
                disabled={submitting}
                className="w-full h-10 px-3 rounded-lg border border-[#E9EDEF] bg-white text-[12px] text-[#111B21] outline-none focus:border-[var(--brand)] transition-colors"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="px-3 py-2 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-[12px] font-black text-[#EF4444]">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#E9EDEF] bg-white shrink-0">
          <button
            onClick={resetAndClose}
            disabled={submitting}
            className="h-10 px-6 rounded-lg bg-white border border-[#E9EDEF] text-[13px] font-black text-[#111B21] cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="h-10 px-6 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] text-[13px] font-black border-none cursor-pointer hover:brightness-105 disabled:opacity-50"
          >
            {submitting ? "Registering…" : "Register SIM"}
          </button>
        </div>
      </div>
    </div>
  );
}
