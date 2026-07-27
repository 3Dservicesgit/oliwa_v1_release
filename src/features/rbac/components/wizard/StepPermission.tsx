import React, { useEffect, useState } from "react";
import { createPermission, getAllPermissions } from "../../../../api";
import type { RbacPermission } from "../../../../api";
import { useAuth } from "../../../../auth/AuthContext";
import { MSection, Field, StepSuccessBanner, ErrorBanner, INPUT_CLS, BTN_PRIMARY } from "./WizardShared";

const DEFAULT_MODULES = ["billing", "gps", "alerts", "tokens", "rbac", "tenants", "devices", "veba", "noc", "reports"];

interface Props {
  onSuccess: (permissionUids?: string[]) => void;
  onClose: () => void;
  onNext: () => void;
}

export function StepPermission({ onSuccess, onClose, onNext }: Props) {
  const { state: { accountUid, accountRoot } } = useAuth();
  const [permissionName, setPermissionName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [customModule, setCustomModule] = useState("");

  const [modules, setModules] = useState<string[]>(DEFAULT_MODULES);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch existing modules
  useEffect(() => {
    setModulesLoading(true);
    getAllPermissions(accountRoot || "engine")
      .then((res) => {
        const existing = new Set<string>();
        (res.data as RbacPermission[]).forEach((p) => {
          if (p.permission_module) existing.add(p.permission_module.toLowerCase());
        });
        DEFAULT_MODULES.forEach((m) => existing.add(m));
        setModules([...existing].sort());
      })
      .catch(() => setModules(DEFAULT_MODULES))
      .finally(() => setModulesLoading(false));
  }, []);

  function toggleModule(mod: string) {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  }

  function toggleAll() {
    if (selectedModules.size === modules.length) {
      setSelectedModules(new Set());
    } else {
      setSelectedModules(new Set(modules));
    }
  }

  const activeModules = [...selectedModules];
  if (customModule.trim() && !selectedModules.has(customModule.trim().toLowerCase())) {
    activeModules.push(customModule.trim().toLowerCase());
  }

  async function handleSubmit() {
    if (!permissionName.trim() || !description.trim() || activeModules.length === 0) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const results = await Promise.allSettled(
        activeModules.map((mod) =>
          createPermission({
            permission_name: `${mod}.${permissionName.trim()}`,
            permission_description: description.trim(),
            permission_module: mod,
            account_root: accountRoot ?? "engine",
            created_by: accountUid ?? "system",
          })
        )
      );

      const created: string[] = [];
      const skipped: string[] = [];
      const failed: string[] = [];

      results.forEach((r, i) => {
        const mod = activeModules[i];
        if (r.status === "fulfilled") {
          created.push(mod);
        } else {
          const err = r.reason;
          if (err?.status === 400) {
            skipped.push(mod);
          } else {
            failed.push(mod);
          }
        }
      });

      if (skipped.length === activeModules.length) {
        setError(`All ${skipped.length} permissions already exist: ${skipped.join(", ")}`);
      } else if (skipped.length > 0 || failed.length > 0) {
        const parts: string[] = [];
        if (created.length > 0) parts.push(`${created.length} created`);
        if (skipped.length > 0) parts.push(`${skipped.length} already exist (${skipped.join(", ")})`);
        if (failed.length > 0) parts.push(`${failed.length} failed (${failed.join(", ")})`);
        setError(parts.join(" \u00b7 "));
      }

      if (created.length > 0) {
        setSuccess(`Successfully created ${created.length} permission(s): ${created.map((m) => `${m}.${permissionName.trim()}`).join(", ")}`);
        onSuccess();
      }
    } catch (err: any) {
      setError(err?.apiMessage ?? err?.message ?? "Failed to create permission");
    } finally {
      setSubmitting(false);
    }
  }

  const allSelected = modules.length > 0 && selectedModules.size === modules.length;
  const canSubmit = permissionName.trim() && description.trim() && activeModules.length > 0 && !submitting;

  return (
    <div>
      {success && (
        <StepSuccessBanner
          message={success}
          nextLabel="Proceed to Create Role"
          onNext={onNext}
          onClose={onClose}
        />
      )}
      {error && <ErrorBanner message={error} />}

      {/* Module Selection */}
      <MSection title={`1. Select Modules (${activeModules.length} selected)`}>
        {modulesLoading ? (
          <div className="text-[12px] text-[#667781]">Loading modules...</div>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2.5 text-[12px] cursor-pointer pb-2 border-b border-[#E9EDEF]">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-[#128C7E]" />
              <span className="font-black text-[#128C7E]">Select All</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {modules.map((m) => (
                <label
                  key={m}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-[12px] ${
                    selectedModules.has(m)
                      ? "bg-[#EAF7F3] border border-[#128C7E] text-[#075E54] font-black"
                      : "bg-white border border-[#E9EDEF] hover:bg-[#F8FAFC] text-[#111B21]"
                  }`}
                >
                  <input type="checkbox" checked={selectedModules.has(m)} onChange={() => toggleModule(m)} className="w-4 h-4 accent-[#128C7E]" />
                  {m}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-[#E9EDEF]">
              <span className="text-[11px] text-[#667781] font-black shrink-0">Custom:</span>
              <input
                value={customModule}
                onChange={(e) => setCustomModule(e.target.value)}
                placeholder="Enter a new module name..."
                className={`flex-1 h-8 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] bg-white outline-none focus:border-[#128C7E]`}
              />
            </div>
          </div>
        )}
      </MSection>

      {/* Permission Details */}
      <MSection title="2. Permission Details">
        <div className="flex flex-col gap-3">
          <Field label="Action Name" required>
            <input
              value={permissionName}
              onChange={(e) => setPermissionName(e.target.value)}
              placeholder="e.g. view, manage, create, delete"
              className={INPUT_CLS}
            />
            <div className="text-[10px] text-[#667781] mt-1">
              Will create:{" "}
              {activeModules.length > 0
                ? activeModules.map((m) => `${m}.${permissionName.trim() || "action"}`).join(", ")
                : "Select modules above"}
            </div>
          </Field>
          <Field label="Description" required>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. View billing records and invoices"
              className={INPUT_CLS}
            />
          </Field>
        </div>
      </MSection>

      {/* Submit */}
      <div className="flex justify-end">
        <button onClick={handleSubmit} disabled={!canSubmit} className={BTN_PRIMARY}>
          {submitting ? "Creating..." : "Create Permission"}
        </button>
      </div>
    </div>
  );
}
