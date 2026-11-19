/**
 * DriverScoring — driver scorecards and the rules they are scored by, as in
 * the OLIWA mobile app (driver_scoring_screen.dart).
 *
 * Every driver starts a period at 100; each violation takes off its rule's
 * points (navas-core-apis driver_scoring.py). Violations come from alerts
 * (speeding, geofence, an expired permit while driving) and flagged fuel, so
 * speeding and geofence breaches only count where those alert rules are set
 * up on the vehicles.
 *
 *   ScoringRules       one rule per violation; edit points and the most a
 *                      rule may take off, or go back to the default
 *   Scorecards         every driver ranked for a period
 *   ScorecardSection   one driver's card, in the driver's details panel
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  getDriverScorecard, getDriverScoreRules, getScorecards, resetScoreRule, saveScoreRule,
} from "../../api/services/drivers.service";
import type {
  DriverScoreRule, DriverScorecard, DriverScorecardDetail, ScorecardList,
} from "../../api/types/drivers.types";
import { Badge, BTN, BTN_PRIMARY, CARD, ErrorBanner, INPUT_INLINE, Notice, type Tone } from "../../components/ui/records";
import { errText } from "../../components/ui/recordUtils";

// ── shared ──────────────────────────────────────────────────────────────────

const GRADE_TONE: Record<string, Tone> = { A: "green", B: "teal", C: "amber", D: "red" };

export function GradeBadge({ card }: { card: Pick<DriverScorecard, "grade" | "grade_label"> }) {
  if (!card.grade) return <Badge tone="grey">{card.grade_label || "No driving"}</Badge>;
  return <Badge tone={GRADE_TONE[card.grade] ?? "grey"}>{card.grade} · {card.grade_label}</Badge>;
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-[#8696A0]";
  if (score >= 90) return "text-[#0B7A4B]";
  if (score >= 75) return "text-[#0F766E]";
  if (score >= 60) return "text-[#B45309]";
  return "text-[#B91C1C]";
}

/** The periods offered: the last N days, ending today. */
const PERIODS: { days: number; label: string }[] = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
];

/** DD-MM-YYYY for the server. */
function ddmmyyyy(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function periodDates(days: number): [string, string] {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return [ddmmyyyy(start), ddmmyyyy(end)];
}

function notAvailable(e: unknown): string {
  const msg = errText(e);
  return /404|no such endpoint/i.test(msg) ? "Driver scoring is not available on the server yet." : msg;
}

// ── rules ───────────────────────────────────────────────────────────────────

function RuleRow({ rule, canManage, onSaved }: {
  rule: DriverScoreRule;
  canManage: boolean;
  onSaved: (rules: DriverScoreRule[], message: string) => void;
}) {
  const [points, setPoints] = useState(String(rule.points_denomination ?? ""));
  const [cap, setCap] = useState(rule.max_deduction == null ? "" : String(rule.max_deduction));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = points !== String(rule.points_denomination ?? "") ||
    cap !== (rule.max_deduction == null ? "" : String(rule.max_deduction));

  const problem = (): string | null => {
    const p = Number(points);
    if (!/^\d+$/.test(points.trim()) || p > 100) return "Points: a whole number from 0 to 100.";
    if (cap.trim()) {
      const c = Number(cap);
      if (!/^\d+$/.test(cap.trim()) || c < 1 || c > 100) return "Most per period: 1 to 100, or empty.";
      if (p > 0 && c < p) return "Most per period cannot be less than one violation.";
    }
    return null;
  };

  const save = async () => {
    const bad = problem();
    if (bad) { setError(bad); return; }
    setBusy(true);
    setError(null);
    try {
      const rules = await saveScoreRule(rule, {
        violation_parameter: rule.violation_parameter,
        points_denomination: Number(points),
        max_deduction: cap.trim() ? Number(cap) : null,
        score_name: rule.violation_label,
      });
      onSaved(rules, `${rule.violation_label}: saved.`);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await resetScoreRule(rule.score_uid), `${rule.violation_label}: back to the default.`);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const off = Number(rule.points_denomination) === 0;
  return (
    <tr className="border-t border-[#E9EDEF] align-top">
      <td className="px-4 py-2.5">
        <div className="font-extrabold text-[#111B21]">{rule.violation_label}</div>
        <div className="flex gap-1.5 mt-1 flex-wrap">
          {rule.is_default ? <Badge tone="grey">Default</Badge> : <Badge tone="teal">Yours</Badge>}
          {!rule.measured && <Badge tone="amber">Not measured yet</Badge>}
          {off && <Badge tone="grey">Off</Badge>}
        </div>
        {error && <div className="text-[11px] text-[#B00020] mt-1">{error}</div>}
      </td>
      <td className="px-4 py-2.5">
        {canManage ? (
          <input className={`${INPUT_INLINE} w-20 text-right`} inputMode="numeric" aria-label={`${rule.violation_label} points`}
            value={points} onChange={(e) => setPoints(e.target.value)} />
        ) : <span className="font-black text-[#B91C1C]">−{rule.points_denomination ?? 0}</span>}
      </td>
      <td className="px-4 py-2.5">
        {canManage ? (
          <input className={`${INPUT_INLINE} w-20 text-right`} inputMode="numeric" placeholder="No limit"
            aria-label={`${rule.violation_label} most per period`}
            value={cap} onChange={(e) => setCap(e.target.value)} />
        ) : <span className="text-[#667781]">{rule.max_deduction ?? "No limit"}</span>}
      </td>
      {canManage && (
        <td className="px-4 py-2.5 text-right whitespace-nowrap">
          <button type="button" className={BTN_PRIMARY} disabled={busy || !dirty} onClick={() => void save()}>Save</button>
          {!rule.is_default && (
            <button type="button" className={`${BTN} ml-1.5`} disabled={busy} onClick={() => void reset()}>Use default</button>
          )}
        </td>
      )}
    </tr>
  );
}

export function ScoringRules({ canManage }: { canManage: boolean }) {
  const [rules, setRules] = useState<DriverScoreRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    getDriverScoreRules()
      .then((r) => { if (alive) { setRules(r); setError(null); } })
      .catch((e) => { if (alive) setError(notAvailable(e)); });
    return () => { alive = false; };
  }, [version]);

  return (
    <div className="flex flex-col gap-3">
      {notice && <Notice text={notice} onClose={() => setNotice(null)} />}
      <div className={`${CARD} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-[#E9EDEF] text-[12px] text-[#667781] leading-relaxed">
          Every driver starts each period at <b>100</b>. Each violation takes off its points, at most the
          "most per period" if you set one. 0 points stops counting a violation. Speeding and geofence breaches
          only count on vehicles with those alert rules set up (Alerts &amp; Events).
        </div>
        {error ? <div className="p-4"><ErrorBanner text={error} onRetry={() => setVersion((v) => v + 1)} /></div>
          : rules === null ? <div className="p-8 text-center text-[13px] text-[#667781]">Loading…</div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] font-extrabold text-[#667781] bg-[#F8F9FA]">
                    <th className="px-4 py-2">Violation</th>
                    <th className="px-4 py-2">Points each</th>
                    <th className="px-4 py-2">Most per period</th>
                    {canManage && <th className="px-4 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <RuleRow key={`${r.score_uid}-${r.points_denomination}-${r.max_deduction}`} rule={r} canManage={canManage}
                      onSaved={(next, message) => { setRules(next); setNotice(message); }} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}

// ── ranking ─────────────────────────────────────────────────────────────────

function breakdownText(card: DriverScorecard): string {
  const parts = card.breakdown.filter((b) => b.count > 0).map((b) => `${b.label} ×${b.count}`);
  return parts.length ? parts.join(", ") : "No violations";
}

export function Scorecards({ onOpen }: { onOpen: (driverUid: string) => void }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<ScorecardList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    const [start, end] = periodDates(days);
    getScorecards(start, end)
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError(notAvailable(e)); });
    return () => { alive = false; };
  }, [days, version]);

  const stats = useMemo(() => {
    const scored = (data?.drivers ?? []).filter((c) => c.score !== null);
    const avg = scored.length ? Math.round(scored.reduce((s, c) => s + (c.score ?? 0), 0) / scored.length) : null;
    return {
      scored: scored.length,
      avg,
      poor: scored.filter((c) => c.grade === "D").length,
      violations: scored.reduce((s, c) => s + c.violation_count, 0),
    };
  }, [data]);

  const loading = data === null && !error;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <select aria-label="Period" className={INPUT_INLINE} value={days} onChange={(e) => { setData(null); setDays(Number(e.target.value)); }}>
          {PERIODS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
        </select>
        {data && <span className="text-[12px] text-[#667781]">{data.start_date} to {data.end_date}</span>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([["Drivers scored", stats.scored], ["Average score", stats.avg ?? "—"],
          ["Poor (below 60)", stats.poor], ["Violations", stats.violations]] as [string, string | number][]).map(([label, n]) => (
          <div key={label} className={`${CARD} px-4 py-3`}>
            <div className="text-[11px] font-extrabold text-[#667781]">{label}</div>
            <div className={`text-[22px] font-black ${label.startsWith("Poor") && Number(n) > 0 ? "text-[#B91C1C]" : "text-[#111B21]"}`}>
              {loading || error ? "—" : n}
            </div>
          </div>
        ))}
      </div>

      {error && <ErrorBanner text={error} onRetry={() => setVersion((v) => v + 1)} />}
      {!error && (
        <div className={`${CARD} overflow-hidden`}>
          {loading ? <div className="p-8 text-center text-[13px] text-[#667781]">Scoring drivers…</div>
            : !data || data.drivers.length === 0 ? <div className="p-8 text-center text-[13px] text-[#667781]">No drivers yet.</div>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] font-extrabold text-[#667781] bg-[#F8F9FA]">
                      <th className="px-4 py-2 w-12">#</th>
                      <th className="px-4 py-2">Driver</th>
                      <th className="px-4 py-2 text-right">Score</th>
                      <th className="px-4 py-2">Grade</th>
                      <th className="px-4 py-2">Violations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.drivers.map((c) => (
                      <tr key={c.driver_uid} onClick={() => onOpen(c.driver_uid)}
                        className="border-t border-[#E9EDEF] cursor-pointer hover:bg-[#F8F9FA]">
                        <td className="px-4 py-2.5 font-black text-[#667781]">{c.rank ?? "—"}</td>
                        <td className="px-4 py-2.5 font-extrabold text-[#111B21]">{c.full_name}</td>
                        <td className={`px-4 py-2.5 text-right text-[16px] font-black ${scoreColor(c.score)}`}>{c.score ?? "—"}</td>
                        <td className="px-4 py-2.5"><GradeBadge card={c} /></td>
                        <td className="px-4 py-2.5 text-[12px] text-[#667781]">
                          {c.score === null ? "Did not drive" : breakdownText(c)}
                          {c.deducted > 0 && <span className="text-[#B91C1C] font-extrabold"> · −{c.deducted}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

// ── one driver ──────────────────────────────────────────────────────────────

export function ScorecardSection({ driverUid }: { driverUid: string }) {
  const [days, setDays] = useState(30);
  const [card, setCard] = useState<DriverScorecardDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    const [start, end] = periodDates(days);
    getDriverScorecard(driverUid, start, end)
      .then((c) => { if (alive) { setCard(c); setError(null); } })
      .catch((e) => { if (alive) setError(notAvailable(e)); });
    return () => { alive = false; };
  }, [driverUid, days]);

  const violations = card?.violations ?? [];
  const shown = showAll ? violations : violations.slice(0, 5);
  return (
    <section>
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="font-black text-[13px] text-[#111B21]">Scorecard</div>
        <select aria-label="Scorecard period" className={`${INPUT_INLINE} h-7 text-[12px]`} value={days}
          onChange={(e) => { setCard(null); setDays(Number(e.target.value)); }}>
          {PERIODS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
        </select>
      </div>
      {error ? <div className="text-[12px] text-[#B00020]">{error}</div>
        : !card ? <div className="text-[12px] text-[#667781]">Scoring…</div>
        : (
          <div className="border border-[#E9EDEF] rounded-lg p-3 flex flex-col gap-2.5">
            <div className="flex items-center gap-4">
              <div className={`text-[34px] font-black leading-none ${scoreColor(card.score)}`}>{card.score ?? "—"}</div>
              <div className="flex flex-col gap-1">
                <GradeBadge card={card} />
                <div className="text-[12px] text-[#667781]">
                  {card.score === null ? "Did not drive in this period."
                    : `${card.rank ? `Rank ${card.rank} of ${card.ranked_drivers}` : ""}${card.deducted ? ` · ${card.deducted} points off` : " · No points off"}`}
                </div>
              </div>
            </div>
            {card.breakdown.some((b) => b.count > 0) && (
              <div className="flex flex-col gap-1">
                {card.breakdown.filter((b) => b.count > 0).map((b) => (
                  <div key={b.violation} className="flex justify-between text-[12px]">
                    <span className="text-[#111B21]">{b.label} ×{b.count}</span>
                    <span className="font-extrabold text-[#B91C1C]">{b.deducted ? `−${b.deducted}` : "not counted"}</span>
                  </div>
                ))}
              </div>
            )}
            {violations.length > 0 && (
              <div className="flex flex-col gap-1 border-t border-[#F0F2F5] pt-2">
                {shown.map((v, i) => (
                  <div key={`${v.at}-${i}`} className="text-[11px] text-[#667781]">
                    <span className="font-extrabold text-[#111B21]">{v.label}</span> · {v.at}{v.vehicle ? ` · ${v.vehicle}` : ""}
                    {v.detail && <div className="truncate" title={v.detail}>{v.detail}</div>}
                  </div>
                ))}
                {violations.length > 5 && (
                  <button type="button" onClick={() => setShowAll((s) => !s)}
                    className="self-start text-[11px] font-extrabold text-[var(--brand)] bg-transparent border-0 cursor-pointer p-0">
                    {showAll ? "Show fewer" : `Show all ${violations.length}`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
    </section>
  );
}
