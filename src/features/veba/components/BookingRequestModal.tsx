/**
 * BookingRequestModal — Center modal for submitting a booking request
 * against a marketplace listing.
 */

import React, { useState } from "react";
import type { VebaListing, CreateBookingRequest } from "../../../api/types";
import { useAuth } from "../../../auth/AuthContext";
import { useGuardedMutation, GuardedButton } from "../../../auth/guards";
import { createBookingRequest } from "../../../api/services/veba.service";

interface BookingRequestModalProps {
  listing: VebaListing | null;
  onClose: () => void;
  onSubmitted?: (requestUid: string) => void;
}

export function BookingRequestModal({ listing, onClose, onSubmitted }: BookingRequestModalProps) {
  const { state: authState } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const requestMutation = useGuardedMutation(
    "can_book_asset",
    (payload: CreateBookingRequest) => createBookingRequest(payload),
  );

  if (!listing) return null;

  const reset = () => {
    setStartDate("");
    setEndDate("");
    setNotes("");
    setValidationError(null);
    requestMutation.reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    setValidationError(null);
    if (!startDate || !endDate) {
      setValidationError("Both start and end dates are required.");
      return;
    }
    if (endDate < startDate) {
      setValidationError("End date must not be before the start date.");
      return;
    }
    if (!authState.accountUid || !authState.accountRoot) {
      setValidationError("Missing account context.");
      return;
    }
    const payload: CreateBookingRequest = {
      listing_uid:    listing.listing_uid,
      requester_uid:  authState.accountUid,
      requester_root: authState.accountRoot,
      start_date:     startDate,
      end_date:       endDate,
      notes:          notes.trim() || null,
    };
    try {
      const res = await requestMutation.mutate(payload) as { request_uid?: string } | undefined;
      onSubmitted?.(res?.request_uid ?? "");
      handleClose();
    } catch {
      // requestMutation.error renders in the footer
    }
  };

  const displayError = validationError ?? (requestMutation.error ? requestMutation.error.message : null);
  const title = listing.asset_summary?.display_name ?? listing.asset_uid;
  const rateText = `${listing.currency} ${listing.daily_rate.toLocaleString()} / day`;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/45 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#F8F9FA] border-b border-[#E9EDEF] px-4 py-3">
          <div className="text-[11px] text-[#667781] uppercase tracking-wide">Request booking</div>
          <div className="font-extrabold text-[14px] text-[#111B21] truncate" title={title}>{title}</div>
          <div className="text-[12px] text-[#128C7E] font-extrabold mt-0.5">{rateText}</div>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[#667781]">Start *</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={requestMutation.isRunning}
                className="px-2 py-1.5 text-[13px] border border-[#E9EDEF] rounded-md outline-none focus:border-[#128C7E]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[#667781]">End *</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={requestMutation.isRunning}
                className="px-2 py-1.5 text-[13px] border border-[#E9EDEF] rounded-md outline-none focus:border-[#128C7E]"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-[#667781]">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Pickup details, deployment context, anything the owner should know."
              disabled={requestMutation.isRunning}
              className="px-2 py-1.5 text-[13px] border border-[#E9EDEF] rounded-md outline-none focus:border-[#128C7E] resize-y"
            />
          </label>
          <p className="text-[11px] text-[#667781]">
            The rate above is captured on this request. Future rate changes by the owner will not affect it.
          </p>
        </div>

        <div className="bg-[#F8F9FA] border-t border-[#E9EDEF] px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-[12px] text-[#B00020] min-h-[1em] flex-1">{displayError}</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={requestMutation.isRunning}
              className="px-3 py-1.5 text-[12px] font-medium rounded-md border border-[#E9EDEF] bg-white text-[#111B21] hover:bg-[#F0F2F5] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <GuardedButton
              permission="can_book_asset"
              onClick={handleSubmit}
              disabled={requestMutation.isRunning}
              className="px-3 py-1.5 text-[12px] font-extrabold rounded-md bg-[#128C7E] text-white hover:bg-[#0D7466] cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {requestMutation.isRunning ? "Sending..." : "Send request"}
            </GuardedButton>
          </div>
        </div>
      </div>
    </div>
  );
}
