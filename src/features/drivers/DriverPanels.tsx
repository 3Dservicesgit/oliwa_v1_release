/**
 * DriverPanels — registering or editing a driver, and one driver's details:
 * status, the vehicle they are in, assignment history, photo. The same as
 * the OLIWA mobile app's driver form and driver details screens.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  assignDriver, driverPhotoUrl, getDriver, getDriverAssignments, registerDriver,
  setDriverStatus, unassignDriver, updateDriver, uploadDriverPhoto,
} from "../../api/services/drivers.service";
import type { Driver, DriverAssignment, DriverFields, DriverStatus } from "../../api/types/drivers.types";
import type { ClientUnits } from "../../hooks/useClientUnits";
import {
  AuthImage, Badge, BTN, BTN_DANGER, BTN_PRIMARY, ErrorBanner, INPUT, LABEL, Notice, PromptDialog, SidePanel, type PromptOptions,
} from "../../components/ui/records";
import { dayText, errText, photoProblem, whenText } from "../../components/ui/recordUtils";
import {
  PERMIT_CLASSES, STATUSES, assignmentBlock, endReasonLabel, initials,
  normaliseIbutton, normalisePhone, permitClasses, statusLabel, validNin,
  validPermit,
} from "./driverRules";

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "active" ? "green" : status === "suspended" ? "amber" : status === "blacklisted" ? "red" : "grey";
  return <Badge tone={tone}>{statusLabel(status)}</Badge>;
}

export function PermitBadge({ driver }: { driver: Driver }) {
  if (driver.permit_state === "expired") return <Badge tone="red">Permit expired</Badge>;
  if (driver.permit_state === "expiring") return <Badge tone="amber">Permit expiring</Badge>;
  return null;
}

export function DriverAvatar({ driver, size = 40 }: { driver: Driver; size?: number }) {
  const load = useCallback(() => driverPhotoUrl(driver.driver_uid), [driver.driver_uid]);
  const fallback = (
    <div style={{ width: size, height: size }} className="rounded-full bg-[#E7F3F1] text-[#075E54] font-black text-[13px] grid place-items-center shrink-0">
      {initials(driver.full_name)}
    </div>
  );
  if (!driver.has_photo) return fallback;
  return (
    <div style={{ width: size, height: size }} className="rounded-full overflow-hidden shrink-0">
      <AuthImage load={load} alt={driver.full_name} className="w-full h-full object-cover" fallback={fallback} />
    </div>
  );
}

// ── Register / edit ─────────────────────────────────────────────────────────

export function DriverFormPanel({ existing, onClose, onSaved }: {
  existing?: Driver;
  onClose: () => void;
  onSaved: (driver: Driver, message: string) => void;
}) {
  const editing = !!existing;
  const [f, setF] = useState({
    full_name: existing?.full_name ?? "",
    phone: existing?.phone ?? "",
    permit_number: existing?.permit_number ?? "",
    permit_expiry: existing?.permit_expiry?.slice(0, 10) ?? "",
    ibutton_id: existing?.ibutton_id ?? "",
    national_id: existing?.national_id ?? "",
    employee_number: existing?.employee_number ?? "",
    home_branch: existing?.home_branch ?? "",
    emergency_name: existing?.emergency_name ?? "",
    emergency_phone: existing?.emergency_phone ?? "",
    notes: existing?.notes ?? "",
  });
  const [classes, setClasses] = useState<string[]>(existing ? permitClasses(existing) : []);
  const [photo, setPhoto] = useState<File | null>(null);
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  const problems = useMemo(() => {
    const p: Partial<Record<string, string>> = {};
    if (f.full_name.trim().length < 2) p.full_name = "Enter the full name.";
    if (!normalisePhone(f.phone)) p.phone = "Enter a valid phone number.";
    if (!validPermit(f.permit_number)) p.permit_number = "Enter the permit number as printed.";
    if (!f.permit_expiry) p.permit_expiry = "Choose the expiry date.";
    if (!classes.length) p.classes = "Choose at least one class.";
    if (f.ibutton_id.trim() && !normaliseIbutton(f.ibutton_id)) p.ibutton_id = "6 to 16 letters A–F and digits.";
    if (f.national_id.trim() && !validNin(f.national_id)) p.national_id = "A NIN is 14 letters and digits.";
    if (f.emergency_phone.trim() && !normalisePhone(f.emergency_phone)) p.emergency_phone = "Enter a valid phone number.";
    return p;
  }, [f, classes]);

  const expired = !!f.permit_expiry && f.permit_expiry < new Date().toISOString().slice(0, 10);

  const save = async () => {
    setTried(true);
    if (Object.keys(problems).length) { setError("Check the highlighted fields."); return; }
    if (photo) {
      const bad = photoProblem(photo);
      if (bad) { setError(bad); return; }
    }
    setBusy(true);
    setError(null);
    const fields: DriverFields = {
      full_name: f.full_name.trim(),
      phone: f.phone.trim(),
      permit_number: f.permit_number.trim(),
      permit_expiry: f.permit_expiry,
      permit_classes: PERMIT_CLASSES.map((c) => c.code).filter((c) => classes.includes(c)),
      ibutton_id: f.ibutton_id.trim(),
      national_id: f.national_id.trim(),
      employee_number: f.employee_number.trim(),
      home_branch: f.home_branch.trim(),
      emergency_name: f.emergency_name.trim(),
      emergency_phone: f.emergency_phone.trim(),
      notes: f.notes.trim(),
    };
    try {
      let driver = editing ? await updateDriver(existing!.driver_uid, fields) : await registerDriver(fields);
      let message = editing ? `${driver.full_name} updated.` : `${driver.full_name} registered.`;
      if (photo) {
        try {
          driver = await uploadDriverPhoto(driver.driver_uid, photo);
        } catch (e) {
          message = `Driver saved, but the photo was not: ${errText(e)}`;
        }
      }
      onSaved(driver, message);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof typeof f, label: string, opts: { required?: boolean; hint?: string; help?: string; type?: string } = {}) => (
    <div>
      <label className={LABEL} htmlFor={`drv-${k}`}>{label}{opts.required ? " *" : ""}</label>
      <input id={`drv-${k}`} type={opts.type ?? "text"} className={`${INPUT} ${tried && problems[k] ? "border-[#E53935]" : ""}`}
        value={f[k]} onChange={set(k)} placeholder={opts.hint} />
      {tried && problems[k]
        ? <div className="text-[11px] text-[#B00020] mt-1">{problems[k]}</div>
        : opts.help && <div className="text-[11px] text-[#667781] mt-1">{opts.help}</div>}
    </div>
  );

  return (
    <SidePanel
      title={editing ? "Edit driver" : "Register driver"}
      subtitle="* required"
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={BTN}>Cancel</button>
        <button type="button" onClick={save} disabled={busy} className={BTN_PRIMARY}>
          {busy ? "Saving…" : editing ? "Save changes" : "Register driver"}
        </button>
      </>}
    >
      <div>
        <div className={LABEL}>Photo</div>
        <div className="flex items-center gap-3">
          {preview
            ? <img src={preview} alt="New photo" className="w-14 h-14 rounded-full object-cover" />
            : existing ? <DriverAvatar driver={existing} size={56} /> : <div className="w-14 h-14 rounded-full bg-[#F0F2F5]" />}
          <label className={`${BTN} inline-flex items-center`}>
            {photo || existing?.has_photo ? "Change photo" : "Add photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      </div>
      {field("full_name", "Full name", { required: true })}
      {field("phone", "Phone", { required: true, hint: "0772 123 456" })}
      {field("permit_number", "Permit number", { required: true })}
      <div>
        <label className={LABEL} htmlFor="drv-permit_expiry">Permit expiry date *</label>
        <input id="drv-permit_expiry" type="date" className={`${INPUT} ${tried && problems.permit_expiry ? "border-[#E53935]" : ""}`}
          value={f.permit_expiry} onChange={set("permit_expiry")} />
        {tried && problems.permit_expiry
          ? <div className="text-[11px] text-[#B00020] mt-1">{problems.permit_expiry}</div>
          : expired && <div className="text-[11px] text-[#92400E] mt-1">This permit has expired: the driver cannot be put in a vehicle until it is renewed.</div>}
      </div>
      <div>
        <div className={LABEL}>Permit class(es) *</div>
        <div className="grid grid-cols-2 gap-1.5">
          {PERMIT_CLASSES.map((c) => (
            <label key={c.code} className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer text-[12px] ${classes.includes(c.code) ? "border-[#128C7E] bg-[#E9F7F4]" : "border-[#E9EDEF]"}`}>
              <input type="checkbox" checked={classes.includes(c.code)} className="mt-0.5"
                onChange={(e) => setClasses((prev) => e.target.checked ? [...prev, c.code] : prev.filter((x) => x !== c.code))} />
              <span><b>{c.code}</b> <span className="text-[#667781]">{c.covers}</span></span>
            </label>
          ))}
        </div>
        {tried && problems.classes && <div className="text-[11px] text-[#B00020] mt-1">{problems.classes}</div>}
      </div>
      {field("ibutton_id", "iButton tag ID", { hint: "e.g. 01 A2 B3 C4 D5 E6 F7 08", help: "Printed on the driver's tag. When the vehicle reads the tag, trips are put down to this driver." })}
      {field("national_id", "National ID (NIN)", { hint: "Optional" })}
      {field("employee_number", "Employee number")}
      {field("home_branch", "Home branch")}
      {field("emergency_name", "Emergency contact name")}
      {field("emergency_phone", "Emergency contact phone")}
      <div>
        <label className={LABEL} htmlFor="drv-notes">Notes</label>
        <textarea id="drv-notes" rows={3} maxLength={1000} className={`${INPUT} h-auto py-2`} value={f.notes} onChange={set("notes")} />
      </div>
      {error && <ErrorBanner text={error} />}
    </SidePanel>
  );
}

// ── Details ─────────────────────────────────────────────────────────────────

const STATUS_HINT: Record<string, string> = {
  active: "Can be put in a vehicle.",
  suspended: "Temporarily off the road. They will also leave their vehicle.",
  blacklisted: "Must not drive for you again. They will also leave their vehicle.",
  inactive: "No longer driving for you. They will also leave their vehicle.",
};

export function DriverDetailsPanel({ driverUid, units, canManage, onClose, onChanged, onEdit }: {
  driverUid: string;
  units: ClientUnits;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (d: Driver) => void;
}) {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [history, setHistory] = useState<DriverAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptOptions | null>(null);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");

  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.all([getDriver(driverUid), getDriverAssignments(driverUid)])
      .then(([d, h]) => { if (alive) { setDriver(d); setHistory(h); setError(null); } })
      .catch((e) => { if (alive) setError(errText(e)); });
    return () => { alive = false; };
  }, [driverUid, version]);
  const load = () => setVersion((v) => v + 1);

  const changed = async (d: Driver, message: string) => {
    setDriver(d);
    setNotice(message);
    setHistory(await getDriverAssignments(d.driver_uid).catch(() => history));
    onChanged();
  };

  const changeStatus = (status: DriverStatus) => {
    if (!driver || status === driver.status) return;
    const leaving = status !== "active" && driver.current_imei;
    setPrompt({
      title: `${status === "active" ? "Reactivate" : `Mark as ${statusLabel(status).toLowerCase()}`} ${driver.full_name}?`,
      body: STATUS_HINT[status] + (leaving ? ` They will also leave ${units.label(driver.current_imei)}.` : ""),
      label: status === "active" ? undefined : "Reason",
      action: status === "active" ? "Reactivate" : statusLabel(status),
      danger: status === "blacklisted",
      run: async (reason) => {
        const d = await setDriverStatus(driver.driver_uid, status, reason || undefined);
        await changed(d, `${d.full_name} is now ${statusLabel(d.status).toLowerCase()}.`);
      },
    });
  };

  const assign = (imei: string) => {
    if (!driver) return;
    setPicking(false);
    setPrompt({
      title: `Put ${driver.full_name} in ${units.label(imei)}?`,
      body: (driver.current_imei ? `They will leave ${units.label(driver.current_imei)}. ` : "") +
        "If another driver is in this vehicle, they will be taken out of it.",
      action: "Assign",
      run: async () => {
        const d = await assignDriver(driver.driver_uid, imei);
        await changed(d, `${d.full_name} is now driving ${units.label(imei)}.`);
      },
    });
  };

  const unassign = () => {
    if (!driver?.current_imei) return;
    setPrompt({
      title: `Take ${driver.full_name} out of ${units.label(driver.current_imei)}?`,
      body: "The vehicle will have no driver until another is assigned.",
      action: "Unassign",
      run: async () => {
        const d = await unassignDriver(driver.driver_uid);
        await changed(d, `${d.full_name} is no longer assigned to a vehicle.`);
      },
    });
  };

  const choosePhoto = async (file: File | undefined) => {
    if (!driver || !file) return;
    const bad = photoProblem(file);
    if (bad) { setError(bad); return; }
    try {
      await changed(await uploadDriverPhoto(driver.driver_uid, file), "Photo updated.");
    } catch (e) {
      setError(errText(e));
    }
  };

  const shownUnits = units.units.filter((u) => {
    const q = search.trim().toLowerCase();
    return !q || `${u.device_name} ${u.device_imei} ${u.car_make} ${u.car_model}`.toLowerCase().includes(q);
  });
  const block = driver ? assignmentBlock(driver) : null;
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-1.5 border-b border-[#F0F2F5] text-[13px]">
      <span className="text-[#667781]">{label}</span>
      <span className="text-right text-[#111B21] font-semibold break-all">{value || "—"}</span>
    </div>
  );

  return (
    <SidePanel
      title={driver?.full_name ?? "Driver"}
      subtitle={driver ? `${driver.phone} · Permit ${driver.permit_number}` : undefined}
      onClose={onClose}
      width={520}
      footer={driver && canManage ? <button type="button" className={BTN} onClick={() => onEdit(driver)}>Edit details</button> : undefined}
    >
      {error && <ErrorBanner text={error} onRetry={() => void load()} />}
      {notice && <Notice text={notice} onClose={() => setNotice(null)} />}
      {!driver ? (
        !error && <div className="text-[13px] text-[#667781]">Loading…</div>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <DriverAvatar driver={driver} size={64} />
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1.5 flex-wrap"><StatusBadge status={driver.status} /><PermitBadge driver={driver} /></div>
              {driver.status_reason && driver.status !== "active" && <div className="text-[12px] text-[#667781]">Reason: {driver.status_reason}</div>}
              {canManage && (
                <label className="text-[12px] font-extrabold text-[#128C7E] cursor-pointer">
                  {driver.has_photo ? "Change photo" : "Add photo"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void choosePhoto(e.target.files?.[0])} />
                </label>
              )}
            </div>
          </div>

          <section>
            <div className="font-black text-[13px] text-[#111B21] mb-2">Vehicle</div>
            <div className="border border-[#E9EDEF] rounded-lg p-3 flex items-center justify-between gap-3">
              <div>
                {driver.current_imei ? (
                  <>
                    <div className="font-extrabold text-[13px] text-[#111B21]">{units.label(driver.current_imei)}</div>
                    <div className="text-[12px] text-[#667781]">Since {whenText(driver.assigned_at)}</div>
                  </>
                ) : <div className="text-[13px] text-[#667781]">Not assigned to a vehicle.</div>}
              </div>
              {canManage && (
                <div className="flex gap-1.5 shrink-0">
                  {driver.current_imei && <button type="button" className={BTN_DANGER} onClick={unassign}>Unassign</button>}
                  <button type="button" className={BTN_PRIMARY} disabled={!!block} title={block ?? undefined}
                    onClick={() => { setSearch(""); setPicking(true); }}>
                    {driver.current_imei ? "Change vehicle" : "Assign vehicle"}
                  </button>
                </div>
              )}
            </div>
            {canManage && block && <div className="text-[11px] text-[#92400E] mt-1">{block}</div>}
            {picking && (
              <div className="border border-[#E9EDEF] rounded-lg mt-2 overflow-hidden">
                <div className="p-2 border-b border-[#E9EDEF] flex gap-2">
                  <input className={INPUT} autoFocus placeholder="Choose a vehicle — search name or IMEI…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  <button type="button" className={BTN} onClick={() => setPicking(false)}>Cancel</button>
                </div>
                <div className="max-h-[260px] overflow-y-auto">
                  {units.error ? <div className="p-3 text-[12px] text-[#B00020]">{units.error}</div>
                    : units.loading ? <div className="p-3 text-[12px] text-[#667781]">Loading vehicles…</div>
                    : shownUnits.length === 0 ? <div className="p-3 text-[12px] text-[#667781]">{units.units.length ? "No vehicles found." : "No vehicles yet."}</div>
                    : shownUnits.map((u) => (
                      <button key={u.device_imei} type="button" disabled={u.device_imei === driver.current_imei}
                        onClick={() => assign(u.device_imei)}
                        className="w-full text-left px-3 py-2 border-0 border-b border-[#F0F2F5] bg-white hover:bg-[#F8F9FA] cursor-pointer disabled:opacity-50 disabled:cursor-default">
                        <div className="text-[13px] font-extrabold text-[#111B21]">{u.device_name || u.device_imei}</div>
                        <div className="text-[11px] text-[#667781]">{u.device_imei}{u.device_imei === driver.current_imei ? " · current vehicle" : ""}</div>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </section>

          {canManage && (
            <section>
              <div className="font-black text-[13px] text-[#111B21] mb-2">Status</div>
              <div className="flex gap-1.5 flex-wrap">
                {STATUSES.map((s) => (
                  <button key={s} type="button" onClick={() => changeStatus(s)} disabled={s === driver.status}
                    className={`h-8 px-3 rounded-lg text-[12px] font-extrabold cursor-pointer border ${s === driver.status ? "border-[#128C7E] bg-[#E9F7F4] text-[#075E54] cursor-default" : "border-[#E9EDEF] bg-white text-[#111B21]"}`}>
                    {statusLabel(s)}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="font-black text-[13px] text-[#111B21] mb-1">Details</div>
            {row("Permit expiry", dayText(driver.permit_expiry))}
            {row("Permit classes", permitClasses(driver).join(", "))}
            {row("iButton tag", driver.ibutton_id)}
            {row("National ID", driver.national_id)}
            {row("Employee number", driver.employee_number)}
            {row("Home branch", driver.home_branch)}
            {row("Emergency contact", [driver.emergency_name, driver.emergency_phone].filter(Boolean).join(" · "))}
            {driver.notes && <div className="text-[12px] text-[#667781] mt-2 whitespace-pre-wrap">{driver.notes}</div>}
          </section>

          <section>
            <div className="font-black text-[13px] text-[#111B21] mb-2">Vehicle history</div>
            {history.length === 0 ? <div className="text-[12px] text-[#667781]">Never assigned to a vehicle.</div> : (
              <div className="flex flex-col gap-1.5">
                {history.map((h, i) => (
                  <div key={`${h.device_imei}-${h.assigned_at}-${i}`} className="border border-[#E9EDEF] rounded-lg px-3 py-2">
                    <div className="flex justify-between gap-2">
                      <span className="text-[13px] font-extrabold text-[#111B21]">{units.label(h.device_imei)}</span>
                      {!h.ended_at && <Badge tone="teal">Now</Badge>}
                    </div>
                    <div className="text-[11px] text-[#667781]">
                      {whenText(h.assigned_at)} → {h.ended_at ? whenText(h.ended_at) : "now"}
                      {h.end_reason ? ` · ${endReasonLabel(h.end_reason)}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      {prompt && <PromptDialog prompt={prompt} onClose={() => setPrompt(null)} />}
    </SidePanel>
  );
}
