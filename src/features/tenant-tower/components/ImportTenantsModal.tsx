/**
 * ImportTenantsModal — Bulk import tenants from CSV/JSON.
 *
 * Flow: select file → upload → show result summary.
 * Includes a "Download Template" link for the blank CSV.
 */
import React, { useRef, useState } from "react";
import { importTenants, downloadImportTemplate, ApiError } from "../../../api";
import type { ImportTenantsResponse } from "../../../api";

interface ImportTenantsModalProps {
  open:      boolean;
  onClose:   () => void;
  onImported?: () => void;
}

export function ImportTenantsModal({ open, onClose, onImported }: ImportTenantsModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile]         = useState<File | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [result, setResult]     = useState<ImportTenantsResponse | null>(null);

  function reset() {
    setFile(null);
    setError(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await importTenants(file);
      setResult(res.data);
      onImported?.();
    } catch (err) {
      if (err instanceof ApiError) setError(err.apiMessage ?? err.message);
      else setError("Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleClose}>
      <div className="bg-white rounded-xl w-[480px] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E9EDEF]">
          <div>
            <div className="font-black text-[14px] text-[#111B21]">Import Tenants</div>
            <div className="text-[11px] text-[#667781] mt-0.5">Upload a CSV or JSON file with tenant data.</div>
          </div>
          <button onClick={handleClose} className="text-[11px] text-[#667781] bg-[#F0F2F5] border border-[#E9EDEF] rounded-lg px-3 py-1.5 cursor-pointer font-black hover:bg-[#E9EDEF]">Close</button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-4">
          {/* Template download */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-[#667781]">Need the format?</span>
            <button onClick={downloadImportTemplate} className="text-[var(--brand)] font-black underline cursor-pointer bg-transparent border-none">
              Download CSV template
            </button>
          </div>

          {/* File picker */}
          <div>
            <div className="text-[10px] font-black text-[#667781] mb-1.5">Select file</div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setResult(null);
                setError(null);
              }}
              className="w-full text-[12px] text-[#111B21] file:mr-3 file:h-8 file:px-4 file:rounded-full file:border-0 file:bg-[#F0F2F5] file:text-[11px] file:font-black file:text-[#667781] file:cursor-pointer hover:file:bg-[#E9EDEF]"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 rounded-lg bg-[#FEF2F2] text-[12px] text-[#EF4444] font-black">{error}</div>
          )}

          {/* Result summary */}
          {result && (
            <div className="border border-[#E9EDEF] rounded-xl p-4">
              <div className="font-black text-[13px] text-[#111B21] mb-2">Import Result</div>
              <div className="flex gap-6 text-[12px]">
                <div>
                  <span className="text-[#667781]">Imported: </span>
                  <span className="font-black text-[#25D366]">{result.imported}</span>
                </div>
                <div>
                  <span className="text-[#667781]">Skipped: </span>
                  <span className="font-black text-[#F97316]">{result.skipped}</span>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-2">
                  <div className="text-[11px] font-black text-[#EF4444] mb-1">Errors:</div>
                  <ul className="text-[11px] text-[#667781] list-disc pl-4">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#E9EDEF]">
          <button onClick={handleClose} className="h-8 px-4 rounded-full bg-[#F0F2F5] text-[11px] font-black text-[#667781] border-none cursor-pointer hover:bg-[#E9EDEF] transition-all">
            Cancel
          </button>
          <button
            disabled={!file || loading}
            onClick={handleUpload}
            className="h-8 px-4 rounded-full bg-[var(--brand)] text-white text-[11px] font-black border-none cursor-pointer hover:brightness-105 transition-all disabled:opacity-50"
          >
            {loading ? "Uploading..." : "Upload & Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
