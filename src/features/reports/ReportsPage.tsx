/**
 * ReportsPage — Two-panel report generation & history for customers.
 *
 * LEFT:  Generate Report form (type, devices, date range, format)
 * RIGHT: Previous Reports table with action buttons (Download, Details, Delete)
 *
 * SECURITY — Customer isolation:
 *   • ownerUid is ALWAYS the logged-in user's accountUid from AuthContext
 *     (or the _nvxs_account_uid cookie set at login). Never from URL or input.
 *   • Previous Reports: fetched via GET /reports/{ownerUid}/trips which
 *     filters WHERE report_caller = ownerUid — each customer only sees
 *     their own reports.
 *   • Generate Report: sends origin_user = ownerUid so the new report is
 *     tagged to the logged-in customer only.
 *   • Delete: backend verifies report_caller matches ownerUid before deleting.
 *   • Device list: fetched for ownerUid so customers only see their own
 *     devices and can only generate reports for those devices.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getCookie } from "../../utils/cookies";
import { getClientDevices } from "../../api/services/clients.service";
import {
  generateReport,
  getAllPreviousReports,
  getReportDownloadUrl,
  deleteReport,
  getAvailableReportTypes,
  formatDateForApi,
} from "../../api/services/reports.service";
import {
  REPORT_TYPE_LABELS,
  REPORT_TYPE_ICONS,
} from "../../api/types/reports.types";
import type {
  ReportType,
  ReportFormat,
  PreviousReport,
  AvailableReportType,
} from "../../api/types";
import type { ClientDevice } from "../../api/types";

// ── Fallback report types (used if backend endpoint is unavailable) ────────

const FALLBACK_REPORT_TYPES: AvailableReportType[] = [
  { key: "trips",         label: "Trips",           icon: "🛣️", category: "movement" },
  { key: "overspeeding",  label: "Overspeeding",    icon: "⚡",  category: "safety" },
  { key: "fuel",          label: "Fuel Level",       icon: "⛽",  category: "maintenance" },
  { key: "geozone",       label: "Geofence Breach",  icon: "📍",  category: "safety" },
  { key: "night_driving", label: "Night Driving",    icon: "🌙",  category: "safety" },
  { key: "IDILING",       label: "Idling",           icon: "⏸️",  category: "state" },
  { key: "PARKING",       label: "Parking",          icon: "🅿️",  category: "state" },
];

// ── Date helpers ────────────────────────────────────────────────────────────

function toInputDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function fromInputDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg border text-[13px] font-black flex items-center gap-3 ${
      type === "success"
        ? "bg-[#25D366]/10 border-[#25D366]/30 text-[#128C7E]"
        : "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]"
    }`}>
      <span>{message}</span>
      <button onClick={onClose} className="text-current opacity-60 hover:opacity-100 cursor-pointer border-none bg-transparent text-[14px]">✕</button>
    </div>
  );
}

// ── Confirm Dialog ──────────────────────────────────────────────────────────

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  isDestructive,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl border border-[#E9EDEF] w-[380px] max-w-[90vw] p-5">
        <h3 className="font-black text-[15px] text-[#111B21] mb-2">{title}</h3>
        <p className="text-[13px] text-[#667781] mb-5">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="h-9 px-4 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[12px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`h-9 px-4 rounded-lg border text-[12px] font-black cursor-pointer transition-all ${
              isDestructive
                ? "bg-[#EF4444] border-[#EF4444] text-white hover:bg-[#DC2626]"
                : "bg-[#128C7E] border-[#128C7E] text-white hover:bg-[#0E7A6E]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Report Details Drawer ──────────────────────────────────────────────────

function ReportDetailsDrawer({
  report,
  onClose,
}: {
  report: PreviousReport;
  onClose: () => void;
}) {
  const isCompleted = report.file_progress === "completed";
  const isFailed = report.file_progress === "failed" || report.file_progress === "no-data";
  const typeLower = report.report_type.toLowerCase() as ReportType;
  const icon = REPORT_TYPE_ICONS[typeLower] ?? "📄";
  const label = REPORT_TYPE_LABELS[typeLower] ?? report.report_type;

  return (
    <div className="fixed inset-0 z-[150] flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-[400px] max-w-[90vw] bg-white h-full shadow-2xl border-l border-[#E9EDEF] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E9EDEF] bg-[#F8FAFC] flex items-center justify-between">
          <h3 className="font-black text-[15px] text-[#111B21]">Report Details</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white border border-[#E9EDEF] text-[#667781] text-[14px] cursor-pointer hover:bg-[#F0F2F5] transition-all flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Type & Status banner */}
          <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E9EDEF]">
            <span className="text-[28px]">{icon}</span>
            <div>
              <div className="font-black text-[14px] text-[#111B21]">{label}</div>
              <span
                className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${
                  isCompleted
                    ? "bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366]"
                    : isFailed
                    ? "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]"
                    : "bg-[#F97316]/10 border-[#F97316]/30 text-[#F97316]"
                }`}
              >
                {report.file_progress}
              </span>
            </div>
          </div>

          {/* Detail rows */}
          <div className="flex flex-col gap-3">
            <DetailRow label="Report Type" value={label} />
            <DetailRow label="Status" value={report.file_progress} />
            <DetailRow label="Date Generated" value={report.file_datestamp || "—"} />
            <DetailRow label="Request ID" value={report.file_request_uid} mono />
            <DetailRow
              label="File"
              value={
                isCompleted && report.file_link
                  ? report.file_link.split("/").pop() || report.file_link
                  : "—"
              }
            />
          </div>

          {/* Download button */}
          {isCompleted && report.file_link && (
            <a
              href={getReportDownloadUrl(report.file_link)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 w-full h-10 rounded-lg bg-[#128C7E] text-white text-[13px] font-black flex items-center justify-center gap-2 no-underline hover:bg-[#0E7A6E] transition-all"
            >
              &#11015; Download Report
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-black text-[#667781] uppercase tracking-wider">{label}</span>
      <span className={`text-[13px] text-[#111B21] ${mono ? "font-mono text-[11px] bg-[#F8FAFC] px-2 py-1 rounded border border-[#E9EDEF] break-all" : ""}`}>
        {value}
      </span>
    </div>
  );
}

// ── Generate Report Form (Left Panel) ───────────────────────────────────────

function GenerateForm({
  ownerUid,
  devices,
  devicesLoading,
  reportTypes,
  onGenerated,
  onToast,
}: {
  ownerUid: string;
  devices: ClientDevice[];
  devicesLoading: boolean;
  reportTypes: AvailableReportType[];
  onGenerated: () => void;
  onToast: (msg: string, type: "success" | "error") => void;
}) {
  const [reportType, setReportType] = useState<ReportType>(
    (reportTypes[0]?.key || "trips") as ReportType,
  );
  const [format, setFormat] = useState<ReportFormat>("pdf");
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toInputDate(d);
  });
  const [endDate, setEndDate] = useState(() => toInputDate(new Date()));
  const [generating, setGenerating] = useState(false);
  const [searchDevice, setSearchDevice] = useState("");

  const toggleDevice = (imei: string) => {
    setSelectedDevices((prev) =>
      prev.includes(imei) ? prev.filter((d) => d !== imei) : [...prev, imei],
    );
  };

  const selectAll = () => {
    if (selectedDevices.length === filteredDevices.length) {
      setSelectedDevices([]);
    } else {
      setSelectedDevices(filteredDevices.map((d) => d.device_imei));
    }
  };

  const filteredDevices = devices.filter((d) => {
    if (!searchDevice.trim()) return true;
    const q = searchDevice.toLowerCase();
    return (
      d.device_name?.toLowerCase().includes(q) ||
      d.device_imei?.toLowerCase().includes(q)
    );
  });

  // Get label for current type from the dynamic list
  const currentTypeLabel =
    reportTypes.find((t) => t.key === reportType)?.label ||
    REPORT_TYPE_LABELS[reportType] ||
    reportType;

  const handleGenerate = async () => {
    if (selectedDevices.length === 0) {
      onToast("Please select at least one device.", "error");
      return;
    }
    if (!startDate || !endDate) {
      onToast("Please select a date range.", "error");
      return;
    }

    setGenerating(true);
    try {
      await generateReport(reportType, format, {
        report_devices: selectedDevices,
        start_date: formatDateForApi(fromInputDate(startDate)),
        end_date: formatDateForApi(fromInputDate(endDate)),
        origin_user: ownerUid,
      });
      onToast(
        `${currentTypeLabel} report is processing. Check Previous Reports when ready.`,
        "success",
      );
      onGenerated();
    } catch (e) {
      onToast(
        e instanceof Error ? e.message : "Failed to generate report.",
        "error",
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Report Type — dynamically loaded */}
      <div>
        <label className="block text-[12px] font-black text-[#111B21] mb-2">Report Type</label>
        <div className="grid grid-cols-2 gap-1.5">
          {reportTypes.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setReportType(t.key as ReportType)}
              className={`flex items-center gap-2 h-9 px-3 rounded-lg text-[12px] font-black border cursor-pointer transition-all text-left ${
                reportType === t.key
                  ? "bg-[#128C7E]/10 border-[#128C7E]/30 text-[#128C7E]"
                  : "bg-white border-[#E9EDEF] text-[#667781] hover:border-[#128C7E]/40"
              }`}
            >
              <span className="text-[14px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[12px] font-black text-[#111B21] mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full h-10 rounded-lg border border-[#E9EDEF] px-3 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E]"
          />
        </div>
        <div>
          <label className="block text-[12px] font-black text-[#111B21] mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full h-10 rounded-lg border border-[#E9EDEF] px-3 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E]"
          />
        </div>
      </div>

      {/* Device Selection */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[12px] font-black text-[#111B21]">
            Devices ({selectedDevices.length} selected)
          </label>
          <button
            type="button"
            onClick={selectAll}
            className="text-[11px] font-black text-[#128C7E] cursor-pointer border-none bg-transparent"
          >
            {selectedDevices.length === filteredDevices.length && filteredDevices.length > 0
              ? "Deselect All"
              : "Select All"}
          </button>
        </div>

        <div className="relative mb-2">
          <input
            value={searchDevice}
            onChange={(e) => setSearchDevice(e.target.value)}
            placeholder="Search devices..."
            className="w-full h-9 rounded-lg border border-[#E9EDEF] px-3 pr-8 text-[12px] text-[#111B21] placeholder:text-[#667781] outline-none focus:border-[#128C7E]"
          />
          {searchDevice && (
            <button
              onClick={() => setSearchDevice("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#667781] text-[11px] border-none bg-transparent cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="border border-[#E9EDEF] rounded-lg max-h-[180px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {devicesLoading ? (
            <div className="flex items-center justify-center py-6 text-[12px] text-[#667781]">
              <div className="w-5 h-5 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin mr-2" />
              Loading devices...
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-[#667781]">
              {devices.length === 0 ? "No devices found for your account." : "No matching devices."}
            </div>
          ) : (
            filteredDevices.map((d) => {
              const checked = selectedDevices.includes(d.device_imei);
              return (
                <label
                  key={d.device_imei}
                  className={`flex items-center gap-2.5 px-3 py-2 border-b border-[#E9EDEF] last:border-0 cursor-pointer hover:bg-[#F0F2F5] transition-colors ${
                    checked ? "bg-[#128C7E]/5" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDevice(d.device_imei)}
                    className="accent-[#128C7E] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-black text-[#111B21] truncate">
                      {d.device_name || d.device_imei}
                    </div>
                    <div className="text-[10px] text-[#667781]">{d.device_imei}</div>
                  </div>
                </label>
              );
            })
          )}
        </div>
      </div>

      {/* Export Format */}
      <div>
        <label className="block text-[12px] font-black text-[#111B21] mb-2">Export Format</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFormat("pdf")}
            className={`flex-1 h-10 rounded-lg text-[13px] font-black border cursor-pointer transition-all ${
              format === "pdf"
                ? "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]"
                : "bg-white border-[#E9EDEF] text-[#667781]"
            }`}
          >
            PDF
          </button>
          <button
            type="button"
            onClick={() => setFormat("excel")}
            className={`flex-1 h-10 rounded-lg text-[13px] font-black border cursor-pointer transition-all ${
              format === "excel"
                ? "bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366]"
                : "bg-white border-[#E9EDEF] text-[#667781]"
            }`}
          >
            Excel
          </button>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={generating || selectedDevices.length === 0}
        className="w-full h-11 rounded-lg bg-[#25D366] text-[#075E54] text-[13px] font-black border-none cursor-pointer hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-[#075E54] border-t-transparent rounded-full animate-spin" />
            Generating...
          </span>
        ) : (
          `Generate ${currentTypeLabel} Report`
        )}
      </button>
    </div>
  );
}

// ── Report History Table (Right Panel) ──────────────────────────────────────

function ReportHistory({
  reports,
  loading,
  ownerUid,
  onRefresh,
  onDeleted,
  onToast,
}: {
  reports: PreviousReport[];
  loading: boolean;
  ownerUid: string;
  onRefresh: () => void;
  onDeleted: () => void;
  onToast: (msg: string, type: "success" | "error") => void;
}) {
  const [filterType, setFilterType] = useState<string>("all");
  const [detailReport, setDetailReport] = useState<PreviousReport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PreviousReport | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = filterType === "all"
    ? reports
    : reports.filter((r) => r.report_type.toUpperCase() === filterType.toUpperCase());

  const uniqueTypes = Array.from(new Set(reports.map((r) => r.report_type.toUpperCase())));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteReport(deleteTarget.file_request_uid, ownerUid);
      onToast("Report deleted successfully.", "success");
      setDeleteTarget(null);
      onDeleted();
    } catch (e) {
      onToast(
        e instanceof Error ? e.message : "Failed to delete report.",
        "error",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Details drawer */}
      {detailReport && (
        <ReportDetailsDrawer report={detailReport} onClose={() => setDetailReport(null)} />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Report"
          message={`Are you sure you want to delete this ${deleteTarget.report_type} report from ${deleteTarget.file_datestamp || "unknown date"}? This action cannot be undone.`}
          confirmLabel={deleting ? "Deleting..." : "Delete Report"}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isDestructive
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-black text-[14px] text-[#111B21]">Previous Reports</h3>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="h-8 px-3 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[12px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] disabled:opacity-50 transition-all flex items-center gap-1.5"
        >
          <span className={loading ? "animate-spin" : ""}>&#8635;</span>
          Refresh
        </button>
      </div>

      {/* Filter chips */}
      {uniqueTypes.length > 1 && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`h-7 px-3 rounded-full text-[11px] font-black border cursor-pointer transition-all ${
              filterType === "all"
                ? "bg-[#128C7E]/10 border-[#128C7E]/30 text-[#128C7E]"
                : "bg-white border-[#E9EDEF] text-[#667781]"
            }`}
          >
            All ({reports.length})
          </button>
          {uniqueTypes.map((t) => {
            const count = reports.filter((r) => r.report_type.toUpperCase() === t).length;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setFilterType(t)}
                className={`h-7 px-3 rounded-full text-[11px] font-black border cursor-pointer transition-all ${
                  filterType === t
                    ? "bg-[#128C7E]/10 border-[#128C7E]/30 text-[#128C7E]"
                    : "bg-white border-[#E9EDEF] text-[#667781]"
                }`}
              >
                {t} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
            <span className="text-[12px] text-[#667781]">Loading reports...</span>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-[28px] mb-2">&#128196;</div>
            <p className="text-[13px] font-black text-[#111B21] mb-1">No Reports Yet</p>
            <p className="text-[12px] text-[#667781]">
              Generate your first report using the form on the left.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border border-[#E9EDEF] rounded-xl overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E9EDEF]">
                <th className="text-left px-3 py-2.5 font-black text-[#667781] text-[11px]">Type</th>
                <th className="text-left px-3 py-2.5 font-black text-[#667781] text-[11px]">Date</th>
                <th className="text-left px-3 py-2.5 font-black text-[#667781] text-[11px]">Status</th>
                <th className="text-center px-3 py-2.5 font-black text-[#667781] text-[11px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const isCompleted = r.file_progress === "completed";
                const isFailed = r.file_progress === "failed" || r.file_progress === "no-data";
                const typeLower = r.report_type.toLowerCase() as ReportType;
                const icon = REPORT_TYPE_ICONS[typeLower] ?? "📄";

                return (
                  <tr
                    key={r.file_request_uid || i}
                    className="border-b border-[#E9EDEF] last:border-0 hover:bg-[#F8FAFC]"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px]">{icon}</span>
                        <span className="font-black text-[#111B21]">{r.report_type}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[#667781]">
                      {r.file_datestamp || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black border ${
                          isCompleted
                            ? "bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366]"
                            : isFailed
                            ? "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]"
                            : "bg-[#F97316]/10 border-[#F97316]/30 text-[#F97316]"
                        }`}
                      >
                        {r.file_progress || "processing"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        {/* Download */}
                        {isCompleted && r.file_link ? (
                          <a
                            href={getReportDownloadUrl(r.file_link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Download report"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#128C7E]/10 border border-[#128C7E]/30 text-[#128C7E] text-[12px] no-underline cursor-pointer hover:bg-[#128C7E]/20 transition-all"
                          >
                            &#11015;
                          </a>
                        ) : (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[#C4CCD5] text-[12px]">
                            &#11015;
                          </span>
                        )}

                        {/* View Details */}
                        <button
                          onClick={() => setDetailReport(r)}
                          title="View details"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/30 text-[#3B82F6] text-[12px] cursor-pointer hover:bg-[#3B82F6]/20 transition-all"
                        >
                          &#128269;
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteTarget(r)}
                          title="Delete report"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-[12px] cursor-pointer hover:bg-[#EF4444]/20 transition-all"
                        >
                          &#128465;
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export function ReportsPage() {
  const { state: authState } = useAuth();
  const [devices, setDevices] = useState<ClientDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [reports, setReports] = useState<PreviousReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportTypes, setReportTypes] = useState<AvailableReportType[]>(FALLBACK_REPORT_TYPES);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SECURITY: ownerUid is ALWAYS the logged-in customer's own account UID.
  const ownerUid =
    authState.accountUid || getCookie("_nvxs_account_uid") || "";
  const ownerUidRef = useRef(ownerUid);
  if (ownerUid) ownerUidRef.current = ownerUid;

  // ── Fetch available report types from backend ──────────────────────────
  const typesFetchedRef = useRef(false);
  useEffect(() => {
    if (typesFetchedRef.current) return;
    typesFetchedRef.current = true;

    (async () => {
      try {
        const res = await getAvailableReportTypes();
        if (Array.isArray(res?.data) && res.data.length > 0) {
          setReportTypes(res.data);
        }
      } catch {
        // Backend endpoint not available yet — keep fallback types
      }
    })();
  }, []);

  // ── Fetch devices for this customer (runs once) ────────────────────────
  const devicesFetchedRef = useRef(false);
  useEffect(() => {
    const uid = ownerUidRef.current;
    if (!uid || devicesFetchedRef.current) return;
    devicesFetchedRef.current = true;

    (async () => {
      setDevicesLoading(true);
      try {
        const res = await getClientDevices(uid);
        setDevices(res.data ?? []);
      } catch {
        setDevices([]);
      } finally {
        setDevicesLoading(false);
      }
    })();
  }, [ownerUid]);

  // ── Fetch previous reports ──────────────────────────────────────────────
  const reportsFetchedRef = useRef(false);
  const fetchReports = useCallback(async () => {
    const uid = ownerUidRef.current;
    if (!uid) return;
    setReportsLoading(true);
    try {
      const data = await getAllPreviousReports(uid);
      setReports(data);
    } catch {
      // Don't clear existing reports on fetch failure — keep stale data
      // so the list doesn't flicker to "No Reports" on transient errors.
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ownerUidRef.current || reportsFetchedRef.current) return;
    reportsFetchedRef.current = true;
    fetchReports();
  }, [ownerUid, fetchReports]);

  // ── Auto-refresh every 30s if any report is actively processing ────────
  useEffect(() => {
    const hasProcessing = reports.some(
      (r) => r.file_progress !== "completed" && r.file_progress !== "failed",
    );
    if (hasProcessing) {
      refreshTimer.current = setTimeout(() => {
        fetchReports();
      }, 30000);
    }
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [reports, fetchReports]);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      <main className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-3 p-3">

          {/* Header */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-3">
                <span className="font-black text-[18px] text-[#111B21] tracking-wide">REPORTS</span>
                <span className="text-[13px] text-[#667781]">
                  — Generate &amp; download device reports
                </span>
              </div>
              <div className="text-[11px] text-[#667781]">
                {reports.length} total reports
              </div>
            </div>
          </div>

          {/* Two-panel layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-3 min-h-[500px]">

            {/* LEFT: Generate Form */}
            <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-[#E9EDEF] bg-[#128C7E]/5">
                <h3 className="font-black text-[14px] text-[#128C7E]">Generate Report</h3>
                <p className="text-[11px] text-[#667781] mt-0.5">
                  Select type, devices, and date range to generate a report.
                </p>
              </div>
              <div className="flex-1 p-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <GenerateForm
                  ownerUid={ownerUid}
                  devices={devices}
                  devicesLoading={devicesLoading}
                  reportTypes={reportTypes}
                  onGenerated={fetchReports}
                  onToast={showToast}
                />
              </div>
            </div>

            {/* RIGHT: Previous Reports */}
            <div className="bg-white border border-[#E9EDEF] rounded-xl p-4 flex flex-col min-h-0">
              <ReportHistory
                reports={reports}
                loading={reportsLoading}
                ownerUid={ownerUid}
                onRefresh={fetchReports}
                onDeleted={fetchReports}
                onToast={showToast}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
