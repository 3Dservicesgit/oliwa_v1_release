/**
 * AuditPage — Customer Audit Trail
 *
 * Shows a chronological timeline of all actions on the customer's account:
 * token purchases, device pauses/restores, geofence changes, report
 * generations, login events, and more.
 *
 * Features:
 *   - KPI stats strip (total events, warnings, critical, flagged, last activity)
 *   - Filter bar: search, domain, severity, time range
 *   - Activity timeline with color-coded events
 *   - Expandable detail panel per event
 *   - Flag/bookmark suspicious events
 *   - Delete events with confirmation
 *
 * SECURITY: Events are filtered server-side by the customer's tenant_id.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getCookie } from "../../utils/cookies";
import { getAuditEvents, getAuditKpis, flagAuditEvent, deleteAuditEvent } from "../../api/services/audit.service";
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

function formatTimestamp(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleString("en-UG", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

// ── Page ───────────────────────────────────────────────────────────────────

export function AuditPage() {
  const { state: authState } = useAuth();
  // Use accountRoot (client UID) for tenant scoping — audit events are logged
  // with account_root as tenant_id, not accountUid (individual user UID).
  const accountRoot = authState.accountRoot || getCookie("_nvxs_account_root") || "";

  // Data
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("");
  const [severity, setSeverity] = useState("");
  const [range, setRange] = useState("30d");

  // UI state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchedRef = useRef(false);

  // ── Fetch events ─────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const filters: AuditFilters = { range };
      if (domain) filters.domain = domain as AuditDomain;
      if (severity) filters.severity = severity as AuditSeverity;
      if (search.trim()) filters.search = search.trim();
      if (accountRoot) filters.tenant_id = accountRoot;

      const res = await getAuditEvents(filters);
      setEvents(Array.isArray(res?.data) ? res.data : []);
    } catch {
      // Keep existing
    } finally {
      setLoading(false);
    }
  }, [domain, severity, range, search, accountRoot]);

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

  // ── Action handlers ──────────────────────────────────────────────────
  const handleFlag = async (evt: AuditEvent) => {
    setActionLoading(evt.id);
    try {
      const newFlagged = !evt.flagged;
      await flagAuditEvent(evt.id, newFlagged);
      setEvents((prev) =>
        prev.map((e) => (e.id === evt.id ? { ...e, flagged: newFlagged } : e))
      );
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (eventId: string) => {
    setActionLoading(eventId);
    try {
      await deleteAuditEvent(eventId);
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      setDeleteConfirmId(null);
      setExpandedId(null);
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  // Derived stats
  const totalEvents = events.length;
  const warnCount = events.filter((e) => e.severity === "Warn").length;
  const critCount = events.filter((e) => e.severity === "Alarm" || e.severity === "Crit").length;
  const lastActivity = events[0] ? timeAgo(events[0].timestamp) : "—";
  const flaggedCount = events.filter((e) => e.flagged).length;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <main className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-3 p-3">

          {/* Header */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <div className="flex items-baseline gap-3">
              <span className="font-black text-[18px] text-[#111B21] tracking-wide">AUDIT TRAIL</span>
              <span className="text-[13px] text-[#667781]">{"—"} Account activity log</span>
            </div>
          </div>

          {/* KPI Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <KpiCard label="Total Events" value={String(totalEvents)} sub={`Last ${range}`} color="teal" loading={loading} />
            <KpiCard label="Warnings" value={String(warnCount)} sub="Attention needed" color="orange" loading={loading} />
            <KpiCard label="Critical Actions" value={String(critCount)} sub="High severity" color="red" loading={loading} />
            <KpiCard label="Flagged" value={String(flaggedCount)} sub="Marked suspicious" color="purple" loading={loading} />
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
                <div className="text-[28px] mb-2">&#128203;</div>
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
                    const isExpanded = expandedId === evt.id;
                    const isDeleting = deleteConfirmId === evt.id;
                    const isBusy = actionLoading === evt.id;

                    return (
                      <div key={evt.id || i} className={`flex gap-3 relative ${evt.flagged ? "bg-[#EF4444]/[0.03] -mx-2 px-2 rounded-lg" : ""}`}>
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
                                {evt.action} {"—"} {evt.object}
                              </div>
                              {evt.actor && (
                                <div className="text-[10px] text-[#667781] mt-0.5">
                                  by {evt.actor}
                                  {evt.ip_address && <span> {"·"} {evt.ip_address}</span>}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Flag indicator */}
                              {evt.flagged && (
                                <span className="text-[9px] font-black text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded-full">FLAGGED</span>
                              )}
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black ${sev.bg} ${sev.text}`}>
                                {evt.severity}
                              </span>
                              <span className="text-[10px] font-black text-[#667781] bg-[#F0F2F5] px-1.5 py-0.5 rounded">
                                {domLabel}
                              </span>
                              <span className="text-[10px] text-[#667781] min-w-[50px] text-right">
                                {timeAgo(evt.timestamp)}
                              </span>
                              {/* Action buttons */}
                              <div className="flex items-center gap-0.5 ml-1">
                                <button
                                  onClick={() => setExpandedId(isExpanded ? null : evt.id)}
                                  title="View Details"
                                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#F0F2F5] text-[#667781] hover:text-[#128C7E] transition-all"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    {isExpanded
                                      ? <polyline points="18 15 12 9 6 15" />
                                      : <polyline points="6 9 12 15 18 9" />
                                    }
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleFlag(evt)}
                                  disabled={isBusy}
                                  title={evt.flagged ? "Unflag" : "Flag as Suspicious"}
                                  className={`w-6 h-6 flex items-center justify-center rounded transition-all ${
                                    evt.flagged
                                      ? "bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20"
                                      : "hover:bg-[#F0F2F5] text-[#667781] hover:text-[#F97316]"
                                  }`}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill={evt.flagged ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                                    <line x1="4" y1="22" x2="4" y2="15" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(isDeleting ? null : evt.id)}
                                  disabled={isBusy}
                                  title="Delete Event"
                                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#EF4444]/10 text-[#667781] hover:text-[#EF4444] transition-all"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Delete confirmation */}
                          {isDeleting && (
                            <div className="mt-2 p-2 rounded-lg bg-[#EF4444]/5 border border-[#EF4444]/20 flex items-center gap-2">
                              <span className="text-[11px] text-[#EF4444] font-black">Delete this event?</span>
                              <button
                                onClick={() => handleDelete(evt.id)}
                                disabled={isBusy}
                                className="h-6 px-2 rounded bg-[#EF4444] text-white text-[10px] font-black hover:bg-[#DC2626] transition-all disabled:opacity-50"
                              >
                                {isBusy ? "Deleting..." : "Yes, Delete"}
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="h-6 px-2 rounded bg-[#F0F2F5] text-[#667781] text-[10px] font-black hover:bg-[#E9EDEF] transition-all"
                              >
                                Cancel
                              </button>
                            </div>
                          )}

                          {/* Expanded details panel */}
                          {isExpanded && (
                            <div className="mt-2 p-3 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] space-y-2">
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                <DetailRow label="Event ID" value={evt.id} />
                                <DetailRow label="Timestamp" value={formatTimestamp(evt.timestamp)} />
                                <DetailRow label="Actor" value={evt.actor} />
                                <DetailRow label="Action" value={evt.action} />
                                <DetailRow label="Domain" value={`${evt.domain} (${domLabel})`} />
                                <DetailRow label="Severity" value={evt.severity} />
                                <DetailRow label="IP Address" value={evt.ip_address || "N/A"} />
                                <DetailRow label="Tenant ID" value={evt.tenant_id || "N/A"} />
                              </div>
                              {/* Hash chain info */}
                              <div className="pt-2 border-t border-[#E9EDEF]">
                                <div className="text-[10px] font-black text-[#667781] uppercase tracking-wider mb-1">Hash Chain (Tamper Evidence)</div>
                                <div className="grid grid-cols-1 gap-1">
                                  <DetailRow label="Current Hash" value={evt.hash_this || "N/A"} mono />
                                  <DetailRow label="Previous Hash" value={evt.hash_prev || "N/A"} mono />
                                </div>
                              </div>
                              {/* Description */}
                              <div className="pt-2 border-t border-[#E9EDEF]">
                                <div className="text-[10px] font-black text-[#667781] uppercase tracking-wider mb-1">Description</div>
                                <p className="text-[11px] text-[#111B21]">{evt.object}</p>
                              </div>
                              {/* Meta payload */}
                              {evt.meta && Object.keys(evt.meta).length > 0 && (
                                <div className="pt-2 border-t border-[#E9EDEF]">
                                  <div className="text-[10px] font-black text-[#667781] uppercase tracking-wider mb-1">Metadata</div>
                                  <pre className="text-[10px] text-[#111B21] bg-white p-2 rounded border border-[#E9EDEF] overflow-x-auto font-mono whitespace-pre-wrap">
                                    {JSON.stringify(evt.meta, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
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

// ── Detail Row ────────────────────────────────────────────────────────────

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5 min-w-0">
      <span className="text-[10px] font-black text-[#667781] shrink-0">{label}:</span>
      <span className={`text-[11px] text-[#111B21] truncate ${mono ? "font-mono text-[10px]" : ""}`} title={value}>
        {value}
      </span>
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color = "teal", loading = false,
}: {
  label: string; value: string; sub?: string;
  color?: "teal" | "orange" | "red" | "blue" | "purple";
  loading?: boolean;
}) {
  const valueColor = {
    teal:   "text-[#128C7E]",
    orange: "text-[#F97316]",
    red:    "text-[#EF4444]",
    blue:   "text-[#3B82F6]",
    purple: "text-[#7C3AED]",
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
