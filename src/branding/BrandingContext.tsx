/**
 * BrandingContext — the signed-in client's colours and assistant name
 * (GET /branding/me), for every screen.
 *
 *   useBranding()       the whole look, can_edit, and reload / replace
 *   useAssistantName()  "Waswa", or the name the client chose
 *
 * Loaded once signed in; until it answers (or if it fails, or the server has
 * no branding yet) the product's defaults are used, so nothing waits on it.
 * The last look is kept in this browser so a reload does not flash teal
 * before the client's colours arrive.
 *
 * The colours are also set as CSS variables on <html> (--brand, --brand-dark,
 * --brand-light, --brand-soft, --on-brand, --accent, --accent-pressed,
 * --on-accent; OLIWA defaults in index.css). Pages use them through Tailwind
 * classes such as bg-[var(--brand)]. Status colours (online, OK, alerts) stay fixed.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { getBranding } from "../api/services/branding.service";
import type { Branding } from "../api/types/branding.types";
import { BrandingCtx, DEFAULT_BRANDING, sanitize } from "./branding";

const STORE_KEY = "oliwa.branding";

function readStored(): Branding | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function store(b: Branding | null) {
  try {
    if (b) localStorage.setItem(STORE_KEY, JSON.stringify(b));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* private window or blocked storage: the look just loads a moment later */
  }
}

function applyCssVariables(b: Branding) {
  const root = document.documentElement.style;
  root.setProperty("--brand", b.brand_color);
  root.setProperty("--brand-dark", b.brand_dark);
  root.setProperty("--brand-light", b.brand_light);
  root.setProperty("--brand-soft", b.brand_soft);
  root.setProperty("--on-brand", b.on_brand);
  root.setProperty("--accent", b.accent_color);
  root.setProperty("--accent-pressed", b.accent_pressed);
  root.setProperty("--on-accent", b.on_accent);
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const signedIn = state.status === "authenticated";
  const [branding, setBranding] = useState<Branding>(() => readStored() ?? DEFAULT_BRANDING);
  const [loading, setLoading] = useState(false);

  const replace = useCallback((b: Branding) => {
    const clean = sanitize(b);
    setBranding(clean);
    store(clean);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      replace(await getBranding());
    } catch {
      // An older server (404) or a failure: keep what we have.
    } finally {
      setLoading(false);
    }
  }, [replace]);

  useEffect(() => {
    if (signedIn) {
      void reload();
    } else {
      // Signed out: the next person on this browser starts from the defaults.
      setBranding(DEFAULT_BRANDING);
      store(null);
    }
  }, [signedIn, state.accountUid, reload]);

  useEffect(() => { applyCssVariables(branding); }, [branding]);

  const value = useMemo(() => ({ branding, loading, reload, replace }), [branding, loading, reload, replace]);
  return <BrandingCtx.Provider value={value}>{children}</BrandingCtx.Provider>;
}
