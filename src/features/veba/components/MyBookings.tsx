/**
 * MyBookings — Requester-facing view of outgoing booking requests
 * (direction=outgoing). Shows the status of every request the current
 * tenant has submitted, with the ability to cancel pending ones.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  getBookingRequests,
  cancelBookingRequest,
} from "../../../api/services/veba.service";
import { useAuth } from "../../../auth/AuthContext";
import { useGuardedMutation, GuardedButton } from "../../../auth/guards";
import type { BookingRequest, BookingRequestStatus } from "../../../api/types";

const STATUS_STYLES: Record<BookingRequestStatus, { bg: string; fg: string; label: string }> = {
  pending:   { bg: "#FFF4E5", fg: "#9A6700", label: "Pending" },
  approved:  { bg: "#E9F7F4", fg: "#075E54", label: "Approved" },
  rejected:  { bg: "#FEE2E2", fg: "#B00020", label: "Rejected" },
  cancelled: { bg: "#F0F2F5", fg: "#667781", label: "Cancelled" },
  fulfilled: { bg: "#DBEAFE", fg: "#1E40AF", label: "Fulfilled" },
};

function StatusPill({ status }: { status: BookingRequestStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span
      className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

export function MyBookings() {
  const { state: authState } = useAuth();
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [pendingUid, setPendingUid] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!authState.accountRoot) { setRequests([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await getBookingRequests(authState.accountRoot, {
        params: { direction: "outgoing" },
      });
      setRequests(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your bookings.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [authState.accountRoot]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const cancelMut = useGuardedMutation(
    "can_book_asset",
    (uid: string) => cancelBookingRequest(uid),
  );

  const handleCancel = async (uid: string) => {
    if (!window.confirm("Cancel this booking request?")) return;
    setPendingUid(uid);
    try {
      await cancelMut.mutate(uid);
      await fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed.");
    } finally {
      setPendingUid(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 flex items-center justify-center gap-3">
        <div className="w-5 h-5 border-[3px] border-[#128C7E] border-t-transparent rounded-full animate-spin" />
        <span className="text-[12px] text-[#667781]">Loading your bookings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-[#FFD6D6] rounded-xl p-6 text-[12px] text-[#B00020]">
        Could not load bookings: {error}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 text-center">
        <div className="text-[16px] font-extrabold text-[#111B21] mb-1">No bookings yet</div>
        <p className="text-[12px] text-[#667781]">
          Browse the Marketplace tab and click "Request booking" on any listing to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E9EDEF] flex items-center justify-between">
        <div>
          <h2 className="font-extrabold text-[13px] text-[#111B21]">My Bookings</h2>
          <p className="text-[11px] text-[#667781]">
            {requests.length} booking request{requests.length === 1 ? "" : "s"} submitted
          </p>
        </div>
        <button
          type="button"
          onClick={fetchRequests}
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
              <th className="text-left font-extrabold text-[#667781] px-3 py-2">Dates</th>
              <th className="text-left font-extrabold text-[#667781] px-3 py-2">Rate snapshot</th>
              <th className="text-left font-extrabold text-[#667781] px-3 py-2">Status</th>
              <th className="text-right font-extrabold text-[#667781] px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const isPending = pendingUid === r.request_uid;
              const rate = r.rate_snapshot;
              return (
                <tr key={r.request_uid} className="border-b border-[#E9EDEF] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                  <td className="px-3 py-2.5">
                    <div className="font-extrabold text-[#111B21] truncate max-w-[180px]">{r.asset_uid}</div>
                    <div className="text-[11px] text-[#667781] truncate">{r.listing_uid}</div>
                  </td>
                  <td className="px-3 py-2.5 text-[#667781]">{r.owner_root}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-[#667781]">
                    {r.start_date} → {r.end_date}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {rate.currency} {rate.daily_rate.toLocaleString()} / {rate.pricing_basis.replace("per_", "")}
                  </td>
                  <td className="px-3 py-2.5"><StatusPill status={r.status} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1.5 justify-end">
                      {r.status === "pending" && (
                        <GuardedButton
                          permission="can_book_asset"
                          onClick={() => handleCancel(r.request_uid)}
                          disabled={isPending}
                          className="px-2 py-1 text-[11px] font-extrabold rounded-md border border-[#FFD6D6] bg-white text-[#B00020] hover:bg-[#FFF5F5] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isPending ? "..." : "Cancel"}
                        </GuardedButton>
                      )}
                      {r.status !== "pending" && (
                        <span className="text-[11px] text-[#667781]">
                          {r.status === "approved" ? "Awaiting fulfillment" :
                           r.status === "fulfilled" ? "Completed" :
                           r.status === "rejected" ? "Owner declined" : "You cancelled"}
                        </span>
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
  );
}
