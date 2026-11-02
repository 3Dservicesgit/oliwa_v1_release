/**
 * FuelPage — FuelMath, as in the OLIWA mobile app: fuel issued to drivers
 * over a period, checked by the server against what the tracker saw. Three
 * views: the issues, each vehicle (with its fuel profile), each driver.
 *
 * Backend: navas-core-apis endpoints/fuel_registry.py. Everything is limited
 * to the signed-in customer's own records by the server. Viewers see the
 * records; Operators and Administrators also record, review and void.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  getFuelCapabilities, getFuelIssues, getFuelProfiles, getFuelSummary,
} from "../../api/services/fuel.service";
import type { FuelCapability, FuelIssue, FuelProfile, FuelSummary } from "../../api/types/fuel.types";
import { usePermissions } from "../../auth/PermissionsContext";
import { useClientUnits } from "../../hooks/useClientUnits";
import {
  BTN, BTN_PRIMARY, CARD, ErrorBanner, INPUT, INPUT_INLINE, Notice,
} from "../../components/ui/records";
import { errText, isoDay, whenText } from "../../components/ui/recordUtils";
import { FuelIssuePanel, FuelProfilePanel, RecordFuelPanel, ReviewBadge } from "./FuelPanels";
import { driverLabel, fuelLabel, fuelNum, isReviewed, litres, needsReview, ugx } from "./fuelFormat";

type View = "issues" | "vehicles" | "drivers";
type Filter = "all" | "open" | "reviewed" | "voided";

const EMPTY: FuelSummary = { totals: { issues: 0, litres: 0, cost: 0, open_reviews: 0, excess_cost: 0 }, vehicles: [], drivers: [] };

function thisMonth(): { from: string; to: string } {
  const now = new Date();
  return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDay(now) };
}

export function FuelPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("fuel.manage");
  const units = useClientUnits();
  const [period, setPeriod] = useState(thisMonth);
  const [view, setView] = useState<View>("issues");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState<FuelSummary>(EMPTY);
  const [issues, setIssues] = useState<FuelIssue[]>([]);
  const [profiles, setProfiles] = useState<Record<string, FuelProfile>>({});
  const [capabilities, setCapabilities] = useState<Record<string, FuelCapability>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recording, setRecording] = useState<{ imei?: string } | null>(null);
  const [open, setOpen] = useState<{ uid: string; notice?: string } | null>(null);
  const [profileFor, setProfileFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, list, p] = await Promise.all([
        getFuelSummary(period.from, period.to),
        getFuelIssues({ from: period.from, to: period.to, includeVoided: true }),
        getFuelProfiles(),
      ]);
      setSummary(s);
      setIssues(list);
      setProfiles(p);
    } catch (e) {
      const msg = errText(e);
      setError(/404|no such endpoint/i.test(msg) ? "FuelMath is not available on the server yet." : msg);
    } finally {
      setLoading(false);
    }
    // Which vehicles have a fuel sensor: extra, so a failure is not shown.
    getFuelCapabilities().then(setCapabilities).catch(() => setCapabilities({}));
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  const t = summary.totals;
  const openCount = issues.filter(needsReview).length;

  const shownIssues = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues.filter((i) => {
      const keep = filter === "open" ? needsReview(i)
        : filter === "reviewed" ? isReviewed(i) && !i.voided
        : filter === "voided" ? i.voided
        : !i.voided;
      return keep && (!q || `${units.label(i.device_imei)} ${driverLabel(i)} ${i.station_name} ${i.receipt_number ?? ""}`.toLowerCase().includes(q));
    });
  }, [issues, filter, search, units]);

  // Every vehicle, so a profile can be set before its first issue: those
  // with fuel this period first, by spend.
  const vehicleRows = useMemo(() => {
    const totals = new Map(summary.vehicles.map((v) => [v.device_imei, v]));
    const rest = units.units.map((u) => u.device_imei).filter((imei) => !totals.has(imei));
    return [...summary.vehicles.map((v) => v.device_imei), ...rest].map((imei) => ({ imei, total: totals.get(imei) }));
  }, [summary, units.units]);

  const periodText = `${new Date(period.from).toLocaleDateString(undefined, { dateStyle: "medium" })} – ${new Date(period.to).toLocaleDateString(undefined, { dateStyle: "medium" })}`;

  return (
    <div className="flex flex-col h-full w-full bg-[#F0F2F5] p-3 gap-3 overflow-y-auto">
      <div className={`${CARD} px-4 py-3 flex items-start justify-between gap-4 flex-wrap`}>
        <div>
          <div className="font-black text-[16px] text-[#111B21]">FuelMath</div>
          <div className="text-[12px] text-[#667781] mt-0.5">Fuel issued to drivers, checked against where the tracker says each vehicle was and how far it drove.</div>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <label className="text-[11px] font-extrabold text-[#667781]">From
            <input type="date" className={`${INPUT_INLINE} block mt-1`} value={period.from} max={period.to}
              onChange={(e) => e.target.value && setPeriod((p) => ({ ...p, from: e.target.value }))} />
          </label>
          <label className="text-[11px] font-extrabold text-[#667781]">To
            <input type="date" className={`${INPUT_INLINE} block mt-1`} value={period.to} min={period.from} max={isoDay(new Date())}
              onChange={(e) => e.target.value && setPeriod((p) => ({ ...p, to: e.target.value }))} />
          </label>
          <button type="button" className={BTN} onClick={() => void load()} disabled={loading}>Refresh</button>
          {canManage && !error && <button type="button" className={BTN_PRIMARY} onClick={() => { setNotice(null); setRecording({}); }}>+ Record fuel</button>}
        </div>
      </div>

      {error ? <ErrorBanner text={error} onRetry={() => void load()} /> : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[["Spent", ugx(t.cost)], ["Issued", litres(t.litres)], ["To review", String(t.open_reviews)]].map(([label, value]) => (
              <div key={label} className={`${CARD} px-4 py-3`}>
                <div className="text-[11px] font-extrabold text-[#667781]">{label}</div>
                <div className={`text-[20px] font-black ${label === "To review" && t.open_reviews > 0 ? "text-[#B45309]" : "text-[#111B21]"}`}>{loading ? "…" : value}</div>
              </div>
            ))}
          </div>
          {!loading && t.excess_cost > 0 && (
            <div className="rounded-xl px-4 py-3 bg-[#FFFBEB] border border-[#FDE68A] text-[13px] text-[#92400E] font-semibold">
              ↗ {ugx(t.excess_cost)} of fuel above what the distance driven needs ({periodText}).
            </div>
          )}
        </>
      )}

      {notice && <Notice text={notice} onClose={() => setNotice(null)} />}

      {/* The records could not be read: the banner says why; no empty lists. */}
      {!error && <>
      <div className="flex gap-1.5 flex-wrap">
        {([["issues", `Issues${openCount ? ` · ${openCount} to review` : ""}`], ["vehicles", "Vehicles"], ["drivers", "Drivers"]] as [View, string][]).map(([v, label]) => (
          <button key={v} type="button" onClick={() => setView(v)}
            className={`h-8 px-3 rounded-full text-[12px] font-extrabold cursor-pointer border ${view === v ? "bg-[#075E54] border-[#075E54] text-white" : "bg-white border-[#E9EDEF] text-[#111B21]"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className={`${CARD} overflow-hidden`}>
        {view === "issues" && (
          <>
            <div className="px-4 py-3 border-b border-[#E9EDEF] flex gap-2 flex-wrap">
              <input className={`${INPUT} flex-1 min-w-[200px]`} placeholder="Search vehicle, driver, station or receipt…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search issues" />
              <select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className={INPUT_INLINE}>
                <option value="all">All issues</option>
                <option value="open">Needs review</option>
                <option value="reviewed">Reviewed</option>
                <option value="voided">Voided</option>
              </select>
            </div>
            {loading ? <div className="p-8 text-center text-[13px] text-[#667781]">Loading fuel records…</div>
              : shownIssues.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-[#667781]">
                  {issues.length ? "No issue matches." : `No fuel recorded in this period.${canManage ? " Use Record fuel to add a receipt." : ""}`}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-[11px] font-extrabold text-[#667781] bg-[#F8F9FA]">
                        <th className="px-4 py-2">When</th><th className="px-4 py-2">Vehicle</th><th className="px-4 py-2">Driver</th>
                        <th className="px-4 py-2 text-right">Litres</th><th className="px-4 py-2 text-right">Total</th>
                        <th className="px-4 py-2">Station</th><th className="px-4 py-2">Checks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownIssues.map((i) => (
                        <tr key={i.issue_uid} onClick={() => setOpen({ uid: i.issue_uid })}
                          className={`border-t border-[#E9EDEF] cursor-pointer hover:bg-[#F8F9FA] ${i.voided ? "opacity-60" : ""}`}>
                          <td className="px-4 py-2.5 whitespace-nowrap">{whenText(i.issued_at)}</td>
                          <td className="px-4 py-2.5 font-extrabold text-[#111B21]">{units.label(i.device_imei)}</td>
                          <td className={`px-4 py-2.5 ${i.driver_uid ? "" : "text-[#8696A0]"}`}>{driverLabel(i)}</td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">{litres(fuelNum(i.litres))}{i.full_tank ? " · full" : ""}</td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">{ugx(fuelNum(i.total_cost))}</td>
                          <td className="px-4 py-2.5">{i.station_name}</td>
                          <td className="px-4 py-2.5"><ReviewBadge issue={i} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </>
        )}

        {view === "vehicles" && (
          loading ? <div className="p-8 text-center text-[13px] text-[#667781]">Loading…</div>
            : vehicleRows.length === 0 ? <div className="p-8 text-center text-[13px] text-[#667781]">{units.error ?? "No vehicles."}</div>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] font-extrabold text-[#667781] bg-[#F8F9FA]">
                      <th className="px-4 py-2">Vehicle</th><th className="px-4 py-2">This period</th><th className="px-4 py-2">Consumption</th>
                      <th className="px-4 py-2">Fuel profile</th><th className="px-4 py-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicleRows.map(({ imei, total: v }) => {
                      const p = profiles[imei];
                      const over = v?.km_per_l != null && v.baseline_km_per_l != null && v.km_per_l < v.baseline_km_per_l;
                      return (
                        <tr key={imei} className="border-t border-[#E9EDEF] align-top">
                          <td className="px-4 py-2.5">
                            <div className="font-extrabold text-[#111B21]">{units.label(imei)}</div>
                            {(v?.open_reviews ?? 0) > 0 && <div className="text-[12px] text-[#B45309]">{v!.open_reviews} to review</div>}
                          </td>
                          <td className="px-4 py-2.5">
                            {v ? <>{litres(v.litres)} · {ugx(v.cost)}<div className="text-[12px] text-[#667781]">{v.issues} {v.issues === 1 ? "issue" : "issues"}</div></>
                              : <span className="text-[#8696A0]">No fuel this period</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            {v?.km_per_l != null ? (
                              <>
                                <span className={over ? "text-[#B45309] font-semibold" : ""}>{v.km_per_l.toFixed(1)} km/L</span>
                                {v.baseline_km_per_l != null && <span className="text-[#667781]"> (expected {v.baseline_km_per_l})</span>}
                                {v.cost_per_km != null && <div className="text-[12px] text-[#667781]">{ugx(v.cost_per_km)}/km</div>}
                                {(v.excess_cost ?? 0) > 0 && <div className="text-[12px] text-[#B45309] font-semibold">{litres(v.excess_litres)} above expected · {ugx(v.excess_cost)}</div>}
                              </>
                            ) : <span className="text-[#8696A0]">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-[12px]">
                            {p ? <span className="text-[#667781]">{fuelLabel(String(p.fuel_type))} · {litres(fuelNum(p.tank_capacity_l))} tank · ±{fuelNum(p.tolerance_pct)}%</span>
                              : <span className="text-[#92400E]">No fuel profile</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            {canManage && (
                              <div className="flex justify-end gap-1.5">
                                <button type="button" className={`${BTN} h-7 px-2.5 text-[11px]`} onClick={() => setProfileFor(imei)}>{p ? "Edit profile" : "Set profile"}</button>
                                <button type="button" className={`${BTN} h-7 px-2.5 text-[11px]`} onClick={() => setRecording({ imei })}>Record fuel</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
        )}

        {view === "drivers" && (
          loading ? <div className="p-8 text-center text-[13px] text-[#667781]">Loading…</div>
            : summary.drivers.length === 0 ? <div className="p-8 text-center text-[13px] text-[#667781]">No fuel issued to drivers in this period.</div>
            : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] font-extrabold text-[#667781] bg-[#F8F9FA]">
                    <th className="px-4 py-2">Driver</th><th className="px-4 py-2 text-right">Issues</th><th className="px-4 py-2 text-right">Litres</th>
                    <th className="px-4 py-2 text-right">Cost</th><th className="px-4 py-2 text-right">Flagged</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.drivers.map((d, idx) => (
                    <tr key={d.driver_uid ?? `none-${idx}`} className="border-t border-[#E9EDEF]">
                      <td className={`px-4 py-2.5 font-extrabold ${d.driver_uid ? "text-[#111B21]" : "text-[#8696A0]"}`}>{d.driver_name || (d.driver_uid ? "Driver" : "No driver recorded")}</td>
                      <td className="px-4 py-2.5 text-right">{d.issues}</td>
                      <td className="px-4 py-2.5 text-right">{litres(d.litres)}</td>
                      <td className="px-4 py-2.5 text-right">{ugx(d.cost)}</td>
                      <td className={`px-4 py-2.5 text-right font-extrabold ${d.flagged > 0 ? "text-[#B45309]" : "text-[#667781]"}`}>{d.flagged}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        )}
      </div>
      </>}

      {recording && (
        <RecordFuelPanel units={units} profiles={profiles} capabilities={capabilities} initialImei={recording.imei}
          onClose={() => setRecording(null)}
          onSetProfile={(imei) => setProfileFor(imei)}
          onRecorded={(issue, message) => { setRecording(null); void load(); setOpen({ uid: issue.issue_uid, notice: message }); }} />
      )}
      {open && (
        <FuelIssuePanel issueUid={open.uid} units={units} profiles={profiles} canManage={canManage} initialNotice={open.notice}
          onClose={() => setOpen(null)} onChanged={() => void load()} />
      )}
      {profileFor && (
        <FuelProfilePanel imei={profileFor} label={units.label(profileFor)} existing={profiles[profileFor]} capability={capabilities[profileFor]}
          onClose={() => setProfileFor(null)}
          onSaved={(p) => { setProfiles((prev) => ({ ...prev, [p.device_imei || profileFor]: p })); setProfileFor(null); setNotice(`Fuel profile saved for ${units.label(profileFor)}.`); }} />
      )}
    </div>
  );
}
