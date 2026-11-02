/**
 * FleetDashboard.tsx — the console's dashboard: everything on one scrollable
 * page, in plain sections (no summary cards, no header banner): Fleet status,
 * Tokens, Alerts, Geofence presence — the phone dashboard's order. The figures
 * and wording come from OLIWA mobile; the data is the signed-in customer's own
 * and refreshes live.
 */
import { useDashboardClient, useSummary, useTokens } from "./hooks";
import { AlertsSection, FleetStatusSection, GeofenceSection, TokensSection } from "./views";

const JUMPS = [
  { id: "fleet-status", label: "Fleet status" },
  { id: "tokens", label: "Tokens" },
  { id: "alerts", label: "Alerts" },
  { id: "geofence-presence", label: "Geofence presence" },
];

export function FleetDashboard() {
  const { client, alertOwners } = useDashboardClient();
  const s = useSummary(client);
  const t = useTokens(client, 14);

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-0 z-10 -mx-5 -mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[#E4E8EB] bg-[#F4F6F8]/90 px-5 py-3 backdrop-blur">
        <h1 className="text-[20px] font-semibold text-[#111B21]">Dashboard</h1>
        <nav aria-label="Dashboard sections" className="flex flex-wrap gap-1.5">
          {JUMPS.map((j) => (
            <a key={j.id} href={`#${j.id}`}
              className="rounded-full border border-[#E4E8EB] bg-white px-3 py-1 text-[13px] font-medium text-[#3B4A54] hover:border-[#128C7E] hover:text-[#075E54]"
              onClick={(e) => { e.preventDefault(); document.getElementById(j.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
              {j.label}
            </a>
          ))}
        </nav>
      </div>
      <FleetStatusSection s={s} />
      <TokensSection t={t} s={s} />
      <AlertsSection owners={alertOwners} />
      <GeofenceSection s={s} />
    </div>
  );
}
