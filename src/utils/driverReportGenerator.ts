/**
 * driverReportGenerator.ts — the driver reports, as PDF and Excel, built in
 * the browser like the FuelMath reports (fuelReportGenerator.ts).
 *
 *   driver_registry     every registered driver and their details
 *   driver_assignments  vehicles each driver held, from when to when, and why
 *                       it ended
 *   driver_compliance   permit expiry, missing details and status, grouped
 *                       by verdict (Non-compliant first)
 *   driver_fuel         fuel issued to each driver, with cost and flags
 *   driver_scorecard    each driver's score for the period (100 less their
 *                       violations), ranked
 *
 * Rows come from POST /data-stream/reports/drivers/<kind>/generate-data
 * (navas-core-apis driver_report.py), already formatted, in the shape every
 * report route returns: [{ section: [row, ...] }]. A section is a driver
 * (assignments, fuel), a verdict (compliance) or "All drivers" (registry).
 * The OLIWA mobile app uses the same columns (report_type.dart).
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import type { DriverReportType } from "../api/types/reports.types";

export type DriverRow = Record<string, string>;
export type DriverReportData = Record<string, DriverRow[]>[];

/** The server route's kind for a report type. */
export function driverReportKind(type: DriverReportType): string {
  return type.replace(/^driver_/, "");
}

interface DriverReportDef {
  title: string;
  /** File name stem. */
  short: string;
  /** What a section is, for the PDF heading ("Driver: Okello John"); empty
   *  when the section name says it already. */
  sectionLabel: string;
  /** Column on the Totals sheet that holds the section name. */
  sectionColumn: string;
  columns: { key: string; label: string; width: number }[];
  stats: (rows: DriverRow[]) => [string, string | number][];
  color: [number, number, number];
  /** Portrait suits short tables; the wide ones go landscape. */
  landscape: boolean;
}

function num(v: string | undefined): number {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}
const round2 = (n: number) => Math.round(n * 100) / 100;
const shown = (v: string | number) => (typeof v === "number" ? v.toLocaleString("en-US") : v);
const count = (rows: DriverRow[], key: string, value: string) => rows.filter((r) => r[key] === value).length;

export const DRIVER_REPORTS: Record<DriverReportType, DriverReportDef> = {
  driver_registry: {
    title: "Driver Registry",
    short: "Driver_Registry",
    sectionLabel: "",
    sectionColumn: "Group",
    color: [7, 94, 84],
    landscape: true,
    columns: [
      { key: "driver", label: "Driver", width: 20 },
      { key: "phone", label: "Phone", width: 13 },
      { key: "employee_number", label: "Emp. no.", width: 9 },
      { key: "national_id", label: "National ID", width: 15 },
      { key: "permit_number", label: "Permit no.", width: 12 },
      { key: "permit_classes", label: "Classes", width: 8 },
      { key: "permit_expiry", label: "Permit expiry", width: 11 },
      { key: "permit_status", label: "Permit", width: 8 },
      { key: "ibutton_id", label: "iButton", width: 13 },
      { key: "home_branch", label: "Branch", width: 11 },
      { key: "current_vehicle", label: "Vehicle", width: 12 },
      { key: "status", label: "Status", width: 9 },
      { key: "emergency_contact", label: "Emergency contact", width: 20 },
      { key: "registered_on", label: "Registered", width: 11 },
    ],
    stats: (rows) => [
      ["Drivers", rows.length],
      ["Active", count(rows, "status", "Active")],
      ["Assigned to a vehicle", rows.filter((r) => r.current_vehicle).length],
      ["Permits expired", count(rows, "permit_status", "Expired")],
      ["Permits expiring", count(rows, "permit_status", "Expiring")],
    ],
  },
  driver_assignments: {
    title: "Driver Assignments",
    short: "Driver_Assignments",
    sectionLabel: "Driver",
    sectionColumn: "Driver",
    color: [11, 110, 153],
    landscape: false,
    columns: [
      { key: "vehicle", label: "Vehicle", width: 16 },
      { key: "assigned_on", label: "Assigned", width: 11 },
      { key: "assigned_time", label: "Assigned at", width: 8 },
      { key: "released_on", label: "Released", width: 11 },
      { key: "released_time", label: "Released at", width: 8 },
      { key: "duration", label: "Duration", width: 11 },
      { key: "release_reason", label: "Reason", width: 22 },
    ],
    stats: (rows) => [
      ["Assignments", rows.length],
      ["Vehicles", new Set(rows.map((r) => r.vehicle)).size],
      ["Current vehicle", rows.find((r) => r.release_reason === "Still assigned")?.vehicle || "None"],
    ],
  },
  driver_compliance: {
    title: "Driver Compliance",
    short: "Driver_Compliance",
    sectionLabel: "",
    sectionColumn: "Compliance",
    color: [180, 83, 9],
    landscape: true,
    columns: [
      { key: "driver", label: "Driver", width: 20 },
      { key: "phone", label: "Phone", width: 13 },
      { key: "permit_number", label: "Permit no.", width: 12 },
      { key: "permit_classes", label: "Classes", width: 8 },
      { key: "permit_expiry", label: "Expiry", width: 11 },
      { key: "permit_note", label: "Permit", width: 16 },
      { key: "status", label: "Status", width: 9 },
      { key: "current_vehicle", label: "Vehicle", width: 12 },
      { key: "issues", label: "Issues", width: 45 },
    ],
    stats: (rows) => [["Drivers", rows.length]],
  },
  driver_fuel: {
    title: "Driver Fuel",
    short: "Driver_Fuel",
    sectionLabel: "Driver",
    sectionColumn: "Driver",
    color: [7, 94, 84],
    landscape: true,
    columns: [
      { key: "date_logged", label: "Date", width: 11 },
      { key: "time_logged", label: "Time", width: 7 },
      { key: "vehicle", label: "Vehicle", width: 13 },
      { key: "fuel_type", label: "Fuel", width: 8 },
      { key: "litres", label: "Litres", width: 8 },
      { key: "unit_price", label: "Price/L", width: 9 },
      { key: "total_cost", label: "Cost (UGX)", width: 11 },
      { key: "payment_method", label: "Paid by", width: 11 },
      { key: "receipt_number", label: "Receipt", width: 11 },
      { key: "station_name", label: "Station", width: 18 },
      { key: "flagged", label: "Flagged", width: 24 },
      { key: "review", label: "Review", width: 11 },
    ],
    stats: (rows) => {
      let litres = 0, cost = 0;
      for (const r of rows) { litres += num(r.litres); cost += num(r.total_cost); }
      return [
        ["Fuel issues", rows.length],
        ["Total litres", round2(litres)],
        ["Total cost (UGX)", Math.round(cost)],
        ["Flagged", rows.filter((r) => r.flagged && r.flagged !== "No").length],
      ];
    },
  },
  driver_scorecard: {
    title: "Driver Scorecard",
    short: "Driver_Scorecard",
    sectionLabel: "",
    sectionColumn: "Group",
    color: [11, 122, 75],
    landscape: true,
    columns: [
      { key: "rank", label: "Rank", width: 6 },
      { key: "driver", label: "Driver", width: 22 },
      { key: "score", label: "Score", width: 7 },
      { key: "grade", label: "Grade", width: 14 },
      { key: "violations", label: "Violations", width: 9 },
      { key: "points_deducted", label: "Points off", width: 9 },
      { key: "breakdown", label: "Breakdown", width: 45 },
      { key: "status", label: "Status", width: 10 },
    ],
    stats: (rows) => {
      const scored = rows.filter((r) => r.score !== "");
      const avg = scored.length ? Math.round(scored.reduce((s, r) => s + num(r.score), 0) / scored.length) : 0;
      return [
        ["Drivers scored", scored.length],
        ["Average score", avg],
        ["Poor (below 60)", scored.filter((r) => num(r.score) < 60).length],
        ["Did not drive", rows.length - scored.length],
      ];
    },
  },
};

/** Each section's rows, in the order the server sent them. */
function sections(data: DriverReportData): [string, DriverRow[]][] {
  const out = new Map<string, DriverRow[]>();
  for (const obj of data) {
    for (const [name, rows] of Object.entries(obj)) {
      if (Array.isArray(rows) && rows.length) out.set(name, (out.get(name) ?? []).concat(rows));
    }
  }
  return [...out];
}

function periodText(type: DriverReportType, startDate: string, endDate: string): string {
  return type === "driver_assignments" || type === "driver_fuel" || type === "driver_scorecard"
    ? `Period: ${startDate} to ${endDate}`
    : `As of ${new Date().toLocaleDateString()}`;
}

function fileStem(type: DriverReportType, startDate: string, endDate: string): string {
  const def = DRIVER_REPORTS[type];
  if (type === "driver_assignments" || type === "driver_fuel" || type === "driver_scorecard") {
    return `${def.short}_Report_${startDate}_to_${endDate}`;
  }
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${def.short}_Report_${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

export function generateDriverReportPDF(
  type: DriverReportType, data: DriverReportData, startDate: string, endDate: string,
): void {
  const def = DRIVER_REPORTS[type];
  const doc = new jsPDF({ orientation: def.landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`${def.title} Report`, pageWidth / 2, 15, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(periodText(type, startDate, endDate), pageWidth / 2, 22, { align: "center" });
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 27, { align: "center" });

  let y = 34;
  for (const [section, rows] of sections(data)) {
    if (y > pageHeight - 35) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(def.sectionLabel ? `${def.sectionLabel}: ${section}` : section, 14, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(def.stats(rows).map(([label, v]) => `${label}: ${shown(v)}`).join("   |   "), 14, y);
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
      pageHeight - 8, { align: "center" });
  }
  doc.save(`${fileStem(type, startDate, endDate)}.pdf`);
}

export function generateDriverReportExcel(
  type: DriverReportType, data: DriverReportData, startDate: string, endDate: string,
): void {
  const def = DRIVER_REPORTS[type];
  const groups = sections(data);
  const wb = XLSX.utils.book_new();

  // Totals first: one row per section.
  const totals = groups.map(([section, rows]) => ({
    [def.sectionColumn]: section,
    ...Object.fromEntries(def.stats(rows)),
  }));
  const tws = XLSX.utils.json_to_sheet(totals);
  tws["!cols"] = [{ wch: 28 }, ...def.stats([]).map(() => ({ wch: 20 }))];
  XLSX.utils.book_append_sheet(wb, tws, "Totals");

  // Then a sheet per section (names at most 31 characters, unique).
  const used = new Set(["Totals"]);
  for (const [section, rows] of groups) {
    const ws = XLSX.utils.json_to_sheet(rows.map((r, i) => ({
      "#": i + 1,
      ...Object.fromEntries(def.columns.map((c) => [c.label, r[c.key] ?? ""])),
    })));
    ws["!cols"] = [{ wch: 5 }, ...def.columns.map((c) => ({ wch: c.width + 4 }))];
    let name = section.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Drivers";
    for (let n = 2; used.has(name); n++) name = `${name.slice(0, 27)} (${n})`;
    used.add(name);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${fileStem(type, startDate, endDate)}.xlsx`);
}
