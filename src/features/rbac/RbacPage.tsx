/**
 * RbacPage — Customer User Management
 *
 * Lets a customer admin manage their team:
 *   - View all users under their account
 *   - Block / Restore (unblock) users
 *   - Reset passwords
 *   - Manage account details (role, email)
 *
 * SECURITY: Users are scoped to the customer's root_account (ownerUid).
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getCookie } from "../../utils/cookies";
import {
  getAllUsers,
  blockUser,
  unblockUser,
  deleteUser,
  resetUserPassword,
  assignUserRole,
  getAllRoles,
  createUser,
} from "../../api";
import type { UserAccount, RbacRole } from "../../api";

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(isoStr: string): string {
  try {
    if (!isoStr) return "—";
    const now = Date.now();
    const then = new Date(isoStr).getTime();
    const diffMs = now - then;
    if (isNaN(diffMs) || diffMs < 0) return isoStr;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return isoStr.split("T")[0] || isoStr;
  } catch {
    return isoStr;
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_COLORS = [
  "bg-[#128C7E]", "bg-[#3B82F6]", "bg-[#F97316]", "bg-[#8B5CF6]",
  "bg-[#EF4444]", "bg-[#25D366]", "bg-[#E11D48]", "bg-[#0891B2]",
];
function avatarColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error" | "info"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const bg = type === "success" ? "bg-[#128C7E]" : type === "error" ? "bg-[#EF4444]" : "bg-[#3B82F6]";
  return (
    <div className={`fixed top-4 right-4 z-[300] ${bg} text-white px-4 py-2.5 rounded-xl shadow-lg text-[12px] font-black max-w-[360px] flex items-center gap-2`}>
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="text-white/80 hover:text-white text-[14px] bg-transparent border-none cursor-pointer">✕</button>
    </div>
  );
}

// ── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  title, message, confirmLabel = "Confirm", confirmColor = "bg-[#128C7E]",
  onConfirm, onCancel, loading = false,
}: {
  title: string; message: string; confirmLabel?: string; confirmColor?: string;
  onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl p-5 w-full max-w-[380px] mx-4">
        <h3 className="font-black text-[14px] text-[#111B21] mb-2">{title}</h3>
        <p className="text-[12px] text-[#667781] mb-4 leading-relaxed">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} disabled={loading} className="h-8 px-4 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] transition-all disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className={`h-8 px-4 rounded-lg ${confirmColor} text-white text-[11px] font-black border-none cursor-pointer hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-1.5`}>
            {loading && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Manage Account Drawer ────────────────────────────────────────────────────

function ManageDrawer({
  user, roles, onClose, onSaved,
}: {
  user: UserAccount; roles: RbacRole[]; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const { state: authState } = useAuth();
  const actorUid = authState.accountUid || getCookie("_nvxs_account_uid") || "";
  const [selectedRole, setSelectedRole] = useState(user.account_role || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedRole || selectedRole === user.account_role) { onClose(); return; }
    setSaving(true);
    try {
      await assignUserRole(user.account_uid, { role_name: selectedRole, updated_by: actorUid });
      onSaved(`Role updated to "${selectedRole}" for ${user.account_name}`);
    } catch {
      onSaved("Failed to update role");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black/30" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-[210] w-full max-w-[380px] bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-[#E9EDEF] flex items-center justify-between">
          <div>
            <h2 className="font-black text-[14px] text-[#111B21]">Manage Account</h2>
            <p className="text-[11px] text-[#667781] mt-0.5">Update user settings</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-[#F0F2F5] border-none text-[14px] text-[#667781] cursor-pointer hover:bg-[#E9EDEF] flex items-center justify-center">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* User Info */}
          <div className="flex items-center gap-3 p-3 bg-[#F0F2F5] rounded-xl">
            <div className={`w-10 h-10 rounded-full ${avatarColor(user.account_uid)} flex items-center justify-center text-white text-[13px] font-black shrink-0`}>
              {initials(user.account_name)}
            </div>
            <div className="min-w-0">
              <div className="font-black text-[13px] text-[#111B21] truncate">{user.account_name}</div>
              <div className="text-[11px] text-[#667781] truncate">@{user.username}</div>
            </div>
          </div>

          {/* Details (read-only) */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black text-[#667781] uppercase tracking-wide">Email</label>
            <div className="h-9 px-3 rounded-lg bg-[#F8FAFC] border border-[#E9EDEF] flex items-center text-[12px] text-[#111B21]">{user.email || "—"}</div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black text-[#667781] uppercase tracking-wide">Account Type</label>
            <div className="h-9 px-3 rounded-lg bg-[#F8FAFC] border border-[#E9EDEF] flex items-center text-[12px] text-[#111B21]">{user.account_type || "—"}</div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black text-[#667781] uppercase tracking-wide">Status</label>
            <div className="h-9 px-3 rounded-lg bg-[#F8FAFC] border border-[#E9EDEF] flex items-center text-[12px]">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black ${user.access_status === "active" ? "bg-[#128C7E]/10 text-[#128C7E]" : "bg-[#EF4444]/10 text-[#EF4444]"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${user.access_status === "active" ? "bg-[#128C7E]" : "bg-[#EF4444]"}`} />
                {user.access_status === "active" ? "Active" : "Blocked"}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black text-[#667781] uppercase tracking-wide">Joined</label>
            <div className="h-9 px-3 rounded-lg bg-[#F8FAFC] border border-[#E9EDEF] flex items-center text-[12px] text-[#111B21]">{user.date_created || "—"}</div>
          </div>

          {/* Role (editable) */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black text-[#667781] uppercase tracking-wide">Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="h-9 px-3 rounded-lg bg-white border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] cursor-pointer"
            >
              <option value="">— Select Role —</option>
              {roles.map((r) => (
                <option key={r.role_uid} value={r.role_name}>{r.role_name}</option>
              ))}
              {/* Fallback: if user's current role isn't in the roles list, show it */}
              {user.account_role && !roles.some((r) => r.role_name === user.account_role) && (
                <option value={user.account_role}>{user.account_role}</option>
              )}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-3 border-t border-[#E9EDEF] flex gap-2 justify-end">
          <button onClick={onClose} disabled={saving} className="h-8 px-4 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] transition-all disabled:opacity-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !selectedRole || selectedRole === user.account_role}
            className="h-8 px-4 rounded-lg bg-[#128C7E] text-white text-[11px] font-black border-none cursor-pointer hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </>
  );
}

// ── Reset Password Result Modal ──────────────────────────────────────────────

function TempPasswordModal({ password, userName, onClose }: { password: string; userName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(password).then(() => setCopied(true)).catch(() => {});
  };
  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-5 w-full max-w-[400px] mx-4">
        <h3 className="font-black text-[14px] text-[#111B21] mb-1">Password Reset Successful</h3>
        <p className="text-[12px] text-[#667781] mb-3">Temporary password for <strong>{userName}</strong>:</p>
        <div className="flex items-center gap-2 bg-[#F0F2F5] rounded-lg p-3 mb-3">
          <code className="flex-1 text-[14px] font-mono font-black text-[#111B21] select-all">{password}</code>
          <button onClick={handleCopy} className="h-7 px-3 rounded-lg bg-[#128C7E] text-white text-[10px] font-black border-none cursor-pointer hover:brightness-110 transition-all">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="text-[11px] text-[#F97316] mb-4">Share this securely. The user should change it on next login.</p>
        <div className="flex justify-end">
          <button onClick={onClose} className="h-8 px-4 rounded-lg bg-[#128C7E] text-white text-[11px] font-black border-none cursor-pointer hover:brightness-110 transition-all">Done</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Team Member Drawer ───────────────────────────────────────────────────

function AddMemberDrawer({
  roles, clientUid, onClose, onCreated,
}: {
  roles: RbacRole[]; clientUid: string; onClose: () => void; onCreated: (msg: string) => void;
}) {
  const { state: authState } = useAuth();
  const actorUid = authState.accountUid || getCookie("_nvxs_account_uid") || "";

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = fullName.trim().length >= 3 && username.trim().length >= 3 && email.trim().length >= 5 && password.trim().length >= 5 && role.length > 0;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    try {
      await createUser({
        account_name: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim(),
        password: password.trim(),
        assigned_role: role,
        account_type: "client",
        root_account: clientUid,
        author: actorUid,
        billing_type: "none",
      });
      onCreated(`Team member "${fullName.trim()}" created successfully`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create user";
      // Check for username already taken
      if (msg.toLowerCase().includes("username")) {
        setError("Username is already taken. Please choose a different one.");
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black/30" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-[210] w-full max-w-[400px] bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-[#E9EDEF] flex items-center justify-between">
          <div>
            <h2 className="font-black text-[14px] text-[#111B21]">Add Team Member</h2>
            <p className="text-[11px] text-[#667781] mt-0.5">Create a new user for your account</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-[#F0F2F5] border-none text-[14px] text-[#667781] cursor-pointer hover:bg-[#E9EDEF] flex items-center justify-center">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FEF2F2] border border-[#FECACA]">
              <span className="text-[11px] text-[#EF4444] font-black flex-1">{error}</span>
              <button onClick={() => setError("")} className="text-[#EF4444] text-[12px] font-black bg-transparent border-none cursor-pointer">✕</button>
            </div>
          )}

          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black text-[#667781] uppercase tracking-wide">Full Name *</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Doe"
              className="h-9 px-3 rounded-lg bg-white border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] transition-all"
            />
          </div>

          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black text-[#667781] uppercase tracking-wide">Username *</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              placeholder="e.g. johndoe"
              className="h-9 px-3 rounded-lg bg-white border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] transition-all"
            />
            <span className="text-[10px] text-[#667781]">No spaces. This is used to log in.</span>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black text-[#667781] uppercase tracking-wide">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. john@company.com"
              className="h-9 px-3 rounded-lg bg-white border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] transition-all"
            />
          </div>

          {/* Role */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black text-[#667781] uppercase tracking-wide">Role *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-9 px-3 rounded-lg bg-white border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] cursor-pointer"
            >
              <option value="">— Select Role —</option>
              {roles.map((r) => (
                <option key={r.role_uid} value={r.role_name}>{r.role_name}</option>
              ))}
            </select>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black text-[#667781] uppercase tracking-wide">Password *</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 5 characters"
                className="h-9 w-full px-3 pr-10 rounded-lg bg-white border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[14px] text-[#667781] bg-transparent border-none cursor-pointer hover:text-[#111B21]"
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
            <span className="text-[10px] text-[#667781]">The user should change this on first login.</span>
          </div>

          {/* Info box */}
          <div className="bg-[#F0F2F5] rounded-xl p-3 mt-1">
            <div className="text-[10px] font-black text-[#128C7E] mb-1">What happens next?</div>
            <div className="text-[10px] text-[#667781] leading-relaxed">
              The new team member will be able to log in immediately with the username and password you set. Share the credentials securely.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-3 border-t border-[#E9EDEF] flex gap-2 justify-end">
          <button onClick={onClose} disabled={saving} className="h-8 px-4 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] transition-all disabled:opacity-50">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={saving || !canSubmit}
            className="h-8 px-4 rounded-lg bg-[#128C7E] text-white text-[11px] font-black border-none cursor-pointer hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            Create Member
          </button>
        </div>
      </div>
    </>
  );
}

// ── Tab type ─────────────────────────────────────────────────────────────────
type UserTab = "team" | "blocked" | "deactivated" | "all";

// ── Page ─────────────────────────────────────────────────────────────────────

export function RbacPage() {
  const { state: authState } = useAuth();
  const ownerUid = authState.accountUid || getCookie("_nvxs_account_uid") || "";
  const accountRoot = authState.accountRoot || getCookie("_nvxs_account_root") || "";

  /**
   * The customer's client UID — used to scope user fetching.
   * Backend: SELECT * FROM dll_access_relay WHERE account_root = <clientUid>
   * This returns only the customer's team members, never system users.
   */
  const clientUid = accountRoot || ownerUid;

  // Data
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs & filters
  const [activeTab, setActiveTab] = useState<UserTab>("team");
  const [search, setSearch] = useState("");

  // Modals/drawers
  const [confirmAction, setConfirmAction] = useState<{ user: UserAccount; action: "block" | "unblock" | "reset" } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [manageUser, setManageUser] = useState<UserAccount | null>(null);
  const [tempPassword, setTempPassword] = useState<{ password: string; userName: string } | null>(null);
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const fetchedRef = useRef(false);

  // ── Fetch customer team members ──────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      if (!clientUid) return;
      const res = await getAllUsers(clientUid);
      setUsers(Array.isArray(res?.data) ? res.data : []);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [clientUid]);

  const fetchRoles = useCallback(async () => {
    try {
      // Fetch roles scoped to the customer's account, fallback to "engine"
      const res = await getAllRoles(clientUid || "engine");
      setRoles(Array.isArray(res?.data) ? res.data : []);
    } catch {
      // no-op
    }
  }, [clientUid]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchUsers();
      fetchRoles();
    }
  }, [fetchUsers, fetchRoles]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    const { user, action } = confirmAction;
    try {
      if (action === "block") {
        await blockUser(user.account_uid);
        setToast({ message: `${user.account_name} has been blocked`, type: "success" });
      } else if (action === "unblock") {
        await unblockUser(user.account_uid);
        setToast({ message: `${user.account_name} has been restored`, type: "success" });
      } else if (action === "delete") {
        await deleteUser(user.account_uid);
        setToast({ message: `${user.account_name} has been removed`, type: "success" });
      } else if (action === "reset") {
        const res = await resetUserPassword(user.account_uid);
        const pwd = res?.data?.temporary_password;
        if (pwd) {
          setTempPassword({ password: pwd, userName: user.account_name });
        } else {
          setToast({ message: "Password reset successful", type: "success" });
        }
      }
      setConfirmAction(null);
      fetchUsers();
    } catch {
      setToast({ message: `Failed to ${action} user`, type: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Derived stats ────────────────────────────────────────────────────────
  const liveUsers = users.filter((u) => u.access_status !== "deactivated");
  const deactivatedUsers = users.filter((u) => u.access_status === "deactivated");
  const totalUsers = liveUsers.length;
  const activeCount = liveUsers.filter((u) => u.access_status === "active").length;
  const blockedCount = liveUsers.filter((u) => u.access_status === "locked" || u.access_status === "blocked").length;
  const deactivatedCount = deactivatedUsers.length;

  // ── Tab-scoped + search-filtered users ───────────────────────────────────
  const tabUsers = activeTab === "blocked"
    ? liveUsers.filter((u) => u.access_status !== "active")
    : activeTab === "deactivated"
    ? deactivatedUsers
    : liveUsers;

  const filteredUsers = tabUsers.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.account_name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.account_role || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <main className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-3 p-3">

          {/* Header */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <div className="flex items-baseline gap-3">
              <span className="font-black text-[18px] text-[#111B21] tracking-wide">USER MANAGEMENT</span>
              <span className="text-[13px] text-[#667781]">— Manage your team members</span>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Team Members" value={String(totalUsers)} color="teal" loading={loading} onClick={() => setActiveTab("all")} />
            <KpiCard label="Active" value={String(activeCount)} color="green" loading={loading} onClick={() => setActiveTab("all")} />
            <KpiCard
              label="Blocked"
              value={String(blockedCount)}
              color="red"
              loading={loading}
              onClick={blockedCount > 0 ? () => setActiveTab("blocked") : undefined}
            />
            <KpiCard
              label="Deactivated"
              value={String(deactivatedCount)}
              color="red"
              loading={loading}
              onClick={deactivatedCount > 0 ? () => setActiveTab("deactivated") : undefined}
            />
          </div>

          {/* Tab Bar + Search + Refresh */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3 flex flex-wrap items-center gap-2">
            {/* Tabs */}
            <div className="flex gap-1.5 mr-2">
              <TabBtn active={activeTab === "team"} onClick={() => setActiveTab("team")} label="All Team" count={totalUsers} />
              <TabBtn active={activeTab === "blocked"} onClick={() => setActiveTab("blocked")} label="Blocked" count={blockedCount} danger />
              <TabBtn active={activeTab === "deactivated"} onClick={() => setActiveTab("deactivated")} label="Deactivated" count={deactivatedCount} danger />
            </div>

            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, username, email, or role..."
              className="h-8 flex-1 min-w-[180px] px-3 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] focus:bg-white transition-all"
            />

            {/* Refresh */}
            <button
              onClick={() => { fetchUsers(); fetchRoles(); }}
              className="h-8 px-3 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] transition-all flex items-center gap-1"
            >
              <span>&#8635;</span> Refresh
            </button>

            {/* Add Member */}
            <button
              onClick={() => setAddDrawerOpen(true)}
              className="h-8 px-3 rounded-lg bg-[#128C7E] text-white text-[11px] font-black border-none cursor-pointer hover:brightness-110 transition-all flex items-center gap-1"
            >
              + Add Member
            </button>
          </div>

          {/* Users Table */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
            {/* Table heading */}
            <div className="px-4 py-2.5 border-b border-[#E9EDEF] bg-[#F8FAFC]">
              <span className="font-black text-[12px] text-[#111B21]">
                {activeTab === "blocked" ? "Blocked Users" : activeTab === "deactivated" ? "Deactivated Users" : "Team Members"}
              </span>
              <span className="text-[11px] text-[#667781] ml-2">
                {activeTab === "blocked"
                  ? "These users cannot log in until restored"
                  : activeTab === "deactivated"
                  ? "These accounts have been permanently removed"
                  : `Showing users under your account`}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[12px] text-[#667781]">Loading team members...</span>
                </div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-[28px] mb-2">{activeTab === "blocked" ? "🔓" : "👥"}</div>
                <p className="text-[13px] font-black text-[#111B21] mb-1">
                  {activeTab === "blocked"
                    ? "No Blocked Users"
                    : search ? "No Matching Users" : "No Team Members Found"}
                </p>
                <p className="text-[12px] text-[#667781]">
                  {activeTab === "blocked"
                    ? "All team members currently have active access."
                    : search ? "Try adjusting your search." : "Your team members will appear here."}
                </p>
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="mt-2 h-8 px-3 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] transition-all"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[#E9EDEF]">
                      <th className="text-left px-4 py-2.5 font-black text-[10px] text-[#667781] uppercase tracking-wide">User</th>
                      <th className="text-left px-4 py-2.5 font-black text-[10px] text-[#667781] uppercase tracking-wide">Email</th>
                      <th className="text-left px-4 py-2.5 font-black text-[10px] text-[#667781] uppercase tracking-wide">Role</th>
                      <th className="text-left px-4 py-2.5 font-black text-[10px] text-[#667781] uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-2.5 font-black text-[10px] text-[#667781] uppercase tracking-wide">Joined</th>
                      <th className="text-right px-4 py-2.5 font-black text-[10px] text-[#667781] uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const isActive = u.access_status === "active";
                      const isDeactivated = u.access_status === "deactivated";
                      const isSelf = u.account_uid === ownerUid;
                      return (
                        <tr key={u.account_uid} className="border-b border-[#E9EDEF] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                          {/* User cell */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-full ${avatarColor(u.account_uid)} flex items-center justify-center text-white text-[11px] font-black shrink-0`}>
                                {initials(u.account_name)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-black text-[12px] text-[#111B21] truncate flex items-center gap-1.5">
                                  {u.account_name}
                                  {isSelf && <span className="text-[9px] bg-[#128C7E]/10 text-[#128C7E] px-1.5 py-0.5 rounded-full font-black">You</span>}
                                </div>
                                <div className="text-[10px] text-[#667781] truncate">@{u.username}</div>
                              </div>
                            </div>
                          </td>
                          {/* Email */}
                          <td className="px-4 py-3 text-[#667781]">{u.email || "—"}</td>
                          {/* Role */}
                          <td className="px-4 py-3">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-[#F0F2F5] text-[10px] font-black text-[#111B21]">
                              {u.account_role || "—"}
                            </span>
                          </td>
                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black ${
                              isActive ? "bg-[#128C7E]/10 text-[#128C7E]"
                              : isDeactivated ? "bg-[#667781]/10 text-[#667781]"
                              : "bg-[#EF4444]/10 text-[#EF4444]"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                isActive ? "bg-[#128C7E]" : isDeactivated ? "bg-[#667781]" : "bg-[#EF4444]"
                              }`} />
                              {isActive ? "Active" : isDeactivated ? "Deactivated" : "Blocked"}
                            </span>
                          </td>
                          {/* Joined */}
                          <td className="px-4 py-3 text-[#667781]">{timeAgo(u.date_created)}</td>
                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Manage Account */}
                              <ActionBtn
                                label="Manage"
                                icon="⚙"
                                onClick={() => setManageUser(u)}
                              />
                              {/* Reset Password */}
                              {!isSelf && (
                                <ActionBtn
                                  label="Reset Pwd"
                                  icon="🔑"
                                  onClick={() => setConfirmAction({ user: u, action: "reset" })}
                                />
                              )}
                              {/* Block / Restore */}
                              {!isSelf && !isDeactivated && (
                                isActive ? (
                                  <ActionBtn
                                    label="Block"
                                    icon="🚫"
                                    color="text-[#EF4444]"
                                    onClick={() => setConfirmAction({ user: u, action: "block" })}
                                  />
                                ) : (
                                  <ActionBtn
                                    label="Restore"
                                    icon="✓"
                                    color="text-[#128C7E]"
                                    onClick={() => setConfirmAction({ user: u, action: "unblock" })}
                                  />
                                )
                              )}
                              {/* Delete (deactivate) */}
                              {!isSelf && !isDeactivated && (
                                <ActionBtn
                                  label="Delete"
                                  icon="🗑"
                                  color="text-[#EF4444]"
                                  onClick={() => setConfirmAction({ user: u, action: "delete" })}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer count */}
            {!loading && filteredUsers.length > 0 && (
              <div className="px-4 py-2 border-t border-[#E9EDEF] bg-[#F8FAFC] text-[10px] text-[#667781]">
                Showing {filteredUsers.length} of {activeTab === "blocked" ? blockedCount : activeTab === "deactivated" ? deactivatedCount : totalUsers} {activeTab === "blocked" ? "blocked users" : activeTab === "deactivated" ? "deactivated users" : "team members"}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Confirm Dialog */}
      {confirmAction && (
        <ConfirmDialog
          title={
            confirmAction.action === "delete" ? "Delete User" :
            confirmAction.action === "block" ? "Block User" :
            confirmAction.action === "unblock" ? "Restore User" : "Reset Password"
          }
          message={
            confirmAction.action === "delete"
              ? `Are you sure you want to permanently remove "${confirmAction.user.account_name}"? This action cannot be undone.`
              : confirmAction.action === "block"
              ? `Are you sure you want to block "${confirmAction.user.account_name}"? They will not be able to log in until restored.`
              : confirmAction.action === "unblock"
              ? `Restore "${confirmAction.user.account_name}"? They will regain access to the platform.`
              : `Reset the password for "${confirmAction.user.account_name}"? A temporary password will be generated.`
          }
          confirmLabel={
            confirmAction.action === "delete" ? "Delete User" :
            confirmAction.action === "block" ? "Block User" :
            confirmAction.action === "unblock" ? "Restore User" : "Reset Password"
          }
          confirmColor={confirmAction.action === "delete" || confirmAction.action === "block" ? "bg-[#EF4444]" : "bg-[#128C7E]"}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
          loading={actionLoading}
        />
      )}

      {/* Add Team Member Drawer */}
      {addDrawerOpen && (
        <AddMemberDrawer
          roles={roles}
          clientUid={clientUid}
          onClose={() => setAddDrawerOpen(false)}
          onCreated={(msg) => { setAddDrawerOpen(false); setToast({ message: msg, type: "success" }); fetchUsers(); }}
        />
      )}

      {/* Manage Account Drawer */}
      {manageUser && (
        <ManageDrawer
          user={manageUser}
          roles={roles}
          onClose={() => setManageUser(null)}
          onSaved={(msg) => { setManageUser(null); setToast({ message: msg, type: "success" }); fetchUsers(); }}
        />
      )}

      {/* Temp Password Modal */}
      {tempPassword && (
        <TempPasswordModal
          password={tempPassword.password}
          userName={tempPassword.userName}
          onClose={() => setTempPassword(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── Reusable components ──────────────────────────────────────────────────────

function KpiCard({ label, value, color = "teal", loading = false, onClick }: {
  label: string; value: string; color?: "teal" | "green" | "red"; loading?: boolean; onClick?: () => void;
}) {
  const valueColor = { teal: "text-[#128C7E]", green: "text-[#25D366]", red: "text-[#EF4444]" }[color];
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-[#E9EDEF] rounded-xl p-3 flex flex-col gap-0.5 ${onClick ? "cursor-pointer hover:border-[#128C7E] hover:shadow-sm transition-all" : ""}`}
    >
      <div className="text-[10px] text-[#667781] font-black uppercase tracking-wide">{label}</div>
      {loading ? (
        <div className="h-6 bg-gray-200 rounded-lg animate-pulse w-12" />
      ) : (
        <div className={`text-[22px] font-black leading-tight ${valueColor}`}>{value}</div>
      )}
      {onClick && !loading && <div className="text-[9px] text-[#128C7E] font-black">Click to view</div>}
    </div>
  );
}

function TabBtn({ active, onClick, label, count, danger = false }: {
  active: boolean; onClick: () => void; label: string; count: number; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3 rounded-full text-[11px] font-black border-none cursor-pointer transition-all flex items-center gap-1.5 ${
        active
          ? danger ? "bg-[#EF4444] text-white" : "bg-[#128C7E] text-white"
          : "bg-[#F0F2F5] text-[#667781] hover:bg-[#E9EDEF]"
      }`}
    >
      {label}
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
        active
          ? "bg-white/20 text-white"
          : danger && count > 0 ? "bg-[#EF4444]/10 text-[#EF4444]" : "bg-[#E9EDEF] text-[#667781]"
      }`}>
        {count}
      </span>
    </button>
  );
}

function ActionBtn({ label, icon, color = "text-[#667781]", onClick }: {
  label: string; icon: string; color?: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`h-7 px-2 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[10px] font-black ${color} cursor-pointer hover:bg-[#E9EDEF] transition-all flex items-center gap-1 whitespace-nowrap`}
    >
      <span>{icon}</span> {label}
    </button>
  );
}
