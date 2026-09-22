/**
 * TeamPage — "User Management" for a client account.
 *
 * A client (e.g. Mukwano Co Ltd) can have many users helping to monitor its
 * fleet. Its administrators add them here, choose what each may do, block or
 * remove them, and reset passwords. Everything is limited to the client's own
 * account by the server (navas-core-apis endpoints/team.py).
 *
 * Roles:
 *   Administrator  everything, plus this page and the Audit Trail
 *   Operator       monitor the fleet; manage geofences, alerts and bookings
 *   Viewer         look only
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  addTeamMember,
  getTeamMembers,
  removeTeamMember,
  resetTeamMemberPassword,
  updateTeamMember,
} from "../../api/services/team.service";
import type { TeamMember, TeamRole } from "../../api/types/team.types";

const ROLES: { role: TeamRole; label: string; hint: string }[] = [
  { role: "client_admin", label: "Administrator", hint: "Everything, plus managing users and reading the audit trail" },
  { role: "client_operator", label: "Operator", hint: "Monitor the fleet; manage geofences, alerts and bookings" },
  { role: "client_viewer", label: "Viewer", hint: "Look only — can't change anything" },
];

const INPUT =
  "w-full h-9 px-3 rounded-lg border border-[#E9EDEF] text-[13px] text-[#111B21] " +
  "placeholder:text-[#8696A0] outline-none focus:border-[#128C7E] bg-white";
const LABEL = "block text-[11px] font-extrabold text-[#667781] mb-1";

function errText(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

function whenText(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function newPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function RoleBadge({ member }: { member: TeamMember }) {
  const tone = member.is_admin
    ? "bg-[#128C7E]/10 text-[#075E54]"
    : member.role === "client_operator"
      ? "bg-[#34B7F1]/10 text-[#0B6E99]"
      : "bg-[#F0F2F5] text-[#667781]";
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${tone}`}>{member.role_label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${active ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEF2F2] text-[#B91C1C]"}`}>
      {active ? "Active" : status === "blocked" ? "Blocked" : status}
    </span>
  );
}

// ── Add a user ──────────────────────────────────────────────────────────────

function AddUserPanel({ onClose, onAdded }: { onClose: () => void; onAdded: (msg: string) => void }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(newPassword);
  const [role, setRole] = useState<TeamRole>("client_viewer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (name.trim().length < 2) return setError("Enter the person's full name.");
    if (username.trim().length < 3) return setError("Choose a username of at least 3 characters.");
    if (password.length < 8) return setError("The password must be at least 8 characters.");
    setBusy(true);
    setError(null);
    try {
      const res = await addTeamMember({ display_name: name.trim(), username: username.trim(), email: email.trim() || undefined, password, role });
      onAdded(`${res.message} Their password is ${password} — share it with them securely.`);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex justify-end" onClick={onClose}>
      <div className="w-[440px] max-w-full h-full bg-white flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E9EDEF]">
          <div>
            <div className="font-black text-[15px] text-[#111B21]">Add a user</div>
            <div className="text-[12px] text-[#667781]">They'll sign in to this console with the username and password below.</div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="w-8 h-8 rounded-lg border border-[#E9EDEF] bg-white cursor-pointer">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <div>
            <label className={LABEL} htmlFor="tm-name">Full name *</label>
            <input id="tm-name" className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Namubiru" />
          </div>
          <div>
            <label className={LABEL} htmlFor="tm-user">Username *</label>
            <input id="tm-user" className={INPUT} value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))} placeholder="e.g. jane.mukwano" autoComplete="off" />
          </div>
          <div>
            <label className={LABEL} htmlFor="tm-email">Email</label>
            <input id="tm-email" type="email" className={INPUT} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" />
          </div>
          <div>
            <label className={LABEL} htmlFor="tm-pass">Password *</label>
            <div className="flex gap-2">
              <input id="tm-pass" className={`${INPUT} font-mono`} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              <button type="button" onClick={() => setPassword(newPassword())} className="h-9 px-3 rounded-lg border border-[#E9EDEF] bg-white text-[12px] font-extrabold text-[#667781] cursor-pointer shrink-0">New</button>
            </div>
            <div className="text-[11px] text-[#667781] mt-1">At least 8 characters. You'll see it once more after saving.</div>
          </div>
          <div>
            <div className={LABEL}>What can they do? *</div>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Role">
              {ROLES.map((r) => (
                <label key={r.role} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${role === r.role ? "border-[#128C7E] bg-[#E9F7F4]" : "border-[#E9EDEF]"}`}>
                  <input type="radio" name="tm-role" checked={role === r.role} onChange={() => setRole(r.role)} className="mt-0.5" />
                  <span>
                    <span className="block text-[13px] font-extrabold text-[#111B21]">{r.label}</span>
                    <span className="block text-[11px] text-[#667781]">{r.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          {error && <div role="alert" className="text-[12px] text-[#B00020] bg-[#FFF5F5] border border-[#FFD6D6] rounded-lg px-3 py-2">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#E9EDEF]">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg border border-[#E9EDEF] bg-white text-[13px] font-extrabold cursor-pointer">Cancel</button>
          <button type="button" onClick={save} disabled={busy} className="h-10 px-4 rounded-lg border-0 bg-[#128C7E] text-white text-[13px] font-extrabold cursor-pointer disabled:opacity-50">
            {busy ? "Adding…" : "Add user"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm dialog ──────────────────────────────────────────────────────────

interface Confirm { title: string; body: string; action: string; danger?: boolean; run: () => Promise<void>; }

function ConfirmDialog({ confirm, onClose }: { confirm: Confirm; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await confirm.run();
      onClose();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div role="dialog" aria-label={confirm.title} className="relative bg-white rounded-xl p-5 w-[400px] max-w-[calc(100vw-24px)] shadow-xl">
        <div className="font-black text-[15px] text-[#111B21] mb-2">{confirm.title}</div>
        <div className="text-[13px] text-[#667781] mb-4">{confirm.body}</div>
        {error && <div role="alert" className="text-[12px] text-[#B00020] bg-[#FFF5F5] border border-[#FFD6D6] rounded-lg px-3 py-2 mb-3">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-[#E9EDEF] bg-white text-[12px] font-extrabold cursor-pointer">Cancel</button>
          <button type="button" onClick={go} disabled={busy}
            className={`h-9 px-4 rounded-lg border-0 text-white text-[12px] font-extrabold cursor-pointer disabled:opacity-50 ${confirm.danger ? "bg-[#B00020]" : "bg-[#128C7E]"}`}>
            {busy ? "Working…" : confirm.action}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await getTeamMembers();
      setMembers(res.data ?? []);
      setError(null);
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => `${m.display_name} ${m.username} ${m.email}`.toLowerCase().includes(q));
  }, [members, search]);

  const counts = useMemo(() => ({
    total: members.length,
    active: members.filter((m) => m.status === "active").length,
    admins: members.filter((m) => m.is_admin).length,
  }), [members]);

  const changeRole = async (m: TeamMember, role: TeamRole) => {
    try {
      await updateTeamMember(m.account_uid, { role });
      setNotice(`${m.display_name} is now ${ROLES.find((r) => r.role === role)?.label}.`);
      await load();
    } catch (e) {
      setNotice(null);
      setError(errText(e));
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#F0F2F5] p-3 gap-3 overflow-y-auto">
      <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3 flex items-start justify-between gap-4">
        <div>
          <div className="font-black text-[16px] text-[#111B21]">User Management</div>
          <div className="text-[12px] text-[#667781] mt-0.5">The people in your account who help monitor your fleet.</div>
        </div>
        <button type="button" onClick={() => { setNotice(null); setAdding(true); }}
          className="shrink-0 h-9 px-4 rounded-lg border-0 bg-[#128C7E] text-white text-[12px] font-extrabold cursor-pointer hover:bg-[#0D7466]">
          + Add user
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[["Users", counts.total], ["Active", counts.active], ["Administrators", counts.admins]].map(([label, n]) => (
          <div key={label} className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <div className="text-[11px] font-extrabold text-[#667781]">{label}</div>
            <div className="text-[22px] font-black text-[#111B21]">{loading ? "—" : n}</div>
          </div>
        ))}
      </div>

      {notice && <div role="status" className="text-[12px] text-[#075E54] bg-[#E9F7F4] border border-[#C2E8E1] rounded-lg px-3 py-2">{notice}</div>}
      {error && (
        <div role="alert" className="text-[12px] text-[#B00020] bg-[#FFF5F5] border border-[#FFD6D6] rounded-lg px-3 py-2 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => { setError(null); setLoading(true); void load(); }} className="text-[12px] font-extrabold underline bg-transparent border-0 cursor-pointer text-[#B00020]">Retry</button>
        </div>
      )}

      <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E9EDEF]">
          <input className={INPUT} placeholder="Search by name, username or email…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users" />
        </div>
        {loading ? (
          <div className="p-8 text-center text-[13px] text-[#667781]">Loading your team…</div>
        ) : shown.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-[#667781]">{members.length ? "No one matches that search." : "No users yet. Add the people who help monitor your fleet."}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] font-extrabold text-[#667781] bg-[#F8F9FA]">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Last sign-in</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => (
                  <tr key={m.account_uid} className="border-t border-[#E9EDEF] align-top">
                    <td className="px-4 py-3">
                      <div className="font-extrabold text-[#111B21]">{m.display_name}{m.is_me && <span className="ml-1.5 text-[11px] text-[#667781] font-bold">(you)</span>}</div>
                      <div className="text-[12px] text-[#667781]">{m.username}{m.email ? ` · ${m.email}` : ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      {m.is_me || !ROLES.some((r) => r.role === m.role) ? (
                        <RoleBadge member={m} />
                      ) : (
                        <select aria-label={`Role for ${m.display_name}`} value={m.role} onChange={(e) => void changeRole(m, e.target.value as TeamRole)}
                          className="h-8 px-2 rounded-lg border border-[#E9EDEF] text-[12px] bg-white">
                          {ROLES.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                    <td className="px-4 py-3 text-[12px] text-[#667781]">{whenText(m.last_login_at)}</td>
                    <td className="px-4 py-3">
                      {m.is_me ? (
                        <div className="text-right text-[11px] text-[#667781]">—</div>
                      ) : (
                        <div className="flex justify-end gap-1.5 flex-wrap">
                          <button type="button" className="h-7 px-2.5 rounded-lg border border-[#E9EDEF] bg-white text-[11px] font-extrabold cursor-pointer"
                            onClick={() => setConfirm({
                              title: "Reset password?",
                              body: `${m.display_name} will need a new password to sign in. You'll see it once, to share with them.`,
                              action: "Reset password",
                              run: async () => {
                                const res = await resetTeamMemberPassword(m.account_uid);
                                setNotice(`New password for ${res.data.username}: ${res.data.temporary_password} — share it securely; it's shown once.`);
                              },
                            })}>
                            Reset password
                          </button>
                          <button type="button" className="h-7 px-2.5 rounded-lg border border-[#E9EDEF] bg-white text-[11px] font-extrabold cursor-pointer"
                            onClick={() => setConfirm(m.status === "active" ? {
                              title: `Block ${m.display_name}?`,
                              body: "They won't be able to sign in until you unblock them.",
                              action: "Block", danger: true,
                              run: async () => { await updateTeamMember(m.account_uid, { status: "blocked" }); setNotice(`${m.display_name} is blocked.`); await load(); },
                            } : {
                              title: `Unblock ${m.display_name}?`,
                              body: "They'll be able to sign in again.",
                              action: "Unblock",
                              run: async () => { await updateTeamMember(m.account_uid, { status: "active" }); setNotice(`${m.display_name} can sign in again.`); await load(); },
                            })}>
                            {m.status === "active" ? "Block" : "Unblock"}
                          </button>
                          <button type="button" className="h-7 px-2.5 rounded-lg border border-[#FFD6D6] bg-white text-[11px] font-extrabold text-[#B00020] cursor-pointer"
                            onClick={() => setConfirm({
                              title: `Remove ${m.display_name}?`,
                              body: "They'll no longer be able to sign in or see your fleet. Their past activity stays in the audit trail.",
                              action: "Remove", danger: true,
                              run: async () => { const res = await removeTeamMember(m.account_uid); setNotice(res.message); await load(); },
                            })}>
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-[11px] text-[#667781] px-1">
        <b>Administrator</b> — everything, plus users and the audit trail · <b>Operator</b> — monitor, geofences, alerts, bookings · <b>Viewer</b> — look only
      </div>

      {adding && <AddUserPanel onClose={() => setAdding(false)} onAdded={(msg) => { setAdding(false); setNotice(msg); void load(); }} />}
      {confirm && <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}
