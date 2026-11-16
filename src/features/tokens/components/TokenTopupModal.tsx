/**
 * TokenTopupModal — Top-Up Tokens via Mobile Money + ePayment
 *
 * Rebuilt to exactly match the screenshot:
 *   Header:       Title + HITL badge + close X
 *   Left column:  Amount (UGX) + currency ▾ + quick presets (6 buttons) + token package + budget slider
 *   Right column: Choose channel — each provider with name, success rate, OK/WARN badge
 *   Footer:       HITL note + Cancel + Pay & Mint
 *
 * All styles: Tailwind utility classes only.
 */
import React, { useState } from "react";

interface PayChannel {
  id:      string;
  name:    string;
  success: string;
  status:  "OK" | "WARN";
}

interface TokenTopupModalProps {
  open:      boolean;
  onClose:   () => void;
  onSubmit?: (data: { amountUgx: number; channel: string }) => void;
}

const CHANNELS: PayChannel[] = [
  { id: "mtn",     name: "MTN MoMo (UG)",    success: "98.1% success", status: "OK"   },
  { id: "airtel",  name: "Airtel Money (UG)", success: "96.2% success", status: "WARN" },
  { id: "airtelk", name: "Airtel Money (KE)", success: "97.4% success", status: "OK"   },
  { id: "mpesa",   name: "M-Pesa (KE)",       success: "99.0% success", status: "OK"   },
  { id: "cards",   name: "Cards (Pesapal/DPO)",success:"94.6% success", status: "WARN" },
];

const PRESETS = [
  { id: "100k", label: "UGX 100k",  value: 100000  },
  { id: "500k", label: "UGX 500k",  value: 500000  },
  { id: "1m",   label: "UGX 1M",    value: 1000000 },
  { id: "50ke", label: "KES 50k",   value: 0       },
  { id: "usd",  label: "USD 100",   value: 0       },
  { id: "cust", label: "Custom",    value: 0       },
];

const TOKEN_PACKAGES: Record<number, string> = {
  100000:  "Bundle: 'Starter' — 10,000 T (FIFO)",
  500000:  "Bundle: 'Growth' — 55,000 T (FIFO)",
  1000000: "Bundle: 'Ops Pro' — 250,000 T (FIFO)",
  2500000: "Bundle: 'Ops Pro' — 250,000 T (FIFO)",
};

const statusBadge: Record<string, string> = {
  OK:   "bg-[#25D366] text-white",
  WARN: "bg-[#F97316] text-white",
};

export function TokenTopupModal({ open, onClose, onSubmit }: TokenTopupModalProps) {
  const [amount,  setAmount]  = useState("2,500,000");
  const [channel, setChannel] = useState("mtn");
  const [budget,  setBudget]  = useState(60);
  const [busy,    setBusy]    = useState(false);

  if (!open) return null;

  const rawAmount = parseInt(amount.replace(/,/g, ""), 10) || 0;
  const packageLabel = TOKEN_PACKAGES[rawAmount] ?? "Bundle: 'Custom' — calculated on checkout";

  const handleConfirm = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 500));
    onSubmit?.({ amountUgx: rawAmount, channel });
    setBusy(false);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/45 flex items-center justify-center z-[9999] p-4"
    >
      <div className="w-full max-w-[740px] bg-white rounded-2xl border border-[#E9EDEF] shadow-[0_18px_60px_rgba(0,0,0,0.22)] flex flex-col overflow-hidden max-h-[calc(100dvh-32px)]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E9EDEF] shrink-0">
          <h2 className="font-black text-[16px] text-[#111B21]">
            Top-Up Tokens — Mobile Money + ePayment
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-extrabold bg-[#34B7F1] text-white px-3 py-1 rounded-full shrink-0">
              HITL
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-lg border border-[#E9EDEF] bg-white text-[#667781] hover:bg-[#F0F2F5] transition-colors grid place-items-center cursor-pointer text-[14px]"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body: two columns */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-[#E9EDEF]">

          {/* LEFT */}
          <div className="flex flex-col gap-5 px-5 py-5">

            {/* Amount + currency */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-[#667781]">Amount</label>
              <div className="flex gap-2">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 min-w-0 h-11 rounded-xl border border-[#E9EDEF] bg-white px-4 text-[16px] font-extrabold text-[#111B21] outline-none focus:border-[var(--brand)] transition-colors"
                />
                <button className="h-11 px-4 rounded-xl border border-[#E9EDEF] bg-[#F8F9FA] text-[13px] font-extrabold text-[#111B21] cursor-pointer hover:bg-[#F0F2F5] transition-colors whitespace-nowrap">
                  Currency ▾
                </button>
              </div>
            </div>

            {/* Quick presets */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-[#667781]">Quick presets</label>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => p.value && setAmount(p.value.toLocaleString())}
                    className="h-10 rounded-xl border border-[#E9EDEF] bg-[#F8F9FA] text-[12px] font-extrabold text-[#111B21] cursor-pointer hover:bg-[var(--brand-soft)] hover:border-[#C2E8E1] transition-all"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Token package */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-[#667781]">Token package</label>
              <div className="h-11 rounded-xl border border-[#E9EDEF] bg-[#F8F9FA] px-4 flex items-center text-[12px] font-extrabold text-[#111B21] truncate">
                {packageLabel}
              </div>
            </div>

            {/* Budget slider */}
            <div className="flex flex-col gap-2">
              <label className="text-[11px] text-[#667781]">Budget slider</label>
              <input
                type="range"
                min={0}
                max={100}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full h-2 rounded-full cursor-pointer appearance-none"
                style={{
                  background: `linear-gradient(to right, #25D366 ${budget}%, #E9EDEF ${budget}%)`,
                  accentColor: "#25D366",
                }}
              />
              <div className="text-[11px] text-[#667781]">
                Auto-caps: 80% soft alert • 95% hard lock (configurable)
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex flex-col gap-3 px-5 py-5">
            <label className="text-[11px] text-[#667781]">Choose channel</label>
            <div className="flex flex-col gap-2">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setChannel(ch.id)}
                  className={`
                    flex items-center justify-between gap-3 h-[60px] rounded-xl border px-4
                    cursor-pointer transition-all text-left w-full
                    ${channel === ch.id
                      ? "border-[var(--brand)] bg-[#E9F7F4]"
                      : "border-[#E9EDEF] bg-white hover:bg-[#F8F9FA]"
                    }
                  `}
                >
                  <div className="min-w-0">
                    <div className="font-extrabold text-[13px] text-[#111B21] leading-tight">{ch.name}</div>
                    <div className="text-[11px] text-[#667781] mt-0.5">{ch.success}</div>
                  </div>
                  <span className={`shrink-0 text-[11px] font-extrabold px-2.5 py-1 rounded-full ${statusBadge[ch.status]}`}>
                    {ch.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-t border-[#E9EDEF] shrink-0 flex-wrap">
          <span className="text-[11px] text-[#667781]">
            Note: Large top-ups &gt; UGX 5M require HITL approval (anti-fraud).
          </span>
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="h-10 px-5 rounded-xl border border-[#E9EDEF] bg-white text-[12px] font-extrabold text-[#111B21] cursor-pointer hover:bg-[#F0F2F5] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={busy}
              className="h-10 px-6 rounded-xl border-none bg-[var(--accent)] text-[var(--on-accent)] text-[13px] font-black cursor-pointer hover:brightness-105 active:opacity-85 transition-all disabled:opacity-50"
            >
              {busy ? "Processing…" : "Pay & Mint"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
