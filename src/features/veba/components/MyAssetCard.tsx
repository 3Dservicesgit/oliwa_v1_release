/**
 * MyAssetCard — Card representing one of the client's own devices/units.
 *
 * Shows device info, photo upload, and listing status. If the asset is
 * not yet listed on the VEBA marketplace, offers a "List on Marketplace"
 * action. If already listed, shows the listing status badge.
 */

import React, { useCallback, useRef, useState } from "react";
import type { ClientDevice } from "../../../api/types";
import type { VebaListing } from "../../../api/types";
import { uploadAssetPhoto, getAssetPhotoFullUrl } from "../../../api/services/veba.service";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const STATUS_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  active:   { bg: "#E9F7F4", fg: "#075E54", label: "Listed" },
  paused:   { bg: "#FFF4E5", fg: "#9A6700", label: "Paused" },
  archived: { bg: "#F0F2F5", fg: "#667781", label: "Archived" },
  draft:    { bg: "#F0F2F5", fg: "#667781", label: "Draft" },
};

export interface MyAssetCardProps {
  device: ClientDevice;
  /** The active/paused listing for this asset, if one exists. */
  listing?: VebaListing | null;
  /** Called when the client wants to list this asset on the marketplace. */
  onListAsset?: (device: ClientDevice) => void;
  /** Called after a successful photo upload. */
  onPhotoUploaded?: () => void;
}

export function MyAssetCard({ device, listing, onListAsset, onPhotoUploaded }: MyAssetCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const photoUrl = listing?.asset_summary?.photo_url;
  const displayPhoto = preview || (photoUrl ? getAssetPhotoFullUrl(photoUrl) : null);
  const title = device.device_name || device.device_imei;
  const subtitle = [device.car_make, device.car_model, device.car_type].filter(Boolean).join(" · ");
  const initial = (title || "?").charAt(0).toUpperCase();

  const statusInfo = listing ? STATUS_STYLES[listing.status] ?? STATUS_STYLES.draft : null;

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
      await uploadAssetPhoto(device.device_imei, file);
      onPhotoUploaded?.();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }, [device.device_imei, onPhotoUploaded]);

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

  return (
    <article className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden flex flex-col hover:shadow-sm transition-shadow">
      {/* Photo area — interactive upload */}
      <div className="h-32 bg-[#F0F2F5] border-b border-[#E9EDEF] relative">
        {displayPhoto ? (
          <div className="relative group w-full h-full">
            <img src={displayPhoto} alt={title} className="w-full h-full object-cover" />
            {!uploading && (
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
        ) : (
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
        )}

        {/* Status badge */}
        <div className="absolute top-2 right-2">
          {statusInfo ? (
            <span
              className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
              style={{ background: statusInfo.bg, color: statusInfo.fg }}
            >
              {statusInfo.label}
            </span>
          ) : (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#F0F2F5] border border-[#E9EDEF] text-[#667781]">
              Not listed
            </span>
          )}
        </div>
      </div>

      {uploadError && (
        <div className="px-3 py-1.5 text-[10px] text-[#B00020] bg-[#FFF5F5] border-b border-[#FFD6D6]">{uploadError}</div>
      )}

      {/* Details */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <div className="font-extrabold text-[13px] text-[#111B21] truncate" title={title}>{title}</div>
          {subtitle && <div className="text-[11px] text-[#667781] truncate">{subtitle}</div>}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] font-medium bg-[#F0F2F5] border border-[#E9EDEF] rounded-full px-2 py-0.5 text-[#111B21]">
            {device.device_imei}
          </span>
          {device.hardware && (
            <span className="text-[10px] font-medium bg-[#F0F2F5] border border-[#E9EDEF] rounded-full px-2 py-0.5 text-[#667781]">
              {device.hardware}
            </span>
          )}
          {device.billing_status && (
            <span className={[
              "text-[10px] font-medium rounded-full px-2 py-0.5",
              device.billing_status === "active"
                ? "bg-[#E9F7F4] border border-[#C2E8E1] text-[#075E54]"
                : "bg-[#FFF4E5] border border-[#FFE0B2] text-[#9A6700]",
            ].join(" ")}>
              {device.billing_status}
            </span>
          )}
        </div>

        {/* Action */}
        <div className="mt-auto pt-2">
          {!listing || listing.status === "archived" ? (
            <button
              type="button"
              onClick={() => onListAsset?.(device)}
              className="w-full px-3 py-1.5 text-[12px] font-extrabold rounded-md bg-[#128C7E] text-white hover:bg-[#0D7466] cursor-pointer border-0"
            >
              List on Marketplace
            </button>
          ) : (
            <div className="text-[11px] text-[#667781] text-center">
              {listing.currency} {listing.daily_rate.toLocaleString()} / day
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        onChange={handleInputChange}
        className="hidden"
        disabled={uploading}
      />
    </article>
  );
}
