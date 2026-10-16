/**
 * api.ts — the calls behind the fleet dashboard, the same ones OLIWA mobile
 * makes. Each returns parsed KPIs; one failing call blanks one card, not all.
 *
 *   GET /fleet/{client}/summary              fleet status + geofence presence
 *   GET /notifications/{client}/list?since=  alerts (KPIs derived here)
 *   GET /tokens/{client}/balance             wallet
 *   GET /tokens/{client}/usage/daily         burn history
 *   PUT /notifications/{uid}/acknowledge     SOS acknowledge
 */
import { get, put } from "../../api/client";
import { ApiError } from "../../api/types";
import { ENDPOINTS } from "../../api/endpoints";
import {
  alertFromNotification, fleetFromServer, usageFromServer, walletFromBalance, zonesFromServer,
  type Alert, type FleetStatusKpis, type TokenUsage, type Wallet, type ZoneKpis,
} from "./kpis";

const enc = encodeURIComponent;

export interface Summary {
  fleet: FleetStatusKpis | null;
  zones: ZoneKpis | null;
  at: Date;
}

/** Thrown when the API predates GET /fleet/<client>/summary (404). */
export class SummaryNotServed extends Error {}

export async function loadSummary(client: string): Promise<Summary> {
  try {
    const res = await get<Record<string, unknown>>(`/fleet/${enc(client)}/summary`);
    const d = res.data ?? {};
    const fleet = d.fleet && typeof d.fleet === "object" ? fleetFromServer(d.fleet as Record<string, unknown>) : null;
    const zones = d.zones && typeof d.zones === "object" ? zonesFromServer(d.zones as Record<string, unknown>) : null;
    return { fleet, zones, at: new Date() };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) throw new SummaryNotServed();
    throw e;
  }
}

/** Server cap on a `since` window; a full page means it was cut. */
export const ALERT_CAP = 5000;

/** Alerts raised since `since` (a midnight is sent as a date only), for
 *  every owner id given, merged and newest first.
 *
 *  An alert's owner_uid is the owner of the rule that raised it, and rules
 *  are created under the signed-in user's account_uid (console and app both
 *  send event_owner_uid = account_uid), while some alerts are filed under the
 *  client (account_root). Asking for the root alone missed the rest. */
export async function loadAlerts(owners: string[], since: Date): Promise<{ alerts: Alert[]; truncated: boolean }> {
  const ids = [...new Set(owners.filter(Boolean))];
  const pages = await Promise.allSettled(ids.map((id) => loadAlertsOf(id, since)));
  const ok = pages.filter((p): p is PromiseFulfilledResult<{ alerts: Alert[]; truncated: boolean }> => p.status === "fulfilled");
  if (!ok.length) throw (pages[0] as PromiseRejectedResult | undefined)?.reason ?? new Error("no owner");
  const seen = new Set<string>();
  const alerts = ok.flatMap((p) => p.value.alerts).filter((a) => {
    if (!a.id) return true;
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
  alerts.sort((a, b) => b.time.getTime() - a.time.getTime());
  return { alerts, truncated: ok.some((p) => p.value.truncated) };
}

async function loadAlertsOf(client: string, since: Date): Promise<{ alerts: Alert[]; truncated: boolean }> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${since.getFullYear()}-${pad(since.getMonth() + 1)}-${pad(since.getDate())}`;
  const midnight = since.getHours() === 0 && since.getMinutes() === 0 && since.getSeconds() === 0;
  const stamp = midnight ? date : `${date}T${pad(since.getHours())}:${pad(since.getMinutes())}:${pad(since.getSeconds())}`;
  const res = await get<unknown[]>(`/notifications/${enc(client)}/list?since=${enc(stamp)}`);
  const rows = Array.isArray(res.data) ? res.data : [];
  return {
    alerts: rows.map((r) => alertFromNotification((r ?? {}) as Record<string, unknown>)),
    truncated: rows.length >= ALERT_CAP,
  };
}

export async function loadWallet(client: string): Promise<Wallet> {
  try {
    const res = await get<unknown>(`${ENDPOINTS.TOKENS.BALANCE}/${enc(client)}/balance`);
    return walletFromBalance(res.data);
  } catch (e) {
    // No token account for this login: "No tokens", as on the phone.
    if (e instanceof ApiError && e.status === 404) return walletFromBalance([]);
    throw e;
  }
}

/** Null when daily usage is not switched on for this API (route or migration missing). */
export async function loadUsage(client: string, days = 7): Promise<TokenUsage | null> {
  try {
    const res = await get<Record<string, unknown>>(`/tokens/${enc(client)}/usage/daily?days=${days}`);
    return usageFromServer(res.data ?? {});
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 503)) return null;
    throw e;
  }
}

export async function acknowledgeAlert(uid: string, note?: string): Promise<void> {
  await put(`/notifications/${enc(uid)}/acknowledge`, { data: note ? { note } : {} });
}
