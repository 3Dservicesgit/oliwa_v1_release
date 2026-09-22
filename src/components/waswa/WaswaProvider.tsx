/**
 * WaswaProvider — mounts the one Waswa chat drawer and the floating "W"
 * launcher for the whole OLIWA tracking console, and shares them through
 * useWaswa().
 *
 * ON/OFF is remembered per browser. When Waswa is OFF the launcher stays
 * visible (dimmed) so it can be switched back on from the drawer.
 */
import React, { useCallback, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { MODULES } from "../../auth/modules";
import { WaswaContext, type WaswaApi } from "./WaswaContext";
import { WaswaDrawer } from "./WaswaDrawer";

const STORAGE_KEY = "waswa_on";

/** The module a path belongs to: exact route, else the longest route prefix
 * (so /rbac/roles/new is RBAC). "/" is the Aegis dashboard. */
function moduleFor(pathname: string): string | null {
  const path = pathname === "/" ? "/aegis" : pathname.replace(/\/+$/, "");
  let best: { route: string; name: string } | null = null;
  for (const m of MODULES) {
    if (!m.route) continue;
    if (path === m.route || path.startsWith(`${m.route}/`)) {
      if (!best || m.route.length > best.route.length) best = { route: m.route, name: m.name };
    }
  }
  return best?.name ?? null;
}

function readOn(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function WaswaProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const moduleName = useMemo(() => moduleFor(location.pathname), [location.pathname]);

  const [on, setOnState] = useState<boolean>(readOn);
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState<{ text: string; nonce: number } | null>(null);

  const setOn = useCallback((value: boolean) => {
    setOnState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* private mode: ON/OFF just isn't remembered */
    }
  }, []);

  const open = useCallback((prompt?: string) => {
    setIsOpen(true);
    const text = prompt?.trim();
    if (text) setPending({ text, nonce: Date.now() });
  }, []);

  const api: WaswaApi = useMemo(() => ({
    on,
    setOn,
    toggle: () => setOn(!on),
    isOpen,
    open,
    close: () => setIsOpen(false),
    moduleName,
  }), [on, setOn, isOpen, open, moduleName]);

  return (
    <WaswaContext.Provider value={api}>
      {children}

      {/* z-40: below page modals and drawers (z-50), so it never covers their
          buttons; it shows again when they close. */}
      {!isOpen && (
        <button
          onClick={() => open()}
          aria-label="Open Waswa AI"
          title={on ? "Ask Waswa" : "Waswa is off — open to switch it on"}
          className={`
            fixed right-5 bottom-5 z-40
            w-12 h-12 rounded-full border-none
            text-white font-black text-[20px]
            shadow-[0_12px_30px_rgba(0,0,0,0.18)]
            cursor-pointer hover:brightness-105 active:scale-95 transition-all
            grid place-items-center
            ${on ? "bg-[#25D366]" : "bg-[#9CA3AF]"}
          `}
        >
          W
        </button>
      )}

      <WaswaDrawer
        open={isOpen}
        onClose={() => setIsOpen(false)}
        waswaOn={on}
        onToggleWaswa={() => setOn(!on)}
        pendingPrompt={pending}
        moduleName={moduleName}
      />
    </WaswaContext.Provider>
  );
}
