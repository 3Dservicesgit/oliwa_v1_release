/**
 * VebaPage — VEBA Marketplace
 *
 * Client-facing marketplace module. Clients can:
 *   - View & manage their asset listings (create, edit, delete, pause/reactivate)
 *   - Update billing modes and costs
 *   - Review incoming booking requests for their assets
 *   - Browse the marketplace for other listings
 *   - Track their own outgoing booking requests
 */
import React, { useState } from "react";
import { MarketplaceBrowse } from "./components/MarketplaceBrowse";
import { BookingRequestModal } from "./components/BookingRequestModal";
import { IncomingBookingRequests } from "./components/IncomingBookingRequests";
import type { VebaListing } from "../../api/types";
import { Pill } from "../../components/Pill";

type VebaTab = "marketplace" | "booking-requests" | "ops";

// ─── Tab config ──────────────────────────────────────────────────────────────
const TABS: { key: VebaTab; label: string }[] = [
  { key: "my-listings",      label: "My Listings" },
  { key: "booking-requests", label: "Booking Requests" },
  // { key: "marketplace",      label: "Marketplace" },
  // { key: "my-bookings",      label: "My Bookings" },
];

// ─── Page ────────────────────────────────────────────────────────────────────
export function VebaPage() {
  const [activeTab, setActiveTab] = useState<VebaTab>("my-listings");
  const [bookingFor, setBookingFor] = useState<VebaListing | null>(null);

  return (
    <div className="flex flex-col gap-3 p-3 bg-[#F0F2F5] w-full">

          {/* ── Page Header ────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-black text-[16px] text-[#111B21]">Escrow &amp; Settlement Control Room</div>
                <nav className="text-[11px] text-[#667781] mt-0.5">VEBA Bookings Ops &rsaquo; Escrow • Disputes • Settlement • Mobile Money</nav>
              </div>
              <div className="flex gap-2 shrink-0">
                <Pill color="green">+ New Case</Pill>
                <Pill>Export</Pill>
              </div>
            </div>
          </div>

          {/* ── Tab toggle ────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-1.5 flex gap-1 self-start">
            <button
              type="button"
              onClick={() => setActiveTab("marketplace")}
              className={[
                "px-3 py-1.5 text-[12px] font-extrabold rounded-md cursor-pointer border-0 transition-colors",
                activeTab === "marketplace"
                  ? "bg-[#128C7E] text-white"
                  : "bg-transparent text-[#667781] hover:bg-[#F0F2F5]",
              ].join(" ")}
            >
              Marketplace
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("booking-requests")}
              className={[
                "px-3 py-1.5 text-[12px] font-extrabold rounded-md cursor-pointer border-0 transition-colors",
                activeTab === "booking-requests"
                  ? "bg-[#128C7E] text-white"
                  : "bg-transparent text-[#667781] hover:bg-[#F0F2F5]",
              ].join(" ")}
            >
              Booking Requests
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ops")}
              className={[
                "px-3 py-1.5 text-[12px] font-extrabold rounded-md cursor-pointer border-0 transition-colors",
                activeTab === "ops"
                  ? "bg-[#128C7E] text-white"
                  : "bg-transparent text-[#667781] hover:bg-[#F0F2F5]",
              ].join(" ")}
            >
              Settlement Ops
            </button>
          </div>

          {/* ── Marketplace tab (commented out — client-side only) ─────── */}
          {/* {activeTab === "marketplace" && (
            <MarketplaceBrowse onRequestBooking={(l) => setBookingFor(l)} />
          )} */}

          {/* ── Booking Requests tab (all client booking requests) ──────── */}
          {activeTab === "booking-requests" && <IncomingBookingRequests />}

          {/* ── Phase 3 booking-request modal (renders only when set) ──── */}
          <BookingRequestModal
            listing={bookingFor}
            onClose={() => setBookingFor(null)}
          />

    </div>
  );
}

