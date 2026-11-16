/**
 * TokenBurnChart — Token Burn by Product
 *
 * Renders horizontal bar rows showing token consumption per product/service.
 * Each row: label | animated fill bar | percentage value.
 * Bars colour by tone: good=teal, warn=orange, bad=red.
 *
 * Used in the OPS WAR ROOM mid-scroll grid (bottom-left card).
 */
import React from "react";

export type BurnTone = "good" | "warn" | "bad" | "neutral";

export interface BurnRow {
  label: string;
  value: number;   // 0–100 (percentage of cap)
  tone:  BurnTone;
}

interface TokenBurnChartProps {
  rows:         BurnRow[];
  note?:        string;
  onOpenEngine?: () => void;
  onSetCap?:    () => void;
}

const barFill: Record<BurnTone, string> = {
  good:    "bg-[var(--brand)]",
  warn:    "bg-[#F97316]",
  bad:     "bg-[#EF4444]",
  neutral: "bg-[#667781]",
};

export function TokenBurnChart({ rows, note, onOpenEngine, onSetCap }: TokenBurnChartProps) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#E9EDEF]">
        <span className="font-extrabold text-[13px] text-[#111B21]">Token burn by product</span>
        <div className="flex gap-2">
          <button
            onClick={onOpenEngine}
            className="h-7 px-2.5 rounded-lg border border-[#E9EDEF] bg-white text-[11px] text-[#667781] cursor-pointer hover:bg-[#F8F9FA] transition-colors"
          >
            Open Token Engine
          </button>
          <button
            onClick={onSetCap}
            className="h-7 px-2.5 rounded-lg border border-[#E9EDEF] bg-white text-[11px] text-[#667781] cursor-pointer hover:bg-[#F8F9FA] transition-colors"
          >
            Set cap (HIC)
          </button>
        </div>
      </div>

      {/* Bar rows */}
      <div className="px-4 py-3 flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            {/* Label */}
            <div className="w-[80px] text-[12px] text-[#667781] shrink-0 font-medium">
              {row.label}
            </div>

            {/* Bar track */}
            <div className="flex-1 h-[8px] bg-[#EEF2F6] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${barFill[row.tone]}`}
                style={{ width: `${Math.min(100, Math.max(4, row.value))}%` }}
              />
            </div>

            {/* Value */}
            <div className="w-[36px] text-right text-[12px] text-[#667781] font-extrabold shrink-0">
              {row.value}%
            </div>
          </div>
        ))}

        {note && (
          <p className="text-[11px] text-[#667781] mt-1 leading-snug border-t border-dashed border-[#E9EDEF] pt-2 m-0">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
