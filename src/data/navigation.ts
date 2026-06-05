/**
 * data/navigation.ts — Shared navigation configuration.
 *
 * Centralized nav items used by NavRail and Sidebar across layouts.
 * Update here to add/remove/reorder navigation items globally.
 */
import type { NavRailItem } from "../components/navigation";
import type { SidebarItem } from "../components/navigation";

// ── Default NavRail items (used by MainLayout) ──────────────────────────────
export const DEFAULT_NAV_ITEMS: NavRailItem[] = [
  { key: "home",              glyph: "⌂",  label: "Home",               path: "/"                  },
  { key: "aegis",             glyph: "A",  label: "Aegis Dashboard",     path: "/aegis"             },
  { key: "noc-bridge",        glyph: "⛑",  label: "NOC Bridge",          path: "/noc-bridge"        },
  { key: "protocol",          glyph: "⚙",  label: "Protocol Port",        path: "/protocol"          },
  { key: "firmware",          glyph: "⬆",  label: "Patch Orchestrator",   path: "/firmware"          },
  { key: "sim",               glyph: "📡", label: "Signal Vault",         path: "/sim"               },
  { key: "ops",               glyph: "!",  label: "Ops War Room",         path: "/ops"               },
  { key: "gatehouse",         glyph: "G",  label: "Gatehouse",            path: "/gatehouse"         },
  { key: "alarms-factory",    glyph: "⚡", label: "Alarm Factory",        path: "/alarms-factory"    },
  { key: "tenant-tower",      glyph: "#",  label: "Tenant Tower",         path: "/tenant-tower"      },
  { key: "billing-invoicing", glyph: "I",  label: "Billing & Invoicing",  path: "/billing-invoicing" },
  { key: "health",            glyph: "♥",  label: "System Health",        path: "/health"            },
  { key: "alarms",            glyph: "⚠",  label: "Alarms",               path: "/alarms"            },
  { key: "tokens",            glyph: "T",  label: "Tokens",               path: "/tokens"            },
  { key: "billing",           glyph: "₿",  label: "Billing",              path: "/billing"           },
  { key: "payments",          glyph: "$",  label: "Payments",             path: "/payments"          },
  { key: "money",             glyph: "💳", label: "Money Switchboard",    path: "/money"             },
  { key: "veba",              glyph: "V",  label: "VEBA",                 path: "/veba"              },
  { key: "ai",                glyph: "W",  label: "AI Workloads",         path: "/ai"                },
  { key: "rbac",              glyph: "R",  label: "RBAC",                 path: "/rbac"              },
  { key: "audit",             glyph: "📋", label: "Audit Trail",          path: "/audit"             },
];

// ── Default Sidebar items (used by MainLayout) ──────────────────────────────
export const DEFAULT_SIDEBAR_ITEMS: SidebarItem[] = [
  // ── Core dashboards ───────────────────────────────────────────────────────
  { key: "aegis",             label: "Aegis Dashboard",         path: "/"                  },
  { key: "noc-bridge",        label: "NOC Bridge",              path: "/noc-bridge"        },
  { key: "protocol",          label: "Protocol Port",           path: "/protocol"          },
  { key: "firmware",          label: "Patch Orchestrator",      path: "/firmware"          },
  { key: "sim",               label: "Signal Vault",            path: "/sim"               },
  { key: "ops",               label: "Ops War Room",            path: "/ops"               },
  { key: "gatehouse",         label: "Gatehouse Alpha",         path: "/gatehouse"         },
  { key: "alarms-factory",    label: "Alarm Factory",           path: "/alarms-factory"    },
  { key: "tenant-tower",      label: "Tenant Tower",            path: "/tenant-tower"      },
  { key: "billing-invoicing", label: "Billing & Invoicing",     path: "/billing-invoicing" },

  // ── System & Ops ─────────────────────────────────────────────────────────
  { key: "health",            label: "System Health",           path: "/health"            },
  { key: "alarms",            label: "Alarms Center",           path: "/alarms"            },
  { key: "ingestion",         label: "Ingestion Pipeline",      path: "/health"            },
  { key: "kafka",             label: "Kafka",                   path: "/health"            },
  { key: "compute",           label: "Compute",                 path: "/health"            },
  { key: "task-manager",      label: "Task Manager (Diag)",     path: "/health"            },

  // ── Tokenomics & Finance ─────────────────────────────────────────────────
  { key: "tokens",            label: "Token Engine",            path: "/tokens"            },
  { key: "billing",           label: "Billing",                 path: "/billing"           },
  { key: "payments",          label: "Messaging + Payments",    path: "/payments"          },
  { key: "money",             label: "Money Switchboard",       path: "/money"             },

  // ── Platform ─────────────────────────────────────────────────────────────
  { key: "veba",              label: "VEBA Marketplace",        path: "/veba"              },
  { key: "ai-workloads",      label: "AI Workloads",            path: "/ai"                },
  { key: "rbac",              label: "RBAC / Access Control",   path: "/rbac"              },
  { key: "runbooks",          label: "Runbooks",                path: "/audit"             },
  { key: "audit",             label: "Audit Trail",             path: "/audit"             },
];
