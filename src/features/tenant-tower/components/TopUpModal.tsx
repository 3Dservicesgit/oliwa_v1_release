import React, { useState, useEffect, useRef } from "react";
import { buyTokens, getAllTokens, getPaymentStatus } from "../../../api";
import type { TokenPackage } from "../../../api";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUid: string | null;
  clientName: string;
  tokenUid: string | null;
  tokenName: string;
  onSuccess: () => void;
}

type Step = "form" | "waiting" | "result";

const POLL_INTERVAL = 5_000;   // 5 seconds
const POLL_TIMEOUT  = 120_000; // 2 minutes

/** Convert hours to a human-readable string (e.g. 720 → "30 days"). */
function fmtValidity(hours: number | null | undefined): string {
  if (hours == null) return "Validity not set";
  if (hours >= 8760) return `${Math.round(hours / 8760)} year${hours >= 17520 ? "s" : ""}`;
  if (hours >= 720)  return `${Math.round(hours / 24)} days`;
  return `${hours} hours`;
}

/** Payment states the gateway reports that mean the payment will not complete. */
const FAILED_STATES = new Set(["failed", "cancelled", "canceled", "declined", "rejected", "expired"]);

/** "12,000 UGX", or "Price not set" when the package has no price yet. */
function fmtPrice(amount: number | null | undefined, currency: string | null | undefined): string {
  return amount == null ? "Price not set" : `${amount.toLocaleString()} ${currency ?? ""}`.trim();
}

/** Phone placeholder based on currency. */
function phonePlaceholder(currency: string): string {
  if (currency === "KES") return "e.g. 254712345678";
  if (currency === "UGX") return "e.g. 256770123456";
  return "e.g. 254712345678";
}

export function TopUpModal({ open, onClose, clientUid, clientName, tokenUid, tokenName, onSuccess }: Props) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep]               = useState<Step>("form");
  const [packages, setPackages]       = useState<TokenPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<TokenPackage | null>(null);
  const [quantity, setQuantity]       = useState("1");
  const [phone, setPhone]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [resultStatus, setResultStatus] = useState<"success" | "failed" | "timeout" | null>(null);

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const txnIdRef = useRef<string | null>(null);

  // ── Fetch token packages on open ──────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    getAllTokens()
      .then((res) => {
        setPackages(res.data);
        // Pre-select if parent passed a tokenUid
        if (tokenUid) {
          const match = res.data.find((p) => p.token_id === tokenUid);
          if (match) setSelectedPkg(match);
        }
      })
      .catch(() => {});
  }, [open, tokenUid]);

  // ── Cleanup polling on unmount / close ────────────────────────────────────
  useEffect(() => {
    return () => stopPolling();
  }, []);

  function stopPolling() {
    if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current = null; }
    if (timerRef.current) { clearTimeout(timerRef.current);  timerRef.current = null; }
  }

  function reset() {
    stopPolling();
    setStep("form");
    setQuantity("1");
    setPhone("");
    setError(null);
    setResultStatus(null);
    setSelectedPkg(null);
    txnIdRef.current = null;
  }

  function handleClose() {
    reset();
    onClose();
  }

  // ── Step 1: Submit purchase ───────────────────────────────────────────────
  async function handleSubmit() {
    if (!clientUid) return;
    if (!selectedPkg)     { setError("Select a token package"); return; }
    if (selectedPkg.token_amount == null) { setError("This package has no price yet. Choose another package."); return; }
    const qty = Number(quantity);
    if (!qty || qty <= 0) { setError("Enter a valid quantity"); return; }
    if (!phone.trim())    { setError("Enter a Mobile Money number"); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await buyTokens({
        token_buyer:         clientUid,
        token_uid:           selectedPkg.token_id,
        mobile_money_number: phone.trim(),
        token_quantity:      qty,
      });
      // The server returns transaction_uid (older builds: transaction_id).
      const txnId = res.data?.transaction_uid ?? res.data?.transaction_id ?? null;
      if (!txnId) {
        setError("The payment request was sent, but no payment reference came back. Check the client's payments before trying again.");
        return;
      }
      txnIdRef.current = txnId;
      setStep("waiting");
      startPolling();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Token purchase failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Poll for payment confirmation ─────────────────────────────────
  function startPolling() {
    if (!txnIdRef.current) return;

    // Timeout after 2 minutes
    timerRef.current = setTimeout(() => {
      stopPolling();
      setResultStatus("timeout");
      setStep("result");
    }, POLL_TIMEOUT);

    pollRef.current = setInterval(async () => {
      try {
        const res = await getPaymentStatus(txnIdRef.current!);
        const status = (res.data?.transaction_status ?? "").toLowerCase();

        if (status === "successful") {
          stopPolling();
          setResultStatus("success");
          setStep("result");
          onSuccess();
        } else if (FAILED_STATES.has(status)) {
          stopPolling();
          setResultStatus("failed");
          setStep("result");
        }
        // "pending" → keep polling
      } catch {
        // Network blip — keep polling
      }
    }, POLL_INTERVAL);
  }

  function handleRetry() {
    setResultStatus(null);
    setStep("form");
  }

  if (!open) return null;

  const qty      = Math.max(Number(quantity) || 0, 0);
  const total    = selectedPkg?.token_amount != null ? selectedPkg.token_amount * qty : null;
  const currency = selectedPkg?.token_currency ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={handleClose}>
      <div className="bg-white rounded-xl shadow-xl w-120 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E9EDEF]">
          <span className="font-black text-[14px] text-[#111B21]">Buy Tokens</span>
          <button onClick={handleClose} className="text-[11px] text-[#667781] bg-[#F0F2F5] border border-[#E9EDEF] rounded-lg px-3 py-1.5 cursor-pointer font-black hover:bg-[#E9EDEF]">Close</button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="px-5 py-4">
          <div className="text-[12px] text-[#667781] mb-3">
            Buy tokens for <span className="font-black text-[#111B21]">{clientName}</span>
            {tokenName && <> — <span className="font-black text-[#128C7E]">{tokenName}</span></>}
          </div>

          {/* ─── STEP 1: Form ─────────────────────────────────────────────── */}
          {step === "form" && (
            <>
              {/* Token packages */}
              <div className="mb-3">
                <label className="text-[10px] font-black text-[#667781] block mb-1.5">Select Token Package</label>
                {packages.length === 0 ? (
                  <div className="text-[11px] text-[#667781]">Loading packages…</div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {packages.map((pkg) => (
                      <button
                        key={pkg.token_id}
                        onClick={() => setSelectedPkg(pkg)}
                        className={`
                          flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border text-left w-full
                          cursor-pointer transition-all
                          ${selectedPkg?.token_id === pkg.token_id
                            ? "border-[#128C7E] bg-[#E9F7F4]"
                            : "border-[#E9EDEF] bg-[#F8FAFC] hover:bg-[#F0F2F5]"
                          }
                        `}
                      >
                        <div className="min-w-0">
                          <div className="font-black text-[12px] text-[#111B21] leading-tight">{pkg.token_name}</div>
                          <div className="text-[10px] text-[#667781] mt-0.5">
                            {fmtValidity(pkg.token_validity)} • {pkg.token_type}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-black text-[12px] text-[#111B21]">
                            {fmtPrice(pkg.token_amount, pkg.token_currency)}
                          </div>
                          <div className="text-[10px] text-[#667781]">per unit</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="mb-3">
                <label className="text-[10px] font-black text-[#667781] block mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 2"
                  className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-[#F8FAFC] px-3 text-[12px] font-black text-[#111B21] outline-none focus:border-[#128C7E]"
                />
              </div>

              {/* Mobile Money Number */}
              <div className="mb-3">
                <label className="text-[10px] font-black text-[#667781] block mb-1">Mobile Money Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={phonePlaceholder(currency)}
                  className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-[#F8FAFC] px-3 text-[12px] font-black text-[#111B21] outline-none focus:border-[#128C7E]"
                />
              </div>

              {/* Total */}
              {selectedPkg && qty > 0 && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E9EDEF]">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#667781]">Total</span>
                    <span className="font-black text-[#111B21]">{total == null ? "—" : `${total.toLocaleString()} ${currency}`}</span>
                  </div>
                  <div className="text-[10px] text-[#667781] mt-0.5">
                    {fmtPrice(selectedPkg.token_amount, selectedPkg.token_currency)} × {qty} unit{qty > 1 ? "s" : ""}
                  </div>
                </div>
              )}

              {error && <div className="text-[11px] text-[#EF4444] font-black mb-2">{error}</div>}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="h-8 px-4 rounded-full text-[11px] font-black bg-[#128C7E] text-white border-none cursor-pointer disabled:opacity-50"
              >
                {loading ? "Processing…" : "Confirm Purchase"}
              </button>
            </>
          )}

          {/* ─── STEP 2: Waiting for MoMo PIN ────────────────────────────── */}
          {step === "waiting" && (
            <div className="py-6 text-center">
              {/* Pulse animation */}
              <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-[#FEF3C7] flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-[#F59E0B] animate-pulse" />
              </div>
              <div className="font-black text-[14px] text-[#111B21]">Payment Processing</div>
              <div className="text-[12px] text-[#667781] mt-1">Enter your MoMo PIN on your phone to confirm</div>
              <div className="text-[10px] text-[#667781] mt-3">
                Waiting for confirmation… This may take up to 2 minutes.
              </div>
              <button
                onClick={handleClose}
                className="mt-4 h-7 px-4 rounded-full text-[10px] font-black text-[#667781] border border-[#E9EDEF] bg-white cursor-pointer hover:bg-[#F0F2F5]"
              >
                Cancel
              </button>
            </div>
          )}

          {/* ─── STEP 3: Result ───────────────────────────────────────────── */}
          {step === "result" && resultStatus === "success" && (
            <div className="bg-[#EAF7F3] border border-[#25D366] rounded-xl p-4 text-center">
              <div className="text-[14px] font-black text-[#128C7E]">Purchase Successful</div>
              <div className="text-[12px] text-[#667781] mt-1">
                {selectedPkg?.token_name} × {quantity} purchased via Mobile Money
              </div>
              {selectedPkg && (
                <div className="text-[12px] text-[#667781] mt-0.5">
                  Total: <span className="font-black text-[#111B21]">{total == null ? "—" : `${total.toLocaleString()} ${currency}`}</span>
                </div>
              )}
              <button onClick={handleClose} className="mt-3 h-8 px-4 rounded-full text-[11px] font-black bg-[#128C7E] text-white border-none cursor-pointer">Done</button>
            </div>
          )}

          {step === "result" && resultStatus === "failed" && (
            <div className="bg-[#FEF2F2] border border-[#EF4444] rounded-xl p-4 text-center">
              <div className="text-[14px] font-black text-[#EF4444]">Payment Failed</div>
              <div className="text-[12px] text-[#667781] mt-1">
                The payment was not completed. Please check your MoMo account and try again.
              </div>
              <div className="flex gap-2 justify-center mt-3">
                <button onClick={handleRetry} className="h-8 px-4 rounded-full text-[11px] font-black bg-[#128C7E] text-white border-none cursor-pointer">Try Again</button>
                <button onClick={handleClose} className="h-8 px-4 rounded-full text-[11px] font-black text-[#667781] border border-[#E9EDEF] bg-white cursor-pointer hover:bg-[#F0F2F5]">Close</button>
              </div>
            </div>
          )}

          {step === "result" && resultStatus === "timeout" && (
            <div className="bg-[#FEF3C7] border border-[#F59E0B] rounded-xl p-4 text-center">
              <div className="text-[14px] font-black text-[#92400E]">Payment Timeout</div>
              <div className="text-[12px] text-[#667781] mt-1">
                We did not receive a payment confirmation in time. The payment may still process — check your transaction history.
              </div>
              <div className="flex gap-2 justify-center mt-3">
                <button onClick={handleRetry} className="h-8 px-4 rounded-full text-[11px] font-black bg-[#128C7E] text-white border-none cursor-pointer">Try Again</button>
                <button onClick={handleClose} className="h-8 px-4 rounded-full text-[11px] font-black text-[#667781] border border-[#E9EDEF] bg-white cursor-pointer hover:bg-[#F0F2F5]">Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
