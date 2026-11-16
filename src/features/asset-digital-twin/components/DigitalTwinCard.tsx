/**
 * DigitalTwinCard — Per-asset summary card showing five dimensions at a glance:
 *   Health, Productivity, Risk, Opportunity, Spend.
 *
 * Pure presentation — computes scores from the Asset via metrics.ts and
 * renders a header + five MetricTiles. Phase A uses only fields available on
 * Asset today; Phase B will swap in real telemetry via the `enrichment` prop.
 *
 * Click the card body to open the deep AssetTwinBlade (parent wires the
 * onSelect callback).
 */

import React from "react";
import type { Asset } from "./types";
import { COLORS } from "./types";
import { computeAssetMetrics, type AssetEnrichment } from "../metrics";
import { MetricTile } from "./MetricTile";

interface DigitalTwinCardProps {
  asset: Asset;
  /** Optional Phase B enrichment data. */
  enrichment?: AssetEnrichment;
  /** Card click handler — typically selects the asset for the detail blade. */
  onSelect?: (assetId: string) => void;
}

export function DigitalTwinCard({ asset, enrichment, onSelect }: DigitalTwinCardProps) {
  const m = computeAssetMetrics(asset, enrichment);

  return (
    <article
      onClick={() => onSelect?.(asset.id)}
      className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden hover:shadow-sm transition-shadow"
      style={{ cursor: onSelect ? "pointer" : "default" }}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#E9EDEF] flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-extrabold text-[13px] text-[#111B21] truncate" title={asset.displayName}>
            {asset.displayName}
          </div>
          <div className="text-[11px] text-[#667781] truncate">
            {asset.assetClass} * {asset.ownerOrg} * {asset.country}
          </div>
        </div>
        <span
          className="text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0"
          style={{
            background: asset.status === "Online" ? "#E9F7F4" : "#FFF4E5",
            color: asset.status === "Online" ? "#075E54" : "#9A6700",
          }}
        >
          {asset.status}
        </span>
      </div>

      {/* Metrics grid — 5 tiles in a responsive grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-1.5 p-2">
        <MetricTile name="Health"       metric={m.health} />
        <MetricTile name="Productivity" metric={m.productivity} />
        <MetricTile name="Risk"         metric={m.risk} />
        <MetricTile name="Opportunity"  metric={m.opportunity} />
        <MetricTile name="Spend"        metric={m.spend} />
      </div>

      {/* Footer: last-seen + a "View" affordance */}
      <div className="px-3 py-1.5 border-t border-[#E9EDEF] flex items-center justify-between text-[10px]" style={{ color: COLORS.muted }}>
        <span>Last seen {asset.lastSeen}</span>
        {onSelect && <span className="font-extrabold text-[var(--brand)]">Open twin -&gt;</span>}
      </div>
    </article>
  );
}
