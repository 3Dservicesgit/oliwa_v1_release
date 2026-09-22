/**
 * SampleDataNotice — says plainly that a screen is showing made-up numbers.
 *
 * Several screens were built from the design mock-ups and still carry that
 * sample data: they look exactly like the live ones, so nothing tells you the
 * figures aren't real. Rather than delete the work or leave it misleading,
 * each of those screens carries this banner until it is wired to the API.
 *
 * Customer accounts can't reach any of them; this is for staff and demos.
 */
import React from "react";

/** A pill for one panel on an otherwise live screen. */
export function SampleTag() {
  return (
    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] align-middle ml-2">
      Sample data
    </span>
  );
}

export function SampleDataNotice({ what }: { what?: string }) {
  return (
    <div
      role="note"
      className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-4 py-2.5 flex items-start gap-2"
    >
      <span aria-hidden className="text-[14px] leading-none mt-0.5">⚠</span>
      <div className="text-[12px] text-[#92400E]">
        <b>Sample data.</b>{" "}
        {what ?? "This screen isn't connected to live data yet — the figures below are from the design, not from your account."}
      </div>
    </div>
  );
}
