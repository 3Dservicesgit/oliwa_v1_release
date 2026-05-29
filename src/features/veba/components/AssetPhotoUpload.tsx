/**
 * AssetPhotoUpload — Drag-and-drop / click-to-browse image uploader
 * for VEBA asset photos.
 *
 * Features:
 *   - Accepts jpg, png, webp up to 5 MB
 *   - Drag-and-drop zone with visual feedback
 *   - Instant client-side preview before upload
 *   - Calls uploadAssetPhoto() on selection
 *   - Shows existing photo_url when editing a listing
 *   - Remove / replace support
 */

import React, { useCallback, useRef, useState } from "react";
import { uploadAssetPhoto, getAssetPhotoFullUrl } from "../../../api/services/veba.service";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_SIZE_LABEL = "5 MB";

interface AssetPhotoUploadProps {
  /** The asset UID to attach the photo to. */
  assetUid: string;
  /** Current photo URL from the listing's asset_summary.photo_url (if any). */
  currentPhotoUrl?: string | null;
  /** Called after a successful upload with the new photo_url. */
  onUploaded?: (photoUrl: string) => void;
  /** Disable interaction (e.g. while the parent form is submitting). */
  disabled?: boolean;
}

export function AssetPhotoUpload({
  assetUid,
  currentPhotoUrl,
  onUploaded,
  disabled = false,
}: AssetPhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const displayUrl = preview || (currentPhotoUrl ? getAssetPhotoFullUrl(currentPhotoUrl) : null);

  const validate = useCallback((file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Only JPG, PNG, and WebP images are allowed.";
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `File is too large. Maximum size is ${MAX_SIZE_LABEL}.`;
    }
    return null;
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      const err = validate(file);
      if (err) {
        setError(err);
        return;
      }

      // Show instant client-side preview
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      if (!assetUid) {
        // No asset UID yet (create flow) — just hold the preview.
        // The parent form should call uploadAssetPhoto after the listing is created.
        onUploaded?.("");
        return;
      }

      setUploading(true);
      try {
        const res = await uploadAssetPhoto(assetUid, file);
        onUploaded?.(res.data?.photo_url ?? "");
      } catch (uploadErr) {
        setError(
          uploadErr instanceof Error ? uploadErr.message : "Upload failed.",
        );
        setPreview(null);
      } finally {
        setUploading(false);
      }
    },
    [assetUid, validate, onUploaded],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset so the same file can be re-selected
      e.target.value = "";
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled || uploading) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [disabled, uploading, handleFile],
  );

  const handleRemove = useCallback(() => {
    setPreview(null);
    setError(null);
    onUploaded?.("");
  }, [onUploaded]);

  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl p-3">
      <div className="text-[11px] font-extrabold text-[#111B21] mb-2">
        Asset photo
      </div>

      {displayUrl ? (
        /* ── Photo preview ─────────────────────────────────────────── */
        <div className="relative group">
          <img
            src={displayUrl}
            alt="Asset"
            className="w-full h-40 object-cover rounded-lg border border-[#E9EDEF]"
          />
          {uploading && (
            <div className="absolute inset-0 bg-[rgba(0,0,0,0.45)] rounded-lg flex items-center justify-center">
              <div className="w-5 h-5 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!uploading && !disabled && (
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="px-2 py-1 text-[10px] font-extrabold rounded-md bg-white/90 text-[#111B21] border border-[#E9EDEF] hover:bg-white cursor-pointer"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="px-2 py-1 text-[10px] font-extrabold rounded-md bg-white/90 text-[#B00020] border border-[#FFD6D6] hover:bg-white cursor-pointer"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ── Drop zone ─────────────────────────────────────────────── */
        <div
          role="button"
          tabIndex={0}
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!disabled && !uploading) inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled && !uploading) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={[
            "flex flex-col items-center justify-center gap-1.5 px-4 py-6 rounded-lg border-2 border-dashed transition-colors cursor-pointer",
            dragOver
              ? "border-[#128C7E] bg-[#E9F7F4]"
              : "border-[#E9EDEF] bg-[#F8F9FA] hover:border-[#128C7E] hover:bg-[#E9F7F4]",
            (disabled || uploading) && "opacity-50 cursor-not-allowed",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {/* Camera icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-8 h-8 text-[#667781]"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <span className="text-[12px] font-medium text-[#667781]">
            {uploading ? "Uploading..." : "Drag a photo here or click to browse"}
          </span>
          <span className="text-[10px] text-[#8696A0]">
            JPG, PNG, or WebP — max {MAX_SIZE_LABEL}
          </span>
        </div>
      )}

      {error && (
        <div className="mt-2 text-[11px] text-[#B00020]">{error}</div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || uploading}
      />
    </div>
  );
}
