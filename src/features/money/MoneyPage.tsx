/**
 * MoneyPage — Screen 11: THE MONEY SWITCHBOARD
 *
 * Matches v26 mockups (9 screenshots):
 *   TOP:     Header + 4 KPIs → 2-col (Gateway Health | Token+VEBA Flow + Waswa AI)
 *   MID:     Filters → Transactions table (11 rows with State/Tokens/Webhook/Risk badges)
 *   BOTTOM:  VEBA Escrow & Settlement (4 KPIs + 2-row table) → Approvals Queue (HITL/HIC)
 *   BLADE:   Tx Detail PMT-10492 (Summary, Pipeline Trace, Actions, Audit, Recent Events)
 *   MODAL:   HITL Approval Request (Action Type, Amounts, Approvers, Guardrails, Checklist, Risk)
 */
import React, { useState, useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Payment {
  client_name: string;
  date: string;
  payment_account: string;
  payment_currency: string;
  payment_status: string;
  token_number: string;
  token_validity: string | null;
  total_cost: string;
  transaction_uid: string;
}

// ─── Status badge colors ─────────────────────────────────────────────────────
const txStateColor: Record<string, string> = {
  pending:    "bg-[#F97316] text-white",
  failed:     "bg-[#EF4444] text-white",
  successful: "bg-[#25D366] text-white",
  reversed:   "bg-[#F97316] text-white",
  chargeback: "bg-[#FBBF24] text-[#92400E]",
  payout:     "bg-[#FBBF24] text-[#92400E]",
};
const whColor: Record<string, string> = { OK: "bg-[#25D366] text-white", FAIL: "bg-[#EF4444] text-white" };
const riskColor = (r: number) => r >= 0.5 ? "bg-[#EF4444] text-white" : r >= 0.2 ? "bg-[#FBBF24] text-[#92400E]" : "bg-[#25D366] text-white";
const gwDot: Record<string, string> = { ok: "bg-[#25D366]", warn: "bg-[#FBBF24]", crit: "bg-[#EF4444]" };
const statusDot: Record<string, string> = { 
  pending: "warn", 
  successful: "ok", 
  failed: "crit"
};

// ─── Utility Functions ───────────────────────────────────────────────────────
interface StatsData {
  successful: { total: number; count: number; byCurrency: Record<string, { sum: number; count: number }> };
  pending: { total: number; count: number; byCurrency: Record<string, { sum: number; count: number }> };
  failed: { total: number; count: number; byCurrency: Record<string, { sum: number; count: number }> };
}

function calculateStats(payments: Payment[]): StatsData {
  const stats: StatsData = {
    successful: { total: 0, count: 0, byCurrency: {} },
    pending: { total: 0, count: 0, byCurrency: {} },
    failed: { total: 0, count: 0, byCurrency: {} },
  };

  payments.forEach(p => {
    const amount = parseInt(p.total_cost) || 0;
    const status = p.payment_status.toLowerCase();
    const currency = p.payment_currency;

    if (status === "successful") {
      stats.successful.total += amount;
      stats.successful.count += 1;
      if (!stats.successful.byCurrency[currency]) {
        stats.successful.byCurrency[currency] = { sum: 0, count: 0 };
      }
      stats.successful.byCurrency[currency].sum += amount;
      stats.successful.byCurrency[currency].count += 1;
    } else if (status === "pending") {
      stats.pending.total += amount;
      stats.pending.count += 1;
      if (!stats.pending.byCurrency[currency]) {
        stats.pending.byCurrency[currency] = { sum: 0, count: 0 };
      }
      stats.pending.byCurrency[currency].sum += amount;
      stats.pending.byCurrency[currency].count += 1;
    } else {
      stats.failed.total += amount;
      stats.failed.count += 1;
      if (!stats.failed.byCurrency[currency]) {
        stats.failed.byCurrency[currency] = { sum: 0, count: 0 };
      }
      stats.failed.byCurrency[currency].sum += amount;
      stats.failed.byCurrency[currency].count += 1;
    }
  });

  return stats;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US").format(amount);
}

// ─── Page ────────────────────────────────────────────────────────────────────
export function MoneyPage() {
  const [bladeOpen, setBladeOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsData>({
    successful: { total: 0, count: 0, byCurrency: {} },
    pending: { total: 0, count: 0, byCurrency: {} },
    failed: { total: 0, count: 0, byCurrency: {} },
  });

  // Filters
  const [filterCurrency, setFilterCurrency] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("");

  useEffect(() => {
    const fetchPayments = async () => {
      setLoading(true);
      setError(null);
      try {
        const { getRaw } = await import("../../api/client");
        const { ENDPOINTS } = await import("../../api/endpoints");
        const result = await getRaw<{ status: string; data: any[] }>(ENDPOINTS.FINANCE.PAYMENTS);
        
        if (result.status === "success" && Array.isArray(result.data)) {
          setPayments(result.data);
          setStats(calculateStats(result.data));
        } else {
          setError("Failed to load payments");
        }
      } catch (err) {
        setError("Error fetching payments: " + (err instanceof Error ? err.message : "Unknown error"));
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, []);

  const openBlade = (payment: Payment) => {
    setSelectedPayment(payment);
    setBladeOpen(true);
  };

  // Filter payments
  const filteredPayments = payments.filter(p => {
    if (filterCurrency !== "all" && p.payment_currency !== filterCurrency) return false;
    if (filterStatus !== "all" && p.payment_status.toLowerCase() !== filterStatus) return false;
    if (filterClient && !p.client_name.toLowerCase().includes(filterClient.toLowerCase())) return false;
    
    if (filterDate !== "all") {
      const pDate = new Date(p.date);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (filterDate === "today" && pDate.toDateString() !== today.toDateString()) return false;
      if (filterDate === "yesterday" && pDate.toDateString() !== yesterday.toDateString()) return false;
      if (filterDate === "week") {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (pDate < weekAgo) return false;
      }
    }
    
    return true;
  });

  const uniqueCurrencies = Array.from(new Set(payments.map(p => p.payment_currency))).sort();
  const uniqueClients = Array.from(new Set(payments.map(p => p.client_name))).sort();

  const ESCROW_BOOKINGS = [
    { bkg:"BKG-7781", asset:"D6 Dozer", stage:"Awaiting payout", stageTone:"bg-[#25D366] text-white", escrow:"KES 320,000", action:"Approve payout (HITL)", actionColor:"text-[#128C7E]" },
    { bkg:"BKG-7774", asset:"Boda",     stage:"Dispute opened",  stageTone:"bg-[#EF4444] text-white", escrow:"UGX 180,000", action:"Open case",             actionColor:"text-[#128C7E]" },
  ];

  const APPROVALS = [
    { dot:"bg-[#FBBF24]", title:"Refund > KES 75,000",  sub:"PMT-10491 • Reason: callback failed after debit", badge:"HITL", badgeTone:"bg-[#128C7E] text-white" },
    { dot:"bg-[#EF4444]", title:"Manual Token Mint",     sub:"PMT-10492 • Mint 125,000 TOK to keep service live", badge:"HIC",  badgeTone:"bg-[#EF4444] text-white" },
    { dot:"bg-[#FBBF24]", title:"Escrow Release",        sub:"BKG-7781 • Approve payout to owner (instant settlement, chained).", badge:"HITL", badgeTone:"bg-[#128C7E] text-white" },
  ];

  const BLADE_EVENTS = [
    "10:21:08 webhook_confirmed (momo_callback_ok)",
    "10:21:10 mint_enqueue (usage_event_id ue_9a21)",
    "10:21:14 fifo_blocked (balance low? none)",
    "10:21:15 ai_hint (suggest top-up bundle)",
    "10:21:22 approval_required (manual mint)",
  ];

  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden relative">
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-3 p-3">

          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <div className="text-[11px] text-[#667781] mb-0.5">Tokenomics &amp; Revenue &gt; Payments</div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-[16px] text-[#111B21]">The Money Switchboard</span>
                  <span className="text-[10px] font-black bg-[#128C7E] text-white px-2 py-0.5 rounded-full">HITL/HIC</span>
                </div>
                <div className="text-[11px] text-[#667781] mt-0.5">Unified: Mobile Money + Tokens</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Pill color="green">Run Payout</Pill>
                <Pill>Export</Pill>
              </div>
            </div>
          </div>

          {/* ════════════════════ TOP SCROLL ════════════════════════════ */}

          {/* 4 KPIs */}
          <div className="grid grid-cols-4 gap-3">
            {loading ? (
              <>
                <KpiCardSkeleton />
                <KpiCardSkeleton />
                <KpiCardSkeleton />
                <KpiCardSkeleton />
              </>
            ) : (
              <>
                <KpiCard label="Successful Transactions" value={formatCurrency(stats.successful.total)} sub="All currencies combined" dot="bg-[#25D366]" />
                <KpiCard label="Pending Transactions" value={formatCurrency(stats.pending.total)} sub="Awaiting confirmation" dot="bg-[#F97316]" />
                <KpiCard label="Failed Transactions" value={formatCurrency(stats.failed.total)} sub="Failed or reversed" dot="bg-[#EF4444]" />
                <KpiCard label="Total Volume" value={formatCurrency(stats.successful.total + stats.pending.total + stats.failed.total)} sub="All transactions" dot="bg-[#128C7E]" />
              </>
            )}
          </div>

          {/* 2-col: Statistics by Currency & Status | Empty space */}
          <div className="grid grid-cols-[1.2fr_0.8fr] gap-3 items-start">
            {/* Statistics by Currency */}
            <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E9EDEF]">
                <div className="font-black text-[13px] text-[#111B21]">Transaction Statistics by Currency</div>
                <div className="text-[11px] text-[#667781]">Count & amount by status per currency</div>
              </div>
              {loading ? (
                <div className="p-4 flex justify-center">
                  <Loader />
                </div>
              ) : (
                <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-[#E9EDEF] bg-[#F8FAFC]">
                        <th className="text-left px-3 py-2 font-black text-[#667781]">Currency</th>
                        <th className="text-left px-3 py-2 font-black text-[#667781]">Status</th>
                        <th className="text-right px-3 py-2 font-black text-[#667781]">Count</th>
                        <th className="text-right px-3 py-2 font-black text-[#667781]">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uniqueCurrencies.length > 0 ? (
                        uniqueCurrencies.flatMap(currency => [
                          stats.successful.byCurrency[currency] && (
                            <tr key={`${currency}-success`} className="border-b border-[#E9EDEF] hover:bg-[#F8FAFC]">
                              <td className="px-3 py-2.5 font-black text-[#111B21]">{currency}</td>
                              <td className="px-3 py-2.5"><span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[#25D366] text-white">successful</span></td>
                              <td className="px-3 py-2.5 text-right text-[#111B21] font-black">{stats.successful.byCurrency[currency].count}</td>
                              <td className="px-3 py-2.5 text-right text-[#25D366] font-black">{formatCurrency(stats.successful.byCurrency[currency].sum)}</td>
                            </tr>
                          ),
                          stats.pending.byCurrency[currency] && (
                            <tr key={`${currency}-pending`} className="border-b border-[#E9EDEF] hover:bg-[#F8FAFC]">
                              <td className="px-3 py-2.5 font-black text-[#111B21]">{currency}</td>
                              <td className="px-3 py-2.5"><span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[#F97316] text-white">pending</span></td>
                              <td className="px-3 py-2.5 text-right text-[#111B21] font-black">{stats.pending.byCurrency[currency].count}</td>
                              <td className="px-3 py-2.5 text-right text-[#F97316] font-black">{formatCurrency(stats.pending.byCurrency[currency].sum)}</td>
                            </tr>
                          ),
                          stats.failed.byCurrency[currency] && (
                            <tr key={`${currency}-failed`} className="border-b border-[#E9EDEF] last:border-0 hover:bg-[#F8FAFC]">
                              <td className="px-3 py-2.5 font-black text-[#111B21]">{currency}</td>
                              <td className="px-3 py-2.5"><span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[#EF4444] text-white">failed</span></td>
                              <td className="px-3 py-2.5 text-right text-[#111B21] font-black">{stats.failed.byCurrency[currency].count}</td>
                              <td className="px-3 py-2.5 text-right text-[#EF4444] font-black">{formatCurrency(stats.failed.byCurrency[currency].sum)}</td>
                            </tr>
                          ),
                        ].filter(Boolean))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-3 py-4 text-center text-[12px] text-[#667781]">No data available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Summary Stats Card */}
            <div className="bg-gradient-to-br from-[#128C7E] to-[#0D999B] rounded-xl p-4 text-white flex flex-col justify-between">
              <div>
                <div className="text-[11px] opacity-90 mb-4">Overall Statistics</div>
                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] opacity-75">Total Transactions</div>
                    <div className="text-[20px] font-black">{stats.successful.count + stats.pending.count + stats.failed.count}</div>
                  </div>
                  <div>
                    <div className="text-[10px] opacity-75">Total Volume</div>
                    <div className="text-[18px] font-black">{formatCurrency(stats.successful.total + stats.pending.total + stats.failed.total)}</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/20 text-[10px] opacity-75">
                <div>✓ {stats.successful.count} successful</div>
                <div>⏳ {stats.pending.count} pending</div>
                <div>✗ {stats.failed.count} failed</div>
              </div>
            </div>
          </div>

          {/* ════════════════════ MID SCROLL ════════════════════════════ */}

          {/* Filters */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
            <div className="font-black text-[12px] text-[#111B21] mb-3">Filter Transactions</div>
            <div className="grid grid-cols-4 gap-3">
              {/* Currency Filter */}
              <div>
                <label className="text-[10px] text-[#667781] mb-1 block">Currency</label>
                <select 
                  value={filterCurrency} 
                  onChange={(e) => setFilterCurrency(e.target.value)}
                  className="w-full h-8 rounded-lg border border-[#E9EDEF] px-2 text-[11px] text-[#111B21] outline-none focus:border-[#128C7E]/50"
                >
                  <option value="all">All Currencies</option>
                  {uniqueCurrencies.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-[10px] text-[#667781] mb-1 block">Status</label>
                <select 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full h-8 rounded-lg border border-[#E9EDEF] px-2 text-[11px] text-[#111B21] outline-none focus:border-[#128C7E]/50"
                >
                  <option value="all">All Statuses</option>
                  <option value="successful">Successful</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              {/* Date Filter */}
              <div>
                <label className="text-[10px] text-[#667781] mb-1 block">Date Range</label>
                <select 
                  value={filterDate} 
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full h-8 rounded-lg border border-[#E9EDEF] px-2 text-[11px] text-[#111B21] outline-none focus:border-[#128C7E]/50"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">Last 7 Days</option>
                </select>
              </div>

              {/* Client Filter */}
              <div>
                <label className="text-[10px] text-[#667781] mb-1 block">Client</label>
                <input 
                  type="text" 
                  placeholder="Search client..."
                  value={filterClient}
                  onChange={(e) => setFilterClient(e.target.value)}
                  className="w-full h-8 rounded-lg border border-[#E9EDEF] px-2 text-[11px] text-[#111B21] outline-none focus:border-[#128C7E]/50"
                />
              </div>
            </div>
          </div>

          {/* Transactions table */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E9EDEF]">
              <span className="font-black text-[13px] text-[#111B21]">Transactions</span>
              <span className="text-[11px] text-[#667781] ml-3">{loading ? "Loading..." : `${filteredPayments.length} of ${payments.length} payments`} • Payments ↔ Token Mint ↔ VEBA Escrow</span>
            </div>
            {loading ? (
              <div className="p-8 flex justify-center">
                <Loader />
              </div>
            ) : error ? (
              <div className="p-4 text-center text-[12px] text-[#EF4444]">{error}</div>
            ) : (
              <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <table className="w-full text-[12px] min-w-[1100px]">
                <thead><tr className="border-b border-[#E9EDEF] bg-[#F8FAFC]">
                  {["Tx ID","Client","Currency","Amount","Status","Date","Token","Account"].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-black text-[#667781] whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredPayments.length > 0 ? (
                    filteredPayments.slice(0, 15).map((payment) => (
                      <tr key={payment.transaction_uid} onClick={() => openBlade(payment)} className="border-b border-[#E9EDEF] last:border-0 hover:bg-[#F8FAFC] cursor-pointer">
                        <td className="px-3 py-2.5 whitespace-nowrap"><span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${gwDot[statusDot[payment.payment_status.toLowerCase()] ?? "warn"]} shrink-0`} /><span className="font-black text-[#111B21] text-[10px]">{payment.transaction_uid.substring(0, 8).toUpperCase()}</span></span></td>
                        <td className="px-3 py-2.5 text-[#111B21] text-[11px]">{payment.client_name}</td>
                        <td className="px-3 py-2.5 text-[#667781]">{payment.payment_currency}</td>
                        <td className="px-3 py-2.5 font-black text-[#111B21] text-right">{formatCurrency(parseInt(payment.total_cost))}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap"><span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${txStateColor[payment.payment_status.toLowerCase()] ?? "bg-[#E9EDEF] text-[#667781]"}`}>{payment.payment_status}</span></td>
                        <td className="px-3 py-2.5 text-[#667781] text-[11px]">{payment.date}</td>
                        <td className="px-3 py-2.5 text-[#667781] font-mono text-[10px]">{payment.token_validity ? payment.token_validity : "—"}</td>
                        <td className="px-3 py-2.5 text-[#667781] font-mono text-[10px]">{payment.payment_account.substring(0, 10)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={8} className="px-3 py-4 text-center text-[12px] text-[#667781]">No transactions match your filters</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            )}
            <div className="px-3 py-2 text-[10px] text-[#667781] italic border-t border-[#E9EDEF]">Row action: click Tx ID → blade. High-risk actions require HITL/HIC approval.</div>
          </div>

        </div>
      </main>

      {/* ── Blade: Tx Detail ─────────────────────────────────────── */}
      {bladeOpen && selectedPayment && (
        <div className="w-[420px] shrink-0 bg-white border-l border-[#E9EDEF] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#E9EDEF] shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-black text-[14px] text-[#111B21]">Tx Detail</span>
              <span className={`px-2 py-0.5 rounded-full text-white text-[10px] font-black ${txStateColor[selectedPayment.payment_status.toLowerCase()] ?? "bg-[#E9EDEF]"}`}>{selectedPayment.payment_status}</span>
            </div>
            <button onClick={() => setBladeOpen(false)} className="w-7 h-7 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[#667781] font-black text-[13px] cursor-pointer grid place-items-center hover:bg-[#E9EDEF]">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-5 py-4">

            <BSection title="Summary">
              <div className="p-4"><KV rows={[
                {k:"Amount",     v:`${selectedPayment.payment_currency} ${formatCurrency(parseInt(selectedPayment.total_cost))}`},
                {k:"Client",     v:selectedPayment.client_name},
                {k:"Date",       v:selectedPayment.date},
                {k:"Account",    v:selectedPayment.payment_account},
                {k:"Token ID",   v:selectedPayment.token_number},
                {k:"Validity",   v:selectedPayment.token_validity ? selectedPayment.token_validity + " days" : "N/A"},
              ]} /></div>
            </BSection>


            <BSection title="Audit (Irrefutable)">
              <div className="p-4">
                <div className="text-[11px] text-[#667781] mb-0.5">transaction_uid</div>
                <div className="font-black text-[11px] text-[#111B21] font-mono mb-2 break-all">{selectedPayment.transaction_uid}</div>
                <div className="text-[11px] text-[#667781] mb-0.5">payment_account</div>
                <div className="font-black text-[11px] text-[#111B21] mb-0 break-all">{selectedPayment.payment_account}</div>
              </div>
            </BSection>

            <BSection title="Recent Events">
              <div className="p-4 flex flex-col gap-2">
                {BLADE_EVENTS.map((ev,i) => (
                  <div key={i} className="text-[11px] text-[#667781] border border-[#E9EDEF] rounded-lg px-3 py-2">{ev}</div>
                ))}
              </div>
            </BSection>
          </div>
        </div>
      )}

      {/* ── Modal: HITL Approval Request ─────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/35 z-50 grid place-items-center" onClick={() => setModalOpen(false)}>
          <div className="w-[min(700px,calc(100vw-24px))] max-h-[calc(100vh-24px)] bg-white rounded-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#E9EDEF] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-black text-[16px] text-[#111B21]">HITL Approval Request</span>
                <span className="px-2 py-0.5 rounded-full bg-[#EF4444] text-white text-[10px] font-black">HIGH-RISK</span>
              </div>
              <button onClick={() => setModalOpen(false)} className="w-8 h-8 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[#667781] font-black text-[14px] cursor-pointer grid place-items-center hover:bg-[#E9EDEF]">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-5">

              {[
                {label:"Action Type", value:"Manual Token Mint (to prevent service stop) ▾"},
                {label:"Reference",   value:"PMT-10492"},
                {label:"Tenant scope",value:"3D-TOP (Top Account)"},
                {label:"Amount",      value:"UGX 2,500,000"},
                {label:"Token impact",value:"+125,000 TOK (FIFO wallet)"},
                {label:"Reason",      value:"Callback OK but mint queue stalled (lag)"},
              ].map(f => (
                <div key={f.label} className="mb-4 border-b border-[#E9EDEF] pb-3">
                  <div className="text-[11px] text-[#667781] mb-1">{f.label}</div>
                  <div className="text-[13px] text-[#111B21]">{f.value}</div>
                </div>
              ))}

              <div className="mb-4 border-b border-[#E9EDEF] pb-3">
                <div className="text-[11px] text-[#667781] mb-1">Approvers (RBAC)</div>
                <div className="text-[12px] text-[#111B21] leading-relaxed">
                  <div>• Finance Controller (HITL)</div>
                  <div>• Platform Owner (HIC)</div>
                  <div>• Audit Bot (auto-hash)</div>
                </div>
              </div>

              {/* Guardrails */}
              <div className="bg-[#EAF7F3] border border-[#128C7E]/20 rounded-xl p-4 mb-4">
                <div className="font-black text-[13px] text-[#111B21] mb-2">Guardrails (G)</div>
                <div className="text-[12px] text-[#667781] leading-relaxed">
                  Irreversible: once approved, action cannot be undone.<br/>
                  Irrevocable: AI cannot bypass human decision.<br/>
                  Irrefutable: cryptographic audit trail is mandatory.
                </div>
              </div>

              {/* Pre-flight checklist */}
              <div className="mb-4 border-b border-[#E9EDEF] pb-3">
                <div className="text-[11px] text-[#667781] mb-2">Pre-flight Checklist</div>
                {[
                  "I confirm this will not create duplicate minting.",
                  "I confirm tenant scope is correct (no cross-tenant leakage).",
                  "I confirm FX + gateway fees have been accounted for.",
                  "I confirm this action is logged to Audit Logs & Compliance.",
                ].map((c,i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px] text-[#111B21] border border-[#E9EDEF] rounded-lg px-3 py-2.5 mb-2">
                    <span className="w-4 h-4 rounded border border-[#E9EDEF] bg-white shrink-0" />
                    {c}
                  </div>
                ))}
              </div>

              {/* Audit note */}
              <div className="mb-4 border-b border-[#E9EDEF] pb-3">
                <div className="text-[11px] text-[#667781] mb-1">Audit note (optional)</div>
                <textarea placeholder="Type a short justification for the audit trail…" className="w-full h-20 rounded-lg border border-[#E9EDEF] px-3 py-2 text-[12px] text-[#111B21] outline-none resize-none focus:border-[#128C7E]/50" />
              </div>

              {/* Risk Summary */}
              <div className="bg-[#FEF2F2] border border-[#EF4444]/20 rounded-xl p-4">
                <div className="font-black text-[13px] text-[#111B21] mb-1">Risk Summary</div>
                <div className="text-[12px] text-[#667781]">This action mints 125,000 TOK to the 3D-TOP FIFO wallet. Dual approval is required. Once submitted, the action enters an immutable audit chain.</div>
              </div>
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-t border-[#E9EDEF] bg-white shrink-0">
              <button onClick={() => setModalOpen(false)} className="h-10 px-5 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[13px] font-black text-[#111B21] cursor-pointer">Cancel</button>
              <button onClick={() => setModalOpen(false)} className="h-10 px-6 rounded-lg bg-[#25D366] text-[#075E54] text-[13px] font-black border-none cursor-pointer hover:brightness-105">Submit for approval</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reusable Components ─────────────────────────────────────────────────────
const pillStyles: Record<string, string> = {
  green: "bg-[#25D366] text-[#075E54]",
  ghost: "bg-white border border-[#E9EDEF] text-[#667781]",
};

function Loader() {
  return (
    <div className="flex items-center justify-center gap-1">
      <div className="w-2 h-2 rounded-full bg-[#128C7E] animate-bounce" style={{ animationDelay: "0s" }}></div>
      <div className="w-2 h-2 rounded-full bg-[#128C7E] animate-bounce" style={{ animationDelay: "0.2s" }}></div>
      <div className="w-2 h-2 rounded-full bg-[#128C7E] animate-bounce" style={{ animationDelay: "0.4s" }}></div>
    </div>
  );
}

function Pill({ color = "ghost", onClick, children }: { color?: string; onClick?: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`h-7 px-3 rounded-full text-[11px] font-black border-none cursor-pointer hover:brightness-105 active:opacity-85 transition-all whitespace-nowrap ${pillStyles[color] ?? pillStyles.ghost}`}>{children}</button>;
}

function KpiCard({ label, value, sub, dot }: { label: string; value: string; sub: string; dot: string }) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl p-3 relative">
      <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${dot}`} />
      <div className="text-[11px] text-[#667781]">{label}</div>
      <div className="text-[22px] font-black text-[#111B21] mt-1 leading-tight">{value}</div>
      <div className="text-[10px] text-[#667781] mt-1">{sub}</div>
    </div>
  );
}

function KpiCardSkeleton() {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl p-3 relative animate-pulse">
      <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-[#E9EDEF]" />
      <div className="h-3 bg-[#E9EDEF] rounded w-24 mb-2"></div>
      <div className="h-6 bg-[#E9EDEF] rounded w-32 mb-2"></div>
      <div className="h-2.5 bg-[#E9EDEF] rounded w-20"></div>
    </div>
  );
}

function BSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 border border-[#E9EDEF] rounded-xl overflow-hidden bg-white">
      <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E9EDEF]"><div className="font-black text-[12px] text-[#111B21]">{title}</div></div>
      {children}
    </div>
  );
}

function KV({ rows }: { rows: { k: string; v: string; vColor?: string }[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map(r => (
        <div key={r.k} className="flex gap-3 text-[12px]">
          <span className="text-[#667781] w-[90px] shrink-0">{r.k}</span>
          <span className={`font-black ${r.vColor ?? "text-[#111B21]"}`}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}
