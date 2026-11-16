
export interface PermissionSet {
  id: string;
  name: string;
  owner: string;
  module: string;
  actions: string[];
  rolesUsing: number;
  description: string;
}

interface Props {
  sets: PermissionSet[];
  onSelect: (set: PermissionSet) => void;
  onEdit: (set: PermissionSet) => void;
  onDelete: (set: PermissionSet) => void;
  onCreate: () => void;
  selectedId?: string;
}

export function PermissionSetsTable({ sets, onSelect, onEdit, onDelete, onCreate, selectedId }: Props) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E9EDEF]">
        <div>
          <div className="font-black text-[13px] text-[#111B21]">Permission Sets</div>
          <div className="text-[11px] text-[#667781] mt-0.5">Grouped permissions bound to modules and blades</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCreate}
            className="h-8 px-3 rounded-full text-[11px] font-black bg-[var(--accent)] text-[var(--on-accent)] border-none cursor-pointer hover:brightness-105 transition-all whitespace-nowrap"
          >
            + Create Permission
          </button>
          <div className="text-[11px] text-[#667781] whitespace-nowrap">{sets.length} sets</div>
        </div>
      </div>
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full text-[12px] min-w-[800px]">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E9EDEF]">
              {["ID", "Name", "Owner", "Module", "Actions", "Roles Using", "Description", ""].map(h => (
                <th key={h || "actions"} className="text-left px-3 py-2 font-black text-[#667781]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sets.map(s => (
              <tr
                key={s.id}
                onClick={() => onSelect(s)}
                className={`border-b border-[#E9EDEF] last:border-0 cursor-pointer transition-colors ${selectedId === s.id ? "bg-[#EAF7F3]" : "hover:bg-[#F8FAFC]"}`}
              >
                <td className="px-3 py-2.5 font-mono text-[#667781]">{s.id}</td>
                <td className="px-3 py-2.5 font-black text-[#111B21]">{s.name}</td>
                <td className="px-3 py-2.5 text-[#667781]">{s.owner}</td>
                <td className="px-3 py-2.5 text-[#111B21]">{s.module}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1 flex-wrap">
                    {s.actions.map(a => (
                      <span key={a} className="text-[10px] bg-[#EAF7F3] text-[var(--brand)] px-1.5 py-0.5 rounded-full font-black">{a}</span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-[#111B21]">{s.rolesUsing < 0 ? "--" : s.rolesUsing}</td>
                <td className="px-3 py-2.5 text-[#667781] max-w-[200px] truncate">{s.description}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1.5">
                    <button
                      onClick={e => { e.stopPropagation(); onEdit(s); }}
                      className="h-6 px-2 rounded text-[10px] font-black bg-[#F0F2F5] text-[#667781] hover:bg-[#E9EDEF] border-none cursor-pointer transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); onDelete(s); }}
                      className="h-6 px-2 rounded text-[10px] font-black bg-[#FEF2F2] text-[#EF4444] hover:bg-[#FEE2E2] border-none cursor-pointer transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
