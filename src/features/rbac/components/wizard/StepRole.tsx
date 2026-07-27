import React, { useEffect, useState } from "react";
import { getAllPermissions, createRole } from "../../../../api";
import type { RbacPermission } from "../../../../api";
import { useAuth } from "../../../../auth/AuthContext";
import { MSection, Field, StepSuccessBanner, ErrorBanner, INPUT_CLS, SELECT_CLS, BTN_PRIMARY } from "./WizardShared";

interface Props {
  preSelectedPermissionUids?: string[];
  onSuccess: (roleName?: string) => void;
  onClose: () => void;
  onNext: () => void;
}

export function StepRole({ preSelectedPermissionUids, onSuccess, onClose, onNext }: Props) {
  const { state: { accountUid, accountRoot } } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState("Tenant");
  const tenant = accountRoot || accountUid || "";

  const [permissions, setPermissions] = useState<RbacPermission[]>([]);
  const [permsLoading, setPermsLoading] = useState(false);
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch permissions
  useEffect(() => {
    setPermsLoading(true);
    getAllPermissions(accountRoot || "engine")
      .then((res) => {
        setPermissions(res.data);
        // Pre-select permissions from previous step if available
        if (preSelectedPermissionUids && preSelectedPermissionUids.length > 0) {
          setSelectedPerms(new Set(preSelectedPermissionUids));
        }
      })
      .catch(() => setError("Failed to load permissions"))
      .finally(() => setPermsLoading(false));
  }, []);

  function togglePerm(uid: string) {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function toggleAll() {
    if (selectedPerms.size === permissions.length) {
      setSelectedPerms(new Set());
    } else {
      setSelectedPerms(new Set(permissions.map((p) => p.permission_uid)));
    }
  }

  async function handleCreate() {
    if (!name.trim() || selectedPerms.size === 0) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await createRole({
        role_name: name.trim(),
        role_description: description.trim(),
        account_root: tenant,
        created_by: accountUid ?? "system",
        permissions: Array.from(selectedPerms),
      });
      setSuccess(`Role "${name.trim()}" created successfully with ${selectedPerms.size} permission(s).`);
      onSuccess(name.trim());
    } catch (err: any) {
      setError(err?.apiMessage ?? err?.message ?? "Failed to create role");
    } finally {
      setSubmitting(false);
    }
  }

  // Group permissions by module
  const byModule = permissions.reduce<Record<string, RbacPermission[]>>((acc, p) => {
    const mod = p.permission_module;
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(p);
    return acc;
  }, {});

  const allSelected = permissions.length > 0 && selectedPerms.size === permissions.length;

  return (
    <div>
      {success && (
        <StepSuccessBanner
          message={success}
          nextLabel="Proceed to Create User"
          onNext={onNext}
          onClose={onClose}
        />
      )}
      {error && <ErrorBanner message={error} />}

      <MSection title="Role Details">
        <div className="flex flex-col gap-3">
          <Field label="Role Name" required>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. fleet_manager" className={INPUT_CLS} />
          </Field>
          <Field label="Role Description">
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this role's purpose" className={INPUT_CLS} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Scope" required>
              <select value={scope} onChange={(e) => setScope(e.target.value)} className={SELECT_CLS}>
                <option>Platform</option>
                <option>Tenant</option>
                <option>Customer</option>
                <option>Dealer</option>
              </select>
            </Field>
            <Field label="Account Root" required>
              <input value={tenant} readOnly className={`${SELECT_CLS} bg-[#F0F2F5] cursor-default`} />
            </Field>
          </div>
        </div>
      </MSection>

      <MSection title={`Permissions (${selectedPerms.size} of ${permissions.length} selected)`}>
        {permsLoading ? (
          <div className="text-[12px] text-[#667781] text-center py-4">Loading permissions...</div>
        ) : permissions.length === 0 ? (
          <div className="text-[12px] text-[#667781] text-center py-4">No permissions found</div>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2.5 text-[12px] cursor-pointer pb-2 border-b border-[#E9EDEF]">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-[#128C7E]" />
              <span className="font-black text-[#128C7E]">Select All</span>
            </label>
            {Object.entries(byModule).map(([mod, perms]) => (
              <div key={mod}>
                <div className="text-[11px] font-black text-[#667781] uppercase mb-1.5">{mod}</div>
                <div className="flex flex-col gap-1.5 pl-1">
                  {perms.map((p) => (
                    <label key={p.permission_uid} className="flex items-center gap-2.5 text-[12px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPerms.has(p.permission_uid)}
                        onChange={() => togglePerm(p.permission_uid)}
                        className="w-4 h-4 accent-[#128C7E]"
                      />
                      <span className="font-black text-[#111B21]">{p.permission_name}</span>
                      <span className="text-[#667781] text-[11px]">{p.permission_description}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </MSection>

      <div className="flex justify-end">
        <button onClick={handleCreate} disabled={!name.trim() || selectedPerms.size === 0 || submitting} className={BTN_PRIMARY}>
          {submitting ? "Creating..." : "Create Role"}
        </button>
      </div>
    </div>
  );
}
