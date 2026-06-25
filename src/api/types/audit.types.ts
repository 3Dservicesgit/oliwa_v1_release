/**
 * audit.types.ts — Types for the CMS-wide Audit & Compliance system.
 *
 * Covers every auditable domain: Tenant Tower, Billing, VEBA, Money Switchboard,
 * RBAC, Tokens, Payments, Firmware, SIM, Protocol, Alarm Factory, AI Workloads,
 * and the Audit module itself.
 */

// ── Auditable domains across the entire CMS ─────────────────────────────────

export type AuditDomain =
  | "TENANT"     // Tenant Tower — create, trash, restore, import, suspend
  | "BILLING"    // Billing & Invoicing — subscriptions, invoices, dunning
  | "VEBA"       // VEBA Escrow — settlements, disputes, payouts
  | "MONEY"      // Money Switchboard — transactions, gateways, reconciliation
  | "RBAC"       // Roles, permissions, user assignments, access denials
  | "TOKEN"      // Token Engine — mint, burn, top-up, allocate, transfer
  | "PAYMENT"    // Payment Gateways — M-Pesa, MTN, Airtel webhooks
  | "FIRMWARE"   // OTA campaigns, firmware library, rollbacks
  | "SIM"        // Signal Vault — SIM create, suspend, reactivate
  | "PROTOCOL"   // Protocol Port — decoder changes, backfill/replay jobs
  | "ALARM"      // Alarm Factory — rule CRUD, incident ack, escalation
  | "AI"         // Waswa AI — suggestions, model deploys, acceptance/reject
  | "AUDIT"      // Audit module itself — exports, retention, hash-chain
  | "CLIENT"     // Client management — CRUD, device association
  | "SYSTEM";    // System — login, logout, session, config changes

// ── Severity levels ─────────────────────────────────────────────────────────

export type AuditSeverity = "Info" | "Warn" | "Alarm" | "Crit";

// ── Core audit event (CMS-wide) ─────────────────────────────────────────────

export interface AuditEvent {
  id:          string;
  timestamp:   string;       // ISO 8601
  actor:       string;       // e.g. "sys.admin", "rbac.guard", "svc.billing"
  action:      string;       // e.g. "CREATE", "APPROVE", "BLOCK", "MINT", "EXPORT"
  object:      string;       // human-readable description of what was acted on
  domain:      AuditDomain;
  severity:    AuditSeverity;
  tenant_id?:  string;       // scoped tenant (null for global system events)
  ip_address?: string;       // source IP for security trail
  hash_prev:   string;       // previous block hash (tamper-evidence chain)
  hash_this:   string;       // current block hash
  meta?:       Record<string, unknown>; // arbitrary payload (redacted by RBAC)
  flagged?:    boolean;      // flagged as suspicious by user
}

// ── Audit KPIs (dashboard cards) ────────────────────────────────────────────

export interface AuditKpis {
  ingest_p95_seconds:   number;  // audit event ingest latency p95
  log_gaps_24h:         number;  // missing hash-chain links in last 24h
  sensitive_actions_24h: number; // pricing/refund/RBAC/mint/export events
  retention_days:       number;  // plan entitlement (e.g. 180)
}

// ── Hash-chain block (tamper evidence) ──────────────────────────────────────

export interface HashBlock {
  block_id:    number;
  hash:        string;       // SHA-256
  prev_hash:   string;
  event_count: number;       // events in this block
  created_at:  string;       // ISO 8601
  status:      "valid" | "gap" | "tampered";
}

// ── HITL / HIC approval (cross-module) ──────────────────────────────────────

export type ApprovalType = "HITL" | "HIC";

export interface AuditApproval {
  id:             string;
  type:           ApprovalType;
  title:          string;
  domain:         AuditDomain;
  tenant_name?:   string;
  requirement:    string;       // e.g. "Needs 1 approver", "Needs 2 approvers"
  status:         "pending" | "approved" | "rejected" | "expired";
  requested_at:   string;
  requested_by:   string;
  approved_by?:   string;
  resolved_at?:   string;
}

// ── Compliance snapshot ─────────────────────────────────────────────────────

export interface ComplianceItem {
  key:    string;     // e.g. "Retention OK", "Crypto seal"
  value:  string;     // e.g. "180/180 days", "valid"
  status: "ok" | "warn" | "alert";
}

export interface ComplianceSnapshot {
  items:       ComplianceItem[];
  checked_at:  string;  // ISO 8601
}

// ── Export audit pack request ───────────────────────────────────────────────

export interface ExportAuditPackRequest {
  tenant_id?:         string;
  date_range:         string;     // e.g. "last_24h", "last_7d", "custom"
  date_from?:         string;
  date_to?:           string;
  include_sub_tenants: boolean;
  formats:            ("pdf" | "csv" | "xlsx" | "json")[];
  redact_pii:         boolean;
  include_raw_payloads: boolean;
  approver_ids:       string[];   // HIC approver account UIDs
}

export interface ExportAuditPackResponse {
  export_id:    string;
  approval_id:  string;     // HIC approval created
  status:       "pending_approval";
}

// ── Filters for querying audit events ───────────────────────────────────────

export interface AuditFilters {
  domain?:    AuditDomain;
  severity?:  AuditSeverity;
  actor?:     string;
  action?:    string;
  range?:     string;          // "1h" | "6h" | "24h" | "7d" | "30d" | "custom"
  date_from?: string;
  date_to?:   string;
  tenant_id?: string;
  search?:    string;          // free-text search across object/actor
}
