/**
 * EditListingDrawer — Slide-in drawer for editing an existing VEBA listing's
 * commercial terms. Modelled on ListOnVebaDrawer but pre-fills from the
 * listing object and calls PUT /update.
 */

import React, { useCallback, useEffect, useState } from "react";
import { updateVebaListing } from "../../../api/services/veba.service";
import { useGuardedMutation, GuardedButton } from "../../../auth/guards";
import { AssetPhotoUpload } from "./AssetPhotoUpload";
import type {
  VebaListing,
  ListingVisibility,
  PricingBasis,
} from "../../../api/types";

interface EditListingDrawerProps {
  listing: VebaListing;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function EditListingDrawer({ listing, open, onClose, onUpdated }: EditListingDrawerProps) {
  const [dailyRate, setDailyRate] = useState("");
  const [currency, setCurrency] = useState("");
  const [pricingBasis, setPricingBasis] = useState<PricingBasis>("per_day");
  const [hourlyRate, setHourlyRate] = useState("");
  const [availabilityStart, setAvailabilityStart] = useState("");
  const [availabilityEnd, setAvailabilityEnd] = useState("");
  const [geographicScope, setGeographicScope] = useState("");
  const [operatorIncluded, setOperatorIncluded] = useState(false);
  const [visibility, setVisibility] = useState<ListingVisibility>("public");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Pre-fill from listing whenever the drawer opens or the listing changes
  useEffect(() => {
    if (!open) return;
    setDailyRate(String(listing.daily_rate));
    setCurrency(listing.currency);
    setPricingBasis(listing.pricing_basis);
    setHourlyRate(listing.hourly_rate != null ? String(listing.hourly_rate) : "");
    setAvailabilityStart(listing.availability_start ?? "");
    setAvailabilityEnd(listing.availability_end ?? "");
    setGeographicScope(listing.geographic_scope ?? "");
    setOperatorIncluded(listing.operator_included);
    setVisibility(listing.visibility);
    setNotes(listing.notes ?? "");
    setValidationError(null);
    updateMut.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, listing.listing_uid]);

  const updateMut = useGuardedMutation(
    "can_edit_asset_listing",
    (fields: Record<string, unknown>) => updateVebaListing(listing.listing_uid, fields),
  );

  const handleClose = () => {
    setValidationError(null);
    onClose();
  };

  const handleSubmit = async () => {
    setValidationError(null);
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

    const fields: Record<string, unknown> = {
      daily_rate: dailyRateNum,
      currency: currency.trim().toUpperCase() || "UGX",
      pricing_basis: pricingBasis,
      hourly_rate: hourlyRateNum,
      availability_start: availabilityStart || null,
      availability_end: availabilityEnd || null,
      geographic_scope: geographicScope.trim() || null,
      operator_included: operatorIncluded,
      visibility,
      notes: notes.trim() || null,
    };

    try {
      await updateMut.mutate(fields);
      onUpdated?.();
      handleClose();
    } catch {
      // updateMut.error renders in footer
    }
  };

  if (!open) return null;

  const displayError = validationError ?? (updateMut.error ? updateMut.error.message : null);
  const title = listing.asset_summary?.display_name ?? listing.asset_uid;

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
        aria-label="Edit VEBA listing"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-[#F8F9FA] border-b border-[#E9EDEF] flex items-center justify-between gap-3">
          <div>
            <div className="font-extrabold text-[14px] text-[#111B21]">Edit Listing</div>
            <div className="text-[12px] text-[#667781]">{title}</div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-[#E9EDEF] bg-white text-[#111B21] hover:bg-[#F0F2F5] cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* Photo */}
          <AssetPhotoUpload
            assetUid={listing.asset_uid}
            currentPhotoUrl={listing.asset_summary?.photo_url}
            onUploaded={useCallback(() => onUpdated?.(), [onUpdated])}
            disabled={updateMut.isRunning}
          />

          {/* Pricing */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-3">
            <div className="text-[11px] font-extrabold text-[#111B21] mb-2">Pricing</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Daily rate *</span>
                <input type="number" min="0" step="any" value={dailyRate}
                  onChange={(e) => setDailyRate(e.target.value)}
                  disabled={updateMut.isRunning}
                  className="px-2 py-1.5 text-[12px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[#128C7E]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Currency</span>
                <input value={currency} maxLength={4}
                  onChange={(e) => setCurrency(e.target.value)}
                  disabled={updateMut.isRunning}
                  className="px-2 py-1.5 text-[12px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[#128C7E]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Pricing basis</span>
                <select value={pricingBasis}
                  onChange={(e) => setPricingBasis(e.target.value as PricingBasis)}
                  disabled={updateMut.isRunning}
                  className="px-2 py-1.5 text-[12px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[#128C7E]"
                >
                  <option value="per_day">Per day</option>
                  <option value="per_hour">Per hour</option>
                  <option value="per_km">Per km</option>
                  <option value="per_trip">Per trip</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Hourly rate</span>
                <input type="number" min="0" step="any" value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  disabled={updateMut.isRunning}
                  className="px-2 py-1.5 text-[12px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[#128C7E]"
                />
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
                  onChange={(e) => setAvailabilityStart(e.target.value)}
                  disabled={updateMut.isRunning}
                  className="px-2 py-1.5 text-[12px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[#128C7E]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">To (open-ended if blank)</span>
                <input type="date" value={availabilityEnd}
                  onChange={(e) => setAvailabilityEnd(e.target.value)}
                  disabled={updateMut.isRunning}
                  className="px-2 py-1.5 text-[12px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[#128C7E]"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 mt-3">
              <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Geographic scope</span>
              <input value={geographicScope}
                onChange={(e) => setGeographicScope(e.target.value)}
                placeholder="e.g. Uganda, Kampala only, EAC region"
                disabled={updateMut.isRunning}
                className="px-2 py-1.5 text-[12px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[#128C7E]"
              />
            </label>
            <label className="flex items-center gap-2 mt-3 text-[12px] text-[#111B21] cursor-pointer">
              <input type="checkbox" checked={operatorIncluded}
                onChange={(e) => setOperatorIncluded(e.target.checked)}
                disabled={updateMut.isRunning}
              />
              Operator included
            </label>
          </div>

          {/* Visibility & notes */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-3">
            <div className="text-[11px] font-extrabold text-[#111B21] mb-2">Visibility & notes</div>
            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center gap-1.5 text-[12px] cursor-pointer">
                <input type="radio" name="edit-visibility" value="public"
                  checked={visibility === "public"}
                  onChange={() => setVisibility("public")}
                  disabled={updateMut.isRunning}
                />
                Marketplace public
              </label>
              <label className="flex items-center gap-1.5 text-[12px] cursor-pointer">
                <input type="radio" name="edit-visibility" value="tenant"
                  checked={visibility === "tenant"}
                  onChange={() => setVisibility("tenant")}
                  disabled={updateMut.isRunning}
                />
                Tenant-private
              </label>
            </div>
            <label className="flex flex-col gap-1 mt-3">
              <span className="text-[10px] font-medium text-[#667781] uppercase tracking-wide">Notes</span>
              <textarea value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Condition, certifications, what's included..."
                disabled={updateMut.isRunning}
                className="px-2 py-1.5 text-[12px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[#128C7E] resize-y font-[inherit]"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#E9EDEF] bg-[#F8F9FA] flex items-center justify-between gap-3">
          <div className="text-[12px] text-[#B00020] flex-1 min-h-[1em]">{displayError}</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={updateMut.isRunning}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-[#E9EDEF] bg-white text-[#111B21] hover:bg-[#F0F2F5] cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <GuardedButton
              permission="can_edit_asset_listing"
              onClick={handleSubmit}
              disabled={updateMut.isRunning}
              className="px-3 py-1 text-[11px] font-extrabold rounded-md bg-[#128C7E] text-white hover:bg-[#0D7466] border-0 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            >
              {updateMut.isRunning ? "Saving..." : "Save changes"}
            </GuardedButton>
          </div>
        </div>
      </aside>
    </>
  );
}
