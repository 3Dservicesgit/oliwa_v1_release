/**
 * views.tsx — the dashboard's sections, all on one scrollable page: Fleet
 * status, Geofence presence, Alerts, Tokens (the content of OLIWA mobile's
 * analytics screens, mock-up pages 36–39). Figures the backend does not serve
 * yet are left out, as on the phone.
 */
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ALERT_CATEGORIES, ALERT_CATEGORY_LABEL, count, dailyIn, dayLabel, deriveAlerts, healthyFraction,
  isAcknowledged, primaryUnit, reportingNow, runwayLevel, runwayOf, runwayText, runwayTotal, SEVERITIES, SEVERITY_META,
  staleOverDay, usageAmount, usedFraction, waitLabel, yesterdayIn, zoneAllocation, agoLabel,
  type Alert, type AlertKpis, type FleetStatusKpis, type ZoneKpis,
} from "./kpis";
import { acknowledgeAlert, ALERT_CAP } from "./api";
import { useAlerts, type SummaryState, type TokensState } from "./hooks";
import { DeviceHealth, FleetBreakdown } from "./fleet";
import { CONSOLE_LINKS } from "./routes";
import { Bars, LivePill, LiveStamp, Panel, PrimaryButton, Segmented, Skeleton, SplitBar, StatTile, Unavailable } from "./ui";
import { C } from "./style";

/** Line icons for the section headers (24 px grid, stroke = currentColor). */
const ICONS: Record<string, ReactNode> = {
  "fleet-status": (<><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>),
  "geofence-presence": (<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" /><circle cx="12" cy="10" r="2.4" /></>),
  alerts: (<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>),
  tokens: (<><ellipse cx="12" cy="6.5" rx="7" ry="3" /><path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" /><path d="M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" /></>),
};

/** One section of the dashboard: a panel with a header strip (icon, title,
 *  live subtitle, actions) over its content. */
export function Section({ id, title, subtitle, action, children }: {
  id: string; title: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`}
      className="scroll-mt-20 overflow-hidden rounded-2xl border border-[#E4E8EB] bg-white">
      <header className="flex flex-wrap items-center gap-3 border-b border-[#EEF1F3] bg-[#FAFBFC] px-5 py-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E7F3F1] text-[#075E54]" aria-hidden="true">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{ICONS[id]}</svg>
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="text-[16px] font-semibold leading-tight text-[#111B21]">{title}</h2>
          {subtitle != null && <div className="mt-0.5 text-[12.5px] text-[#667781]">{subtitle}</div>}
        </div>
        {action}
      </header>
      <div className="flex flex-col gap-6 p-5">{children}</div>
    </section>
  );
}

const linkCls = "text-[14px] font-semibold text-[#075E54] hover:underline";

const minutes = (m: number) => (m < 1 ? "< 1m" : m < 60 ? `${m}m` : m % 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m / 60}h`);

// ── Fleet status ─────────────────────────────────────────────────────────────

function AgeRow({ label, n, of, colour }: { label: string; n: number; of: number; colour: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="w-[40%] text-[14px] text-[#111B21]">{label}</span>
      <div className="flex-1 h-[7px] rounded bg-[#F0F2F5] overflow-hidden">
        <div className="h-full rounded" style={{ width: `${of ? (n / of) * 100 : 0}%`, background: colour }} />
      </div>
      <span className="w-10 text-right text-[15px] font-semibold tabular-nums">{n}</span>
    </div>
  );
}

function HealthRow({ title, detail, flagged, of, ink, tint, glyph }: {
  title: string; detail: string; flagged: number; of: number; ink: string; tint: string; glyph: string;
}) {
  const ok = of === 0 ? null : Math.min(1, Math.max(0, (of - flagged) / of));
  return (
    <div className="flex items-center gap-3.5 py-3">
      <span className="w-11 h-11 rounded-xl flex items-center justify-center text-[18px] font-bold" style={{ background: tint, color: ink }}>{glyph}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-[#111B21]">{title}</div>
        <div className="text-[12.5px] text-[#667781]">{detail}</div>
      </div>
      <div className="text-right">
        <div className="text-[16px] font-semibold">{ok === null ? "—" : `${Math.round(ok * 100)}%`}</div>
        <div className="text-[12px] text-[#667781]">{flagged} flagged</div>
      </div>
    </div>
  );
}

function Ageing({ k }: { k: FleetStatusKpis }) {
  const silent = k.counts.silent;
  const stale = staleOverDay(k);
  return (
    <Panel title="Offline ageing"
      subtitle={silent === 0 ? "Every unit reported in the last hour" : `${silent} ${silent === 1 ? "unit" : "units"} · server time − last valid ping`}>
      <div className="divide-y divide-[#E9EDEF]">
        <AgeRow label="1–24 hours" n={k.silentAges.underDay} of={silent} colour={C.hint} />
        <AgeRow label="1–7 days" n={k.silentAges.upToWeek} of={silent} colour={C.muted} />
        <AgeRow label="Over 7 days" n={k.silentAges.overWeek} of={silent} colour={C.ink} />
      </div>
      {stale > 0 && (
        <div className="mt-2.5 text-[13px] text-[#111B21]">
          ⚠ {stale} {stale === 1 ? "tracker" : "trackers"} silent for over 24 h — check power or SIM
        </div>
      )}
    </Panel>
  );
}

function Hardware({ k }: { k: FleetStatusKpis }) {
  const healthy = healthyFraction(k) ?? 0;
  const flagged = k.weakGps + staleOverDay(k);
  return (
    <Panel title="Hardware & sensor health"
      subtitle={`${Math.round(healthy * 100)}% of fleet fully healthy (${k.total - flagged} / ${k.total})`}>
      <div className="divide-y divide-[#E9EDEF]">
        {/* Power & backup battery and Cellular signal wait on the backend
            (fleet.low_battery / fleet.weak_signal in the summary). */}
        <HealthRow title="GPS fix quality" detail="Live units with no fix or under 4 satellites"
          flagged={k.weakGps} of={reportingNow(k)} ink={C.amberInk} tint="#FDF0D5" glyph="⌖" />
        <HealthRow title="SIM heartbeat" detail="Missed check-ins · silent for over 24 hours"
          flagged={staleOverDay(k)} of={k.total} ink={C.muted} tint={C.fieldFill} glyph="⋯" />
      </div>
    </Panel>
  );
}

export function FleetStatusSection({ s }: { s: SummaryState }) {
  const navigate = useNavigate();
  const k = s.summary?.fleet ?? null;
  const units = k && k.total ? `${count(k.total)} ${k.total === 1 ? "unit" : "units"} · ` : "";
  return (
    <Section id="fleet-status" title="Fleet status"
      subtitle={<LiveStamp at={s.updatedAt} stale={s.stale} connecting={s.loading} prefix={units} />}
      action={<div className="flex items-center gap-3">{k && <LivePill stale={s.stale} />}
        <button type="button" onClick={() => navigate(CONSOLE_LINKS.liveMap)} className={linkCls}>Live map →</button></div>}>
      {s.loading && !k ? <Skeleton lines={4} /> : !k ? <Unavailable>The fleet breakdown could not be loaded. It retries every 30 seconds.</Unavailable>
        : k.total === 0 ? <Unavailable>No units registered yet.</Unavailable>
        : (
          <>
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-[#EEF1F3] items-start [&>*]:lg:px-5 [&>*:first-child]:lg:pl-0 [&>*:last-child]:lg:pr-0">
              <FleetBreakdown k={k} size={150} />
              <DeviceHealth k={k} />
            </div>
            <div className="grid gap-6 border-t border-[#EEF1F3] pt-6 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-[#EEF1F3] [&>*]:lg:px-5 [&>*:first-child]:lg:pl-0 [&>*:last-child]:lg:pr-0">
              <Ageing k={k} />
              <Hardware k={k} />
            </div>
          </>
        )}
    </Section>
  );
}

// ── Geofence presence ────────────────────────────────────────────────────────

function Allocation({ k }: { k: ZoneKpis }) {
  const active = k.inside + k.outside;
  const spans = zoneAllocation(k);
  if (active === 0) return <Panel title="Fleet allocation"><Unavailable>No unit has a position to place yet.</Unavailable></Panel>;
  return (
    <Panel title="Fleet allocation" subtitle="Share of active fleet right now">
      <SplitBar height={14} parts={spans.map((s) => ({ n: s.n, colour: s.colour, label: s.label }))} />
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {spans.map((s) => (
          <div key={s.label} className="border-l-[3px] border-[#E9EDEF] pl-3">
            <div className="flex items-center gap-1.5 text-[12.5px] text-[#667781]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.colour }} />{s.label}
            </div>
            <div className="mt-1 text-[22px] font-semibold tabular-nums">{Math.round((s.n * 100) / active)}%</div>
            <div className="text-[12px] text-[#667781]">{count(s.n)} {s.n === 1 ? "unit" : "units"}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function TopZones({ k }: { k: ZoneKpis }) {
  const max = k.topZones[0]?.units ?? 0;
  return (
    <Panel title={`Top ${k.topZones.length} occupied zones`} subtitle="Most vehicles inside right now">
      <ol className="divide-y divide-[#E9EDEF]">
        {k.topZones.map((z, i) => (
          <li key={z.name} className="flex items-start gap-2 py-3">
            <span className="w-6 text-[14px] text-[#667781]">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="truncate text-[15px] font-semibold text-[#111B21]">{z.name}</div>
              <div className="mt-2 h-[7px] rounded bg-[#F0F2F5] overflow-hidden">
                <div className="h-full rounded bg-[#128C7E]" style={{ width: `${max ? (z.units / max) * 100 : 0}%` }} />
              </div>
            </div>
            <span className="w-10 text-right text-[16px] font-semibold tabular-nums">{z.units}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function Restricted({ k }: { k: ZoneKpis }) {
  const units = k.restrictedUnits;
  return (
    <div className="rounded-[18px] border-[1.5px] border-[#E53935] bg-[#FDECEC] p-3.5 flex gap-3">
      <span className="w-[38px] h-[38px] rounded-[10px] bg-[#E53935] text-white flex items-center justify-center font-black">⊘</span>
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-[#111B21]">
          {k.restrictedInside === 1 && units.length ? `${units[0].unit} in restricted zone` : `${k.restrictedInside} vehicles in restricted zones`}
        </div>
        {units.map((u) => (
          <div key={`${u.unit}-${u.zone}`} className="text-[12.5px] text-[#667781]">{k.restrictedInside === 1 ? u.zone : `${u.unit} · ${u.zone}`}</div>
        ))}
      </div>
    </div>
  );
}

export function GeofenceSection({ s }: { s: SummaryState }) {
  const navigate = useNavigate();
  const k = s.summary?.zones ?? null;
  const active = k ? k.inside + k.outside : 0;
  const d = k?.dwell ?? null;
  return (
    <Section id="geofence-presence" title="Geofence presence"
      subtitle={k && k.zoneCount > 0 && active > 0 ? `${k.inside} of ${active} active units inside a zone` : undefined}
      action={<button type="button" onClick={() => navigate(CONSOLE_LINKS.geofences)} className={linkCls}>Geofences →</button>}>
      {s.loading && !k ? <Skeleton lines={4} />
        : !k ? <Unavailable>Geofence presence could not be loaded. It retries every 30 seconds.</Unavailable>
        : k.zoneCount === 0 ? <Unavailable>No geofences yet. Draw one to see which vehicles are inside it.</Unavailable>
        : (
          <>
            {k.restrictedInside > 0 && <Restricted k={k} />}
            <Allocation k={k} />
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-[#EEF1F3] items-start [&>*]:lg:px-5 [&>*:first-child]:lg:pl-0 [&>*:last-child]:lg:pr-0">
              {k.topZones.length > 0 && <TopZones k={k} />}
              <div className="grid gap-4 sm:grid-cols-2 content-start">
                <StatTile label="Median stay · today" value={d?.medianMinutes == null ? "—" : minutes(d.medianMinutes)}
                  sub={!d ? "Not reported by the server" : d.visits === 0 ? "No completed visits today" : `${d.visits} ${d.visits === 1 ? "visit" : "visits"} ended`} />
                <StatTile label="Gate events · today" value={`${k.entriesToday} / ${k.exitsToday}`}
                  sub={k.restrictedEntriesToday > 0 ? <span className="text-[#E53935]">{k.restrictedEntriesToday} into restricted zones</span> : "entries / exits"} />
                {d?.longest && d.visits > 1 && (
                  <div className="sm:col-span-2 text-[13.5px] text-[#111B21]">Longest stay today: {d.longest.unit} at {d.longest.zone}, {minutes(d.longest.minutes)}</div>
                )}
              </div>
            </div>
          </>
        )}
    </Section>
  );
}

// ── Alert analytics ──────────────────────────────────────────────────────────

type AlertWindow = "today" | "week" | "month" | "mtd";
const WINDOWS: { id: AlertWindow; label: string }[] = [
  { id: "today", label: "Today" }, { id: "week", label: "7 days" }, { id: "month", label: "30 days" }, { id: "mtd", label: "Month to date" },
];
function windowSince(w: AlertWindow, now: Date): Date {
  const m = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (w === "week") return new Date(m.getFullYear(), m.getMonth(), m.getDate() - 6);
  if (w === "month") return new Date(m.getFullYear(), m.getMonth(), m.getDate() - 29);
  if (w === "mtd") return new Date(m.getFullYear(), m.getMonth(), 1);
  return m;
}
/** Acknowledging should be quick; slower than this reads amber. */
const ACK_TARGET_MS = 10 * 60_000;

function SosRow({ a, busy, onAck }: { a: Alert; busy: boolean; onAck: () => void }) {
  return (
    <div className="rounded-[18px] border-[1.5px] border-[#E53935] bg-[#FDECEC] p-3 flex items-center gap-3">
      <span className="w-[38px] h-[38px] rounded-[10px] bg-[#E53935] text-white text-[11px] font-black flex items-center justify-center">SOS</span>
      <div className="flex-1 min-w-0">
        <div className="truncate text-[15px] font-semibold text-[#111B21]">{a.title} · {a.device}</div>
        <div className="truncate text-[12.5px] text-[#667781]">{["Critical", a.geozone, agoLabel(a.time, new Date())].filter(Boolean).join(" · ")}</div>
      </div>
      {isAcknowledged(a)
        ? <span className="text-[13px] font-semibold text-[#075E54]">✓ Acknowledged</span>
        : <button type="button" disabled={busy || !a.id} onClick={onAck}
            className="rounded-xl bg-[#E53935] px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-60">{busy ? "…" : "Acknowledge"}</button>}
    </div>
  );
}

function Frequency({ k, w, now }: { k: AlertKpis; w: AlertWindow; now: Date }) {
  const perHour = w === "today" || k.byDay.length === 0;
  const values = perHour ? k.byHour.slice(0, now.getHours() + 1) : k.byDay.map((d) => d.n);
  const dm = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
  return (
    <Panel title="Alert frequency" subtitle={perHour ? "Per hour · today" : `Per day · ${WINDOWS.find((x) => x.id === w)!.label}`}
      action={<span className="text-[24px] font-semibold tabular-nums">{count(k.today)}</span>}>
      <Bars values={values} label={perHour ? "Alerts per hour today" : "Alerts per day"}
        tooltip={(i) => perHour ? `${values[i]} at ${String(i).padStart(2, "0")}:00` : `${values[i]} on ${dm(k.byDay[i].day)}`} />
      <div className="mt-1 flex text-[11px] text-[#8696A0]"><span>{perHour ? "00:00" : dm(k.byDay[0].day)}</span><span className="ml-auto">{perHour ? "Now" : "Today"}</span></div>
      {k.today > 0 && (
        <>
          <div className="mt-4"><SplitBar parts={SEVERITIES.map((v) => ({ n: k.bySeverity[v], colour: SEVERITY_META[v].colour, label: SEVERITY_META[v].label }))} /></div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {SEVERITIES.map((v) => (
              <div key={v} className="border-l-[3px] border-[#E9EDEF] pl-3">
                <div className="flex items-center gap-1.5 text-[12.5px] text-[#667781]">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: SEVERITY_META[v].colour }} />{SEVERITY_META[v].label}
                </div>
                <div className="mt-1.5 text-[22px] font-semibold tabular-nums" style={{ color: v === "critical" && k.bySeverity[v] > 0 ? C.error : C.ink }}>{count(k.bySeverity[v])}</div>
                <div className="text-[12px] text-[#667781]">{Math.round((k.bySeverity[v] * 100) / k.today)}%</div>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

function Categories({ k, onOpenLog }: { k: AlertKpis; onOpenLog: () => void }) {
  const cats = ALERT_CATEGORIES.filter((c) => k.byCategory[c] > 0).sort((a, b) => k.byCategory[b] - k.byCategory[a]);
  return (
    <Panel title="By category" subtitle="Click to open the alert log">
      <div className="divide-y divide-[#E9EDEF]">
        {cats.map((c) => (
          <button key={c} type="button" onClick={onOpenLog} className="w-full text-left flex items-center gap-3.5 py-3 hover:bg-[#F8F9FA] rounded-lg">
            <span className="w-[42px] h-[42px] rounded-xl bg-[#E7F3F1] text-[#075E54] text-[12px] font-bold flex items-center justify-center">{ALERT_CATEGORY_LABEL[c].slice(0, 3).toUpperCase()}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-semibold text-[#111B21]">{ALERT_CATEGORY_LABEL[c]}</span>
              <span className="block truncate text-[12.5px] text-[#667781]">{(k.titlesByCategory[c] ?? []).slice(0, 3).map((t) => `${t.title} ${t.n}`).join(" · ")}</span>
            </span>
            <span className="text-[16px] font-semibold tabular-nums">{count(k.byCategory[c])}</span>
            <span className="text-[#8696A0]">›</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function OpenAndAck({ k }: { k: AlertKpis }) {
  const open = k.unacknowledged;
  const done = k.today - open;
  const m = k.meanToAcknowledgeMs;
  const slow = m !== null && m > ACK_TARGET_MS;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* The mock-up says "Open vs resolved"; alerts can only be acknowledged today. */}
      <StatTile label="Open vs acknowledged" value={`${open} / ${done}`}
        sub={<div className="mt-2"><SplitBar parts={[{ n: open, colour: C.warning, label: "Open" }, { n: done, colour: C.primary, label: "Acknowledged" }]} /></div>} />
      <StatTile label="Mean time to acknowledge" value={m === null ? "—" : waitLabel(m)} colour={slow ? C.amberInk : C.ink}
        sub={m === null ? "None acknowledged yet" : `target ≤ ${ACK_TARGET_MS / 60_000}m${k.medianToAcknowledgeMs === null ? "" : ` · median ${waitLabel(k.medianToAcknowledgeMs)}`}`} />
    </div>
  );
}

function Offenders({ k }: { k: AlertKpis }) {
  return (
    <Panel title="Top offenders" subtitle="Units with the most alerts in this window">
      <ol className="divide-y divide-[#E9EDEF]">
        {k.topOffenders.map((o, i) => (
          <li key={o.unit} className="flex items-center gap-3 py-3">
            <span className="w-6 text-[14px] text-[#667781]">{i + 1}</span>
            <span className="flex-1 min-w-0">
              <span className="block truncate text-[15px] font-semibold text-[#111B21]">{o.unit}</span>
              <span className="block truncate text-[12.5px] text-[#667781]">Mostly {o.topTitle} ({o.topN})</span>
            </span>
            <span className="text-[16px] font-semibold tabular-nums">{o.n}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function AlertsSection({ owners }: { owners: string }) {
  const navigate = useNavigate();
  const [w, setW] = useState<AlertWindow>("today");
  // Fetch from the widest start asked for so far: a narrower window is already covered.
  const [fetchFrom, setFetchFrom] = useState<AlertWindow>("today");
  const now = new Date();
  const since = windowSince(w, now);
  const from = windowSince(fetchFrom, now);
  const a = useAlerts(owners, from);
  const [acked, setAcked] = useState<Record<string, Date>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [ackError, setAckError] = useState(false);

  const alerts = useMemo(
    () => a.alerts?.map((x) => (acked[x.id] && !x.acknowledgedAt ? { ...x, acknowledgedAt: acked[x.id], read: true } : x)) ?? null,
    [a.alerts, acked],
  );
  const k = alerts ? deriveAlerts(alerts, now, since) : null;
  const select = (next: AlertWindow) => {
    setW(next);
    if (windowSince(next, now) < from) setFetchFrom(next);
  };
  const ack = async (x: Alert) => {
    setBusy(x.id); setAckError(false);
    try { await acknowledgeAlert(x.id); setAcked((m) => ({ ...m, [x.id]: new Date() })); }
    catch { setAckError(true); }
    finally { setBusy(null); }
  };
  const openLog = () => navigate(CONSOLE_LINKS.alertLog);
  return (
    <Section id="alerts" title="Alerts"
      subtitle={k ? `${WINDOWS.find((x) => x.id === w)!.label} · ${k.today} ${k.today === 1 ? "alert" : "alerts"} · ${k.unacknowledged} open` : undefined}
      action={<div className="flex flex-wrap items-center gap-3"><Segmented value={w} options={WINDOWS} onChange={select} />
        <button type="button" onClick={openLog} className={linkCls}>Alert log →</button></div>}>
      {k && a.truncated && <p className="text-[12.5px] text-[#667781]">More alerts than can be read at once in this window — the figures cover the latest {count(ALERT_CAP)}.</p>}
      {ackError && <p className="text-[12.5px] text-[#E53935]">Could not acknowledge that alert. Try again.</p>}
      {!k ? (a.loading ? <Skeleton lines={4} /> : <Unavailable>Alerts could not be loaded. They retry every minute.</Unavailable>) : (
        <>
          {k.sos.length > 0 && (
            <div className="flex flex-col gap-2">
              {k.sos.slice(0, 3).map((x) => <SosRow key={x.id || x.time.getTime()} a={x} busy={busy === x.id} onAck={() => ack(x)} />)}
            </div>
          )}
          <Frequency k={k} w={w} now={now} />
          {k.today > 0 && (
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-[#EEF1F3] items-start [&>*]:lg:px-5 [&>*:first-child]:lg:pl-0 [&>*:last-child]:lg:pr-0">
              <Categories k={k} onOpenLog={openLog} />
              <div className="flex flex-col gap-6">
                <OpenAndAck k={k} />
                {k.topOffenders.length > 0 && <Offenders k={k} />}
              </div>
            </div>
          )}
          {/* Top drivers by alerts waits on `driver_name` on notifications. */}
        </>
      )}
    </Section>
  );
}

// ── Token analytics ──────────────────────────────────────────────────────────

export function TokensSection({ t, s }: { t: TokensState; s: SummaryState }) {
  const navigate = useNavigate();
  const r = t.wallet ? runwayOf(t.wallet, t.usage) : null;
  const level = r ? runwayLevel(r) : "unknown";
  const unit = t.usage ? primaryUnit(t.usage) : null;
  // The burn uses all 14 days; the chart shows the last 7, as on the phone.
  const daily = t.usage && unit ? dailyIn(t.usage, unit).slice(-7) : [];
  const chartDays = t.usage ? t.usage.days.slice(-7) : [];
  const vehicles = s.summary?.fleet ? reportingNow(s.summary.fleet) : 0;
  const perVehicle = r?.burnPerDay != null && vehicles > 0 ? r.burnPerDay / vehicles : null;
  const yesterday = t.usage && unit ? yesterdayIn(t.usage, unit) : null;
  const used = r ? usedFraction(r) : null;
  const fill = level === "critical" ? C.error : level === "low" ? C.warning : C.primary;
  return (
    <Section id="tokens" title="Tokens"
      subtitle={r && r.burnDays > 0 ? `Balance & burn · ${r.burnDays}-day average` : "Balance & burn"}
      action={r ? <PrimaryButton urgent={level === "critical" || level === "none"} onClick={() => navigate(CONSOLE_LINKS.buyTokens)}>+ Buy tokens</PrimaryButton> : undefined}>
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-[#EEF1F3] items-start [&>*]:lg:px-5 [&>*:first-child]:lg:pl-0 [&>*:last-child]:lg:pr-0">
        <Panel title="Balance" subtitle="Across your token packs">
          {t.walletLoading && !r ? <Skeleton lines={3} /> : !r ? <Unavailable>The token balance could not be loaded.</Unavailable> : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-[40px] font-semibold leading-none tabular-nums">{count(r.balance)}</span>
                <span className="text-[15px] text-[#667781]">tokens left</span>
              </div>
              {used !== null && (
                <>
                  <div className="mt-4 h-2 rounded-[5px] bg-[#F0F2F5] overflow-hidden">
                    <div className="h-full rounded-[5px]" style={{ width: `${used * 100}%`, background: fill }} />
                  </div>
                  <div className="mt-2 flex text-[13px] text-[#667781]">
                    <span>{count(r.used)} used · {Math.round(used * 100)}% of packs</span><span className="ml-auto">{count(runwayTotal(r))}</span>
                  </div>
                </>
              )}
              <div className="mt-4 text-[14.5px] font-semibold text-[#075E54]">
                {(() => { const [h, sub] = runwayText(r, t.usageLoading); return h === "Not in use" ? sub : `${h} · ${sub}`; })()}
              </div>
              <p className="mt-1.5 text-[12.5px] text-[#8696A0]">Amber below 7 days or 10% left, red below 3 days.</p>
            </>
          )}
        </Panel>
        <Panel title="Daily consumption" subtitle="Last 7 days · by service">
          {t.usageLoading && !t.usage ? <Skeleton lines={3} />
            : t.usageOff ? <Unavailable>Daily usage isn’t switched on for your account yet.</Unavailable>
            : !t.usage ? <Unavailable>Daily usage could not be loaded.</Unavailable>
            : !unit ? <Unavailable>Usage history started today. Daily figures appear from tomorrow.</Unavailable>
            : (
              <>
                <Bars height={110} values={daily} label="Token usage per day"
                  tooltip={(i) => `${dayLabel(chartDays[i].day)}: ${daily[i] === null ? "not known" : usageAmount(daily[i]!, unit)}`} />
                <div className="mt-1.5 grid text-[12px] text-[#667781]" style={{ gridTemplateColumns: `repeat(${daily.length}, minmax(0,1fr))` }}>
                  {chartDays.map((d, i) => (
                    <span key={i} className="text-center">{i === daily.length - 1 ? "Today" : d.day.toLocaleDateString("en-GB", { weekday: "short" })}</span>
                  ))}
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  {t.usage.services.map((sv) => (
                    <div key={sv.service} className="flex items-center gap-2 text-[13.5px]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#128C7E]" />
                      <span className="flex-1">{sv.service}</span>
                      <span className="font-semibold">{usageAmount(sv.averagePerDay, sv.unit)}</span>
                      <span className="text-[#667781]">a day</span>
                    </div>
                  ))}
                </div>
                {t.usage.historySince && chartDays[0] && t.usage.historySince > chartDays[0].day && (
                  <p className="mt-3 text-[12px] text-[#8696A0]">History starts {dayLabel(t.usage.historySince)}.</p>
                )}
              </>
            )}
        </Panel>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile label="Burn per vehicle" value={perVehicle === null ? "—" : perVehicle.toFixed(1)}
          sub={perVehicle === null ? "Needs usage history" : `tokens / day · ${vehicles} reporting`} />
        {/* The mock-up's "Cost per asset · month" waits on the contracted allowance per asset from billing. */}
        <StatTile label="Used yesterday" value={yesterday === null || !unit ? "—" : usageAmount(yesterday, unit)} sub="last complete day" />
      </div>
    </Section>
  );
}
