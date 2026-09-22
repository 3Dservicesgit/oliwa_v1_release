/**
 * BrowseMarketplace — what a customer sees when they want to hire someone
 * else's asset: every listing on the marketplace, and a way to ask for it.
 *
 * The booking form existed but nothing ever opened it, so a customer could
 * list their own asset and answer requests, but never make one. This is the
 * missing half: browse -> pick -> request, which lands in the owner's
 * "Booking Requests" and in the requester's "My Bookings".
 *
 * Listings the customer owns are shown too (they are on the marketplace, and
 * hiding them looks like they aren't) but marked, and cannot be booked.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getVebaListings } from "../../../api/services/veba.service";
import { useAuth } from "../../../auth/AuthContext";
import type { VebaListing } from "../../../api/types";
import { ListingCard } from "./ListingCard";
import { BookingRequestModal } from "./BookingRequestModal";

const INPUT =
  "h-8 px-2.5 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] " +
  "placeholder:text-[#8696A0] outline-none focus:border-[#128C7E] bg-white";

function matches(listing: VebaListing, query: string): boolean {
  if (!query.trim()) return true;
  const s = listing.asset_summary;
  const hay = [
    s?.display_name, s?.asset_class, s?.owner_org, s?.country,
    s?.car_make, s?.car_model, listing.geographic_scope, listing.notes,
  ].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(query.trim().toLowerCase());
}

export function BrowseMarketplace() {
  const { state: authState } = useAuth();
  const [listings, setListings] = useState<VebaListing[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [assetClass, setAssetClass] = useState("");
  const [booking, setBooking]   = useState<VebaListing | null>(null);
  const [sent, setSent]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getVebaListings(authState.accountRoot ?? "", {
        params: { scope: "marketplace" },
      });
      setListings(Array.isArray(data) ? data : []);
    } catch (err) {
      // Say what went wrong — an empty grid used to stand in for every failure.
      setError(err instanceof Error ? err.message : "Couldn't load the marketplace.");
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [authState.accountRoot]);

  useEffect(() => { void load(); }, [load]);

  const classes = useMemo(
    () => Array.from(new Set(listings.map((l) => l.asset_summary?.asset_class).filter(Boolean) as string[])).sort(),
    [listings],
  );

  const shown = useMemo(
    () => listings.filter((l) =>
      matches(l, search) && (!assetClass || l.asset_summary?.asset_class === assetClass)),
    [listings, search, assetClass],
  );

  const isMine = (l: VebaListing) => !!authState.accountRoot && l.account_root === authState.accountRoot;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3 flex flex-wrap items-center gap-2">
        <input
          className={`${INPUT} flex-1 min-w-[180px]`}
          placeholder="Search by asset, class, owner or place"
          aria-label="Search the marketplace"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={INPUT}
          aria-label="Filter by asset class"
          value={assetClass}
          onChange={(e) => setAssetClass(e.target.value)}
        >
          <option value="">All classes</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="h-8 px-3 rounded-lg border border-[#E9EDEF] bg-white text-[12px] font-extrabold text-[#111B21] cursor-pointer hover:bg-[#F0F2F5]"
        >
          Refresh
        </button>
        <span className="text-[11px] text-[#667781] ml-auto">
          {loading ? "Loading…" : `${shown.length} of ${listings.length} listing${listings.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {/* ── Request sent ────────────────────────────────────────────── */}
      {sent && (
        <div role="status" className="text-[12px] text-[#075E54] bg-[#E9F7F4] border border-[#128C7E]/30 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
          <span>Request sent. The owner will review it — you can follow it under <b>My Bookings</b>.</span>
          <button type="button" onClick={() => setSent(null)}
            className="text-[11px] font-extrabold text-[#075E54] bg-transparent border-0 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Failure ─────────────────────────────────────────────────── */}
      {error && (
        <div role="alert" className="text-[12px] text-[#B00020] bg-[#FFF5F5] border border-[#FFD6D6] rounded-lg px-3 py-2 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => void load()}
            className="h-7 px-3 rounded-lg border border-[#FFD6D6] bg-white text-[11px] font-extrabold text-[#B00020] cursor-pointer">
            Try again
          </button>
        </div>
      )}

      {/* ── Listings ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 text-center text-[13px] text-[#667781]">
          Loading the marketplace…
        </div>
      ) : shown.length === 0 ? (
        <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 text-center">
          <div className="text-[13px] font-extrabold text-[#111B21]">
            {listings.length === 0 ? "Nothing listed yet" : "Nothing matches that search"}
          </div>
          <div className="text-[12px] text-[#667781] mt-1">
            {listings.length === 0
              ? "When other fleets list assets for hire, they appear here."
              : "Try a different search, or clear the class filter."}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((listing) => (
            <div key={listing.listing_uid} className="relative">
              {isMine(listing) && (
                <span className="absolute z-10 top-2 left-2 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#111B21]/80 text-white">
                  Your listing
                </span>
              )}
              <ListingCard
                listing={listing}
                isOwner={isMine(listing)}
                bookable={!isMine(listing)}
                onRequestBooking={(l) => setBooking(l)}
                onPhotoUploaded={() => void load()}
              />
            </div>
          ))}
        </div>
      )}

      <BookingRequestModal
        listing={booking}
        onClose={() => setBooking(null)}
        onSubmitted={(uid) => { setSent(uid || "sent"); void load(); }}
      />
    </div>
  );
}
