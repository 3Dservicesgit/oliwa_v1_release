/**
 * fleet.tsx — the fleet breakdown (live donut + state list) and device
 * health, from OLIWA mobile's fleet status card.
 */
import {
  count, healthyFraction, reportingNow, stateListed, staleOverDay, UNIT_STATE_META, UNIT_STATE_ORDER,
  type FleetStatusKpis,
} from "./kpis";
import { Chip, Donut } from "./ui";
import { C } from "./style";

export function FleetBreakdown({ k, size = 128 }: { k: FleetStatusKpis; size?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Donut
        size={size}
        segments={UNIT_STATE_ORDER.map((s) => ({ value: k.counts[s], colour: UNIT_STATE_META[s].colour, label: UNIT_STATE_META[s].label }))}
        centre={reportingNow(k)}
        sub={`of ${count(k.total)} online`}
      />
      <ul className="flex-1 min-w-[180px] flex flex-col gap-1.5">
        {UNIT_STATE_ORDER.filter((s) => stateListed(s, k)).map((s) => (
          <li key={s} className="flex items-center gap-2 rounded-[10px] bg-[#F0F2F5] px-2.5 py-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: UNIT_STATE_META[s].colour }} />
            <span className="flex-1 truncate text-[13.5px] text-[#667781]">{UNIT_STATE_META[s].label}</span>
            <span className="text-[15px] font-semibold text-[#111B21] tabular-nums">{count(k.counts[s])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Device flags the data supports; battery and GSM signal wait on the backend. */
export function DeviceHealth({ k }: { k: FleetStatusKpis }) {
  const healthy = healthyFraction(k);
  const stale24 = staleOverDay(k);
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[14px] font-medium text-[#111B21]">Device health</span>
        {healthy !== null && <span className="text-[13.5px] font-semibold text-[#075E54]">{Math.round(healthy * 100)}% healthy</span>}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {k.weakGps === 0 && stale24 === 0 && k.counts.noData === 0 && <span className="text-[13px] text-[#667781]">No device issues</span>}
        {k.weakGps > 0 && <Chip text={`${k.weakGps} No GPS fix`} ink={C.amberInk} tint="#FDF0D5" dot />}
        {stale24 > 0 && <Chip text={`${stale24} Stale > 24h`} ink={C.muted} tint={C.fieldFill} dot />}
        {k.counts.noData > 0 && <Chip text={`${k.counts.noData} No data`} ink={C.muted} tint={C.fieldFill} dot />}
      </div>
    </div>
  );
}
