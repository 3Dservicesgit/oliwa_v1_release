/**
 * SimPage → Signal Vault — Token Subscriptions & Device Billing
 *
 * Customer-facing page for managing token-based device subscriptions.
 *
 * TABS:
 *   1. Token Balance   — Balance cards, hours left/used, low-balance warnings
 *   2. Buy Tokens      — Browse packages, purchase via Mobile Money
 *   3. Subscriptions   — Device subscription table with pause/restore
 *   4. Transactions    — Payment history log
 *
 * SECURITY — Customer isolation:
 *   • ownerUid is ALWAYS the logged-in user's accountUid from AuthContext
 *     (or the _nvxs_account_uid cookie). Never from URL or user input.
 *   • Balance: GET /tokens/{ownerUid}/balance — only the customer's wallet.
 *   • Purchase: origin = ownerUid — purchase tagged to logged-in customer.
 *   • Devices: GET /devices/configured/{ownerUid}/client — only their devices.
 *   • Transactions: GET /payments/transactions/{ownerUid}/list — their history only.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getCookie } from "../../utils/cookies";
import {
  getAllTokens,
  getClientBalance,
  getClientDevices,
  buyTokens,
  getBudgetOffer,
  pauseSubscription,
  restoreSubscription,
  getPaymentStatus,
} from "../../api/services/clients.service";
import { getClientTransactions } from "../../api/services/billing.service";
import type {
  TokenPackage,
  ClientTokenBalance,
  ClientDevice,
  ClientTransaction,
} from "../../api/types";

// ── Tabs ───────────────────────────────────────────────────────────────────

type Tab = "balance" | "buy" | "budget" | "subscriptions" | "transactions";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "balance",       label: "Token Balance",   icon: "💰" },
  { key: "buy",           label: "Buy Tokens",      icon: "🛒" },
  { key: "budget",        label: "Buy by Budget",   icon: "💵" },
  { key: "subscriptions", label: "Subscriptions",   icon: "📡" },
  { key: "transactions",  label: "Transactions",    icon: "📋" },
];

// ── Toast ──────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg border text-[13px] font-black flex items-center gap-3 ${
      type === "success"
        ? "bg-[#25D366]/10 border-[#25D366]/30 text-[#128C7E]"
        : "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]"
    }`}>
      <span>{message}</span>
      <button onClick={onClose} className="text-current opacity-60 hover:opacity-100 cursor-pointer border-none bg-transparent text-[14px]">✕</button>
    </div>
  );
}

// ── Confirm Dialog ─────────────────────────────────────────────────────────

function ConfirmDialog({
  title, message, confirmLabel, onConfirm, onCancel, isDestructive,
}: {
  title: string; message: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void; isDestructive?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl shadow-2xl border border-[#E9EDEF] w-[380px] p-5">
        <h3 className="font-black text-[15px] text-[#111B21] mb-2">{title}</h3>
        <p className="text-[13px] text-[#667781] mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="h-9 px-4 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[12px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} className={`h-9 px-4 rounded-lg border text-[12px] font-black text-white cursor-pointer transition-all ${
            isDestructive
              ? "bg-[#EF4444] border-[#EF4444] hover:bg-[#DC2626]"
              : "bg-[#128C7E] border-[#128C7E] hover:bg-[#0E7A6D]"
          }`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Payment Authorising Overlay ────────────────────────────────────────────

/** Full-screen preloader shown while we poll the payment status endpoint and
 *  wait for the customer to authorise the Mobile Money prompt on their phone. */
function PaymentAuthorizingOverlay({ amountLabel, phone }: { amountLabel?: string; phone?: string }) {
  return (
    <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E9EDEF] w-full max-w-[360px] p-6 flex flex-col items-center text-center gap-4">
        {/* Spinner */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-[#128C7E]/15" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#128C7E] animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-[22px]">📲</div>
        </div>

        <div>
          <h3 className="font-black text-[16px] text-[#111B21] mb-1.5">Authorise the Payment</h3>
          <p className="text-[12px] text-[#667781] leading-relaxed">
            A payment request{amountLabel ? <> for <span className="font-black text-[#128C7E]">{amountLabel}</span></> : null} has been sent
            {phone ? <> to <span className="font-black text-[#111B21]">{phone}</span></> : null}. Check your phone and enter your
            Mobile Money PIN to approve the transaction.
          </p>
        </div>

        <div className="w-full bg-[#F0F2F5] rounded-lg px-3 py-2.5 flex items-center gap-2.5">
          <span className="inline-block w-4 h-4 border-2 border-[#128C7E]/30 border-t-[#128C7E] rounded-full animate-spin shrink-0" />
          <span className="text-[11px] text-[#667781] font-black text-left">Waiting for confirmation… please keep this window open.</span>
        </div>
      </div>
    </div>
  );
}

/** Full-screen confirmation shown once the polled payment status comes back successful. */
function PaymentSuccessOverlay({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E9EDEF] w-full max-w-[360px] p-6 flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[#128C7E]/10 flex items-center justify-center">
          <span className="text-[#128C7E] text-[34px] leading-none">&#10003;</span>
        </div>
        <div>
          <h3 className="font-black text-[16px] text-[#111B21] mb-1.5">Payment Successful</h3>
          <p className="text-[12px] text-[#667781] leading-relaxed">{message}</p>
        </div>
        <button
          onClick={onDone}
          className="w-full h-10 rounded-lg bg-[#128C7E] text-white text-[13px] font-black cursor-pointer border-none hover:bg-[#0E7A6D] transition-all"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ── Balance Card ───────────────────────────────────────────────────────────

function BalanceCard({ b }: { b: ClientTokenBalance }) {
  const total = b.token_hours_left + b.token_hours_used;
  const pct = total > 0 ? (b.token_hours_left / total) * 100 : 0;
  const isLow = b.token_hours_left > 0 && b.token_hours_left <= 48;
  const isExpired = b.token_hours_left <= 0 && b.token_hours_used > 0;

  const barColor = isExpired
    ? "bg-[#EF4444]"
    : isLow
      ? "bg-[#F97316]"
      : "bg-[#128C7E]";

  const borderColor = isExpired
    ? "border-[#EF4444]/30"
    : isLow
      ? "border-[#F97316]/30"
      : "border-[#E9EDEF]";

  return (
    <div className={`bg-white border ${borderColor} rounded-xl p-4 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className="font-black text-[13px] text-[#111B21]">{b.token_name || "Token"}</span>
        {isExpired && (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30">
            EXPIRED
          </span>
        )}
        {isLow && !isExpired && (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/30">
            LOW
          </span>
        )}
        {!isLow && !isExpired && b.token_hours_left > 0 && (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#128C7E]/10 text-[#128C7E] border border-[#128C7E]/30">
            ACTIVE
          </span>
        )}
      </div>

      {/* Hours display */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-[#667781] font-black uppercase tracking-wide">Hours Left</div>
          <div className="text-[22px] font-black text-[#111B21] leading-tight">
            {b.token_hours_left.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#667781] font-black uppercase tracking-wide">Hours Used</div>
          <div className="text-[22px] font-black text-[#667781] leading-tight">
            {b.token_hours_used.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-2 w-full bg-[#F0F2F5] rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.max(pct, 1)}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-[#667781]">{pct.toFixed(0)}% remaining</span>
          <span className="text-[9px] text-[#667781]">{total.toLocaleString()} total hrs</span>
        </div>
      </div>

      {/* Warning */}
      {isLow && !isExpired && (
        <div className="bg-[#F97316]/8 border border-[#F97316]/20 rounded-lg px-3 py-2 text-[11px] text-[#F97316] font-black">
          ⚠ Less than 48 hours remaining — consider buying more tokens.
        </div>
      )}
      {isExpired && (
        <div className="bg-[#EF4444]/8 border border-[#EF4444]/20 rounded-lg px-3 py-2 text-[11px] text-[#EF4444] font-black">
          ⚠ Token expired — devices linked to this token are paused.
        </div>
      )}
    </div>
  );
}

// ── Package pricing helpers ────────────────────────────────────────────────

/** Price is defined at token level (legacy fallback: variant). */
function getPkgPrice(pkg: TokenPackage): number {
  return pkg.token_amount ?? pkg.variant?.billing_amount ?? 0;
}
function getPkgCurrency(pkg: TokenPackage): string {
  return pkg.token_currency || pkg.variant?.billing_currency || "—";
}
/** Billing unit — the metering unit a token is charged per (hour, event, km, mb, ...). */
function getPkgBillingUnit(pkg: TokenPackage): string {
  return pkg.billing_unit || "—";
}
/** "per hour", "per event", etc. */
function getPkgBillingUnitLabel(pkg: TokenPackage): string {
  return pkg.billing_unit ? `per ${pkg.billing_unit}` : "—";
}
function getPkgBillingTrigger(pkg: TokenPackage): string {
  return pkg.billing_trigger || "—";
}
function getPkgBillingScope(pkg: TokenPackage): string {
  return pkg.billing_scope || "—";
}

// ── Explorer "View" menu config for token packages ──────────────────────────
type PkgView = "xl" | "large" | "medium" | "small" | "list" | "details" | "tiles" | "content";

const PKG_VIEW_OPTIONS: { key: PkgView; label: string; glyph: string }[] = [
  { key: "xl",      label: "Extra large icons", glyph: "▦" },
  { key: "large",   label: "Large icons",       glyph: "▦" },
  { key: "medium",  label: "Medium icons",      glyph: "▧" },
  { key: "small",   label: "Small icons",       glyph: "▤" },
  { key: "list",    label: "List",              glyph: "≣" },
  { key: "details", label: "Details",           glyph: "☰" },
  { key: "tiles",   label: "Tiles",             glyph: "◨" },
  { key: "content", label: "Content",           glyph: "▭" },
];

const PKG_VIEW_GRID: Record<PkgView, string> = {
  xl:      "[grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]",
  large:   "[grid-template-columns:repeat(auto-fill,minmax(165px,1fr))]",
  medium:  "[grid-template-columns:repeat(auto-fill,minmax(130px,1fr))]",
  small:   "[grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]",
  list:    "[grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]",
  tiles:   "[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]",
  content: "grid-cols-1",
  details: "",
};

const PKG_ICON_SIZE: Record<PkgView, { box: string; text: string }> = {
  xl:      { box: "w-16 h-16", text: "text-[34px]" },
  large:   { box: "w-14 h-14", text: "text-[28px]" },
  medium:  { box: "w-11 h-11", text: "text-[22px]" },
  small:   { box: "w-8 h-8",   text: "text-[16px]" },
  list:    { box: "w-7 h-7",   text: "text-[14px]" },
  tiles:   { box: "w-12 h-12", text: "text-[24px]" },
  content: { box: "w-12 h-12", text: "text-[24px]" },
  details: { box: "w-9 h-9",   text: "text-[16px]" },
};

const PKG_TYPE_META: Record<string, { icon: string; tint: string; text: string }> = {
  time:        { icon: "⏱",  tint: "bg-[#128C7E]/10", text: "text-[#0E7A6D]" },
  parameter:   { icon: "⚙",  tint: "bg-[#34B7F1]/10", text: "text-[#1E88B5]" },
  event:       { icon: "⚡", tint: "bg-[#F97316]/10", text: "text-[#C2570B]" },
  volume:      { icon: "🛢", tint: "bg-[#3B82F6]/10", text: "text-[#2563EB]" },
  distance:    { icon: "📏", tint: "bg-[#8B5CF6]/10", text: "text-[#7C3AED]" },
  video:       { icon: "🎬", tint: "bg-[#EF4444]/10", text: "text-[#DC2626]" },
  conditional: { icon: "🔀", tint: "bg-[#F59E0B]/10", text: "text-[#B45309]" },
  action:      { icon: "⌘",  tint: "bg-[#0EA5E9]/10", text: "text-[#0284C7]" },
  compliance:  { icon: "📋", tint: "bg-[#10B981]/10", text: "text-[#059669]" },
};
function pkgMeta(type?: string) {
  return PKG_TYPE_META[(type || "").toLowerCase()] || { icon: "🎫", tint: "bg-[#E9EDEF]", text: "text-[#667781]" };
}

// ── Sorting (Explorer "Sort by" menu) ───────────────────────────────────────
const PKG_SORT_OPTIONS: { key: string; label: string }[] = [
  { key: "name",            label: "Name" },
  { key: "cost",            label: "Cost" },
  { key: "currency",        label: "Currency" },
  { key: "type",            label: "Type" },
  { key: "billing_unit",    label: "Billing Unit" },
  { key: "billing_trigger", label: "Billing Trigger" },
  { key: "billing_scope",   label: "Billing Scope" },
  { key: "product",         label: "Product" },
];

function pkgSortValue(pkg: TokenPackage, key: string): string | number {
  switch (key) {
    case "cost":            return getPkgPrice(pkg);
    case "currency":        return getPkgCurrency(pkg).toLowerCase();
    case "type":            return (pkg.token_type || "").toLowerCase();
    case "billing_unit":    return (pkg.billing_unit || "").toLowerCase();
    case "billing_trigger": return (pkg.billing_trigger || "").toLowerCase();
    case "billing_scope":   return (pkg.billing_scope || "").toLowerCase();
    case "product":         return (pkg.product?.product_name || "").toLowerCase();
    case "name":
    default:                return (pkg.token_name || "").toLowerCase();
  }
}

function sortPackages(list: TokenPackage[], key: string, dir: "asc" | "desc"): TokenPackage[] {
  const f = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    const av = pkgSortValue(a, key);
    const bv = pkgSortValue(b, key);
    if (av < bv) return -1 * f;
    if (av > bv) return 1 * f;
    return 0;
  });
}

// ── Token Package Card ─────────────────────────────────────────────────────

function PackageCard({
  pkg, onBuy,
}: {
  pkg: TokenPackage; onBuy: (pkg: TokenPackage) => void;
}) {
  const price = getPkgPrice(pkg);
  const currency = getPkgCurrency(pkg);
  const billingUnit = getPkgBillingUnit(pkg);
  const productName = pkg.product?.product_name;
  const trigger = pkg.billing_trigger;
  const scope = pkg.billing_scope;

  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl p-4 flex flex-col gap-3 hover:border-[#128C7E]/40 hover:shadow-sm transition-all">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-black text-[13px] text-[#111B21]">{pkg.token_name}</span>
          {productName && (
            <div className="text-[10px] text-[#667781] mt-0.5 uppercase tracking-wide truncate">{productName}</div>
          )}
        </div>
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#128C7E]/10 text-[#128C7E] border border-[#128C7E]/30 shrink-0">
          {pkg.token_type}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] text-[#667781] font-black uppercase tracking-wide">Cost</div>
          <div className="text-[18px] font-black text-[#128C7E] leading-tight">
            {currency} {price.toLocaleString()}
          </div>
          <div className="text-[10px] text-[#667781]">{getPkgBillingUnitLabel(pkg)}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#667781] font-black uppercase tracking-wide">Billing Unit</div>
          <div className="text-[18px] font-black text-[#111B21] leading-tight capitalize">
            {billingUnit}
          </div>
        </div>
      </div>

      {/* Billing meta */}
      {(trigger || scope) && (
        <div className="flex flex-wrap gap-1.5">
          {trigger && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-[#F0F2F5] text-[#667781] border border-[#E9EDEF]">
              ⚡ {trigger}
            </span>
          )}
          {scope && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-[#F0F2F5] text-[#667781] border border-[#E9EDEF] capitalize">
              ⊞ {scope}
            </span>
          )}
        </div>
      )}

      <button
        onClick={() => onBuy(pkg)}
        className="w-full h-9 rounded-lg bg-[#128C7E] text-white text-[12px] font-black cursor-pointer border-none hover:bg-[#0E7A6D] transition-all"
      >
        Buy Now
      </button>
    </div>
  );
}

// ── Buy Drawer ─────────────────────────────────────────────────────────────

function BuyDrawer({
  pkg, ownerUid, onClose, onSuccess,
}: {
  pkg: TokenPackage; ownerUid: string;
  onClose: () => void; onSuccess: (msg: string) => void;
}) {
  const [phone, setPhone] = useState("");
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const price = getPkgPrice(pkg);
  const currency = getPkgCurrency(pkg);
  const billingUnit = getPkgBillingUnit(pkg);
  const productName = pkg.product?.product_name;
  const total = price * qty;

  // Currency determines payment method
  const isMobileMoney = currency === "UGX" || currency === "KES";

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ── Mobile Money payment handler ─────────────────────────────────────
  const handleMoMoPay = async () => {
    if (!phone || phone.length < 9) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await buyTokens({
        token_buyer: ownerUid,
        token_uid: pkg.token_id,
        mobile_money_number: phone,
        token_quantity: qty,
      });

      const txnId = res?.data?.transaction_uid ?? res?.data?.transaction_id;
      if (txnId) {
        setPolling(true);
        setStatus("pending");
        let attempts = 0;
        pollRef.current = setInterval(async () => {
          attempts++;
          try {
            const statusRes = await getPaymentStatus(txnId);
            const txnStatus = statusRes?.data?.transaction_status;
            if (txnStatus === "success" || txnStatus === "successful") {
              if (pollRef.current) clearInterval(pollRef.current);
              setPolling(false);
              const msg = `${qty} × ${pkg.token_name} token${qty > 1 ? "s have" : " has"} been added to your account.`;
              setResultMsg(msg);
              setStatus("success");
              onSuccess(msg);
            } else if (txnStatus === "failed") {
              if (pollRef.current) clearInterval(pollRef.current);
              setPolling(false);
              setStatus("failed");
            }
          } catch {
            // Keep polling on network errors
          }
          if (attempts >= 36) {
            // 3 minutes max polling
            if (pollRef.current) clearInterval(pollRef.current);
            setPolling(false);
            setStatus((prev) => (prev === "success" ? prev : "timeout"));
          }
        }, 5000);
      } else {
        const msg = "Purchase initiated! Your balance will update shortly.";
        setResultMsg(msg);
        setStatus("success");
        onSuccess(msg);
      }
    } catch {
      setStatus("failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Can the user proceed?
  const canPay = !submitting && !polling && status !== "success";
  const canPayMomo = canPay && phone.length >= 9;

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black/30" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 z-[210] w-full max-w-[380px] bg-white shadow-2xl border-l border-[#E9EDEF] flex flex-col">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-[#E9EDEF] flex items-center justify-between bg-[#128C7E]/5">
          <div>
            <h3 className="font-black text-[15px] text-[#128C7E]">Buy Tokens</h3>
            <p className="text-[11px] text-[#667781] mt-0.5">
              {isMobileMoney ? "Purchase via Mobile Money" : "Request invoice for payment"}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 shrink-0 rounded-lg bg-white border border-[#E9EDEF] flex items-center justify-center text-[#667781] cursor-pointer hover:bg-[#F0F2F5] text-[14px] transition-all">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 p-4 overflow-y-auto [scrollbar-width:thin]">

          {/* ── Package summary ─────────────────────────────────────── */}
          <div className="bg-[#128C7E]/5 border border-[#128C7E]/20 rounded-xl p-3 mb-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="font-black text-[14px] text-[#111B21]">{pkg.token_name}</div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#128C7E]/10 text-[#128C7E] border border-[#128C7E]/30 shrink-0 capitalize">
                {pkg.token_type}
              </span>
            </div>
            {productName && <div className="text-[11px] text-[#667781] uppercase tracking-wide mb-2">{productName}</div>}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
              <div>
                <span className="text-[#667781]">Cost: </span>
                <span className="font-black text-[#128C7E]">{currency} {price.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[#667781]">Billing Unit: </span>
                <span className="font-black capitalize">{billingUnit}</span>
              </div>
              <div>
                <span className="text-[#667781]">Trigger: </span>
                <span className="font-black">{getPkgBillingTrigger(pkg)}</span>
              </div>
              <div>
                <span className="text-[#667781]">Scope: </span>
                <span className="font-black capitalize">{getPkgBillingScope(pkg)}</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-[#128C7E]/15 text-[11px] text-[#667781]">
              Charged <span className="font-black text-[#111B21]">{currency} {price.toLocaleString()}</span> {getPkgBillingUnitLabel(pkg)}
            </div>
          </div>

          {/* ── Quantity ────────────────────────────────────────────── */}
          <div className="mb-4">
            <label className="block text-[11px] font-black text-[#667781] uppercase tracking-wide mb-1.5">
              Quantity
            </label>
            <div className="flex items-center gap-2">
              <button onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} className="w-9 h-9 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[14px] font-black cursor-pointer hover:bg-[#E9EDEF] disabled:opacity-40 transition-all">-</button>
              <span className="w-12 text-center font-black text-[16px] text-[#111B21]">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="w-9 h-9 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[14px] font-black cursor-pointer hover:bg-[#E9EDEF] transition-all">+</button>
            </div>
          </div>

          {/* ── Total Cost ──────────────────────────────────────────── */}
          <div className="bg-[#F0F2F5] rounded-xl p-4 mb-4">
            <div className="text-[10px] text-[#667781] font-black uppercase tracking-wide mb-1">Total Cost</div>
            <div className="text-[24px] font-black text-[#128C7E]">{currency} {total.toLocaleString()}</div>
            <div className="text-[11px] text-[#667781]">
              {qty} × {currency} {price.toLocaleString()}
            </div>
          </div>

          {/* ── Payment Method ──────────────────────────────────────── */}
          {isMobileMoney ? (
            <>
              {/* Mobile Money input */}
              <div className="mb-4">
                <label className="block text-[11px] font-black text-[#667781] uppercase tracking-wide mb-1.5">
                  Mobile Money Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder={currency === "KES" ? "e.g. 0712345678" : "e.g. 0771234567"}
                  className="w-full h-10 px-3 rounded-lg bg-white border border-[#E9EDEF] text-[13px] text-[#111B21] outline-none focus:border-[#128C7E] transition-all"
                />
                <p className="text-[10px] text-[#667781] mt-1">
                  {currency === "KES" ? "M-Pesa" : "MTN/Airtel"} payment prompt will be sent to this number.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Invoice for non-MoMo currencies */}
              <div className="border border-[#3B82F6]/30 bg-[#3B82F6]/5 rounded-xl p-4 mb-4">
                <div className="text-[12px] font-black text-[#3B82F6] mb-2">Invoice Payment ({currency})</div>
                <div className="text-[11px] text-[#667781] leading-relaxed">
                  Mobile Money is only available for UGX and KES. An invoice will be generated and sent to your registered email for bank transfer or card payment.
                </div>
                <div className="mt-3 border-t border-[#3B82F6]/15 pt-3">
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <span className="text-[#667781]">Package:</span>
                    <span className="font-black text-[#111B21]">{pkg.token_name}</span>
                    <span className="text-[#667781]">Quantity:</span>
                    <span className="font-black text-[#111B21]">{qty}</span>
                    <span className="text-[#667781]">Amount:</span>
                    <span className="font-black text-[#3B82F6]">{currency} {total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Status indicators ───────────────────────────────────── */}
          {status === "failed" && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl p-4 mb-4 text-center">
              <div className="text-[13px] font-black text-[#EF4444] mb-1">Payment Failed</div>
              <div className="text-[11px] text-[#667781]">The transaction was not completed. Please try again.</div>
            </div>
          )}
          {status === "timeout" && (
            <div className="bg-[#F97316]/10 border border-[#F97316]/20 rounded-xl p-4 mb-4 text-center">
              <div className="text-[12px] font-black text-[#F97316]">Payment is still processing.</div>
              <div className="text-[10px] text-[#667781] mt-1">Check your transaction history shortly for the result.</div>
            </div>
          )}
        </div>

        {/* Footer — always visible at bottom */}
        <div className="shrink-0 px-4 py-3 border-t border-[#E9EDEF] bg-white">
          {isMobileMoney ? (
            <button
              onClick={handleMoMoPay}
              disabled={!canPayMomo}
              className="w-full h-10 rounded-lg bg-[#128C7E] text-white text-[13px] font-black cursor-pointer border-none hover:bg-[#0E7A6D] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? "Sending payment request..." : polling ? "Waiting for confirmation..." : status === "success" ? "Done!" : `Pay ${currency} ${total.toLocaleString()}`}
            </button>
          ) : (
            <button
              onClick={() => {
                if (!canPay) return;
                setStatus("invoice_sent");
                onSuccess(`Invoice for ${currency} ${total.toLocaleString()} has been sent to your registered email.`);
              }}
              disabled={!canPay}
              className="w-full h-10 rounded-lg bg-[#3B82F6] text-white text-[13px] font-black cursor-pointer border-none hover:bg-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {status === "invoice_sent" ? "Invoice Sent!" : `Request Invoice — ${currency} ${total.toLocaleString()}`}
            </button>
          )}
        </div>
      </div>

      {/* Authorise-payment preloader while we poll the status endpoint */}
      {status === "pending" && (
        <PaymentAuthorizingOverlay amountLabel={`${currency} ${total.toLocaleString()}`} phone={phone} />
      )}

      {/* Success confirmation — closes the drawer on "Done" */}
      {status === "success" && (
        <PaymentSuccessOverlay message={resultMsg} onDone={onClose} />
      )}
    </>
  );
}

// ── Subscription Status Helpers ────────────────────────────────────────────

function subStatusBadge(status: string) {
  const s = status?.toLowerCase() || "";
  if (s === "active" || s === "running")
    return "bg-[#128C7E]/10 border-[#128C7E]/30 text-[#128C7E]";
  if (s === "paused")
    return "bg-[#F97316]/10 border-[#F97316]/30 text-[#F97316]";
  if (s === "expired")
    return "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]";
  return "bg-[#F0F2F5] border-[#E9EDEF] text-[#667781]";
}

function subStatusLabel(status: string) {
  const s = status?.toLowerCase() || "";
  if (s === "running") return "active";
  return s || "unknown";
}

// ── Budget Tab ─────────────────────────────────────────────────────────────

type BudgetCurrency = "UGX" | "KES";

function BudgetTab({
  packages, pkgLoading, ownerUid, onSuccess,
}: {
  packages: TokenPackage[]; pkgLoading: boolean;
  ownerUid: string; onSuccess: (msg: string) => void;
}) {
  const [currency, setCurrency] = useState<BudgetCurrency>("UGX");
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null);
  const [budgetStr, setBudgetStr] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tokens that fit the budget — resolved by the backend /tokens/budget-offer endpoint
  const [offers, setOffers] = useState<TokenPackage[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const budget = parseFloat(budgetStr) || 0;

  // ── Fetch budget offers from the backend (debounced) ──────────────────────
  useEffect(() => {
    if (budget <= 0) {
      setOffers([]);
      setOffersError(null);
      setOffersLoading(false);
      return;
    }
    let cancelled = false;
    setOffersLoading(true);
    setOffersError(null);
    const handle = setTimeout(async () => {
      try {
        const res = await getBudgetOffer({ currency, amount: budget });
        if (cancelled) return;
        const tokens = res?.data?.tokens ?? [];
        // Map budget-offer rows into TokenPackage shape so the existing helpers/UI work
        const mapped: TokenPackage[] = tokens.map((t) => ({
          token_id: t.token_id,
          token_name: t.token_name,
          token_type: t.token_type,
          token_parameters: [],
          date_created: "",
          token_product_uid: t.token_product_uid ?? undefined,
          product: t.product_name ? { product_uid: t.token_product_uid ?? "", product_name: t.product_name } : undefined,
          token_amount: t.token_amount,
          token_currency: t.token_currency,
          billing_unit: t.billing_unit,
          billing_trigger: t.billing_trigger,
          billing_scope: t.billing_scope,
        }));
        setOffers(mapped);
      } catch {
        if (!cancelled) { setOffers([]); setOffersError("Could not load token offers. Please try again."); }
      } finally {
        if (!cancelled) setOffersLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [currency, budget]);

  // Auto-select the cheapest offer (backend returns ascending by price) when selection is invalid
  useEffect(() => {
    if (offers.length > 0) {
      const stillValid = selectedPkgId && offers.some((p) => p.token_id === selectedPkgId);
      if (!stillValid) setSelectedPkgId(offers[0].token_id);
    } else {
      setSelectedPkgId(null);
    }
  }, [offers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Selected token (from the affordable offers)
  const selectedPkg = offers.find((p) => p.token_id === selectedPkgId) ?? null;

  const unitPrice = selectedPkg ? getPkgPrice(selectedPkg) : 0;
  const tokenCount = unitPrice > 0 ? Math.floor(budget / unitPrice) : 0;
  const totalCost = tokenCount * unitPrice;
  const change = budget - totalCost;

  // ── Payment handler ──────────────────────────────────────────────────
  const handlePay = async () => {
    if (!selectedPkg || tokenCount <= 0 || !phone || phone.length < 9) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await buyTokens({
        token_buyer: ownerUid,
        token_uid: selectedPkg.token_id,
        mobile_money_number: phone,
        token_quantity: tokenCount,
      });

      const txnId = res?.data?.transaction_uid ?? res?.data?.transaction_id;
      if (txnId) {
        setPolling(true);
        setStatus("pending");
        let attempts = 0;
        pollRef.current = setInterval(async () => {
          attempts++;
          try {
            const statusRes = await getPaymentStatus(txnId);
            const txnStatus = statusRes?.data?.transaction_status;
            if (txnStatus === "success" || txnStatus === "successful") {
              if (pollRef.current) clearInterval(pollRef.current);
              setPolling(false);
              const msg = `${tokenCount} token(s) purchased for ${currency} ${totalCost.toLocaleString()}.`;
              setResultMsg(msg);
              setStatus("success");
              onSuccess(msg);
            } else if (txnStatus === "failed") {
              if (pollRef.current) clearInterval(pollRef.current);
              setPolling(false);
              setStatus("failed");
            }
          } catch { /* keep polling */ }
          if (attempts >= 36) {
            if (pollRef.current) clearInterval(pollRef.current);
            setPolling(false);
            setStatus((prev) => (prev === "success" ? prev : "timeout"));
          }
        }, 5000);
      } else {
        const msg = "Purchase initiated! Your balance will update shortly.";
        setResultMsg(msg);
        setStatus("success");
        onSuccess(msg);
      }
    } catch {
      setStatus("failed");
    } finally {
      setSubmitting(false);
    }
  };

  const canPay = tokenCount > 0 && phone.length >= 9 && !submitting && !polling && status !== "success";

  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-black text-[14px] text-[#111B21]">Buy by Budget</h3>
          <p className="text-[11px] text-[#667781] mt-0.5">Enter your budget and we'll calculate how many tokens you can get.</p>
        </div>
      </div>

      {pkgLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
            <span className="text-[12px] text-[#667781]">Loading token pricing...</span>
          </div>
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-[28px] mb-2">🛒</div>
          <p className="text-[13px] font-black text-[#111B21] mb-1">No Packages Available</p>
          <p className="text-[12px] text-[#667781]">Token packages are not configured yet. Contact support.</p>
        </div>
      ) : (
        <div className="grid xl:grid-cols-[1fr_340px] gap-5">

          {/* ══ Left: Budget Calculator ════════════════════════════════ */}
          <div className="flex flex-col gap-4">

            {/* Step 1: Currency */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-[#128C7E] text-white text-[11px] font-black flex items-center justify-center shrink-0">1</span>
                <label className="text-[12px] font-black text-[#111B21]">Select Currency</label>
              </div>
              <div className="flex gap-2">
                {(["UGX", "KES"] as BudgetCurrency[]).map((c) => {
                  const hasPkgs = packages.some((p) => getPkgCurrency(p) === c);
                  return (
                    <button
                      key={c}
                      onClick={() => { setCurrency(c); setBudgetStr(""); }}
                      disabled={!hasPkgs}
                      className={[
                        "h-10 px-5 rounded-lg text-[13px] font-black border cursor-pointer transition-all",
                        currency === c
                          ? "bg-[#128C7E] border-[#128C7E] text-white"
                          : hasPkgs
                            ? "bg-white border-[#E9EDEF] text-[#667781] hover:bg-[#F0F2F5]"
                            : "bg-[#F0F2F5] border-[#E9EDEF] text-[#CCC] cursor-not-allowed",
                      ].join(" ")}
                    >
                      {c}
                      {!hasPkgs && <span className="text-[9px] ml-1">(N/A)</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Budget Input */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-[#128C7E] text-white text-[11px] font-black flex items-center justify-center shrink-0">2</span>
                <label className="text-[12px] font-black text-[#111B21]">Enter Your Budget</label>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-black text-[#667781]">{currency}</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={budgetStr}
                  onChange={(e) => setBudgetStr(e.target.value)}
                  placeholder={currency === "UGX" ? "e.g. 50000" : "e.g. 5000"}
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#F8F9FA] border border-[#E9EDEF] text-[18px] font-black text-[#111B21] outline-none focus:border-[#128C7E] focus:bg-white transition-all placeholder:text-[#CCC] placeholder:font-normal"
                />
              </div>
              {offersLoading && (
                <p className="text-[10px] text-[#667781] mt-1.5 flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 border-2 border-[#128C7E]/30 border-t-[#128C7E] rounded-full animate-spin" />
                  Finding tokens within your budget…
                </p>
              )}
              {offersError && (
                <p className="text-[10px] text-[#EF4444] mt-1.5 font-black">{offersError}</p>
              )}
              {!offersLoading && !offersError && budget > 0 && offers.length === 0 && (
                <p className="text-[10px] text-[#F97316] mt-1.5 font-black">
                  No tokens fit within {currency} {budget.toLocaleString()}. Try increasing your budget or another currency.
                </p>
              )}
              {unitPrice > 0 && (
                <p className="text-[10px] text-[#667781] mt-1.5">
                  Token rate: <b className="text-[#128C7E]">{currency} {unitPrice.toLocaleString()}</b> {getPkgBillingUnitLabel(selectedPkg!)}
                  {selectedPkg && <span> ({selectedPkg.token_name})</span>}
                </p>
              )}
            </div>

            {/* Step 3: Select Token (within budget — from backend) */}
            {offers.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-[#128C7E] text-white text-[11px] font-black flex items-center justify-center shrink-0">3</span>
                  <label className="text-[12px] font-black text-[#111B21]">Select Token</label>
                  <span className="text-[10px] text-[#667781] ml-auto">{offers.length} fit your budget</span>
                </div>
                <div className="grid gap-2">
                  {offers.map((pkg) => {
                    const price = getPkgPrice(pkg);
                    const isSelected = pkg.token_id === selectedPkgId;
                    const maxQty = price > 0 ? Math.floor(budget / price) : 0;
                    return (
                      <button
                        key={pkg.token_id}
                        onClick={() => setSelectedPkgId(pkg.token_id)}
                        className={[
                          "w-full text-left px-4 py-3 rounded-xl border transition-all cursor-pointer",
                          isSelected
                            ? "bg-[#128C7E]/5 border-[#128C7E] ring-1 ring-[#128C7E]/30"
                            : "bg-white border-[#E9EDEF] hover:bg-[#F8F9FA]",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={[
                              "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                              isSelected ? "border-[#128C7E]" : "border-[#CCC]",
                            ].join(" ")}>
                              {isSelected && <div className="w-2 h-2 rounded-full bg-[#128C7E]" />}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[13px] font-black text-[#111B21] truncate">{pkg.token_name}</div>
                              <div className="text-[10px] text-[#667781] mt-0.5 capitalize">
                                {pkg.token_type}{pkg.billing_unit ? ` · per ${pkg.billing_unit}` : ""}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[13px] font-black text-[#128C7E]">
                              {currency} {price.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-[#667781]">up to {maxQty} token{maxQty !== 1 ? "s" : ""}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Calculation Result */}
            {budget > 0 && unitPrice > 0 && (
              <div className="bg-[#128C7E]/5 border border-[#128C7E]/20 rounded-xl p-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-[10px] text-[#667781] font-bold uppercase tracking-wide">Tokens</div>
                    <div className="text-[28px] font-black text-[#128C7E] leading-tight">{tokenCount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#667781] font-bold uppercase tracking-wide">Cost</div>
                    <div className="text-[18px] font-black text-[#111B21] leading-tight mt-1">
                      {currency} {totalCost.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#667781] font-bold uppercase tracking-wide">Change</div>
                    <div className="text-[18px] font-black text-[#667781] leading-tight mt-1">
                      {currency} {change.toLocaleString()}
                    </div>
                  </div>
                </div>
                {tokenCount === 0 && budget > 0 && (
                  <p className="text-[11px] text-[#F97316] font-black mt-3 text-center">
                    Budget too low. Minimum: {currency} {unitPrice.toLocaleString()} for 1 token.
                  </p>
                )}
              </div>
            )}

            {/* Step 4: Phone Number */}
            {tokenCount > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-[#128C7E] text-white text-[11px] font-black flex items-center justify-center shrink-0">4</span>
                  <label className="text-[12px] font-black text-[#111B21]">Mobile Money Number</label>
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ""))}
                  placeholder={currency === "UGX" ? "e.g. 0771234567" : "e.g. 0712345678"}
                  maxLength={15}
                  className="w-full h-10 px-3 rounded-lg bg-[#F8F9FA] border border-[#E9EDEF] text-[13px] text-[#111B21] outline-none focus:border-[#128C7E] transition-all"
                />
                <p className="text-[10px] text-[#667781] mt-1">
                  A payment prompt will be sent to this number via Mobile Money.
                </p>
              </div>
            )}
          </div>

          {/* ══ Right: Order Summary ═══════════════════════════════════ */}
          <div className="xl:border-l xl:border-[#E9EDEF] xl:pl-5">
            <div className="sticky top-0">
              <h4 className="font-black text-[13px] text-[#111B21] mb-3">Order Summary</h4>
              <div className="bg-[#F8F9FA] border border-[#E9EDEF] rounded-xl p-4 flex flex-col gap-3">
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#667781]">Currency</span>
                  <span className="font-black text-[#111B21]">{currency}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#667781]">Budget</span>
                  <span className="font-black text-[#111B21]">{currency} {budget.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#667781]">Token Rate</span>
                  <span className="font-black text-[#111B21]">{unitPrice > 0 ? `${currency} ${unitPrice.toLocaleString()} / token` : "—"}</span>
                </div>
                {selectedPkg && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#667781]">Package</span>
                    <span className="font-black text-[#111B21]">{selectedPkg.token_name}</span>
                  </div>
                )}
                <div className="border-t border-[#E9EDEF] pt-3 flex justify-between text-[13px]">
                  <span className="font-black text-[#111B21]">Tokens</span>
                  <span className="font-black text-[#128C7E] text-[18px]">{tokenCount}</span>
                </div>
                <div className="border-t border-[#E9EDEF] pt-3 flex justify-between text-[14px]">
                  <span className="font-black text-[#111B21]">Total</span>
                  <span className="font-black text-[#128C7E]">{currency} {totalCost.toLocaleString()}</span>
                </div>
                {change > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#667781]">Unused from budget</span>
                    <span className="text-[#667781]">{currency} {change.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Status messages */}
              {status === "failed" && (
                <div className="mt-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg px-3 py-2 text-[11px] text-[#EF4444] font-black">
                  Payment failed. Please try again.
                </div>
              )}
              {status === "timeout" && (
                <div className="mt-3 bg-[#F97316]/10 border border-[#F97316]/30 rounded-lg px-3 py-2 text-[11px] text-[#F97316] font-black">
                  Payment is still processing. Check your Transactions tab for updates.
                </div>
              )}
              {/* Pay button */}
              <button
                onClick={handlePay}
                disabled={!canPay}
                className="w-full mt-4 h-11 rounded-xl bg-[#128C7E] text-white text-[13px] font-black border-none cursor-pointer hover:brightness-110 active:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : polling ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Awaiting Payment...
                  </>
                ) : (
                  <>Pay {currency} {totalCost.toLocaleString()} via Mobile Money</>
                )}
              </button>

              {tokenCount === 0 && budget > 0 && unitPrice > 0 && (
                <p className="text-[10px] text-[#667781] mt-2 text-center">
                  Increase your budget to at least {currency} {unitPrice.toLocaleString()} to purchase 1 token.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Authorise-payment preloader while we poll the status endpoint */}
      {status === "pending" && (
        <PaymentAuthorizingOverlay amountLabel={`${currency} ${totalCost.toLocaleString()}`} phone={phone} />
      )}

      {/* Success confirmation */}
      {status === "success" && (
        <PaymentSuccessOverlay
          message={resultMsg}
          onDone={() => { setStatus(null); setPhone(""); setBudgetStr(""); }}
        />
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function SimPage() {
  const { state: authState } = useAuth();
  const [tab, setTab] = useState<Tab>("balance");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Data
  const [balances, setBalances] = useState<ClientTokenBalance[]>([]);
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [devices, setDevices] = useState<ClientDevice[]>([]);
  const [transactions, setTransactions] = useState<ClientTransaction[]>([]);

  // Loading
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [pkgLoading, setPkgLoading] = useState(true);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [txnLoading, setTxnLoading] = useState(true);

  // UI state
  const [buyTarget, setBuyTarget] = useState<TokenPackage | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "pause" | "restore"; imei: string; deviceName: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [pkgView, setPkgView] = useState<PkgView>("tiles");
  const [pkgViewMenuOpen, setPkgViewMenuOpen] = useState(false);
  const [pkgSearch, setPkgSearch] = useState("");
  const [pkgSort, setPkgSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [pkgSortMenuOpen, setPkgSortMenuOpen] = useState(false);
  // Click a column header / sort field: same key flips direction, new key starts ascending
  const togglePkgSort = (key: string) =>
    setPkgSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const pkgSortArrow = (key: string) => (pkgSort.key === key ? (pkgSort.dir === "asc" ? "▲" : "▼") : "");

  // Renders a single token package for the icon / list / tiles / content views
  const renderPackageItem = (pkg: TokenPackage) => {
    const meta = pkgMeta(pkg.token_type);
    const sz = PKG_ICON_SIZE[pkgView];
    const price = getPkgPrice(pkg);
    const currency = getPkgCurrency(pkg);
    const product = pkg.product?.product_name;
    const iconEl = <div className={`${sz.box} rounded-xl ${meta.tint} ${meta.text} grid place-items-center ${sz.text} shrink-0`}>{meta.icon}</div>;
    const priceEl = <span className="font-black text-[#128C7E]">{currency} {price.toLocaleString()}</span>;
    const buyBtn = (cls = "") => (
      <button onClick={(e) => { e.stopPropagation(); setBuyTarget(pkg); }} className={`rounded-lg bg-[#128C7E] text-white font-black cursor-pointer border-none hover:bg-[#0E7A6D] transition-all ${cls}`}>Buy Now</button>
    );
    const buyMini = (
      <button onClick={(e) => { e.stopPropagation(); setBuyTarget(pkg); }} title="Buy" className="h-7 px-2.5 rounded-md bg-[#128C7E] text-white text-[11px] font-black cursor-pointer border-none hover:bg-[#0E7A6D] transition-all shrink-0">Buy</button>
    );
    const common = { key: pkg.token_id, onDoubleClick: () => setBuyTarget(pkg) };

    // Icon views — centered tile with a Buy button
    if (pkgView === "xl" || pkgView === "large" || pkgView === "medium") {
      return (
        <div {...common} className="group rounded-xl border border-[#E9EDEF] bg-white p-3 flex flex-col items-center text-center gap-2 cursor-default hover:border-[#128C7E]/40 hover:shadow-sm transition-all">
          {iconEl}
          <div className="min-w-0 w-full">
            <div className="text-[12px] font-black text-[#111B21] truncate">{pkg.token_name}</div>
            <div className="text-[11px] truncate">{priceEl}</div>
            <div className="text-[9px] text-[#9AA5AD] truncate">{getPkgBillingUnitLabel(pkg)}</div>
          </div>
          {buyBtn("w-full h-8 text-[11px]")}
        </div>
      );
    }

    // Small / List — compact horizontal row
    if (pkgView === "small" || pkgView === "list") {
      return (
        <div {...common} className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-[#E9EDEF] bg-white cursor-default hover:border-[#128C7E]/40 transition-all">
          {iconEl}
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold text-[#111B21] truncate">{pkg.token_name}</div>
            <div className="text-[10px] truncate">{priceEl} <span className="text-[#9AA5AD]">{getPkgBillingUnitLabel(pkg)}</span></div>
          </div>
          {buyMini}
        </div>
      );
    }

    // Tiles — icon + meta + price + Buy
    if (pkgView === "tiles") {
      return (
        <div {...common} className="group flex flex-col gap-2 rounded-xl border border-[#E9EDEF] bg-white p-3 cursor-default hover:border-[#128C7E]/40 hover:shadow-sm transition-all">
          <div className="flex items-start gap-3">
            {iconEl}
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-black text-[#111B21] truncate">{pkg.token_name}</div>
              <div className="text-[10px] text-[#667781] truncate capitalize">{pkg.token_type || "—"}{product ? ` · ${product.toUpperCase()}` : ""}</div>
              <div className="text-[13px] mt-0.5 truncate">{priceEl} <span className="text-[10px] text-[#9AA5AD] font-normal">{getPkgBillingUnitLabel(pkg)}</span></div>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#128C7E]/10 text-[#128C7E] border border-[#128C7E]/30 capitalize shrink-0">{pkg.token_type}</span>
          </div>
          {buyBtn("w-full h-8 text-[12px]")}
        </div>
      );
    }

    // Content — full-width detailed row
    return (
      <div {...common} className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#E9EDEF] bg-white cursor-default hover:border-[#128C7E]/40 transition-all">
        {iconEl}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[12px] font-black text-[#111B21] truncate">{pkg.token_name}</span>
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-[#128C7E]/10 text-[#128C7E] border border-[#128C7E]/30 capitalize shrink-0">{pkg.token_type}</span>
          </div>
          <div className="text-[10px] text-[#667781] truncate mt-0.5">
            {product ? `Product ${product.toUpperCase()}` : "No product"} · {getPkgBillingUnitLabel(pkg)} · {getPkgBillingTrigger(pkg)}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[12px]">{priceEl}</div>
          <div className="text-[10px] text-[#9AA5AD] capitalize">{getPkgBillingScope(pkg)}</div>
        </div>
        {buyMini}
      </div>
    );
  };

  // SECURITY: ownerUid from logged-in user only
  const ownerUid = authState.accountUid || getCookie("_nvxs_account_uid") || "";
  const ownerUidRef = useRef(ownerUid);
  if (ownerUid) ownerUidRef.current = ownerUid;

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
  }, []);

  // ── Fetch balance ──────────────────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    const uid = ownerUidRef.current;
    if (!uid) return;
    setBalanceLoading(true);
    try {
      const res = await getClientBalance(uid);
      const data = res?.data;
      if (Array.isArray(data)) {
        setBalances(data);
      } else if (data && typeof data === "object") {
        // Single balance object — wrap in array
        setBalances([data as ClientTokenBalance]);
      } else {
        setBalances([]);
      }
    } catch {
      // Keep existing data on error
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  // ── Fetch packages ─────────────────────────────────────────────────────
  const fetchPackages = useCallback(async () => {
    setPkgLoading(true);
    try {
      const res = await getAllTokens();
      setPackages(Array.isArray(res?.data) ? res.data : []);
    } catch {
      // Keep empty
    } finally {
      setPkgLoading(false);
    }
  }, []);

  // ── Fetch devices ──────────────────────────────────────────────────────
  const fetchDevices = useCallback(async () => {
    const uid = ownerUidRef.current;
    if (!uid) return;
    setDevicesLoading(true);
    try {
      const res = await getClientDevices(uid);
      setDevices(res?.data ?? []);
    } catch {
      // Keep existing
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  // ── Fetch transactions ─────────────────────────────────────────────────
  const fetchTransactions = useCallback(async () => {
    const uid = ownerUidRef.current;
    if (!uid) return;
    setTxnLoading(true);
    try {
      const res = await getClientTransactions(uid);
      setTransactions(Array.isArray(res?.data) ? res.data : []);
    } catch {
      // Keep existing
    } finally {
      setTxnLoading(false);
    }
  }, []);

  // ── Initial data load based on active tab ──────────────────────────────
  const balanceFetched = useRef(false);
  const pkgFetched = useRef(false);
  const devicesFetched = useRef(false);
  const txnFetched = useRef(false);

  useEffect(() => {
    if (!ownerUidRef.current) return;
    if (tab === "balance" && !balanceFetched.current) {
      balanceFetched.current = true;
      fetchBalance();
    }
    if ((tab === "buy" || tab === "budget") && !pkgFetched.current) {
      pkgFetched.current = true;
      fetchPackages();
    }
    if ((tab === "buy" || tab === "budget" || tab === "subscriptions") && !devicesFetched.current) {
      devicesFetched.current = true;
      fetchDevices();
    }
    if (tab === "transactions" && !txnFetched.current) {
      txnFetched.current = true;
      fetchTransactions();
    }
  }, [tab, ownerUid, fetchBalance, fetchPackages, fetchDevices, fetchTransactions]);

  // Pre-fetch balance on mount (always useful)
  useEffect(() => {
    if (ownerUidRef.current && !balanceFetched.current) {
      balanceFetched.current = true;
      fetchBalance();
    }
  }, [ownerUid, fetchBalance]);

  // ── Pause / Restore handler ────────────────────────────────────────────
  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction.type === "pause") {
        await pauseSubscription(confirmAction.imei);
        showToast(`Device ${confirmAction.deviceName || confirmAction.imei} paused successfully.`, "success");
      } else {
        await restoreSubscription(confirmAction.imei);
        showToast(`Device ${confirmAction.deviceName || confirmAction.imei} restored successfully.`, "success");
      }
      setConfirmAction(null);
      fetchDevices();
      fetchBalance();
    } catch {
      showToast(`Failed to ${confirmAction.type} device. Please try again.`, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // ── KPI summary from balances ──────────────────────────────────────────
  const totalHoursLeft = balances.reduce((s, b) => s + b.token_hours_left, 0);
  const totalHoursUsed = balances.reduce((s, b) => s + b.token_hours_used, 0);
  const lowBalanceCount = balances.filter((b) => b.token_hours_left > 0 && b.token_hours_left <= 48).length;
  const expiredCount = balances.filter((b) => b.token_hours_left <= 0 && b.token_hours_used > 0).length;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Buy Drawer */}
      {buyTarget && (
        <BuyDrawer
          pkg={buyTarget}
          ownerUid={ownerUid}
          onClose={() => setBuyTarget(null)}
          onSuccess={(msg) => {
            // Keep the drawer open so the success overlay can show; it closes on "Done".
            showToast(msg, "success");
            balanceFetched.current = false;
            txnFetched.current = false;
            fetchBalance();
          }}
        />
      )}

      {/* Confirm Dialog */}
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.type === "pause" ? "Pause Device" : "Restore Device"}
          message={
            confirmAction.type === "pause"
              ? `Are you sure you want to pause tracking for ${confirmAction.deviceName || confirmAction.imei}? The device will stop sending data and token hours will be conserved.`
              : `Are you sure you want to restore tracking for ${confirmAction.deviceName || confirmAction.imei}? The device will resume sending data and token hours will be consumed.`
          }
          confirmLabel={actionLoading ? "Processing..." : confirmAction.type === "pause" ? "Pause Device" : "Restore Device"}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
          isDestructive={confirmAction.type === "pause"}
        />
      )}

      <main className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-3 p-3">

          {/* Header */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-3">
                <span className="font-black text-[18px] text-[#111B21] tracking-wide">TOKEN SUBSCRIPTION</span>
                <span className="text-[13px] text-[#667781]">— Manage tokens &amp; device billing</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-[#667781]">
                <span>{totalHoursLeft.toLocaleString()} hours available</span>
                {lowBalanceCount > 0 && (
                  <span className="text-[#F97316] font-black">⚠ {lowBalanceCount} low</span>
                )}
                {expiredCount > 0 && (
                  <span className="text-[#EF4444] font-black">⚠ {expiredCount} expired</span>
                )}
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`h-9 px-4 rounded-lg text-[12px] font-black border cursor-pointer transition-all flex items-center gap-1.5 ${
                  tab === t.key
                    ? "bg-[#128C7E]/10 border-[#128C7E]/30 text-[#128C7E]"
                    : "bg-white border-[#E9EDEF] text-[#667781] hover:bg-[#F0F2F5]"
                }`}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── TAB: Token Balance ──────────────────────────────────────── */}
          {tab === "balance" && (
            <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-[14px] text-[#111B21]">Your Token Balance</h3>
                <button
                  onClick={() => { balanceFetched.current = false; fetchBalance(); }}
                  className="h-8 px-3 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] transition-all flex items-center gap-1.5"
                >
                  <span>&#8635;</span> Refresh
                </button>
              </div>

              {balanceLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[12px] text-[#667781]">Loading balance...</span>
                  </div>
                </div>
              ) : balances.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-[28px] mb-2">💰</div>
                  <p className="text-[13px] font-black text-[#111B21] mb-1">No Tokens Yet</p>
                  <p className="text-[12px] text-[#667781]">Purchase your first token package to get started.</p>
                  <button
                    onClick={() => setTab("buy")}
                    className="mt-3 h-9 px-4 rounded-lg bg-[#128C7E] text-white text-[12px] font-black cursor-pointer border-none hover:bg-[#0E7A6D] transition-all"
                  >
                    Browse Packages
                  </button>
                </div>
              ) : (
                <>
                  {/* Summary KPIs */}
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="bg-[#128C7E]/5 border border-[#128C7E]/15 rounded-xl p-3 text-center">
                      <div className="text-[10px] text-[#667781] font-black uppercase">Total Left</div>
                      <div className="text-[18px] font-black text-[#128C7E]">{totalHoursLeft.toLocaleString()}</div>
                      <div className="text-[9px] text-[#667781]">hours</div>
                    </div>
                    <div className="bg-[#F0F2F5] border border-[#E9EDEF] rounded-xl p-3 text-center">
                      <div className="text-[10px] text-[#667781] font-black uppercase">Total Used</div>
                      <div className="text-[18px] font-black text-[#667781]">{totalHoursUsed.toLocaleString()}</div>
                      <div className="text-[9px] text-[#667781]">hours</div>
                    </div>
                    <div className="bg-[#F0F2F5] border border-[#E9EDEF] rounded-xl p-3 text-center">
                      <div className="text-[10px] text-[#667781] font-black uppercase">Active Tokens</div>
                      <div className="text-[18px] font-black text-[#111B21]">{balances.filter((b) => b.token_hours_left > 0).length}</div>
                      <div className="text-[9px] text-[#667781]">tokens</div>
                    </div>
                    <div className="bg-[#F0F2F5] border border-[#E9EDEF] rounded-xl p-3 text-center">
                      <div className="text-[10px] text-[#667781] font-black uppercase">Expired</div>
                      <div className="text-[18px] font-black text-[#EF4444]">{expiredCount}</div>
                      <div className="text-[9px] text-[#667781]">tokens</div>
                    </div>
                  </div>

                  {/* Balance cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {balances.map((b, i) => (
                      <BalanceCard key={b.token_billing_uid || i} b={b} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── TAB: Buy Tokens ────────────────────────────────────────── */}
          {tab === "buy" && (() => {
            const q = pkgSearch.toLowerCase();
            const filtered = q
              ? packages.filter((p) =>
                  p.token_name?.toLowerCase().includes(q) ||
                  p.token_type?.toLowerCase().includes(q) ||
                  (p.product?.product_name || "").toLowerCase().includes(q) ||
                  (p.billing_unit || "").toLowerCase().includes(q) ||
                  getPkgCurrency(p).toLowerCase().includes(q)
                )
              : packages;
            const sorted = sortPackages(filtered, pkgSort.key, pkgSort.dir);

            return (
            <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
              {/* Header row */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-[14px] text-[#111B21]">
                  Available Token Packages
                  {!pkgLoading && <span className="text-[12px] text-[#667781] font-normal ml-2">({filtered.length})</span>}
                </h3>
                <div className="flex items-center gap-2">
                  {/* Sort menu (Explorer-style) */}
                  <div className="relative">
                    <button
                      onClick={() => setPkgSortMenuOpen((o) => !o)}
                      title="Sort by"
                      className={`h-8 px-3 rounded-lg border text-[12px] font-black cursor-pointer flex items-center gap-1.5 transition-all ${pkgSortMenuOpen ? "bg-[#128C7E] text-white border-[#128C7E]" : "bg-[#F0F2F5] border-[#E9EDEF] text-[#667781] hover:bg-[#E9EDEF]"}`}
                    >
                      <span className="text-[12px] leading-none">↕</span>
                      Sort
                      <span className="text-[8px]">▾</span>
                    </button>
                    {pkgSortMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-[40]" onClick={() => setPkgSortMenuOpen(false)} />
                        <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-white rounded-xl shadow-xl border border-[#E9EDEF] py-1">
                          {PKG_SORT_OPTIONS.map((o) => (
                            <button
                              key={o.key}
                              onClick={() => setPkgSort((prev) => ({ key: o.key, dir: prev.key === o.key ? prev.dir : "asc" }))}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left hover:bg-[#F0F2F5] cursor-pointer border-none bg-transparent"
                            >
                              <span className="w-3 text-[#128C7E] text-[10px]">{pkgSort.key === o.key ? "●" : ""}</span>
                              <span className={pkgSort.key === o.key ? "font-black text-[#111B21]" : "text-[#111B21]"}>{o.label}</span>
                            </button>
                          ))}
                          <div className="my-1 border-t border-[#E9EDEF]" />
                          {(["asc", "desc"] as const).map((d) => (
                            <button
                              key={d}
                              onClick={() => setPkgSort((prev) => ({ ...prev, dir: d }))}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left hover:bg-[#F0F2F5] cursor-pointer border-none bg-transparent"
                            >
                              <span className="w-3 text-[#128C7E] text-[10px]">{pkgSort.dir === d ? "●" : ""}</span>
                              <span className="w-4 text-[11px] text-[#667781] text-center">{d === "asc" ? "▲" : "▼"}</span>
                              <span className={pkgSort.dir === d ? "font-black text-[#111B21]" : "text-[#111B21]"}>{d === "asc" ? "Ascending" : "Descending"}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* View menu (Explorer-style) */}
                  <div className="relative">
                    <button
                      onClick={() => setPkgViewMenuOpen((o) => !o)}
                      title="Change view"
                      className={`h-8 px-3 rounded-lg border text-[12px] font-black cursor-pointer flex items-center gap-1.5 transition-all ${pkgViewMenuOpen ? "bg-[#128C7E] text-white border-[#128C7E]" : "bg-[#F0F2F5] border-[#E9EDEF] text-[#667781] hover:bg-[#E9EDEF]"}`}
                    >
                      <span className="text-[13px] leading-none">{PKG_VIEW_OPTIONS.find((o) => o.key === pkgView)?.glyph}</span>
                      View
                      <span className="text-[8px]">▾</span>
                    </button>
                    {pkgViewMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-[40]" onClick={() => setPkgViewMenuOpen(false)} />
                        <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-white rounded-xl shadow-xl border border-[#E9EDEF] py-1">
                          {PKG_VIEW_OPTIONS.map((o) => (
                            <button
                              key={o.key}
                              onClick={() => { setPkgView(o.key); setPkgViewMenuOpen(false); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left hover:bg-[#F0F2F5] cursor-pointer border-none bg-transparent"
                            >
                              <span className="w-3 text-[#128C7E] text-[10px]">{pkgView === o.key ? "●" : ""}</span>
                              <span className="w-4 text-[14px] text-[#667781] text-center">{o.glyph}</span>
                              <span className={pkgView === o.key ? "font-black text-[#111B21]" : "text-[#111B21]"}>{o.label}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => { pkgFetched.current = false; fetchPackages(); }}
                    className="h-8 px-3 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] transition-all flex items-center gap-1.5"
                  >
                    <span>&#8635;</span> Refresh
                  </button>
                </div>
              </div>

              {/* Search bar */}
              <div className="mb-3">
                <input
                  type="text"
                  value={pkgSearch}
                  onChange={(e) => setPkgSearch(e.target.value)}
                  placeholder="Search tokens by name, type, or currency..."
                  className="w-full h-9 px-3 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] focus:bg-white transition-all"
                />
              </div>

              {pkgLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[12px] text-[#667781]">Loading packages...</span>
                  </div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-[28px] mb-2">{pkgSearch ? "🔍" : "🛒"}</div>
                  <p className="text-[13px] font-black text-[#111B21] mb-1">
                    {pkgSearch ? "No Matching Packages" : "No Packages Available"}
                  </p>
                  <p className="text-[12px] text-[#667781]">
                    {pkgSearch
                      ? `No packages match "${pkgSearch}". Try a different search.`
                      : "Token packages are not configured yet. Contact support."}
                  </p>
                  {pkgSearch && (
                    <button
                      onClick={() => setPkgSearch("")}
                      className="mt-2 h-8 px-3 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] transition-all"
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              ) : pkgView === "details" ? (
                /* ── Details View ──────────────────────────────────────── */
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#E9EDEF]">
                        {[
                          { key: "name", label: "Token Name" },
                          { key: "type", label: "Type" },
                          { key: "cost", label: "Cost" },
                          { key: "billing_unit", label: "Billing Unit" },
                        ].map((c) => (
                          <th key={c.key} className="px-3 py-2">
                            <button
                              onClick={() => togglePkgSort(c.key)}
                              className="flex items-center gap-1 text-[10px] font-black text-[#667781] uppercase tracking-wide bg-transparent border-none cursor-pointer hover:text-[#128C7E] transition-colors"
                            >
                              {c.label}<span className="text-[8px] text-[#128C7E]">{pkgSortArrow(c.key)}</span>
                            </button>
                          </th>
                        ))}
                        <th className="px-3 py-2 text-[10px] font-black text-[#667781] uppercase tracking-wide text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((pkg) => {
                        const price = getPkgPrice(pkg);
                        const currency = getPkgCurrency(pkg);
                        const billingUnit = getPkgBillingUnit(pkg);
                        const productName = pkg.product?.product_name;
                        return (
                          <tr key={pkg.token_id} className="border-b border-[#F0F2F5] hover:bg-[#F8F9FA] transition-colors">
                            <td className="px-3 py-2.5">
                              <div className="font-black text-[12px] text-[#111B21]">{pkg.token_name}</div>
                              {productName && <div className="text-[10px] text-[#667781] uppercase tracking-wide">{productName}</div>}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#128C7E]/10 text-[#128C7E] border border-[#128C7E]/30">
                                {pkg.token_type}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-[12px] font-black text-[#128C7E]">
                              {currency} {price.toLocaleString()}
                              <span className="text-[10px] text-[#667781] font-normal"> {getPkgBillingUnitLabel(pkg)}</span>
                            </td>
                            <td className="px-3 py-2.5 text-[12px] text-[#111B21] font-black capitalize">{billingUnit}</td>
                            <td className="px-3 py-2.5 text-center">
                              <button
                                onClick={() => setBuyTarget(pkg)}
                                className="h-7 px-3 rounded-lg bg-[#128C7E] text-white text-[11px] font-black cursor-pointer border-none hover:bg-[#0E7A6D] transition-all"
                              >
                                Buy Now
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* ── Icon / List / Tiles / Content views ─────────────────── */
                <div className={`grid gap-2.5 ${PKG_VIEW_GRID[pkgView] || ""}`}>
                  {sorted.map((pkg) => renderPackageItem(pkg))}
                </div>
              )}
            </div>
            );
          })()}

          {/* ── TAB: Buy by Budget ──────────────────────────────────────── */}
          {tab === "budget" && (
            <BudgetTab
              packages={packages}
              pkgLoading={pkgLoading}
              ownerUid={ownerUid}
              onSuccess={(msg) => {
                showToast(msg, "success");
                balanceFetched.current = false;
                txnFetched.current = false;
                fetchBalance();
              }}
            />
          )}

          {/* ── TAB: Device Subscriptions ──────────────────────────────── */}
          {tab === "subscriptions" && (
            <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-[14px] text-[#111B21]">Device Subscriptions</h3>
                <button
                  onClick={() => { devicesFetched.current = false; fetchDevices(); }}
                  className="h-8 px-3 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] transition-all flex items-center gap-1.5"
                >
                  <span>&#8635;</span> Refresh
                </button>
              </div>

              {devicesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[12px] text-[#667781]">Loading devices...</span>
                  </div>
                </div>
              ) : devices.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-[28px] mb-2">📡</div>
                  <p className="text-[13px] font-black text-[#111B21] mb-1">No Devices Found</p>
                  <p className="text-[12px] text-[#667781]">You don't have any devices configured yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#E9EDEF]">
                        <th className="px-3 py-2 text-[10px] font-black text-[#667781] uppercase tracking-wide">Device</th>
                        <th className="px-3 py-2 text-[10px] font-black text-[#667781] uppercase tracking-wide">IMEI</th>
                        <th className="px-3 py-2 text-[10px] font-black text-[#667781] uppercase tracking-wide">Vehicle</th>
                        <th className="px-3 py-2 text-[10px] font-black text-[#667781] uppercase tracking-wide">Billing</th>
                        <th className="px-3 py-2 text-[10px] font-black text-[#667781] uppercase tracking-wide">Subscription</th>
                        <th className="px-3 py-2 text-[10px] font-black text-[#667781] uppercase tracking-wide text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devices.map((d) => {
                        const subStatus = d.subscription_status?.toLowerCase() || "";
                        const billingStatus = d.billing_status?.toLowerCase() || "";
                        const canPause = subStatus === "active" || billingStatus === "running";
                        const canRestore = subStatus === "paused";

                        return (
                          <tr key={d.device_imei} className="border-b border-[#F0F2F5] hover:bg-[#F8F9FA] transition-colors">
                            <td className="px-3 py-2.5">
                              <div className="font-black text-[12px] text-[#111B21]">{d.device_name || "—"}</div>
                              <div className="text-[10px] text-[#667781]">{d.hardware || ""} {d.hardware_model || ""}</div>
                            </td>
                            <td className="px-3 py-2.5 text-[12px] text-[#111B21] font-mono">{d.device_imei}</td>
                            <td className="px-3 py-2.5">
                              <div className="text-[12px] text-[#111B21]">{d.car_make || "—"} {d.car_model || ""}</div>
                              {d.vin_number && <div className="text-[10px] text-[#667781]">VIN: {d.vin_number}</div>}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black border ${subStatusBadge(billingStatus)}`}>
                                {subStatusLabel(billingStatus)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black border ${subStatusBadge(subStatus)}`}>
                                {subStatusLabel(subStatus)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {canPause && (
                                  <button
                                    onClick={() => setConfirmAction({ type: "pause", imei: d.device_imei, deviceName: d.device_name })}
                                    title="Pause subscription"
                                    className="inline-flex items-center justify-center h-7 px-2.5 rounded-lg bg-[#F97316]/10 border border-[#F97316]/30 text-[#F97316] text-[10px] font-black cursor-pointer hover:bg-[#F97316]/20 transition-all gap-1"
                                  >
                                    ⏸ Pause
                                  </button>
                                )}
                                {canRestore && (
                                  <button
                                    onClick={() => setConfirmAction({ type: "restore", imei: d.device_imei, deviceName: d.device_name })}
                                    title="Restore subscription"
                                    className="inline-flex items-center justify-center h-7 px-2.5 rounded-lg bg-[#128C7E]/10 border border-[#128C7E]/30 text-[#128C7E] text-[10px] font-black cursor-pointer hover:bg-[#128C7E]/20 transition-all gap-1"
                                  >
                                    ▶ Restore
                                  </button>
                                )}
                                {!canPause && !canRestore && (
                                  <span className="text-[10px] text-[#C4CCD5]">—</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Transaction History ───────────────────────────────── */}
          {tab === "transactions" && (
            <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-[14px] text-[#111B21]">
                  Transaction History
                  {transactions.length > 0 && (
                    <span className="text-[12px] text-[#667781] font-normal ml-2">({transactions.length} records)</span>
                  )}
                </h3>
                <button
                  onClick={() => { txnFetched.current = false; fetchTransactions(); }}
                  className="h-8 px-3 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] transition-all flex items-center gap-1.5"
                >
                  <span>&#8635;</span> Refresh
                </button>
              </div>

              {txnLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[12px] text-[#667781]">Loading transactions...</span>
                  </div>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-[28px] mb-2">📋</div>
                  <p className="text-[13px] font-black text-[#111B21] mb-1">No Transactions Yet</p>
                  <p className="text-[12px] text-[#667781]">Your payment history will appear here after your first purchase.</p>
                  <button
                    onClick={() => setTab("buy")}
                    className="mt-3 h-9 px-4 rounded-lg bg-[#128C7E] text-white text-[12px] font-black cursor-pointer border-none hover:bg-[#0E7A6D] transition-all"
                  >
                    Buy Tokens
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#E9EDEF]">
                        <th className="px-3 py-2 text-[10px] font-black text-[#667781] uppercase tracking-wide">#</th>
                        <th className="px-3 py-2 text-[10px] font-black text-[#667781] uppercase tracking-wide">Transaction ID</th>
                        <th className="px-3 py-2 text-[10px] font-black text-[#667781] uppercase tracking-wide">Tokens</th>
                        <th className="px-3 py-2 text-[10px] font-black text-[#667781] uppercase tracking-wide">Validity</th>
                        <th className="px-3 py-2 text-[10px] font-black text-[#667781] uppercase tracking-wide">Cost</th>
                        <th className="px-3 py-2 text-[10px] font-black text-[#667781] uppercase tracking-wide">Currency</th>
                        <th className="px-3 py-2 text-[10px] font-black text-[#667781] uppercase tracking-wide">Date</th>
                        <th className="px-3 py-2 text-[10px] font-black text-[#667781] uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t, i) => {
                        const st = t.payment_status?.toLowerCase() || "";
                        const statusClass = st === "success"
                          ? "bg-[#128C7E]/10 border-[#128C7E]/30 text-[#128C7E]"
                          : st === "pending"
                            ? "bg-[#F97316]/10 border-[#F97316]/30 text-[#F97316]"
                            : st === "failed"
                              ? "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]"
                              : "bg-[#F0F2F5] border-[#E9EDEF] text-[#667781]";

                        return (
                          <tr key={t.transaction_uid || i} className="border-b border-[#F0F2F5] hover:bg-[#F8F9FA] transition-colors">
                            <td className="px-3 py-2.5 text-[11px] text-[#667781]">{i + 1}</td>
                            <td className="px-3 py-2.5 text-[11px] text-[#111B21] font-mono">
                              {t.transaction_uid?.substring(0, 18) || "—"}...
                            </td>
                            <td className="px-3 py-2.5 text-[12px] text-[#111B21] font-black">{t.token_count}</td>
                            <td className="px-3 py-2.5 text-[12px] text-[#667781]">{t.token_validity}</td>
                            <td className="px-3 py-2.5 text-[12px] text-[#111B21] font-black">{Number(t.total_cost).toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-[12px] text-[#667781]">{t.payment_currency}</td>
                            <td className="px-3 py-2.5 text-[12px] text-[#667781]">{t.date}</td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black border ${statusClass}`}>
                                {st || "unknown"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
