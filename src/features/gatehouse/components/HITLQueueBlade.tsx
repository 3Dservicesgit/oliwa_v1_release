/**
 * HITLQueueBlade — Context Blade: HITL Pending Action Queue
 *
 * Displays a list of high-risk actions awaiting human approval.
 * Each item has a severity dot, title, reason, and a review CTA.
 *
 * Reuses the shared Severity type and colour tokens.
 */
import React from "react";
export type Severity =
  | "success"
  | "warn"
  | "critical"
  | "info";
import { Card } from "../../../components/ui";

export interface HITLQueueItem {
  id:      string;
  sev:     Severity;
  title:   string;
  meta:    string;
  onReview?: () => void;
}

interface HITLQueueBladeProps {
  items?:    HITLQueueItem[];
  pending?:  number;
}

const dotColor: Record<HITLQueueItem["sev"], string> = {
  success:  "bg-[#25D366]",
  warn:     "bg-[#FF9800]",
  critical: "bg-[#D32F2F]",
  info:     "bg-[#2196F3]",
};

const DEFAULT_ITEMS: HITLQueueItem[] = [
  { id: "h1", sev: "success",  title: "Token Mint Override",  meta: "Mint 5,000 Type-B tokens to BodaUnion-KLA" },
  { id: "h2", sev: "warn",     title: "Price Rule Change",    meta: "VEBA commission 5% → 6% (KE only)"        },
  { id: "h3", sev: "critical", title: "Suspend Account",      meta: 'DPD 61 days: "Kampala Rentals Ltd"',      },
];

export function HITLQueueBlade({ items = DEFAULT_ITEMS, pending }: HITLQueueBladeProps) {
  const count = pending ?? items.length;

  return (
    <Card
      title="Context Blade — HITL Queue"
      subtitle="High-risk actions waiting for approval."
    >
      {/* Badge inline — we override the Card header with a wrapper trick */}
      <div className="-mt-2 mb-1 flex items-center gap-2">
        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-[#FFF8E1] border-[#FFE08A] text-[#7A5E00]">
          {count} PENDING
        </span>
      </div>

      <div className="flex flex-col divide-y divide-dashed divide-[#E9EDEF]">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            {/* Severity dot */}
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor[item.sev]}`} />

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-[12px] text-[#111B21] leading-tight">{item.title}</div>
              <div className="text-[11px] text-[#667781] mt-0.5 leading-snug">{item.meta}</div>
            </div>

            {/* Review button */}
            <button
              onClick={item.onReview}
              className="
                shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold
                bg-[#34B7F1] text-white border-none cursor-pointer
                hover:brightness-105 active:opacity-85 transition-all
              "
            >
              Review
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
