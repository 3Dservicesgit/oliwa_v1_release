/**
 * GatewayHistoryModal
 *
 * Dark-themed modal showing status history timeline for mobile money gateways.
 * Uses getGatewayHistory() to fetch per-gateway status changes.
 */
import React, { useEffect, useState } from "react";
import { getGatewayHistory } from "../../../api";
import type { Gateway, GatewayHistoryEntry } from "../../../api";

interface GatewayHistoryModalProps {
  onClose: () => void;
  gateways: Gateway[];
  initialGateway?: string;
}

const STATUS_COLOR: Record<string, string> = {
  OK:          "bg-[#25D366] text-white",
  DEGRADED:    "bg-[#FB8C00] text-[#111]",
  DOWN:        "bg-[#D93025] text-white",
  MAINTENANCE: "bg-[#F4B400] text-[#111]",
};

function formatTs(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

export function GatewayHistoryModal({ onClose, gateways, initialGateway }: GatewayHistoryModalProps) {
  const [selected, setSelected] = useState(initialGateway ?? gateways[0]?.name ?? "");
  const [history, setHistory] = useState<GatewayHistoryEntry[]>([]);
  const [current, setCurrent] = useState<GatewayHistoryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getGatewayHistory(selected, { signal: controller.signal })
      .then((data) => {
        setCurrent(data.current_status);
        setHistory(data.history);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Failed to load gateway history");
        setLoading(false);
      });
    return () => controller.abort();
  }, [selected]);

  const ROW_GRID = "grid grid-cols-[0.8fr_1.6fr_1.2fr] gap-2 items-center min-w-[380px]";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/60 grid place-items-center p-0 xs:p-4 z-[500] overflow-hidden"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="
          flex flex-col overflow-hidden
          w-full h-[100dvh]
          xs:w-[min(720px,96vw)] xs:h-[min(600px,90dvh)]
          xs:rounded-xl
          bg-[#121417] border border-[#2B3137]
          shadow-[0_20px_60px_rgba(0,0,0,0.5)]
        "
      >

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="h-12 flex items-center justify-between px-3.5 bg-[#1A1E23] text-white shrink-0 gap-2.5">
          <span className="font-black text-[13px] truncate">Gateway Status History</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-[34px] h-[34px] rounded-lg border border-[#2B3137] text-[#9AA6B2] cursor-pointer hover:bg-[#2B3137] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* ── Gateway tabs ────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 px-3.5 py-2.5 shrink-0">
          {gateways.map((gw) => (
            <button
              key={gw.id}
              onClick={() => setSelected(gw.name)}
              className={`h-[28px] rounded-full px-3 text-[12px] font-bold cursor-pointer transition-all ${
                selected === gw.name
                  ? "bg-[var(--brand)] text-white"
                  : "bg-[#1A1E23] text-[#9AA6B2] border border-[#2B3137] hover:bg-[#2B3137]"
              }`}
            >
              {gw.name}
            </button>
          ))}
        </div>

        {/* ── Current status card ─────────────────────────────────────── */}
        {current && !loading && (
          <div className="mx-3.5 mb-2 px-3 py-2.5 rounded-xl bg-[#1A1E23] border border-[#2B3137] flex items-center gap-3 shrink-0">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold shrink-0 ${STATUS_COLOR[current.api_status] ?? "bg-[#667781] text-white"}`}>
              {current.api_status}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-white text-[12px] font-bold truncate">{current.telecom}</div>
              <div className="text-[11px] text-[#9AA6B2] truncate">{current.message}</div>
            </div>
            <div className="text-[11px] text-[#9AA6B2] shrink-0">{formatTs(current.updated_at)}</div>
          </div>
        )}

        {/* ── History table ───────────────────────────────────────────── */}
        <div className="flex flex-col min-h-0 flex-1 mx-3.5 mb-3.5 rounded-xl overflow-hidden bg-[#0F1216] border border-[#2B3137]">
          {/* Table head */}
          <div className={`${ROW_GRID} px-2.5 py-2.5 text-[#9AA6B2] font-black text-[12px] border-b border-[#20262D] shrink-0`}>
            <div>Status</div><div>Message</div><div>Timestamp</div>
          </div>

          {/* Scrollable body */}
          <div className="overflow-auto">
            {loading ? (
              <div className="px-3.5 py-8 text-center text-[12px] text-[#9AA6B2]">Loading history…</div>
            ) : error ? (
              <div className="px-3.5 py-8 text-center text-[12px] text-[#D93025]">{error}</div>
            ) : history.length === 0 ? (
              <div className="px-3.5 py-8 text-center text-[12px] text-[#9AA6B2]">No history entries found</div>
            ) : (
              history.map((entry) => (
                <div
                  key={entry.id}
                  className={`${ROW_GRID} px-2.5 py-2 border-b border-[#20262D] text-[12px] ${
                    entry.is_current_message ? "bg-[#0D1F15]" : ""
                  }`}
                >
                  <div>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-extrabold ${STATUS_COLOR[entry.api_status] ?? "bg-[#667781] text-white"}`}>
                      {entry.api_status}
                    </span>
                  </div>
                  <div className="text-[#D7DEE6] truncate">{entry.message}</div>
                  <div className="text-[#9AA6B2] text-[11px]">{formatTs(entry.created_at)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="px-3.5 py-2 text-[#9AA6B2] text-[11px] border-t border-[#2B3137] shrink-0">
          {loading ? "Fetching…" : `${history.length} entries • ${selected}`}
        </div>
      </div>
    </div>
  );
}
