/**
 * hooks.ts — the signed-in account's fleet and its live data.
 *
 * A customer sees their own fleet only, as on the phone: the client is the
 * account root from sign-in, and the backend's access guard enforces it.
 *
 * Fleet status refreshes every 30 s (like the phone), alerts every 60 s, the
 * wallet and usage every 5 min. A failed refresh keeps the last figures,
 * marked stale, instead of blanking the card. Only the newest request may
 * write, so a slow one answering late never overwrites fresher figures.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getCookie } from "../../utils/cookies";
import { loadAlerts, loadSummary, loadUsage, loadWallet, SummaryNotServed, type Summary } from "./api";
import type { Alert, TokenUsage, Wallet } from "./kpis";
import { usePolling } from "./polling";

export function useDashboardClient() {
  const { state } = useAuth();
  const uid = state.accountUid || getCookie("_nvxs_account_uid") || "";
  const client = state.accountRoot || getCookie("_nvxs_account_root") || uid;
  // Alerts are filed under the rule owner's account_uid as well as the client.
  const alertOwners = client === uid || !uid ? client : `${client},${uid}`;
  return { client, alertOwners, name: state.accountName || getCookie("_nvxs_account_name") || "" };
}

export interface SummaryState {
  summary: Summary | null;
  loading: boolean;
  /** The last refresh failed; `summary` holds the previous figures. */
  stale: boolean;
  /** False on an API without the summary endpoint (no live refresh). */
  served: boolean;
  updatedAt: Date | null;
  refresh: () => Promise<void>;
}

export function useSummary(client: string): SummaryState {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [served, setServed] = useState(true);
  const last = useRef<Summary | null>(null);
  /** Only the latest request may write: an older one answering late is dropped. */
  const seq = useRef(0);

  // A different client starts from blank (reset during render, not in an effect).
  const [shown, setShown] = useState(client);
  if (shown !== client) {
    setShown(client); setSummary(null); setLoading(true); setStale(false); setServed(true);
  }
  useEffect(() => { last.current = null; seq.current++; }, [client]);

  const refresh = useCallback(async () => {
    if (!client || !served) return;
    const id = ++seq.current;
    try {
      const s = await loadSummary(client);
      if (id !== seq.current) return; // a newer request (or another client) won
      const prev = last.current;
      // A section that failed this time keeps last time's figures.
      const keep = !!prev && (!s.fleet || !s.zones) && !!(prev.fleet || prev.zones);
      const next = keep
        ? { fleet: s.fleet ?? prev!.fleet, zones: s.zones ?? prev!.zones, at: s.fleet ? s.at : prev!.at }
        : s;
      last.current = next;
      setSummary(next);
      setStale(keep);
    } catch (e) {
      if (id !== seq.current) return;
      if (e instanceof SummaryNotServed) setServed(false);
      setStale(true);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [client, served]);

  usePolling(refresh, 30_000);
  return { summary, loading, stale, served, updatedAt: summary?.fleet ? summary.at : null, refresh };
}

export interface AlertsState {
  alerts: Alert[] | null;
  truncated: boolean;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
}

/** Alerts since `since` (local midnight by default), refreshed every minute. */
/** `owners`: comma-separated owner ids (client root, account uid). */
export function useAlerts(owners: string, since: Date | null = null, every = 60_000): AlertsState {
  const client = owners;
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const sinceKey = since ? since.getTime() : 0;
  const seq = useRef(0);

  const key = `${client}|${sinceKey}`;
  const [shown, setShown] = useState(key);
  if (shown !== key) { setShown(key); setAlerts(null); setLoading(true); setError(false); }

  const refresh = useCallback(async () => {
    if (!client) return;
    const from = since ?? (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); })();
    const id = ++seq.current;
    try {
      const r = await loadAlerts(client.split(","), from);
      if (id !== seq.current) return;
      setAlerts(r.alerts);
      setTruncated(r.truncated);
      setError(false);
    } catch {
      if (id === seq.current) setError(true);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [client, sinceKey]); // eslint-disable-line react-hooks/exhaustive-deps

  usePolling(refresh, every);
  return { alerts, truncated, loading, error, refresh };
}

export interface TokensState {
  wallet: Wallet | null;
  usage: TokenUsage | null;
  walletLoading: boolean;
  usageLoading: boolean;
  /** Daily usage is not switched on for this API. */
  usageOff: boolean;
  walletError: boolean;
}

export function useTokens(client: string, days = 7): TokensState {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageOff, setUsageOff] = useState(false);
  const [walletError, setWalletError] = useState(false);
  const seq = useRef(0);

  const key = `${client}|${days}`;
  const [shown, setShown] = useState(key);
  if (shown !== key) {
    setShown(key); setWallet(null); setUsage(null); setWalletLoading(true); setUsageLoading(true); setUsageOff(false); setWalletError(false);
  }

  const refresh = useCallback(async () => {
    if (!client) return;
    const id = ++seq.current;
    const mine = () => id === seq.current;
    loadWallet(client)
      .then((w) => { if (mine()) { setWallet(w); setWalletError(false); } })
      .catch(() => { if (mine()) setWalletError(true); })
      .finally(() => { if (mine()) setWalletLoading(false); });
    loadUsage(client, days)
      .then((u) => { if (mine()) { setUsage(u); setUsageOff(u === null); } })
      .catch(() => { /* keep what we had */ })
      .finally(() => { if (mine()) setUsageLoading(false); });
  }, [client, days]);

  usePolling(refresh, 5 * 60_000);
  return { wallet, usage, walletLoading, usageLoading, usageOff, walletError };
}
