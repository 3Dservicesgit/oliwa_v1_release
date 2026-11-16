/**
 * DeviceManagementSection.tsx
 * Device onboarding, listing, property editing, Teltonika parameter
 * configuration, subscription renewal and deletion.
 * Ported from devices.qt.php — adapts auth + base-URL to project standards.
 */
import React, { useState, useEffect, useCallback } from "react";
import { getStoredAuthToken } from "../../api/client";
import { ENDPOINTS }          from "../../api/endpoints";
import { useAuth }            from "../../auth/AuthContext";
import { usePermissions }     from "../../auth/PermissionsContext";

// ─── Fleet API base ───────────────────────────────────────────────────────────
const FLEET_API    = (import.meta.env.VITE_FLEET_API_URL as string) ?? "https://api.fort-track.online";
const PAGE_SIZE    = 25;
const REG_PAGE_SIZE = 10;

const CAR_TYPES = [
  "Car","Truck","Person","Motorcycle","CyberTruck","Animal","Gas_Station_Dispensor",
];

// ─── Teltonika parameter mapping constants ────────────────────────────────────
const TELTO_PARAMS = [
  { value: "",    label: "Select Source"    },
  { value: "239", label: "Ignition"         },
  { value: "240", label: "Movement"         },
  { value: "80",  label: "Data Mode"        },
  { value: "21",  label: "GSM Signal"       },
  { value: "200", label: "Sleep Mode"       },
  { value: "69",  label: "GNSS Status"      },
  { value: "181", label: "GNSS PDOP"        },
  { value: "182", label: "GNSS HDOP"        },
  { value: "66",  label: "External Voltage" },
  { value: "24",  label: "Speed"            },
  { value: "205", label: "GSM Cell ID"      },
  { value: "206", label: "GSM Area Code"    },
  { value: "67",  label: "Battery Voltage"  },
  { value: "68",  label: "Battery Current"  },
  { value: "199", label: "Trip Odometer"    },
  { value: "16",  label: "Total Odometer"   },
  { value: "1",   label: "Digital Input 1"  },
  { value: "2",   label: "Digital Input 2"  },
  { value: "3",   label: "Digital Input 3"  },
  { value: "9",   label: "Analog Input 1"   },
  { value: "6",   label: "Analog Input 2"   },
  { value: "179", label: "Digital Output 1" },
  { value: "180", label: "Digital Output 2" },
  { value: "36",  label: "Engine RPM"       },
  { value: "48",  label: "Fuel Level"       },
  { value: "60",  label: "Fuel Rate"        },
];

const TELTO_KEYS = [
  "ignition_detect","engine_blocking","driver_detection",
  "din1_work_time","din2_work_time","din3_work_time","din4_work_time",
  "engine_rpm","fuel_consumption","fuel_level","milage_reading",
  "state_of_change","temperature_reading","weight_reading",
  "custom_input1","custom_input2","custom_input3","custom_input4",
] as const;
type TeltoKey = (typeof TELTO_KEYS)[number];

const FORMULA_KEYS: Partial<Record<TeltoKey, string>> = {
  ignition_detect:     "ignition_formular",
  din1_work_time:      "din1_worktime_formular",
  din2_work_time:      "din2_worktime_formular",
  din3_work_time:      "din3_worktime_formular",
  din4_work_time:      "din4_worktime_formular",
  fuel_consumption:    "fuel_consumption_formular",
  fuel_level:          "fuel_level_formular",
  milage_reading:      "milage_formular",
  engine_rpm:          "engine_rpm_formular",
  state_of_change:     "state_of_change_formular",
  temperature_reading: "temperature_formular",
  weight_reading:      "weight_formular",
  custom_input1:       "custom_input1_formular",
  custom_input2:       "custom_input2_formular",
  custom_input3:       "custom_input3_formular",
  custom_input4:       "custom_input4_formular",
};

// ─── Xirgo Global parameter list ─────────────────────────────────────────────
const XIRGO_PARAMS = [
  "regtime","sats","speed","course","altitude","lon","lat",
  "avl_driver","adc2","adc6","adc12","adc16","cell_id","engine_hours",
  "f0","f100","f102","f103",
  "lls_lvl_add1","lls_lvl_add2","lls_lvl_add3","lls_lvl_add4",
  "lls_temp_add1","lls_temp_add2","lls_temp_add3","lls_temp_add4",
  "can_taho","dallas_id_end","dallas_id_end_hex","dallas_id_end_hex_raw",
  "engine_temp","mcc","mnc","odo","ta",
];

// ─── Model-type detection helpers ────────────────────────────────────────────
function isXirgoModel(model: string) {
  return model === "xirgo_global" || model.startsWith("fms_500");
}

function toVendorCategory(hardwareModel: string): string {
  if (isXirgoModel(hardwareModel))    return "xirgo_global";
  if (isTeltonikaModel(hardwareModel)) return "teltonika";
  if (hardwareModel === "wetrack2" || hardwareModel === "wetrack_lite") return "wetrack2_gto6";
  if (hardwareModel === "gt06n-device" || hardwareModel === "et01")     return "other_gt06";
  return hardwareModel;
}
function isTeltonikaModel(model: string) {
  const m = model.toLowerCase();
  return (
    m === "teltonika" ||
    m.startsWith("fmb") || m.startsWith("fmc") || m.startsWith("fmm") ||
    m.startsWith("ftc") || m.startsWith("tat") || m.startsWith("tft") ||
    m.startsWith("all_can") || m.startsWith("ecan")
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Device {
  device_imei:           string;
  device_name:           string;
  client_name:           string;
  client_uid:            string;
  hardware:              string;
  hardware_model:        string;
  simcard:               string;
  simcard_uid:           string;
  car_make:              string;
  car_model:             string;
  vin_number:            string;
  car_type:              string;
  billing_status:        string;
  subscription_status:   string;
  validity_status:       string;
  subscription_end_date: string;
  payment_uid:           string;
}

interface RegisteredDevice {
  device_imei:    string;
  hardware_model: string;
  unit_vendor:    string;
  client_name:    string;
  client_uid:     string;
  device_status:  string;
}

interface ClientItem  { uid: string; label: string; }
interface Transaction { payment_uid: string; payment_validity: string; valid_end_date: string; }
type ToastV = "success" | "error" | "warn" | "info";
interface Toast { id: string; variant: ToastV; title: string; body?: string; out?: boolean; }
type TeltoValues   = Record<string, string>;
type TeltoFormulas = Record<string, string>;
interface CalibEntry { mv: string; vl: string; }

// ─── Fleet fetch helper ───────────────────────────────────────────────────────
async function fleetFetch(method: string, path: string, body?: unknown): Promise<unknown> {
  const token = getStoredAuthToken();
  const hdrs: Record<string, string> = { "Content-Type": "application/json" };
  if (token) hdrs["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${FLEET_API}${path}`, {
    method, headers: hdrs,
    body: body != null ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  return res.json();
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────
function humanKey(k: string) { return k.replace(/_/g, " "); }

function subColor(s: string): { bg: string; color: string } {
  const v = (s || "").toLowerCase();
  if (v === "active" || v === "running" || v === "valid")
    return { bg: "#E8F5E9", color: "#2E7D32" };
  if (v === "expired")
    return { bg: "#FFEBEE", color: "#C62828" };
  if (!v || v === "no payment" || v === "no_payment")
    return { bg: "#F1F3F4", color: "#607D8B" };
  return { bg: "#FFF8E1", color: "#F57F17" };
}

function emptyTeltoValues(): TeltoValues {
  const v: TeltoValues = {};
  TELTO_KEYS.forEach((k) => (v[k] = ""));
  return v;
}

function emptyTeltoFormulas(): TeltoFormulas {
  const f: TeltoFormulas = {};
  Object.values(FORMULA_KEYS).forEach((fk) => { if (fk) f[fk] = "no-config"; });
  return f;
}

function buildNewConfigPayload(
  imei: string, model: string,
  props: { device_name: string; sim_uid: string; car_make: string; car_model: string; client_uid: string; vin_number: string; car_type: string },
  cfgValues: TeltoValues | null, cfgFormulas: TeltoFormulas | null,
  paymentUid: string, cfgUsr: string,
  milivolts: string[], volt_litres: string[],
) {
  const data: Record<string, unknown> = {
    device_imei:        imei,
    device_hardware:    model,
    plate_number:       props.device_name,
    simcard_number:     props.sim_uid || "no-config",
    car_make:           props.car_make,
    car_model:          props.car_model,
    device_client:      props.client_uid,
    vin_number:         props.vin_number,
    car_type:           props.car_type,
    more_local_configs: ["1", "1"],
    engine_blocking:    "enabled",
    driver_detection:   "none",
    calculate_mileage:  "disabled",
    cfg_usr:            cfgUsr,
    payment_uid:        paymentUid,
    milivolts,
    volt_litres,
  };
  TELTO_KEYS.forEach((k) => { data[k] = "no-config"; });
  Object.values(FORMULA_KEYS).forEach((fk) => { if (fk) data[fk] = "no-config"; });
  if (cfgValues)   TELTO_KEYS.forEach((k) => { const v = cfgValues[k]; if (v?.trim()) data[k] = v.trim(); });
  if (cfgFormulas) Object.keys(cfgFormulas).forEach((fk) => { data[fk] = cfgFormulas[fk] || "no-config"; });
  return { data };
}

// ─── Toast stack ──────────────────────────────────────────────────────────────
const TCONF: Record<ToastV, { bar: string; icon: string; col: string }> = {
  warn:    { bar: "bg-[#FB8C00]", icon: "⚠", col: "#FB8C00" },
  error:   { bar: "bg-[#D93025]", icon: "✕", col: "#D93025" },
  info:    { bar: "bg-[#34B7F1]", icon: "ℹ", col: "#34B7F1" },
  success: { bar: "bg-[var(--brand)]", icon: "✓", col: "#128C7E" },
};

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[80] flex flex-col gap-2 items-end pointer-events-none">
      <style>{`@keyframes dms-drain{from{width:100%}to{width:0%}}`}</style>
      {toasts.map((t) => {
        const s = TCONF[t.variant];
        return (
          <div key={t.id}
            className={[
              "pointer-events-auto flex flex-col w-[300px] rounded-xl overflow-hidden",
              "bg-white border border-[#E9EDEF] shadow-[0_8px_30px_rgba(0,0,0,0.18)] border-l-[4px]",
              "transition-all duration-300",
              t.out ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0",
            ].join(" ")}
            style={{ borderLeftColor: s.col }}
          >
            <div className="flex items-start gap-3 px-3.5 pt-3 pb-2.5">
              <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black text-white mt-0.5"
                style={{ background: s.col }}>{s.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-extrabold text-[#111B21] leading-snug">{t.title}</div>
                {t.body && <div className="text-[11px] text-[#667781] mt-0.5 leading-snug">{t.body}</div>}
              </div>
              <button onClick={() => onDismiss(t.id)}
                className="shrink-0 text-[#667781] hover:text-[#111B21] bg-transparent border-none cursor-pointer text-[18px] leading-none">×</button>
            </div>
            <div className="h-[3px] w-full bg-[#F0F2F5]">
              <div className={`h-full rounded-full ${s.bar}`} style={{ animation: "dms-drain 4s linear forwards" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ title, onClose, wide, children }: {
  title: string; onClose: () => void; wide?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`bg-white rounded-xl shadow-2xl ${wide ? "w-[780px]" : "w-[480px]"} max-w-[96vw] max-h-[90vh] flex flex-col border border-[#E9EDEF]`}>
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-[#E9EDEF]">
          <span className="font-black text-[15px] text-[#111B21]">{title}</span>
          <button onClick={onClose}
            className="text-[#667781] hover:text-[#111B21] text-xl font-bold bg-transparent border-none cursor-pointer leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Teltonika config table ───────────────────────────────────────────────────
function TeltonikaConfigTable({ values, formulas, onChange }: {
  values: TeltoValues; formulas: TeltoFormulas;
  onChange: (v: TeltoValues, f: TeltoFormulas) => void;
}) {
  const setVal = (k: string, v: string) => onChange({ ...values, [k]: v }, formulas);
  const setFml = (fk: string, v: string) => onChange(values, { ...formulas, [fk]: v });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-[#F8F9FA] text-[#667781]">
            <th className="text-left px-3 py-2 font-extrabold w-[190px]">Config Key</th>
            <th className="text-left px-3 py-2 font-extrabold w-[240px]">Source (Parameter ID)</th>
            <th className="text-left px-3 py-2 font-extrabold">Formula (optional)</th>
          </tr>
        </thead>
        <tbody>
          {TELTO_KEYS.map((k) => {
            const fk = FORMULA_KEYS[k];
            return (
              <tr key={k} className="border-t border-[#F0F2F5]">
                <td className="px-3 py-2 font-semibold text-[#111B21] capitalize">{humanKey(k)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <select value={values[k] || ""} onChange={(e) => setVal(k, e.target.value)}
                      className="flex-1 h-8 rounded border border-[#E9EDEF] px-2 text-[11px] bg-white outline-none focus:border-[var(--brand)]">
                      {TELTO_PARAMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                    <input
                      value={values[k] && !TELTO_PARAMS.some((p) => p.value === values[k] && p.value !== "") ? values[k] : ""}
                      onChange={(e) => setVal(k, e.target.value)}
                      placeholder="or type ID"
                      className="w-[72px] h-8 rounded border border-[#E9EDEF] px-2 text-[11px] font-mono outline-none focus:border-[var(--brand)]"
                    />
                  </div>
                </td>
                <td className="px-3 py-2">
                  {fk ? (
                    <input
                      value={formulas[fk] && formulas[fk] !== "no-config" ? formulas[fk] : ""}
                      onChange={(e) => setFml(fk, e.target.value || "no-config")}
                      placeholder="no-config"
                      className="w-full h-8 rounded border border-[#E9EDEF] px-2 text-[11px] font-mono outline-none focus:border-[var(--brand)]"
                    />
                  ) : (
                    <span className="text-[#A0AAB4] text-[11px]">N/A</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Xirgo config table ───────────────────────────────────────────────────────
function XirgoConfigTable({ values, formulas, onChange }: {
  values: TeltoValues; formulas: TeltoFormulas;
  onChange: (v: TeltoValues, f: TeltoFormulas) => void;
}) {
  const setVal = (k: string, v: string) => onChange({ ...values, [k]: v }, formulas);
  const setFml = (fk: string, v: string) => onChange(values, { ...formulas, [fk]: v });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-[#F8F9FA] text-[#667781]">
            <th className="text-left px-3 py-2 font-extrabold w-[190px]">Config Key</th>
            <th className="text-left px-3 py-2 font-extrabold w-[220px]">Source (Xirgo Parameter)</th>
            <th className="text-left px-3 py-2 font-extrabold">Formula (optional)</th>
          </tr>
        </thead>
        <tbody>
          {TELTO_KEYS.map((k) => {
            const fk = FORMULA_KEYS[k];
            return (
              <tr key={k} className="border-t border-[#F0F2F5]">
                <td className="px-3 py-2 font-semibold text-[#111B21] capitalize">{humanKey(k)}</td>
                <td className="px-3 py-2">
                  <select value={values[k] || ""} onChange={(e) => setVal(k, e.target.value)}
                    className="w-full h-8 rounded border border-[#E9EDEF] px-2 text-[11px] bg-white outline-none focus:border-[var(--brand)]">
                    <option value="">Select Source</option>
                    {XIRGO_PARAMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  {fk ? (
                    <input
                      value={formulas[fk] && formulas[fk] !== "no-config" ? formulas[fk] : ""}
                      onChange={(e) => setFml(fk, e.target.value || "no-config")}
                      placeholder="no-config"
                      className="w-full h-8 rounded border border-[#E9EDEF] px-2 text-[11px] font-mono outline-none focus:border-[var(--brand)]"
                    />
                  ) : (
                    <span className="text-[#A0AAB4] text-[11px]">N/A</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Calibration rows ─────────────────────────────────────────────────────────
function CalibrationRows({ entries, onChange }: {
  entries: CalibEntry[]; onChange: (e: CalibEntry[]) => void;
}) {
  const add    = () => onChange([...entries, { mv: "", vl: "" }]);
  const remove = (i: number) => onChange(entries.filter((_, j) => j !== i));
  const upd    = (i: number, f: "mv" | "vl", v: string) =>
    onChange(entries.map((e, j) => (j === i ? { ...e, [f]: v } : e)));
  return (
    <div>
      <div className="text-[12px] font-extrabold text-[#111B21] mb-2">Voltage → Litres Calibration</div>
      {entries.map((e, i) => (
        <div key={i} className="flex items-center gap-2 mb-1.5">
          <input value={e.mv} onChange={(ev) => upd(i, "mv", ev.target.value)} placeholder="Milivolts" type="number"
            className="w-[120px] h-8 rounded border border-[#E9EDEF] px-2 text-[12px] outline-none focus:border-[var(--brand)]" />
          <input value={e.vl} onChange={(ev) => upd(i, "vl", ev.target.value)} placeholder="Volt Litres" type="number"
            className="w-[120px] h-8 rounded border border-[#E9EDEF] px-2 text-[12px] outline-none focus:border-[var(--brand)]" />
          <button onClick={() => remove(i)}
            className="h-8 px-3 rounded border border-[#E9EDEF] text-[12px] text-[#C62828] hover:bg-[#FFEBEE] transition-colors cursor-pointer bg-transparent">
            Remove
          </button>
        </div>
      ))}
      <button onClick={add}
        className="h-8 px-3 rounded border border-[var(--brand)] text-[12px] text-[var(--brand)] hover:bg-[#E8F5F2] transition-colors cursor-pointer bg-transparent mt-1">
        + Add Entry
      </button>
    </div>
  );
}

// ─── Shared form primitives ───────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-extrabold text-[#667781] uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "h-9 rounded-lg border border-[#E9EDEF] px-3 text-[12px] text-[#111B21] outline-none focus:border-[var(--brand)] transition-colors bg-[#F8F9FA] disabled:opacity-60";

function FInput({ value, onChange, placeholder, mono, disabled }: {
  value: string; onChange?: (v: string) => void;
  placeholder?: string; mono?: boolean; disabled?: boolean;
}) {
  return (
    <input value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder}
      disabled={disabled}
      className={`${inputCls} ${mono ? "font-mono" : ""}`} />
  );
}

function FSelect({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className={inputCls}>{children}</select>
  );
}

function SaveBtn({ loading, onClick, children }: {
  loading: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={loading}
      className="h-9 px-4 rounded-lg bg-[var(--brand)] text-white text-[12px] font-extrabold hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all border-none cursor-pointer">
      {loading ? "Saving…" : children}
    </button>
  );
}

function CancelBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="h-9 px-4 rounded-lg border border-[#E9EDEF] text-[#111B21] text-[12px] font-extrabold hover:bg-[#F0F2F5] transition-colors cursor-pointer bg-white">
      Cancel
    </button>
  );
}

function SubBadge({ status }: { status: string }) {
  const c = subColor(status);
  return (
    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded"
      style={{ background: c.bg, color: c.color }}>
      {status || "—"}
    </span>
  );
}

// ─── Side-panel form primitives ───────────────────────────────────────────────
const pInputCls = "w-full h-10 rounded-lg border border-[#E9EDEF] px-3 text-[13px] text-[#111B21] outline-none focus:border-[var(--brand)] transition-colors bg-white disabled:opacity-50";

function PField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-black text-[#111B21]">{label}</label>
      {children}
    </div>
  );
}

function PInfo({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] font-black text-[#667781]">{label}</span>
      <span className={`text-[14px] font-semibold text-[#111B21] break-all ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function DeviceManagementSection() {
  const { state: authState } = useAuth();
  const { hasPermission } = usePermissions();

  // ── RBAC permission checks (catalog `can_*` keys) ──────────────────────────
  const canAddDevice       = hasPermission("can_add_device");
  const canEditProps       = hasPermission("can_edit_device_properties");
  const canEditCfg         = hasPermission("can_edit_device_configs");
  const canDeleteDevice    = hasPermission("can_delete_device");
  const canRegisterUnit    = hasPermission("can_register_unit");
  const canRenewPayment    = hasPermission("can_renew_device_payment");
  const canAssignClient    = hasPermission("can_assign_device_client");

  // ── Data state ──────────────────────────────────────────────────────────────
  const [devices,       setDevices]       = useState<Device[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [loadErr,       setLoadErr]       = useState<string | null>(null);
  const [clients,       setClients]       = useState<ClientItem[]>([]);
  const [transactions,  setTransactions]  = useState<Transaction[]>([]);
  const [txLoading,     setTxLoading]     = useState(false);
  const [toasts,        setToasts]        = useState<Toast[]>([]);
  const [canManage,     setCanManage]     = useState(false);
  const [isClientAdmin, setIsClientAdmin] = useState(false);
  const [isInhouse,     setIsInhouse]     = useState(false);

  // ── Registered devices state ─────────────────────────────────────────────────
  const [regDevices,   setRegDevices]   = useState<RegisteredDevice[]>([]);
  const [regLoading,   setRegLoading]   = useState(true);
  const [regLoadErr,   setRegLoadErr]   = useState<string | null>(null);
  const [showRegModal, setShowRegModal] = useState(false);
  const [regForm,      setRegForm]      = useState({ imei: "", model: "", vendor: "", clientUid: "", status: "" });
  const [regSaving,    setRegSaving]    = useState(false);
  const [regSearch,    setRegSearch]    = useState("");
  const [regPage,      setRegPage]      = useState(1);

  // ── Configured devices pagination + search ───────────────────────────────────
  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);

  // ── Actions dropdown ─────────────────────────────────────────────────────────
  const [openMenuImei, setOpenMenuImei] = useState<string | null>(null);

  // ── Panel / modal state ─────────────────────────────────────────────────────
  const [detailsDevice,   setDetailsDevice]   = useState<Device | null>(null);
  const [detailsTab,      setDetailsTab]      = useState<"info" | "tech">("info");
  const [editPropsDevice, setEditPropsDevice] = useState<Device | null>(null);
  const [editCfgDevice,   setEditCfgDevice]   = useState<Device | null>(null);
  const [renewDevice,     setRenewDevice]     = useState<Device | null>(null);
  const [showAddModal,    setShowAddModal]     = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);

  // ── Edit props form ──────────────────────────────────────────────────────────
  const [epForm,   setEpForm]   = useState({ name: "", sim: "", carMake: "", carModel: "", clientUid: "", vin: "", carType: "" });
  const [epSaving, setEpSaving] = useState(false);

  // ── Edit configs form ────────────────────────────────────────────────────────
  const [ecValues,   setEcValues]   = useState<TeltoValues>(emptyTeltoValues());
  const [ecFormulas, setEcFormulas] = useState<TeltoFormulas>(emptyTeltoFormulas());
  const [ecCalib,    setEcCalib]    = useState<CalibEntry[]>([]);
  const [ecSaving,   setEcSaving]   = useState(false);

  // ── Add / configure device form ──────────────────────────────────────────────
  const [adForm,     setAdForm]     = useState({ imei: "", name: "", sim: "", carMake: "", carModel: "", clientUid: "", vin: "", carType: "", model: "teltonika", paymentUid: "", status: "" });
  const [adValues,   setAdValues]   = useState<TeltoValues>(emptyTeltoValues());
  const [adFormulas, setAdFormulas] = useState<TeltoFormulas>(emptyTeltoFormulas());
  const [adCalib,    setAdCalib]    = useState<CalibEntry[]>([]);
  const [adSaving,   setAdSaving]   = useState(false);
  const [adTab,      setAdTab]      = useState<"props" | "cfg">("props");

  // ── Renew form ───────────────────────────────────────────────────────────────
  const [renewPayUid, setRenewPayUid] = useState("");
  const [renewStatus, setRenewStatus] = useState("");
  const [renewSaving, setRenewSaving] = useState(false);

  // ── Load client form ─────────────────────────────────────────────────────────
  const [selClient, setSelClient] = useState("");

  // ── Toast helpers ────────────────────────────────────────────────────────────
  const showToast = useCallback((variant: ToastV, title: string, body?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((p) => [...p.slice(-2), { id, variant, title, body }]);
    setTimeout(() => {
      setToasts((p) => p.map((t) => (t.id === id ? { ...t, out: true } : t)));
      setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 320);
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((p) => p.map((t) => (t.id === id ? { ...t, out: true } : t)));
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 320);
  }, []);

  // ── API helpers ──────────────────────────────────────────────────────────────
  async function loadClients() {
    const primary = authState.accountRoot || authState.accountUid || "";
    if (!primary) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = await fleetFetch("GET", `${ENDPOINTS.FLEET.CLIENTS_ALL}/${encodeURIComponent(primary)}/all`) as any;
      if (j?.status === "success" && Array.isArray(j?.data)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setClients(j.data.map((c: any) => ({ uid: c.client_uid || c.uid || "", label: c.client_name || c.uid || "" })));
      }
    } catch { /**/ }
  }

  async function loadTransactions(): Promise<Transaction[]> {
    const uid = authState.accountRoot || authState.accountUid || "";
    if (!uid) return [];
    setTxLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = await fleetFetch("GET", `${ENDPOINTS.FLEET.ACTIVE_TXNS}/${encodeURIComponent(uid)}`) as any;
      if (j?.status === "success" && Array.isArray(j?.data)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const txs = j.data.map((t: any) => ({
          payment_uid:      t.payment_uid      || "",
          payment_validity: t.payment_validity || "N/A",
          valid_end_date:   t.valid_end_date   || "N/A",
        }));
        setTransactions(txs);
        return txs;
      }
    } catch { /**/ } finally { setTxLoading(false); }
    return [];
  }

  async function enrichSubscriptions(list: Device[]) {
    await Promise.all(
      list.map(async (dev) => {
        if (!dev.device_imei) { dev.subscription_status ||= "No Payment"; return; }
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const j = await fleetFetch("GET", `${ENDPOINTS.FLEET.CHECK_IMEI}/${encodeURIComponent(dev.device_imei)}`) as any;
          if (j?.status === "success" && j?.data) {
            const d = j.data;
            const expired = d.is_expired === true || String(d.is_expired).toLowerCase() === "true";
            const valid   = d.is_valid   === true || String(d.is_valid).toLowerCase()   === "true";
            dev.subscription_status   = expired ? "Expired" : valid ? "Active" : (d.validity_status || "No Payment");
            if (d.valid_end_date)  dev.subscription_end_date = d.valid_end_date;
            if (d.validity_status) dev.validity_status       = d.validity_status;
            if (d.payment_uid)     dev.payment_uid           = d.payment_uid;
          }
        } catch { /**/ }
      })
    );
  }

  async function loadDevices(dataLevel: string, accountUid: string) {
    setLoading(true); setLoadErr(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = await fleetFetch("POST", ENDPOINTS.FLEET.LIST_UNITS, {
        data: { data_level: dataLevel, account_uid: accountUid },
      }) as any;
      if (!j || j.status !== "success" || !Array.isArray(j.data)) {
        setLoadErr("Failed to load devices."); setLoading(false); return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list: Device[] = j.data.map((d: any) => ({
        device_imei:           d.device_imei           ?? "",
        device_name:           d.device_name           ?? "",
        client_name:           d.client_name           ?? "",
        client_uid:            d.client_uid            ?? "",
        hardware:              d.hardware              ?? "",
        hardware_model:        d.hardware_model        ?? "",
        simcard:               d.simcard               ?? "",
        simcard_uid:           d.simcard_uid           ?? "",
        car_make:              d.car_make              ?? "",
        car_model:             d.car_model             ?? "",
        vin_number:            d.vin_number            ?? "",
        car_type:              d.car_type              ?? "",
        billing_status:        d.billing_status        ?? "",
        subscription_status:   d.subscription_status   ?? "",
        validity_status:       d.validity_status       ?? "",
        subscription_end_date: d.subscription_end_date ?? "",
        payment_uid:           d.payment_uid           ?? "",
      }));
      setDevices([...list]); setPage(1); setLoading(false);
      await enrichSubscriptions(list);
      setDevices([...list]);
    } catch { setLoadErr("API error loading devices."); setLoading(false); }
  }

  async function loadRegisteredDevices() {
    const type = authState.accountType || "client";
    const uid  = type.toLowerCase() === "client"
      ? (authState.accountRoot || authState.accountUid || "")
      : (authState.accountUid || "");
    if (!uid) { setRegLoading(false); return; }
    setRegLoading(true); setRegLoadErr(null);
    try {
      // fleetFetch sets Authorization: Bearer <token> — same header as loadDevices (configured devices)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = await fleetFetch("POST", ENDPOINTS.FLEET.LIST_REGISTERED, {
        data: { data_level: type, account_uid: uid },
      }) as any;
      if (j?.status === "success" && Array.isArray(j?.data)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setRegDevices(j.data.map((d: any) => ({
          device_imei:    d.device_imei    ?? d.unit_imei    ?? "",
          hardware_model: d.hardware_model ?? d.asset_model  ?? "",
          unit_vendor:    d.unit_vendor    ?? d.hardware     ?? "",
          client_name:    d.client_name    ?? "",
          client_uid:     d.client_uid     ?? d.client       ?? "",
          device_status:  d.device_status  ?? "",
        })));
      } else {
        setRegLoadErr("Failed to load registered devices.");
      }
    } catch { setRegLoadErr("API error."); } finally { setRegLoading(false); }
  }

  function reload() {
    const type = authState.accountType || "client";
    const uid  = type.toLowerCase() === "client"
      ? (authState.accountRoot || authState.accountUid || "")
      : (authState.accountUid || "");
    loadDevices(type, uid);
  }

  // ── Bootstrap ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const type = authState.accountType || "client";
    const role = (authState.role || "").toLowerCase();
    const inhouse   = type.toLowerCase() === "inhouse";
    const clientAdm = type.toLowerCase() === "client" && role === "admin";
    setIsInhouse(inhouse);
    setIsClientAdmin(clientAdm);
    setCanManage(inhouse || clientAdm);
    const uid = type.toLowerCase() === "client"
      ? (authState.accountRoot || authState.accountUid || "")
      : (authState.accountUid || "");
    if (!uid) { setLoadErr("Missing session — please log in."); setLoading(false); return; }
    Promise.all([loadClients(), loadDevices(type, uid), loadRegisteredDevices()]);
  }, [authState.accountUid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Configured devices — filtered + paginated ────────────────────────────────
  const q          = search.trim().toLowerCase();
  const filtered   = devices.filter((d) =>
    !q || d.device_name.toLowerCase().includes(q) ||
          d.device_imei.toLowerCase().includes(q) ||
          d.client_name.toLowerCase().includes(q)
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paged      = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // ── Registered devices — filtered + paginated ────────────────────────────────
  const regQ          = regSearch.trim().toLowerCase();
  const regFiltered   = regDevices.filter((d) =>
    !regQ || d.device_imei.toLowerCase().includes(regQ) ||
             d.hardware_model.toLowerCase().includes(regQ) ||
             d.unit_vendor.toLowerCase().includes(regQ) ||
             d.client_name.toLowerCase().includes(regQ)
  );
  const regTotalPages = Math.max(1, Math.ceil(regFiltered.length / REG_PAGE_SIZE));
  const regSafePage   = Math.min(regPage, regTotalPages);
  const regPaged      = regFiltered.slice((regSafePage - 1) * REG_PAGE_SIZE, regSafePage * REG_PAGE_SIZE);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function openEditProps(d: Device) {
    setEpForm({ name: d.device_name, sim: d.simcard, carMake: d.car_make, carModel: d.car_model, clientUid: d.client_uid, vin: d.vin_number, carType: d.car_type });
    setEditPropsDevice(d);
  }

  async function saveEditProps() {
    if (!editPropsDevice) return;
    setEpSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = await fleetFetch("POST", ENDPOINTS.FLEET.DEVICE_UPDATE, { data: {
        device_imei:     editPropsDevice.device_imei,
        device_name:     epForm.name,
        simcard:         epForm.sim,
        current_simcard: editPropsDevice.simcard_uid,
        car_make:        epForm.carMake,
        car_model:       epForm.carModel,
        client:          epForm.clientUid,
        vin_number:      epForm.vin,
        car_type:        epForm.carType,
      }}) as any;
      if (j?.status === "success") {
        showToast("success", "Updated", "Device properties saved.");
        setEditPropsDevice(null); reload();
      } else { showToast("error", "Update failed", j?.message ?? "Unexpected response"); }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) { showToast("error", "Update failed", e?.message ?? "Request failed"); }
    finally { setEpSaving(false); }
  }

  function openEditCfg(d: Device) {
    setEcValues(emptyTeltoValues()); setEcFormulas(emptyTeltoFormulas()); setEcCalib([]);
    setEditCfgDevice(d);
  }

  async function saveEditCfg() {
    if (!editCfgDevice) return;
    setEcSaving(true);
    const mvs = ecCalib.map((e) => e.mv || "");
    const vls = ecCalib.map((e) => e.vl || "");
    const payload = {
      data: {
        device_imei:        editCfgDevice.device_imei,
        ...Object.fromEntries(TELTO_KEYS.map((k) => [k, ecValues[k] || "no-config"])),
        ...Object.fromEntries(Object.entries(ecFormulas).map(([k, v]) => [k, v || "no-config"])),
        engine_blocking: "enabled", driver_detection: "none", calculate_mileage: "disabled",
        more_local_configs: [], milivolts: mvs.length ? mvs : [""], volt_litres: vls.length ? vls : [""],
      },
    };
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = await fleetFetch("POST", ENDPOINTS.FLEET.DEVICE_CFG_UPDATE, payload) as any;
      if (j?.status === "success") {
        showToast("success", "Configs updated", "Teltonika configuration saved.");
        setEditCfgDevice(null);
      } else { showToast("error", "Update failed", j?.message ?? "Unexpected"); }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) { showToast("error", "Update failed", e?.message); }
    finally { setEcSaving(false); }
  }

  async function openConfigureRegistered(d: RegisteredDevice) {
    setAdForm({
      imei: d.device_imei, name: "", sim: "", carMake: "", carModel: "",
      clientUid: d.client_uid, vin: "", carType: "",
      model: toVendorCategory(d.hardware_model || "teltonika"), paymentUid: "", status: "",
    });
    setAdValues(emptyTeltoValues()); setAdFormulas(emptyTeltoFormulas()); setAdCalib([]);
    setAdTab("props");
    await loadTransactions();
    setShowAddModal(true);
  }

  async function submitAddDevice() {
    if (!adForm.imei || adForm.imei.length < 10) { setAdForm((f) => ({ ...f, status: "IMEI is required (min 10 digits)." })); return; }
    if (!adForm.name)                             { setAdForm((f) => ({ ...f, status: "Device name is required." })); return; }
    if (!adForm.paymentUid)                       { setAdForm((f) => ({ ...f, status: "Select a transaction payment." })); return; }
    setAdSaving(true);
    const cfgUsr = authState.accountUid || "";
    const mvs = adCalib.map((e) => e.mv || "");
    const vls = adCalib.map((e) => e.vl || "");
    const payload = buildNewConfigPayload(
      adForm.imei, adForm.model,
      { device_name: adForm.name, sim_uid: adForm.sim, car_make: adForm.carMake, car_model: adForm.carModel, client_uid: adForm.clientUid, vin_number: adForm.vin, car_type: adForm.carType },
      (isTeltonikaModel(adForm.model) || isXirgoModel(adForm.model)) ? adValues   : null,
      (isTeltonikaModel(adForm.model) || isXirgoModel(adForm.model)) ? adFormulas : null,
      adForm.paymentUid, cfgUsr,
      mvs.length ? mvs : [""], vls.length ? vls : [""],
    );
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = await fleetFetch("POST", ENDPOINTS.FLEET.DEVICE_CFG_NEW, payload) as any;
      if (j?.status === "success") {
        showToast("success", "Device configured", `${adForm.name} onboarded successfully.`);
        setShowAddModal(false); reload(); loadRegisteredDevices();
      } else { setAdForm((f) => ({ ...f, status: j?.message ?? "Unexpected response" })); }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) { setAdForm((f) => ({ ...f, status: e?.message ?? "Request failed" })); }
    finally { setAdSaving(false); }
  }

  async function submitRegisterUnit() {
    if (!regForm.imei || regForm.imei.length < 10) {
      setRegForm((f) => ({ ...f, status: "IMEI is required (min 10 digits)." })); return;
    }
    if (!regForm.model) {
      setRegForm((f) => ({ ...f, status: "Select a device model." })); return;
    }
    if (!regForm.vendor) {
      setRegForm((f) => ({ ...f, status: "Select a unit vendor." })); return;
    }
    if (!regForm.clientUid) {
      setRegForm((f) => ({ ...f, status: "Select a client." })); return;
    }
    setRegSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = await fleetFetch("POST", ENDPOINTS.FLEET.REGISTER_UNIT, {
        data: {
          unit_imei:        regForm.imei,
          asset_model:      regForm.model,
          unit_vendor:      regForm.vendor,
          client:           regForm.clientUid,
          service_provider: "engine",
        },
      }) as any;
      if (j?.status === "success") {
        showToast("success", "Unit registered", `IMEI ${regForm.imei} registered.`);
        setShowRegModal(false);
        loadRegisteredDevices();
      } else {
        setRegForm((f) => ({ ...f, status: j?.message ?? "Unexpected response" }));
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setRegForm((f) => ({ ...f, status: e?.message ?? "Request failed" }));
    } finally { setRegSaving(false); }
  }

  async function openRenew(d: Device) {
    setRenewPayUid(""); setRenewStatus("");
    setRenewDevice(d);
    await loadTransactions();
  }

  async function submitRenew() {
    if (!renewDevice) return;
    if (!renewPayUid) { setRenewStatus("Select a transaction."); return; }
    setRenewSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = await fleetFetch("POST", ENDPOINTS.FLEET.UPDATE_IMEI, {
        data: { payment_uid: renewPayUid, used_imei: renewDevice.device_imei },
      }) as any;
      if (j?.status === "success") {
        showToast("success", "Renewed", "Payment applied to device.");
        setRenewDevice(null); reload();
      } else { setRenewStatus(j?.message ?? "Unexpected response"); }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) { setRenewStatus(e?.message ?? "Request failed"); }
    finally { setRenewSaving(false); }
  }

  async function deleteDevice(d: Device) {
    if (!window.confirm(`Delete "${d.device_name || d.device_imei}"? This cannot be undone.`)) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = await fleetFetch("POST", ENDPOINTS.FLEET.DEVICE_ACTION, {
        data: { action: "delete", device_imei: d.device_imei },
      }) as any;
      if (j?.status === "success") {
        showToast("success", "Deleted", "Device removed.");
        setDevices((p) => p.filter((x) => x.device_imei !== d.device_imei));
      } else { showToast("error", "Delete failed", j?.message ?? "Unexpected"); }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) { showToast("error", "Delete failed", e?.message); }
  }

  async function loadClientDevices() {
    if (!selClient) { showToast("info", "Select a client first", ""); return; }
    setShowClientModal(false);
    await loadDevices("client", selClient);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-4">

      {/* ══ Left card: Configured Devices ══════════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col bg-white border border-[#E9EDEF] rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)]">

        {/* ── Header ── */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-[#E9EDEF] flex-wrap">
          <div>
            <div className="font-black text-[15px] text-[#111B21]">Configured Devices</div>
            <div className="text-[12px] text-[#667781] mt-0.5">
              {filtered.length} device{filtered.length !== 1 ? "s" : ""}{q ? " (filtered)" : ""}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="search" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name, IMEI, client…"
              className="h-8 w-[200px] rounded-lg border border-[#E9EDEF] px-3 text-[12px] placeholder:text-[#A0AAB4]
                bg-[#F8F9FA] outline-none focus:border-[var(--brand)] transition-colors text-[#111B21]"
            />
            <button onClick={() => { setSearch(""); reload(); }}
              className="h-8 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#667781]
                hover:bg-[#F0F2F5] transition-colors cursor-pointer bg-white">
              Refresh
            </button>
            {canAssignClient && (
              <button onClick={() => { setSelClient(""); setShowClientModal(true); }}
                className="h-8 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#667781]
                  hover:bg-[#F0F2F5] transition-colors cursor-pointer bg-white">
                Load Client
              </button>
            )}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#F8F9FA] text-[#667781] border-b border-[#E9EDEF]">
                <th className="text-left px-4 py-2.5 font-extrabold">Device</th>
                <th className="text-left px-4 py-2.5 font-extrabold">IMEI</th>
                <th className="text-left px-4 py-2.5 font-extrabold">Client</th>
                <th className="text-left px-4 py-2.5 font-extrabold">Subscription</th>
                <th className="text-right px-4 py-2.5 font-extrabold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="text-center text-[#667781] py-10 italic">Loading devices…</td></tr>
              )}
              {!loading && loadErr && (
                <tr><td colSpan={5} className="text-center text-[#D93025] py-10">{loadErr}</td></tr>
              )}
              {!loading && !loadErr && paged.length === 0 && (
                <tr><td colSpan={5} className="text-center text-[#667781] py-10 italic">No devices found.</td></tr>
              )}
              {paged.map((d, i) => {
                const isTelto  = d.hardware.toLowerCase().includes("teltonika") || isTeltonikaModel(d.hardware_model);
                const isXirgo  = d.hardware.toLowerCase().includes("xirgo") || isXirgoModel(d.hardware_model);
                const expired = d.subscription_status.toLowerCase() === "expired";
                const menuOpen = openMenuImei === d.device_imei;
                return (
                  <tr key={d.device_imei} className={`border-b border-[#F0F2F5] ${i % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"}`}>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-[#111B21] truncate max-w-[160px]">{d.device_name || d.device_imei}</div>
                      {d.car_make && <div className="text-[11px] text-[#667781]">{d.car_make} {d.car_model}</div>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[#667781]">{d.device_imei}</td>
                    <td className="px-4 py-2.5 max-w-[140px]">
                      <span className="truncate block">{d.client_name || "—"}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <SubBadge status={d.subscription_status || "—"} />
                      {d.subscription_end_date && (
                        <div className="text-[10px] text-[#A0AAB4] mt-0.5">until {d.subscription_end_date}</div>
                      )}
                    </td>
                    {/* ── Actions dropdown ── */}
                    <td className="px-4 py-2.5 text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={() => setOpenMenuImei(menuOpen ? null : d.device_imei)}
                          className="h-7 px-3 rounded border border-[#E9EDEF] text-[11px] text-[#111B21]
                            hover:bg-[#F0F2F5] cursor-pointer bg-white transition-colors flex items-center gap-1.5">
                          Actions <span className="text-[9px] leading-none">▾</span>
                        </button>
                        {menuOpen && (
                          <div className="absolute right-0 top-8 z-[30] w-[160px] bg-white border border-[#E9EDEF] rounded-lg shadow-xl overflow-hidden">
                            <button
                              onClick={() => { setDetailsTab("info"); setDetailsDevice(d); setOpenMenuImei(null); }}
                              className="w-full text-left px-3 py-2 text-[12px] text-[#111B21] hover:bg-[#F8F9FA] cursor-pointer bg-transparent border-none">
                              View Details
                            </button>
                            {canEditProps && (
                              <button
                                onClick={() => { openEditProps(d); setOpenMenuImei(null); }}
                                className="w-full text-left px-3 py-2 text-[12px] text-[var(--brand)] hover:bg-[#F8F9FA] cursor-pointer bg-transparent border-none">
                                Edit Properties
                              </button>
                            )}
                            {canEditCfg && (isTelto || isXirgo) && (
                              <button
                                onClick={() => { openEditCfg(d); setOpenMenuImei(null); }}
                                className="w-full text-left px-3 py-2 text-[12px] text-[#1565C0] hover:bg-[#F8F9FA] cursor-pointer bg-transparent border-none">
                                Edit Configs
                              </button>
                            )}
                            {canRenewPayment && expired && (
                              <button
                                onClick={() => { openRenew(d); setOpenMenuImei(null); }}
                                className="w-full text-left px-3 py-2 text-[12px] text-[#F57F17] hover:bg-[#FFF8E1] cursor-pointer bg-transparent border-none">
                                Renew Payment
                              </button>
                            )}
                            {canDeleteDevice && (
                              <>
                                <div className="border-t border-[#F0F2F5] my-0.5" />
                                <button
                                  onClick={() => { deleteDevice(d); setOpenMenuImei(null); }}
                                  className="w-full text-left px-3 py-2 text-[12px] text-[#C62828] hover:bg-[#FFEBEE] cursor-pointer bg-transparent border-none">
                                  Delete Device
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-[#E9EDEF] mt-auto">
          <span className="text-[11px] text-[#667781]">
            {filtered.length === 0 ? "0 devices"
              : `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}
              className="w-7 h-7 rounded flex items-center justify-center text-[18px] leading-none
                text-[#667781] disabled:opacity-30 hover:bg-[#F0F2F5] border-none bg-transparent cursor-pointer">‹</button>
            <span className="text-[11px] font-extrabold text-[#111B21] min-w-[52px] text-center">{safePage} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
              className="w-7 h-7 rounded flex items-center justify-center text-[18px] leading-none
                text-[#667781] disabled:opacity-30 hover:bg-[#F0F2F5] border-none bg-transparent cursor-pointer">›</button>
          </div>
        </div>

      </div>{/* end left card */}

      {/* ══ Right card: Registered Devices ═════════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col bg-white border border-[#E9EDEF] rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)] self-start max-h-[calc(100vh-160px)]">

        {/* Header */}
        <div className="shrink-0 flex flex-col gap-2 px-4 py-3 border-b border-[#E9EDEF]">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <div className="font-black text-[14px] text-[#111B21]">Registered Devices</div>
              <div className="text-[11px] text-[#667781] mt-0.5">
                {regFiltered.length} unit{regFiltered.length !== 1 ? "s" : ""}{regQ ? " (filtered)" : ""}
              </div>
            </div>
            {canRegisterUnit && (
              <button
                onClick={() => {
                  setRegForm({ imei: "", model: "", vendor: "", clientUid: "", status: "" });
                  setShowRegModal(true);
                }}
                className="h-8 px-3 rounded-lg bg-[var(--brand)] text-white text-[11px] font-extrabold
                  hover:brightness-105 transition-all border-none cursor-pointer shrink-0">
                + Register New Unit
              </button>
            )}
          </div>
          {/* Search */}
          <input
            type="search" value={regSearch}
            onChange={(e) => { setRegSearch(e.target.value); setRegPage(1); }}
            placeholder="Search IMEI, model, client…"
            className="h-8 w-full rounded-lg border border-[#E9EDEF] px-3 text-[12px] placeholder:text-[#A0AAB4]
              bg-[#F8F9FA] outline-none focus:border-[var(--brand)] transition-colors text-[#111B21]"
          />
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#F0F2F5]">
          {regLoading && (
            <div className="text-center text-[#667781] py-8 text-[12px] italic">Loading…</div>
          )}
          {!regLoading && regLoadErr && (
            <div className="text-center text-[#D93025] py-8 text-[12px] px-3">{regLoadErr}</div>
          )}
          {!regLoading && !regLoadErr && regPaged.length === 0 && (
            <div className="text-center text-[#667781] py-8 text-[12px] italic px-3">
              {regQ ? "No devices match your search." : "No registered devices."}
            </div>
          )}
          {regPaged.map((d) => {
            const isUsed  = d.device_status?.toLowerCase() === "used";
            const model   = d.hardware_model || d.unit_vendor || "";
            return (
              <div key={d.device_imei} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* IMEI + model badge on same row */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[11px] font-semibold text-[#111B21] truncate">{d.device_imei}</span>
                    {model && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F0F2F5] text-[#455A64] shrink-0">
                        {model}
                      </span>
                    )}
                  </div>
                  {d.client_name && (
                    <div className="text-[10px] text-[#A0AAB4] mt-0.5 truncate">{d.client_name}</div>
                  )}
                </div>
                {canAddDevice && (
                  isUsed ? (
                    <button
                      onClick={() => showToast("warn", "Already Configured",
                        `IMEI ${d.device_imei} has already been fully configured and is active. It cannot be re-configured here.`)}
                      className="h-7 px-2.5 rounded border border-[#E9EDEF] text-[11px] text-[#A0AAB4]
                        bg-[#F8F9FA] opacity-60 cursor-not-allowed transition-colors shrink-0">
                      Configure
                    </button>
                  ) : (
                    <button
                      onClick={() => openConfigureRegistered(d)}
                      className="h-7 px-2.5 rounded border border-[#E9EDEF] text-[11px] text-[var(--brand)]
                        hover:bg-[#E8F5F2] cursor-pointer bg-white transition-colors shrink-0">
                      Configure
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-[#E9EDEF]">
          <span className="text-[11px] text-[#667781]">
            {regFiltered.length === 0 ? "0 units"
              : `${(regSafePage - 1) * REG_PAGE_SIZE + 1}–${Math.min(regSafePage * REG_PAGE_SIZE, regFiltered.length)} of ${regFiltered.length}`}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setRegPage((p) => Math.max(1, p - 1))} disabled={regSafePage <= 1}
              className="w-7 h-7 rounded flex items-center justify-center text-[18px] leading-none
                text-[#667781] disabled:opacity-30 hover:bg-[#F0F2F5] border-none bg-transparent cursor-pointer">‹</button>
            <span className="text-[11px] font-extrabold text-[#111B21] min-w-[52px] text-center">{regSafePage} / {regTotalPages}</span>
            <button onClick={() => setRegPage((p) => Math.min(regTotalPages, p + 1))} disabled={regSafePage >= regTotalPages}
              className="w-7 h-7 rounded flex items-center justify-center text-[18px] leading-none
                text-[#667781] disabled:opacity-30 hover:bg-[#F0F2F5] border-none bg-transparent cursor-pointer">›</button>
          </div>
        </div>

      </div>{/* end right card */}

      {/* ── Invisible backdrop to close the Actions dropdown ─────────────────── */}
      {openMenuImei && (
        <div className="fixed inset-0 z-[20]" onClick={() => setOpenMenuImei(null)} />
      )}

      {/* ════════ Modals ════════════════════════════════════════════════════════ */}

      {/* Device Details — side pane */}
      {detailsDevice && (
        <div className="fixed inset-0 z-[60] bg-[#111B21]/30 flex justify-end"
          onClick={() => setDetailsDevice(null)}>
          <div className="bg-white w-full max-w-[480px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[var(--brand-dark)] shrink-0">
              <div>
                <div className="font-black text-[15px] text-white">{detailsDevice.device_name || detailsDevice.device_imei}</div>
                <div className="text-[11px] text-white/70 mt-0.5 font-mono">{detailsDevice.device_imei}</div>
              </div>
              <button onClick={() => setDetailsDevice(null)}
                className="w-8 h-8 rounded-lg bg-white/10 border border-white/25 text-white font-black text-[14px] cursor-pointer grid place-items-center">✕</button>
            </div>

            {/* Tabs */}
            <div className="shrink-0 flex border-b border-[#E9EDEF] bg-white px-5 gap-1">
              {(["info", "tech"] as const).map((tab) => (
                <button key={tab} onClick={() => setDetailsTab(tab)}
                  className={[
                    "h-11 px-4 text-[13px] font-black transition-colors border-none cursor-pointer bg-transparent border-b-2",
                    detailsTab === tab
                      ? "text-[var(--brand-dark)] border-[var(--brand-dark)]"
                      : "text-[#667781] border-transparent hover:text-[#111B21]",
                  ].join(" ")}>
                  {tab === "info" ? "Info" : "Technical Info"}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto bg-white px-6 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

              {detailsTab === "info" && (
                <div className="flex flex-col gap-5">
                  <PInfo label="Device Name"  value={detailsDevice.device_name} />
                  <PInfo label="Client"       value={detailsDevice.client_name} />
                  <PInfo label="Client UID"   value={detailsDevice.client_uid} mono />
                  <div className="grid grid-cols-2 gap-5">
                    <PInfo label="Car Make"  value={detailsDevice.car_make} />
                    <PInfo label="Car Model" value={detailsDevice.car_model} />
                  </div>
                  <PInfo label="VIN Number" value={detailsDevice.vin_number} mono />
                  <PInfo label="Car Type"   value={detailsDevice.car_type} />
                  <div>
                    <span className="text-[13px] font-black text-[#111B21] block mb-1.5">Subscription</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <SubBadge status={detailsDevice.subscription_status || "—"} />
                      {detailsDevice.subscription_end_date && (
                        <span className="text-[13px] text-[#667781]">until {detailsDevice.subscription_end_date}</span>
                      )}
                    </div>
                  </div>
                  {detailsDevice.payment_uid && (
                    <PInfo label="Payment UID" value={detailsDevice.payment_uid} mono />
                  )}
                </div>
              )}

              {detailsTab === "tech" && (
                <div className="flex flex-col gap-5">
                  <PInfo label="Hardware"       value={detailsDevice.hardware} />
                  <PInfo label="Hardware Model" value={detailsDevice.hardware_model} />
                  <PInfo label="SIM Card"       value={detailsDevice.simcard} mono />
                  <PInfo label="SIM UID"        value={detailsDevice.simcard_uid} mono />
                  <PInfo label="IMEI"           value={detailsDevice.device_imei} mono />
                  <div>
                    <span className="text-[13px] font-black text-[#111B21] block mb-2">Raw JSON</span>
                    <pre className="bg-[#F8F9FA] border border-[#E9EDEF] rounded-lg p-3 text-[10px] font-mono overflow-auto max-h-[240px] whitespace-pre-wrap">
                      {JSON.stringify(detailsDevice, null, 2)}
                    </pre>
                    <button
                      onClick={() =>
                        navigator.clipboard?.writeText(JSON.stringify(detailsDevice, null, 2))
                          .then(() => showToast("success", "Copied", "JSON copied to clipboard"))
                          .catch(() => showToast("warn", "Copy failed", "Browser blocked clipboard access"))
                      }
                      className="mt-2 h-8 px-4 rounded-lg border border-[#E9EDEF] text-[12px] font-black text-[#667781] hover:bg-[#F0F2F5] cursor-pointer bg-white transition-colors">
                      Copy JSON
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Properties — side pane */}
      {editPropsDevice && (
        <div className="fixed inset-0 z-[60] bg-[#111B21]/30 flex justify-end"
          onClick={() => setEditPropsDevice(null)}>
          <div className="bg-white w-full max-w-[480px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[var(--brand-dark)] shrink-0">
              <div>
                <div className="font-black text-[15px] text-white">Edit Device</div>
                <div className="text-[11px] text-white/70 mt-0.5">{editPropsDevice.device_name || editPropsDevice.device_imei}</div>
              </div>
              <button onClick={() => setEditPropsDevice(null)}
                className="w-8 h-8 rounded-lg bg-white/10 border border-white/25 text-white font-black text-[14px] cursor-pointer grid place-items-center">✕</button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto bg-white px-6 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex flex-col gap-5">
                <PField label="Device Name">
                  <input value={epForm.name} onChange={(e) => setEpForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Device name" className={pInputCls} />
                </PField>
                <PField label="SIM Card">
                  <input value={epForm.sim} onChange={(e) => setEpForm((f) => ({ ...f, sim: e.target.value }))}
                    placeholder="+25674..." className={`${pInputCls} font-mono`} />
                </PField>
                <div className="grid grid-cols-2 gap-4">
                  <PField label="Car Make">
                    <input value={epForm.carMake} onChange={(e) => setEpForm((f) => ({ ...f, carMake: e.target.value }))}
                      placeholder="Car make" className={pInputCls} />
                  </PField>
                  <PField label="Car Model">
                    <input value={epForm.carModel} onChange={(e) => setEpForm((f) => ({ ...f, carModel: e.target.value }))}
                      placeholder="Car model" className={pInputCls} />
                  </PField>
                </div>
                <PField label="Client">
                  <select value={epForm.clientUid} onChange={(e) => setEpForm((f) => ({ ...f, clientUid: e.target.value }))}
                    className={pInputCls}>
                    <option value="">— Select client —</option>
                    {clients.map((c) => <option key={c.uid} value={c.uid}>{c.label}</option>)}
                  </select>
                </PField>
                <PField label="VIN Number">
                  <input value={epForm.vin} onChange={(e) => setEpForm((f) => ({ ...f, vin: e.target.value }))}
                    placeholder="VIN" className={`${pInputCls} font-mono`} />
                </PField>
                <PField label="Car Type">
                  <select value={epForm.carType} onChange={(e) => setEpForm((f) => ({ ...f, carType: e.target.value }))}
                    className={pInputCls}>
                    <option value="">Select type</option>
                    {CAR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </PField>
                <PField label="IMEI">
                  <input value={editPropsDevice.device_imei} disabled className={`${pInputCls} font-mono`} />
                </PField>
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[#E9EDEF] bg-white">
              <CancelBtn onClick={() => setEditPropsDevice(null)} />
              <SaveBtn loading={epSaving} onClick={saveEditProps}>Save Changes</SaveBtn>
            </div>
          </div>
        </div>
      )}

      {/* Edit Teltonika Configs */}
      {editCfgDevice && (() => {
        const hwStr = (editCfgDevice.hardware + " " + editCfgDevice.hardware_model).toLowerCase();
        const editIsXirgo = hwStr.includes("xirgo") || isXirgoModel(editCfgDevice.hardware_model);
        return (
        <Modal title={`Edit Configs — ${editCfgDevice.device_name}`} onClose={() => setEditCfgDevice(null)} wide>
          <div className="text-[11px] text-[#667781] bg-[#F8F9FA] border border-[#E9EDEF] rounded-lg px-3 py-2.5 mb-4">
            Map parameter sources for each config key. Empty values are sent as <code className="font-mono">no-config</code>.
            {editIsXirgo && <span className="ml-1 font-extrabold text-[#1565C0]">(Xirgo Global)</span>}
          </div>
          {editIsXirgo
            ? <XirgoConfigTable values={ecValues} formulas={ecFormulas}
                onChange={(v, f) => { setEcValues(v); setEcFormulas(f); }} />
            : <TeltonikaConfigTable values={ecValues} formulas={ecFormulas}
                onChange={(v, f) => { setEcValues(v); setEcFormulas(f); }} />
          }
          <div className="mt-5 pt-4 border-t border-[#F0F2F5]">
            <CalibrationRows entries={ecCalib} onChange={setEcCalib} />
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <CancelBtn onClick={() => setEditCfgDevice(null)} />
            <SaveBtn loading={ecSaving} onClick={saveEditCfg}>Update Configs</SaveBtn>
          </div>
        </Modal>
        );
      })()}

      {/* Renew Payment */}
      {renewDevice && (
        <Modal title="Renew Payment" onClose={() => setRenewDevice(null)}>
          <p className="text-[12px] text-[#667781] mb-3">
            Assign an active transaction to{" "}
            <span className="font-extrabold text-[#111B21]">{renewDevice.device_name || renewDevice.device_imei}</span>.
          </p>
          {txLoading ? (
            <div className="text-[12px] text-[#667781] italic">Loading transactions…</div>
          ) : (
            <FSelect value={renewPayUid} onChange={setRenewPayUid}>
              <option value="">— Select transaction —</option>
              {transactions.map((t) => (
                <option key={t.payment_uid} value={t.payment_uid}>
                  {t.payment_validity} (until: {t.valid_end_date})
                </option>
              ))}
            </FSelect>
          )}
          {renewStatus && <div className="text-[12px] text-[#D93025] mt-2">{renewStatus}</div>}
          <div className="flex justify-end gap-2 mt-5">
            <CancelBtn onClick={() => setRenewDevice(null)} />
            <SaveBtn loading={renewSaving} onClick={submitRenew}>Renew</SaveBtn>
          </div>
        </Modal>
      )}

      {/* Load Client Devices */}
      {showClientModal && (
        <Modal title="Load Client Devices" onClose={() => setShowClientModal(false)}>
          <Field label="Select Client">
            <FSelect value={selClient} onChange={setSelClient}>
              <option value="">— Select client —</option>
              {clients.map((c) => <option key={c.uid} value={c.uid}>{c.label}</option>)}
            </FSelect>
          </Field>
          <div className="flex justify-end gap-2 mt-5">
            <CancelBtn onClick={() => setShowClientModal(false)} />
            <SaveBtn loading={false} onClick={loadClientDevices}>Load Devices</SaveBtn>
          </div>
        </Modal>
      )}

      {/* Configure Device (full onboarding) */}
      {showAddModal && (
        <Modal title="Configure Device" onClose={() => setShowAddModal(false)} wide>
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div className="text-[11px] text-[#667781]">
              Supports: <strong>Teltonika</strong> · <strong>Xirgo Global</strong> · <strong>Concox</strong> · <strong>GT06N</strong>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-extrabold text-[#667781] uppercase shrink-0">Vendor</label>
              <FSelect value={adForm.model} onChange={(v) => setAdForm((f) => ({ ...f, model: v }))}>
                <option value="">— Select vendor —</option>
                <option value="teltonika">Teltonika</option>
                <option value="xirgo_global">Xirgo Global</option>
                <option value="wetrack2_gto6">Concox (WeTrack2 / GT06)</option>
                <option value="other_gt06">Other GT06N</option>
              </FSelect>
            </div>
          </div>

          <div className="flex border-b border-[#E9EDEF] mb-5 gap-1">
            {(["props", "cfg"] as const).map((tab) => (
              <button key={tab} onClick={() => setAdTab(tab)}
                className={[
                  "h-9 px-4 text-[12px] font-extrabold transition-colors border-none cursor-pointer bg-transparent",
                  adTab === tab
                    ? "text-[var(--brand)] border-b-2 border-[var(--brand)]"
                    : "text-[#667781] hover:text-[#111B21]",
                ].join(" ")}>
                {tab === "props" ? "Device Properties" : "Parameter Configuration"}
              </button>
            ))}
          </div>

          {adTab === "props" && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="IMEI *">
                <FInput value={adForm.imei}       onChange={(v) => setAdForm((f) => ({ ...f, imei: v }))}       placeholder="IMEI number" mono />
              </Field>
              <Field label="Device Name *">
                <FInput value={adForm.name}       onChange={(v) => setAdForm((f) => ({ ...f, name: v }))}       placeholder="Device name" />
              </Field>
              <Field label="SIM Card">
                <FInput value={adForm.sim}        onChange={(v) => setAdForm((f) => ({ ...f, sim: v }))}        placeholder="+25674..." mono />
              </Field>
              <Field label="Car Make">
                <FInput value={adForm.carMake}    onChange={(v) => setAdForm((f) => ({ ...f, carMake: v }))}    placeholder="Car make" />
              </Field>
              <Field label="Car Model">
                <FInput value={adForm.carModel}   onChange={(v) => setAdForm((f) => ({ ...f, carModel: v }))}   placeholder="Car model" />
              </Field>
              <Field label="Client">
                <FSelect value={adForm.clientUid} onChange={(v) => setAdForm((f) => ({ ...f, clientUid: v }))}>
                  <option value="">— Select client —</option>
                  {clients.map((c) => <option key={c.uid} value={c.uid}>{c.label}</option>)}
                </FSelect>
              </Field>
              <Field label="VIN Number">
                <FInput value={adForm.vin}        onChange={(v) => setAdForm((f) => ({ ...f, vin: v }))}        placeholder="VIN" mono />
              </Field>
              <Field label="Car / Unit Type">
                <FSelect value={adForm.carType}   onChange={(v) => setAdForm((f) => ({ ...f, carType: v }))}>
                  <option value="">Select type</option>
                  {CAR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </FSelect>
              </Field>
              <Field label="Transaction Payment *">
                <FSelect value={adForm.paymentUid} onChange={(v) => setAdForm((f) => ({ ...f, paymentUid: v }))}>
                  <option value="">{txLoading ? "Loading…" : "— Select transaction —"}</option>
                  {transactions.map((t) => (
                    <option key={t.payment_uid} value={t.payment_uid}>
                      {t.payment_validity} (until: {t.valid_end_date})
                    </option>
                  ))}
                </FSelect>
              </Field>
            </div>
          )}

          {adTab === "cfg" && (
            isTeltonikaModel(adForm.model) ? (
              <div>
                <div className="text-[11px] text-[#667781] bg-[#F8F9FA] border border-[#E9EDEF] rounded-lg px-3 py-2.5 mb-4">
                  Choose parameter source IDs. Empty values will be sent as <code className="font-mono">no-config</code>.
                </div>
                <TeltonikaConfigTable values={adValues} formulas={adFormulas}
                  onChange={(v, f) => { setAdValues(v); setAdFormulas(f); }} />
                <div className="mt-5 pt-4 border-t border-[#F0F2F5]">
                  <CalibrationRows entries={adCalib} onChange={setAdCalib} />
                </div>
              </div>
            ) : isXirgoModel(adForm.model) ? (
              <div>
                <div className="text-[11px] text-[#667781] bg-[#F8F9FA] border border-[#E9EDEF] rounded-lg px-3 py-2.5 mb-4">
                  Choose parameter sources for Xirgo Global. Empty values will be sent as <code className="font-mono">no-config</code>.
                </div>
                <XirgoConfigTable values={adValues} formulas={adFormulas}
                  onChange={(v, f) => { setAdValues(v); setAdFormulas(f); }} />
                <div className="mt-5 pt-4 border-t border-[#F0F2F5]">
                  <CalibrationRows entries={adCalib} onChange={setAdCalib} />
                </div>
              </div>
            ) : (
              <div className="border border-[#E9EDEF] rounded-lg p-5">
                <div className="font-extrabold text-[#111B21]">No Configuration Required</div>
                <div className="text-[12px] text-[#667781] mt-1">This device type does not require parameter mapping.</div>
              </div>
            )
          )}

          {adForm.status && (
            <div className="text-[12px] text-[#D93025] font-semibold mt-3">{adForm.status}</div>
          )}
          <div className="flex justify-end gap-2 mt-5">
            <CancelBtn onClick={() => setShowAddModal(false)} />
            <SaveBtn loading={adSaving} onClick={submitAddDevice}>Save Configuration</SaveBtn>
          </div>
        </Modal>
      )}

      {/* Register New Unit */}
      {showRegModal && (
        <Modal title="Register New Unit" onClose={() => setShowRegModal(false)}>
          <div className="text-[11px] text-[#667781] bg-[#F8F9FA] border border-[#E9EDEF] rounded-lg px-3 py-2.5 mb-4">
            Register a device by IMEI and hardware type. Full parameter configuration can be done afterwards from the Registered Devices list.
          </div>
          <div className="flex flex-col gap-4">
            <Field label="IMEI *">
              <FInput
                value={regForm.imei}
                onChange={(v) => setRegForm((f) => ({ ...f, imei: v }))}
                placeholder="IMEI number"
                mono
              />
            </Field>
            <Field label="Device Model *">
              <FSelect value={regForm.model} onChange={(v) => setRegForm((f) => ({ ...f, model: v }))}>
                <option value="">— Choose device model —</option>
                <optgroup label="Concox Hardware">
                  <option value="wetrack2">WeTrack2</option>
                  <option value="wetrack_lite">WeTrack Lite</option>
                </optgroup>
                <optgroup label="Xirgo-Global Hardware">
                  <option value="fms_500_one">FMS-500 One</option>
                  <option value="fms_500_stcan">FMS-500 STCAN</option>
                  <option value="fms_500_light">FMS-500 Light</option>
                </optgroup>
                <optgroup label="Teltonika Hardware">
                  <option value="fmb_130">FMB-130</option>
                  <option value="fmb_920">FMB-920</option>
                  <option value="fmc_130">FMC-130</option>
                  <option value="fmc_234">FMC-234</option>
                  <option value="ftc_881">FTC-881</option>
                  <option value="ftc_921">FTC-921</option>
                  <option value="ftc_961">FTC-961</option>
                  <option value="tat_141">TAT-141</option>
                  <option value="tat_240">TAT-240</option>
                  <option value="fmc_150">FMC-150</option>
                  <option value="fmc_650">FMC-650</option>
                  <option value="fmc_920">FMC-920</option>
                  <option value="all_can_300">ALL CAN-300</option>
                  <option value="ecan_02">ECAN-02</option>
                  <option value="fmb_001">FMB-001</option>
                  <option value="fmb_003">FMB-003</option>
                  <option value="fmb_010">FMB-010</option>
                  <option value="fmb_020">FMB-020</option>
                  <option value="fmb_110">FMB-110</option>
                  <option value="fmb_120">FMB-120</option>
                  <option value="fmb_122">FMB-122</option>
                  <option value="fmb_125">FMB-125</option>
                  <option value="fmb_140">FMB-140</option>
                  <option value="fmb_150">FMB-150</option>
                  <option value="fmb_202">FMB-202</option>
                  <option value="fmb_204">FMB-204</option>
                  <option value="fmb_209">FMB-209</option>
                  <option value="fmb_225">FMB-225</option>
                  <option value="fmb_230">FMB-230</option>
                  <option value="fmb_240">FMB-240</option>
                  <option value="fmb_641">FMB-641</option>
                  <option value="fmb_900">FMB-900</option>
                  <option value="fmb_910">FMB-910</option>
                  <option value="fmb_930">FMB-930</option>
                  <option value="fmb_965">FMB-965</option>
                  <option value="fmc_003">FMC-003</option>
                  <option value="fmc_125">FMC-125</option>
                  <option value="fmc_13a">FMC-13A</option>
                  <option value="fmc_225">FMB-225</option>
                  <option value="fmc_230">FMC-230</option>
                  <option value="fmc_800">FMC-800</option>
                  <option value="fmc_880">FMC-880</option>
                  <option value="fmm_003">FMM-003</option>
                  <option value="fmm_00a">FMM-00A</option>
                  <option value="fmm_125">FMM-125</option>
                  <option value="fmm_130">FMM-130</option>
                  <option value="fmm_13a">FMM-13A</option>
                  <option value="fmm_150">FMM-150</option>
                  <option value="fmm_230">FMB-230</option>
                  <option value="fmm_650">FMM-650</option>
                  <option value="fmm_800">FMM-800</option>
                  <option value="fmm_80a">FMM-80A</option>
                  <option value="fmm_880">FMM-880</option>
                  <option value="fmm_920">FMM-920</option>
                  <option value="fmt_100">FMT-100</option>
                  <option value="tat_140">TAT-140</option>
                  <option value="tft_100">TFT-100</option>
                </optgroup>
                <optgroup label="Other Devices">
                  <option value="gt06n-device">GT06N Protocol Device</option>
                  <option value="et01">ET01</option>
                </optgroup>
              </FSelect>
            </Field>
            <Field label="Unit Vendor *">
              <FSelect value={regForm.vendor} onChange={(v) => setRegForm((f) => ({ ...f, vendor: v }))}>
                <option value="">— Choose vendor —</option>
                <option value="concox">Concox</option>
                <option value="teltonika">Teltonika</option>
                <option value="other">GT06N Manufacturer</option>
                <option value="xirgo_global">Xirgo Global</option>
                <option value="king sword">King Sword</option>
              </FSelect>
            </Field>
            <Field label="Client *">
              <FSelect value={regForm.clientUid} onChange={(v) => setRegForm((f) => ({ ...f, clientUid: v }))}>
                <option value="">— Select client —</option>
                {clients.map((c) => <option key={c.uid} value={c.uid}>{c.label}</option>)}
              </FSelect>
            </Field>
            {regForm.status && (
              <div className="text-[12px] text-[#D93025] font-semibold">{regForm.status}</div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <CancelBtn onClick={() => setShowRegModal(false)} />
            <SaveBtn loading={regSaving} onClick={submitRegisterUnit}>Register Unit</SaveBtn>
          </div>
        </Modal>
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
