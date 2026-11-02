/**
 * FuelPanels — recording fuel issued to a driver, one issue's details (what
 * the checks found, review, void, receipt) and a vehicle's fuel profile. The
 * same as the OLIWA mobile app's fuel form, issue screen and profile sheet.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  fuelReceiptUrl, getFuelIssue, getFuelStations, recordFuelIssue,
  reviewFuelIssue, saveFuelProfile, uploadFuelReceipt, voidFuelIssue,
} from "../../api/services/fuel.service";
import { getDrivers, getUnitDriver } from "../../api/services/drivers.service";
import type { Driver } from "../../api/types/drivers.types";
import type {
  FuelCapability, FuelIssue, FuelProfile, FuelType, PaymentMethod,
} from "../../api/types/fuel.types";
import type { ClientUnits } from "../../hooks/useClientUnits";
import {
  AuthImage, Badge, BTN, BTN_DANGER, BTN_PRIMARY, ErrorBanner, INPUT, LABEL, Notice, PromptDialog, SidePanel, type PromptOptions,
} from "../../components/ui/records";
import { errText, photoProblem, whenText } from "../../components/ui/recordUtils";
import {
  FUEL_TYPES, PAYMENT_METHODS, discrepancies, driverLabel, fuelLabel, fuelNum,
  fuelTotal, isReviewed, litres, needsReview, notices, parsePositive,
  paymentLabel, reviewLabel, sensorLabel, ugx,
} from "./fuelFormat";

export function ReviewBadge({ issue }: { issue: FuelIssue }) {
  if (issue.voided) return <Badge tone="grey">Voided</Badge>;
  const s = issue.review_state;
  const tone = s === "open" ? "amber" : s === "confirmed_loss" ? "red" : s === "explained" ? "blue" : "green";
  return <Badge tone={tone}>{reviewLabel(s)}</Badge>;
}

/** "2026-10-30T12:18", local, for <input type="datetime-local"> and the
 *  server's issued_at. */
function localStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function profileLine(p: FuelProfile | undefined): string {
  if (!p) return "No fuel profile";
  return `${fuelLabel(String(p.fuel_type))} · ${litres(fuelNum(p.tank_capacity_l))} tank · ` +
    `${fuelNum(p.baseline_km_per_l) ?? "—"} km/L expected · ±${fuelNum(p.tolerance_pct) ?? 20}%`;
}

// ── Record fuel ─────────────────────────────────────────────────────────────

export function RecordFuelPanel({ units, profiles, capabilities, initialImei, onClose, onRecorded, onSetProfile }: {
  units: ClientUnits;
  profiles: Record<string, FuelProfile>;
  capabilities: Record<string, FuelCapability>;
  initialImei?: string;
  onClose: () => void;
  onRecorded: (issue: FuelIssue, message: string) => void;
  onSetProfile: (imei: string) => void;
}) {
  const [imei, setImei] = useState(initialImei ?? "");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverUid, setDriverUid] = useState("");
  // The driver was filled in from the vehicle's assignment, not picked: a
  // different vehicle replaces or clears it.
  const [driverFromVehicle, setDriverFromVehicle] = useState(false);
  const [issuedAt, setIssuedAt] = useState(localStamp(new Date()));
  const [fuelType, setFuelType] = useState<FuelType>("diesel");
  const [litresText, setLitresText] = useState("");
  const [priceText, setPriceText] = useState("");
  const [fullTank, setFullTank] = useState(true);
  const [odometer, setOdometer] = useState("");
  const [station, setStation] = useState("");
  const [stations, setStations] = useState<string[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>("fuel_card");
  const [receipt, setReceipt] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDrivers("active").then(setDrivers).catch(() => setDrivers([]));
    getFuelStations().then(setStations).catch(() => setStations([]));
  }, []);

  // Picking a vehicle fills in its fuel type and assigned driver.
  useEffect(() => {
    if (!imei) return;
    const p = profiles[imei];
    if (p && (FUEL_TYPES as readonly string[]).includes(String(p.fuel_type))) setFuelType(p.fuel_type as FuelType);
    let alive = true;
    getUnitDriver(imei)
      .then((d) => {
        if (!alive) return;
        if (d) {
          setDriverUid(d.driver_uid);
          setDriverFromVehicle(true);
        } else if (driverFromVehicle) {
          setDriverUid("");
          setDriverFromVehicle(false);
        }
      })
      .catch(() => { /* the driver stays optional */ });
    return () => { alive = false; };
    // driverFromVehicle is read, not watched: only a new vehicle refills it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imei, profiles]);

  const profile = imei ? profiles[imei] : undefined;
  const l = parsePositive(litresText);
  const price = parsePositive(priceText);
  const total = l !== null && price !== null ? fuelTotal(l, price) : null;
  const tank = fuelNum(profile?.tank_capacity_l);
  const overTank = !!tank && (l ?? 0) > tank * 1.05;
  const chosenDriver = drivers.find((d) => d.driver_uid === driverUid);

  const problems = useMemo(() => {
    const p: Partial<Record<string, string>> = {};
    if (!imei) p.imei = "Choose the vehicle.";
    if (!issuedAt) p.issuedAt = "Enter the date and time on the receipt.";
    else if (new Date(issuedAt).getTime() > Date.now() + 5 * 60_000) p.issuedAt = "That time is in the future.";
    if (l === null || l > 1000) p.litres = "Enter the litres.";
    if (price === null || price < 100 || price > 50000) p.price = "UGX 100 to 50,000.";
    if (odometer.trim() && Number.isNaN(Number(odometer.replace(/,/g, "").trim()))) p.odometer = "Enter the reading in km.";
    if (station.trim().length < 2) p.station = "Enter the station name.";
    return p;
  }, [imei, issuedAt, l, price, odometer, station]);

  const save = async () => {
    setTried(true);
    if (Object.keys(problems).length) { setError("Check the highlighted fields."); return; }
    if (photo) {
      const bad = photoProblem(photo);
      if (bad) { setError(bad); return; }
    }
    setBusy(true);
    setError(null);
    try {
      let issue = await recordFuelIssue({
        device_imei: imei,
        // Left out when empty: the server then uses whoever was assigned to
        // the vehicle at the receipt's time, if anyone.
        ...(driverUid ? { driver_uid: driverUid } : {}),
        issued_at: issuedAt,
        litres: l!,
        unit_price: price!,
        fuel_type: fuelType,
        station_name: station.trim(),
        payment_method: payment,
        full_tank: fullTank,
        odometer_km: odometer.replace(/,/g, "").trim(),
        receipt_number: receipt.trim(),
        notes: notes.trim(),
      });
      let message = `${litres(fuelNum(issue.litres))} · ${ugx(fuelNum(issue.total_cost))} recorded.`;
      if (photo) {
        try {
          issue = await uploadFuelReceipt(issue.issue_uid, photo);
        } catch (e) {
          message = `Issue recorded, but the receipt photo was not: ${errText(e)}`;
        }
      }
      onRecorded(issue, message);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const bad = (k: string) => (tried && problems[k] ? "border-[#E53935]" : "");
  const hint = (k: string, help?: React.ReactNode) =>
    tried && problems[k]
      ? <div className="text-[11px] text-[#B00020] mt-1">{problems[k]}</div>
      : help ? <div className="text-[11px] text-[#667781] mt-1">{help}</div> : null;

  return (
    <SidePanel
      title="Record fuel"
      subtitle="Fuel issued to a driver, from the receipt. * required"
      onClose={onClose}
      width={520}
      footer={<>
        <button type="button" onClick={onClose} className={BTN}>Cancel</button>
        <button type="button" onClick={save} disabled={busy} className={BTN_PRIMARY}>{busy ? "Checking against the tracker…" : "Record fuel"}</button>
      </>}
    >
      <div>
        <label className={LABEL} htmlFor="fuel-vehicle">Vehicle *</label>
        <select id="fuel-vehicle" className={`${INPUT} ${bad("imei")}`} value={imei} onChange={(e) => setImei(e.target.value)}>
          <option value="">{units.loading ? "Loading vehicles…" : "Choose the vehicle"}</option>
          {units.units.map((u) => (
            <option key={u.device_imei} value={u.device_imei}>
              {u.device_name || u.device_imei}{profiles[u.device_imei] || capabilities[u.device_imei]?.has_profile ? "" : " — no fuel profile"}
            </option>
          ))}
        </select>
        {units.error && <div className="text-[11px] text-[#B00020] mt-1">{units.error}</div>}
        {hint("imei")}
        {imei && (
          <div className={`mt-2 text-[12px] rounded-lg px-3 py-2 border ${profile ? "border-[#E9EDEF] text-[#667781]" : "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]"}`}>
            {profile ? profileLine(profile) : "No fuel profile: consumption will not be checked."}{" "}
            <button type="button" onClick={() => onSetProfile(imei)} className="bg-transparent border-0 p-0 font-extrabold text-[#128C7E] cursor-pointer underline">
              {profile ? "Change" : "Set profile"}
            </button>
          </div>
        )}
      </div>

      <div>
        <label className={LABEL} htmlFor="fuel-driver">Driver (optional)</label>
        <div className="flex gap-2">
          <select id="fuel-driver" className={INPUT} value={driverUid}
            onChange={(e) => { setDriverUid(e.target.value); setDriverFromVehicle(false); }}>
            <option value="">Not known</option>
            {driverUid && !chosenDriver && <option value={driverUid}>Assigned driver</option>}
            {drivers.map((d) => <option key={d.driver_uid} value={d.driver_uid}>{d.full_name}</option>)}
          </select>
          {driverUid && <button type="button" aria-label="Clear driver" className={BTN} onClick={() => { setDriverUid(""); setDriverFromVehicle(false); }}>✕</button>}
        </div>
        {hint("driver", driverUid
          ? (driverFromVehicle ? "Assigned to this vehicle." : undefined)
          : "Leave empty if you don't know. The driver assigned to the vehicle at that time is used, if any.")}
      </div>

      <div>
        <label className={LABEL} htmlFor="fuel-at">Date and time on the receipt *</label>
        <input id="fuel-at" type="datetime-local" className={`${INPUT} ${bad("issuedAt")}`} value={issuedAt}
          max={localStamp(new Date())} onChange={(e) => setIssuedAt(e.target.value)} />
        {hint("issuedAt")}
      </div>

      <div>
        <div className={LABEL}>Fuel *</div>
        <div className="flex gap-1.5">
          {FUEL_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => setFuelType(t)}
              className={`h-8 px-3 rounded-full text-[12px] font-extrabold cursor-pointer border ${fuelType === t ? "bg-[#075E54] border-[#075E54] text-white" : "bg-white border-[#E9EDEF]"}`}>
              {fuelLabel(t)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL} htmlFor="fuel-litres">Litres *</label>
          <input id="fuel-litres" inputMode="decimal" className={`${INPUT} ${bad("litres")}`} value={litresText} onChange={(e) => setLitresText(e.target.value)} />
          {hint("litres", overTank ? <span className="text-[#92400E]">More than this vehicle's {litres(tank)} tank holds.</span> : undefined)}
        </div>
        <div>
          <label className={LABEL} htmlFor="fuel-price">Price per litre (UGX) *</label>
          <input id="fuel-price" inputMode="decimal" className={`${INPUT} ${bad("price")}`} value={priceText} onChange={(e) => setPriceText(e.target.value)} />
          {hint("price")}
        </div>
      </div>
      <div className="text-[15px] font-black text-[#111B21]">Total: {total === null ? "—" : ugx(total)}</div>

      <label className="flex items-start gap-2 cursor-pointer">
        <input type="checkbox" checked={fullTank} onChange={(e) => setFullTank(e.target.checked)} className="mt-0.5" />
        <span>
          <span className="block text-[13px] font-extrabold text-[#111B21]">Filled to full</span>
          <span className="block text-[11px] text-[#667781]">Consumption is measured from one full tank to the next.</span>
        </span>
      </label>

      <div>
        <label className={LABEL} htmlFor="fuel-odo">Odometer (km)</label>
        <input id="fuel-odo" inputMode="numeric" className={`${INPUT} ${bad("odometer")}`} value={odometer} onChange={(e) => setOdometer(e.target.value)} />
        {hint("odometer")}
      </div>

      <div>
        <label className={LABEL} htmlFor="fuel-station">Station *</label>
        <input id="fuel-station" list="fuel-stations" className={`${INPUT} ${bad("station")}`} value={station} onChange={(e) => setStation(e.target.value)} placeholder="e.g. Shell Jinja Road" />
        <datalist id="fuel-stations">{stations.map((s) => <option key={s} value={s} />)}</datalist>
        {hint("station")}
      </div>

      <div>
        <div className={LABEL}>Paid by *</div>
        <div className="flex gap-1.5 flex-wrap">
          {PAYMENT_METHODS.map((m) => (
            <button key={m} type="button" onClick={() => setPayment(m)}
              className={`h-8 px-3 rounded-full text-[12px] font-extrabold cursor-pointer border ${payment === m ? "bg-[#075E54] border-[#075E54] text-white" : "bg-white border-[#E9EDEF]"}`}>
              {paymentLabel(m)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={LABEL} htmlFor="fuel-receipt">Receipt number</label>
        <input id="fuel-receipt" className={INPUT} value={receipt} onChange={(e) => setReceipt(e.target.value.toUpperCase())} />
      </div>
      <div>
        <div className={LABEL}>Receipt photo</div>
        <input type="file" accept="image/jpeg,image/png,image/webp" className="text-[12px]" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
      </div>
      <div>
        <label className={LABEL} htmlFor="fuel-notes">Notes</label>
        <textarea id="fuel-notes" rows={2} maxLength={1000} className={`${INPUT} h-auto py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <ErrorBanner text={error} />}
    </SidePanel>
  );
}

// ── One issue ───────────────────────────────────────────────────────────────

export function FuelIssuePanel({ issueUid, units, profiles, canManage, initialNotice, onClose, onChanged }: {
  issueUid: string;
  units: ClientUnits;
  profiles: Record<string, FuelProfile>;
  canManage: boolean;
  initialNotice?: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [issue, setIssue] = useState<FuelIssue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(initialNotice ?? null);
  const [prompt, setPrompt] = useState<PromptOptions | null>(null);

  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    getFuelIssue(issueUid)
      .then((i) => { if (alive) { setIssue(i); setError(null); } })
      .catch((e) => { if (alive) setError(errText(e)); });
    return () => { alive = false; };
  }, [issueUid, version]);
  const load = () => setVersion((v) => v + 1);

  const receiptLoader = useCallback(() => fuelReceiptUrl(issueUid), [issueUid]);

  const changed = (i: FuelIssue, message: string) => {
    setIssue(i);
    setNotice(message);
    onChanged();
  };

  const review = () => setPrompt({
    title: "Close the review",
    body: "Find out what happened, then close the review.",
    choices: [
      { value: "explained", label: "Explained", hint: "There is a good reason, e.g. fuel for a generator, a receipt typed wrongly." },
      { value: "confirmed_loss", label: "Confirmed loss", hint: "The fuel was not used for this vehicle." },
    ],
    label: "What was found",
    required: true,
    action: "Close review",
    run: async (note, outcome) => changed(await reviewFuelIssue(issueUid, outcome, note), `Review closed: ${reviewLabel(outcome)}.`),
  });

  const voidIt = () => setPrompt({
    title: "Void this issue?",
    body: "A voided issue is kept for the record but left out of totals and checks. Use it for a receipt entered by mistake.",
    label: "Reason",
    required: true,
    action: "Void issue",
    danger: true,
    run: async (reason) => changed(await voidFuelIssue(issueUid, reason), "Issue voided."),
  });

  const uploadReceipt = async (file: File | undefined) => {
    if (!file) return;
    const bad = photoProblem(file);
    if (bad) { setError(bad); return; }
    try {
      changed(await uploadFuelReceipt(issueUid, file), "Receipt photo added.");
    } catch (e) {
      setError(errText(e));
    }
  };

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-1.5 border-b border-[#F0F2F5] text-[13px]">
      <span className="text-[#667781]">{label}</span>
      <span className="text-right text-[#111B21] font-semibold">{value === null || value === undefined || value === "" ? "—" : value}</span>
    </div>
  );

  const i = issue;
  const profile = i ? profiles[i.device_imei] : undefined;
  const kmPerL = fuelNum(i?.km_per_l);
  const baseline = fuelNum(profile?.baseline_km_per_l);

  return (
    <SidePanel
      title="Fuel issue"
      subtitle={i ? `${litres(fuelNum(i.litres))} · ${ugx(fuelNum(i.total_cost))} · ${units.label(i.device_imei)}` : undefined}
      onClose={onClose}
      width={520}
      footer={i && canManage && !i.voided ? <button type="button" className={BTN_DANGER} onClick={voidIt}>Void issue</button> : undefined}
    >
      {error && <ErrorBanner text={error} onRetry={() => void load()} />}
      {notice && <Notice text={notice} onClose={() => setNotice(null)} />}
      {!i ? (!error && <div className="text-[13px] text-[#667781]">Loading…</div>) : (
        <>
          <div className="flex gap-1.5 flex-wrap"><ReviewBadge issue={i} />{i.full_tank && <Badge tone="teal">Full tank</Badge>}</div>
          {i.voided && <div className="text-[12px] text-[#667781]">Voided: {i.void_reason}</div>}

          <section>
            <div className="font-black text-[13px] text-[#111B21] mb-2">What the checks found</div>
            {discrepancies(i).length === 0 && notices(i).length === 0
              ? <div className="text-[13px] text-[#166534]">Everything matched.</div>
              : (
                <div className="flex flex-col gap-1.5">
                  {discrepancies(i).map((f) => (
                    <div key={f.code} className="text-[12px] rounded-lg px-3 py-2 bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E]">⚠ {f.message}</div>
                  ))}
                  {notices(i).map((f) => (
                    <div key={f.code} className="text-[12px] rounded-lg px-3 py-2 bg-[#F8F9FA] border border-[#E9EDEF] text-[#667781]">ℹ {f.message}</div>
                  ))}
                </div>
              )}
            {needsReview(i) && canManage && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2">
                <span className="text-[12px] text-[#92400E]">Find out what happened, then close the review.</span>
                <button type="button" className={BTN_PRIMARY} onClick={review}>Review</button>
              </div>
            )}
            {isReviewed(i) && (
              <div className="mt-3 text-[12px] text-[#667781]">
                <b className="text-[#111B21]">{reviewLabel(i.review_state)}</b>{i.reviewed_at ? ` · ${whenText(i.reviewed_at)}` : ""}
                {i.review_note && <div className="mt-1 whitespace-pre-wrap">{i.review_note}</div>}
              </div>
            )}
          </section>

          <section>
            <div className="font-black text-[13px] text-[#111B21] mb-1">Receipt</div>
            {row("Date and time", whenText(i.issued_at))}
            {row("Vehicle", units.label(i.device_imei))}
            {row("Driver", driverLabel(i))}
            {row("Fuel", fuelLabel(String(i.fuel_type)))}
            {row("Litres", litres(fuelNum(i.litres)))}
            {row("Price per litre", ugx(fuelNum(i.unit_price)))}
            {row("Total", ugx(fuelNum(i.total_cost)))}
            {row("Station", i.station_name)}
            {row("Paid by", paymentLabel(String(i.payment_method)))}
            {row("Receipt number", i.receipt_number)}
            {row("Odometer", fuelNum(i.odometer_km) !== null ? `${fuelNum(i.odometer_km)!.toLocaleString()} km` : null)}
            {i.notes && <div className="text-[12px] text-[#667781] mt-2 whitespace-pre-wrap">{i.notes}</div>}
          </section>

          <section>
            <div className="font-black text-[13px] text-[#111B21] mb-1">Tracker</div>
            {i.tracker?.state === "checked" ? (
              <>
                {row("Vehicle was at", i.tracker.place || (i.tracker.lat != null ? `${i.tracker.lat}, ${i.tracker.lon}` : null))}
                {row("Position time", whenText(i.tracker.at))}
              </>
            ) : (
              <div className="text-[12px] text-[#667781]">
                {i.tracker?.state === "no_data" ? "The tracker had no position near that time."
                  : i.tracker?.state === "unavailable" ? "The tracker's positions could not be read."
                  : "Not checked against the tracker."}
              </div>
            )}
          </section>

          {(kmPerL !== null || fuelNum(i.km_since_full) !== null) && (
            <section>
              <div className="font-black text-[13px] text-[#111B21] mb-1">Consumption since the last full tank</div>
              {row("Distance", fuelNum(i.km_since_full) !== null ? `${fuelNum(i.km_since_full)!.toFixed(1)} km` : null)}
              {row("Litres", fuelNum(i.litres_since_full) !== null ? litres(fuelNum(i.litres_since_full)) : null)}
              {row("km per litre", kmPerL !== null
                ? <span className={baseline !== null && kmPerL < baseline ? "text-[#B45309]" : ""}>
                    {kmPerL.toFixed(1)}{baseline !== null ? ` (expected ${baseline})` : ""}
                  </span>
                : null)}
            </section>
          )}

          <section>
            <div className="font-black text-[13px] text-[#111B21] mb-2">Receipt photo</div>
            {i.has_receipt
              ? <AuthImage load={receiptLoader} alt="Fuel receipt" className="w-full max-h-[420px] object-contain rounded-lg border border-[#E9EDEF]" />
              : <div className="text-[12px] text-[#667781]">No photo of the receipt.</div>}
            {canManage && !i.voided && (
              <label className={`${BTN} inline-flex items-center mt-2`}>
                {i.has_receipt ? "Replace photo" : "Add photo"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void uploadReceipt(e.target.files?.[0])} />
              </label>
            )}
          </section>
        </>
      )}
      {prompt && <PromptDialog prompt={prompt} onClose={() => setPrompt(null)} />}
    </SidePanel>
  );
}

// ── Fuel profile ────────────────────────────────────────────────────────────

export function FuelProfilePanel({ imei, label, existing, capability, onClose, onSaved }: {
  imei: string;
  label: string;
  existing?: FuelProfile;
  capability?: FuelCapability;
  onClose: () => void;
  onSaved: (p: FuelProfile) => void;
}) {
  const [fuelType, setFuelType] = useState<FuelType>(
    (FUEL_TYPES as readonly string[]).includes(String(existing?.fuel_type)) ? existing!.fuel_type as FuelType : "diesel");
  const [tank, setTank] = useState(existing ? String(fuelNum(existing.tank_capacity_l) ?? "") : "");
  const [baseline, setBaseline] = useState(existing ? String(fuelNum(existing.baseline_km_per_l) ?? "") : "");
  const [tolerance, setTolerance] = useState(fuelNum(existing?.tolerance_pct) ?? 20);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = parsePositive(tank), b = parsePositive(baseline);
  const tankBad = t === null || t > 2000;
  const baseBad = b === null || b > 50;

  const save = async () => {
    setTried(true);
    if (tankBad || baseBad) { setError("Check the highlighted fields."); return; }
    setBusy(true);
    setError(null);
    try {
      onSaved(await saveFuelProfile(imei, { fuel_type: fuelType, tank_capacity_l: t!, baseline_km_per_l: b!, tolerance_pct: tolerance }));
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SidePanel
      title={`Fuel profile · ${label}`}
      subtitle="What this vehicle should use: the yardstick its fuel issues are checked against."
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={BTN}>Cancel</button>
        <button type="button" onClick={save} disabled={busy} className={BTN_PRIMARY}>{busy ? "Saving…" : "Save profile"}</button>
      </>}
    >
      {capability && <div className="text-[12px] text-[#667781]">{sensorLabel(capability.fuel_sensor)}</div>}
      <div>
        <div className={LABEL}>Fuel *</div>
        <div className="flex gap-1.5">
          {FUEL_TYPES.map((f) => (
            <button key={f} type="button" onClick={() => setFuelType(f)}
              className={`h-8 px-3 rounded-full text-[12px] font-extrabold cursor-pointer border ${fuelType === f ? "bg-[#075E54] border-[#075E54] text-white" : "bg-white border-[#E9EDEF]"}`}>
              {fuelLabel(f)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={LABEL} htmlFor="fp-tank">Tank size (litres) *</label>
        <input id="fp-tank" inputMode="decimal" className={`${INPUT} ${tried && tankBad ? "border-[#E53935]" : ""}`} value={tank} onChange={(e) => setTank(e.target.value)} placeholder="e.g. 80" />
        {tried && tankBad && <div className="text-[11px] text-[#B00020] mt-1">Enter the tank size in litres (1 to 2,000).</div>}
      </div>
      <div>
        <label className={LABEL} htmlFor="fp-base">Expected km per litre *</label>
        <input id="fp-base" inputMode="decimal" className={`${INPUT} ${tried && baseBad ? "border-[#E53935]" : ""}`} value={baseline} onChange={(e) => setBaseline(e.target.value)} placeholder="e.g. 9.5" />
        {tried && baseBad
          ? <div className="text-[11px] text-[#B00020] mt-1">Enter a number above 0, up to 50.</div>
          : <div className="text-[11px] text-[#667781] mt-1">From the maker, or measured over a few full tanks.</div>}
      </div>
      <div>
        <label className={LABEL} htmlFor="fp-tol">Tolerance: ±{tolerance}%</label>
        <input id="fp-tol" type="range" min={5} max={50} step={5} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} className="w-full" />
        <div className="text-[11px] text-[#667781]">How far consumption may be worse than expected before an issue is flagged.</div>
      </div>
      {error && <ErrorBanner text={error} />}
    </SidePanel>
  );
}
