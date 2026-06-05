/**
 * ListingDetailPanel — Slide-in panel showing full details of a single
 * VEBA marketplace listing with functional CMS operator action buttons.
 *
 * Opens when an operator clicks a row in the MarketplaceBrowse table.
 */

import React from "react";
import { useAuth } from "../../../auth/AuthContext";
import { useGuardedMutation, GuardedButton } from "../../../auth/guards";
import {
  pauseVebaListing,
  reactivateVebaListing,
  archiveVebaListing,
} from "../../../api/services/veba.service";
import type { VebaListing, ListingStatus, PricingBasis } from "../../../api/types";
import { ConfirmDialog, useConfirmDialog } from "../../../components/ui/ConfirmDialog";

/* ── Status styling ─────────────────────────────────────────────────── */
const STATUS_STYLES: Record<ListingStatus, { bg: string; fg: string; label: string }> = {
  active:   { bg: "#E9F7F4", fg: "#075E54", label: "Active" },
  paused:   { bg: "#FFF4E5", fg: "#9A6700", label: "Paused" },
  archived: { bg: "#F0F2F5", fg: "#667781", label: "Archived" },
  draft:    { bg: "#F0F2F5", fg: "#667781", label: "Draft" },
};

function basisLabel(b: PricingBasis): string {
  switch (b) {
    case "per_day":  return "per day";
    case "per_hour": return "per hour";
    case "per_km":   return "per km";
    case "per_trip": return "per trip";
  }
}

/* ── Detail row helper ──────────────────────────────────────────────── */
function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[#F0F2F5] last:border-0">
      <span className="text-[11px] font-medium text-[#667781] uppercase tracking-wide w-[120px] flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span className={`text-[12px] text-[#111B21] flex-1 break-words ${mono ? "font-mono text-[11px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}

/* ── Props ──────────────────────────────────────────────────────────── */
interface ListingDetailPanelProps {
  listing: VebaListing;
  open: boolean;
  onClose: () => void;
  onEdit: (listing: VebaListing) => void;
  onActionComplete: () => void;
}

export function ListingDetailPanel({
  listing,
  open,
  onClose,
  onEdit,
  onActionComplete,
}: ListingDetailPanelProps) {
  const { state: authState } = useAuth();
  const [actionPending, setActionPending] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  const pauseMut = useGuardedMutation(
    "can_edit_asset_listing",
    (uid: string) => pauseVebaListing(uid, authState.accountUid ?? "system"),
  );
  const reactivateMut = useGuardedMutation(
    "can_edit_asset_listing",
    (uid: string) => reactivateVebaListing(uid, authState.accountUid ?? "system"),
  );
  const archiveMut = useGuardedMutation(
    "can_edit_asset_listing",
    (uid: string) => archiveVebaListing(uid, authState.accountUid ?? "system"),
  );

  const runAction = async (mutation: typeof pauseMut, confirmOpts?: { title: string; message: string; confirmLabel: string; variant?: "danger" | "warning" | "default" }) => {
    if (confirmOpts) {
      const ok = await confirm(confirmOpts);
      if (!ok) return;
    }
    setActionPending(true);
    setActionError(null);
    try {
      await mutation.mutate(listing.listing_uid);
      onActionComplete();
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionPending(false);
    }
  };

  if (!open) return null;

  const l = listing;
  const title = l.asset_summary?.display_name ?? l.asset_uid;
  const cls = l.asset_summary?.asset_class;
  const owner = l.asset_summary?.owner_org ?? l.account_root;
  const country = l.asset_summary?.country;
  const statusStyle = STATUS_STYLES[l.status] ?? STATUS_STYLES.draft;

  const availability =
    l.availability_start || l.availability_end
      ? `${l.availability_start ?? "—"} → ${l.availability_end ?? "open-ended"}`
      : "Available now (no date restrictions)";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[rgba(17,27,33,0.45)] z-[95]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="fixed right-0 top-[48px] h-[calc(100vh-48px)] w-[520px] bg-white border-l border-[#E9EDEF] shadow-2xl flex flex-col z-[100]"
        role="dialog"
        aria-label="Listing details"
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="px-5 py-4 bg-[#F8F9FA] border-b border-[#E9EDEF]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
                  style={{ background: statusStyle.bg, color: statusStyle.fg }}
                >
                  {statusStyle.label}
                </span>
                {l.visibility === "tenant" ? (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#F0F2F5] text-[#667781]">
                    Tenant-private
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#128C7E]/10 text-[#128C7E]">
                    Public
                  </span>
                )}
              </div>
              <h2 className="font-extrabold text-[16px] text-[#111B21] truncate" title={title}>
                {title}
              </h2>
              {cls && (
                <p className="text-[12px] text-[#667781] mt-0.5">
                  {[cls, country].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-[#E9EDEF] bg-white text-[#111B21] hover:bg-[#F0F2F5] cursor-pointer flex-shrink-0"
            >
              Close
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* Asset information */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
            <div className="text-[11px] font-extrabold text-[#111B21] mb-2 uppercase tracking-wide">
              Asset Information
            </div>
            <DetailRow label="Display name" value={l.asset_summary?.display_name} />
            <DetailRow label="Asset UID" value={l.asset_uid} mono />
            <DetailRow label="Asset class" value={l.asset_summary?.asset_class} />
            <DetailRow label="Owner org" value={l.asset_summary?.owner_org} />
            <DetailRow label="Country" value={l.asset_summary?.country} />
            <DetailRow label="Account root" value={l.account_root} mono />
          </div>

          {/* Pricing */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
            <div className="text-[11px] font-extrabold text-[#111B21] mb-2 uppercase tracking-wide">
              Pricing
            </div>
            <DetailRow
              label="Primary rate"
              value={
                <span className="font-extrabold">
                  {l.currency} {l.daily_rate.toLocaleString()}{" "}
                  <span className="font-medium text-[#667781]">{basisLabel(l.pricing_basis)}</span>
                </span>
              }
            />
            {l.hourly_rate != null && (
              <DetailRow
                label="Hourly rate"
                value={`${l.currency} ${l.hourly_rate.toLocaleString()} per hour`}
              />
            )}
            <DetailRow
              label="Operator"
              value={l.operator_included ? "Included" : "Not included"}
            />
          </div>

          {/* Availability & scope */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
            <div className="text-[11px] font-extrabold text-[#111B21] mb-2 uppercase tracking-wide">
              Availability & Scope
            </div>
            <DetailRow label="Availability" value={availability} />
            <DetailRow label="Geographic scope" value={l.geographic_scope} />
            <DetailRow
              label="Visibility"
              value={l.visibility === "tenant" ? "Tenant-private" : "Marketplace public"}
            />
          </div>

          {/* Notes */}
          {l.notes && (
            <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
              <div className="text-[11px] font-extrabold text-[#111B21] mb-2 uppercase tracking-wide">
                Notes
              </div>
              <p className="text-[12px] text-[#111B21] whitespace-pre-wrap leading-relaxed">
                {l.notes}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
            <div className="text-[11px] font-extrabold text-[#111B21] mb-2 uppercase tracking-wide">
              Record
            </div>
            <DetailRow label="Listing UID" value={l.listing_uid} mono />
            <DetailRow label="Created by" value={l.created_by} mono />
            <DetailRow label="Created at" value={l.created_at} />
            <DetailRow label="Updated at" value={l.updated_at} />
          </div>
        </div>

        {/* ── Footer: Action buttons ──────────────────────────────────── */}
        <div className="px-5 py-4 border-t border-[#E9EDEF] bg-[#F8F9FA]">
          {actionError && (
            <div className="text-[12px] text-[#B00020] mb-3">{actionError}</div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {/* Edit — available for all listings */}
            <GuardedButton
              permission="can_edit_asset_listing"
              onClick={() => {
                onClose();
                onEdit(l);
              }}
              disabled={actionPending}
              className="px-3 py-1.5 text-[11px] font-extrabold rounded-md border border-[#128C7E] bg-white text-[#128C7E] hover:bg-[#E9F7F4] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Edit Listing
            </GuardedButton>

            {/* Pause — only for active listings */}
            {l.status === "active" && (
              <GuardedButton
                permission="can_edit_asset_listing"
                onClick={() => runAction(pauseMut)}
                disabled={actionPending}
                className="px-3 py-1.5 text-[11px] font-extrabold rounded-md border border-[#E9EDEF] bg-white text-[#9A6700] hover:bg-[#FFF4E5] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionPending ? "Pausing..." : "Pause Listing"}
              </GuardedButton>
            )}

            {/* Reactivate — for paused or archived listings */}
            {(l.status === "paused" || l.status === "archived") && (
              <GuardedButton
                permission="can_edit_asset_listing"
                onClick={() =>
                  runAction(
                    reactivateMut,
                    l.status === "archived"
                      ? { title: "Unarchive listing?", message: "This listing will become active and visible on the marketplace again.", confirmLabel: "Unarchive & Reactivate", variant: "warning" as const }
                      : undefined,
                  )
                }
                disabled={actionPending}
                className="px-3 py-1.5 text-[11px] font-extrabold rounded-md bg-[#128C7E] text-white hover:bg-[#0D7466] border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionPending ? "Reactivating..." : l.status === "archived" ? "Unarchive & Reactivate" : "Reactivate Listing"}
              </GuardedButton>
            )}

            {/* Archive — available for non-archived listings */}
            {l.status !== "archived" && (
              <GuardedButton
                permission="can_edit_asset_listing"
                onClick={() =>
                  runAction(
                    archiveMut,
                    { title: "Archive listing?", message: "Existing bookings will continue, but no new ones can be requested.", confirmLabel: "Archive", variant: "danger" },
                  )
                }
                disabled={actionPending}
                className="px-3 py-1.5 text-[11px] font-extrabold rounded-md border border-[#FFD6D6] bg-white text-[#B00020] hover:bg-[#FFF5F5] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionPending ? "Archiving..." : "Archive Listing"}
              </GuardedButton>
            )}
          </div>
        </div>
      </aside>

      <ConfirmDialog {...dialogProps} />
    </>
  );
}
