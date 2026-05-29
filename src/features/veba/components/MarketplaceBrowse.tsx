/**
 * MarketplaceBrowse — Client-facing view of the VEBA marketplace.
 *
 * Two sections:
 *   1. "My Assets" — the client's own devices/units fetched via
 *      getClientDevices(). Each card shows device info, photo upload,
 *      and lets the client list the asset on the marketplace.
 *   2. "Marketplace Listings" — active public listings from all tenants.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getVebaListings, getVebaListingForAsset } from "../../../api/services/veba.service";
import { getClientDevices } from "../../../api/services/clients.service";
import { useAuth } from "../../../auth/AuthContext";
import { usePermissions } from "../../../auth/PermissionsContext";
import type { VebaListing, ClientDevice } from "../../../api/types";
import { ListingCard } from "./ListingCard";
import { MyAssetCard } from "./MyAssetCard";
import { CreateListingDrawer } from "./CreateListingDrawer";

// ── Marketplace filters ──────────────────────────────────────────────────────

interface Filters {
  assetClass: string;
  operatorOnly: boolean;
  minRate: string;
  maxRate: string;
  scope: string;
}

const INITIAL_FILTERS: Filters = {
  assetClass: "",
  operatorOnly: false,
  minRate: "",
  maxRate: "",
  scope: "",
};

function applyFilters(listings: VebaListing[], f: Filters): VebaListing[] {
  return listings.filter((l) => {
    if (l.status !== "active") return false;
    if (f.assetClass && l.asset_summary?.asset_class !== f.assetClass) return false;
    if (f.operatorOnly && !l.operator_included) return false;
    const min = f.minRate ? Number(f.minRate) : -Infinity;
    const max = f.maxRate ? Number(f.maxRate) :  Infinity;
    if (Number.isFinite(min) && l.daily_rate < min) return false;
    if (Number.isFinite(max) && l.daily_rate > max) return false;
    if (f.scope) {
      const needle = f.scope.toLowerCase();
      const hay = (l.geographic_scope ?? "").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

function collectAssetClasses(listings: VebaListing[]): string[] {
  const set = new Set<string>();
  for (const l of listings) {
    const c = l.asset_summary?.asset_class;
    if (c) set.add(c);
  }
  return Array.from(set).sort();
}

// ── Component ────────────────────────────────────────────────────────────────

interface MarketplaceBrowseProps {
  onRequestBooking?: (listing: VebaListing) => void;
}

export function MarketplaceBrowse({ onRequestBooking }: MarketplaceBrowseProps = {}) {
  const { state: authState } = useAuth();
  const { hasPermission } = usePermissions();
  const canBrowse = hasPermission("can_browse_asset_listings");

  // ── My assets state ────────────────────────────────────────────────
  const [devices, setDevices]         = useState<ClientDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [devicesError, setDevicesError]     = useState<string | null>(null);
  /** Map: device_imei → VebaListing (or null if not listed). */
  const [assetListings, setAssetListings] = useState<Record<string, VebaListing | null>>({});
  const [assetSearch, setAssetSearch] = useState("");

  // Create listing drawer state (opened from "List on Marketplace" button)
  const [listingDevice, setListingDevice] = useState<ClientDevice | null>(null);

  // ── Marketplace listings state ─────────────────────────────────────
  const [listings, setListings] = useState<VebaListing[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filters, setFilters]   = useState<Filters>(INITIAL_FILTERS);
  const [stubFor, setStubFor]   = useState<string | null>(null);

  // ── Fetch client devices ───────────────────────────────────────────
  const fetchDevices = useCallback(async () => {
    if (!authState.accountRoot) { setDevices([]); setDevicesLoading(false); return; }
    setDevicesLoading(true);
    setDevicesError(null);
    try {
      const res = await getClientDevices(authState.accountRoot);
      const devs = res.data ?? [];
      setDevices(devs);

      // For each device, check if it has a VEBA listing
      const listingMap: Record<string, VebaListing | null> = {};
      await Promise.all(
        devs.map(async (d) => {
          try {
            const lr = await getVebaListingForAsset(d.device_imei);
            listingMap[d.device_imei] = lr.data ?? null;
          } catch {
            listingMap[d.device_imei] = null;
          }
        }),
      );
      setAssetListings(listingMap);
    } catch (err) {
      setDevicesError(err instanceof Error ? err.message : "Failed to load assets.");
      setDevices([]);
    } finally {
      setDevicesLoading(false);
    }
  }, [authState.accountRoot]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  // ── Fetch marketplace listings ─────────────────────────────────────
  const fetchListings = useCallback(async () => {
    if (!authState.accountRoot || !canBrowse) { setListings([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await getVebaListings(authState.accountRoot);
      setListings(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load marketplace.");
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [authState.accountRoot, canBrowse]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  // ── Filtered views ─────────────────────────────────────────────────
  const visible = useMemo(() => applyFilters(listings, filters), [listings, filters]);
  const assetClasses = useMemo(() => collectAssetClasses(listings), [listings]);

  const filteredDevices = useMemo(() => {
    if (!assetSearch.trim()) return devices;
    const needle = assetSearch.toLowerCase();
    return devices.filter((d) =>
      d.device_imei.toLowerCase().includes(needle) ||
      d.device_name.toLowerCase().includes(needle) ||
      d.car_make?.toLowerCase().includes(needle) ||
      d.car_model?.toLowerCase().includes(needle),
    );
  }, [devices, assetSearch]);

  // ── Handlers ───────────────────────────────────────────────────────
  const handleRequestBooking = (l: VebaListing) => {
    if (onRequestBooking) { onRequestBooking(l); return; }
    setStubFor(l.listing_uid);
    window.setTimeout(() => setStubFor(null), 2200);
  };

  const resetFilters = () => setFilters(INITIAL_FILTERS);

  const handleListAsset = (device: ClientDevice) => {
    setListingDevice(device);
  };

  const handleListingCreated = () => {
    fetchDevices();
    fetchListings();
  };

  if (!canBrowse) {
    return (
      <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 text-center">
        <div className="text-[14px] font-extrabold text-[#111B21] mb-1">Access restricted</div>
        <p className="text-[12px] text-[#667781]">You do not have permission to browse marketplace listings. Contact your administrator to request access.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ════════════════════════════════════════════════════════════════
          SECTION 1: My Assets
         ════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3">
        <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="font-extrabold text-[13px] text-[#111B21]">My Assets</div>
            <div className="text-[11px] text-[#667781]">
              {devices.length} unit{devices.length === 1 ? "" : "s"} — upload photos and list them on the marketplace
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={assetSearch}
              onChange={(e) => setAssetSearch(e.target.value)}
              placeholder="Search by IMEI, name..."
              className="px-2.5 py-1.5 text-[12px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[#128C7E] w-[200px]"
            />
            <button
              type="button"
              onClick={fetchDevices}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-[#E9EDEF] bg-white text-[#111B21] hover:bg-[#F0F2F5] cursor-pointer"
            >
              Refresh
            </button>
          </div>
        </div>

        {devicesLoading && (
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-[3px] border-[#128C7E] border-t-transparent rounded-full animate-spin" />
            <span className="text-[12px] text-[#667781]">Loading your assets...</span>
          </div>
        )}

        {!devicesLoading && devicesError && (
          <div className="bg-white border border-[#FFD6D6] rounded-xl p-6 text-[12px] text-[#B00020]">
            Could not load assets: {devicesError}
          </div>
        )}

        {!devicesLoading && !devicesError && devices.length === 0 && (
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 text-center">
            <div className="text-[14px] font-extrabold text-[#111B21] mb-1">No assets found</div>
            <p className="text-[12px] text-[#667781]">Your configured devices will appear here once provisioned.</p>
          </div>
        )}

        {!devicesLoading && !devicesError && devices.length > 0 && filteredDevices.length === 0 && (
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-6 text-center">
            <div className="text-[12px] text-[#667781]">No assets match your search.</div>
          </div>
        )}

        {!devicesLoading && !devicesError && filteredDevices.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {filteredDevices.map((d) => (
              <MyAssetCard
                key={d.device_imei}
                device={d}
                listing={assetListings[d.device_imei]}
                onListAsset={handleListAsset}
                onPhotoUploaded={() => {
                  fetchDevices();
                  fetchListings();
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2: Marketplace Listings
         ════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3">
        <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
          <div className="font-extrabold text-[13px] text-[#111B21]">Marketplace</div>
          <div className="text-[11px] text-[#667781]">Browse available listings from all tenants</div>
        </div>

        <section className="bg-white border border-[#E9EDEF] rounded-xl p-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 min-w-[140px]">
            <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Asset class</span>
            <select
              value={filters.assetClass}
              onChange={(e) => setFilters((f) => ({ ...f, assetClass: e.target.value }))}
              className="px-2 py-1.5 text-[12px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[#128C7E]"
            >
              <option value="">All</option>
              {assetClasses.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1 min-w-[110px]">
            <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Min daily rate</span>
            <input
              type="number" inputMode="numeric" placeholder="0"
              value={filters.minRate}
              onChange={(e) => setFilters((f) => ({ ...f, minRate: e.target.value }))}
              className="px-2 py-1.5 text-[12px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[#128C7E]"
            />
          </div>

          <div className="flex flex-col gap-1 min-w-[110px]">
            <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Max daily rate</span>
            <input
              type="number" inputMode="numeric" placeholder="no max"
              value={filters.maxRate}
              onChange={(e) => setFilters((f) => ({ ...f, maxRate: e.target.value }))}
              className="px-2 py-1.5 text-[12px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[#128C7E]"
            />
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Geographic scope contains</span>
            <input
              value={filters.scope}
              onChange={(e) => setFilters((f) => ({ ...f, scope: e.target.value }))}
              placeholder="e.g. Kampala, EAC"
              className="px-2 py-1.5 text-[12px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[#128C7E]"
            />
          </div>

          <label className="flex items-center gap-1.5 text-[12px] text-[#111B21] cursor-pointer">
            <input
              type="checkbox"
              checked={filters.operatorOnly}
              onChange={(e) => setFilters((f) => ({ ...f, operatorOnly: e.target.checked }))}
            />
            Operator only
          </label>

          <button
            type="button"
            onClick={resetFilters}
            className="px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-[#E9EDEF] bg-white text-[#111B21] hover:bg-[#F0F2F5] cursor-pointer"
          >
            Reset
          </button>

          <div className="text-[11px] text-[#667781] ml-auto">
            <span className="font-extrabold text-[#111B21]">{visible.length}</span> of {listings.length} listing{listings.length === 1 ? "" : "s"}
          </div>
        </section>

        {stubFor && (
          <div className="bg-[#E9F7F4] border border-[#C2E8E1] rounded-xl px-3 py-2 text-[12px] text-[#075E54]">
            Booking handler not yet wired in this context.
          </div>
        )}

        {loading && (
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-[3px] border-[#128C7E] border-t-transparent rounded-full animate-spin" />
            <span className="text-[12px] text-[#667781]">Loading marketplace...</span>
          </div>
        )}

        {!loading && error && (
          <div className="bg-white border border-[#FFD6D6] rounded-xl p-6 text-[12px] text-[#B00020]">Could not load listings: {error}</div>
        )}

        {!loading && !error && listings.length === 0 && (
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 text-center">
            <div className="text-[18px] font-extrabold text-[#111B21] mb-1">No listings yet</div>
            <p className="text-[12px] text-[#667781]">Idle vehicles or equipment can be listed from the My Assets section above.</p>
          </div>
        )}

        {!loading && !error && listings.length > 0 && visible.length === 0 && (
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 text-center">
            <div className="text-[14px] font-extrabold text-[#111B21] mb-1">No matches</div>
            <p className="text-[12px] text-[#667781]">Try widening your filters.</p>
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {visible.map((l) => (
              <ListingCard
                key={l.listing_uid}
                listing={l}
                isOwner={l.account_root === authState.accountRoot}
                onRequestBooking={handleRequestBooking}
                onPhotoUploaded={() => {
                  fetchListings();
                  fetchDevices();
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Create listing drawer (opened from MyAssetCard) ──────────── */}
      <CreateListingDrawer
        open={!!listingDevice}
        onClose={() => setListingDevice(null)}
        onCreated={handleListingCreated}
        prefillDevice={listingDevice ?? undefined}
      />
    </div>
  );
}
