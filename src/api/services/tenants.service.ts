/**
 * tenants.service.ts — Tenant Tower API service.
 *
 * Endpoints:
 *   POST  /tenants/create           → createTenant
 *   GET   /tenants/all              → getAllTenants
 *   POST  /tenants/import           → importTenants (multipart)
 *   GET   /tenants/import/template  → downloadImportTemplate
 *   PATCH /tenants/{id}/trash       → trashTenant
 *   PATCH /tenants/{id}/restore     → restoreTenant
 *   GET   /tenants/trashed          → getTrashedTenants
 */

import { get, post, patch, getStoredAuthToken } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ApiResponse, RequestOptions } from "../types";
import type {
  Tenant,
  TenantKpis,
  TenantWallet,
  CreateTenantRequest,
  CreateTenantResponse,
  ImportTenantsResponse,
  TrashedTenant,
  TrashTenantResponse,
  RestoreTenantResponse,
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
  SaveDraftRequest,
  SaveDraftResponse,
  RequestApprovalResponse,
  SubmitDraftResponse,
} from "../types";

/** Create a new tenant or sub-org. */
export function createTenant(
  payload: CreateTenantRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<CreateTenantResponse>> {
  return post<CreateTenantResponse>(ENDPOINTS.TENANTS.CREATE, { data: payload }, opts);
}

/** Fetch every tenant (for hierarchy table & dropdowns). */
export function getAllTenants(
  opts?: RequestOptions,
): Promise<ApiResponse<Tenant[]>> {
  return get<Tenant[]>(ENDPOINTS.TENANTS.GET_ALL, opts);
}

/**
 * Bulk-import tenants from a CSV/JSON file.
 *
 * Uses FormData so the server receives a multipart upload.
 * NOTE: we bypass the JSON client and use fetch directly because
 * the Content-Type must be multipart/form-data (set automatically).
 */
export async function importTenants(
  file: File,
): Promise<ApiResponse<ImportTenantsResponse>> {
  const BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const form = new FormData();
  form.append("file", file);

  const token = getStoredAuthToken();
  const res = await fetch(`${BASE_URL}${ENDPOINTS.TENANTS.IMPORT}`, {
    method: "POST",
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    credentials: "include",
  });

  return res.json();
}

/** Download the blank CSV import template. */
export function downloadImportTemplate(): void {
  const BASE_URL = import.meta.env.VITE_API_BASE_URL;
  window.open(`${BASE_URL}${ENDPOINTS.TENANTS.IMPORT_TEMPLATE}`, "_blank");
}

/** Soft-delete a tenant. */
export function trashTenant(
  id: string,
  opts?: RequestOptions,
): Promise<ApiResponse<TrashTenantResponse>> {
  return patch<TrashTenantResponse>(`${ENDPOINTS.TENANTS.TRASH}/${id}/trash`, {}, opts);
}

/** Restore a trashed tenant. */
export function restoreTenant(
  id: string,
  opts?: RequestOptions,
): Promise<ApiResponse<RestoreTenantResponse>> {
  return patch<RestoreTenantResponse>(`${ENDPOINTS.TENANTS.RESTORE}/${id}/restore`, {}, opts);
}

/** Fetch tenant tower KPI summary. */
export function getTenantKpis(
  opts?: RequestOptions,
): Promise<ApiResponse<TenantKpis>> {
  return get<TenantKpis>(ENDPOINTS.TENANTS.KPIS, opts);
}

/** Fetch token wallet data for a specific tenant. */
export function getTenantWallet(
  id: string,
  opts?: RequestOptions,
): Promise<ApiResponse<TenantWallet>> {
  return get<TenantWallet>(`${ENDPOINTS.TENANTS.WALLET}/${id}/wallet`, opts);
}

/** Fetch all soft-deleted tenants. */
export function getTrashedTenants(
  opts?: RequestOptions,
): Promise<ApiResponse<TrashedTenant[]>> {
  return get<TrashedTenant[]>(ENDPOINTS.TENANTS.GET_TRASHED, opts);
}

/** Top-up tokens into a tenant's wallet. */
export function topUpWallet(
  payload: TopUpRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<TopUpResponse>> {
  return post<TopUpResponse>(ENDPOINTS.TENANTS.TOP_UP, { data: payload }, opts);
}

/** Allocate (transfer) tokens from parent to child tenant. */
export function allocateTokens(
  payload: AllocateRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<AllocateResponse>> {
  return post<AllocateResponse>(ENDPOINTS.TENANTS.ALLOCATE, { data: payload }, opts);
}

/** Request minting of new tokens (requires HIC approval). */
export function mintTokens(
  payload: MintRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<MintResponse>> {
  return post<MintResponse>(ENDPOINTS.TENANTS.MINT, { data: payload }, opts);
}

/** Fetch approvals queue. */
export function getApprovals(
  opts?: RequestOptions,
): Promise<ApiResponse<Approval[]>> {
  return get<Approval[]>(ENDPOINTS.TENANTS.APPROVALS, opts);
}

/** Approve a pending approval request. */
export function approveRequest(
  id: string,
  opts?: RequestOptions,
): Promise<ApiResponse<ApprovalActionResponse>> {
  return patch<ApprovalActionResponse>(`${ENDPOINTS.TENANTS.APPROVE}/${id}/approve`, {}, opts);
}

/** Reject a pending approval request. */
export function rejectRequest(
  id: string,
  opts?: RequestOptions,
): Promise<ApiResponse<ApprovalActionResponse>> {
  return patch<ApprovalActionResponse>(`${ENDPOINTS.TENANTS.REJECT}/${id}/reject`, {}, opts);
}

/** Fetch audit trail entries (hash-chained, irrefutable). */
export function getAuditTrail(
  opts?: RequestOptions,
): Promise<ApiResponse<AuditTrailEntry[]>> {
  return get<AuditTrailEntry[]>(ENDPOINTS.TENANTS.AUDIT_TRAIL, opts);
}

/** Fetch usage events ledger. */
export function getUsageEvents(
  opts?: RequestOptions,
): Promise<ApiResponse<UsageEvent[]>> {
  return get<UsageEvent[]>(ENDPOINTS.TENANTS.USAGE_EVENTS, opts);
}

/** Save a tenant onboarding draft. */
export function saveDraft(
  payload: SaveDraftRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<SaveDraftResponse>> {
  return post<SaveDraftResponse>(ENDPOINTS.TENANTS.DRAFTS, { data: payload }, opts);
}

/** Request HITL admin approval for a draft. */
export function requestDraftApproval(
  draftId: string,
  opts?: RequestOptions,
): Promise<ApiResponse<RequestApprovalResponse>> {
  return post<RequestApprovalResponse>(`${ENDPOINTS.TENANTS.DRAFT_APPROVAL}/${draftId}/request-approval`, {}, opts);
}

/** Submit an approved draft to create the actual tenant. */
export function submitApprovedDraft(
  draftId: string,
  opts?: RequestOptions,
): Promise<ApiResponse<SubmitDraftResponse>> {
  return post<SubmitDraftResponse>(`${ENDPOINTS.TENANTS.DRAFT_SUBMIT}/${draftId}/submit`, {}, opts);
}
