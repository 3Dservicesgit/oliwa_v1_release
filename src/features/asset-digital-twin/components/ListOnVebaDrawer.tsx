/**
 * ListOnVebaDrawer — Slide-in drawer for creating a VEBA marketplace listing
 * from an asset in the registry.
 */

import React, { useState } from "react";
import type { Asset } from "./types";
import { COLORS, btn, btnPrimary } from "./types";
import { SectionTitle } from "./MetricCard";
import { useAuth } from "../../../auth/AuthContext";
import { useGuardedMutation, GuardedButton } from "../../../auth/guards";
import { createVebaListing } from "../../../api/services/veba.service";
import type {
  CreateVebaListingRequest,
  ListingVisibility,
  PricingBasis,
} from "../../../api/types";

const s = {
  backdrop: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(17,27,33,0.45)",
    zIndex: 95,
  },
  drawer: {
    position: "fixed" as const,
    right: 0,
    top: 106,
    height: "calc(100vh - 106px)",
    width: 480,
    background: "#fff",
    borderLeft: `1px solid ${COLORS.border}`,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    display: "flex",
    flexDirection: "column" as const,
    zIndex: 100,
  },
  header: {
    padding: 14,
    background: "#F8F9FA",
    borderBottom: `1px solid ${COLORS.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  body: { padding: 14, overflowY: "auto" as const, flex: 1 },
  card: {
    background: "#fff",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  field: { display: "flex", flexDirection: "column" as const, gap: 4 },
  labelText: { fontSize: 11, color: COLORS.muted, fontWeight: 600 },
  input: {
    padding: "8px 10px",
    fontSize: 13,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    background: "#fff",
    color: COLORS.text,
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  row2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 10,
  },
  footer: {
    padding: 12,
    borderTop: `1px solid ${COLORS.border}`,
    background: "#F8F9FA",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.danger,
    minHeight: "1em" as const,
    flex: 1,
  },
};

interface ListOnVebaDrawerProps {
  asset: Asset;
  open: boolean;
  onClose: () => void;
  onListed?: (listing: { listing_uid: string }) => void;
}

export function ListOnVebaDrawer({ asset, open, onClose, onListed }: ListOnVebaDrawerProps) {
  const { state: authState } = useAuth();

  const [dailyRate, setDailyRate] = useState<string>("");
  const [currency, setCurrency] = useState<string>("UGX");
  const [pricingBasis, setPricingBasis] = useState<PricingBasis>("per_day");
  const [hourlyRate, setHourlyRate] = useState<string>("");
  const [availabilityStart, setAvailabilityStart] = useState<string>("");
  const [availabilityEnd, setAvailabilityEnd] = useState<string>("");
  const [geographicScope, setGeographicScope] = useState<string>("");
  const [operatorIncluded, setOperatorIncluded] = useState<boolean>(false);
  const [visibility, setVisibility] = useState<ListingVisibility>("public");
  const [notes, setNotes] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const listMutation = useGuardedMutation(
    "can_list_asset_on_marketplace",
    (payload: CreateVebaListingRequest) => createVebaListing(payload),
  );

  const resetForm = () => {
    setDailyRate("");
    setCurrency("UGX");
    setPricingBasis("per_day");
    setHourlyRate("");
    setAvailabilityStart("");
    setAvailabilityEnd("");
    setGeographicScope("");
    setOperatorIncluded(false);
    setVisibility("public");
    setNotes("");
    setValidationError(null);
    listMutation.reset();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setValidationError(null);
    const dailyRateNum = Number(dailyRate);
    if (!dailyRate || !Number.isFinite(dailyRateNum) || dailyRateNum <= 0) {
      setValidationError("Daily rate must be a positive number.");
      return;
    }
    const hourlyRateNum = hourlyRate ? Number(hourlyRate) : null;
    if (hourlyRate && (!Number.isFinite(hourlyRateNum!) || hourlyRateNum! <= 0)) {
      setValidationError("Hourly rate, if provided, must be positive.");
      return;
    }
    if (availabilityStart && availabilityEnd && availabilityEnd < availabilityStart) {
      setValidationError("Availability end date must not be before the start date.");
      return;
    }
    if (!authState.accountRoot || !authState.accountUid) {
      setValidationError("Missing account context.");
      return;
    }

    const payload: CreateVebaListingRequest = {
      asset_uid: asset.id,
      account_root: authState.accountRoot,
      created_by: authState.accountUid,
      daily_rate: dailyRateNum,
      currency: currency.trim().toUpperCase() || "UGX",
      pricing_basis: pricingBasis,
      hourly_rate: hourlyRateNum,
      availability_start: availabilityStart || null,
      availability_end: availabilityEnd || null,
      geographic_scope: geographicScope.trim() || null,
      operator_included: operatorIncluded,
      notes: notes.trim() || null,
      visibility,
    };

    try {
      const res = await listMutation.mutate(payload);
      onListed?.({ listing_uid: res?.listing_uid ?? "" });
      handleClose();
    } catch {
      // listMutation.error already set; footer renders it
    }
  };

  if (!open) return null;

  const displayError = validationError ?? (listMutation.error ? listMutation.error.message : null);

  return (
    <>
      <div style={s.backdrop} onClick={handleClose} aria-hidden="true" />
      <aside style={s.drawer} role="dialog" aria-label="List asset on VEBA marketplace">
        <div style={s.header}>
          <div>
            <div style={{ fontWeight: 1000, fontSize: 14 }}>List on VEBA Marketplace</div>
            <div style={{ fontSize: 12, color: COLORS.muted }}>
              {asset.id} - {asset.displayName} - {asset.assetClass}
            </div>
          </div>
          <button style={btn} onClick={handleClose} type="button">Close</button>
        </div>

        <div style={s.body}>
          <div style={s.card}>
            <SectionTitle title="Pricing" subtitle="Required commercial terms" />
            <div style={s.row2}>
              <label style={s.field}>
                <span style={s.labelText}>Daily rate *</span>
                <input
                  type="number" min="0" step="any"
                  value={dailyRate}
                  onChange={(e) => setDailyRate(e.target.value)}
                  placeholder="e.g. 250000"
                  style={s.input}
                  disabled={listMutation.isRunning}
                />
              </label>
              <label style={s.field}>
                <span style={s.labelText}>Currency</span>
                <input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="UGX"
                  style={s.input}
                  disabled={listMutation.isRunning}
                  maxLength={4}
                />
              </label>
            </div>
            <div style={s.row2}>
              <label style={s.field}>
                <span style={s.labelText}>Pricing basis (primary)</span>
                <select
                  value={pricingBasis}
                  onChange={(e) => setPricingBasis(e.target.value as PricingBasis)}
                  style={s.input}
                  disabled={listMutation.isRunning}
                >
                  <option value="per_day">Per day</option>
                  <option value="per_hour">Per hour</option>
                  <option value="per_km">Per km</option>
                  <option value="per_trip">Per trip</option>
                </select>
              </label>
              <label style={s.field}>
                <span style={s.labelText}>Hourly rate (optional)</span>
                <input
                  type="number" min="0" step="any"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="e.g. 35000"
                  style={s.input}
                  disabled={listMutation.isRunning}
                />
              </label>
            </div>
          </div>

          <div style={s.card}>
            <SectionTitle title="Availability" subtitle="When the asset can be booked" />
            <div style={s.row2}>
              <label style={s.field}>
                <span style={s.labelText}>From</span>
                <input
                  type="date"
                  value={availabilityStart}
                  onChange={(e) => setAvailabilityStart(e.target.value)}
                  style={s.input}
                  disabled={listMutation.isRunning}
                />
              </label>
              <label style={s.field}>
                <span style={s.labelText}>To (open-ended if blank)</span>
                <input
                  type="date"
                  value={availabilityEnd}
                  onChange={(e) => setAvailabilityEnd(e.target.value)}
                  style={s.input}
                  disabled={listMutation.isRunning}
                />
              </label>
            </div>
            <label style={{ ...s.field, marginTop: 10 }}>
              <span style={s.labelText}>Geographic scope</span>
              <input
                value={geographicScope}
                onChange={(e) => setGeographicScope(e.target.value)}
                placeholder="e.g. Uganda, Kampala only, EAC region"
                style={s.input}
                disabled={listMutation.isRunning}
              />
            </label>
            <label
              style={{
                display: "flex", alignItems: "center", gap: 8,
                marginTop: 10, fontSize: 13, color: COLORS.text, cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={operatorIncluded}
                onChange={(e) => setOperatorIncluded(e.target.checked)}
                disabled={listMutation.isRunning}
              />
              Operator included
            </label>
          </div>

          <div style={s.card}>
            <SectionTitle title="Visibility & notes" subtitle="Who can see this listing" />
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="radio" name="visibility" value="public"
                  checked={visibility === "public"}
                  onChange={() => setVisibility("public")}
                  disabled={listMutation.isRunning}
                />
                Marketplace public
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="radio" name="visibility" value="tenant"
                  checked={visibility === "tenant"}
                  onChange={() => setVisibility("tenant")}
                  disabled={listMutation.isRunning}
                />
                Tenant-private (internal pool)
              </label>
            </div>
            <label style={{ ...s.field, marginTop: 12 }}>
              <span style={s.labelText}>Notes (optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Condition, certifications, what's included..."
                rows={3}
                style={{ ...s.input, resize: "vertical" as const, fontFamily: "inherit" }}
                disabled={listMutation.isRunning}
              />
            </label>
          </div>
        </div>

        <div style={s.footer}>
          <div style={s.errorText}>{displayError}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              style={btn}
              onClick={handleClose}
              disabled={listMutation.isRunning}
            >
              Cancel
            </button>
            <GuardedButton
              permission="can_list_asset_on_marketplace"
              onClick={handleSubmit}
              disabled={listMutation.isRunning}
              style={{
                ...btn,
                ...btnPrimary,
                opacity: listMutation.isRunning ? 0.6 : 1,
                cursor: listMutation.isRunning ? "wait" : "pointer",
              }}
            >
              {listMutation.isRunning ? "Listing..." : "Publish listing"}
            </GuardedButton>
          </div>
        </div>
      </aside>
    </>
  );
}
