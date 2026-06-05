/**
 * CreateListingDrawer — Slide-in drawer for creating a new VEBA marketplace
 * listing directly from the My Listings tab (without going via Asset Twin).
 *
 * The user supplies the asset UID and optional summary fields. Pricing,
 * availability, visibility, and notes work identically to ListOnVebaDrawer.
 */

import React, { useCallback, useEffect, useState } from "react";
import { createVebaListing, uploadAssetPhoto } from "../../../api/services/veba.service";
import { getClientDevices } from "../../../api/services/clients.service";
import { useAuth } from "../../../auth/AuthContext";
import { useGuardedMutation, GuardedButton } from "../../../auth/guards";
import { AssetPhotoUpload } from "./AssetPhotoUpload";
import type {
  CreateVebaListingRequest,
  ClientDevice,
  ListingVisibility,
  PricingBasis,
} from "../../../api/types";

interface CreateListingDrawerProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  /** When provided, pre-fills the asset fields from a client device. */
  prefillDevice?: ClientDevice;
}

export function CreateListingDrawer({ open, onClose, onCreated, prefillDevice }: CreateListingDrawerProps) {
  const { state: authState } = useAuth();

  // Device selection (replaces manual asset fields)
  const [devices, setDevices] = useState<ClientDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [selectedImei, setSelectedImei] = useState("");

  // Fetch client devices when drawer opens
  useEffect(() => {
    if (!open || !authState.accountRoot) return;
    setLoadingDevices(true);
    getClientDevices(authState.accountRoot)
      .then((res) => {
        if (res.status === "success" && Array.isArray(res.data)) {
          setDevices(res.data);
        } else {
          setDevices([]);
        }
      })
      .catch(() => setDevices([]))
      .finally(() => setLoadingDevices(false));
  }, [open, authState.accountRoot]);

  // Pre-fill from device when drawer opens via MyAssetCard
  useEffect(() => {
    if (!open || !prefillDevice) return;
    setSelectedImei(prefillDevice.device_imei);
  }, [open, prefillDevice]);

  // Derive asset details from the selected device
  const selectedDevice = devices.find((d) => d.device_imei === selectedImei) ?? null;

  // Pricing
  const [dailyRate, setDailyRate] = useState("");
  const [currency, setCurrency] = useState("UGX");
  const [pricingBasis, setPricingBasis] = useState<PricingBasis>("per_day");
  const [hourlyRate, setHourlyRate] = useState("");

  // Availability
  const [availabilityStart, setAvailabilityStart] = useState("");
  const [availabilityEnd, setAvailabilityEnd] = useState("");
  const [operatorIncluded, setOperatorIncluded] = useState(false);

  // Photo
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);

  // Visibility & notes
  const [visibility, setVisibility] = useState<ListingVisibility>("public");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const listMutation = useGuardedMutation(
    "can_list_asset_on_marketplace",
    (payload: CreateVebaListingRequest) => createVebaListing(payload),
  );

  const resetForm = () => {
    setSelectedImei("");
    setDailyRate(""); setCurrency("UGX"); setPricingBasis("per_day"); setHourlyRate("");
    setAvailabilityStart(""); setAvailabilityEnd(""); setOperatorIncluded(false);
    setVisibility("public"); setNotes(""); setPendingPhoto(null); setValidationError(null);
    listMutation.reset();
  };

  /** Called by AssetPhotoUpload when user selects a file (no asset_uid yet). */
  const handlePhotoSelected = useCallback((_photoUrl: string) => {
    // For create flow we don't upload immediately — we stash the File and
    // upload after the listing is created (so we have the asset_uid).
  }, []);

  const handleClose = () => { resetForm(); onClose(); };

  const handleSubmit = async () => {
    setValidationError(null);

    if (!selectedImei) {
      setValidationError("Please select a device / unit.");
      return;
    }
    const dailyRateNum = Number(dailyRate);
    if (!dailyRate || !Number.isFinite(dailyRateNum) || dailyRateNum <= 0) {
      setValidationError("Daily rate must be a positive number.");
      return;
    }
    const hourlyRateNum = hourlyRate ? Number(hourlyRate) : null;
    if (hourlyRate && (!Number.isFinite(hourlyRateNum!) || hourlyRateNum! <= 0)) {
      setValidationError("Hourly rate, if provided, must be positive.");
      return;
    }
    if (availabilityStart && availabilityEnd && availabilityEnd < availabilityStart) {
      setValidationError("Availability end date must not be before the start date.");
      return;
    }
    if (!authState.accountRoot || !authState.accountUid) {
      setValidationError("Missing account context.");
      return;
    }

    const assetSummary = selectedDevice
      ? {
          asset_uid: selectedImei,
          display_name: selectedDevice.device_name || undefined,
          asset_class: selectedDevice.car_type || undefined,
          owner_org: selectedDevice.client_name || undefined,
          country: undefined,
        }
      : undefined;

    const payload: CreateVebaListingRequest = {
      asset_uid: selectedImei,
      account_root: authState.accountRoot,
      created_by: authState.accountUid,
      daily_rate: dailyRateNum,
      currency: currency.trim().toUpperCase() || "UGX",
      pricing_basis: pricingBasis,
      hourly_rate: hourlyRateNum,
      availability_start: availabilityStart || null,
      availability_end: availabilityEnd || null,
      geographic_scope: null,
      operator_included: operatorIncluded,
      notes: notes.trim() || null,
      visibility,
      ...(assetSummary ? { asset_summary: assetSummary } : {}),
    };

    try {
      await listMutation.mutate(payload);

      // Upload photo after listing creation (now the asset_uid has a listing).
      if (pendingPhoto && selectedImei) {
        try {
          await uploadAssetPhoto(selectedImei, pendingPhoto);
        } catch {
          // Non-blocking — listing was created, photo just failed.
          console.warn("Photo upload failed after listing creation");
        }
      }

      onCreated?.();
      handleClose();
    } catch {
      // listMutation.error rendered in footer
    }
  };

  if (!open) return null;

  const displayError = validationError ?? (listMutation.error ? listMutation.error.message : null);
  const busy = listMutation.isRunning;
  const inp = "px-2 py-1.5 text-[12px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[#128C7E]";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[rgba(17,27,33,0.45)] z-[95]"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className="fixed right-0 top-[48px] h-[calc(100vh-48px)] w-[480px] bg-white border-l border-[#E9EDEF] shadow-2xl flex flex-col z-[100]"
        role="dialog"
        aria-label="Create VEBA listing"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-[#F8F9FA] border-b border-[#E9EDEF] flex items-center justify-between gap-3">
          <div>
            <div className="font-extrabold text-[14px] text-[#111B21]">New Marketplace Listing</div>
            <div className="text-[12px] text-[#667781]">List an idle asset on the VEBA marketplace</div>
          </div>
          <button
            type="button" onClick={handleClose}
            className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-[#E9EDEF] bg-white text-[#111B21] hover:bg-[#F0F2F5] cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* Device / Unit selection */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-3">
            <div className="text-[11px] font-extrabold text-[#111B21] mb-2">Select Unit *</div>
            {loadingDevices ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : devices.length === 0 ? (
              <div className="text-[12px] text-[#667781] py-2">No units found</div>
            ) : (
              <>
                <select
                  value={selectedImei}
                  onChange={(e) => setSelectedImei(e.target.value)}
                  disabled={busy}
                  className={inp + " w-full"}
                >
                  <option value="">— Choose a unit —</option>
                  {devices.map((d) => (
                    <option key={d.device_imei} value={d.device_imei}>
                      {d.device_name || d.device_imei}
                      {d.car_make ? ` · ${d.car_make} ${d.car_model || ""}`.trimEnd() : ""}
                    </option>
                  ))}
                </select>

                {/* Show selected device details */}
                {selectedDevice && (
                  <div className="mt-2 bg-[#F0F2F5] border border-[#E9EDEF] rounded-lg p-2.5 flex flex-col gap-0.5">
                    <div className="text-[11px] font-extrabold text-[#111B21]">
                      {selectedDevice.device_name || selectedDevice.device_imei}
                    </div>
                    <div className="text-[10px] text-[#667781]">
                      IMEI: {selectedDevice.device_imei}
                      {selectedDevice.car_make ? ` · ${selectedDevice.car_make} ${selectedDevice.car_model || ""}`.trimEnd() : ""}
                      {selectedDevice.car_type ? ` · ${selectedDevice.car_type}` : ""}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Photo */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-3">
            <div className="text-[11px] font-extrabold text-[#111B21] mb-2">Asset photo</div>
            {pendingPhoto ? (
              <div className="relative group">
                <img
                  src={URL.createObjectURL(pendingPhoto)}
                  alt="Preview"
                  className="w-full h-40 object-cover rounded-lg border border-[#E9EDEF]"
                />
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => setPendingPhoto(null)} disabled={busy}
                    className="px-2 py-1 text-[10px] font-extrabold rounded-md bg-white/90 text-[#B00020] border border-[#FFD6D6] hover:bg-white cursor-pointer">
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className={[
                "flex flex-col items-center justify-center gap-1.5 px-4 py-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                "border-[#E9EDEF] bg-[#F8F9FA] hover:border-[#128C7E] hover:bg-[#E9F7F4]",
                busy && "opacity-50 cursor-not-allowed",
              ].filter(Boolean).join(" ")}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-[#667781]">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="text-[12px] font-medium text-[#667781]">Click to add a photo</span>
                <span className="text-[10px] text-[#8696A0]">JPG, PNG, or WebP — max 5 MB</span>
                <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (f.size > 5 * 1024 * 1024) { setValidationError("Photo exceeds 5 MB limit."); return; }
                      setPendingPhoto(f);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>

          {/* Pricing */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-3">
            <div className="text-[11px] font-extrabold text-[#111B21] mb-2">Pricing</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Daily rate *</span>
                <input type="number" min="0" step="any" value={dailyRate}
                  onChange={(e) => setDailyRate(e.target.value)} placeholder="e.g. 250000"
                  disabled={busy} className={inp} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Currency</span>
                <input value={currency} onChange={(e) => setCurrency(e.target.value)}
                  placeholder="UGX" maxLength={4} disabled={busy} className={inp} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Pricing basis</span>
                <select value={pricingBasis}
                  onChange={(e) => setPricingBasis(e.target.value as PricingBasis)}
                  disabled={busy} className={inp}>
                  <option value="per_day">Per day</option>
                  <option value="per_hour">Per hour</option>
                  <option value="per_km">Per km</option>
                  <option value="per_trip">Per trip</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Hourly rate</span>
                <input type="number" min="0" step="any" value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)} placeholder="optional"
                  disabled={busy} className={inp} />
              </label>
            </div>
          </div>

          {/* Availability */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-3">
            <div className="text-[11px] font-extrabold text-[#111B21] mb-2">Availability</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">From</span>
                <input type="date" value={availabilityStart}
                  onChange={(e) => setAvailabilityStart(e.target.value)} disabled={busy} className={inp} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">To (open-ended if blank)</span>
                <input type="date" value={availabilityEnd}
                  onChange={(e) => setAvailabilityEnd(e.target.value)} disabled={busy} className={inp} />
              </label>
            </div>
            <label className="flex items-center gap-2 mt-3 text-[12px] text-[#111B21] cursor-pointer">
              <input type="checkbox" checked={operatorIncluded}
                onChange={(e) => setOperatorIncluded(e.target.checked)} disabled={busy} />
              Operator included
            </label>
          </div>

          {/* Visibility & notes */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-3">
            <div className="text-[11px] font-extrabold text-[#111B21] mb-2">Visibility & notes</div>
            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center gap-1.5 text-[12px] cursor-pointer">
                <input type="radio" name="create-visibility" value="public"
                  checked={visibility === "public"} onChange={() => setVisibility("public")} disabled={busy} />
                Marketplace public
              </label>
              <label className="flex items-center gap-1.5 text-[12px] cursor-pointer">
                <input type="radio" name="create-visibility" value="tenant"
                  checked={visibility === "tenant"} onChange={() => setVisibility("tenant")} disabled={busy} />
                Tenant-private
              </label>
            </div>
            <label className="flex flex-col gap-1 mt-3">
              <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Notes</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                placeholder="Condition, certifications, what's included..."
                disabled={busy}
                className="px-2 py-1.5 text-[12px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[#128C7E] resize-y font-[inherit]"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#E9EDEF] bg-[#F8F9FA] flex items-center justify-between gap-3">
          <div className="text-[12px] text-[#B00020] flex-1 min-h-[1em]">{displayError}</div>
          <div className="flex gap-2">
            <button type="button" onClick={handleClose} disabled={busy}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-[#E9EDEF] bg-white text-[#111B21] hover:bg-[#F0F2F5] cursor-pointer disabled:opacity-50">
              Cancel
            </button>
            <GuardedButton
              permission="can_list_asset_on_marketplace"
              onClick={handleSubmit}
              disabled={busy}
              className="px-3 py-1 text-[11px] font-extrabold rounded-md bg-[#128C7E] text-white hover:bg-[#0D7466] border-0 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            >
              {busy ? "Publishing..." : "Publish listing"}
            </GuardedButton>
          </div>
        </div>
      </aside>
    </>
  );
}
