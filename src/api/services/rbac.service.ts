/**
 * rbac.service.ts — RBAC Roles & Permissions API service.
 *
 * Endpoints:
 *   GET    /rbac/roles?account_root=       → getAllRoles
 *   GET    /rbac/roles/{role_uid}          → getRoleByUid
 *   POST   /rbac/roles/create             → createRole
 *   PUT    /rbac/roles/{role_uid}/update   → updateRole
 *   DELETE /rbac/roles/{role_uid}/delete   → deleteRole
 *   GET    /rbac/permissions?account_root= → getAllPermissions
 *   GET    /rbac/users/{account_uid}/permissions → getUserPermissions
 */

import { get, post, put, del } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ApiResponse, RequestOptions } from "../types";
import type {
  RbacRole,
  RbacRoleDetail,
  RbacPermission,
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
} from "../types";

/** List all roles for a given account root. */
export function getAllRoles(
  accountRoot: string,
  opts?: RequestOptions,
): Promise<ApiResponse<RbacRole[]>> {
  return get<RbacRole[]>(ENDPOINTS.RBAC.ROLES, {
    ...opts,
    params: { account_root: accountRoot, ...opts?.params },
  });
}

/** Get a single role by UID (includes permissions). */
export function getRoleByUid(
  roleUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<RbacRoleDetail>> {
  return get<RbacRoleDetail>(`${ENDPOINTS.RBAC.ROLES_BY_UID}/${roleUid}`, opts);
}

/** Create a new role with permissions. */
export function createRole(
  payload: CreateRoleRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<CreateRoleResponse>> {
  return post<CreateRoleResponse>(ENDPOINTS.RBAC.ROLES_CREATE, { data: payload }, opts);
}

/** Update a role (name, description, permissions). */
export function updateRole(
  roleUid: string,
  payload: UpdateRoleRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return put<string>(`${ENDPOINTS.RBAC.ROLES_UPDATE}/${roleUid}/update`, { data: payload }, opts);
}

/** Delete a role. */
export function deleteRole(
  roleUid: string,
  payload: DeleteRoleRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return del<string>(`${ENDPOINTS.RBAC.ROLES_DELETE}/${roleUid}/delete`, { data: payload }, opts);
}

/** List all permissions for a given account root. */
export function getAllPermissions(
  accountRoot: string,
  opts?: RequestOptions,
): Promise<ApiResponse<RbacPermission[]>> {
  return get<RbacPermission[]>(ENDPOINTS.RBAC.PERMISSIONS, {
    ...opts,
    params: { account_root: accountRoot, ...opts?.params },
  });
}

/** Get permissions for a specific user. */
export function getUserPermissions(
  accountUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<RbacUserPermissions>> {
  return get<RbacUserPermissions>(
    `${ENDPOINTS.RBAC.USER_PERMISSIONS}/${accountUid}/permissions`,
    opts,
  );
}

/** Create a new user account. */
export function createUser(
  payload: CreateUserRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<CreateUserResponse>> {
  return post<CreateUserResponse>(ENDPOINTS.USERS.CREATE, { data: payload }, opts);
}

/** Get all users for an account root. */
export function getAllUsers(
  accountRoot: string,
  opts?: RequestOptions,
): Promise<ApiResponse<UserAccount[]>> {
  return post<UserAccount[]>(ENDPOINTS.USERS.ALL, { data: { primary_account: accountRoot } }, opts);
}

/** Assign a role to an existing user. */
export function assignUserRole(
  userUid: string,
  payload: AssignRoleRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<AssignRoleResponse>> {
  return put<AssignRoleResponse>(`${ENDPOINTS.USERS.ASSIGN_ROLE}/${userUid}/assign-role`, { data: payload }, opts);
}

/** Create a new permission. */
export function createPermission(
  payload: CreatePermissionRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<CreatePermissionResponse>> {
  return post<CreatePermissionResponse>(ENDPOINTS.RBAC.PERMISSIONS_CREATE, { data: payload }, opts);
}

/** Update an existing permission. */
export function updatePermission(
  permissionUid: string,
  payload: UpdatePermissionRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return put<string>(`${ENDPOINTS.RBAC.PERMISSIONS_UPDATE}/${permissionUid}/update`, { data: payload }, opts);
}

/** Delete a permission (soft delete). */
export function deletePermission(
  permissionUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return del<string>(`${ENDPOINTS.RBAC.PERMISSIONS_DELETE}/${permissionUid}/delete`, { data: { deleted_by: "system" } }, opts);
}

// ── RBAC Dashboard Stats ──────────────────────────────────────────────────

/** Get count of active roles. */
export function getActiveRolesCount(opts?: RequestOptions): Promise<ApiResponse<{ total_active_roles: number }>> {
  return get<{ total_active_roles: number }>(ENDPOINTS.RBAC.STATS_ACTIVE_ROLES, opts);
}

/** Get count of all permissions. */
export function getTotalPermissionsCount(opts?: RequestOptions): Promise<ApiResponse<{ total_permissions: number }>> {
  return get<{ total_permissions: number }>(ENDPOINTS.RBAC.STATS_TOTAL_PERMISSIONS, opts);
}

/** Get count of actively logged-in clients (last 24h). */
export function getActiveClientsCount(opts?: RequestOptions): Promise<ApiResponse<{ total_active_clients: number }>> {
  return get<{ total_active_clients: number }>(ENDPOINTS.RBAC.STATS_ACTIVE_CLIENTS, opts);
}

/** Get count of actively logged-in 3D/internal users (last 24h). */
export function getActive3dClientsCount(opts?: RequestOptions): Promise<ApiResponse<{ total_active_3d_clients: number }>> {
  return get<{ total_active_3d_clients: number }>(ENDPOINTS.RBAC.STATS_ACTIVE_3D_CLIENTS, opts);
}

/** Get total users belonging to clients. */
export function getClientUsersCount(opts?: RequestOptions): Promise<ApiResponse<{ total_client_users: number }>> {
  return get<{ total_client_users: number }>(ENDPOINTS.RBAC.STATS_CLIENT_USERS, opts);
}

/** Get user count per role (keyed by role_uid). */
export function getRoleUserCounts(opts?: RequestOptions): Promise<ApiResponse<Record<string, number>>> {
  return get<Record<string, number>>(ENDPOINTS.RBAC.STATS_ROLE_USER_COUNTS, opts);
}

/** Get role count per permission (keyed by permission_uid). */
export function getPermissionRoleCounts(opts?: RequestOptions): Promise<ApiResponse<Record<string, number>>> {
  return get<Record<string, number>>(ENDPOINTS.RBAC.STATS_PERM_ROLE_COUNTS, opts);
}

// ── User Actions (Block / Unblock / Reset Password) ─────────────────────

/** Block (lock) a user account. */
export function blockUser(
  accountUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return post<string>(ENDPOINTS.USERS.ACTION, { data: { action: "locked", account_uid: accountUid } }, opts);
}

/** Unblock (restore) a user account. */
export function unblockUser(
  accountUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return post<string>(ENDPOINTS.USERS.ACTION, { data: { action: "active", account_uid: accountUid } }, opts);
}

/** Admin reset password — returns a temporary password. */
export function resetUserPassword(
  userUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<{ temporary_password: string; message: string }>> {
  return put<{ temporary_password: string; message: string }>(
    `${ENDPOINTS.USERS.RESET_PASSWORD}/${userUid}/reset-password`, {}, opts,
  );
}

/** Get single user details. */
export function getUserDetails(
  userUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<UserAccount>> {
  return get<UserAccount>(`${ENDPOINTS.USERS.DETAILS}/${userUid}/details`, opts);
}
