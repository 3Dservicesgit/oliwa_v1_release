/**
 * CreateSubOrgModal — Quick-create a Sub-Org under an existing parent.
 *
 * Simplified form (vs the full blade onboarding wizard) for fast sub-org creation.
 * Fields: name, parent, country, currency, timezone.
 * Tier is locked to "ORG".
 */
import React, { useEffect, useState } from "react";
import { createTenant, getAllTenants, ApiError } from "../../../api";
import type { Tenant } from "../../../api";

interface CreateSubOrgModalProps {
  open:      boolean;
  onClose:   () => void;
  onCreated?: () => void;
}

const COUNTRIES = ["UG", "KE", "TZ", "RW", "SS", "CD"];
const CURRENCIES = ["UGX", "KES", "TZS", "RWF", "SSP", "CDF", "USD", "EUR"];
const TIMEZONES = ["Africa/Kampala", "Africa/Nairobi", "Africa/Dar_es_Salaam", "Africa/Kigali", "Africa/Juba"];

export function CreateSubOrgModal({ open, onClose, onCreated }: CreateSubOrgModalProps) {
  const [form, setForm] = useState({
    name:     "",
    parent_id: "",
    country:  "UG",
    currency: "UGX",
    timezone: "Africa/Kampala",
  });
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [parents, setParents]       = useState<Tenant[]>([]);
  const [parentsLoading, setParentsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setParentsLoading(true);
    getAllTenants()
      .then((res) => setParents(res.data))
      .catch(() => {})
      .finally(() => setParentsLoading(false));
  }, [open]);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  function reset() {
    setForm({ name: "", parent_id: "", country: "UG", currency: "UGX", timezone: "Africa/Kampala" });
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setError("Tenant name is required."); return; }
    if (!form.parent_id)   { setError("Select a parent account."); return; }

    setLoading(true);
    setError(null);
    try {
      await createTenant({
        name:      form.name.trim(),
        tier:      "ORG",
        parent_id: form.parent_id,
        country:   form.country,
        currency:  form.currency,
        timezone:  form.timezone,
      });
      onCreated?.();
      handleClose();
    } catch (err) {
      if (err instanceof ApiError) setError(err.apiMessage ?? err.message);
      else setError("Failed to create sub-org. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleClose}>
      <div className="bg-white rounded-xl w-[480px] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E9EDEF]">
          <div>
            <div className="font-black text-[14px] text-[#111B21]">Create Sub-Org</div>
            <div className="text-[11px] text-[#667781] mt-0.5">Quick-create an ORG-tier tenant under an existing parent.</div>
          </div>
          <button onClick={handleClose} className="text-[11px] text-[#667781] bg-[#F0F2F5] border border-[#E9EDEF] rounded-lg px-3 py-1.5 cursor-pointer font-black hover:bg-[#E9EDEF]">Close</button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-4">
          {/* Tier badge */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-[#667781]">Tier:</span>
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[var(--brand-dark)] text-white">ORG</span>
          </div>

          {/* Name */}
          <Field label="Tenant name" placeholder="e.g. Kampala_Boda_Fleet">
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Kampala_Boda_Fleet"
              className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-[#F8FAFC] px-3 text-[12px] font-black text-[#111B21] outline-none focus:border-[var(--brand)] transition-colors"
            />
          </Field>

          {/* Parent */}
          <Field label="Parent account">
            <select
              value={form.parent_id}
              onChange={(e) => update("parent_id", e.target.value)}
              className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-[#F8FAFC] px-3 text-[12px] font-black text-[#111B21] outline-none focus:border-[var(--brand)] transition-colors cursor-pointer"
            >
              <option value="">{parentsLoading ? "Loading..." : "Select parent..."}</option>
              {parents.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.tier})</option>)}
            </select>
          </Field>

          {/* Country + Currency row */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Country">
              <select
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
                className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-[#F8FAFC] px-3 text-[12px] font-black text-[#111B21] outline-none focus:border-[var(--brand)] transition-colors cursor-pointer"
              >
                {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Currency">
              <select
                value={form.currency}
                onChange={(e) => update("currency", e.target.value)}
                className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-[#F8FAFC] px-3 text-[12px] font-black text-[#111B21] outline-none focus:border-[var(--brand)] transition-colors cursor-pointer"
              >
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          {/* Timezone */}
          <Field label="Timezone">
            <select
              value={form.timezone}
              onChange={(e) => update("timezone", e.target.value)}
              className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-[#F8FAFC] px-3 text-[12px] font-black text-[#111B21] outline-none focus:border-[var(--brand)] transition-colors cursor-pointer"
            >
              {TIMEZONES.map((tz) => <option key={tz}>{tz}</option>)}
            </select>
          </Field>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 rounded-lg bg-[#FEF2F2] text-[12px] text-[#EF4444] font-black">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#E9EDEF]">
          <button onClick={handleClose} className="h-8 px-4 rounded-full bg-[#F0F2F5] text-[11px] font-black text-[#667781] border-none cursor-pointer hover:bg-[#E9EDEF] transition-all">
            Cancel
          </button>
          <button
            disabled={loading}
            onClick={handleSubmit}
            className="h-8 px-4 rounded-full bg-[var(--brand)] text-white text-[11px] font-black border-none cursor-pointer hover:brightness-105 transition-all disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Sub-Org"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; placeholder?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-black text-[#667781] mb-1.5">{label}</div>
      {children}
    </div>
  );
}
