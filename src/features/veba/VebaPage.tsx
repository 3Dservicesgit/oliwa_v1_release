/**
 * VebaPage — VEBA Marketplace
 *
 * Both halves of the marketplace, for a customer:
 *   Browse            — every asset on offer, and the form to ask for one
 *   My Listings       — their own assets: list, edit, pause, remove
 *   Requests Received — what other fleets have asked to hire from them
 *   My Requests       — what they have asked to hire, and how it went
 *
 * Browse and My Requests used to be missing, so a customer could put an asset
 * up and answer requests, but never make one.
 */
import React, { useState } from "react";
import { BrowseMarketplace } from "./components/BrowseMarketplace";
import { MyListings } from "./components/MyListings";
import { IncomingBookingRequests } from "./components/IncomingBookingRequests";
import { MyBookings } from "./components/MyBookings";

type VebaTab = "browse" | "my-listings" | "booking-requests" | "my-bookings";

// ─── Tab config ──────────────────────────────────────────────────────────────
const TABS: { key: VebaTab; label: string }[] = [
  { key: "browse",           label: "Browse" },
  { key: "my-listings",      label: "My Listings" },
  { key: "booking-requests", label: "Requests Received" },
  { key: "my-bookings",      label: "My Requests" },
];

// ─── Page ────────────────────────────────────────────────────────────────────
export function VebaPage() {
  const [activeTab, setActiveTab] = useState<VebaTab>("browse");

  return (
    <div className="flex flex-col gap-3 p-3 bg-[#F0F2F5] w-full">

          {/* ── Page Header ────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-black text-[16px] text-[#111B21]">VEBA Marketplace</div>
                <nav className="text-[11px] text-[#667781] mt-0.5">Hire an asset, or put yours up for hire</nav>
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

          {/* ── Browse tab ────────────────────────────────────────────── */}
          {activeTab === "browse" && <BrowseMarketplace />}

          {/* ── My Listings tab ───────────────────────────────────────── */}
          {activeTab === "my-listings" && <MyListings />}

          {/* ── Requests received (from other fleets) ─────────────────── */}
          {activeTab === "booking-requests" && <IncomingBookingRequests />}

          {/* ── My requests (to other fleets) ─────────────────────────── */}
          {activeTab === "my-bookings" && <MyBookings />}

    </div>
  );
}
