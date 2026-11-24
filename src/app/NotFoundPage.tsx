/**
 * NotFoundPage — 404 fallback page.
 */
import React from "react";

export function NotFoundPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#F0F2F5] p-8">
      <span className="text-[72px] opacity-20">404</span>
      <h2 className="text-[22px] font-black text-[#111B21] m-0">Page not found</h2>
      <p className="text-[13px] text-[#667781] m-0">
        The route you requested doesn't exist in this CMS.
      </p>
      <a
        href="/"
        className="mt-2 h-9 px-5 rounded-full bg-[var(--brand)] text-white text-[12px] font-bold flex items-center hover:brightness-105 transition-all"
      >
        Go to Aegis Dashboard
      </a>
    </div>
  );
}
