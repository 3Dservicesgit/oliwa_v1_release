/**
 * TokenEngineCard — Token Engine (Dual Economy)
 *
 * Displays token engine health:
 *   - Type labels (Type-A / Type-B)
 *   - FIFO queue status
 *   - Safeguard configuration
 *   - Quick mint shortcuts
 *
 * All styles: Tailwind utility classes only.
 */
import React from "react";

interface TokenEngineCardProps {
  priceRulesVersion?: string;
  typeALabel?:        string;
  typeBLabel?:        string;
  fifoStatus?:        string;
  backlogNote?:       string;
  safeguards?:        string;
  mintShortcuts?:     string;
  onMint?:            () => void;
}

export function TokenEngineCard({
  priceRulesVersion = "Price rules v26.0.3",
  typeALabel        = "OLIWA/PIKI/UKO",
  typeBLabel        = "VEBA rental tokens",
  fifoStatus        = "FIFO queues healthy: 99.8% rollover success",
  backlogNote       = "Unbilled usage backlog: 2h — reconcile scheduled 02:00",
  safeguards        = "Safeguards: 80% soft alert enabled (global)",
  mintShortcuts     = "Mint shortcut: +10k / +100k / Custom (HIC)",
  onMint,
}: TokenEngineCardProps) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#E9EDEF] flex items-center justify-between">
        <div>
          <div className="font-black text-[13px] text-[#111B21]">Token Engine (Dual Economy)</div>
          <div className="text-[11px] text-[#667781] mt-0.5">
            Type-A: {typeALabel} &nbsp;•&nbsp; Type-B: {typeBLabel}
          </div>
        </div>
        <span className="text-[11px] text-[#34B7F1] font-extrabold whitespace-nowrap shrink-0 ml-3">
          {priceRulesVersion}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 flex flex-col gap-2">
        {/* Status rows */}
        {[
          { dot: "bg-[#25D366]", text: fifoStatus   },
          { dot: "bg-[#FBBF24]", text: backlogNote  },
          { dot: "bg-[#25D366]", text: safeguards   },
          { dot: "bg-[#667781]", text: mintShortcuts },
        ].map((row, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${row.dot}`} />
            <span className="text-[12px] text-[#111B21] leading-snug">{row.text}</span>
          </div>
        ))}
      </div>

      {/* Quick action */}
      <div className="px-4 pb-3 mt-auto">
        <button
          onClick={onMint}
          className="w-full h-8 rounded-lg border border-[#C2E8E1] bg-[#E9F7F4] text-[12px] font-extrabold text-[var(--brand)] cursor-pointer hover:brightness-95 transition-all"
        >
          Open Token Engine →
        </button>
      </div>
    </div>
  );
}
