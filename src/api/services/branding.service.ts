/**
 * branding.service.ts — the signed-in client's colours and assistant name.
 *
 *   GET    /branding/me     the look, and whether I may change it
 *   PUT    /branding/me     save (client administrators, once 3D Services
 *                           has switched branding on for the account)
 *   DELETE /branding/me     back to the defaults
 *
 * Staff switch branding on per client in the CMS; the server refuses a save
 * from anyone else.
 */
import { del, get, put } from "../client";
import type { Branding, BrandingChanges } from "../types/branding.types";

const PATH = "/branding/me";

export async function getBranding(): Promise<Branding> {
  return (await get<Branding>(PATH)).data;
}

export async function saveBranding(changes: BrandingChanges): Promise<Branding> {
  return (await put<Branding>(PATH, { data: changes })).data;
}

export async function resetBranding(): Promise<Branding> {
  return (await del<Branding>(PATH)).data;
}
