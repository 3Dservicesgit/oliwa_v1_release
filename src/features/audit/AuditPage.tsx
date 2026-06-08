/**
 * AuditPage — Customer Audit Trail
 *
 * Shows a chronological timeline of all actions on the customer's account:
 * token purchases, device pauses/restores, geofence changes, report
 * generations, login events, and more.
 *
 * Features:
 *   - KPI stats strip (total events, warnings, critical, last activity)
 *   - Filter bar: search, domain, severity, time range
 *   - Activity timeline with color-coded events
 *
 * SECURITY: Events are filtered server-side by the customer's tenant_id.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getCookie } from "../../utils/cookies";
import { getAuditEvents, getAuditKpis } from "../../api/services/audit.service";
import type { AuditEvent, AuditDomain, AuditSeverity, AuditFilters } from "../../api/types";

// ── Domain labels ──────────────────────────────────────────────────────────

const DOMAIN_LABELS: Partial<Record<AuditDomain, string>> = {
  TOKEN:    "Token",
  PAYMENT:  "Payment",
  SIM:      "Device",
  CLIENT:   "Client",
  BILLING:  "Billing",
  VEBA:     "VEBA",
  ALARM:    "Alarm",
  SYSTEM:   "System",
  RBAC:     "Access",
  AUDIT:    "Audit",
  PROTOCOL: "Geofence",
  FIRMWARE: "Events",
};

const SEVERITY_STYLES: Record<AuditSeverity, { bg: string; text: string; dot: string }> = {
  Info:  { bg: "bg-[#128C7E]/10", text: "text-[#128C7E]", dot: "bg-[#128C7E]" },
  Warn:  { bg: "bg-[#F97316]/10", text: "text-[#F97316]", dot: "bg-[#F97316]" },
  Alarm: { bg: "bg-[#EF4444]/10", text: "text-[#EF4444]", dot: "bg-[#EF4444]" },
  Crit:  { bg: "bg-[#7C3AED]/10", text: "text-[#7C3AED]", dot: "bg-[#7C3AED]" },
};

const DOMAIN_OPTIONS: { value: string; label: string }[] = [
  { value: "",         label: "All Domains" },
  { value: "TOKEN",    label: "Token" },
  { value: "PAYMENT",  label: "Payment" },
  { value: "SIM",      label: "Device" },
  { value: "CLIENT",   label: "Client" },
  { value: "BILLING",  label: "Billing" },
  { value: "SYSTEM",   label: "System" },
  { value: "RBAC",     label: "Access" },
  { value: "PROTOCOL", label: "Geofence" },
  { value: "VEBA",     label: "VEBA" },
  { value: "ALARM",    label: "Alarm" },
  { value: "AUDIT",    label: "Audit" },
];

const SEVERITY_OPTIONS: { value: string; label: string }[] = [
  { value: "",      label: "All Severity" },
  { value: "Info",  label: "Info" },
  { value: "Warn",  label: "Warning" },
  { value: "Alarm", label: "Alarm" },
  { value: "Crit",  label: "Critical" },
];

const RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: "1h",  label: "Last 1 hour" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d",  label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

// ── Relative time helper ───────────────────────────────────────────────────

function timeAgo(isoStr: string): string {
  try {
    const now = Date.now();
    const then = new Date(isoStr).getTime();
    const diffMs = now - then;
    if (isNaN(diffMs) || diffMs < 0) return isoStr;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return isoStr.split("T")[0] || isoStr;
  } catch {
    return isoStr;
  }
}

// ── Page ───────────────────────────────────────────────────────────────────

export function AuditPage() {
  const { state: authState } = useAuth();
  const ownerUid = authState.accountUid || getCookie("_nvxs_account_uid") || "";

  // Data
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("");
  const [severity, setSeverity] = useState("");
  const [range, setRange] = useState("30d");

  const fetchedRef = useRef(false);

  // ── Fetch events ─────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const filters: AuditFilters = { range };
      if (domain) filters.domain = domain as AuditDomain;
      if (severity) filters.severity = severity as AuditSeverity;
      if (search.trim()) filters.search = search.trim();
      if (ownerUid) filters.tenant_id = ownerUid;

      const res = await getAuditEvents(filters);
      setEvents(Array.isArray(res?.data) ? res.data : []);
    } catch {
      // Keep existing
    } finally {
      setLoading(false);
    }
  }, [domain, severity, range, search, ownerUid]);

  // ── Fetch KPIs (placeholder for future use) ──────────────────────────
  const fetchKpis = useCallback(async () => {
    try { await getAuditKpis(); } catch { /* no-op */ }
  }, []);

  // Initial load
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchEvents();
      fetchKpis();
    }
  }, [fetchEvents, fetchKpis]);

  // Re-fetch when filters change (except search — that's on Enter)
  useEffect(() => {
    if (fetchedRef.current) fetchEvents();
  }, [domain, severity, range, fetchEvents]);

  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") fetchEvents();
  };

  // Derived stats
  const totalEvents = events.length;
  const warnCount = events.filter((e) => e.severity === "Warn").length;
  const critCount = events.filter((e) => e.severity === "Alarm" || e.severity === "Crit").length;
  const lastActivity = events[0] ? timeAgo(events[0].timestamp) : "—";

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <main className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-3 p-3">

          {/* Header */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <div className="flex items-baseline gap-3">
              <span className="font-black text-[18px] text-[#111B21] tracking-wide">AUDIT TRAIL</span>
              <span className="text-[13px] text-[#667781]">— Account activity log</span>
            </div>
          </div>

          {/* KPI Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Total Events" value={String(totalEvents)} sub={`Last ${range}`} color="teal" loading={loading} />
            <KpiCard label="Warnings" value={String(warnCount)} sub="Attention needed" color="orange" loading={loading} />
            <KpiCard label="Critical Actions" value={String(critCount)} sub="High severity" color="red" loading={loading} />
            <KpiCard label="Last Activity" value={lastActivity} sub="Most recent event" color="blue" loading={loading} />
          </div>

          {/* Filter Bar */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKey}
              placeholder="Search events... (press Enter)"
              className="h-8 flex-1 min-w-[180px] px-3 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] focus:bg-white transition-all"
            />
            <select value={domain} onChange={(e) => setDomain(e.target.value)} className="h-8 px-2 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] font-black text-[#667781] cursor-pointer outline-none">
              {DOMAIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="h-8 px-2 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] font-black text-[#667781] cursor-pointer outline-none">
              {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={range} onChange={(e) => setRange(e.target.value)} className="h-8 px-2 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] font-black text-[#667781] cursor-pointer outline-none">
              {RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={() => { fetchEvents(); fetchKpis(); }} className="h-8 px-3 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] transition-all flex items-center gap-1">
              <span>&#8635;</span> Refresh
            </button>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
            <h3 className="font-black text-[14px] text-[#111B21] mb-4">Activity Timeline</h3>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[12px] text-[#667781]">Loading events...</span>
                </div>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-[28px] mb-2">📋</div>
                <p className="text-[13px] font-black text-[#111B21] mb-1">
                  {search || domain || severity ? "No Matching Events" : "No Events Yet"}
                </p>
                <p className="text-[12px] text-[#667781]">
                  {search || domain || severity
                    ? "Try adjusting your filters."
                    : "Your account activity will appear here."}
                </p>
                {(search || domain || severity) && (
                  <button
                    onClick={() => { setSearch(""); setDomain(""); setSeverity(""); }}
                    className="mt-2 h-8 px-3 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] transition-all"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                {/* Vertical timeline line */}
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[#E9EDEF]" />

                <div className="flex flex-col gap-0.5">
                  {events.map((evt, i) => {
                    const sev = SEVERITY_STYLES[evt.severity] || SEVERITY_STYLES.Info;
                    const domLabel = DOMAIN_LABELS[evt.domain] || evt.domain;
                    const isLast = i === events.length - 1;

                    return (
                      <div key={evt.id || i} className="flex gap-3 relative">
                        {/* Dot */}
                        <div className="flex flex-col items-center shrink-0 pt-1">
                          <div className={`w-[10px] h-[10px] rounded-full ${sev.dot} shrink-0 z-10 ring-2 ring-white`} />
                          {!isLast && <div className="w-px flex-1 bg-[#E9EDEF]" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 pb-4 min-w-0">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <div className="font-black text-[12px] text-[#111B21] leading-snug">
                                {evt.action} — {evt.object}
                              </div>
                              {evt.actor && (
                                <div className="text-[10px] text-[#667781] mt-0.5">
                                  by {evt.actor}
                                  {evt.ip_address && <span> · {evt.ip_address}</span>}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black ${sev.bg} ${sev.text}`}>
                                {evt.severity}
                              </span>
                              <span className="text-[10px] font-black text-[#667781] bg-[#F0F2F5] px-1.5 py-0.5 rounded">
                                {domLabel}
                              </span>
                              <span className="text-[10px] text-[#667781] min-w-[50px] text-right">
                                {timeAgo(evt.timestamp)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color = "teal", loading = false,
}: {
  label: string; value: string; sub?: string;
  color?: "teal" | "orange" | "red" | "blue";
  loading?: boolean;
}) {
  const valueColor = {
    teal:   "text-[#128C7E]",
    orange: "text-[#F97316]",
    red:    "text-[#EF4444]",
    blue:   "text-[#3B82F6]",
  }[color];

  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl p-3 flex flex-col gap-0.5">
      <div className="text-[10px] text-[#667781] font-black uppercase tracking-wide">{label}</div>
      {loading ? (
        <div className="h-6 bg-gray-200 rounded-lg animate-pulse w-16" />
      ) : (
        <div className={`text-[20px] font-black leading-tight ${valueColor}`}>{value}</div>
      )}
      {sub && <div className="text-[10px] text-[#667781]">{sub}</div>}
    </div>
  );
}
