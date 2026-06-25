/**
 * audit.service.ts — CMS-wide Audit & Compliance API service.
 *
 * Covers the entire platform: Tenant Tower, Billing, VEBA, Money Switchboard,
 * RBAC, Tokens, Payments, Firmware, SIM, Protocol, Alarm Factory, AI Workloads.
 *
 * Endpoints:
 *   GET   /audit/events         → getAuditEvents     (filterable stream)
 *   GET   /audit/kpis           → getAuditKpis       (dashboard KPIs)
 *   GET   /audit/hash-chain     → getHashChain        (tamper evidence)
 *   GET   /audit/approvals      → getAuditApprovals   (HITL/HIC queue)
 *   PATCH /audit/approvals/{id}/approve → approveAuditRequest
 *   PATCH /audit/approvals/{id}/reject  → rejectAuditRequest
 *   GET   /audit/compliance     → getComplianceSnapshot
 *   POST  /audit/export         → requestAuditExport  (HIC-gated)
 */

import { get, post, patch, del } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ApiResponse, RequestOptions } from "../types";
import type {
  AuditEvent,
  AuditKpis,
  HashBlock,
  AuditApproval,
  ComplianceSnapshot,
  AuditFilters,
  ExportAuditPackRequest,
  ExportAuditPackResponse,
} from "../types";

/**
 * Fetch CMS-wide audit events with optional filters.
 * Supports domain, severity, actor, date range, and free-text search.
 */
export function getAuditEvents(
  filters?: AuditFilters,
  opts?: RequestOptions,
): Promise<ApiResponse<AuditEvent[]>> {
  const params: Record<string, string> = {};
  if (filters) {
    if (filters.domain)    params.domain    = filters.domain;
    if (filters.severity)  params.severity  = filters.severity;
    if (filters.actor)     params.actor     = filters.actor;
    if (filters.action)    params.action    = filters.action;
    if (filters.range)     params.range     = filters.range;
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to)   params.date_to   = filters.date_to;
    if (filters.tenant_id) params.tenant_id = filters.tenant_id;
    if (filters.search)    params.search    = filters.search;
  }
  return get<AuditEvent[]>(ENDPOINTS.AUDIT.EVENTS, { ...opts, params });
}

/** Fetch audit dashboard KPI summary. */
export function getAuditKpis(
  opts?: RequestOptions,
): Promise<ApiResponse<AuditKpis>> {
  return get<AuditKpis>(ENDPOINTS.AUDIT.KPIS, opts);
}

/** Fetch hash-chain blocks for tamper evidence verification. */
export function getHashChain(
  opts?: RequestOptions,
): Promise<ApiResponse<HashBlock[]>> {
  return get<HashBlock[]>(ENDPOINTS.AUDIT.HASH_CHAIN, opts);
}

/** Fetch cross-module HITL / HIC approval queue. */
export function getAuditApprovals(
  opts?: RequestOptions,
): Promise<ApiResponse<AuditApproval[]>> {
  return get<AuditApproval[]>(ENDPOINTS.AUDIT.APPROVALS, opts);
}

/** Approve a pending HITL/HIC request. */
export function approveAuditRequest(
  id: string,
  opts?: RequestOptions,
): Promise<ApiResponse<{ approval_id: string; status: "approved" }>> {
  return patch<{ approval_id: string; status: "approved" }>(
    `${ENDPOINTS.AUDIT.APPROVE}/${id}/approve`, {}, opts,
  );
}

/** Reject a pending HITL/HIC request. */
export function rejectAuditRequest(
  id: string,
  opts?: RequestOptions,
): Promise<ApiResponse<{ approval_id: string; status: "rejected" }>> {
  return patch<{ approval_id: string; status: "rejected" }>(
    `${ENDPOINTS.AUDIT.REJECT}/${id}/reject`, {}, opts,
  );
}

/** Fetch compliance snapshot (retention, crypto seal, gaps, approvals backlog). */
export function getComplianceSnapshot(
  opts?: RequestOptions,
): Promise<ApiResponse<ComplianceSnapshot>> {
  return get<ComplianceSnapshot>(ENDPOINTS.AUDIT.COMPLIANCE, opts);
}

/** Flag or unflag an audit event as suspicious. */
export function flagAuditEvent(
  eventId: string,
  flagged: boolean,
  opts?: RequestOptions,
): Promise<ApiResponse<{ id: string; flagged: boolean }>> {
  return patch<{ id: string; flagged: boolean }>(
    `${ENDPOINTS.AUDIT.FLAG_EVENT}/${eventId}/flag`, { flagged }, opts,
  );
}

/** Delete an audit event. */
export function deleteAuditEvent(
  eventId: string,
  opts?: RequestOptions,
): Promise<ApiResponse<{ id: string }>> {
  return del<{ id: string }>(
    `${ENDPOINTS.AUDIT.DELETE_EVENT}/${eventId}`, undefined, opts,
  );
}

/** Request an audit pack export (HIC-gated, requires approvers). */
export function requestAuditExport(
  payload: ExportAuditPackRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<ExportAuditPackResponse>> {
  return post<ExportAuditPackResponse>(ENDPOINTS.AUDIT.EXPORT, { data: payload }, opts);
}
