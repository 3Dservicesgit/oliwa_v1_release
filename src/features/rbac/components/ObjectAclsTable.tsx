
export interface ObjectAcl {
  id: string;
  name: string;
  objectType: "Unit" | "Driver" | "Resource" | "Tenant" | "Device";
  objectRef: string;
  owner: string;
  tenant: string;
  grantee: string;
  access: "Read" | "Write" | "Admin" | "None";
  status: "Active" | "Disabled";
  lastModified: string;
}

const stDot: Record<string, string> = { Active: "bg-[#25D366]", Disabled: "bg-[#EF4444]" };
const stText: Record<string, string> = { Active: "text-[#1A7A3A]", Disabled: "text-[#EF4444]" };

const accessBg: Record<string, string> = {
  Read:  "bg-[#EAF7F3] text-[var(--brand)]",
  Write: "bg-[#FFF7ED] text-[#F97316]",
  Admin: "bg-[#FEF2F2] text-[#EF4444]",
  None:  "bg-[#F0F2F5] text-[#667781]",
};

interface Props {
  acls: ObjectAcl[];
  onSelect: (acl: ObjectAcl) => void;
  selectedId?: string;
}

export function ObjectAclsTable({ acls, onSelect, selectedId }: Props) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E9EDEF]">
        <div>
          <div className="font-black text-[13px] text-[#111B21]">Object ACLs</div>
          <div className="text-[11px] text-[#667781] mt-0.5">Object-level access control for units, drivers, and resources</div>
        </div>
        <div className="text-[11px] text-[#667781]">{acls.length} ACLs</div>
      </div>
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full text-[12px] min-w-[900px]">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E9EDEF]">
              {["ID", "Name", "Object Type", "Object Ref", "Grantee", "Access", "Owner", "Tenant", "Status", "Modified"].map(h => (
                <th key={h} className="text-left px-3 py-2 font-black text-[#667781]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {acls.map(a => (
              <tr
                key={a.id}
                onClick={() => onSelect(a)}
                className={`border-b border-[#E9EDEF] last:border-0 cursor-pointer transition-colors ${selectedId === a.id ? "bg-[#EAF7F3]" : "hover:bg-[#F8FAFC]"}`}
              >
                <td className="px-3 py-2.5 font-mono text-[#667781]">{a.id}</td>
                <td className="px-3 py-2.5 font-black text-[#111B21]">{a.name}</td>
                <td className="px-3 py-2.5 text-[#111B21]">{a.objectType}</td>
                <td className="px-3 py-2.5 font-mono text-[#667781]">{a.objectRef}</td>
                <td className="px-3 py-2.5 text-[#111B21]">{a.grantee}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${accessBg[a.access]}`}>{a.access}</span>
                </td>
                <td className="px-3 py-2.5 text-[#667781]">{a.owner}</td>
                <td className="px-3 py-2.5 text-[#667781]">{a.tenant}</td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${stDot[a.status]}`} />
                    <span className={`font-black ${stText[a.status]}`}>{a.status}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[#667781]">{a.lastModified}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
