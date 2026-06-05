/**
 * api/index.ts — Public API for the NAVAS CMS HTTP layer.
 *
 * Usage:
 *   import { getAllSimCards, createSimCard, ApiError } from "../../api";
 */

// Shared types & error class
export { ApiError } from "./types";
export type { ApiResponse, RequestOptions } from "./types";

// HTTP verbs (for custom one-off calls)
export { get, getRaw, post, put, patch, del } from "./client";

// Central endpoint registry
export { ENDPOINTS } from "./endpoints";

// ── Domain types ─────────────────────────────────────────────────────────────

export type {
  CreateSimCardRequest,
  CreateSimCardResponse,
  SimCard,
  SimStatistics,
  ApiPerformanceMetrics,
  DiskDevice,
  SupervisorProcess,
  SystemdService,
  GunicornWorker,
  ServerMetrics,
  Gateway,
  GatewaysResponse,
  GatewayHistoryEntry,
  GatewayHistoryResponse,
  UpdateGatewayRequest,
  UpdateGatewayResponse,
  VebaStatistics,
  TenantTier,
  TenantStatus,
  Tenant,
  CreateTenantRequest,
  CreateTenantResponse,
  ImportTenantsResponse,
  TrashedTenant,
  TrashTenantResponse,
  RestoreTenantResponse,
  TenantListItem,
  TenantKpis,
  TokenDrain,
  TenantWallet,
  TopUpRequest,
  TopUpResponse,
  AllocateRequest,
  AllocateResponse,
  MintRequest,
  MintResponse,
  Approval,
  ApprovalActionResponse,
  UsageEvent,
  AuditTrailEntry,
  SaveDraftResponse,
  RequestApprovalResponse,
  SubmitDraftResponse,
  Client,
  ClientDevice,
  CreateClientRequest,
  UpdateClientRequest,
  TrashedClient,
  OnlineUnitsResponse,
  OfflineUnitsResponse,
  ExpiredTokensResponse,
  HighSubClient,
  HighSubClientsResponse,
  ActiveSubscriptionsResponse,
  PausedSubscriptionsResponse,
  ChurnRateResponse,
  ExpiringAccount,
  ExpiringSubscriptionsResponse,
  ClientTransaction,
  TokenPackage,
  ClientTokenBalance,
  BuyTokensRequest,
  BuyTokensResponse,
  TransferTokensRequest,
  TransferTokensResponse,
  RbacPermission,
  RbacRole,
  RbacRoleDetail,
  RbacUserPermissions,
  CreateRoleRequest,
  CreateRoleResponse,
  UpdateRoleRequest,
  DeleteRoleRequest,
  CreateUserRequest,
  CreateUserResponse,
  AssignRoleRequest,
  AssignRoleResponse,
  UserAccount,
  CreatePermissionRequest,
  CreatePermissionResponse,
  UpdatePermissionRequest,
  DeletePermissionRequest,
  RbacStats,
  AuditDomain,
  AuditSeverity,
  AuditEvent,
  AuditKpis,
  HashBlock,
  ApprovalType,
  AuditApproval,
  ComplianceItem,
  ComplianceSnapshot,
  ExportAuditPackRequest,
  ExportAuditPackResponse,
  AuditFilters,
} from "./types";

// ── Domain services ──────────────────────────────────────────────────────────

export { isUserLoggedIn, startSessionMonitor, stopSessionMonitor, broadcastLogout } from "./services/auth.service";
export { createSimCard, getAllSimCards } from "./services/simcards.service";
export { getSimStatistics, getOnlineUnits, getOfflineUnits, getExpiredTokens } from "./services/statistics.service";
export { getServerMetrics, getApiPerformance } from "./services/metrics.service";
export { getMobileMoneyGateways, getGatewayHistory, updateGatewayStatus } from "./services/gateways.service";
export { getVebaStatistics } from "./services/veba.service";
export {
  createTenant,
  getAllTenants,
  importTenants,
  downloadImportTemplate,
  trashTenant,
  restoreTenant,
  getTrashedTenants,
  getTenantKpis,
  getTenantWallet,
  topUpWallet,
  allocateTokens,
  mintTokens,
  getUsageEvents,
  getApprovals,
  approveRequest,
  rejectRequest,
  getAuditTrail,
  saveDraft,
  requestDraftApproval,
  submitApprovedDraft,
} from "./services/tenants.service";
export { createClient, getAllClients, getClientsByProvider, updateClient, trashClient, restoreClient, getTrashedClients, getClientDevices, getAllTokens, getClientBalance, buyTokens, transferTokens } from "./services/clients.service";
export { getActiveSubscriptions, getPausedSubscriptions, getHighSubClients, getChurnRate, getExpiringSubscriptions, getClientTransactions } from "./services/billing.service";
export { getAllRoles, getRoleByUid, createRole, updateRole, deleteRole, getAllPermissions, getUserPermissions, createUser, getAllUsers, assignUserRole, createPermission, updatePermission, deletePermission, getActiveRolesCount, getTotalPermissionsCount, getActiveClientsCount, getActive3dClientsCount, getClientUsersCount, getRoleUserCounts, getPermissionRoleCounts } from "./services/rbac.service";
export { getAuditEvents, getAuditKpis, getHashChain, getAuditApprovals, approveAuditRequest, rejectAuditRequest, getComplianceSnapshot, requestAuditExport } from "./services/audit.service";
