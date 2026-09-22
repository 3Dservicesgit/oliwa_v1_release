/**
 * TeamAuditPage — "Audit Trail" for a client account.
 *
 * Who in the account signed in and when, failed sign-in attempts, and changes
 * to the team (users added, blocked, removed, roles and passwords changed).
 * Limited by the server to the client's own account (GET /team/audit).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getTeamAudit } from "../../api/services/team.service";
import type { TeamAuditEvent, TeamAuditKind } from "../../api/types/team.types";

const PERIODS = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const KINDS: { kind: TeamAuditKind; label: string }[] = [
  { kind: "all", label: "Everything" },
  { kind: "signins", label: "Sign-ins" },
  { kind: "failed", label: "Failed sign-ins" },
  { kind: "team", label: "Team changes" },
];

const ACTION_LABEL: Record<string, { text: string; tone: string }> = {
  LOGIN: { text: "Signed in", tone: "bg-[#DCFCE7] text-[#166534]" },
  LOGOUT: { text: "Signed out", tone: "bg-[#F0F2F5] text-[#667781]" },
  LOGIN_FAILED: { text: "Failed sign-in", tone: "bg-[#FEF2F2] text-[#B91C1C]" },
  TEAM_USER_ADDED: { text: "User added", tone: "bg-[#128C7E]/10 text-[#075E54]" },
  TEAM_USER_CHANGED: { text: "User changed", tone: "bg-[#34B7F1]/10 text-[#0B6E99]" },
  TEAM_PASSWORD_RESET: { text: "Password reset", tone: "bg-[#FEF3C7] text-[#92400E]" },
  TEAM_USER_REMOVED: { text: "User removed", tone: "bg-[#FEF2F2] text-[#B91C1C]" },
};

function label(action: string) {
  return ACTION_LABEL[action] ?? { text: action.replace(/_/g, " ").toLowerCase(), tone: "bg-[#F0F2F5] text-[#667781]" };
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function csv(events: TeamAuditEvent[]): string {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = events.map((e) => [when(e.timestamp), e.who, label(e.action).text, e.detail, e.ip_address].map(esc).join(","));
  return ["When,Who,What,Detail,IP address", ...rows].join("\n");
}

export function TeamAuditPage() {
  const [days, setDays] = useState(7);
  const [kind, setKind] = useState<TeamAuditKind>("all");
  const [events, setEvents] = useState<TeamAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [who, setWho] = useState("");

  const load = useCallback(async (d: number, k: TeamAuditKind) => {
    setLoading(true);
    try {
      const res = await getTeamAudit(d, k);
      setEvents(res.data ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the audit trail.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(days, kind); }, [load, days, kind]);

  const people = useMemo(() => Array.from(new Set(events.map((e) => e.who))).sort(), [events]);
  const shown = useMemo(() => (who ? events.filter((e) => e.who === who) : events), [events, who]);
  const stats = useMemo(() => ({
    signins: events.filter((e) => e.action === "LOGIN").length,
    failed: events.filter((e) => e.action === "LOGIN_FAILED").length,
    users: new Set(events.filter((e) => e.action === "LOGIN").map((e) => e.who)).size,
  }), [events]);

  const download = () => {
    const blob = new Blob([csv(shown)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const chip = (on: boolean) =>
    `h-8 px-3 rounded-full border text-[12px] font-extrabold cursor-pointer ${on ? "bg-[#128C7E]/10 border-[#128C7E]/30 text-[#128C7E]" : "bg-white border-[#E9EDEF] text-[#667781]"}`;

  return (
    <div className="flex flex-col h-full w-full bg-[#F0F2F5] p-3 gap-3 overflow-y-auto">
      <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3 flex items-start justify-between gap-4">
        <div>
          <div className="font-black text-[16px] text-[#111B21]">Audit Trail</div>
          <div className="text-[12px] text-[#667781] mt-0.5">Who in your account signed in and when, and every change to your team.</div>
        </div>
        <button type="button" onClick={download} disabled={!shown.length}
          className="shrink-0 h-9 px-4 rounded-lg border border-[#E9EDEF] bg-white text-[12px] font-extrabold text-[#111B21] cursor-pointer disabled:opacity-50">
          Download CSV
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[["Sign-ins", stats.signins], ["People who signed in", stats.users], ["Failed sign-ins", stats.failed]].map(([l, n]) => (
          <div key={l} className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <div className="text-[11px] font-extrabold text-[#667781]">{l}</div>
            <div className={`text-[22px] font-black ${l === "Failed sign-ins" && Number(n) > 0 ? "text-[#B91C1C]" : "text-[#111B21]"}`}>{loading ? "—" : n}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3 flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button key={p.days} type="button" className={chip(days === p.days)} onClick={() => setDays(p.days)}>{p.label}</button>
        ))}
        <span className="w-px h-6 bg-[#E9EDEF] mx-1" />
        {KINDS.map((k) => (
          <button key={k.kind} type="button" className={chip(kind === k.kind)} onClick={() => setKind(k.kind)}>{k.label}</button>
        ))}
        <select aria-label="Filter by person" value={who} onChange={(e) => setWho(e.target.value)}
          className="ml-auto h-8 px-2 rounded-lg border border-[#E9EDEF] text-[12px] bg-white">
          <option value="">Everyone</option>
          {people.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {error && <div role="alert" className="text-[12px] text-[#B00020] bg-[#FFF5F5] border border-[#FFD6D6] rounded-lg px-3 py-2">{error}</div>}

      <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[13px] text-[#667781]">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-[#667781]">Nothing recorded in this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] font-extrabold text-[#667781] bg-[#F8F9FA]">
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Who</th>
                  <th className="px-4 py-2">What</th>
                  <th className="px-4 py-2">Detail</th>
                  <th className="px-4 py-2">IP address</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e, i) => {
                  const l = label(e.action);
                  return (
                    <tr key={`${e.timestamp}-${i}`} className="border-t border-[#E9EDEF]">
                      <td className="px-4 py-2.5 whitespace-nowrap text-[#111B21]">{when(e.timestamp)}</td>
                      <td className="px-4 py-2.5 font-extrabold text-[#111B21]">{e.who}</td>
                      <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${l.tone}`}>{l.text}</span></td>
                      <td className="px-4 py-2.5 text-[#667781]">{e.detail}</td>
                      <td className="px-4 py-2.5 text-[12px] text-[#667781] font-mono">{e.ip_address || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && events.length >= 500 && (
        <div className="text-[11px] text-[#667781] px-1">Showing the latest 500 events — choose a shorter period to see everything.</div>
      )}
    </div>
  );
}
