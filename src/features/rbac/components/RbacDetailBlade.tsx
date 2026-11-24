import React, { useEffect, useState } from "react";
import { getRoleByUid, deleteRole, getAuditEvents } from "../../../api";
import type { RbacPermission, AuditEvent } from "../../../api";
import { useAuth } from "../../../auth/AuthContext";
import type { Role } from "./RolesTable";

const TABS = ["Overview", "Permissions", "Audit"];

interface Props {
  role: Role;
  onClose: () => void;
  onEdit: (role: Role) => void;
  onDisabled?: () => void;
}

export function RbacDetailBlade({ role, onClose, onEdit, onDisabled }: Props) {
  const { state: { accountUid } } = useAuth();
  const [tab, setTab] = useState("Overview");
  const [permissions, setPermissions] = useState<RbacPermission[]>([]);
  const [permsLoading, setPermsLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Fetch role detail (with permissions) when role changes
  useEffect(() => {
    setPermsLoading(true);
    getRoleByUid(role.id)
      .then(res => setPermissions(res.data.permissions ?? []))
      .catch(() => setPermissions([]))
      .finally(() => setPermsLoading(false));
  }, [role.id]);

  // Fetch audit events when Audit tab is selected
  useEffect(() => {
    if (tab !== "Audit") return;
    setAuditLoading(true);
    getAuditEvents({ domain: "RBAC", search: role.id })
      .then(res => setAuditEvents(res.data ?? []))
      .catch(() => setAuditEvents([]))
      .finally(() => setAuditLoading(false));
  }, [tab, role.id]);

  async function handleDelete() {
    if (!confirm(`Delete role "${role.name}"? This action cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteRole(role.id, { deleted_by: accountUid ?? "system" });
      onDisabled?.();
      onClose();
    } catch {
      alert("Failed to delete role.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="w-[420px] h-full shrink-0 bg-white border-l border-[#E9EDEF] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#E9EDEF] shrink-0">
        <div>
          <div className="font-black text-[14px] text-[#111B21]">{role.name}</div>
          <div className="text-[11px] text-[#667781]">{role.id}</div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[#667781] font-black text-[13px] cursor-pointer grid place-items-center hover:bg-[#E9EDEF]">X</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 px-5 py-2.5 border-b border-[#E9EDEF] shrink-0">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`h-8 px-3 rounded-full text-[11px] font-black border-none cursor-pointer transition-all ${tab === t ? "bg-[var(--brand)] text-white" : "bg-[#F0F2F5] text-[#667781] hover:bg-[#E9EDEF]"}`}>{t}</button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-5 py-4">

        {tab === "Overview" && (<>
          <BSection title="Role Details">
            <div className="p-4">
              <KV rows={[
                { k: "Name:", v: role.name },
                { k: "ID:", v: role.id },
                { k: "Owner:", v: role.owner },
                { k: "Tenant:", v: role.tenant },
                { k: "Modified:", v: role.lastModified },
              ]} />
            </div>
          </BSection>
          <BSection title="Usage Summary">
            <div className="p-4">
              <KV rows={[
                { k: "Users:", v: role.users < 0 ? "--" : String(role.users) },
                { k: "Perms:", v: permsLoading ? "..." : String(permissions.length) },
              ]} />
            </div>
          </BSection>
        </>)}

        {tab === "Permissions" && (
          <BSection title="Bound Permission Sets">
            <div className="p-4">
              {permsLoading ? (
                <div className="text-[12px] text-[#667781]">Loading permissions...</div>
              ) : permissions.length === 0 ? (
                <div className="text-[12px] text-[#667781]">No permissions assigned to this role.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {permissions.map(p => (
                    <div key={p.permission_uid} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[var(--brand)]" />
                      <div className="flex flex-col">
                        <span className="font-black text-[12px] text-[#111B21]">{p.permission_name}</span>
                        <span className="text-[10px] text-[#667781]">{p.permission_module} &mdash; {p.permission_description || "No description"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </BSection>
        )}

        {tab === "Audit" && (
          <BSection title="Audit Trail">
            <div className="p-4">
              {auditLoading ? (
                <div className="text-[12px] text-[#667781]">Loading audit events...</div>
              ) : auditEvents.length === 0 ? (
                <div className="text-[12px] text-[#667781]">No audit events found for this role.</div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {auditEvents.map(evt => (
                    <div key={evt.id} className="flex gap-3 text-[12px]">
                      <div className="flex flex-col items-center shrink-0">
                        <span className={`w-2 h-2 rounded-full mt-1.5 ${evt.severity === "Crit" ? "bg-[#EF4444]" : evt.severity === "Alarm" ? "bg-[#F97316]" : evt.severity === "Warn" ? "bg-[#EAB308]" : "bg-[var(--brand)]"}`} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-[#111B21]">{evt.action}</span>
                          <span className="text-[10px] text-[#667781]">{evt.timestamp?.replace("T", " ").slice(0, 19)}</span>
                        </div>
                        <div className="text-[11px] text-[#667781] truncate">{evt.object}</div>
                        <div className="text-[10px] text-[#667781]">by {evt.actor}{evt.ip_address ? ` from ${evt.ip_address}` : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </BSection>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-5 py-3 border-t border-[#E9EDEF] shrink-0">
        <button onClick={() => onEdit(role)} className="h-8 px-4 rounded-lg bg-[var(--brand)] text-white text-[11px] font-black border-none cursor-pointer hover:brightness-105">Edit Role</button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="h-8 px-4 rounded-lg bg-white border border-[#EF4444] text-[#EF4444] text-[11px] font-black cursor-pointer hover:bg-[#FEF2F2] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}

// ── Local helpers ────────────────────────────────────────────────────────────
function BSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 border border-[#E9EDEF] rounded-xl overflow-hidden bg-white">
      <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E9EDEF]"><div className="font-black text-[12px] text-[#111B21]">{title}</div></div>
      {children}
    </div>
  );
}

function KV({ rows }: { rows: { k: string; v: string }[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map(r => (
        <div key={r.k} className="flex gap-3 text-[12px]">
          <span className="text-[#667781] w-[80px] shrink-0">{r.k}</span>
          <span className="font-black text-[#111B21]">{r.v}</span>
        </div>
      ))}
    </div>
  );
}
