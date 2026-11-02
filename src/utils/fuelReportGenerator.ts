/**
 * fuelReportGenerator.ts — the three FuelMath reports, as PDF and Excel,
 * built in the browser like the console's other reports (reportGenerator.ts).
 *
 *   fuel_issuance     Fuel Issuance & Expenditure: every receipt recorded
 *   fuel_consumption  Fuel Consumption & Performance: km/L between full tanks
 *   fuel_exceptions   Fuel Exceptions: issues the checks flagged, and reviews
 *
 * Rows come from POST /data-stream/reports/fuel/<kind>/generate-data
 * (navas-core-apis fuel_report.py), already formatted, in the shape every
 * report route returns: [{ vehicleName: [row, ...] }]. Columns and per-vehicle
 * totals are the OLIWA mobile app's (report_type.dart, report_export.dart),
 * so both give the same report.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export type FuelReportType = "fuel_issuance" | "fuel_consumption" | "fuel_exceptions";
export type FuelRow = Record<string, string>;
export type FuelReportData = Record<string, FuelRow[]>[];

export const FUEL_REPORT_TYPES: readonly FuelReportType[] = ["fuel_issuance", "fuel_consumption", "fuel_exceptions"];

export function isFuelReportType(type: string): type is FuelReportType {
  return (FUEL_REPORT_TYPES as readonly string[]).includes(type);
}

/** The server route's kind for a report type. */
export function fuelReportKind(type: FuelReportType): string {
  return type === "fuel_issuance" ? "issuance" : type === "fuel_consumption" ? "consumption" : "exceptions";
}

interface FuelReportDef {
  title: string;
  /** File name stem and sheet label. */
  short: string;
  columns: { key: string; label: string; width: number }[];
  /** Per-vehicle totals: [key, label, value]. The keys are the app's
   *  summary columns (summary_config.dart). */
  stats: (rows: FuelRow[]) => [string, string, string | number][];
  /** Header colour, as the other reports use one per type. */
  color: [number, number, number];
}

/** "64,375" → 64375; blank or unreadable → 0. */
function num(v: string | undefined): number {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

const money = (n: number) => Math.round(n);
const round2 = (n: number) => Math.round(n * 100) / 100;
/** A total for the PDF: "412,000", "15.8". */
const shown = (v: string | number) => (typeof v === "number" ? v.toLocaleString("en-US") : v);

export const FUEL_REPORTS: Record<FuelReportType, FuelReportDef> = {
  fuel_issuance: {
    title: "Fuel Issuance & Expenditure",
    short: "Fuel_Issuance",
    color: [7, 94, 84],
    columns: [
      { key: "date_logged", label: "Date", width: 12 },
      { key: "time_logged", label: "Time", width: 9 },
      { key: "driver", label: "Driver", width: 20 },
      { key: "litres", label: "Litres", width: 9 },
      { key: "unit_price", label: "Price/L (UGX)", width: 12 },
      { key: "total_cost", label: "Cost (UGX)", width: 12 },
      { key: "payment_method", label: "Paid by", width: 13 },
      { key: "receipt_number", label: "Receipt", width: 12 },
      { key: "station_name", label: "Station", width: 22 },
      { key: "full_tank", label: "Full tank", width: 9 },
      { key: "review", label: "Review", width: 14 },
    ],
    stats: (rows) => {
      let litres = 0, cost = 0;
      for (const r of rows) { litres += num(r.litres); cost += num(r.total_cost); }
      return [
        ["issue_count", "Fuel Issues", rows.length],
        ["total_litres", "Total Litres", round2(litres)],
        ["total_cost_stat", "Total Cost (UGX)", money(cost)],
        ["avg_price", "Average Price/L (UGX)", litres > 0 ? money(cost / litres) : 0],
      ];
    },
  },
  fuel_consumption: {
    title: "Fuel Consumption & Performance",
    short: "Fuel_Consumption",
    color: [11, 110, 153],
    columns: [
      { key: "date_logged", label: "Full tank on", width: 12 },
      { key: "driver", label: "Driver", width: 20 },
      { key: "km_since_full", label: "Distance (km)", width: 12 },
      { key: "litres_since_full", label: "Litres", width: 9 },
      { key: "km_per_l", label: "km/L", width: 8 },
      { key: "expected_km_per_l", label: "Expected km/L", width: 12 },
      { key: "excess_litres", label: "Excess (L)", width: 10 },
      { key: "excess_cost", label: "Excess cost (UGX)", width: 14 },
      { key: "cost_per_km", label: "UGX/km", width: 9 },
    ],
    stats: (rows) => {
      let km = 0, litres = 0, excessL = 0, excessCost = 0;
      for (const r of rows) {
        km += num(r.km_since_full);
        litres += num(r.litres_since_full);
        excessL += num(r.excess_litres);
        excessCost += num(r.excess_cost);
      }
      return [
        ["fills_measured", "Full Tanks Measured", rows.length],
        ["total_km", "Total Distance (km)", round2(km)],
        ["total_litres_used", "Total Litres", round2(litres)],
        ["avg_km_per_l", "Average km/L", litres > 0 ? round2(km / litres) : 0],
        ["total_excess_litres", "Excess Litres", round2(excessL)],
        ["total_excess_cost", "Excess Cost (UGX)", money(excessCost)],
      ];
    },
  },
  fuel_exceptions: {
    title: "Fuel Exceptions",
    short: "Fuel_Exceptions",
    color: [180, 83, 9],
    columns: [
      { key: "date_logged", label: "Date", width: 12 },
      { key: "time_logged", label: "Time", width: 9 },
      { key: "driver", label: "Driver", width: 20 },
      { key: "litres", label: "Litres", width: 9 },
      { key: "total_cost", label: "Cost (UGX)", width: 12 },
      { key: "problems", label: "What was found", width: 40 },
      { key: "review", label: "Review", width: 14 },
      { key: "review_note", label: "Review note", width: 30 },
    ],
    stats: (rows) => [
      ["exception_count", "Exceptions", rows.length],
      ["open_count", "Needing Review", rows.filter((r) => r.review === "Needs review").length],
      ["loss_count", "Confirmed Losses", rows.filter((r) => r.review === "Confirmed loss").length],
    ],
  },
};

/** Each vehicle's rows, in the order the server sent them. */
function byVehicle(data: FuelReportData): [string, FuelRow[]][] {
  const out = new Map<string, FuelRow[]>();
  for (const obj of data) {
    for (const [name, rows] of Object.entries(obj)) {
      if (Array.isArray(rows) && rows.length) out.set(name, (out.get(name) ?? []).concat(rows));
    }
  }
  return [...out];
}

/** The per-vehicle totals by key, for the Summary workbook. */
export function fuelStatsByKey(type: FuelReportType, rows: FuelRow[]): Record<string, string | number> {
  return Object.fromEntries(FUEL_REPORTS[type].stats(rows).map(([key, , v]) => [key, v]));
}

export function generateFuelReportPDF(type: FuelReportType, data: FuelReportData, startDate: string, endDate: string): void {
  const def = FUEL_REPORTS[type];
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`${def.title} Report`, pageWidth / 2, 15, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Period: ${startDate} to ${endDate}`, pageWidth / 2, 22, { align: "center" });
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 27, { align: "center" });

  let y = 34;
  for (const [vehicle, rows] of byVehicle(data)) {
    if (y > 175) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Vehicle: ${vehicle}`, 14, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(def.stats(rows).map(([, label, v]) => `${label}: ${shown(v)}`).join("   |   "), 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["#", ...def.columns.map((c) => c.label)]],
      body: rows.map((r, i) => [String(i + 1), ...def.columns.map((c) => r[c.key] || "-")]),
      styles: { fontSize: 7.5, cellPadding: 1.8 },
      headStyles: { fillColor: def.color, textColor: 255, fontSize: 7.5, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 248, 248] },
      margin: { left: 14, right: 14 },
      theme: "grid",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 9;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Page ${i} of ${pages} - Oliwa Tracking by 3D Services Ltd`, pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8, { align: "center" });
  }
  doc.save(`${def.short}_Report_${startDate}_to_${endDate}.pdf`);
}

export function generateFuelReportExcel(type: FuelReportType, data: FuelReportData, startDate: string, endDate: string): void {
  const def = FUEL_REPORTS[type];
  const vehicles = byVehicle(data);
  const wb = XLSX.utils.book_new();

  // Totals first: one row per vehicle.
  const totals = vehicles.map(([vehicle, rows]) => ({
    Vehicle: vehicle,
    ...Object.fromEntries(def.stats(rows).map(([, label, v]) => [label, v])),
  }));
  const tws = XLSX.utils.json_to_sheet(totals);
  tws["!cols"] = [{ wch: 28 }, ...def.stats([]).map(() => ({ wch: 20 }))];
  XLSX.utils.book_append_sheet(wb, tws, "Totals");

  // Then a sheet per vehicle (sheet names are at most 31 characters and
  // must be unique).
  const used = new Set(["Totals"]);
  for (const [vehicle, rows] of vehicles) {
    const ws = XLSX.utils.json_to_sheet(rows.map((r, i) => ({
      "#": i + 1,
      ...Object.fromEntries(def.columns.map((c) => [c.label, r[c.key] ?? ""])),
    })));
    ws["!cols"] = [{ wch: 5 }, ...def.columns.map((c) => ({ wch: c.width + 4 }))];
    let name = vehicle.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Vehicle";
    for (let n = 2; used.has(name); n++) name = `${name.slice(0, 27)} (${n})`;
    used.add(name);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${def.short}_Report_${startDate}_to_${endDate}.xlsx`);
}
