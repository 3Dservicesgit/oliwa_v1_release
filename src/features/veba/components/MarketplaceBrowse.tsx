/**
 * MarketplaceBrowse — CMS operator view of ALL VEBA marketplace listings
 * across asset owners. Shows a filterable management table with lifecycle
 * actions (Pause / Reactivate / Archive) so the operator can oversee the
 * entire marketplace from the Navas CMS.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  getVebaListings,
  pauseVebaListing,
  reactivateVebaListing,
  archiveVebaListing,
} from "../../../api/services/veba.service";
import { useAuth } from "../../../auth/AuthContext";
import { usePermissions } from "../../../auth/PermissionsContext";
import { useGuardedMutation, GuardedButton } from "../../../auth/guards";
import type { VebaListing, ListingStatus, PricingBasis, ClientDevice } from "../../../api/types";
import { EditListingDrawer } from "./EditListingDrawer";
import { ListingDetailPanel } from "./ListingDetailPanel";
import { ConfirmDialog, useConfirmDialog } from "../../../components/ui/ConfirmDialog";

/* ── Status styling ─────────────────────────────────────────────────── */
const STATUS_STYLES: Record<ListingStatus, { bg: string; fg: string; label: string }> = {
  active:   { bg: "#E9F7F4", fg: "#075E54", label: "Active" },
  paused:   { bg: "#FFF4E5", fg: "#9A6700", label: "Paused" },
  archived: { bg: "#F0F2F5", fg: "#667781", label: "Archived" },
  draft:    { bg: "#F0F2F5", fg: "#667781", label: "Draft" },
};

function StatusPill({ status }: { status: ListingStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span
      className="text-[10px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

function basisLabel(b: PricingBasis): string {
  switch (b) {
    case "per_day":  return "/day";
    case "per_hour": return "/hr";
    case "per_km":   return "/km";
    case "per_trip": return "/trip";
  }
}

/* ── Filters ────────────────────────────────────────────────────────── */
interface Filters {
  assetClass: string;
  status: string;
  visibility: string;
  search: string;
}

const INITIAL_FILTERS: Filters = {
  assetClass: "",
  status: "",
  visibility: "",
  search: "",
};

function applyFilters(listings: VebaListing[], f: Filters): VebaListing[] {
  return listings.filter((l) => {
    if (f.status && l.status !== f.status) return false;
    if (f.visibility && l.visibility !== f.visibility) return false;
    if (f.assetClass && l.asset_summary?.asset_class !== f.assetClass) return false;
    if (f.search) {
      const needle = f.search.toLowerCase();
      const haystack = [
        l.asset_uid,
        l.listing_uid,
        l.account_root,
        l.asset_summary?.display_name,
        l.asset_summary?.owner_org,
        l.asset_summary?.country,
        l.geographic_scope,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
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

/* ── Component ──────────────────────────────────────────────────────── */
interface MarketplaceBrowseProps {
  onRequestBooking?: (listing: VebaListing) => void;
}

export function MarketplaceBrowse({ onRequestBooking }: MarketplaceBrowseProps = {}) {
  const { state: authState } = useAuth();
  const { hasPermission } = usePermissions();
  const canBrowse = hasPermission("can_browse_asset_listings");

  // ── Marketplace listings state ─────────────────────────────────────
  const [listings, setListings] = useState<VebaListing[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filters, setFilters]   = useState<Filters>(INITIAL_FILTERS);
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [editingListing, setEditingListing] = useState<VebaListing | null>(null);
  const [selectedListing, setSelectedListing] = useState<VebaListing | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  /* Fetch ALL listings for the tenant (scope=owner shows every status) */
  const fetchListings = useCallback(async () => {
    if (!authState.accountRoot || !canBrowse) {
      setListings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const listings = await getVebaListings(authState.accountRoot, {
        params: { scope: "owner" },
      });
      setListings(Array.isArray(listings) ? listings : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load marketplace listings.");
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [authState.accountRoot, canBrowse]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  /* Lifecycle mutations */
  const pauseMut = useGuardedMutation(
    "can_edit_asset_listing",
    (uid: string) => pauseVebaListing(uid, authState.accountUid ?? "system"),
  );
  const reactivateMut = useGuardedMutation(
    "can_edit_asset_listing",
    (uid: string) => reactivateVebaListing(uid, authState.accountUid ?? "system"),
  );
  const archiveMut = useGuardedMutation(
    "can_edit_asset_listing",
    (uid: string) => archiveVebaListing(uid, authState.accountUid ?? "system"),
  );

  const run = async (mutation: typeof pauseMut, uid: string, confirmOpts?: { title: string; message: string; confirmLabel: string; variant?: "danger" | "warning" | "default" }) => {
    if (confirmOpts) {
      const ok = await confirm(confirmOpts);
      if (!ok) return;
    }
    setPendingUid(uid);
    try {
      await mutation.mutate(uid);
      await fetchListings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setPendingUid(null);
    }
  };

  /* Permission gate */
  if (!canBrowse) {
    return (
      <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 text-center">
        <div className="text-[14px] font-extrabold text-[#111B21] mb-1">Access restricted</div>
        <p className="text-[12px] text-[#667781]">You do not have permission to browse marketplace listings.</p>
      </div>
    );
  }

  /* Derived */
  const visible = applyFilters(listings, filters);
  const assetClasses = collectAssetClasses(listings);
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of listings) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [listings]);

  const resetFilters = () => setFilters(INITIAL_FILTERS);

  return (
    <div className="flex flex-col gap-3">
      {/* ── KPI summary ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white border border-[#E9EDEF] rounded-xl px-3 py-2.5">
          <div className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Total listed</div>
          <div className="text-[20px] font-black text-[#111B21] leading-tight">{listings.length}</div>
        </div>
        <div className="bg-white border border-[#E9EDEF] rounded-xl px-3 py-2.5">
          <div className="text-[10px] font-medium text-[#075E54] uppercase tracking-wide">Active</div>
          <div className="text-[20px] font-black text-[#075E54] leading-tight">{statusCounts["active"] ?? 0}</div>
        </div>
        <div className="bg-white border border-[#E9EDEF] rounded-xl px-3 py-2.5">
          <div className="text-[10px] font-medium text-[#9A6700] uppercase tracking-wide">Paused</div>
          <div className="text-[20px] font-black text-[#9A6700] leading-tight">{statusCounts["paused"] ?? 0}</div>
        </div>
        <div className="bg-white border border-[#E9EDEF] rounded-xl px-3 py-2.5">
          <div className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Archived</div>
          <div className="text-[20px] font-black text-[#667781] leading-tight">{statusCounts["archived"] ?? 0}</div>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <section className="bg-white border border-[#E9EDEF] rounded-xl p-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Search</span>
          <input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Asset UID, owner, location..."
            className="px-2 py-1.5 text-[12px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[#128C7E]"
          />
        </div>

        <div className="flex flex-col gap-1 min-w-[120px]">
          <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Status</span>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="px-2 py-1.5 text-[12px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[#128C7E]"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-[120px]">
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

        <div className="flex flex-col gap-1 min-w-[120px]">
          <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Visibility</span>
          <select
            value={filters.visibility}
            onChange={(e) => setFilters((f) => ({ ...f, visibility: e.target.value }))}
            className="px-2 py-1.5 text-[12px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[#128C7E]"
          >
            <option value="">All</option>
            <option value="public">Public</option>
            <option value="tenant">Tenant-private</option>
          </select>
        </div>

        <button type="button" onClick={resetFilters}
          className="px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-[#E9EDEF] bg-white text-[#111B21] hover:bg-[#F0F2F5] cursor-pointer"
        >
          Reset
        </button>

        <div className="text-[11px] text-[#667781] ml-auto">
          <span className="font-extrabold text-[#111B21]">{visible.length}</span> of {listings.length} listing{listings.length === 1 ? "" : "s"}
        </div>
      </section>

      {/* ── States ───────────────────────────────────────────────────── */}
      {loading && (
        <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 flex items-center justify-center gap-3">
          <div className="w-5 h-5 border-[3px] border-[#128C7E] border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] text-[#667781]">Loading all marketplace listings...</span>
        </div>
      )}

      {!loading && error && (
        <div className="bg-white border border-[#FFD6D6] rounded-xl p-6 text-[12px] text-[#B00020]">
          Could not load listings: {error}
        </div>
      )}

      {!loading && !error && listings.length === 0 && (
        <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 text-center">
          <div className="text-[16px] font-extrabold text-[#111B21] mb-1">No listings yet</div>
          <p className="text-[12px] text-[#667781]">When asset owners list their vehicles or equipment, they will appear here.</p>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────── */}
      {!loading && !error && visible.length > 0 && (
        <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E9EDEF] flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-[13px] text-[#111B21]">Listed Assets</h2>
              <p className="text-[11px] text-[#667781]">All marketplace listings from asset owners</p>
            </div>
            <button type="button" onClick={fetchListings}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-[#E9EDEF] bg-white text-[#111B21] hover:bg-[#F0F2F5] cursor-pointer"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F8F9FA] border-b border-[#E9EDEF]">
                  <th className="text-left font-extrabold text-[#667781] px-3 py-2">Asset</th>
                  <th className="text-left font-extrabold text-[#667781] px-3 py-2">Owner</th>
                  <th className="text-left font-extrabold text-[#667781] px-3 py-2">Rate</th>
                  <th className="text-left font-extrabold text-[#667781] px-3 py-2">Availability</th>
                  <th className="text-left font-extrabold text-[#667781] px-3 py-2">Visibility</th>
                  <th className="text-left font-extrabold text-[#667781] px-3 py-2">Status</th>
                  <th className="text-right font-extrabold text-[#667781] px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((l) => {
                  const title = l.asset_summary?.display_name ?? l.asset_uid;
                  const cls = l.asset_summary?.asset_class;
                  const owner = l.asset_summary?.owner_org ?? l.account_root;
                  const country = l.asset_summary?.country;
                  const isPending = pendingUid === l.listing_uid;
                  const window = l.availability_start || l.availability_end
                    ? `${l.availability_start ?? "—"} → ${l.availability_end ?? "open"}`
                    : "Available now";

                  return (
                    <tr
                      key={l.listing_uid}
                      onClick={() => setSelectedListing(l)}
                      className="border-b border-[#E9EDEF] last:border-0 hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-extrabold text-[#111B21] truncate max-w-[180px]" title={title}>{title}</div>
                        <div className="text-[11px] text-[#667781] truncate max-w-[180px]">
                          {[cls, country].filter(Boolean).join(" · ") || l.asset_uid}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-[#111B21] truncate max-w-[140px]" title={owner}>{owner}</div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="font-extrabold text-[#111B21]">
                          {l.currency} {l.daily_rate.toLocaleString()}
                          <span className="font-medium text-[#667781]"> {basisLabel(l.pricing_basis)}</span>
                        </div>
                        {l.hourly_rate != null && (
                          <div className="text-[11px] text-[#667781]">{l.currency} {l.hourly_rate.toLocaleString()}/hr</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[#667781] whitespace-nowrap">
                        <div>{window}</div>
                        {l.geographic_scope && (
                          <div className="text-[11px] truncate max-w-[120px]" title={l.geographic_scope}>{l.geographic_scope}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {l.visibility === "tenant"
                          ? <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#F0F2F5] text-[#667781]">Tenant</span>
                          : <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#128C7E]/10 text-[#128C7E]">Public</span>
                        }
                      </td>
                      <td className="px-3 py-2.5"><StatusPill status={l.status} /></td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1.5 justify-end">
                          <GuardedButton
                            permission="can_edit_asset_listing"
                            onClick={() => setEditingListing(l)}
                            disabled={isPending}
                            className="px-2 py-1 text-[11px] font-extrabold rounded-md border border-[#E9EDEF] bg-white text-[#128C7E] hover:bg-[#E9F7F4] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Edit
                          </GuardedButton>
                          {l.status === "active" && (
                            <GuardedButton
                              permission="can_edit_asset_listing"
                              onClick={() => run(pauseMut, l.listing_uid)}
                              disabled={isPending}
                              className="px-2 py-1 text-[11px] font-extrabold rounded-md border border-[#E9EDEF] bg-white text-[#111B21] hover:bg-[#F0F2F5] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isPending ? "..." : "Pause"}
                            </GuardedButton>
                          )}
                          {(l.status === "paused" || l.status === "archived") && (
                            <GuardedButton
                              permission="can_edit_asset_listing"
                              onClick={() => run(
                                reactivateMut,
                                l.listing_uid,
                                l.status === "archived"
                                  ? { title: "Unarchive listing?", message: "This listing will become active and visible on the marketplace again.", confirmLabel: "Unarchive", variant: "warning" as const }
                                  : undefined,
                              )}
                              disabled={isPending}
                              className="px-2 py-1 text-[11px] font-extrabold rounded-md bg-[#128C7E] text-white hover:bg-[#0D7466] cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isPending ? "..." : l.status === "archived" ? "Unarchive" : "Reactivate"}
                            </GuardedButton>
                          )}
                          {l.status !== "archived" && (
                            <GuardedButton
                              permission="can_edit_asset_listing"
                              onClick={() => run(archiveMut, l.listing_uid, { title: "Archive listing?", message: "No new bookings can be made once archived.", confirmLabel: "Archive", variant: "danger" })}
                              disabled={isPending}
                              className="px-2 py-1 text-[11px] font-extrabold rounded-md border border-[#FFD6D6] bg-white text-[#B00020] hover:bg-[#FFF5F5] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isPending ? "..." : "Archive"}
                            </GuardedButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail panel — opens on row click */}
      {selectedListing && (
        <ListingDetailPanel
          listing={selectedListing}
          open={!!selectedListing}
          onClose={() => setSelectedListing(null)}
          onEdit={(l) => {
            setSelectedListing(null);
            setEditingListing(l);
          }}
          onActionComplete={fetchListings}
        />
      )}

      {/* Edit drawer */}
      {editingListing && (
        <EditListingDrawer
          listing={editingListing}
          open={!!editingListing}
          onClose={() => setEditingListing(null)}
          onUpdated={fetchListings}
        />
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
