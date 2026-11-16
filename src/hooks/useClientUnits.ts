/**
 * useClientUnits — the signed-in customer's vehicles, for pickers and for
 * showing a vehicle's name where the server only sends its IMEI (Drivers,
 * FuelMath).
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { getClientDevices } from "../api/services/clients.service";
import type { ClientDevice } from "../api/types";
import { getCookie } from "../utils/cookies";

export interface ClientUnits {
  units: ClientDevice[];
  loading: boolean;
  error: string | null;
  /** The vehicle's name, or its IMEI when it is not one of the client's. */
  label: (imei: string | null | undefined) => string;
}

export function useClientUnits(): ClientUnits {
  const { state } = useAuth();
  const client = state.accountRoot || getCookie("_nvxs_account_root");
  const [units, setUnits] = useState<ClientDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let alive = true;
    getClientDevices(client)
      .then((res) => {
        if (!alive) return;
        const list = Array.isArray(res.data) ? [...res.data] : [];
        list.sort((a, b) => (a.device_name || a.device_imei).localeCompare(b.device_name || b.device_imei));
        setUnits(list);
        setError(null);
      })
      // An empty list must not read as "you have no vehicles".
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Couldn't load your vehicles."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [client]);

  const label = useCallback((imei: string | null | undefined) => {
    if (!imei) return "—";
    const u = units.find((d) => d.device_imei === imei);
    return u?.device_name?.trim() || imei;
  }, [units]);

  return { units, loading, error, label };
}
