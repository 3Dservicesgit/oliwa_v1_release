import React, { useEffect, useState } from "react";
import { updatePermission, getAllPermissions } from "../../../api";
import type { RbacPermission } from "../../../api";
import type { PermissionSet } from "./PermissionSetsTable";
import { useAuth } from "../../../auth/AuthContext";

interface Props {
  open: boolean;
  permission: PermissionSet | null;
  onClose: () => void;
  onUpdated?: () => void;
}

const DEFAULT_MODULES = ["billing", "gps", "alerts", "tokens", "rbac", "tenants", "devices", "veba", "noc", "reports"];

export function EditPermissionModal({ open, permission, onClose, onUpdated }: Props) {
  const { state: { accountRoot } } = useAuth();
  const [permissionName, setPermissionName] = useState("");
  const [description, setDescription] = useState("");
  const [module, setModule] = useState<string>("");
  const [modules, setModules] = useState<string[]>(DEFAULT_MODULES);
  const [modulesLoading, setModulesLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form and fetch dynamic module list when permission changes
  useEffect(() => {
    if (open && permission) {
      setPermissionName(permission.name);
      setDescription(permission.description);
      setModule(permission.module);
      setError(null);

      // Fetch all permissions to build dynamic module list
      setModulesLoading(true);
      getAllPermissions(accountRoot || "engine")
        .then((res) => {
          const existing = new Set<string>();
          (res.data as RbacPermission[]).forEach((p) => {
            if (p.permission_module) existing.add(p.permission_module.toLowerCase());
          });
          DEFAULT_MODULES.forEach((m) => existing.add(m));
          // Ensure current permission's module is always included
          if (permission.module) existing.add(permission.module.toLowerCase());
          setModules([...existing].sort());
        })
        .catch(() => {
          // Fallback: use defaults + current module
          const fallback = new Set(DEFAULT_MODULES);
          if (permission.module) fallback.add(permission.module.toLowerCase());
          setModules([...fallback].sort());
        })
        .finally(() => setModulesLoading(false));
    }
  }, [open, permission]);

  async function handleSubmit() {
    if (!permission || !permissionName.trim() || !description.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await updatePermission(permission.id, {
        permission_name: permissionName.trim(),
        permission_description: description.trim(),
        permission_module: module,
      });
      onUpdated?.();
      onClose();
    } catch (err: any) {
      setError(err?.apiMessage ?? err?.message ?? "Failed to update permission");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !permission) return null;

  const canSubmit = permissionName.trim() && description.trim() && !submitting;

  return (
    <div className="fixed inset-0 bg-black/35 z-50 grid place-items-center" onClick={onClose}>
      <div className="w-[min(520px,calc(100vw-24px))] max-h-[calc(100vh-24px)] bg-white rounded-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-[#075E54] text-white px-5 py-3 flex items-center justify-between shrink-0">
          <div>
            <div className="font-black text-[15px]">Edit Permission</div>
            <div className="text-[11px] opacity-70">Update permission details</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/15 text-white font-black text-[14px] border-none cursor-pointer grid place-items-center hover:bg-white/25">X</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-5 bg-[#FBFBFB]">
          {error && (
            <div className="mb-4 px-4 py-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[12px] text-[#EF4444] font-black">{error}</div>
          )}

          <MSection title="Permission Details">
            <div className="flex flex-col gap-3">
              <Field label="Permission UID">
                <div className="h-9 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#667781] bg-[#F8FAFC] flex items-center font-mono">{permission.id}</div>
              </Field>
              <Field label="Permission Name" required>
                <input
                  value={permissionName}
                  onChange={e => setPermissionName(e.target.value)}
                  placeholder="e.g. billing.view"
                  className="w-full h-9 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] bg-white outline-none focus:border-[#128C7E]"
                />
                <div className="text-[10px] text-[#667781] mt-1">Use dot notation: module.action (e.g. billing.view, gps.manage)</div>
              </Field>
              <Field label="Description" required>
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. View billing records and invoices"
                  className="w-full h-9 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] bg-white outline-none focus:border-[#128C7E]"
                />
              </Field>
              <Field label="Module" required>
                {modulesLoading ? (
                  <div className="h-9 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#667781] bg-[#F8FAFC] flex items-center">Loading modules...</div>
                ) : (
                  <select value={module} onChange={e => setModule(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] bg-white outline-none focus:border-[#128C7E]">
                    {modules.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          </MSection>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#E9EDEF] bg-white shrink-0">
          <button onClick={onClose} className="h-10 px-5 rounded-lg bg-white border border-[#E9EDEF] text-[13px] font-black text-[#111B21] cursor-pointer">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-10 px-6 rounded-lg bg-[#128C7E] text-white text-[13px] font-black border-none cursor-pointer hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Local helpers ────────────────────────────────────────────────────────────
function MSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 border border-[#E9EDEF] rounded-xl overflow-hidden bg-white">
      <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E9EDEF]"><div className="font-black text-[13px] text-[#111B21]">{title}</div></div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-black text-[#111B21] mb-1">{label}{required && <span className="text-[#EF4444] ml-0.5">*</span>}</div>
      {children}
    </div>
  );
}
