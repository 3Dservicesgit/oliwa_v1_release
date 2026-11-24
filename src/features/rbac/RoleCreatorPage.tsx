/**
 * RoleCreatorPage — Create / edit a role by selecting permissions module-by-
 * module from the catalog.
 *
 * Mounted at:
 *   /rbac/roles/new            → create mode
 *   /rbac/roles/:uid/edit      → edit mode (pre-fills from getRoleByUid)
 *
 * Driven by the module registry (src/auth/modules.ts). Each module renders a
 * <ModulePermissionBlock> with its catalog permissions, plus its legacy
 * `module.view` permission as the first tile (so created roles grant real
 * route access today while the catalog migration completes in Slice 3).
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createRole,
  getRoleByUid,
  updateRole,
} from "../../api/services/rbac.service";
import { useAuth } from "../../auth/AuthContext";
import { usePermissionGuard } from "../../auth/usePermissionGuard";
import { MODULES, type ModuleDef } from "../../auth/modules";
import { getCatalogPermissions } from "../../auth/permissionCatalog";
import { ModulePermissionBlock } from "./components/ModulePermissionBlock";

// ── Per-module permission key resolver ───────────────────────────────────────

/**
 * Returns the full list of permission keys to render for a module.
 * Composition: legacy viewPermission (if any, and not already in catalog) +
 * the module's catalog permissions.
 */
function getModulePermissionKeys(m: ModuleDef): string[] {
  const catalogPerms = m.catalogModuleName
    ? Array.from(getCatalogPermissions(m.catalogModuleName))
    : [];
  if (m.viewPermission && !catalogPerms.includes(m.viewPermission)) {
    return [m.viewPermission, ...catalogPerms];
  }
  return catalogPerms;
}

/** Permissions whose name implies read-only access. */
function isViewOnlyKey(key: string): boolean {
  return /(^|_|\.)(view|browse|read|list|monitor)(_|\.|$)/i.test(key);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function RoleCreatorPage() {
  const { uid } = useParams<{ uid?: string }>();
  const isEditMode = !!uid;
  const navigate = useNavigate();
  const { state: authState } = useAuth();
  const guard = usePermissionGuard();

  // ── Form state ────────────────────────────────────────────────────────────
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load existing role on edit ────────────────────────────────────────────
  useEffect(() => {
    if (!isEditMode || !uid) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getRoleByUid(uid);
        if (cancelled) return;
        const r = res.data;
        setRoleName(r.role_name ?? "");
        setRoleDescription(r.role_description ?? "");
        setSelected(
          new Set((r.permissions ?? []).map((p) => p.permission_name)),
        );
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load role.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, uid]);

  // ── Per-module key lookup (memoized) ──────────────────────────────────────
  const moduleKeysById = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const m of MODULES) out.set(m.id, getModulePermissionKeys(m));
    return out;
  }, []);

  // ── Counter: total selected + how many modules they span ─────────────────
  const selectionCounter = useMemo(() => {
    if (selected.size === 0) return { perms: 0, modules: 0 };
    let modules = 0;
    for (const m of MODULES) {
      const keys = moduleKeysById.get(m.id) ?? [];
      if (keys.some((k) => selected.has(k))) modules++;
    }
    return { perms: selected.size, modules };
  }, [selected, moduleKeysById]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleToggle = (key: string, next: boolean) => {
    setSelected((prev) => {
      const out = new Set(prev);
      if (next) out.add(key);
      else out.delete(key);
      return out;
    });
  };

  const handleBulkReplace = (
    moduleKeys: readonly string[],
    action: "all" | "view-only" | "none",
  ) => {
    setSelected((prev) => {
      const out = new Set(prev);
      // Remove all keys for this module first so action is replace-style.
      for (const k of moduleKeys) out.delete(k);
      if (action === "all") {
        for (const k of moduleKeys) out.add(k);
      } else if (action === "view-only") {
        for (const k of moduleKeys) if (isViewOnlyKey(k)) out.add(k);
      }
      // "none" leaves them removed.
      return out;
    });
  };

  const handleSubmit = async () => {
    setError(null);

    if (!roleName.trim()) {
      setError("Role name is required.");
      return;
    }
    if (selected.size === 0) {
      setError("Select at least one permission.");
      return;
    }
    if (!authState.accountRoot || !authState.accountUid) {
      setError("Missing account context — please sign in again.");
      return;
    }

    setSaving(true);
    try {
      const permissions = Array.from(selected);
      // Slice 3: catalog `can_*` keys resolve to legacy `rbac.create` /
      // `rbac.update` via permissionAliases.ts, so existing roles still work.
      if (isEditMode && uid) {
        await guard("can_edit_user", () =>
          updateRole(uid, {
            role_name: roleName.trim(),
            role_description: roleDescription.trim(),
            permissions,
            updated_by: authState.accountUid!,
          }),
        );
      } else {
        await guard("can_create_user", () =>
          createRole({
            role_name: roleName.trim(),
            role_description: roleDescription.trim(),
            account_root: authState.accountRoot!,
            created_by: authState.accountUid!,
            permissions,
          }),
        );
      }
      navigate("/rbac");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save role.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => navigate("/rbac");

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center bg-[#F0F2F5]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
          <span className="text-[13px] text-[#667781]">Loading role…</span>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 min-h-0 min-w-0 flex flex-col bg-[#F0F2F5] overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-[#E9EDEF] px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleCancel}
            className="text-[12px] text-[#667781] hover:text-[#111B21] cursor-pointer bg-transparent border-0 p-1"
            aria-label="Back to RBAC"
          >
            ← Back
          </button>
          <div className="min-w-0">
            <div className="text-[11px] text-[#667781] uppercase tracking-wide">
              {isEditMode ? "Edit Role" : "New Role"}
            </div>
            <h1 className="text-[16px] font-extrabold text-[#111B21] truncate">
              {isEditMode ? roleName || "Edit role" : "Create a new role"}
            </h1>
          </div>
        </div>
      </header>

      {/* ── Scrollable body ───────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {/* Role details */}
        <section className="bg-white border border-[#E9EDEF] rounded-xl p-4 mb-4">
          <h2 className="text-[13px] font-extrabold text-[#111B21] mb-3">
            Role details
          </h2>
          <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[#667781]">
                Role name *
              </span>
              <input
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. Field Operator"
                className="px-3 py-2 text-[13px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[var(--brand)]"
                required
                disabled={saving}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[#667781]">
                Description
              </span>
              <input
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                placeholder="What this role is for…"
                className="px-3 py-2 text-[13px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[var(--brand)]"
                disabled={saving}
              />
            </label>
          </div>
        </section>

        {/* Permission picker */}
        <section className="bg-white border border-[#E9EDEF] rounded-xl p-4">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 className="text-[13px] font-extrabold text-[#111B21]">
              Permissions
            </h2>
            <div className="text-[12px] text-[#667781]">
              <span
                className={
                  selectionCounter.perms > 0
                    ? "font-extrabold text-[var(--brand)]"
                    : ""
                }
              >
                {selectionCounter.perms}
              </span>{" "}
              permission{selectionCounter.perms === 1 ? "" : "s"} across{" "}
              <span
                className={
                  selectionCounter.modules > 0 ? "font-extrabold" : ""
                }
              >
                {selectionCounter.modules}
              </span>{" "}
              module{selectionCounter.modules === 1 ? "" : "s"}
            </div>
          </div>

          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search permissions or modules…"
            className="w-full px-3 py-2 text-[13px] border border-[#E9EDEF] rounded-md bg-white text-[#111B21] outline-none focus:border-[var(--brand)] mb-3"
          />

          {MODULES.map((m) => {
            const keys = moduleKeysById.get(m.id) ?? [];
            if (keys.length === 0) return null;
            return (
              <ModulePermissionBlock
                key={m.id}
                module={m}
                permissionKeys={keys}
                selected={selected}
                searchQuery={searchQuery}
                onTogglePermission={handleToggle}
                onBulkReplace={(action) => handleBulkReplace(keys, action)}
                defaultExpanded={false}
              />
            );
          })}
        </section>
      </div>

      {/* ── Sticky footer ─────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-[#E9EDEF] px-4 py-3 flex items-end justify-between gap-3 shrink-0">
        {/* Error region: empty when no error; styled banner when present.
            Handles both single-line validation messages and multi-line
            backend error details (e.g. unknown-permissions lists). */}
        {error ? (
          <div className="flex-1 min-w-0 max-w-[60ch] flex items-start gap-2 px-3 py-2 rounded-md bg-[#FFF5F5] border border-[#FFD6D6]">
            <span className="text-[12px] font-extrabold text-[#B00020] shrink-0">!</span>
            <div className="text-[12px] text-[#B00020] leading-snug whitespace-pre-wrap break-words">
              {error}
              {error.toLowerCase().startsWith("unknown permissions") && (
                <div className="text-[11px] text-[#7A1320] mt-1 font-medium">
                  The backend doesn't recognise these permission keys. The catalog
                  seed migration may not have run yet — see
                  <code className="mx-1 px-1 bg-white rounded">scripts/run_migrations.py</code>.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-[1em]" />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="px-3 py-1.5 text-[12px] font-medium rounded-md border border-[#E9EDEF] bg-white text-[#111B21] hover:bg-[#F0F2F5] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !roleName.trim() || selected.size === 0}
            className="px-3 py-1.5 text-[12px] font-extrabold rounded-md bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)] cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving
              ? "Saving…"
              : isEditMode
                ? "Save changes"
                : "Create role"}
          </button>
        </div>
      </footer>
    </main>
  );
}
