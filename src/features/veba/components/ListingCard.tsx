/**
 * ListingCard — Marketplace card for a single VebaListing.
 *
 * When the current client owns the listing, the photo area becomes an
 * interactive upload zone (click or drag-and-drop).
 */

import React, { useCallback, useRef, useState } from "react";
import type { VebaListing, PricingBasis } from "../../../api/types";
import { getAssetPhotoFullUrl, uploadAssetPhoto } from "../../../api/services/veba.service";
import { GuardedButton } from "../../../auth/guards";

function basisLabel(b: PricingBasis): string {
  switch (b) {
    case "per_day":  return "/day";
    case "per_hour": return "/hr";
    case "per_km":   return "/km";
    case "per_trip": return "/trip";
  }
}

function formatRate(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString()}`;
}

function formatWindow(start?: string | null, end?: string | null): string {
  if (!start && !end) return "Available now";
  if (start && !end)  return `From ${start}`;
  if (!start && end)  return `Until ${end}`;
  return `${start} -> ${end}`;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export interface ListingCardProps {
  listing: VebaListing;
  /** True when the logged-in client owns this listing (enables photo upload). */
  isOwner?: boolean;
  onRequestBooking?: (listing: VebaListing) => void;
  /** Called after a successful photo upload so the parent can refresh. */
  onPhotoUploaded?: () => void;
}

export function ListingCard({ listing, isOwner, onRequestBooking, onPhotoUploaded }: ListingCardProps) {
  const summary = listing.asset_summary;
  const title   = summary?.display_name ?? listing.asset_uid;
  const cls     = summary?.asset_class;
  const owner   = summary?.owner_org;
  const country = summary?.country;
  const initial = (title || "?").charAt(0).toUpperCase();
  const hasPhoto = !!summary?.photo_url;

  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const [preview, setPreview]     = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setUploadError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError("Only JPG, PNG, or WebP allowed.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setUploadError("Photo exceeds 5 MB limit.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);

    try {
      await uploadAssetPhoto(listing.asset_uid, file);
      onPhotoUploaded?.();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }, [listing.asset_uid, onPhotoUploaded]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }, [handleFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [uploading, handleFile]);

  const displayPhotoUrl = preview || (hasPhoto ? getAssetPhotoFullUrl(summary!.photo_url!) : null);

  // ── Photo area (interactive for owners, static for browsers) ──────
  const photoArea = displayPhotoUrl ? (
    <div className="relative group w-full h-full">
      <img src={displayPhotoUrl} alt={title} className="w-full h-full object-cover" />

      {/* Upload overlay for owners */}
      {isOwner && !uploading && (
        <div
          className="absolute inset-0 bg-[rgba(0,0,0,0.35)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
          onClick={() => inputRef.current?.click()}
        >
          <span className="text-[11px] font-extrabold text-white bg-[rgba(0,0,0,0.5)] px-3 py-1.5 rounded-md">
            Change photo
          </span>
        </div>
      )}

      {uploading && (
        <div className="absolute inset-0 bg-[rgba(0,0,0,0.45)] flex items-center justify-center">
          <div className="w-5 h-5 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  ) : isOwner ? (
    /* Owner sees an upload prompt when there's no photo */
    <div
      className={[
        "w-full h-full flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors",
        dragOver ? "bg-[#E9F7F4]" : "bg-[#F0F2F5] hover:bg-[#E9F7F4]",
      ].join(" ")}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-[#8696A0]">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
      <span className="text-[10px] font-medium text-[#667781]">Add photo</span>
    </div>
  ) : (
    /* Non-owner sees a plain initial placeholder */
    <div className="w-full h-full flex items-center justify-center text-[40px] font-black text-[#C2E8E1]">{initial}</div>
  );

  return (
    <article className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden flex flex-col hover:shadow-sm transition-shadow">
      <div className="h-32 bg-[#F0F2F5] border-b border-[#E9EDEF] relative">
        {photoArea}
        <div className="absolute top-2 right-2">
          {listing.visibility === "tenant" ? (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white border border-[#E9EDEF] text-[#667781]">Tenant-private</span>
          ) : (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#128C7E] text-white">Marketplace</span>
          )}
        </div>
      </div>

      {uploadError && (
        <div className="px-3 py-1.5 text-[10px] text-[#B00020] bg-[#FFF5F5] border-b border-[#FFD6D6]">{uploadError}</div>
      )}

      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-extrabold text-[13px] text-[#111B21] truncate" title={title}>{title}</div>
            <div className="text-[11px] text-[#667781] truncate">{[cls, owner, country].filter(Boolean).join(" * ") || "-"}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[15px] font-black text-[#111B21] leading-tight whitespace-nowrap">{formatRate(listing.daily_rate, listing.currency)}</div>
            <div className="text-[10px] text-[#667781]">{basisLabel(listing.pricing_basis)}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-1">
          <span className="text-[10px] font-medium bg-[#F0F2F5] border border-[#E9EDEF] rounded-full px-2 py-0.5 text-[#111B21]">{formatWindow(listing.availability_start, listing.availability_end)}</span>
          {listing.geographic_scope && (
            <span className="text-[10px] font-medium bg-[#F0F2F5] border border-[#E9EDEF] rounded-full px-2 py-0.5 text-[#111B21]" title={listing.geographic_scope}>
              {listing.geographic_scope.length > 20 ? listing.geographic_scope.slice(0, 20) + "..." : listing.geographic_scope}
            </span>
          )}
          {listing.operator_included && (
            <span className="text-[10px] font-medium bg-[#E9F7F4] border border-[#C2E8E1] rounded-full px-2 py-0.5 text-[#075E54]">Operator incl.</span>
          )}
          {listing.hourly_rate != null && (
            <span className="text-[10px] font-medium bg-[#F0F2F5] border border-[#E9EDEF] rounded-full px-2 py-0.5 text-[#667781]">{listing.currency} {listing.hourly_rate.toLocaleString()}/hr also</span>
          )}
        </div>

        {listing.notes && <p className="text-[11px] text-[#667781] line-clamp-2 mt-1">{listing.notes}</p>}

        <div className="mt-auto pt-2">
          <GuardedButton
            permission="can_book_asset"
            onClick={() => onRequestBooking?.(listing)}
            className="w-full px-3 py-1.5 text-[12px] font-extrabold rounded-md bg-[#128C7E] text-white hover:bg-[#0D7466] cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Request booking
          </GuardedButton>
        </div>
      </div>

      {/* Hidden file input for photo upload */}
      {isOwner && (
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          onChange={handleInputChange}
          className="hidden"
          disabled={uploading}
        />
      )}
    </article>
  );
}
