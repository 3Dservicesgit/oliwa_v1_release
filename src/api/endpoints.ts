/**
 * api/endpoints.ts — Central registry of all API URL paths.
 *
 * Every endpoint in the app is defined here. When a URL changes,
 * update it in one place and every service picks it up.
 *
 * Convention:
 *   DOMAIN.ACTION  →  "/path/to/endpoint"
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
    CHURN_RATE:       "/billing/subscriptions/churn-rate",
    EXPIRING:         "/billing/subscriptions/expiring",   // ?days=30
  },
  PAYMENTS: {
    TRANSACTIONS:     "/payments/transactions",            // append /{client_uid}/list
  },
  METRICS: {
    SERVER:          "/metrics/server",
    API_PERFORMANCE: "/metrics/api/performance",
    //STATISTICS: "/veba/statistics",
  },
  GATEWAYS: {
    MOBILE_MONEY:     "/gateways/mobile-money",
    MOBILE_MONEY_BY:  "/gateways/mobile-money",   // append /{telecom_name}
    UPDATE:           "/gateways/mobile-money/update",
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
    BOOKING_APPROVE:         "/veba/booking-requests",     // PUT /{uid}/approve
    BOOKING_REJECT:          "/veba/booking-requests",     // PUT /{uid}/reject
    BOOKING_CANCEL:          "/veba/booking-requests",     // PUT /{uid}/cancel
    BOOKING_FULFILL:         "/veba/booking-requests",     // PUT /{uid}/fulfill
    MARKETPLACE:             "/veba/marketplace/listings", // GET public marketplace
  },
  TENANTS: {
    CREATE:          "/tenants/create",
    GET_ALL:         "/tenants/all",
    IMPORT:          "/tenants/import",
    IMPORT_TEMPLATE: "/tenants/import/template",
    TRASH:           "/tenants",           // append /{id}/trash
    RESTORE:         "/tenants",           // append /{id}/restore
    GET_TRASHED:     "/tenants/trashed",
    KPIS:            "/tenants/kpis",
    WALLET:          "/tenants",           // append /{id}/wallet
    TOP_UP:          "/tenants/wallet/topup",
    ALLOCATE:        "/tenants/wallet/allocate",
    MINT:            "/tenants/wallet/mint",
    USAGE_EVENTS:    "/tenants/usage-events",
    APPROVALS:       "/tenants/approvals",
    APPROVE:         "/tenants/approvals",   // append /{id}/approve
    REJECT:          "/tenants/approvals",   // append /{id}/reject
    AUDIT_TRAIL:     "/tenants/audit-trail",
    DRAFTS:          "/tenants/drafts",           // POST save draft
    DRAFT_APPROVAL:  "/tenants/drafts",           // append /{id}/request-approval
    DRAFT_SUBMIT:    "/tenants/drafts",           // append /{id}/submit
  },
  CLIENTS: {
    CREATE:      "/clients/create",
    GET_ALL:     "/clients/all",
    BY_PROVIDER: "/clients",           // append /{service_provider}/all
    DEVICES:     "/devices/configured",// append /{client_uid}/client
    UPDATE:      "/clients",           // append /{client_uid}/update
    TRASH:       "/clients",           // append /{client_uid}/trash
    RESTORE:     "/clients",           // append /{client_uid}/restore
    GET_TRASHED: "/clients/trashed",
  },
  TOKENS: {
    GET_ALL:  "/tokens",
    CREATE:   "/tokens/create",
    BY_ID:    "/tokens",               // append /{token_id}
    BUY:      "/payments/tokens/buy",
    TRANSFER: "/tokens/transfer",
    BALANCE:  "/tokens",               // append /{client_uid}/balance
    BUDGET_OFFER: "/tokens/budget-offer", // POST {data:{currency, amount}}
    /** Subscription management */
    SUB_PAUSE:   "/tokens/subscriptions/pause",    // POST {device_imei}
    SUB_RESTORE: "/tokens/subscriptions/restore",  // POST {device_imei}
    SUB_UPDATE:  "/tokens/subscriptions/update",   // POST {new_token_billing_uid, device_imei}
    /** Payment status check */
    PAYMENT_STATUS: "/payments/transactions",      // GET  /{transaction_uid}/status
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
    /** Geozone groups */
    GROUP_CREATE:  "/geozones/groups/create",       // POST
    GROUP_LIST:    "/geozones/groups",               // GET  /{owner_uid}/list
    GROUP_UPDATE:  "/geozones/groups",               // PUT  /{group_uid}/update
    GROUP_DELETE:  "/geozones/groups",               // DELETE /{group_uid}/delete
    GROUP_ASSIGN:  "/geozones/groups",               // POST /{group_uid}/assign
    GROUP_REMOVE:  "/geozones/groups",               // POST /{group_uid}/remove
  },
  PORTS: {
    ACTIVITY: "/ports/activity",
  },
  RBAC: {
    ROLES:              "/rbac/roles",
    ROLES_CREATE:       "/rbac/roles/create",
    ROLES_BY_UID:       "/rbac/roles",           // append /{role_uid}
    ROLES_UPDATE:       "/rbac/roles",           // append /{role_uid}/update
    ROLES_DELETE:       "/rbac/roles",           // append /{role_uid}/delete
    PERMISSIONS:        "/rbac/permissions",
    PERMISSIONS_CREATE: "/rbac/permissions/create",
    PERMISSIONS_UPDATE: "/rbac/permissions",        // append /{permission_uid}/update
    PERMISSIONS_DELETE: "/rbac/permissions",        // append /{permission_uid}/delete
    USER_PERMISSIONS:   "/rbac/users",           // append /{account_uid}/permissions
    STATS_ACTIVE_ROLES:      "/rbac/stats/active-roles",
    STATS_TOTAL_PERMISSIONS: "/rbac/stats/total-permissions",
    STATS_ACTIVE_CLIENTS:    "/rbac/stats/active-clients",
    STATS_ACTIVE_3D_CLIENTS: "/rbac/stats/active-3d-clients",
    STATS_CLIENT_USERS:      "/rbac/stats/client-users",
    STATS_ROLE_USER_COUNTS:  "/rbac/stats/role-user-counts",
    STATS_PERM_ROLE_COUNTS:  "/rbac/stats/permission-role-counts",
  },
  AUTH: {
    LOGIN:          "/users/auth",
    MFA_VERIFY:     "/auth/mfa/verify",
    MFA_RESEND:     "/auth/mfa/resend",
    REFRESH:        "/auth/refresh",
    LOGOUT:         "/auth/logout",
    FORGOT_PASSWORD:"/auth/forgot-password",
    RESET_PASSWORD: "/auth/reset-password",
    USER_DETAILS:   "/users",              // append /{account_uid}/details
  },
  USERS: {
    CREATE: "/users/create",
    ALL: "/users/all",
    ASSIGN_ROLE: "/users",           // append /{user_uid}/assign-role
    ACTION: "/users/action",         // POST {action: 'active'|'locked', account_uid}
    RESET_PASSWORD: "/users",        // PUT  /{user_uid}/reset-password
    CHANGE_PASSWORD: "/users",       // PUT  /{user_uid}/change-password
    DETAILS: "/users",               // GET  /{user_uid}/details
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
    REGISTER_UNIT:    "/devices/create",
  },

  REPORTS: {
    /** Generate (legacy, data_handler_bp): POST /data-house/reports/{type}/{format} */
    GENERATE:       "/data-house/reports",
    /** Trip report data (lightweight): POST /data-stream/reports/trips/generate-data */
    TRIPS_DATA:     "/data-stream/reports/trips/generate-data",
    /** Night driving report data: POST /data-stream/reports/night-driving/generate-data */
    NIGHT_DRIVING_DATA: "/data-stream/reports/night-driving/generate-data",
    /** State duration report data (PARKING/IDILING): POST /data-stream/reports/state/generate-data */
    STATE_DATA: "/data-stream/reports/state/generate-data",
    /** Overspeeding report data: POST /data-stream/reports/overspeeding/generate-data */
    OVERSPEEDING_DATA: "/data-stream/reports/overspeeding/generate-data",
    /** Geozone breach report data: POST /data-stream/reports/geozone/generate-data */
    GEOZONE_DATA: "/data-stream/reports/geozone/generate-data",
    /** List by type: GET /data-stream/reports/{owner}/{type}/list */
    LIST_BY_TYPE:   "/data-stream/reports",
    /** List state reports: GET /data-stream/reports/{owner}/state/list */
    LIST_STATE:     "/data-stream/reports",
    /** Status check: GET /data-stream/reports/{request_uid}/status */
    STATUS:         "/data-stream/reports",
    /** Log client-side report: POST /data-stream/reports/log-download */
    LOG_DOWNLOAD:   "/data-stream/reports/log-download",
    /** Delete: DELETE /data-stream/reports/{request_uid}/delete */
    DELETE:         "/data-stream/reports",
    /** Available types: GET /data-stream/reports/types/available */
    TYPES:          "/data-stream/reports/types/available",
    /** Download file: GET /reports-cdn/{filename} */
    CDN:            "/reports-cdn",
  },
  DEVICE_EVENTS: {
    CREATE:   "/events/create",
    UPDATE:   "/events",           // append /{event_uid}/update
    GET_ALL:  "/events/getall",
    DETAILS:  "/events",           // append /{event_id}/details
    DELETE:   "/events",           // append /{event_uid}/delete
  },
  TRACKING: {
    /** Trip history with IO events: POST /data-stream/trips/history */
    TRIPS_HISTORY:  "/data-stream/trips/history",
    /** Trip replay (positions only): POST /data-stream/trips/history/replay */
    TRIPS_REPLAY:   "/data-stream/trips/history/replay",
    /** Reverse geocode: POST /data-stream/location/geocoding */
    GEOCODE:        "/data-stream/location/geocoding",
  },
  AUDIT: {
    /** CMS-wide audit event stream (all modules). Supports ?domain=&severity=&range= query params */
    EVENTS:         "/audit/events",
    /** Aggregated KPI summary for audit dashboard */
    KPIS:           "/audit/kpis",
    /** Hash-chain blocks for tamper evidence */
    HASH_CHAIN:     "/audit/hash-chain",
    /** HITL / HIC approval queue (cross-module) */
    APPROVALS:      "/audit/approvals",
    /** Approve a pending approval */
    APPROVE:        "/audit/approvals",      // append /{id}/approve
    /** Reject a pending approval */
    REJECT:         "/audit/approvals",      // append /{id}/reject
    /** Compliance snapshot (retention, crypto, gaps) */
    COMPLIANCE:     "/audit/compliance",
    /** Request an audit pack export (HIC-gated) */
    EXPORT:         "/audit/export",
  },
} as const;
