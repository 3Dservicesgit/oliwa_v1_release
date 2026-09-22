/**
 * rbac.types.ts — Types for Roles, Permissions & RBAC endpoints.
 *
 * Matches backend responses from /rbac/roles and /rbac/permissions.
 */

// ── Permission ───────────────────────────────────────────────────────────────

export interface RbacPermission {
  permission_uid: string;
  permission_name: string;
  permission_description: string;
  permission_module: string;
  account_root?: string;
  created_by?: string;
  created_at?: string;
}

// ── Role ─────────────────────────────────────────────────────────────────────

export interface RbacRole {
  role_uid: string;
  role_name: string;
  role_description: string;
  account_root: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  permissions?: RbacPermission[];
}

// ── Role Detail (single role with permissions) ───────────────────────────────

export interface RbacRoleDetail extends RbacRole {
  permissions: RbacPermission[];
}

// ── User Permissions ─────────────────────────────────────────────────────────

export interface RbacUserPermissions {
  role: string;
  role_uid: string;
  permissions: RbacPermission[];
  /** The account's type (e.g. "customer", "client", "system_user"). */
  account_type?: string | null;
  /** True for a fleet customer's login — decided by the server. */
  is_customer?: boolean;
  display_name?: string;
  username?: string;
  /** The client account this login belongs to (account_root). */
  client_uid?: string;
  /** The client's name, e.g. "Mukwano Co Ltd". */
  client_name?: string;
}

// ── Create Role ──────────────────────────────────────────────────────────────

export interface CreateRoleRequest {
  role_name: string;
  role_description: string;
  account_root: string;
  created_by: string;
  permissions: string[];
}

export interface CreateRoleResponse {
  role_uid: string;
}

// ── Update Role ──────────────────────────────────────────────────────────────

export interface UpdateRoleRequest {
  role_name?: string;
  role_description?: string;
  permissions?: string[];
  updated_by: string;
}

// ── Delete Role ──────────────────────────────────────────────────────────────

export interface DeleteRoleRequest {
  deleted_by: string;
}

// ── Create User ─────────────────────────────────────────────────────────────

export interface CreateUserRequest {
  account_name: string;
  username: string;
  account_type: string;
  assigned_role: string;
  email: string;
  password: string;
  root_account: string;
  author: string;
  billing_type: string;
}

export interface CreateUserResponse {
  account_uid: string;
}

// ── Assign Role to User ─────────────────────────────────────────────────────

export interface AssignRoleRequest {
  role_name: string;
  updated_by: string;
}

export interface AssignRoleResponse {
  account_uid: string;
  role_name: string;
}

// ── User (from /users/all) ──────────────────────────────────────────────────

export interface UserAccount {
  account_uid: string;
  account_name: string;
  username: string;
  email: string;
  account_type: string;
  account_role: string;
  access_status: string;
  primary_account: string;
  date_created: string;
}

// ── Create Permission ───────────────────────────────────────────────────────

export interface CreatePermissionRequest {
  permission_name: string;
  permission_description: string;
  permission_module: string;
  account_root: string;
  created_by: string;
}

export interface CreatePermissionResponse {
  permission_uid: string;
}

// ── Update Permission ─────────────────────────────────────────────────────

export interface UpdatePermissionRequest {
  permission_name?: string;
  permission_description?: string;
  permission_module?: string;
}

// ── Delete Permission ─────────────────────────────────────────────────────

export interface DeletePermissionRequest {
  deleted_by: string;
}

// ── RBAC Stats ──────────────────────────────────────────────────────────────

export interface RbacStats {
  total_active_roles: number;
  total_permissions: number;
  total_active_clients: number;
  total_active_3d_clients: number;
  total_client_users: number;
}
