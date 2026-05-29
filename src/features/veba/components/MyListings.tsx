/**
 * MyListings — Owner-facing card-grid view of the current tenant's VEBA listings.
 *
 * Each card shows the asset photo, name, rate, and status. Tapping a card
 * expands it to reveal full details (pricing, availability, visibility,
 * notes) and CRUD action buttons (Edit, Pause/Reactivate, Archive, Delete).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  archiveVebaListing,
  deleteVebaListing,
  getAssetPhotoFullUrl,
  getVebaListings,
  pauseVebaListing,
  reactivateVebaListing,
  uploadAssetPhoto,
} from "../../../api/services/veba.service";
import { useAuth } from "../../../auth/AuthContext";
import { useGuardedMutation, GuardedButton } from "../../../auth/guards";
import type { VebaListing, ListingStatus } from "../../../api/types";
import { EditListingDrawer } from "./EditListingDrawer";
import { CreateListingDrawer } from "./CreateListingDrawer";

// ── Status badge styles ──────────────────────────────────────────────────────

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
      className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatWindow(start?: string | null, end?: string | null): string {
  if (!start && !end) return "Available now";
  if (start && !end)  return `From ${start}`;
  if (!start && end)  return `Until ${end}`;
  return `${start} → ${end}`;
}

function basisLabel(b: string): string {
  switch (b) {
    case "per_day":  return "/day";
    case "per_hour": return "/hr";
    case "per_km":   return "/km";
    case "per_trip": return "/trip";
    default: return "";
  }
}

// ── Single listing card ─────────────────────────────────────────────────────

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

interface ListingCardItemProps {
  listing: VebaListing;
  isExpanded: boolean;
  isPending: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onPause: () => void;
  onReactivate: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onPhotoUploaded: () => void;
}

function ListingCardItem({
  listing: l,
  isExpanded,
  isPending,
  onToggle,
  onEdit,
  onPause,
  onReactivate,
  onArchive,
  onDelete,
  onPhotoUploaded,
}: ListingCardItemProps) {
  const title = l.asset_summary?.display_name ?? l.asset_uid;
  const cls = l.asset_summary?.asset_class;
  const photoUrl = l.asset_summary?.photo_url;
  const initial = (title || "?").charAt(0).toUpperCase();

  // Photo upload state
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const displayPhoto = preview || (photoUrl ? getAssetPhotoFullUrl(photoUrl) : null);

  const handleFile = useCallback(async (file: File) => {
    setUploadError(null);
    if (!ALLOWED_TYPES.includes(file.type)) { setUploadError("Only JPG, PNG, or WebP."); return; }
    if (file.size > MAX_SIZE) { setUploadError("Max 5 MB."); return; }
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      await uploadAssetPhoto(l.asset_uid, file);
      onPhotoUploaded();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }, [l.asset_uid, onPhotoUploaded]);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  }, [handleFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (uploading) return;
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [uploading, handleFile]);

  return (
    <article className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden flex flex-col hover:shadow-sm transition-shadow">
      {/* ── Photo hero ──────────────────────────────────────────── */}
      <div className="h-36 bg-[#F0F2F5] border-b border-[#E9EDEF] relative">
        {displayPhoto ? (
          <div className="relative group w-full h-full">
            <img src={displayPhoto} alt={title} className="w-full h-full object-cover" />
            {!uploading && (
              <div
                className="absolute inset-0 bg-[rgba(0,0,0,0.35)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              >
                <span className="text-[11px] font-extrabold text-white bg-[rgba(0,0,0,0.5)] px-3 py-1.5 rounded-md">Change photo</span>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-[rgba(0,0,0,0.45)] flex items-center justify-center">
                <div className="w-5 h-5 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        ) : (
          <div
            className={[
              "w-full h-full flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors",
              dragOver ? "bg-[#E9F7F4]" : "bg-[#F0F2F5] hover:bg-[#E9F7F4]",
            ].join(" ")}
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-[#8696A0]">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span className="text-[10px] font-medium text-[#667781]">Add photo</span>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2 right-2">
          <StatusPill status={l.status} />
        </div>

        {/* Visibility badge */}
        <div className="absolute top-2 left-2">
          <span className={[
            "text-[10px] font-extrabold px-2 py-0.5 rounded-full",
            l.visibility === "tenant"
              ? "bg-white border border-[#E9EDEF] text-[#667781]"
              : "bg-[#128C7E] text-white",
          ].join(" ")}>
            {l.visibility === "tenant" ? "Private" : "Public"}
          </span>
        </div>
      </div>

      {uploadError && (
        <div className="px-3 py-1.5 text-[10px] text-[#B00020] bg-[#FFF5F5] border-b border-[#FFD6D6]">{uploadError}</div>
      )}

      {/* ── Card body (clickable to expand) ─────────────────────── */}
      <div className="p-3 flex flex-col gap-2 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-extrabold text-[13px] text-[#111B21] truncate" title={title}>{title}</div>
            <div className="text-[11px] text-[#667781] truncate">
              {[cls, l.asset_summary?.owner_org, l.asset_summary?.country].filter(Boolean).join(" · ") || l.asset_uid}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[15px] font-black text-[#111B21] leading-tight whitespace-nowrap">
              {l.currency} {l.daily_rate.toLocaleString()}
            </div>
            <div className="text-[10px] text-[#667781]">{basisLabel(l.pricing_basis)}</div>
          </div>
        </div>

        {/* Expand chevron hint */}
        <div className="flex justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={[
              "w-4 h-4 text-[#8696A0] transition-transform",
              isExpanded ? "rotate-180" : "",
            ].join(" ")}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* ── Expanded detail panel ───────────────────────────────── */}
      {isExpanded && (
        <div className="border-t border-[#E9EDEF] px-3 py-3 flex flex-col gap-3 bg-[#F8F9FA]">
          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
            <div>
              <div className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Rate</div>
              <div className="text-[#111B21] font-medium">
                {l.currency} {l.daily_rate.toLocaleString()} {basisLabel(l.pricing_basis)}
              </div>
            </div>
            {l.hourly_rate != null && (
              <div>
                <div className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Hourly rate</div>
                <div className="text-[#111B21] font-medium">{l.currency} {l.hourly_rate.toLocaleString()} /hr</div>
              </div>
            )}
            <div>
              <div className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Availability</div>
              <div className="text-[#111B21] font-medium">{formatWindow(l.availability_start, l.availability_end)}</div>
            </div>
            <div>
              <div className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Operator</div>
              <div className="text-[#111B21] font-medium">{l.operator_included ? "Included" : "Not included"}</div>
            </div>
            {l.geographic_scope && (
              <div className="col-span-2">
                <div className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Geographic scope</div>
                <div className="text-[#111B21] font-medium">{l.geographic_scope}</div>
              </div>
            )}
            {l.notes && (
              <div className="col-span-2">
                <div className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Notes</div>
                <div className="text-[#111B21] font-medium">{l.notes}</div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {l.status !== "archived" && (
              <GuardedButton
                permission="can_edit_asset_listing"
                onClick={onEdit}
                disabled={isPending}
                className="flex-1 min-w-[80px] px-3 py-1.5 text-[11px] font-extrabold rounded-md border border-[#E9EDEF] bg-white text-[#128C7E] hover:bg-[#E9F7F4] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Edit
              </GuardedButton>
            )}
            {l.status === "active" && (
              <GuardedButton
                permission="can_edit_asset_listing"
                onClick={onPause}
                disabled={isPending}
                className="flex-1 min-w-[80px] px-3 py-1.5 text-[11px] font-extrabold rounded-md border border-[#E9EDEF] bg-white text-[#111B21] hover:bg-[#F0F2F5] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "..." : "Pause"}
              </GuardedButton>
            )}
            {l.status === "paused" && (
              <GuardedButton
                permission="can_edit_asset_listing"
                onClick={onReactivate}
                disabled={isPending}
                className="flex-1 min-w-[80px] px-3 py-1.5 text-[11px] font-extrabold rounded-md bg-[#128C7E] text-white hover:bg-[#0D7466] cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "..." : "Reactivate"}
              </GuardedButton>
            )}
            {l.status !== "archived" && (
              <GuardedButton
                permission="can_edit_asset_listing"
                onClick={onArchive}
                disabled={isPending}
                className="flex-1 min-w-[80px] px-3 py-1.5 text-[11px] font-extrabold rounded-md border border-[#FFD6D6] bg-white text-[#B00020] hover:bg-[#FFF5F5] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "..." : "Archive"}
              </GuardedButton>
            )}
            <GuardedButton
              permission="can_edit_asset_listing"
              onClick={onDelete}
              disabled={isPending}
              className="flex-1 min-w-[80px] px-3 py-1.5 text-[11px] font-extrabold rounded-md bg-[#B00020] text-white hover:bg-[#8B0000] border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "..." : "Delete"}
            </GuardedButton>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        onChange={onFileInput}
        className="hidden"
        disabled={uploading}
      />
    </article>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function MyListings() {
  const { state: authState } = useAuth();
  const [listings, setListings] = useState<VebaListing[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [editingListing, setEditingListing] = useState<VebaListing | null>(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [expandedUid, setExpandedUid] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    if (!authState.accountRoot) {
      setListings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getVebaListings(authState.accountRoot);
      setListings(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load listings.");
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [authState.accountRoot]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

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
  const deleteMut = useGuardedMutation(
    "can_edit_asset_listing",
    (uid: string) => deleteVebaListing(uid),
  );

  const run = async (mutation: typeof pauseMut, uid: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
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

  // ── Loading / error / empty states ─────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 flex items-center justify-center gap-3">
        <div className="w-5 h-5 border-[3px] border-[#128C7E] border-t-transparent rounded-full animate-spin" />
        <span className="text-[12px] text-[#667781]">Loading your listings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-[#FFD6D6] rounded-xl p-6 text-[12px] text-[#B00020]">
        Could not load listings: {error}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <>
        <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 text-center">
          <div className="text-[16px] font-extrabold text-[#111B21] mb-1">You have not listed anything yet</div>
          <p className="text-[12px] text-[#667781] mb-3">List an idle vehicle or equipment on the VEBA marketplace to start earning.</p>
          <GuardedButton
            permission="can_list_asset_on_marketplace"
            onClick={() => setCreateDrawerOpen(true)}
            className="px-3 py-1.5 text-[11px] font-extrabold rounded-md bg-[#128C7E] text-white hover:bg-[#0D7466] border-0 cursor-pointer"
          >
            + New Listing
          </GuardedButton>
        </div>
        <CreateListingDrawer
          open={createDrawerOpen}
          onClose={() => setCreateDrawerOpen(false)}
          onCreated={fetchListings}
        />
      </>
    );
  }

  // ── Card grid ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="font-extrabold text-[13px] text-[#111B21]">My listings</h2>
          <p className="text-[11px] text-[#667781]">
            {listings.length} listing{listings.length === 1 ? "" : "s"} — tap a card for details
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={fetchListings}
            className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-[#E9EDEF] bg-white text-[#111B21] hover:bg-[#F0F2F5] cursor-pointer"
          >
            Refresh
          </button>
          <GuardedButton
            permission="can_list_asset_on_marketplace"
            onClick={() => setCreateDrawerOpen(true)}
            className="px-3 py-1 text-[11px] font-extrabold rounded-md bg-[#128C7E] text-white hover:bg-[#0D7466] border-0 cursor-pointer"
          >
            + New Listing
          </GuardedButton>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {listings.map((l) => (
          <ListingCardItem
            key={l.listing_uid}
            listing={l}
            isExpanded={expandedUid === l.listing_uid}
            isPending={pendingUid === l.listing_uid}
            onToggle={() => setExpandedUid(expandedUid === l.listing_uid ? null : l.listing_uid)}
            onEdit={() => setEditingListing(l)}
            onPause={() => run(pauseMut, l.listing_uid)}
            onReactivate={() => run(reactivateMut, l.listing_uid)}
            onArchive={() => run(archiveMut, l.listing_uid, "Archive this listing? Existing bookings will continue, but no new ones can be requested.")}
            onDelete={() => run(deleteMut, l.listing_uid, "Permanently delete this listing? This cannot be undone.")}
            onPhotoUploaded={fetchListings}
          />
        ))}
      </div>

      {/* Drawers */}
      {editingListing && (
        <EditListingDrawer
          listing={editingListing}
          open={!!editingListing}
          onClose={() => setEditingListing(null)}
          onUpdated={fetchListings}
        />
      )}

      <CreateListingDrawer
        open={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
        onCreated={fetchListings}
      />
    </div>
  );
}
