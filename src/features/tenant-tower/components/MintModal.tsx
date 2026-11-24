import React, { useState } from "react";
import { mintTokens } from "../../../api";

interface Props {
  open: boolean;
  onClose: () => void;
  tenantId: string | null;
  tenantName: string;
}

export function MintModal({ open, onClose, tenantId, tenantName }: Props) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ approval_id: string } | null>(null);

  if (!open) return null;

  function reset() {
    setAmount("");
    setReason("");
    setError(null);
    setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!tenantId) return;
    const num = Number(amount);
    if (!num || num <= 0) { setError("Enter a positive token amount"); return; }
    if (!reason.trim()) { setError("A reason is required for HIC audit trail"); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await mintTokens({ tenant_id: tenantId, amount: num, reason: reason.trim() });
      setResult({ approval_id: res.data.approval_id });
    } catch (e: any) {
      setError(e?.message ?? "Mint request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={handleClose}>
      <div className="bg-white rounded-xl shadow-xl w-[440px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E9EDEF]">
          <div className="flex items-center gap-2">
            <span className="font-black text-[14px] text-[#111B21]">Mint Tokens</span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#EF4444] text-white">HIC Required</span>
          </div>
          <button onClick={handleClose} className="text-[11px] text-[#667781] bg-[#F0F2F5] border border-[#E9EDEF] rounded-lg px-3 py-1.5 cursor-pointer font-black hover:bg-[#E9EDEF]">Close</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {/* Warning banner */}
          <div className="bg-[#FEF3C7] border border-[#F59E0B] rounded-lg p-3 mb-4 text-[11px] text-[#92400E]">
            <span className="font-black">Human-In-Command:</span> Minting creates new tokens into the system. This request will be queued for approval before tokens are issued.
          </div>

          <div className="text-[12px] text-[#667781] mb-3">
            Mint new tokens for <span className="font-black text-[#111B21]">{tenantName}</span>
          </div>

          {result ? (
            <div className="bg-[#FEF3C7] border border-[#F59E0B] rounded-xl p-4 text-center">
              <div className="text-[14px] font-black text-[#92400E]">Mint Request Submitted</div>
              <div className="text-[12px] text-[#667781] mt-1">
                Approval ID: <span className="font-mono font-black text-[#111B21]">{result.approval_id}</span>
              </div>
              <div className="text-[11px] text-[#667781] mt-1">Pending HIC approval in the Approvals Queue</div>
              <button onClick={handleClose} className="mt-3 h-8 px-4 rounded-full text-[11px] font-black bg-[#F59E0B] text-white border-none cursor-pointer">Done</button>
            </div>
          ) : (
            <>
              <div className="mb-3">
                <label className="text-[10px] font-black text-[#667781] block mb-1">Amount (tokens to mint)</label>
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-[#F8FAFC] px-3 text-[12px] font-black text-[#111B21] outline-none focus:border-[var(--brand)]"
                />
              </div>

              <div className="mb-3">
                <label className="text-[10px] font-black text-[#667781] block mb-1">Reason (required for audit)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Dispute credit for TXN-2026-1234, or Monthly quota replenishment"
                  rows={3}
                  className="w-full rounded-lg border border-[#E9EDEF] bg-[#F8FAFC] px-3 py-2 text-[12px] font-black text-[#111B21] outline-none focus:border-[var(--brand)] resize-none"
                />
              </div>

              {error && <div className="text-[11px] text-[#EF4444] font-black mb-2">{error}</div>}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="h-8 px-4 rounded-full text-[11px] font-black bg-[#F97316] text-white border-none cursor-pointer disabled:opacity-50"
              >
                {loading ? "Submitting…" : "Submit Mint Request (HIC)"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
