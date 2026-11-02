/**
 * DriversPage — the client's drivers, as in the OLIWA mobile app: register
 * and edit drivers, change their status, put them in a vehicle, and see the
 * scoring rules driver conduct is measured by.
 *
 * Backend: navas-core-apis endpoints/driver_registry.py. Everything is
 * limited to the signed-in customer's own drivers by the server.
 * Viewers see the drivers; Operators and Administrators also change them.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getDriverScoreRules, getDrivers } from "../../api/services/drivers.service";
import type { Driver, DriverScoreRule } from "../../api/types/drivers.types";
import { usePermissions } from "../../auth/PermissionsContext";
import { useClientUnits } from "../../hooks/useClientUnits";
import {
  BTN_PRIMARY, CARD, ErrorBanner, INPUT, INPUT_INLINE, Notice,
} from "../../components/ui/records";
import { errText } from "../../components/ui/recordUtils";
import { DriverAvatar, DriverDetailsPanel, DriverFormPanel, PermitBadge, StatusBadge } from "./DriverPanels";
import { STATUSES, permitClasses, statusLabel } from "./driverRules";

type Tab = "drivers" | "scoring";

function notFound(e: unknown): string {
  const msg = errText(e);
  return /404|not found|no such endpoint/i.test(msg) ? "Drivers are not available on the server yet." : msg;
}

function ScoringRules() {
  const [rules, setRules] = useState<DriverScoreRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    getDriverScoreRules()
      .then((r) => { if (alive) { setRules(r); setError(null); } })
      .catch((e) => { if (alive) setError(notFound(e)); });
    return () => { alive = false; };
  }, [version]);
  const load = () => setVersion((v) => v + 1);
  const v = (r: DriverScoreRule, k: string) => String(r[k] ?? "").trim();
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-[#E9EDEF] text-[12px] text-[#667781]">
        How driver conduct is scored: each violation takes points away from the driver.
      </div>
      {error ? <div className="p-4"><ErrorBanner text={error} onRetry={load} /></div>
        : rules === null ? <div className="p-8 text-center text-[13px] text-[#667781]">Loading…</div>
        : rules.length === 0 ? <div className="p-8 text-center text-[13px] text-[#667781]">No scoring rules set up.</div>
        : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] font-extrabold text-[#667781] bg-[#F8F9FA]">
                <th className="px-4 py-2">Rule</th><th className="px-4 py-2">Violation</th><th className="px-4 py-2 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={i} className="border-t border-[#E9EDEF]">
                  <td className="px-4 py-2.5 font-extrabold text-[#111B21]">{v(r, "score_name") || "Rule"}</td>
                  <td className="px-4 py-2.5 text-[#667781]">{v(r, "violation_parameter") || "—"}</td>
                  <td className="px-4 py-2.5 text-right font-black text-[#B91C1C]">{v(r, "points_denomination") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}

export function DriversPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("drivers.manage");
  const units = useClientUnits();
  const [tab, setTab] = useState<Tab>("drivers");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<{ existing?: Driver } | null>(null);

  // Every driver is loaded once; the status filter and search work on them
  // here, so the counts stay right whichever filter is chosen.
  const load = useCallback(async () => {
    try {
      setDrivers(await getDrivers());
      setError(null);
    } catch (e) {
      setError(notFound(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // The list could not be read: show why, not an empty list or zero counts.
  const failed = !!error && drivers.length === 0;

  const counts = useMemo(() => ({
    total: drivers.length,
    active: drivers.filter((d) => d.status === "active").length,
    assigned: drivers.filter((d) => d.current_imei).length,
    permits: drivers.filter((d) => d.permit_state === "expired" || d.permit_state === "expiring").length,
  }), [drivers]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drivers.filter((d) =>
      (!status || d.status === status) &&
      (!q || `${d.full_name} ${d.phone} ${d.permit_number} ${d.employee_number ?? ""} ${units.label(d.current_imei)}`.toLowerCase().includes(q)));
  }, [drivers, status, search, units]);

  return (
    <div className="flex flex-col h-full w-full bg-[#F0F2F5] p-3 gap-3 overflow-y-auto">
      <div className={`${CARD} px-4 py-3 flex items-start justify-between gap-4`}>
        <div>
          <div className="font-black text-[16px] text-[#111B21]">Drivers</div>
          <div className="text-[12px] text-[#667781] mt-0.5">The people who drive your vehicles: permits, status and who is in which vehicle.</div>
        </div>
        {canManage && tab === "drivers" && !failed && (
          <button type="button" className={`${BTN_PRIMARY} shrink-0`} onClick={() => { setNotice(null); setForm({}); }}>+ Register driver</button>
        )}
      </div>

      <div className="flex gap-1.5">
        {([["drivers", "Drivers"], ["scoring", "Scoring rules"]] as [Tab, string][]).map(([t, label]) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`h-8 px-3 rounded-full text-[12px] font-extrabold cursor-pointer border ${tab === t ? "bg-[#075E54] border-[#075E54] text-white" : "bg-white border-[#E9EDEF] text-[#111B21]"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "scoring" ? <ScoringRules /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[["Drivers", counts.total], ["Active", counts.active], ["In a vehicle", counts.assigned], ["Permits expiring or expired", counts.permits]].map(([label, n]) => (
              <div key={label} className={`${CARD} px-4 py-3`}>
                <div className="text-[11px] font-extrabold text-[#667781]">{label}</div>
                <div className={`text-[22px] font-black ${label === "Permits expiring or expired" && Number(n) > 0 ? "text-[#B45309]" : "text-[#111B21]"}`}>{loading || failed ? "—" : n}</div>
              </div>
            ))}
          </div>

          {notice && <Notice text={notice} onClose={() => setNotice(null)} />}
          {error && <ErrorBanner text={error} onRetry={() => { setLoading(true); void load(); }} />}

          {!failed && <div className={`${CARD} overflow-hidden`}>
            <div className="px-4 py-3 border-b border-[#E9EDEF] flex gap-2 flex-wrap">
              <input className={`${INPUT} flex-1 min-w-[200px]`} placeholder="Search name, phone, permit, employee number or vehicle…"
                value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search drivers" />
              <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={INPUT_INLINE}>
                <option value="">All statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </div>
            {loading ? (
              <div className="p-8 text-center text-[13px] text-[#667781]">Loading drivers…</div>
            ) : shown.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-[#667781]">
                {drivers.length ? "No driver matches." : canManage ? "No drivers yet. Register the people who drive your vehicles." : "No drivers yet."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] font-extrabold text-[#667781] bg-[#F8F9FA]">
                      <th className="px-4 py-2">Driver</th>
                      <th className="px-4 py-2">Permit</th>
                      <th className="px-4 py-2">Vehicle</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((d) => (
                      <tr key={d.driver_uid} onClick={() => setOpen(d.driver_uid)}
                        className="border-t border-[#E9EDEF] cursor-pointer hover:bg-[#F8F9FA]">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <DriverAvatar driver={d} />
                            <div>
                              <div className="font-extrabold text-[#111B21]">{d.full_name}</div>
                              <div className="text-[12px] text-[#667781]">{d.phone}{d.employee_number ? ` · #${d.employee_number}` : ""}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="text-[#111B21]">{d.permit_number}</div>
                          <div className="flex gap-1.5 items-center text-[12px] text-[#667781]">{permitClasses(d).join(", ")} <PermitBadge driver={d} /></div>
                        </td>
                        <td className="px-4 py-2.5 text-[#111B21]">{d.current_imei ? units.label(d.current_imei) : <span className="text-[#8696A0]">Not assigned</span>}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={d.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>}
        </>
      )}

      {open && (
        <DriverDetailsPanel driverUid={open} units={units} canManage={canManage}
          onClose={() => setOpen(null)} onChanged={() => void load()}
          onEdit={(d) => { setOpen(null); setForm({ existing: d }); }} />
      )}
      {form && (
        <DriverFormPanel existing={form.existing} onClose={() => setForm(null)}
          onSaved={(d, message) => { setForm(null); setNotice(message); void load(); setOpen(d.driver_uid); }} />
      )}
    </div>
  );
}
