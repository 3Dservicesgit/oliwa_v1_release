import React, { ReactNode } from "react";

/** Collapsible section card with a title header. */
export function MSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4 border border-[#E9EDEF] rounded-xl overflow-hidden bg-white">
      <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E9EDEF]">
        <div className="font-black text-[13px] text-[#111B21]">{title}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/** Labeled form field wrapper. */
export function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-black text-[#111B21] mb-1">
        {label}
        {required && <span className="text-[#EF4444] ml-0.5">*</span>}
      </div>
      {children}
    </div>
  );
}

/** Green success banner shown after a step completes. */
export function StepSuccessBanner({
  message,
  nextLabel,
  onNext,
  onClose,
}: {
  message: string;
  nextLabel?: string;
  onNext?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="mb-4 px-4 py-3 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0]">
      <div className="text-[12px] font-black text-[#065F46] mb-2">{message}</div>
      <div className="flex items-center gap-2">
        {nextLabel && onNext && (
          <button
            onClick={onNext}
            className="h-8 px-4 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] text-[12px] font-black border-none cursor-pointer hover:brightness-105"
          >
            {nextLabel} &rarr;
          </button>
        )}
        <button
          onClick={onClose}
          className="h-8 px-4 rounded-lg bg-white border border-[#E9EDEF] text-[12px] font-black text-[#111B21] cursor-pointer hover:bg-[#F8FAFC]"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/** Error banner for form errors. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 px-4 py-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[12px] text-[#EF4444] font-black">
      {message}
    </div>
  );
}

/** Standard input class string used across all steps. */
export const INPUT_CLS =
  "w-full h-9 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] bg-white outline-none focus:border-[var(--brand)]";

/** Standard select class string. */
export const SELECT_CLS = INPUT_CLS;

/** Primary submit button class string. */
export const BTN_PRIMARY =
  "h-10 px-6 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] text-[13px] font-black border-none cursor-pointer hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed";
