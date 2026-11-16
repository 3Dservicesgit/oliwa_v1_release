/**
 * TokenizedCostsCard — Tokenized Alerting Costs (PAYG)
 *
 * Matches MID screenshot:
 *   Subtitle: "Burn drivers: WhatsApp templates, SMS, AI summaries, evidence…"
 *   Stacked bar: WhatsApp 45% (green) | SMS 20% (orange) | AI Summary 25% (teal) | rest
 *   Legend + Top-up Tokens + Bundle Suggest buttons
 *
 * All styles: Tailwind utility classes only.
 */
import React from "react";

export interface CostSegment {
  id:      string;
  label:   string;
  pct:     number;
  color:   string;
  dotCls:  string;
}

interface TokenizedCostsCardProps {
  segments?:        CostSegment[];
  subtitle?:        string;
  onTopup?:         () => void;
  onBundleSuggest?: () => void;
}

const DEFAULT_SEGMENTS: CostSegment[] = [
  { id: "wa",  label: "WhatsApp: 45%",   pct: 45, color: "#25D366", dotCls: "bg-[#25D366]"  },
  { id: "sms", label: "SMS: 20%",        pct: 20, color: "#F97316", dotCls: "bg-[#F97316]"  },
  { id: "ai",  label: "AI Summary: 25%", pct: 25, color: "#34B7F1", dotCls: "bg-[#34B7F1]"  },
  { id: "etc", label: "Other: 10%",      pct: 10, color: "#E9EDEF", dotCls: "bg-[#667781]"  },
];

export function TokenizedCostsCard({
  segments        = DEFAULT_SEGMENTS,
  subtitle        = "Burn drivers: WhatsApp templates, SMS, AI summaries, evidence attachments.",
  onTopup,
  onBundleSuggest,
}: TokenizedCostsCardProps) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#E9EDEF]">
        <div className="font-black text-[13px] text-[#111B21]">Tokenized Alerting Costs (PAYG)</div>
        <div className="text-[11px] text-[#667781] mt-0.5 truncate">{subtitle}</div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {/* Stacked bar */}
        <div className="h-3 rounded-full overflow-hidden flex">
          {segments.map((s) => (
            <div
              key={s.id}
              style={{ width: `${s.pct}%`, background: s.color }}
              className="h-full"
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-1.5">
          {segments.filter(s => s.id !== "etc").map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-[12px] text-[#111B21]">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dotCls}`} />
              {s.label}
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap pt-1">
          <button
            onClick={onTopup}
            className="h-8 px-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[11px] font-extrabold border-none cursor-pointer hover:brightness-105 transition-all whitespace-nowrap"
          >
            Top-up Tokens
          </button>
          <button
            onClick={onBundleSuggest}
            className="h-8 px-4 rounded-full bg-[#34B7F1] text-white text-[11px] font-extrabold border-none cursor-pointer hover:brightness-105 transition-all whitespace-nowrap"
          >
            Bundle Suggest
          </button>
        </div>
      </div>
    </div>
  );
}