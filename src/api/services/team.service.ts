/**
 * team.service.ts — a client account's own team and its sign-in history.
 *
 *   GET    /team/me
 *   GET    /team/members
 *   POST   /team/members
 *   PUT    /team/members/{uid}
 *   POST   /team/members/{uid}/reset-password
 *   DELETE /team/members/{uid}
 *   GET    /team/audit?days=&kind=
 *
 * The server limits every call to the signed-in user's own client account.
 */
import { get, post, put, del } from "../client";
import type { ApiResponse } from "../types";
import type {
  AddTeamMemberRequest,
  TeamAuditEvent,
  TeamAuditKind,
  TeamMe,
  TeamMember,
  UpdateTeamMemberRequest,
} from "../types/team.types";

const enc = encodeURIComponent;

export function getTeamMe(): Promise<ApiResponse<TeamMe>> {
  return get<TeamMe>("/team/me");
}

export function getTeamMembers(): Promise<ApiResponse<TeamMember[]>> {
  return get<TeamMember[]>("/team/members");
}

export function addTeamMember(req: AddTeamMemberRequest): Promise<ApiResponse<{ account_uid: string }>> {
  return post<{ account_uid: string }>("/team/members", { data: req });
}

export function updateTeamMember(uid: string, req: UpdateTeamMemberRequest): Promise<ApiResponse<string>> {
  return put<string>(`/team/members/${enc(uid)}`, { data: req });
}

export function resetTeamMemberPassword(uid: string): Promise<ApiResponse<{ temporary_password: string; username: string }>> {
  return post<{ temporary_password: string; username: string }>(`/team/members/${enc(uid)}/reset-password`, { data: {} });
}

export function removeTeamMember(uid: string): Promise<ApiResponse<string>> {
  return del<string>(`/team/members/${enc(uid)}`);
}

export function getTeamAudit(days: number, kind: TeamAuditKind): Promise<ApiResponse<TeamAuditEvent[]>> {
  return get<TeamAuditEvent[]>(`/team/audit?days=${days}&kind=${kind}`);
}
