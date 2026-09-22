/**
 * StatusStrip — Secondary Navigation / Context Bar
 *
 * Chips are always visible and horizontally scrollable on all screen sizes.
 * Each chip accepts an optional `variant` for coloured backgrounds.
 * Scrollbar hidden cross-browser (no plugin required).
 */
import React from "react";
import { WaswaStatusPill } from "../waswa/WaswaWidgets";

// ── Chip colour variants — matches original CSS .chip.ok/success/warn/info ──
const chipVariant: Record<string, string> = {
  default: "bg-[#F8F9FA] border-[#E9EDEF] text-[#667781]",
  ok:      "bg-[#E8F5F2] border-[#BFE7E0] text-[#128C7E]",
  success: "bg-[#EAFBEF] border-[#C7F2D4] text-[#1A7A3A]",
  warn:    "bg-[#FFF8E1] border-[#FFE08A] text-[#7A5E00]",
  info:    "bg-[#E3F2FD] border-[#BBDEFB] text-[#1565C0]",
};

const btnVariant: Record<string, string> = {
  green: "bg-[#25D366] text-white",
  azure: "bg-[#34B7F1] text-white",
  teal:  "bg-[#128C7E] text-white",
  red:   "bg-[#D93025] text-white",
  ghost: "bg-[#F8F9FA] border border-[#E9EDEF] text-[#667781]",
};

export interface StatusChip {
  id:       string;
  label:    string;
  /** Optional colour variant. Defaults to plain grey. */
  variant?: "default" | "ok" | "success" | "warn" | "info";
}

interface StripAction {
  id:       string;
  label:    string;
  variant:  "green" | "azure" | "teal" | "ghost" | "red";
  onClick?: () => void;
}

interface StatusStripProps {
  chips?:   StatusChip[];
  actions?: StripAction[];
}

const DEFAULT_CHIPS: StatusChip[] = [
  { id: "scope",  label: "Scope: Client→Org"       },
  { id: "rbac",   label: "RBAC: SYSADMIN / Admin",  variant: "ok"      },
  { id: "wallet", label: "Wallet: UGX 8.6M • 1.24M Tok", variant: "success" },
  { id: "burn",   label: "Used: 1.7 Tok/s"                },
  { id: "runout", label: "Running: ≈ 8 Tok/s"            },
  { id: "status", label: "Status: 🟢 Green • 99.82%"      },
  { id: "fresh",  label: "Expired: 5 Tok/s"   },
  { id: "alerts", label: "Payment-Processor-APIs : Stable(OK)",    variant: "info"    },
  { id: "pay",    label: "Pay: M-Pesa OK • MTN OK", variant: "info"    },
  { id: "waswa",  label: "Waswa Co-Pilot: ON",      variant: "ok"      }
];

const DEFAULT_ACTIONS: StripAction[] = [
  // { id: "new",    label: "+ New",  variant: "green" },
  // { id: "export", label: "Export", variant: "azure" },
];

const hideScrollbar: React.CSSProperties = {
  overflowX:       "auto",
  scrollbarWidth:  "none",
  msOverflowStyle: "none",
};

export function StatusStrip({ chips = DEFAULT_CHIPS, actions = DEFAULT_ACTIONS }: StatusStripProps) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 bg-white border-b border-[#E9EDEF] sticky top-12 z-[90] shrink-0 overflow-hidden">

      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex gap-1.5" style={hideScrollbar}>
          {chips.map((c) => c.id === "waswa" ? (
            <WaswaStatusPill key={c.id} />
          ) : (
            <span
              key={c.id}
              className={`shrink-0 whitespace-nowrap border rounded-full px-2.5 py-1 text-[11px] font-medium ${chipVariant[c.variant ?? "default"]}`}
            >
              {c.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2 shrink-0 pl-1">
        {actions.map((a) => (
          <button
            key={a.id}
            onClick={a.onClick}
            className={`h-[28px] rounded-full px-3 text-[12px] font-bold cursor-pointer transition-all hover:brightness-105 active:opacity-85 ${btnVariant[a.variant]}`}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}