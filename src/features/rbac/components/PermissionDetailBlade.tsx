import React from "react";
import type { PermissionSet } from "./PermissionSetsTable";

interface Props {
  permission: PermissionSet;
  onClose: () => void;
  onEdit: (perm: PermissionSet) => void;
  onDelete: (perm: PermissionSet) => void;
}

export function PermissionDetailBlade({ permission, onClose, onEdit, onDelete }: Props) {
  return (
    <div className="w-[420px] shrink-0 bg-white border-l border-[#E9EDEF] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#E9EDEF] shrink-0">
        <div>
          <div className="font-black text-[14px] text-[#111B21]">{permission.name}</div>
          <div className="text-[11px] text-[#667781] font-mono">{permission.id}</div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[#667781] font-black text-[13px] cursor-pointer grid place-items-center hover:bg-[#E9EDEF]">X</button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-5 py-4">

        <BSection title="Permission Details">
          <div className="p-4">
            <KV rows={[
              { k: "Name:", v: permission.name },
              { k: "UID:", v: permission.id },
              { k: "Module:", v: permission.module },
              { k: "Owner:", v: permission.owner },
            ]} />
          </div>
        </BSection>

        <BSection title="Description">
          <div className="p-4 text-[12px] text-[#111B21] leading-relaxed">
            {permission.description || "No description provided."}
          </div>
        </BSection>

        <BSection title="Actions">
          <div className="p-4 flex flex-col gap-2">
            {permission.actions.map(a => (
              <div key={a} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--brand)]" />
                <span className="text-[12px] font-black text-[#111B21]">{a}</span>
              </div>
            ))}
          </div>
        </BSection>

        <BSection title="Usage">
          <div className="p-4">
            <KV rows={[
              { k: "Roles Using:", v: permission.rolesUsing < 0 ? "--" : String(permission.rolesUsing) },
            ]} />
          </div>
        </BSection>

        <BSection title="Module Info">
          <div className="p-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black bg-[#EAF7F3] text-[var(--brand)] px-2 py-1 rounded-full">{permission.module}</span>
              <span className="text-[11px] text-[#667781]">Bound to the {permission.module} module</span>
            </div>
          </div>
        </BSection>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-5 py-3 border-t border-[#E9EDEF] shrink-0">
        <button onClick={() => onEdit(permission)} className="h-8 px-4 rounded-lg bg-[var(--brand)] text-white text-[11px] font-black border-none cursor-pointer hover:brightness-105">Edit Permission</button>
        <button onClick={() => onDelete(permission)} className="h-8 px-4 rounded-lg bg-white border border-[#EF4444] text-[#EF4444] text-[11px] font-black cursor-pointer hover:bg-[#FEF2F2]">Delete</button>
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
