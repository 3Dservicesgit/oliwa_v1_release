/**
 * branding.types.ts — a client's own colours and assistant name
 * (navas-core-apis endpoints/branding.py, rules in branding_rules.py,
 * migration 058).
 */

export interface BrandingPreset {
  name: string;
  brand_color: string;
  accent_color: string;
}

/** GET /branding/me: the look to paint with, and whether I may change it. */
export interface Branding {
  brand_color: string;
  brand_dark: string;
  brand_light: string;
  brand_soft: string;
  on_brand: string;
  accent_color: string;
  accent_pressed: string;
  on_accent: string;
  assistant_name: string;
  customised: { brand_color: boolean; accent_color: boolean; assistant_name: boolean };
  can_edit: boolean;
  /** Why not, when can_edit is false (null for staff). */
  edit_refusal: string | null;
  enabled: boolean;
  allow_colors: boolean;
  allow_assistant_name: boolean;
  defaults: {
    brand_color: string;
    accent_color: string;
    assistant_name: string;
    presets: BrandingPreset[];
  };
}

/** PUT /branding/me. Only the fields sent change; "" goes back to the default. */
export interface BrandingChanges {
  brand_color?: string;
  accent_color?: string;
  assistant_name?: string;
}
