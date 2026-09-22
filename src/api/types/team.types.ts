/**
 * team.types.ts — a client account's own team (navas-core-apis endpoints/team.py).
 */

export type TeamRole = "client_admin" | "client_operator" | "client_viewer";

export interface TeamMe {
  account_uid: string;
  account_root: string;
  role: string;
  role_label: string;
  can_manage_team: boolean;
  roles: { role: TeamRole; label: string }[];
}

export interface TeamMember {
  account_uid: string;
  display_name: string;
  username: string;
  email: string;
  role: string;
  role_label: string;
  is_admin: boolean;
  status: "active" | "blocked" | string;
  date_created: string;
  last_login_at: string | null;
  is_me: boolean;
}

export interface AddTeamMemberRequest {
  display_name: string;
  username: string;
  email?: string;
  password: string;
  role: TeamRole;
}

export interface UpdateTeamMemberRequest {
  display_name?: string;
  role?: TeamRole;
  status?: "active" | "blocked";
}

export type TeamAuditKind = "all" | "signins" | "failed" | "team";

export interface TeamAuditEvent {
  timestamp: string;          // ISO, UTC
  who: string;
  action: string;             // LOGIN, LOGOUT, LOGIN_FAILED, TEAM_USER_ADDED, …
  detail: string;
  ip_address: string;
}
