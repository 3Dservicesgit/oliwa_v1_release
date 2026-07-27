import React, { useEffect, useState } from "react";
import { getAllUsers, getAllRoles, getAllPermissions, assignUserRole } from "../../../../api";
import type { UserAccount, RbacRole, RbacPermission } from "../../../../api";
import { useAuth } from "../../../../auth/AuthContext";
import { MSection, StepSuccessBanner, ErrorBanner, SELECT_CLS, BTN_PRIMARY } from "./WizardShared";

interface Props {
  preSelectedUserUid?: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function StepAssignRole({ preSelectedUserUid, onSuccess, onClose }: Props) {
  const { state: { accountUid, accountRoot } } = useAuth();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [permissions, setPermissions] = useState<RbacPermission[]>([]);

  const [selectedUserUid, setSelectedUserUid] = useState(preSelectedUserUid ?? "");
  const [selectedRoleUid, setSelectedRoleUid] = useState("");
  const [rolePermUids, setRolePermUids] = useState<Set<string>>(new Set());

  const [usersLoading, setUsersLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [permsLoading, setPermsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");

  // Fetch users, roles, permissions
  useEffect(() => {
    setUsersLoading(true);
    setRolesLoading(true);
    setPermsLoading(true);
    if (!accountRoot) return;
    getAllUsers(accountRoot)
      .then((res) => setUsers(res.data))
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false));
    getAllRoles(accountRoot)
      .then((res) => setRoles(res.data))
      .catch(() => setRoles([]))
      .finally(() => setRolesLoading(false));
    getAllPermissions(accountRoot)
      .then((res) => setPermissions(res.data))
      .catch(() => setPermissions([]))
      .finally(() => setPermsLoading(false));
  }, [accountRoot]);

  // When a role is selected, show its permissions
  useEffect(() => {
    if (!selectedRoleUid) {
      setRolePermUids(new Set());
      return;
    }
    const role = roles.find((r) => r.role_uid === selectedRoleUid);
    if (role?.permissions) {
      setRolePermUids(new Set(role.permissions.map((p) => p.permission_uid)));
    } else {
      setRolePermUids(new Set());
    }
  }, [selectedRoleUid, roles]);

  async function handleSubmit() {
    if (!selectedUserUid || !selectedRoleUid) return;
    const role = roles.find((r) => r.role_uid === selectedRoleUid);
    if (!role) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await assignUserRole(selectedUserUid, {
        role_name: role.role_name,
        updated_by: accountUid ?? "system",
      });
      const user = users.find((u) => u.account_uid === selectedUserUid);
      setSuccess(`Role "${role.role_name}" assigned to ${user?.account_name ?? selectedUserUid} successfully.`);
      onSuccess();
    } catch (err: any) {
      setError(err?.apiMessage ?? err?.message ?? "Failed to assign role");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedRole = roles.find((r) => r.role_uid === selectedRoleUid);

  // Group permissions by module
  const byModule = permissions.reduce<Record<string, RbacPermission[]>>((acc, p) => {
    const mod = p.permission_module;
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(p);
    return acc;
  }, {});

  const rolePermCount = rolePermUids.size;

  const filteredUsers = users.filter(
    (u) =>
      !userSearch ||
      u.account_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const canSubmit = selectedUserUid && selectedRoleUid && !submitting;

  return (
    <div>
      {success && <StepSuccessBanner message={success} onClose={onClose} />}
      {error && <ErrorBanner message={error} />}

      {/* Select User */}
      <MSection title="1. Select User">
        {usersLoading ? (
          <div className="text-[12px] text-[#667781]">Loading users...</div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users by name, username, or email..."
              className="w-full h-9 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] bg-white outline-none focus:border-[#128C7E]"
            />
            <div className="max-h-[200px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex flex-col gap-1">
              {filteredUsers.length === 0 ? (
                <div className="text-[12px] text-[#667781] py-2">No users found.</div>
              ) : (
                filteredUsers.map((u) => (
                  <label
                    key={u.account_uid}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      selectedUserUid === u.account_uid
                        ? "bg-[#EAF7F3] border border-[#128C7E]"
                        : "bg-white border border-[#E9EDEF] hover:bg-[#F8FAFC]"
                    }`}
                    onClick={() => setSelectedUserUid(u.account_uid)}
                  >
                    <input
                      type="radio"
                      name="wizard-user"
                      checked={selectedUserUid === u.account_uid}
                      onChange={() => setSelectedUserUid(u.account_uid)}
                      className="accent-[#128C7E]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-black text-[#111B21]">{u.account_name}</div>
                      <div className="text-[10px] text-[#667781]">
                        {u.username} &mdash; {u.email}
                      </div>
                    </div>
                    <div className="text-[10px] text-[#667781] shrink-0">
                      <span className="bg-[#F0F2F5] px-1.5 py-0.5 rounded-full font-black">{u.account_role}</span>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        )}
      </MSection>

      {/* Select Role */}
      <MSection title="2. Select Role">
        {rolesLoading ? (
          <div className="text-[12px] text-[#667781]">Loading roles...</div>
        ) : (
          <div className="flex flex-col gap-2">
            <select value={selectedRoleUid} onChange={(e) => setSelectedRoleUid(e.target.value)} className={SELECT_CLS}>
              <option value="">-- Select a role --</option>
              {roles.map((r) => (
                <option key={r.role_uid} value={r.role_uid}>
                  {r.role_name}
                </option>
              ))}
            </select>
            {selectedRole && (
              <div className="text-[11px] text-[#667781] px-1">{selectedRole.role_description || "No description"}</div>
            )}
          </div>
        )}
      </MSection>

      {/* Role Permissions (read-only) */}
      <MSection title={`3. Role Permissions (${rolePermCount} included)`}>
        {permsLoading ? (
          <div className="text-[12px] text-[#667781] text-center py-4">Loading permissions...</div>
        ) : !selectedRoleUid ? (
          <div className="text-[12px] text-[#667781] text-center py-4">Select a role above to see its permissions</div>
        ) : rolePermCount === 0 ? (
          <div className="text-[12px] text-[#667781] text-center py-4">This role has no permissions assigned</div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-[10px] text-[#667781] pb-2 border-b border-[#E9EDEF]">
              These permissions are defined by the role. To modify them, edit the role directly.
            </div>
            {Object.entries(byModule).map(([mod, perms]) => {
              const modulePerms = perms.filter((p) => rolePermUids.has(p.permission_uid));
              if (modulePerms.length === 0) return null;
              return (
                <div key={mod}>
                  <div className="text-[11px] font-black text-[#667781] uppercase mb-1.5">{mod}</div>
                  <div className="flex flex-col gap-1.5 pl-1">
                    {modulePerms.map((p) => (
                      <div key={p.permission_uid} className="flex items-center gap-2.5 text-[12px]">
                        <span className="w-2 h-2 rounded-full bg-[#128C7E] shrink-0" />
                        <span className="font-black text-[#111B21]">{p.permission_name}</span>
                        <span className="text-[#667781] text-[11px]">{p.permission_description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </MSection>

      {/* Submit */}
      <div className="flex justify-end">
        <button onClick={handleSubmit} disabled={!canSubmit} className={BTN_PRIMARY}>
          {submitting ? "Assigning..." : "Assign Role"}
        </button>
      </div>
    </div>
  );
}
