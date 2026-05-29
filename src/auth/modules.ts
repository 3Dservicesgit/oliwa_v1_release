/**
 * auth/modules.ts — The NAVAS module registry. **Single source of truth.**
 *
 * Every feature module the app exposes is declared here exactly once. From
 * this declaration we derive:
 *
 *   - The route table (src/app/moduleRoutes.tsx)
 *   - The sidebar items (components/navigation/Sidebar.tsx)
 *   - The nav rail items (components/navigation/NavRail.tsx)
 *   - The Role Creator UI (features/rbac, Slice 2)
 *   - The backend permissions seed script (Slice 2)
 *
 * Adding a new module = add an entry here + a page component mapping in
 * moduleRoutes.tsx. The route, the nav entry, and the permission gate are
 * generated for you.
 *
 * Two kinds of entries live in this list:
 *
 *   1. **Built modules** — have `route` (and an element mapping in
 *      moduleRoutes.tsx). These appear in routing and (optionally) in nav.
 *   2. **Catalog-only modules** — declared in the mockup catalog but no UI
 *      page yet. They have no route or nav metadata; they exist so the Role
 *      Creator can render their permissions for selection.
 */

import {
  PERMISSION_CATALOG,
  type CatalogModuleName,
} from "./permissionCatalog";

// ── Types ────────────────────────────────────────────────────────────────────

export type ModuleGroup =
  | "core"
  | "system"
  | "finance"
  | "platform"
  | "admin"
  | "catalog-only";

export interface ModuleDef {
  /** Stable slug; used as React key, route map key, and module identifier. */
  id: string;
  /** Canonical display name (matches mockup catalog when applicable). */
  name: string;
  /** Optional sidebar/topbar label override (e.g. brand-specific). */
  navLabel?: string;
  /** Single-character glyph for the primary nav rail. */
  navGlyph?: string;
  /** URL path. Absent => not routable (catalog-only). */
  route?: string;
  /** Permission required to view this module. Absent => no guard (e.g. landing). */
  viewPermission?: string;
  /** Grouping for sidebar / future Role Creator section ordering. */
  group: ModuleGroup;
  /** Include in the primary vertical nav rail. */
  showInNavRail?: boolean;
  /** Include in the secondary sidebar nav. */
  showInSidebar?: boolean;
  /** Links this module to its permission set in the mockup catalog. */
  catalogModuleName?: CatalogModuleName;
}

// ── Built (routable) modules ─────────────────────────────────────────────────
//
// `viewPermission` values intentionally use the existing `module.view` style
// so this slice is a pure refactor — routes/nav stay backed by the same keys
// the backend already grants today. The new `can_*` permissions in the
// catalog are wired through in Slice 3 (service-layer guards).
//
// Note: navLabel preserves the brand-specific names the existing sidebar
// uses (e.g. "Signal Vault" rather than the generic "SIM & Connectivity").

const BUILT_MODULES: ModuleDef[] = [
  // ── Core ──────────────────────────────────────────────────────────────────
  {
    id: "aegis",
    name: "Dashboard",
    navLabel: "Dashboard",
    navGlyph: "A",
    route: "/aegis",
    // Landing-style page — no permission required.
    group: "core",
    showInNavRail: true,
    showInSidebar: true,
    catalogModuleName: "Dashboards & BI Studio",
  },
  {
    id: "noc-bridge",
    name: "Live Monitoring",
    navLabel: "Live Monitoring",
    navGlyph: "⛑",
    route: "/noc-bridge",
    viewPermission: "live.monitoring.view",
    group: "core",
    showInNavRail: true,
    showInSidebar: true,
    catalogModuleName: "NOC & Network Operations",
  },
  {
    id: "ops",
    name: "System Reports",
    navLabel: "System Reports",
    navGlyph: "!",
    route: "/ops",
    viewPermission: "reports.view",
    group: "core",
    showInNavRail: true,
    showInSidebar: true,
    catalogModuleName: "Ops War Room & Device Management",
  },
  {
    id: "gatehouse",
    name: "Track Report",
    navLabel: "Track Report",
    navGlyph: "G",
    route: "/gatehouse",
    viewPermission: "track.playback.view",
    group: "core",
    showInNavRail: true,
    showInSidebar: true,
    catalogModuleName: "Security & HIC Controls",
  },

  // ── System & Ops ──────────────────────────────────────────────────────────
  {
    id: "protocol",
    name: "Geofences & Zones",
    navLabel: "Geofences & Zones",
    navGlyph: "⚙",
    route: "/protocol",
    viewPermission: "geofences.view",
    group: "system",
    showInNavRail: true,
    showInSidebar: true,
    catalogModuleName: "Geo-Zones & POIs",
  },
  {
    id: "firmware",
    name: "Events & Notifications",
    navLabel: "Events & Notifications",
    navGlyph: "⬆",
    route: "/firmware",
    viewPermission: "events.view",
    group: "system",
    showInNavRail: true,
    showInSidebar: false,
    catalogModuleName: "Device Lifecycle & Firmware",
  },
  {
    id: "billing",
    name: "System Billing",
    navLabel: "System Billing",
    navGlyph: "₿",
    route: "/billing",
    viewPermission: "billing.view",
    group: "finance",
    showInNavRail: true,
    showInSidebar: true,
    catalogModuleName: "Payments & Statements",
  },
  {
    id: "veba",
    name: "VEBA Marketplace",
    navLabel: "VEBA Marketplace",
    navGlyph: "V",
    route: "/veba",
    viewPermission: "veba.view",
    group: "platform",
    showInNavRail: true,
    showInSidebar: true,
    catalogModuleName: "VEBA Booking & Escrow",
  },
  // {
  //   id: "ai-workloads",
  //   name: "AI Workloads",
  //   navLabel: "AI Workloads",
  //   navGlyph: "W",
  //   route: "/ai",
  //   viewPermission: "ai.view",
  //   group: "platform",
  //   showInNavRail: true,
  //   showInSidebar: false,
  //   catalogModuleName: "Waswa AI & System Health",
  // },

  // ── Admin ─────────────────────────────────────────────────────────────────
  {
    id: "rbac",
    name: "User Management",
    navLabel: "User Management",
    navGlyph: "R",
    route: "/rbac",
    viewPermission: "rbac.view",
    group: "admin",
    showInNavRail: true,
    showInSidebar: true,
    catalogModuleName: "Users & Permissions",
  },
  {
    id: "audit",
    name: "Audit Trail",
    navLabel: "Audit Trail",
    navGlyph: "📋",
    route: "/audit",
    viewPermission: "audit.view",
    group: "admin",
    showInNavRail: true,
    showInSidebar: true,
    catalogModuleName: "Trip Replay & Audit",
  },
];

// ── Catalog-only modules ─────────────────────────────────────────────────────
//
// Every mockup catalog entry that isn't already represented by a built module
// is included as a catalog-only entry. These have no route, no element, and
// no nav slots — but the Role Creator (Slice 2) will iterate `MODULES` and
// render their permissions so admins can assemble cross-module roles.

const BUILT_CATALOG_NAMES = new Set<CatalogModuleName>(
  BUILT_MODULES.map((m) => m.catalogModuleName).filter(
    (n): n is CatalogModuleName => !!n,
  ),
);

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const CATALOG_ONLY_MODULES: ModuleDef[] = (
  Object.keys(PERMISSION_CATALOG) as CatalogModuleName[]
)
  .filter((mod) => !BUILT_CATALOG_NAMES.has(mod))
  .map((mod) => ({
    id: `catalog:${slug(mod)}`,
    name: mod,
    group: "catalog-only" as ModuleGroup,
    catalogModuleName: mod,
  }));

// ── Public registry ──────────────────────────────────────────────────────────

export const MODULES: readonly ModuleDef[] = Object.freeze([
  ...BUILT_MODULES,
  ...CATALOG_ONLY_MODULES,
]);

// ── Lookup helpers ───────────────────────────────────────────────────────────

export function getModuleById(id: string): ModuleDef | undefined {
  return MODULES.find((m) => m.id === id);
}

export function getModuleByRoute(path: string): ModuleDef | undefined {
  return MODULES.find((m) => m.route === path);
}

/** Modules that should appear in the secondary sidebar nav. */
export function getModulesForSidebar(): ModuleDef[] {
  return MODULES.filter((m) => m.showInSidebar);
}

/** Modules that should appear in the primary vertical nav rail. */
export function getModulesForNavRail(): ModuleDef[] {
  return MODULES.filter((m) => m.showInNavRail);
}

/** Modules that have a route (and thus need a `<Route>` emitted). */
export function getRoutableModules(): ModuleDef[] {
  return MODULES.filter((m) => m.route);
}

/** Modules grouped by `group` field, preserving registry order within each. */
export function getModulesByGroup(): Record<ModuleGroup, ModuleDef[]> {
  const out: Record<ModuleGroup, ModuleDef[]> = {
    core: [],
    system: [],
    finance: [],
    platform: [],
    admin: [],
    "catalog-only": [],
  };
  for (const m of MODULES) out[m.group].push(m);
  return out;
}
