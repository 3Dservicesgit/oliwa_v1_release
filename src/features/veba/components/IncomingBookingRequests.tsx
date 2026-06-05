/**
 * IncomingBookingRequests — Owner-facing view of booking requests TO the
 * current tenant (direction=incoming). Allows approving / rejecting pending
 * requests and marking approved requests as fulfilled.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  getBookingRequests,
  approveBookingRequest,
  rejectBookingRequest,
  fulfillBookingRequest,
} from "../../../api/services/veba.service";
import { useAuth } from "../../../auth/AuthContext";
import { useGuardedMutation, GuardedButton } from "../../../auth/guards";
import type { BookingRequest, BookingRequestStatus } from "../../../api/types";

const STATUS_STYLES: Record<BookingRequestStatus, { bg: string; fg: string; label: string }> = {
  pending:   { bg: "#FFF4E5", fg: "#9A6700", label: "Pending" },
  approved:  { bg: "#E9F7F4", fg: "#075E54", label: "Approved" },
  rejected:  { bg: "#F0F2F5", fg: "#667781", label: "Rejected" },
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

export function IncomingBookingRequests() {
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
        params: { direction: "incoming" },
      });
      setRequests(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load booking requests.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [authState.accountRoot]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const approveMut = useGuardedMutation(
    "can_approve_booking_request",
    (uid: string) => approveBookingRequest(uid),
  );
  const rejectMut = useGuardedMutation(
    "can_reject_booking_request",
    (uid: string) => rejectBookingRequest(uid),
  );
  const fulfillMut = useGuardedMutation(
    "can_approve_booking_request",
    (uid: string) => fulfillBookingRequest(uid),
  );

  const run = async (mutation: typeof approveMut, uid: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setPendingUid(uid);
    try {
      await mutation.mutate(uid);
      await fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setPendingUid(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 flex items-center justify-center gap-3">
        <div className="w-5 h-5 border-[3px] border-[#128C7E] border-t-transparent rounded-full animate-spin" />
        <span className="text-[12px] text-[#667781]">Loading incoming booking requests...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-[#FFD6D6] rounded-xl p-6 text-[12px] text-[#B00020]">
        Could not load booking requests: {error}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 text-center">
        <div className="text-[16px] font-extrabold text-[#111B21] mb-1">No booking requests yet</div>
        <p className="text-[12px] text-[#667781]">When marketplace buyers request bookings on your listed assets, they will appear here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E9EDEF] flex items-center justify-between">
        <div>
          <h2 className="font-extrabold text-[13px] text-[#111B21]">Incoming Booking Requests</h2>
          <p className="text-[11px] text-[#667781]">
            {requests.length} request{requests.length === 1 ? "" : "s"} from marketplace buyers
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
              <th className="text-left font-extrabold text-[#667781] px-3 py-2">Requester</th>
              <th className="text-left font-extrabold text-[#667781] px-3 py-2">Dates</th>
              <th className="text-left font-extrabold text-[#667781] px-3 py-2">Rate</th>
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
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-[#111B21] truncate max-w-[140px]">{r.requester_uid}</div>
                    <div className="text-[11px] text-[#667781]">{r.requester_root}</div>
                  </td>
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
                        <>
                          <GuardedButton
                            permission="can_approve_booking_request"
                            onClick={() => run(approveMut, r.request_uid)}
                            disabled={isPending}
                            className="px-2 py-1 text-[11px] font-extrabold rounded-md bg-[#128C7E] text-white hover:bg-[#0D7466] border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isPending ? "..." : "Approve"}
                          </GuardedButton>
                          <GuardedButton
                            permission="can_reject_booking_request"
                            onClick={() => run(rejectMut, r.request_uid, "Reject this booking request?")}
                            disabled={isPending}
                            className="px-2 py-1 text-[11px] font-extrabold rounded-md border border-[#FFD6D6] bg-white text-[#B00020] hover:bg-[#FFF5F5] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isPending ? "..." : "Reject"}
                          </GuardedButton>
                        </>
                      )}
                      {r.status === "approved" && (
                        <GuardedButton
                          permission="can_approve_booking_request"
                          onClick={() => run(fulfillMut, r.request_uid, "Mark this booking as fulfilled?")}
                          disabled={isPending}
                          className="px-2 py-1 text-[11px] font-extrabold rounded-md bg-[#1E40AF] text-white hover:bg-[#1E3A8A] border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isPending ? "..." : "Fulfill"}
                        </GuardedButton>
                      )}
                      {r.notes && (
                        <span className="text-[10px] text-[#667781] italic max-w-[120px] truncate" title={r.notes}>
                          {r.notes}
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
