/**
 * reportGenerator.ts — Client-side PDF & Excel report generation.
 *
 * Fetches trip data from the backend, then generates downloadable
 * files directly in the browser. No server-side file generation needed.
 *
 * Dependencies: jspdf, jspdf-autotable, xlsx, file-saver
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ── Types ───────────────────────────────────────────────────────────────────

interface TripRecord {
  trip_uid: string;
  trip_date: string;
  start_time: string;
  end_time: string;
  start_mileage: string;
  end_mileage: string;
  mileage_covered: string;
  start_fuel_level: string;
  end_fuel_level: string;
  driver_id: string;
  start_location: string;
  end_location: string;
  start_gps_cords: string;
  end_gps_cords: string;
}

/** Backend returns array of { deviceName: TripRecord[] } objects */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TripsDataResponse = Record<string, TripRecord[]>[];

interface NightDrivingEvent {
  date_logged: string;
  location_point: string;
  time_violated: string;
  event_triggered: string;
  gps_coordinates: string;
}

type NightDrivingDataResponse = Record<string, NightDrivingEvent[]>[];

interface StateRecord {
  date_logged: string;
  start_time: string;
  end_time: string;
  duration: string;
  duration_minutes: number;
  start_location: string;
  end_location: string;
  start_gps: string;
  end_gps: string;
}

type StateDataResponse = Record<string, StateRecord[]>[];

interface OverspeedingEvent {
  date_logged: string;
  location_point: string;
  moving_speed: string;
  event_triggered: string;
  gps_coordinates: string;
}

type OverspeedingDataResponse = Record<string, OverspeedingEvent[]>[];

interface GeozoneEvent {
  date_logged: string;
  location_point: string;
  geozone_name: string;
  event_triggered: string;
  gps_coordinates: string;
}

type GeozoneDataResponse = Record<string, GeozoneEvent[]>[];

// ── PDF Generation ─────────────────────────────────────────────────────────

export function generateTripsPDF(
  tripsData: TripsDataResponse,
  startDate: string,
  endDate: string,
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Trips Report", pageWidth / 2, 15, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Period: ${startDate} to ${endDate}`, pageWidth / 2, 22, { align: "center" });
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 27, { align: "center" });

  let yOffset = 32;

  for (const deviceObj of tripsData) {
    for (const [deviceName, trips] of Object.entries(deviceObj)) {
      if (!trips.length) continue;

      // Device header
      if (yOffset > 180) {
        doc.addPage();
        yOffset = 15;
      }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Device: ${deviceName}`, 14, yOffset);
      yOffset += 3;

      // Table
      const rows = trips.map((t, i) => [
        String(i + 1),
        t.trip_date,
        t.start_time,
        t.end_time,
        t.start_location || "—",
        t.end_location || "—",
        t.mileage_covered !== "NoData" ? `${t.mileage_covered} km` : "—",
        t.start_fuel_level !== "NoData" ? t.start_fuel_level : "—",
        t.end_fuel_level !== "NoData" ? t.end_fuel_level : "—",
        t.driver_id || "—",
      ]);

      autoTable(doc, {
        startY: yOffset,
        head: [[
          "#", "Date", "Start", "End",
          "Start Location", "End Location",
          "Distance", "Fuel Start", "Fuel End", "Driver",
        ]],
        body: rows,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: {
          fillColor: [18, 140, 126],  // #128C7E
          textColor: 255,
          fontSize: 7,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 14, right: 14 },
        theme: "grid",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yOffset = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Page ${i} of ${pageCount} — Oliwa Tracking by 3D Services Ltd`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" },
    );
  }

  const filename = `Trips_Report_${startDate}_to_${endDate}.pdf`;
  doc.save(filename);
}

// ── Excel Generation ────────────────────────────────────────────────────────

export function generateTripsExcel(
  tripsData: TripsDataResponse,
  startDate: string,
  endDate: string,
): void {
  const wb = XLSX.utils.book_new();

  for (const deviceObj of tripsData) {
    for (const [deviceName, trips] of Object.entries(deviceObj)) {
      if (!trips.length) continue;

      const rows = trips.map((t, i) => ({
        "#": i + 1,
        "Date": t.trip_date,
        "Start Time": t.start_time,
        "End Time": t.end_time,
        "Start Location": t.start_location || "",
        "End Location": t.end_location || "",
        "Distance (km)": t.mileage_covered !== "NoData" ? t.mileage_covered : "",
        "Start Fuel": t.start_fuel_level !== "NoData" ? t.start_fuel_level : "",
        "End Fuel": t.end_fuel_level !== "NoData" ? t.end_fuel_level : "",
        "Driver": t.driver_id || "",
        "Start GPS": t.start_gps_cords || "",
        "End GPS": t.end_gps_cords || "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);

      // Set column widths
      ws["!cols"] = [
        { wch: 5 },   // #
        { wch: 12 },  // Date
        { wch: 10 },  // Start Time
        { wch: 10 },  // End Time
        { wch: 30 },  // Start Location
        { wch: 30 },  // End Location
        { wch: 12 },  // Distance
        { wch: 10 },  // Start Fuel
        { wch: 10 },  // End Fuel
        { wch: 12 },  // Driver
        { wch: 20 },  // Start GPS
        { wch: 20 },  // End GPS
      ];

      // Truncate sheet name to 31 chars (Excel limit)
      const sheetName = deviceName.length > 31
        ? deviceName.slice(0, 31) : deviceName;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const filename = `Trips_Report_${startDate}_to_${endDate}.xlsx`;
  saveAs(blob, filename);
}

// ── Fuel Report — PDF ──────────────────────────────────────────────────────

export function generateFuelPDF(
  tripsData: TripsDataResponse,
  startDate: string,
  endDate: string,
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Fuel Level Report", pageWidth / 2, 15, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Period: ${startDate} to ${endDate}`, pageWidth / 2, 22, { align: "center" });
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 27, { align: "center" });

  let yOffset = 32;

  for (const deviceObj of tripsData) {
    for (const [deviceName, trips] of Object.entries(deviceObj)) {
      if (!trips.length) continue;

      // Device header
      if (yOffset > 180) {
        doc.addPage();
        yOffset = 15;
      }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Device: ${deviceName}`, 14, yOffset);
      yOffset += 3;

      // Table rows — fuel-focused columns
      const rows = trips.map((t, i) => {
        const startFuel = parseFloat(t.start_fuel_level) || 0;
        const endFuel = parseFloat(t.end_fuel_level) || 0;
        const fuelDiff = startFuel - endFuel;
        const startMi = parseFloat(t.start_mileage) || 0;
        const endMi = parseFloat(t.end_mileage) || 0;
        const mileage = Math.abs(startMi - endMi);

        return [
          String(i + 1),
          t.trip_date,
          t.start_time,
          t.end_time,
          t.start_fuel_level !== "NoData" ? t.start_fuel_level : "—",
          t.end_fuel_level !== "NoData" ? t.end_fuel_level : "—",
          t.start_fuel_level !== "NoData" && t.end_fuel_level !== "NoData"
            ? fuelDiff.toFixed(2)
            : "—",
          mileage > 0 ? mileage.toFixed(2) + " km" : "—",
          t.start_location || "—",
          t.end_location || "—",
        ];
      });

      autoTable(doc, {
        startY: yOffset,
        head: [[
          "#", "Date", "Start Time", "End Time",
          "Start Fuel", "End Fuel", "Fuel Used",
          "Distance", "Start Location", "End Location",
        ]],
        body: rows,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: {
          fillColor: [220, 120, 20],  // Orange-ish for fuel reports
          textColor: 255,
          fontSize: 7,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [255, 248, 240] },
        margin: { left: 14, right: 14 },
        theme: "grid",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yOffset = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Page ${i} of ${pageCount} — Oliwa Tracking by 3D Services Ltd`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" },
    );
  }

  const filename = `Fuel_Report_${startDate}_to_${endDate}.pdf`;
  doc.save(filename);
}

// ── Fuel Report — Excel ────────────────────────────────────────────────────

export function generateFuelExcel(
  tripsData: TripsDataResponse,
  startDate: string,
  endDate: string,
): void {
  const wb = XLSX.utils.book_new();

  for (const deviceObj of tripsData) {
    for (const [deviceName, trips] of Object.entries(deviceObj)) {
      if (!trips.length) continue;

      const rows = trips.map((t, i) => {
        const startFuel = parseFloat(t.start_fuel_level) || 0;
        const endFuel = parseFloat(t.end_fuel_level) || 0;
        const fuelDiff = startFuel - endFuel;
        const startMi = parseFloat(t.start_mileage) || 0;
        const endMi = parseFloat(t.end_mileage) || 0;
        const mileage = Math.abs(startMi - endMi);

        return {
          "#": i + 1,
          "Date": t.trip_date,
          "Start Time": t.start_time,
          "End Time": t.end_time,
          "Start Fuel Level": t.start_fuel_level !== "NoData" ? t.start_fuel_level : "",
          "End Fuel Level": t.end_fuel_level !== "NoData" ? t.end_fuel_level : "",
          "Fuel Used": t.start_fuel_level !== "NoData" && t.end_fuel_level !== "NoData"
            ? fuelDiff.toFixed(2) : "",
          "Start Mileage": t.start_mileage !== "NoData" ? t.start_mileage : "",
          "End Mileage": t.end_mileage !== "NoData" ? t.end_mileage : "",
          "Distance (km)": mileage > 0 ? mileage.toFixed(2) : "",
          "Start Location": t.start_location || "",
          "End Location": t.end_location || "",
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);

      // Set column widths
      ws["!cols"] = [
        { wch: 5 },   // #
        { wch: 12 },  // Date
        { wch: 10 },  // Start Time
        { wch: 10 },  // End Time
        { wch: 14 },  // Start Fuel Level
        { wch: 14 },  // End Fuel Level
        { wch: 10 },  // Fuel Used
        { wch: 14 },  // Start Mileage
        { wch: 14 },  // End Mileage
        { wch: 12 },  // Distance
        { wch: 30 },  // Start Location
        { wch: 30 },  // End Location
      ];

      const sheetName = deviceName.length > 31
        ? deviceName.slice(0, 31) : deviceName;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const filename = `Fuel_Report_${startDate}_to_${endDate}.xlsx`;
  saveAs(blob, filename);
}

// ── Night Driving Report — PDF ─────────────────────────────────────────────

export function generateNightDrivingPDF(
  eventsData: NightDrivingDataResponse,
  startDate: string,
  endDate: string,
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Night Driving Report", pageWidth / 2, 15, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Period: ${startDate} to ${endDate}`, pageWidth / 2, 22, { align: "center" });
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 27, { align: "center" });

  let yOffset = 32;

  for (const deviceObj of eventsData) {
    for (const [deviceName, events] of Object.entries(deviceObj)) {
      if (!events.length) continue;

      if (yOffset > 180) {
        doc.addPage();
        yOffset = 15;
      }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Device: ${deviceName}`, 14, yOffset);
      yOffset += 3;

      const rows = events.map((e, i) => [
        String(i + 1),
        e.date_logged || "—",
        e.time_violated || "—",
        e.location_point || "—",
        e.event_triggered || "—",
        e.gps_coordinates || "—",
      ]);

      autoTable(doc, {
        startY: yOffset,
        head: [["#", "Date", "Time Violated", "Location", "Event", "GPS Coordinates"]],
        body: rows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: {
          fillColor: [80, 40, 120],  // Dark purple for night driving
          textColor: 255,
          fontSize: 8,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [245, 240, 250] },
        margin: { left: 14, right: 14 },
        theme: "grid",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yOffset = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Page ${i} of ${pageCount} — Oliwa Tracking by 3D Services Ltd`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" },
    );
  }

  const filename = `Night_Driving_Report_${startDate}_to_${endDate}.pdf`;
  doc.save(filename);
}

// ── Night Driving Report — Excel ───────────────────────────────────────────

export function generateNightDrivingExcel(
  eventsData: NightDrivingDataResponse,
  startDate: string,
  endDate: string,
): void {
  const wb = XLSX.utils.book_new();

  for (const deviceObj of eventsData) {
    for (const [deviceName, events] of Object.entries(deviceObj)) {
      if (!events.length) continue;

      const rows = events.map((e, i) => ({
        "#": i + 1,
        "Date": e.date_logged || "",
        "Time Violated": e.time_violated || "",
        "Location": e.location_point || "",
        "Event Triggered": e.event_triggered || "",
        "GPS Coordinates": e.gps_coordinates || "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);

      ws["!cols"] = [
        { wch: 5 },   // #
        { wch: 14 },  // Date
        { wch: 14 },  // Time Violated
        { wch: 35 },  // Location
        { wch: 18 },  // Event Triggered
        { wch: 25 },  // GPS Coordinates
      ];

      const sheetName = deviceName.length > 31
        ? deviceName.slice(0, 31) : deviceName;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const filename = `Night_Driving_Report_${startDate}_to_${endDate}.xlsx`;
  saveAs(blob, filename);
}

// ── State Duration Report (Parking / Idling) — PDF ─────────────────────────

export function generateStatePDF(
  stateData: StateDataResponse,
  startDate: string,
  endDate: string,
  stateLabel: string,  // "Parking" or "Idling"
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`${stateLabel} Report`, pageWidth / 2, 15, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Period: ${startDate} to ${endDate}`, pageWidth / 2, 22, { align: "center" });
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 27, { align: "center" });

  let yOffset = 32;

  for (const deviceObj of stateData) {
    for (const [deviceName, records] of Object.entries(deviceObj)) {
      if (!records.length) continue;

      if (yOffset > 180) {
        doc.addPage();
        yOffset = 15;
      }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Device: ${deviceName}`, 14, yOffset);
      yOffset += 3;

      const rows = records.map((r, i) => [
        String(i + 1),
        r.date_logged || "—",
        r.start_time || "—",
        r.end_time || "—",
        r.duration || "—",
        r.start_location || "—",
        r.end_location || "—",
      ]);

      // Blue for parking, amber for idling
      const headerColor: [number, number, number] =
        stateLabel === "Parking" ? [30, 80, 160] : [180, 120, 20];

      autoTable(doc, {
        startY: yOffset,
        head: [["#", "Date", "Start Time", "End Time", "Duration", "Start Location", "End Location"]],
        body: rows,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: {
          fillColor: headerColor,
          textColor: 255,
          fontSize: 7,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [245, 245, 250] },
        margin: { left: 14, right: 14 },
        theme: "grid",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yOffset = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Page ${i} of ${pageCount} — Oliwa Tracking by 3D Services Ltd`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" },
    );
  }

  const filename = `${stateLabel}_Report_${startDate}_to_${endDate}.pdf`;
  doc.save(filename);
}

// ── State Duration Report (Parking / Idling) — Excel ───────────────────────

export function generateStateExcel(
  stateData: StateDataResponse,
  startDate: string,
  endDate: string,
  stateLabel: string,
): void {
  const wb = XLSX.utils.book_new();

  for (const deviceObj of stateData) {
    for (const [deviceName, records] of Object.entries(deviceObj)) {
      if (!records.length) continue;

      const rows = records.map((r, i) => ({
        "#": i + 1,
        "Date": r.date_logged || "",
        "Start Time": r.start_time || "",
        "End Time": r.end_time || "",
        "Duration": r.duration || "",
        "Duration (min)": r.duration_minutes || 0,
        "Start Location": r.start_location || "",
        "End Location": r.end_location || "",
        "Start GPS": r.start_gps || "",
        "End GPS": r.end_gps || "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);

      ws["!cols"] = [
        { wch: 5 },   // #
        { wch: 14 },  // Date
        { wch: 10 },  // Start Time
        { wch: 10 },  // End Time
        { wch: 18 },  // Duration
        { wch: 14 },  // Duration (min)
        { wch: 30 },  // Start Location
        { wch: 30 },  // End Location
        { wch: 22 },  // Start GPS
        { wch: 22 },  // End GPS
      ];

      const sheetName = deviceName.length > 31
        ? deviceName.slice(0, 31) : deviceName;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const filename = `${stateLabel}_Report_${startDate}_to_${endDate}.xlsx`;
  saveAs(blob, filename);
}

// ── Overspeeding Report — PDF ──────────────────────────────────────────────

export function generateOverspeedingPDF(
  eventsData: OverspeedingDataResponse,
  startDate: string,
  endDate: string,
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Overspeeding Report", pageWidth / 2, 15, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Period: ${startDate} to ${endDate}`, pageWidth / 2, 22, { align: "center" });
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 27, { align: "center" });

  let yOffset = 32;

  for (const deviceObj of eventsData) {
    for (const [deviceName, events] of Object.entries(deviceObj)) {
      if (!events.length) continue;

      if (yOffset > 180) { doc.addPage(); yOffset = 15; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Device: ${deviceName}`, 14, yOffset);
      yOffset += 3;

      const rows = events.map((e, i) => [
        String(i + 1),
        e.date_logged || "—",
        e.moving_speed || "—",
        e.location_point || "—",
        e.event_triggered || "—",
        e.gps_coordinates || "—",
      ]);

      autoTable(doc, {
        startY: yOffset,
        head: [["#", "Date", "Speed", "Location", "Speed Limit", "GPS Coordinates"]],
        body: rows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: {
          fillColor: [200, 40, 40],  // Red for overspeeding
          textColor: 255, fontSize: 8, fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [255, 245, 245] },
        margin: { left: 14, right: 14 },
        theme: "grid",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yOffset = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Page ${i} of ${pageCount} — Oliwa Tracking by 3D Services Ltd`,
      pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" },
    );
  }

  doc.save(`Overspeeding_Report_${startDate}_to_${endDate}.pdf`);
}

// ── Overspeeding Report — Excel ────────────────────────────────────────────

export function generateOverspeedingExcel(
  eventsData: OverspeedingDataResponse,
  startDate: string,
  endDate: string,
): void {
  const wb = XLSX.utils.book_new();

  for (const deviceObj of eventsData) {
    for (const [deviceName, events] of Object.entries(deviceObj)) {
      if (!events.length) continue;

      const rows = events.map((e, i) => ({
        "#": i + 1,
        "Date": e.date_logged || "",
        "Speed": e.moving_speed || "",
        "Location": e.location_point || "",
        "Speed Limit": e.event_triggered || "",
        "GPS Coordinates": e.gps_coordinates || "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 5 }, { wch: 14 }, { wch: 12 }, { wch: 35 }, { wch: 16 }, { wch: 25 },
      ];

      const sheetName = deviceName.length > 31 ? deviceName.slice(0, 31) : deviceName;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `Overspeeding_Report_${startDate}_to_${endDate}.xlsx`);
}

// ── Geozone Breach Report — PDF ────────────────────────────────────────────

export function generateGeozonePDF(
  eventsData: GeozoneDataResponse,
  startDate: string,
  endDate: string,
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Geozone Breach Report", pageWidth / 2, 15, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Period: ${startDate} to ${endDate}`, pageWidth / 2, 22, { align: "center" });
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 27, { align: "center" });

  let yOffset = 32;

  for (const deviceObj of eventsData) {
    for (const [deviceName, events] of Object.entries(deviceObj)) {
      if (!events.length) continue;

      if (yOffset > 180) { doc.addPage(); yOffset = 15; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Device: ${deviceName}`, 14, yOffset);
      yOffset += 3;

      const rows = events.map((e, i) => [
        String(i + 1),
        e.date_logged || "—",
        e.geozone_name || "—",
        e.location_point || "—",
        e.event_triggered || "—",
        e.gps_coordinates || "—",
      ]);

      autoTable(doc, {
        startY: yOffset,
        head: [["#", "Date", "Geozone Name", "Location", "Event", "GPS Coordinates"]],
        body: rows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: {
          fillColor: [30, 130, 76],  // Green for geozones
          textColor: 255, fontSize: 8, fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [240, 250, 245] },
        margin: { left: 14, right: 14 },
        theme: "grid",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yOffset = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Page ${i} of ${pageCount} — Oliwa Tracking by 3D Services Ltd`,
      pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" },
    );
  }

  doc.save(`Geozone_Report_${startDate}_to_${endDate}.pdf`);
}

// ── Geozone Breach Report — Excel ──────────────────────────────────────────

export function generateGeozoneExcel(
  eventsData: GeozoneDataResponse,
  startDate: string,
  endDate: string,
): void {
  const wb = XLSX.utils.book_new();

  for (const deviceObj of eventsData) {
    for (const [deviceName, events] of Object.entries(deviceObj)) {
      if (!events.length) continue;

      const rows = events.map((e, i) => ({
        "#": i + 1,
        "Date": e.date_logged || "",
        "Geozone Name": e.geozone_name || "",
        "Location": e.location_point || "",
        "Event Triggered": e.event_triggered || "",
        "GPS Coordinates": e.gps_coordinates || "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 5 }, { wch: 14 }, { wch: 20 }, { wch: 35 }, { wch: 18 }, { wch: 25 },
      ];

      const sheetName = deviceName.length > 31 ? deviceName.slice(0, 31) : deviceName;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `Geozone_Report_${startDate}_to_${endDate}.xlsx`);
}
