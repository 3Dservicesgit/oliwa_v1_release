/**
 * AccountRoutes — the two account-level pages, which differ by who is signed in.
 *
 *   User Management: a customer manages their own team (TeamPage); staff get
 *                    the platform RBAC console (RbacPage).
 *   Audit Trail:     a customer sees their account's sign-ins and team changes
 *                    (TeamAuditPage); staff get the platform audit (AuditPage).
 */
import React from "react";
import { usePermissions } from "../../auth/PermissionsContext";
import { RbacPage } from "../rbac";
import { AuditPage } from "../audit";
import { TeamPage } from "./TeamPage";
import { TeamAuditPage } from "./TeamAuditPage";

export function UserManagementRoute() {
  const { isCustomer } = usePermissions();
  return isCustomer ? <TeamPage /> : <RbacPage />;
}

export function AuditTrailRoute() {
  const { isCustomer } = usePermissions();
  return isCustomer ? <TeamAuditPage /> : <AuditPage />;
}
