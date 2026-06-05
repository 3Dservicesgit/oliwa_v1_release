/**
 * data/navigation.ts — Shared navigation configuration.
 *
 * Derives NavRail and Sidebar items from the central module registry
 * (auth/modules.ts). That file is the single source of truth for which
 * modules appear in the navigation.
 */
import type { NavRailItem } from "../components/navigation";
import type { SidebarItem } from "../components/navigation";
import { getModulesForNavRail, getModulesForSidebar } from "../auth/modules";

// ── Default NavRail items (derived from module registry) ────────────────────
export const DEFAULT_NAV_ITEMS: NavRailItem[] = getModulesForNavRail().map((m) => ({
  key:   m.id,
  glyph: m.navGlyph ?? m.id.charAt(0).toUpperCase(),
  label: m.navLabel ?? m.name,
  path:  m.route ?? `/${m.id}`,
}));

// ── Default Sidebar items (derived from module registry) ────────────────────
export const DEFAULT_SIDEBAR_ITEMS: SidebarItem[] = getModulesForSidebar().map((m) => ({
  key:        m.id,
  label:      m.navLabel ?? m.name,
  path:       m.route,
  permission: m.viewPermission,
}));
