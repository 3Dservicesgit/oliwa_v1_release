/**
 * api/endpoints.ts — Central registry of all API URL paths.
 */

export const ENDPOINTS = {
  SIMCARDS: {
    CREATE:  "/devices/simcards/create",
    GET_ALL: "/devices/simcards/all",
  },
  STATISTICS: {
    SIMS_SUMMARY:        "/statistics/sims/summary",
    UNITS_ONLINE:        "/statistics/units/online",
    UNITS_OFFLINE:       "/statistics/units/offline",
    TOKENS_EXPIRED:      "/statistics/tokens/expired",
    TOKENS_ACTIVE:       "/statistics/tokens/active",
    TOKENS_PAUSED:       "/statistics/tokens/paused",
    HIGH_SUB_CLIENTS:    "/statistics/clients/high-subscriptions",
    VEBA_UNITS_ENABLED:  "/statistics/veba/units/enabled",
    VEBA_UNITS_DISABLED: "/statistics/veba/units/disabled",
    VEBA_TOKENS_ACTIVE:  "/statistics/veba/tokens/active",
    VEBA_TOKENS_EXPIRED: "/statistics/veba/tokens/expired",
  },
  BILLING: {
    CHURN_RATE: "/billing/subscriptions/churn-rate",
    EXPIRING:   "/billing/subscriptions/expiring",
  },
  PAYMENTS: {
    TRANSACTIONS: "/payments/transactions",
  },
  METRICS: {
    SERVER:          "/metrics/server",
    API_PERFORMANCE: "/metrics/api/performance",
  },
  GATEWAYS: {
    MOBILE_MONEY:    "/gateways/mobile-money",
    MOBILE_MONEY_BY: "/gateways/mobile-money",
    UPDATE:          "/gateways/mobile-money/update",
  },
  VEBA: {
    STATISTICS:              "/veba/statistics",
    LISTINGS:                "/veba/listings",
    LISTINGS_CREATE:         "/veba/listings/create",
    LISTINGS_BY_ASSET:       "/veba/listings/asset",
    LISTINGS_BY_UID:         "/veba/listings",
    LISTINGS_UPDATE:         "/veba/listings",
    LISTINGS_PAUSE:          "/veba/listings",
    LISTINGS_REACTIVATE:     "/veba/listings",
    LISTINGS_ARCHIVE:        "/veba/listings",
    LISTINGS_DELETE:         "/veba/listings",
    ASSET_PHOTO_UPLOAD:      "/veba/assets",
    ASSET_PHOTO_SERVE:       "/veba/assets/photo",
    BOOKING_REQUESTS:        "/veba/booking-requests",
    BOOKING_REQUESTS_CREATE: "/veba/booking-requests/create",
  },
  TENANTS: {
    CREATE:          "/tenants/create",
    GET_ALL:         "/tenants/all",
    IMPORT:          "/tenants/import",
    IMPORT_TEMPLATE: "/tenants/import/template",
    TRASH:           "/tenants",
    RESTORE:         "/tenants",
    GET_TRASHED:     "/tenants/trashed",
    KPIS:            "/tenants/kpis",
    WALLET:          "/tenants",
    TOP_UP:          "/tenants/wallet/topup",
    ALLOCATE:        "/tenants/wallet/allocate",
    MINT:            "/tenants/wallet/mint",
    USAGE_EVENTS:    "/tenants/usage-events",
    APPROVALS:       "/tenants/approvals",
    APPROVE:         "/tenants/approvals",
    REJECT:          "/tenants/approvals",
    AUDIT_TRAIL:     "/tenants/audit-trail",
    DRAFTS:          "/tenants/drafts",
    DRAFT_APPROVAL:  "/tenants/drafts",
    DRAFT_SUBMIT:    "/tenants/drafts",
  },
  CLIENTS: {
    CREATE:      "/clients/create",
    GET_ALL:     "/clients/all",
    BY_PROVIDER: "/clients",
    DEVICES:     "/devices/configured",
    UPDATE:      "/clients",
    TRASH:       "/clients",
    RESTORE:     "/clients",
    GET_TRASHED: "/clients/trashed",
  },
  TOKENS: {
    GET_ALL:  "/tokens",
    CREATE:   "/tokens/create",
    BY_ID:    "/tokens",
    BUY:      "/payments/tokens/buy",
    TRANSFER: "/tokens/transfer",
    BALANCE:  "/tokens",
  },
  FINANCE: {
    PAYMENTS: "/finance/payments",
  },
  GEOZONES: {
    CREATE:        "/geozones/create",
    UPDATE:        "/geozones",           // PUT  /{geozone_id}/update
    LIST:          "/geozones",           // GET  /{owner_uid}/list/{access_level}/load
    DETAILS:       "/geozones",           // GET  /{geozone_id}/details
    DELETE:        "/geozones",           // DELETE /{geozone_id}/delete
    ATTACH:        "/geozones",           // POST /{geozone_id}/attach
    DETACH:        "/geozones",           // PUT  /{geozone_id}/detach/{device_id}/action
    DEVICE_ZONES:  "/geozones/devices",   // GET  /{device_uid}/list
  },
  PORTS: {
    ACTIVITY: "/ports/activity",
  },
  RBAC: {
    ROLES:              "/rbac/roles",
    ROLES_CREATE:       "/rbac/roles/create",
    ROLES_BY_UID:       "/rbac/roles",
    ROLES_UPDATE:       "/rbac/roles",
    ROLES_DELETE:       "/rbac/roles",
    PERMISSIONS:        "/rbac/permissions",
    PERMISSIONS_CREATE: "/rbac/permissions/create",
    PERMISSIONS_UPDATE: "/rbac/permissions",
    PERMISSIONS_DELETE: "/rbac/permissions",
    USER_PERMISSIONS:   "/rbac/users",
    STATS_ACTIVE_ROLES:      "/rbac/stats/active-roles",
    STATS_TOTAL_PERMISSIONS: "/rbac/stats/total-permissions",
    STATS_ACTIVE_CLIENTS:    "/rbac/stats/active-clients",
    STATS_ACTIVE_3D_CLIENTS: "/rbac/stats/active-3d-clients",
    STATS_CLIENT_USERS:      "/rbac/stats/client-users",
    STATS_ROLE_USER_COUNTS:  "/rbac/stats/role-user-counts",
    STATS_PERM_ROLE_COUNTS:  "/rbac/stats/permission-role-counts",
  },
  AUTH: {
    LOGIN:           "/users/auth",
    MFA_VERIFY:      "/auth/mfa/verify",
    MFA_RESEND:      "/auth/mfa/resend",
    REFRESH:         "/auth/refresh",
    LOGOUT:          "/auth/logout",
    FORGOT_PASSWORD: "/auth/forgot-password",
    RESET_PASSWORD:  "/auth/reset-password",
    USER_DETAILS:    "/users",
  },
  USERS: {
    CREATE:      "/users/create",
    ALL:         "/users/all",
    ASSIGN_ROLE: "/users",
  },
  FLEET: {
    LIST_UNITS:       "/devices/configured/all",  // POST {data:{data_level,account_uid}}
    CHECK_IMEI:       "/system32/payment/check-imei",      // GET  append /{imei}
    CLIENTS_ALL:      "/clients",                          // GET  append /{primary_uid}/all
    USER_DETAILS:     "/users",                            // GET  append /{account_uid}/details
    DEVICE_ACTION:    "/devices/action",                   // POST {data:{action,device_imei}}
    DEVICE_UPDATE:    "/devices/update/properties",        // POST {data:{device_imei,...props}}
    DEVICE_CFG_NEW:   "/system32/configurations/new",      // POST full config payload
    DEVICE_CFG_UPDATE:"/configurations/update",            // POST Teltonika update payload
    ACTIVE_TXNS:      "/system32/payment/transactions/active", // GET append /{userUid}
    UPDATE_IMEI:      "/system32/payment/update-imei",     // POST {data:{payment_uid,used_imei}}
    LIST_REGISTERED:  "/devices/all",           // POST {data:{data_level,account_uid}}
    REGISTER_UNIT:    "/devices/create",                   // POST {data:{unit_imei,asset_model,unit_vendor,client}}
    CLIENT_INFO:       "/system32/devices/client-info",
    AUDIT_LOG:         "/system32/audit/logs",
  },
  AUDIT: {
    EVENTS:     "/audit/events",
    KPIS:       "/audit/kpis",
    HASH_CHAIN: "/audit/hash-chain",
    APPROVALS:  "/audit/approvals",
    APPROVE:    "/audit/approvals",
    REJECT:     "/audit/approvals",
    COMPLIANCE: "/audit/compliance",
    EXPORT:     "/audit/export",
  },
} as const;
