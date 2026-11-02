/**
 * records.tsx — the pieces the Drivers and FuelMath pages share: field
 * styles, a side panel, a dialog that asks for a reason, notice banners, and
 * an image that is only served to signed-in users.
 *
 * Styled like the Team page (features/team), which these pages sit beside.
 */
import React, { useEffect, useState } from "react";
import { errText } from "./recordUtils";

export const INPUT =
  "w-full h-9 px-3 rounded-lg border border-[#E9EDEF] text-[13px] text-[#111B21] " +
  "placeholder:text-[#8696A0] outline-none focus:border-[#128C7E] bg-white";
/** INPUT for a select or date beside other controls: as wide as it needs. */
export const INPUT_INLINE = INPUT.replace("w-full ", "") + " w-auto shrink-0";
export const LABEL = "block text-[11px] font-extrabold text-[#667781] mb-1";
export const BTN =
  "h-9 px-4 rounded-lg border border-[#E9EDEF] bg-white text-[12px] font-extrabold " +
  "text-[#111B21] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
export const BTN_PRIMARY =
  "h-9 px-4 rounded-lg border-0 bg-[#128C7E] text-white text-[12px] font-extrabold " +
  "cursor-pointer hover:bg-[#0D7466] disabled:opacity-50 disabled:cursor-not-allowed";
export const BTN_DANGER =
  "h-9 px-4 rounded-lg border border-[#FFD6D6] bg-white text-[12px] font-extrabold " +
  "text-[#B00020] cursor-pointer disabled:opacity-50";
export const CARD = "bg-white border border-[#E9EDEF] rounded-xl";

export type Tone = "green" | "amber" | "red" | "grey" | "teal" | "blue";

const TONES: Record<Tone, string> = {
  green: "bg-[#DCFCE7] text-[#166534]",
  amber: "bg-[#FEF3C7] text-[#92400E]",
  red: "bg-[#FEF2F2] text-[#B91C1C]",
  grey: "bg-[#F0F2F5] text-[#667781]",
  teal: "bg-[#128C7E]/10 text-[#075E54]",
  blue: "bg-[#34B7F1]/10 text-[#0B6E99]",
};

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-extrabold whitespace-nowrap ${TONES[tone]}`}>{children}</span>;
}

export function Notice({ text, onClose }: { text: string; onClose?: () => void }) {
  return (
    <div role="status" className="text-[12px] text-[#075E54] bg-[#E9F7F4] border border-[#C2E8E1] rounded-lg px-3 py-2 flex items-start justify-between gap-3">
      <span>{text}</span>
      {onClose && <button type="button" aria-label="Dismiss" onClick={onClose} className="bg-transparent border-0 cursor-pointer text-[#075E54]">✕</button>}
    </div>
  );
}

export function ErrorBanner({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="text-[12px] text-[#B00020] bg-[#FFF5F5] border border-[#FFD6D6] rounded-lg px-3 py-2 flex items-center justify-between gap-3">
      <span>{text}</span>
      {onRetry && <button type="button" onClick={onRetry} className="text-[12px] font-extrabold underline bg-transparent border-0 cursor-pointer text-[#B00020]">Try again</button>}
    </div>
  );
}

/** A panel sliding in from the right, as the Team page's "Add a user". */
export function SidePanel({ title, subtitle, onClose, footer, children, width = 480 }: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    // Above the top bar (z-[100]) and its menus, so the panel's header shows.
    <div className="fixed inset-0 bg-black/35 z-[300] flex justify-end" onClick={onClose}>
      <div role="dialog" aria-label={title} style={{ width }} className="max-w-full h-full bg-white flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#E9EDEF]">
          <div className="min-w-0">
            <div className="font-black text-[15px] text-[#111B21] truncate">{title}</div>
            {subtitle && <div className="text-[12px] text-[#667781]">{subtitle}</div>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="w-8 h-8 shrink-0 rounded-lg border border-[#E9EDEF] bg-white cursor-pointer">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#E9EDEF]">{footer}</div>}
      </div>
    </div>
  );
}

export interface PromptOptions {
  title: string;
  body: string;
  /** Asks for a reason or note when set. */
  label?: string;
  required?: boolean;
  /** Radio choices shown above the text (e.g. review outcomes). */
  choices?: { value: string; label: string; hint?: string }[];
  action: string;
  danger?: boolean;
  run: (text: string, choice: string) => Promise<void>;
}

/** Confirms an action, optionally asking for a reason; shows the server's
 *  error if it fails and stays open. */
export function PromptDialog({ prompt, onClose }: { prompt: PromptOptions; onClose: () => void }) {
  const [text, setText] = useState("");
  const [choice, setChoice] = useState(prompt.choices?.[0]?.value ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    if (prompt.label && prompt.required && text.trim().length < 3) {
      setError(`Enter the ${prompt.label.toLowerCase()} (at least 3 characters).`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await prompt.run(text.trim(), choice);
      onClose();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[310] grid place-items-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div role="dialog" aria-label={prompt.title} className="relative bg-white rounded-xl p-5 w-[440px] max-w-[calc(100vw-24px)] shadow-xl flex flex-col gap-3">
        <div className="font-black text-[15px] text-[#111B21]">{prompt.title}</div>
        <div className="text-[13px] text-[#667781]">{prompt.body}</div>
        {prompt.choices && (
          <div className="flex flex-col gap-2" role="radiogroup" aria-label={prompt.title}>
            {prompt.choices.map((c) => (
              <label key={c.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${choice === c.value ? "border-[#128C7E] bg-[#E9F7F4]" : "border-[#E9EDEF]"}`}>
                <input type="radio" checked={choice === c.value} onChange={() => setChoice(c.value)} className="mt-0.5" />
                <span>
                  <span className="block text-[13px] font-extrabold text-[#111B21]">{c.label}</span>
                  {c.hint && <span className="block text-[11px] text-[#667781]">{c.hint}</span>}
                </span>
              </label>
            ))}
          </div>
        )}
        {prompt.label && (
          <div>
            <label className={LABEL} htmlFor="prompt-text">{prompt.label}{prompt.required ? " *" : ""}</label>
            <textarea id="prompt-text" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)}
              className={`${INPUT} h-auto py-2 resize-y`} />
          </div>
        )}
        {error && <ErrorBanner text={error} />}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BTN}>Cancel</button>
          <button type="button" onClick={go} disabled={busy}
            className={`h-9 px-4 rounded-lg border-0 text-white text-[12px] font-extrabold cursor-pointer disabled:opacity-50 ${prompt.danger ? "bg-[#B00020]" : "bg-[#128C7E]"}`}>
            {busy ? "Working…" : prompt.action}
          </button>
        </div>
      </div>
    </div>
  );
}

/** An image the server only serves to signed-in users (driver photo, fuel
 *  receipt), loaded through `load` with the sign-in header. */
export function AuthImage({ load, alt, className, fallback }: {
  load: () => Promise<string>;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  // What was loaded, and for which loader: a new loader shows the
  // placeholder until its own image arrives.
  const [got, setGot] = useState<{ load: () => Promise<string>; url?: string; failed?: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    load()
      .then((u) => { made = u; if (alive) setGot({ load, url: u }); else URL.revokeObjectURL(u); })
      .catch(() => { if (alive) setGot({ load, failed: true }); });
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [load]);
  const current = got?.load === load ? got : null;
  const url = current?.url ?? null;
  const failed = !!current?.failed;
  if (failed) return <>{fallback ?? <div className="text-[12px] text-[#667781]">The photo could not be loaded.</div>}</>;
  if (!url) return <div className={`${className ?? ""} bg-[#F0F2F5] animate-pulse`} aria-label="Loading photo" />;
  return <img src={url} alt={alt} className={className} />;
}
