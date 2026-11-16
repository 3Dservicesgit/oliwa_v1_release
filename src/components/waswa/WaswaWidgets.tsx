/**
 * WaswaWidgets — small pieces any module page can drop into its Waswa card.
 *
 *   <WaswaAskInput />     a real "Ask Waswa…" box: sends the question to the
 *                         shared drawer (replaces inputs that did nothing)
 *   <WaswaAskChips />     suggested questions, one click to ask
 *   <WaswaSampleTag />    marks illustrative insight content. Waswa does not
 *                         yet generate live insights for most modules, and an
 *                         operator must be able to tell a sample from a
 *                         finding before acting on it.
 *   <WaswaStatusPill />   live ON/OFF state, click to open Waswa
 */
import React, { useState } from "react";
import { useWaswa } from "./WaswaContext";
import { useAssistantName } from "../../branding/branding";

type Tone = "light" | "dark";

export function WaswaAskInput({
  placeholder,
  tone = "light",
  className = "",
}: {
  placeholder?: string;
  tone?: Tone;
  className?: string;
}) {
  const { open, on } = useWaswa();
  const name = useAssistantName();
  const [value, setValue] = useState("");
  const submit = () => {
    const text = value.trim();
    if (!text) return;
    open(text);
    setValue("");
  };
  const dark = tone === "dark";
  return (
    <div className={`flex gap-1.5 ${className}`}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={on ? (placeholder ?? `Ask ${name}…`) : `${name} is off — open ${name} to switch it on`}
        aria-label={`Ask ${name}`}
        className={`flex-1 min-w-0 h-8 rounded-lg px-3 text-[11px] outline-none ${
          dark
            ? "bg-white/15 border-none text-white placeholder:text-white/60"
            : "border border-[#E9EDEF] text-[#111B21] placeholder:text-[#667781] focus:border-[var(--brand)]"
        }`}
      />
      <button
        onClick={submit}
        disabled={!value.trim()}
        aria-label={`Send to ${name}`}
        className={`w-8 h-8 shrink-0 rounded-lg border-none font-black text-[12px] cursor-pointer disabled:opacity-50 disabled:cursor-default ${
          dark ? "bg-[var(--accent)] text-[var(--on-accent)]" : "bg-[var(--accent)] text-[var(--on-accent)]"
        }`}
      >
        ➤
      </button>
    </div>
  );
}

export function WaswaAskChips({
  prompts,
  tone = "light",
  label,
}: {
  prompts: string[];
  tone?: Tone;
  label?: string;
}) {
  const { open } = useWaswa();
  const name = useAssistantName();
  const shown = label ?? `Ask ${name}`;
  const dark = tone === "dark";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown && (
        <span className={`text-[10px] font-extrabold uppercase tracking-wide ${dark ? "text-white/70" : "text-[#667781]"}`}>
          {shown}
        </span>
      )}
      {prompts.map((p) => (
        <button
          key={p}
          onClick={() => open(p)}
          className={`h-7 px-2.5 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${
            dark
              ? "bg-white/15 border border-white/20 text-white hover:bg-white/25"
              : "bg-white border border-[var(--brand)]/30 text-[var(--brand)] hover:bg-[var(--brand)]/5"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

export function WaswaSampleTag({ tone = "light" }: { tone?: Tone }) {
  const name = useAssistantName();
  return (
    <span
      title={`Illustrative content. Live ${name} insights for this screen are not connected yet — ask ${name} directly for answers from approved company knowledge.`}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold whitespace-nowrap ${
        tone === "dark" ? "bg-white/20 text-white" : "bg-[#FEF3C7] text-[#92400E]"
      }`}
    >
      Sample data
    </span>
  );
}

export function WaswaStatusPill({ className = "" }: { className?: string }) {
  const { on, open } = useWaswa();
  const name = useAssistantName();
  return (
    <button
      onClick={() => open()}
      title={`Open ${name}`}
      className={`shrink-0 whitespace-nowrap border rounded-full px-2.5 py-1 text-[11px] font-medium cursor-pointer ${
        on
          ? "bg-[var(--brand-soft)] border-[var(--brand)]/20 text-[var(--brand-dark)]"
          : "bg-[#F0F2F5] border-[#E9EDEF] text-[#667781]"
      } ${className}`}
    >
      {name} Co-Pilot: {on ? "ON" : "OFF"}
    </button>
  );
}
