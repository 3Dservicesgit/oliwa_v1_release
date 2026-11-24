/**
 * StatCard — Summary KPI card with a coloured status badge.
 *
 * Used in the 4-column overview grid on the Gatehouse Alpha dashboard.
 * Reuses the same colour tokens as the rest of the CMS.
 */
import React from "react";

export type StatBadge = "ok" | "success" | "warn" | "info" | "critical";

const badgeStyles: Record<StatBadge, string> = {
  ok:       "bg-[#E8F5F2] border-[#BFE7E0] text-[var(--brand)]",
  success:  "bg-[#EAFBEF] border-[#C7F2D4] text-[#1A7A3A]",
  warn:     "bg-[#FFF8E1] border-[#FFE08A] text-[#7A5E00]",
  info:     "bg-[#E3F2FD] border-[#BBDEFB] text-[#1565C0]",
  critical: "bg-[#FFEBEE] border-[#FFCDD2] text-[#C62828]",
};

interface StatCardProps {
  title:       string;
  badge:       StatBadge;
  badgeLabel:  string;
  meta:        string;
  /** Optional call-to-action button */
  cta?:        { label: string; variant?: "green" | "teal" | "azure" | "dark"; onClick?: () => void };
  children?:   React.ReactNode;
}

const ctaStyles: Record<string, string> = {
  green: "bg-[#25D366] text-[#075E54] hover:brightness-105",
  teal:  "bg-[var(--brand)] text-white hover:brightness-105",
  azure: "bg-[#34B7F1] text-white hover:brightness-105",
  dark:  "bg-[#111B21] text-white hover:brightness-105",
};

export function StatCard({ title, badge, badgeLabel, meta, cta, children }: StatCardProps) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col gap-2">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-extrabold text-[13px] text-[#111B21] leading-tight">{title}</span>
        <span className={`shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-full border whitespace-nowrap ${badgeStyles[badge]}`}>
          {badgeLabel}
        </span>
      </div>

      {/* Meta line */}
      <p className="text-[12px] text-[#667781] leading-snug m-0">{meta}</p>

      {/* Optional extra content */}
      {children}

      {/* CTA button */}
      {cta && (
        <button
          onClick={cta.onClick}
          className={`
            mt-1 w-full rounded-lg px-3 py-2 text-[12px] font-extrabold
            cursor-pointer border-none transition-all active:opacity-85
            ${ctaStyles[cta.variant ?? "green"]}
          `}
        >
          {cta.label}
        </button>
      )}
    </div>
  );
}
