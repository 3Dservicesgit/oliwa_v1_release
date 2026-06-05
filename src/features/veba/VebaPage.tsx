/**
 * VebaPage — VEBA Marketplace
 *
 * Client-facing marketplace module. Clients can:
 *   - View & manage their asset listings (create, edit, delete, pause/reactivate)
 *   - Review incoming booking requests for their assets
 */
import React, { useState } from "react";
import { MyListings } from "./components/MyListings";
import { IncomingBookingRequests } from "./components/IncomingBookingRequests";

type VebaTab = "my-listings" | "booking-requests";

// ─── Tab config ──────────────────────────────────────────────────────────────
const TABS: { key: VebaTab; label: string }[] = [
  { key: "my-listings",      label: "My Listings" },
  { key: "booking-requests", label: "Booking Requests" },
];

// ─── Page ────────────────────────────────────────────────────────────────────
export function VebaPage() {
  const [activeTab, setActiveTab] = useState<VebaTab>("my-listings");

  return (
    <div className="flex flex-col gap-3 p-3 bg-[#F0F2F5] w-full">

          {/* ── Page Header ────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-black text-[16px] text-[#111B21]">VEBA Marketplace</div>
                <nav className="text-[11px] text-[#667781] mt-0.5">List assets and manage bookings</nav>
              </div>
            </div>
          </div>

          {/* ── Tab toggle ────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-1.5 flex gap-1 self-start">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={[
                  "px-3 py-1.5 text-[12px] font-extrabold rounded-md cursor-pointer border-0 transition-colors",
                  activeTab === tab.key
                    ? "bg-[#128C7E] text-white"
                    : "bg-transparent text-[#667781] hover:bg-[#F0F2F5]",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── My Listings tab ───────────────────────────────────────── */}
          {activeTab === "my-listings" && <MyListings />}

          {/* ── Booking Requests tab ──────────────────────────────────── */}
          {activeTab === "booking-requests" && <IncomingBookingRequests />}

    </div>
  );
}
