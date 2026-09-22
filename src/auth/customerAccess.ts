/**
 * customerAccess.ts — what a fleet customer can do in the OLIWA console.
 *
 * Customers never skip permission checks. Role names are shared with staff
 * ("admin" exists in both), so a customer's role permissions can't be trusted
 * either: a customer gets exactly this list — their own fleet's screens and
 * actions — and nothing else. Staff screens (users, audit, tenants, money,
 * token catalogue, device registration…) stay closed to them.
 *
 * The server enforces the same rule (navas-core-apis endpoints/globals.py,
 * CUSTOMER_PERMISSIONS); this list only decides what the console shows.
 */

/** Platform staff roles that may see everything. Decided by the server's answer, never a cookie. */
export const STAFF_BYPASS_ROLES = ["super_admin", "system"];

export const CUSTOMER_ROLES = ["customer", "customer_tracker", "client_admin", "client_operator", "client_viewer"];
export const CUSTOMER_ACCOUNT_TYPES = ["client", "customer", "customer_tracker"];

// ── What each team role may do ──────────────────────────────────────────────
// A client account can have many users. The client's administrators add them
// under "User Management" with one of three roles (see navas-core-apis
// endpoints/team.py):
//   Viewer         look at the fleet only
//   Operator       also manage geofences, alerts and bookings
//   Administrator  also manage the team, marketplace listings and the audit
// The account's original login counts as an Administrator.

const VIEWER: readonly string[] = [
  "live.monitoring.view",   // Live Monitoring
  "track.playback.view",    // Track Playback
  "reports.view",           // Reports
  "geofences.view",         // Geofences & Zones
  "events.view",            // Events & Alerts
  "sim.view",               // Token Subscription
  "veba.view",              // VEBA Marketplace
  "can_browse_asset_listings",
];

const OPERATOR: readonly string[] = [
  ...VIEWER,
  "can_create_geofence", "can_edit_geofence", "can_delete_geofence",
  "events.create", "events.update", "events.delete",
  "can_book_asset",
];

const ADMINISTRATOR: readonly string[] = [
  ...OPERATOR,
  "can_list_asset_on_marketplace", "can_edit_asset_listing",
  "can_approve_booking_request", "can_reject_booking_request",
  "rbac.view",              // User Management → the team page
  "audit.view",             // Audit Trail → the account's sign-ins and changes
  "team.manage",
];

/** Everything a customer account can ever be given (the administrator set). */
export const CUSTOMER_PERMISSIONS: readonly string[] = ADMINISTRATOR;

export function customerPermissionsFor(role?: string | null): readonly string[] {
  switch ((role ?? "").toLowerCase()) {
    case "client_viewer": return VIEWER;
    case "client_operator": return OPERATOR;
    default: return ADMINISTRATOR;   // client_admin, and the account's original login
  }
}

export function isCustomerAccount(role?: string | null, accountType?: string | null): boolean {
  return CUSTOMER_ROLES.includes((role ?? "").toLowerCase())
    || CUSTOMER_ACCOUNT_TYPES.includes((accountType ?? "").toLowerCase());
}
