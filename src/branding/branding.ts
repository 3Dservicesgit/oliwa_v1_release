/**
 * branding.ts — the shared pieces of BrandingContext: the defaults, the
 * context object, sanitize(), and the hooks. Kept apart from the provider
 * component so React fast refresh works (a .tsx file exports components only).
 */
import { createContext, useContext } from "react";
import type { Branding } from "../api/types/branding.types";

export const DEFAULT_ASSISTANT_NAME = "Waswa";

export const DEFAULT_BRANDING: Branding = {
  brand_color: "#128C7E",
  brand_dark: "#0D6258",
  brand_light: "#4DA99E",
  brand_soft: "#E7F4F2",
  on_brand: "#FFFFFF",
  accent_color: "#25D366",
  accent_pressed: "#21BA5A",
  on_accent: "#111B21",
  assistant_name: DEFAULT_ASSISTANT_NAME,
  customised: { brand_color: false, accent_color: false, assistant_name: false },
  can_edit: false,
  edit_refusal: null,
  enabled: false,
  allow_colors: false,
  allow_assistant_name: false,
  defaults: { brand_color: "#128C7E", accent_color: "#25D366", assistant_name: DEFAULT_ASSISTANT_NAME, presets: [] },
};

export interface BrandingValue {
  branding: Branding;
  loading: boolean;
  /** Fetch again (after a save elsewhere, or a retry). */
  reload: () => Promise<void>;
  /** Use a look the server just returned (after PUT / DELETE). */
  replace: (b: Branding) => void;
}

export const BrandingCtx = createContext<BrandingValue>({
  branding: DEFAULT_BRANDING,
  loading: false,
  reload: async () => {},
  replace: () => {},
});

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** A server or stored look, with anything missing or malformed taken from
 *  the defaults, so a half-answer never paints the screen wrong. */
export function sanitize(raw: unknown): Branding {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Branding>;
  const colour = (k: keyof Branding) =>
    typeof r[k] === "string" && HEX.test(r[k] as string) ? (r[k] as string) : (DEFAULT_BRANDING[k] as string);
  const name = typeof r.assistant_name === "string" && r.assistant_name.trim()
    ? r.assistant_name.trim().slice(0, 24) : DEFAULT_ASSISTANT_NAME;
  return {
    ...DEFAULT_BRANDING,
    brand_color: colour("brand_color"),
    brand_dark: colour("brand_dark"),
    brand_light: colour("brand_light"),
    brand_soft: colour("brand_soft"),
    on_brand: colour("on_brand"),
    accent_color: colour("accent_color"),
    accent_pressed: colour("accent_pressed"),
    on_accent: colour("on_accent"),
    assistant_name: name,
    customised: { ...DEFAULT_BRANDING.customised, ...(r.customised ?? {}) },
    can_edit: r.can_edit === true,
    edit_refusal: typeof r.edit_refusal === "string" ? r.edit_refusal : null,
    enabled: r.enabled === true,
    allow_colors: r.allow_colors === true,
    allow_assistant_name: r.allow_assistant_name === true,
    defaults: r.defaults && typeof r.defaults === "object"
      ? { ...DEFAULT_BRANDING.defaults, ...r.defaults, presets: Array.isArray(r.defaults.presets) ? r.defaults.presets : [] }
      : DEFAULT_BRANDING.defaults,
  };
}

export function useBranding(): BrandingValue {
  return useContext(BrandingCtx);
}

export function useAssistantName(): string {
  return useContext(BrandingCtx).branding.assistant_name;
}
