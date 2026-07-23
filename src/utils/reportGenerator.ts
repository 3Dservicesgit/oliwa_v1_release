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

// ── Summary Report — Multi-sheet Excel with customizable columns ──────────

/** Column definition for the summary report column picker. */
export interface SummaryColumn {
  key: string;
  label: string;
  section: "statistics" | "detail";
  /** Whether the column is selected by default */
  default: boolean;
}

/** Which sections to include in the summary report. */
export interface SummarySections {
  cover: boolean;
  statistics: boolean;
  detail: boolean;
}

/**
 * Per-report-type column catalogs.
 * The UI reads SUMMARY_COLUMNS_BY_TYPE[reportType] to render the picker.
 */
export const SUMMARY_COLUMNS_BY_TYPE: Record<string, SummaryColumn[]> = {
  // ── Trips / Fuel ────────────────────────────────────────────────────────
  trips: [
    { key: "trip_count",     label: "Trip Count",          section: "statistics", default: true },
    { key: "total_distance", label: "Total Distance (km)", section: "statistics", default: true },
    { key: "avg_speed",      label: "Average Speed (km/h)",section: "statistics", default: true },
    { key: "max_speed",      label: "Top Speed (km/h)",    section: "statistics", default: true },
    { key: "total_duration", label: "Total Duration",      section: "statistics", default: false },
    { key: "fuel_used",      label: "Fuel Used",           section: "statistics", default: false },
    { key: "trip_date",      label: "Date",           section: "detail", default: true },
    { key: "start_time",     label: "Start Time",     section: "detail", default: true },
    { key: "end_time",       label: "End Time",       section: "detail", default: true },
    { key: "start_location", label: "Start Location", section: "detail", default: true },
    { key: "end_location",   label: "End Location",   section: "detail", default: true },
    { key: "mileage",        label: "Distance (km)",  section: "detail", default: true },
    { key: "duration",       label: "Duration",       section: "detail", default: false },
    { key: "start_fuel",     label: "Start Fuel",     section: "detail", default: false },
    { key: "end_fuel",       label: "End Fuel",       section: "detail", default: false },
    { key: "driver",         label: "Driver",         section: "detail", default: false },
    { key: "start_gps",      label: "Start GPS",      section: "detail", default: false },
    { key: "end_gps",        label: "End GPS",        section: "detail", default: false },
  ],

  fuel: [
    { key: "trip_count",     label: "Trip Count",          section: "statistics", default: true },
    { key: "total_fuel",     label: "Total Fuel Used",     section: "statistics", default: true },
    { key: "total_distance", label: "Total Distance (km)", section: "statistics", default: true },
    { key: "avg_consumption",label: "Avg Consumption",     section: "statistics", default: true },
    { key: "trip_date",      label: "Date",           section: "detail", default: true },
    { key: "start_time",     label: "Start Time",     section: "detail", default: true },
    { key: "end_time",       label: "End Time",       section: "detail", default: true },
    { key: "start_fuel",     label: "Start Fuel",     section: "detail", default: true },
    { key: "end_fuel",       label: "End Fuel",       section: "detail", default: true },
    { key: "fuel_diff",      label: "Fuel Used",      section: "detail", default: true },
    { key: "mileage",        label: "Distance (km)",  section: "detail", default: true },
    { key: "start_location", label: "Start Location", section: "detail", default: false },
    { key: "end_location",   label: "End Location",   section: "detail", default: false },
  ],

  // ── Night Driving ───────────────────────────────────────────────────────
  night_driving: [
    { key: "event_count",    label: "Event Count",         section: "statistics", default: true },
    { key: "total_violations",label: "Total Violations",   section: "statistics", default: true },
    { key: "date_logged",    label: "Date",           section: "detail", default: true },
    { key: "time_violated",  label: "Time Violated",  section: "detail", default: true },
    { key: "event_triggered",label: "Event",          section: "detail", default: true },
    { key: "location_point", label: "Location",       section: "detail", default: true },
    { key: "gps_coordinates",label: "GPS",            section: "detail", default: false },
  ],

  // ── Overspeeding ────────────────────────────────────────────────────────
  overspeeding: [
    { key: "event_count",    label: "Event Count",         section: "statistics", default: true },
    { key: "max_speed_stat", label: "Max Speed Recorded",  section: "statistics", default: true },
    { key: "avg_speed_stat", label: "Avg Overspeed",       section: "statistics", default: true },
    { key: "date_logged",    label: "Date",           section: "detail", default: true },
    { key: "moving_speed",   label: "Speed",          section: "detail", default: true },
    { key: "event_triggered",label: "Event",          section: "detail", default: true },
    { key: "location_point", label: "Location",       section: "detail", default: true },
    { key: "gps_coordinates",label: "GPS",            section: "detail", default: false },
  ],

  // ── Geozone ─────────────────────────────────────────────────────────────
  geozone: [
    { key: "event_count",    label: "Event Count",         section: "statistics", default: true },
    { key: "zones_visited",  label: "Zones Visited",       section: "statistics", default: true },
    { key: "date_logged",    label: "Date",           section: "detail", default: true },
    { key: "geozone_name",   label: "Zone Name",     section: "detail", default: true },
    { key: "event_triggered",label: "Event",          section: "detail", default: true },
    { key: "location_point", label: "Location",       section: "detail", default: true },
    { key: "gps_coordinates",label: "GPS",            section: "detail", default: false },
  ],

  // ── Parking / Idling (state reports) ────────────────────────────────────
  PARKING: [
    { key: "event_count",     label: "Event Count",        section: "statistics", default: true },
    { key: "total_duration_stat", label: "Total Duration",  section: "statistics", default: true },
    { key: "avg_duration_stat",   label: "Avg Duration",    section: "statistics", default: true },
    { key: "date_logged",    label: "Date",           section: "detail", default: true },
    { key: "start_time",     label: "Start Time",     section: "detail", default: true },
    { key: "end_time",       label: "End Time",       section: "detail", default: true },
    { key: "duration",       label: "Duration",       section: "detail", default: true },
    { key: "start_location", label: "Start Location", section: "detail", default: true },
    { key: "end_location",   label: "End Location",   section: "detail", default: false },
    { key: "start_gps",      label: "Start GPS",      section: "detail", default: false },
    { key: "end_gps",        label: "End GPS",        section: "detail", default: false },
  ],
};
// Idling shares the same columns as Parking
SUMMARY_COLUMNS_BY_TYPE.IDILING = SUMMARY_COLUMNS_BY_TYPE.PARKING;

/** Convenience: get columns for a report type, falling back to trips. */
export function getSummaryColumns(reportType: string): SummaryColumn[] {
  return SUMMARY_COLUMNS_BY_TYPE[reportType] || SUMMARY_COLUMNS_BY_TYPE.trips;
}

// Keep backwards compat — SUMMARY_COLUMNS is trips columns
export const SUMMARY_COLUMNS = SUMMARY_COLUMNS_BY_TYPE.trips;

// ── Detail sheet name per report type ─────────────────────────────────────
const DETAIL_SHEET_NAMES: Record<string, string> = {
  trips: "Trips", fuel: "Fuel Details", night_driving: "Night Driving",
  overspeeding: "Overspeeding", geozone: "Geozone Events",
  PARKING: "Parking", IDILING: "Idling",
};

const REPORT_TITLE_LABELS: Record<string, string> = {
  trips: "Trip", fuel: "Fuel", night_driving: "Night Driving",
  overspeeding: "Overspeeding", geozone: "Geozone",
  PARKING: "Parking", IDILING: "Idling",
};

/**
 * Generate a multi-sheet Summary Excel report for ANY report type.
 *
 *   Sheet 1 — Cover page (report metadata)
 *   Sheet 2 — Statistics (aggregated per device)
 *   Sheet 3 — Detail (per-event rows, user-selected columns)
 *
 * @param rawData       Raw data from the backend (array of { deviceName: Record[] })
 * @param startDate     DD-MM-YYYY
 * @param endDate       DD-MM-YYYY
 * @param reportType    The report type key (trips, fuel, night_driving, etc.)
 * @param sections      Which sheets to include
 * @param selectedColumns  Array of column keys the user selected
 * @param groupName     Optional customer/group name for the cover page
 */
export function generateSummaryExcel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawData: any[],
  startDate: string,
  endDate: string,
  reportType: string,
  sections: SummarySections,
  selectedColumns: string[],
  groupName?: string,
): void {
  const wb = XLSX.utils.book_new();
  const now = new Date().toLocaleString();
  const allCols = getSummaryColumns(reportType);
  const statCols = allCols.filter((c) => c.section === "statistics" && selectedColumns.includes(c.key));
  const detailCols = allCols.filter((c) => c.section === "detail" && selectedColumns.includes(c.key));
  const detailSheetName = DETAIL_SHEET_NAMES[reportType] || "Details";
  const titleLabel = REPORT_TITLE_LABELS[reportType] || reportType;

  // ── Flatten device data ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceMap = new Map<string, any[]>();
  for (const deviceObj of rawData) {
    for (const [deviceName, records] of Object.entries(deviceObj)) {
      const existing = deviceMap.get(deviceName) || [];
      deviceMap.set(deviceName, existing.concat(records as unknown[]));
    }
  }

  // ── Sheet 1: Cover ──────────────────────────────────────────────────────
  if (sections.cover) {
    const coverData = [
      [`${titleLabel} Summary Report`],
      [],
      ["Report Type", titleLabel],
      ["Group", groupName || "All Devices"],
      ["Interval beginning", startDate.replace(/-/g, "/")],
      ["Interval end", endDate.replace(/-/g, "/")],
      ["Report execution time", now],
      [],
      ["Sheets included:"],
    ];
    if (sections.statistics) coverData.push(["  - Statistics"]);
    if (sections.detail) coverData.push([`  - ${detailSheetName}`]);
    coverData.push([], ["Generated by Oliwa Tracking — 3D Services Ltd"]);

    const ws = XLSX.utils.aoa_to_sheet(coverData);
    ws["!cols"] = [{ wch: 25 }, { wch: 40 }];
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    XLSX.utils.book_append_sheet(wb, ws, "Cover");
  }

  // ── Sheet 2: Statistics ─────────────────────────────────────────────────
  if (sections.statistics && statCols.length > 0) {
    const statsRows: Record<string, string | number>[] = [];

    for (const [deviceName, records] of deviceMap) {
      if (!records.length) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row: any = { "Unit Name": deviceName };

      // ── Trips / Fuel statistics ─────────────────────────────────────────
      if (reportType === "trips" || reportType === "fuel") {
        const trips = records as TripRecord[];
        let totalDist = 0, totalDuration = 0, totalFuel = 0, maxSpd = 0;
        const speeds: number[] = [];
        for (const t of trips) {
          const sMi = parseFloat(t.start_mileage) || 0;
          const eMi = parseFloat(t.end_mileage) || 0;
          const d = Math.abs(eMi - sMi);
          if (d > 0 && d < 10000) totalDist += d;
          const sp = (t.start_time || "").split(":");
          const ep = (t.end_time || "").split(":");
          if (sp.length >= 2 && ep.length >= 2) {
            const m = (parseInt(ep[0]) * 60 + parseInt(ep[1])) - (parseInt(sp[0]) * 60 + parseInt(sp[1]));
            if (m > 0) totalDuration += m;
          }
          const sf = parseFloat(t.start_fuel_level) || 0;
          const ef = parseFloat(t.end_fuel_level) || 0;
          if (sf > 0 && ef > 0 && sf > ef) totalFuel += sf - ef;
          const mc = parseFloat(t.mileage_covered) || 0;
          if (mc > 0) { speeds.push(mc); if (mc > maxSpd) maxSpd = mc; }
        }
        const avgSpd = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
        const durStr = `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m`;
        const avgCons = totalDist > 0 ? totalFuel / totalDist * 100 : 0;
        for (const col of statCols) {
          switch (col.key) {
            case "trip_count":      row[col.label] = trips.length; break;
            case "total_distance":  row[col.label] = Math.round(totalDist * 100) / 100; break;
            case "avg_speed":       row[col.label] = Math.round(avgSpd * 100) / 100; break;
            case "max_speed":       row[col.label] = Math.round(maxSpd * 100) / 100; break;
            case "total_duration":  row[col.label] = durStr; break;
            case "fuel_used":       row[col.label] = Math.round(totalFuel * 100) / 100; break;
            case "total_fuel":      row[col.label] = Math.round(totalFuel * 100) / 100; break;
            case "avg_consumption": row[col.label] = Math.round(avgCons * 100) / 100; break;
          }
        }
      }

      // ── Night Driving statistics ────────────────────────────────────────
      else if (reportType === "night_driving") {
        for (const col of statCols) {
          switch (col.key) {
            case "event_count":      row[col.label] = records.length; break;
            case "total_violations": row[col.label] = records.length; break;
          }
        }
      }

      // ── Overspeeding statistics ─────────────────────────────────────────
      else if (reportType === "overspeeding") {
        const spds = records.map((r) => parseFloat(r.moving_speed) || 0).filter((s) => s > 0);
        const maxS = spds.length > 0 ? Math.max(...spds) : 0;
        const avgS = spds.length > 0 ? spds.reduce((a, b) => a + b, 0) / spds.length : 0;
        for (const col of statCols) {
          switch (col.key) {
            case "event_count":    row[col.label] = records.length; break;
            case "max_speed_stat": row[col.label] = Math.round(maxS * 100) / 100; break;
            case "avg_speed_stat": row[col.label] = Math.round(avgS * 100) / 100; break;
          }
        }
      }

      // ── Geozone statistics ──────────────────────────────────────────────
      else if (reportType === "geozone") {
        const zones = new Set(records.map((r) => r.geozone_name).filter(Boolean));
        for (const col of statCols) {
          switch (col.key) {
            case "event_count":   row[col.label] = records.length; break;
            case "zones_visited": row[col.label] = zones.size; break;
          }
        }
      }

      // ── Parking / Idling statistics ─────────────────────────────────────
      else if (reportType === "PARKING" || reportType === "IDILING") {
        const durations = records.map((r) => r.duration_minutes || 0);
        const totalMins = durations.reduce((a: number, b: number) => a + b, 0);
        const avgMins = records.length > 0 ? totalMins / records.length : 0;
        for (const col of statCols) {
          switch (col.key) {
            case "event_count":         row[col.label] = records.length; break;
            case "total_duration_stat": row[col.label] = `${Math.floor(totalMins / 60)}h ${Math.round(totalMins % 60)}m`; break;
            case "avg_duration_stat":   row[col.label] = `${Math.floor(avgMins / 60)}h ${Math.round(avgMins % 60)}m`; break;
          }
        }
      }

      statsRows.push(row);
    }

    if (statsRows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(statsRows);
      ws["!cols"] = [{ wch: 30 }, ...statCols.map(() => ({ wch: 18 }))];
      XLSX.utils.book_append_sheet(wb, ws, "Statistics");
    }
  }

  // ── Sheet 3: Detail ─────────────────────────────────────────────────────
  if (sections.detail && detailCols.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allRows: any[] = [];
    let rowNum = 1;

    for (const [deviceName, records] of deviceMap) {
      if (!records.length) continue;

      for (const rec of records) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row: any = { "#": rowNum++, "Unit": deviceName };

        for (const col of detailCols) {
          switch (col.key) {
            // ── Trips / Fuel fields ─────────────────────────────────────────
            case "trip_date":      row[col.label] = rec.trip_date || ""; break;
            case "start_time":     row[col.label] = rec.start_time || ""; break;
            case "end_time":       row[col.label] = rec.end_time || ""; break;
            case "start_location": row[col.label] = rec.start_location || ""; break;
            case "end_location":   row[col.label] = rec.end_location || ""; break;
            case "mileage":
              row[col.label] = rec.mileage_covered && rec.mileage_covered !== "NoData" ? rec.mileage_covered : "";
              break;
            case "duration":
              if (rec.duration) {
                row[col.label] = rec.duration; // StateRecord has duration string
              } else {
                const sp2 = (rec.start_time || "").split(":");
                const ep2 = (rec.end_time || "").split(":");
                if (sp2.length >= 2 && ep2.length >= 2) {
                  const mins = (parseInt(ep2[0]) * 60 + parseInt(ep2[1])) - (parseInt(sp2[0]) * 60 + parseInt(sp2[1]));
                  row[col.label] = mins > 0 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : "";
                } else {
                  row[col.label] = "";
                }
              }
              break;
            case "start_fuel":
              row[col.label] = rec.start_fuel_level && rec.start_fuel_level !== "NoData" ? rec.start_fuel_level : "";
              break;
            case "end_fuel":
              row[col.label] = rec.end_fuel_level && rec.end_fuel_level !== "NoData" ? rec.end_fuel_level : "";
              break;
            case "fuel_diff": {
              const sf2 = parseFloat(rec.start_fuel_level) || 0;
              const ef2 = parseFloat(rec.end_fuel_level) || 0;
              row[col.label] = sf2 > 0 && ef2 > 0 ? Math.round((sf2 - ef2) * 100) / 100 : "";
              break;
            }
            case "driver":     row[col.label] = rec.driver_id || ""; break;
            case "start_gps":  row[col.label] = rec.start_gps_cords || rec.start_gps || ""; break;
            case "end_gps":    row[col.label] = rec.end_gps_cords || rec.end_gps || ""; break;

            // ── Night driving / Overspeeding / Geozone fields ──────────────
            case "date_logged":     row[col.label] = rec.date_logged || ""; break;
            case "location_point":  row[col.label] = rec.location_point || ""; break;
            case "time_violated":   row[col.label] = rec.time_violated || ""; break;
            case "event_triggered": row[col.label] = rec.event_triggered || ""; break;
            case "gps_coordinates": row[col.label] = rec.gps_coordinates || ""; break;
            case "moving_speed":    row[col.label] = rec.moving_speed || ""; break;
            case "geozone_name":    row[col.label] = rec.geozone_name || ""; break;
          }
        }
        allRows.push(row);
      }
    }

    if (allRows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(allRows);
      ws["!cols"] = [
        { wch: 5 },  // #
        { wch: 28 }, // Unit
        ...detailCols.map((c) =>
          ({ wch: c.key.includes("location") ? 35 : c.key.includes("gps") || c.key.includes("coordinates") ? 22 : 14 })
        ),
      ];
      XLSX.utils.book_append_sheet(wb, ws, detailSheetName);
    }
  }

  // ── Write file ──────────────────────────────────────────────────────────
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `${titleLabel}_Summary_Report_${startDate}_to_${endDate}.xlsx`);
}
