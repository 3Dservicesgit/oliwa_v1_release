/**
 * kpis.ts — the first-glance fleet KPIs, ported from OLIWA mobile
 * (lib/models/fleet_kpis.dart, token_runway.dart, token_usage.dart).
 *
 * Fleet status and geofence presence come from GET /fleet/<client>/summary;
 * alerts are derived here from the notification feed; the token runway is the
 * balance divided by the average burn over the last complete days. Nothing is
 * estimated: a figure the data cannot support is left out.
 *
 * Pure: no I/O, `now` injected where time matters.
 */

// ── Shared parsing ───────────────────────────────────────────────────────────

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const int = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

/** "danger zones" → "Danger Zones" (Geozone.titleCase on mobile). */
export function titleCase(s: string): string {
  return s.trim().replace(/\s+/g, " ").split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)).join(" ");
}

/** The backend's "YYYY-MM-DD HH:MM:SS" (Kampala local), or null. */
export function parseStamp(s: unknown): Date | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const d = new Date(t.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// ── A · Fleet status ─────────────────────────────────────────────────────────

export type UnitState = "moving" | "idling" | "parked" | "silent" | "noPosition" | "unread";

/** Display order from the KPI spec: Moving → Parked → Idling → Offline. */
export const UNIT_STATE_ORDER: UnitState[] = ["moving", "parked", "idling", "silent", "noPosition", "unread"];

export const UNIT_STATE_META: Record<UnitState, { label: string; colour: string }> = {
  moving:     { label: "Moving",      colour: "#25D366" },
  parked:     { label: "Parked",      colour: "#E53935" },
  idling:     { label: "Idling",      colour: "#F59E0B" },
  silent:     { label: "Offline",     colour: "#667781" },
  noPosition: { label: "No position", colour: "#F59E0B" },
  unread:     { label: "Not checked", colour: "#8696A0" },
};

export interface FleetStatusKpis {
  counts: Record<UnitState, number>;
  silentAges: { underDay: number; upToWeek: number; overWeek: number };
  /** Units reporting now whose last fix had no position or under 4 satellites. */
  weakGps: number;
  total: number;
}

export const reportingNow = (k: FleetStatusKpis) => k.total - k.counts.silent - k.counts.unread;

/** Units silent for over a day — a device fault more than a parked van. */
export const staleOverDay = (k: FleetStatusKpis) => k.silentAges.upToWeek + k.silentAges.overWeek;

/** Share of the fleet with no device flag, 0..1; null for an empty fleet. */
export const healthyFraction = (k: FleetStatusKpis): number | null =>
  k.total <= 0 ? null : Math.min(1, Math.max(0, (k.total - k.weakGps - staleOverDay(k)) / k.total));

/** A state is listed when a unit is in it, or it is one of the first four. */
export const stateListed = (s: UnitState, k: FleetStatusKpis) =>
  k.counts[s] > 0 || UNIT_STATE_ORDER.indexOf(s) < 4;

/** From the `fleet` object of the summary. A unit that never reported counts
 *  as silent for over a week. */
export function fleetFromServer(m: Obj): FleetStatusKpis {
  const c = obj(m.counts);
  const a = obj(m.silent_ages);
  return {
    counts: {
      moving: int(c.moving), idling: int(c.idling), parked: int(c.parked),
      silent: int(c.silent), noPosition: int(c.no_position), unread: int(c.unread),
    },
    silentAges: {
      underDay: int(a.under_day),
      upToWeek: int(a.up_to_week),
      overWeek: int(a.over_week) + int(a.never),
    },
    weakGps: int(m.weak_gps),
    total: int(m.total),
  };
}

// ── B · Geofence presence ────────────────────────────────────────────────────

export type ZoneCategory = "general" | "depot" | "customer" | "restricted";
export const ZONE_CATEGORIES: ZoneCategory[] = ["general", "depot", "customer", "restricted"];

export const ZONE_META: Record<ZoneCategory, { label: string; plural: string; colour: string }> = {
  general:    { label: "General",       plural: "Other zones",    colour: "#8696A0" },
  depot:      { label: "Depot",         plural: "Depots",         colour: "#075E54" },
  customer:   { label: "Customer site", plural: "Customer sites", colour: "#1565C0" },
  restricted: { label: "Restricted",    plural: "Restricted",     colour: "#E53935" },
};
export const OUTSIDE_ZONE_COLOUR = "#C5CDD2";

export interface DwellKpis {
  visits: number;
  medianMinutes: number | null;
  longest: { unit: string; zone: string; minutes: number } | null;
}

export interface ZoneKpis {
  zoneCount: number;
  inside: number;
  outside: number;
  /** (zone name, units inside), busiest first. */
  topZones: { name: string; units: number }[];
  entriesToday: number;
  exitsToday: number;
  /** Per category: zones of it, units inside at least one of them. */
  byCategory: Partial<Record<ZoneCategory, { zones: number; unitsInside: number }>>;
  restrictedInside: number;
  restrictedUnits: { unit: string; zone: string }[];
  restrictedEntriesToday: number;
  dwell: DwellKpis | null;
}

export const hasCategories = (k: ZoneKpis) =>
  ZONE_CATEGORIES.some((c) => c !== "general" && (k.byCategory[c]?.zones ?? 0) > 0);

export function zonesFromServer(m: Obj): ZoneKpis {
  const byCat = obj(m.by_category);
  const restricted = obj(m.restricted_inside);
  const dwell = m.dwell_today && typeof m.dwell_today === "object" ? obj(m.dwell_today) : null;
  const longest = dwell ? obj(dwell.longest) : {};
  const byCategory: ZoneKpis["byCategory"] = {};
  for (const c of ZONE_CATEGORIES) {
    const v = obj(byCat[c]);
    if (Object.keys(v).length) byCategory[c] = { zones: int(v.zones), unitsInside: int(v.units_inside) };
  }
  return {
    zoneCount: int(m.zone_count),
    inside: int(m.inside),
    outside: int(m.outside),
    topZones: (Array.isArray(m.top_zones) ? m.top_zones : [])
      .map((z) => obj(z))
      .map((z) => ({ name: titleCase(String(z.name ?? "Zone")), units: int(z.units) })),
    entriesToday: int(m.entries_today),
    exitsToday: int(m.exits_today),
    byCategory,
    restrictedInside: int(restricted.count),
    restrictedUnits: (Array.isArray(restricted.units) ? restricted.units : [])
      .map((u) => obj(u))
      .map((u) => ({ unit: String(u.unit ?? ""), zone: titleCase(String(u.zone ?? "")) })),
    restrictedEntriesToday: int(m.restricted_entries_today),
    dwell: dwell
      ? {
          visits: int(dwell.visits),
          medianMinutes: dwell.median_minutes == null ? null : int(dwell.median_minutes),
          longest: Object.keys(longest).length
            ? { unit: String(longest.unit ?? ""), zone: titleCase(String(longest.zone ?? "")), minutes: int(longest.minutes) }
            : null,
        }
      : null,
  };
}

/** Spans of the presence bar: one per category when every unit inside is in
 *  exactly one, otherwise a single "In a zone" span (no double counting). */
export function zoneAllocation(k: ZoneKpis): { label: string; n: number; colour: string }[] {
  const cats = ZONE_CATEGORIES
    .filter((c) => (k.byCategory[c]?.unitsInside ?? 0) > 0)
    .map((c) => ({ c, n: k.byCategory[c]!.unitsInside }));
  const sum = cats.reduce((s, e) => s + e.n, 0);
  const spans: { label: string; n: number; colour: string }[] = [];
  if (hasCategories(k) && sum === k.inside) {
    for (const { c, n } of cats) spans.push({ label: ZONE_META[c].plural, n, colour: ZONE_META[c].colour });
  } else if (k.inside > 0) {
    spans.push({ label: "In a zone", n: k.inside, colour: "#128C7E" });
  }
  if (k.outside > 0) spans.push({ label: "Outside zones", n: k.outside, colour: OUTSIDE_ZONE_COLOUR });
  return spans;
}

// ── C · Alerts ───────────────────────────────────────────────────────────────

export type AlertCategory = "gps" | "fuel" | "driver" | "compliance";
export const ALERT_CATEGORIES: AlertCategory[] = ["gps", "fuel", "driver", "compliance"];
export const ALERT_CATEGORY_LABEL: Record<AlertCategory, string> = {
  gps: "GPS", fuel: "Fuel", driver: "Driver", compliance: "Compliance",
};

export type AlertSeverity = "critical" | "warning" | "info";
export const SEVERITIES: AlertSeverity[] = ["critical", "warning", "info"];
export const SEVERITY_META: Record<AlertSeverity, { label: string; colour: string }> = {
  critical: { label: "Critical", colour: "#E53935" },
  warning:  { label: "Warning",  colour: "#F59E0B" },
  info:     { label: "Info",     colour: "#8696A0" },
};

export interface Alert {
  id: string;
  title: string;
  category: AlertCategory;
  severity: AlertSeverity;
  device: string;
  imei: string;
  geozone: string;
  breachType: string;
  time: Date;
  read: boolean;
  acknowledgedAt: Date | null;
  acknowledgedBy: string;
}

export const isAcknowledged = (a: Alert) => a.acknowledgedAt !== null;
export const timeToAcknowledge = (a: Alert): number | null =>
  a.acknowledgedAt ? Math.max(0, a.acknowledgedAt.getTime() - a.time.getTime()) : null;

/** From a dll_event_notifications row (AppAlert.fromNotification on mobile). */
export function alertFromNotification(n: Obj): Alert {
  const s = (v: unknown) => String(v ?? "");
  const name = s(n.event_name);
  const key = `${name} ${s(n.condition)}`.toLowerCase();
  let category: AlertCategory = "gps";
  if (key.includes("fuel") || key.includes("theft")) category = "fuel";
  else if (["speed", "brak", "accel", "driver", "harsh"].some((w) => key.includes(w))) category = "driver";
  else if (["report", "complian", "export", "mileage"].some((w) => key.includes(w))) category = "compliance";
  const sev = s(n.severity).trim().toLowerCase();
  return {
    id: s(n.notification_uid),
    title: name.trim() || "Alert",
    category,
    severity: (SEVERITIES as string[]).includes(sev) ? (sev as AlertSeverity) : "warning",
    device: s(n.device_name) || s(n.device_imei),
    imei: s(n.device_imei),
    geozone: s(n.geozone_name),
    breachType: s(n.breach_type),
    time: parseStamp(n.date_triggered) ?? new Date(),
    read: n.is_read === true || s(n.is_read) === "true",
    acknowledgedAt: parseStamp(n.acknowledged_at),
    acknowledgedBy: s(n.acknowledged_by),
  };
}

export const isSos = (a: Alert) => {
  const t = a.title.toLowerCase();
  return /\bsos\b/.test(t) || t.includes("panic");
};

export interface AlertKpis {
  /** Alerts in the window ("today" for the default window). */
  today: number;
  open: number;
  unacknowledged: number;
  sos: Alert[];
  byHour: number[];
  byCategory: Record<AlertCategory, number>;
  bySeverity: Record<AlertSeverity, number>;
  acknowledged: number;
  meanToAcknowledgeMs: number | null;
  medianToAcknowledgeMs: number | null;
  /** Per day across a multi-day window, oldest first; empty for one day. */
  byDay: { day: Date; n: number }[];
  /** Up to three units with two or more alerts, and the alert each raised most. */
  topOffenders: { unit: string; n: number; topTitle: string; topN: number }[];
  titlesByCategory: Partial<Record<AlertCategory, { title: string; n: number }[]>>;
}

/** Alert KPIs over since..now — today (from local midnight) by default. */
export function deriveAlerts(all: Alert[], now: Date, since?: Date): AlertKpis {
  const midnight = startOfDay(now);
  const from = since ?? midnight;
  const inWindow = all.filter((a) => a.time >= from && a.time <= now);
  const hours = new Array<number>(24).fill(0);
  const cats = { gps: 0, fuel: 0, driver: 0, compliance: 0 } as Record<AlertCategory, number>;
  const levels = { critical: 0, warning: 0, info: 0 } as Record<AlertSeverity, number>;
  const perDevice = new Map<string, number>();
  const titles = new Map<string, Map<string, number>>();
  const catTitles = new Map<AlertCategory, Map<string, number>>();
  const firstDay = startOfDay(from);
  const dayCount = Math.round((midnight.getTime() - firstDay.getTime()) / 86_400_000) + 1;
  const days = new Array<number>(dayCount > 1 ? dayCount : 0).fill(0);
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  for (const a of inWindow) {
    if (days.length) {
      const i = Math.round((startOfDay(a.time).getTime() - firstDay.getTime()) / 86_400_000);
      if (i >= 0 && i < days.length) days[i]++;
    }
    const title = a.title.trim() || "Alert";
    if (!catTitles.has(a.category)) catTitles.set(a.category, new Map());
    bump(catTitles.get(a.category)!, title);
    if (a.device) {
      if (!titles.has(a.device)) titles.set(a.device, new Map());
      bump(titles.get(a.device)!, title);
      bump(perDevice, a.device);
    }
    hours[a.time.getHours()]++;
    cats[a.category]++;
    levels[a.severity]++;
  }

  const ranked = (m: Map<string, number>) =>
    [...m.entries()].sort((x, y) => y[1] - x[1]).map(([title, n]) => ({ title, n }));
  const offenders = [...perDevice.entries()].filter(([, n]) => n >= 2)
    .sort((x, y) => y[1] - x[1]).slice(0, 3)
    .map(([unit, n]) => {
      const top = ranked(titles.get(unit)!)[0];
      return { unit, n, topTitle: top.title, topN: top.n };
    });
  const waits = inWindow.map(timeToAcknowledge).filter((w): w is number => w !== null).sort((x, y) => x - y);
  const mid = Math.floor(waits.length / 2);
  const titlesByCategory: AlertKpis["titlesByCategory"] = {};
  for (const [c, m] of catTitles) titlesByCategory[c] = ranked(m);

  return {
    today: inWindow.length,
    open: inWindow.filter((a) => !a.read).length,
    unacknowledged: inWindow.filter((a) => !isAcknowledged(a)).length,
    sos: all.filter((a) => !a.read && isSos(a)),
    byHour: hours,
    byCategory: cats,
    bySeverity: levels,
    acknowledged: waits.length,
    meanToAcknowledgeMs: waits.length ? waits.reduce((s, w) => s + w, 0) / waits.length : null,
    medianToAcknowledgeMs: waits.length
      ? waits.length % 2 ? waits[mid] : (waits[mid - 1] + waits[mid]) / 2
      : null,
    byDay: days.map((n, i) => ({ day: new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + i), n })),
    topOffenders: offenders,
    titlesByCategory,
  };
}

// ── D · Tokens ───────────────────────────────────────────────────────────────

export interface Wallet {
  balance: number;
  used: number;
  /** 'none', 'expired', 'pending_activation', 'active', … */
  status: string;
  clientName: string;
}

/** GET /tokens/<client>/balance, summed over the packs the client holds
 *  (FleetService._parseWallet on mobile). */
export function walletFromBalance(data: unknown): Wallet {
  let units = 0, used = 0, packs = 0, spendable = 0, counted = 0, awaiting = 0;
  let countedStatus = "", otherStatus = "", clientName = "";
  const addOne = (m: Obj) => {
    const n = String(m.client_name ?? "");
    if (n && n !== "null") clientName = n;
    const name = String(m.token_name ?? "");
    if (m.token_uid == null && (!name || name === "No tokens")) return;
    packs++;
    const raw = String(m.token_status ?? "").toLowerCase();
    if (raw.includes("expired")) return;
    spendable++;
    const state = String(m.token_units_state ?? "");
    const u = numOrNull(m.token_units_left);
    const readable = state ? state === "number" : u !== null;
    if (state === "awaiting_first_use") awaiting++;
    const named = !!raw && raw !== "null";
    if (readable && u !== null) {
      units += u;
      counted++;
      if (named) countedStatus = raw;
      const spent = numOrNull(m.token_used_units);
      const usedState = String(m.token_used_units_state ?? "");
      if ((usedState ? usedState === "number" : spent !== null) && spent !== null) used += spent;
    } else if (named) {
      otherStatus = raw;
    }
  };
  if (Array.isArray(data)) data.forEach((x) => addOne(obj(x)));
  else addOne(obj(data));
  const status = packs === 0 ? "none"
    : spendable === 0 ? "expired"
    : counted > 0 ? countedStatus || "active"
    : awaiting > 0 ? "pending_activation"
    : otherStatus || "active";
  return { balance: units, used, status, clientName };
}

export interface ServiceUsage { service: string; unit: string; total: number; averagePerDay: number; knownDays: number }
export interface UsageDay { day: Date; byService: Record<string, number>; unknown: number }
export interface TokenUsage { today: Date; days: UsageDay[]; services: ServiceUsage[]; historySince: Date | null }

const dateOnly = (v: unknown): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ""));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};

/** GET /tokens/<client>/usage/daily. */
export function usageFromServer(m: Obj): TokenUsage {
  return {
    today: dateOnly(m.today) ?? startOfDay(new Date()),
    historySince: dateOnly(m.history_since),
    days: (Array.isArray(m.days) ? m.days : []).map((d) => obj(d)).filter((d) => dateOnly(d.day))
      .map((d) => ({
        day: dateOnly(d.day)!,
        byService: Object.fromEntries(Object.entries(obj(d.by_service)).map(([k, v]) => [k, num(v)])),
        unknown: int(d.unknown),
      })),
    services: (Array.isArray(m.services) ? m.services : []).map((s) => obj(s)).map((s) => ({
      service: String(s.service ?? "Other"),
      unit: String(s.unit ?? "unit"),
      total: num(s.total),
      averagePerDay: num(s.average_per_day),
      knownDays: int(s.known_days),
    })),
  };
}

/** Hours when anything is billed in hours, else the unit with the biggest total. */
export const primaryUnit = (u: TokenUsage): string | null =>
  !u.services.length ? null : u.services.some((s) => s.unit === "hour") ? "hour" : u.services[0].unit;

/** Per day, the usage in `unit` (null on a day with no known figure). */
export function dailyIn(u: TokenUsage, unit: string): (number | null)[] {
  const names = new Set(u.services.filter((s) => s.unit === unit).map((s) => s.service));
  return u.days.map((d) => {
    const keys = Object.keys(d.byService).filter((k) => names.has(k));
    return keys.length ? keys.reduce((s, k) => s + d.byService[k], 0) : null;
  });
}

/** Yesterday's figure in `unit` (today is still running). */
export const yesterdayIn = (u: TokenUsage, unit: string): number | null => {
  const v = dailyIn(u, unit);
  return v.length < 2 ? null : v[v.length - 2];
};

/** "12.5 h", "40 events", "1 km". */
export function usageAmount(value: number, unit: string): string {
  const n = Number.isInteger(value) ? String(value) : value.toFixed(1);
  if (unit === "hour") return `${n} h`;
  if (unit === "km") return `${n} km`;
  if (unit === "mb") return `${n} MB`;
  return `${n} ${value === 1 ? unit : `${unit}s`}`;
}

export type RunwayLevel = "none" | "pending" | "critical" | "low" | "healthy" | "unknown";

export interface TokenRunway {
  balance: number;
  used: number;
  status: string;
  /** Tokens a day over `burnDays` complete days; null when none is known. */
  burnPerDay: number | null;
  burnDays: number;
}

/** Days averaged for the burn. */
export const RUNWAY_WINDOW = 7;

export function runwayOf(w: Wallet, usage: TokenUsage | null): TokenRunway {
  let burn: number | null = null;
  let days = 0;
  if (usage && usage.services.some((s) => s.unit === "hour")) {
    const daily = dailyIn(usage, "hour");
    const complete = daily.slice(0, Math.max(0, daily.length - 1)); // today is still running
    const known = complete.filter((v): v is number => v !== null);
    const recent = known.slice(-RUNWAY_WINDOW);
    if (recent.length) {
      days = recent.length;
      burn = recent.reduce((s, v) => s + v, 0) / days;
    }
  }
  return { balance: w.balance, used: w.used, status: w.status, burnPerDay: burn, burnDays: days };
}

export const runwayTotal = (r: TokenRunway) => r.used + r.balance;
export const usedFraction = (r: TokenRunway): number | null =>
  runwayTotal(r) <= 0 ? null : Math.min(1, Math.max(0, r.used / runwayTotal(r)));
export const runwayDays = (r: TokenRunway): number | null =>
  r.burnPerDay === null || r.burnPerDay <= 0 ? null : r.balance / r.burnPerDay;
export const runwayIdle = (r: TokenRunway) => r.burnPerDay !== null && r.burnPerDay <= 0;

export function runwayLevel(r: TokenRunway): RunwayLevel {
  const st = r.status.toLowerCase();
  if (st === "none") return "none";
  if (st.includes("pending")) return "pending";
  if (r.balance <= 0) return "critical";
  const d = runwayDays(r);
  const u = usedFraction(r);
  const left = u === null ? null : 1 - u;
  if (d !== null && d < 3) return "critical";
  if ((d !== null && d < 7) || (left !== null && left < 0.1)) return "low";
  if (d === null && !runwayIdle(r)) return "unknown";
  return "healthy";
}

/** The right-hand figure on the runway card: how long, and on what burn. */
export function runwayText(r: TokenRunway, usageLoading: boolean): [string, string] {
  const level = runwayLevel(r);
  if (level === "none") return ["No tokens", "Buy a token pack to start tracking"];
  if (level === "pending") return ["Not started", "The pack starts counting from its first use"];
  if (r.balance <= 0) return ["0 days", "Top up to stay tracking"];
  if (runwayIdle(r)) {
    return ["Not in use", r.burnDays === 1 ? "Nothing used in the last day" : `Nothing used in the last ${r.burnDays} days`];
  }
  const d = runwayDays(r);
  if (d === null) {
    return usageLoading ? ["…", "Working out the burn"] : ["—", "Runway appears once a full day of usage is recorded"];
  }
  const burn = `${count(r.burnPerDay!)}/day`;
  if (d < 1) return ["< 1 day", `runway at ${burn}`];
  const n = Math.floor(d);
  return [`${n} ${n === 1 ? "day" : "days"}`, `runway at ${burn}`];
}

// ── Formatting ───────────────────────────────────────────────────────────────

/** "18,460"; a fraction is rounded first. */
export const count = (n: number) => Math.round(n).toLocaleString("en-US");

/** "12 s", "4 min", "2 h 5 min", "3 d". */
export function waitLabel(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 1) return `${Math.max(1, Math.round(ms / 1000))} s`;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

/** "just now", "12 s ago", "4 min ago". */
export function agoLabel(at: Date, now: Date): string {
  const s = Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ago`;
}

export const dayLabel = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
