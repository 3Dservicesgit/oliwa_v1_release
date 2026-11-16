
export interface RoleTemplate {
  id: string;
  name: string;
  owner: string;
  tenant: string;
  description: string;
  permissionSets: string[];
  timesUsed: number;
  status: "Active" | "Disabled" | "Draft";
  lastModified: string;
}

const stDot: Record<string, string> = {
  Active: "bg-[#25D366]", Disabled: "bg-[#EF4444]", Draft: "bg-[#FBBF24]",
};
const stText: Record<string, string> = {
  Active: "text-[#1A7A3A]", Disabled: "text-[#EF4444]", Draft: "text-[#F97316]",
};

interface Props {
  templates: RoleTemplate[];
  onSelect: (t: RoleTemplate) => void;
  selectedId?: string;
}

export function RoleTemplatesTable({ templates, onSelect, selectedId }: Props) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E9EDEF]">
        <div>
          <div className="font-black text-[13px] text-[#111B21]">Role Templates</div>
          <div className="text-[11px] text-[#667781] mt-0.5">Predefined role blueprints for rapid provisioning</div>
        </div>
        <div className="text-[11px] text-[#667781]">{templates.length} templates</div>
      </div>
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full text-[12px] min-w-[800px]">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E9EDEF]">
              {["ID", "Name", "Description", "Owner", "Tenant", "Permission Sets", "Used", "Status", "Modified"].map(h => (
                <th key={h} className="text-left px-3 py-2 font-black text-[#667781]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {templates.map(t => (
              <tr
                key={t.id}
                onClick={() => onSelect(t)}
                className={`border-b border-[#E9EDEF] last:border-0 cursor-pointer transition-colors ${selectedId === t.id ? "bg-[#EAF7F3]" : "hover:bg-[#F8FAFC]"}`}
              >
                <td className="px-3 py-2.5 font-mono text-[#667781]">{t.id}</td>
                <td className="px-3 py-2.5 font-black text-[#111B21]">{t.name}</td>
                <td className="px-3 py-2.5 text-[#667781] max-w-[200px] truncate">{t.description}</td>
                <td className="px-3 py-2.5 text-[#667781]">{t.owner}</td>
                <td className="px-3 py-2.5 text-[#667781]">{t.tenant}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1 flex-wrap">
                    {t.permissionSets.map(ps => (
                      <span key={ps} className="text-[10px] bg-[#EAF7F3] text-[var(--brand)] px-1.5 py-0.5 rounded-full font-black">{ps}</span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-[#111B21]">{t.timesUsed}</td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${stDot[t.status]}`} />
                    <span className={`font-black ${stText[t.status]}`}>{t.status}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[#667781]">{t.lastModified}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
