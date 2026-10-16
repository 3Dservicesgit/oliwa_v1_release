/**
 * ui.tsx — building blocks for the dashboard: flat blocks (no card boxes),
 * muted subtitles, tinted chips, part-to-whole bars with a 2 px gap, and the
 * live donut. Every status colour comes with a label and a count (KPI spec,
 * mock-up page 40).
 */
import React, { useEffect, useState } from "react";
import { C } from "./style";
import { agoLabel } from "./kpis";



/** A titled block inside a dashboard section — flat, no card box. */
export function Panel({ title, subtitle, action, children, className = "" }: {
  title?: string; subtitle?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      {(title || action) && (
        <div className="flex items-start gap-2 mb-3">
          <div className="min-w-0 flex-1">
            {title && <h3 className="text-[15px] font-semibold text-[#111B21] leading-tight">{title}</h3>}
            {subtitle != null && <div className="mt-0.5 text-[13px] text-[#667781]">{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatTile({ label, value, sub, colour }: { label: string; value: React.ReactNode; sub?: React.ReactNode; colour?: string }) {
  return (
    <div className="min-w-0 border-l-[3px] border-[#E9EDEF] pl-3">
      <div className="text-[12.5px] text-[#667781]">{label}</div>
      <div className="mt-1.5 text-[22px] font-semibold tabular-nums" style={{ color: colour ?? C.ink }}>{value}</div>
      {sub != null && <div className="mt-1 text-[12px] text-[#667781]">{sub}</div>}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-3 rounded-md bg-[#F0F2F5] animate-pulse" style={{ width: `${100 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function Unavailable({ children }: { children: React.ReactNode }) {
  return <p className="text-[13.5px] text-[#667781]">{children}</p>;
}

export function Chip({ text, ink, tint, dot }: { text: string; ink: string; tint: string; dot?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium max-w-full" style={{ color: ink, background: tint }}>
      {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ink }} />}
      <span className="truncate">{text}</span>
    </span>
  );
}

export function PrimaryButton({ children, onClick, urgent = false }: { children: React.ReactNode; onClick?: () => void; urgent?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-[14px] px-3.5 py-2 text-[14px] font-semibold transition ${urgent ? "bg-[#E53935] text-white hover:bg-[#C62828]" : "bg-[#25D366] text-[#053B33] hover:bg-[#1EBE5D]"}`}>
      {children}
    </button>
  );
}

// ── Bars ─────────────────────────────────────────────────────────────────────

/** One horizontal part-to-whole bar: a 2 px gap between spans, outer ends rounded. */
export function SplitBar({ parts, height = 10 }: { parts: { n: number; colour: string; label?: string }[]; height?: number }) {
  const live = parts.filter((p) => p.n > 0);
  if (!live.length) return <div className="rounded-full bg-[#F0F2F5]" style={{ height }} />;
  return (
    <div className="flex gap-[2px]" style={{ height }}>
      {live.map((p, i) => (
        <div key={i} title={p.label ? `${p.label}: ${p.n}` : String(p.n)}
          className={`${i === 0 ? "rounded-l-full" : ""} ${i === live.length - 1 ? "rounded-r-full" : ""}`}
          style={{ flexGrow: p.n, flexBasis: 0, background: p.colour }} />
      ))}
    </div>
  );
}

/** Bars over time. A zero (or unknown, null) is a faint stub; the last bar is darker. */
export function Bars({ values, tooltip, height = 72, label }: {
  values: (number | null)[]; tooltip: (i: number) => string; height?: number; label?: string;
}) {
  const max = Math.max(0, ...values.map((v) => v ?? 0));
  return (
    <div className="flex items-end gap-[2px]" style={{ height }} role="img" aria-label={label}>
      {values.map((v, i) => {
        const empty = v === null || v === 0 || max === 0;
        return (
          <div key={i} title={tooltip(i)} className="flex-1 rounded-t-[3px]"
            style={{
              height: empty ? 3 : Math.max(5, (height * v!) / max),
              background: v === null ? "rgba(233,237,239,0.6)" : empty ? C.fieldBorder : i === values.length - 1 ? C.primaryDark : C.primary,
            }} />
        );
      })}
    </div>
  );
}

// ── Live donut ───────────────────────────────────────────────────────────────

/** Part-to-whole ring with a 2 px gap. Segments glide to new values on refresh
 *  (CSS transition), and stay still under prefers-reduced-motion. */
export function Donut({ segments, centre, sub, size = 128, stroke = 16 }: {
  segments: { value: number; colour: string; label: string }[];
  centre: React.ReactNode;
  sub: string;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, e) => s + e.value, 0);
  const live = segments.filter((s) => s.value > 0).length;
  const gap = live > 1 ? 2 : 0;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img"
        aria-label={segments.filter((s) => s.value > 0).map((s) => `${s.label} ${s.value}`).join(", ") || "No units"}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.fieldFill} strokeWidth={stroke} />
        {total > 0 && segments.map((s, i) => {
          const len = (s.value / total) * circ;
          const el = s.value > 0 ? (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.colour} strokeWidth={stroke}
              strokeDasharray={`${Math.max(len - gap, 0.5)} ${circ}`} strokeDashoffset={-offset - gap / 2}
              className="motion-safe:transition-[stroke-dasharray,stroke-dashoffset] motion-safe:duration-700 ease-out">
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          ) : null;
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[30px] font-semibold leading-none text-[#111B21] tabular-nums">{centre}</div>
        <div className="mt-1 text-[12px] text-[#667781]">{sub}</div>
      </div>
    </div>
  );
}

// ── Live ─────────────────────────────────────────────────────────────────────

/** "● Live" — a pulsing dot; grey and still while reconnecting. */
export function LivePill({ stale = false }: { stale?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${stale ? "bg-[#F0F2F5] text-[#667781]" : "bg-[#E7F3F1] text-[#075E54]"}`}>
      <span className="relative flex w-2 h-2">
        {!stale && <span className="absolute inline-flex h-full w-full rounded-full bg-[#25D366] opacity-60 motion-safe:animate-ping" />}
        <span className={`relative inline-flex w-2 h-2 rounded-full ${stale ? "bg-[#8696A0]" : "bg-[#25D366]"}`} />
      </span>
      {stale ? "Reconnecting" : "Live"}
    </span>
  );
}

/** "Live · updated 12 s ago", ticking every second. */
export function LiveStamp({ at, stale = false, connecting = true, prefix = "" }: {
  at: Date | null; stale?: boolean; connecting?: boolean; prefix?: string;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  const status = at === null
    ? connecting ? "Connecting…" : "Unavailable · retrying"
    : `${stale ? "Reconnecting" : "Live"} · updated ${agoLabel(at, new Date())}`;
  return <span>{prefix}{status}</span>;
}

/** Segmented tabs (Today / 7 days / …). */
export function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: { id: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-[14px] bg-[#F0F2F5] p-1 gap-1" role="tablist">
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={o.id === value} onClick={() => onChange(o.id)}
          className={`rounded-[10px] px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition ${o.id === value ? "bg-white text-[#075E54] shadow-sm" : "text-[#667781] hover:text-[#111B21]"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
