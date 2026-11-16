
export interface Policy {
  id: string;
  name: string;
  owner: string;
  tenant: string;
  type: "MakerChecker" | "SoD" | "TimeBound" | "GeoFence" | "Custom";
  enforcedOn: string[];
  status: "Active" | "Disabled" | "Draft";
  lastModified: string;
}

const stDot: Record<string, string> = {
  Active: "bg-[#25D366]", Disabled: "bg-[#EF4444]", Draft: "bg-[#FBBF24]",
};
const stText: Record<string, string> = {
  Active: "text-[#1A7A3A]", Disabled: "text-[#EF4444]", Draft: "text-[#F97316]",
};
const typeBg: Record<string, string> = {
  MakerChecker: "bg-[#FEF2F2] text-[#EF4444]",
  SoD:          "bg-[#FFF7ED] text-[#F97316]",
  TimeBound:    "bg-[#EAF7F3] text-[var(--brand)]",
  GeoFence:     "bg-[#EFF6FF] text-[#3B82F6]",
  Custom:       "bg-[#F0F2F5] text-[#667781]",
};

interface Props {
  policies: Policy[];
  onSelect: (p: Policy) => void;
  selectedId?: string;
}

export function PoliciesTable({ policies, onSelect, selectedId }: Props) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E9EDEF]">
        <div>
          <div className="font-black text-[13px] text-[#111B21]">Policies</div>
          <div className="text-[11px] text-[#667781] mt-0.5">Governance rules: maker-checker, separation of duties, time-bound access</div>
        </div>
        <div className="text-[11px] text-[#667781]">{policies.length} policies</div>
      </div>
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full text-[12px] min-w-[800px]">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E9EDEF]">
              {["ID", "Name", "Owner", "Tenant", "Type", "Enforced On", "Status", "Modified"].map(h => (
                <th key={h} className="text-left px-3 py-2 font-black text-[#667781]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {policies.map(p => (
              <tr
                key={p.id}
                onClick={() => onSelect(p)}
                className={`border-b border-[#E9EDEF] last:border-0 cursor-pointer transition-colors ${selectedId === p.id ? "bg-[#EAF7F3]" : "hover:bg-[#F8FAFC]"}`}
              >
                <td className="px-3 py-2.5 font-mono text-[#667781]">{p.id}</td>
                <td className="px-3 py-2.5 font-black text-[#111B21]">{p.name}</td>
                <td className="px-3 py-2.5 text-[#667781]">{p.owner}</td>
                <td className="px-3 py-2.5 text-[#667781]">{p.tenant}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${typeBg[p.type]}`}>{p.type}</span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1 flex-wrap">
                    {p.enforcedOn.map(e => (
                      <span key={e} className="text-[10px] bg-[#F0F2F5] text-[#667781] px-1.5 py-0.5 rounded-full">{e}</span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${stDot[p.status]}`} />
                    <span className={`font-black ${stText[p.status]}`}>{p.status}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[#667781]">{p.lastModified}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
