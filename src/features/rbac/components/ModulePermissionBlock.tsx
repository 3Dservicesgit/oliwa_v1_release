/**
 * ModulePermissionBlock — Collapsible module card with a grid of permission
 * tiles. Two modes:
 *
 *   - mode="select" — tiles are toggleable checkboxes (used in Role Creator)
 *   - mode="view"   — tiles are read-only (used in role detail / effective
 *                     permissions views)
 *
 * Visual style mirrors the NAVAS permissions-by-module mockup
 * (uploads/navas_permissions_by_module.html), translated to the project's
 * hardcoded Tailwind palette (CSS variables aren't set up in the codebase).
 *
 * The component is intentionally dumb — it owns no selection state. The
 * parent passes `selected` and receives per-tile toggle / bulk events.
 */

import React, { useMemo, useState } from "react";
import type { ModuleDef } from "../../../auth/modules";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Permissions whose name implies read-only / view-style access. */
function isViewOnlyKey(key: string): boolean {
  return /(^|_)(view|browse|read|list|monitor)(_|$)/i.test(key);
}

/** Does the search query match this permission or this module? */
function matchesQuery(
  query: string,
  moduleName: string,
  permissionKey: string,
): boolean {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  return (
    moduleName.toLowerCase().includes(q) ||
    permissionKey.toLowerCase().includes(q)
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export type ModuleBlockMode = "select" | "view";

interface ModulePermissionBlockProps {
  module: ModuleDef;
  /** All permission keys to render for this module (legacy view perm + catalog). */
  permissionKeys: readonly string[];
  /** Set of currently-selected permission keys. */
  selected: ReadonlySet<string>;
  /** Tile click handler (no-op when mode="view"). */
  onTogglePermission?: (key: string, next: boolean) => void;
  /** Bulk-set replaces the module's selection. (No-op when mode="view".) */
  onBulkReplace?: (action: "all" | "view-only" | "none") => void;
  /** Search filter — empty string shows everything. */
  searchQuery?: string;
  /** Render mode. */
  mode?: ModuleBlockMode;
  /** Initial expansion state. */
  defaultExpanded?: boolean;
}

export function ModulePermissionBlock({
  module,
  permissionKeys,
  selected,
  onTogglePermission,
  onBulkReplace,
  searchQuery = "",
  mode = "select",
  defaultExpanded = true,
}: ModulePermissionBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Filter permissions by search query. When the module name matches, show
  // all permissions; otherwise show only matching keys.
  const filteredKeys = useMemo(() => {
    if (!searchQuery) return permissionKeys;
    const q = searchQuery.toLowerCase().trim();
    if (module.name.toLowerCase().includes(q)) return permissionKeys;
    return permissionKeys.filter((k) => k.toLowerCase().includes(q));
  }, [permissionKeys, searchQuery, module.name]);

  // Don't render the block at all when the search produced no matches.
  if (filteredKeys.length === 0) return null;

  const selectedCount = filteredKeys.filter((k) => selected.has(k)).length;
  const totalCount = permissionKeys.length;

  return (
    <div className="border border-[#E9EDEF] rounded-xl overflow-hidden bg-white mb-3">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#F0F2F5] hover:bg-[#E9EDEF] transition-colors border-0 cursor-pointer text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`text-[#667781] text-[10px] transition-transform duration-200 ${
              expanded ? "rotate-90" : ""
            }`}
            aria-hidden="true"
          >
            ▶
          </span>
          <span className="font-medium text-[13px] text-[#111B21] truncate">
            {module.name}
          </span>
          {module.group === "catalog-only" && (
            <span
              className="text-[10px] font-medium text-[#667781] bg-white border border-[#E9EDEF] rounded-full px-2 py-px"
              title="No UI page yet — selecting these permissions is forward-looking."
            >
              catalog only
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {mode === "select" && (
            <span className="text-[11px] text-[#667781]">
              <span
                className={
                  selectedCount > 0 ? "font-extrabold text-[var(--brand)]" : ""
                }
              >
                {selectedCount}
              </span>
              <span> / {totalCount}</span>
            </span>
          )}
          {mode === "view" && (
            <span className="text-[11px] text-[#667781]">{totalCount}</span>
          )}
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="p-3">
          {mode === "select" && (
            <BulkActionsRow
              onBulkReplace={onBulkReplace}
              selectedCount={selectedCount}
              totalCount={totalCount}
            />
          )}

          <div className="grid gap-1.5 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
            {filteredKeys.map((key) => (
              <PermissionTile
                key={key}
                permissionKey={key}
                isSelected={selected.has(key)}
                isLegacyViewPerm={key === module.viewPermission}
                disabled={mode === "view"}
                onToggle={(next) => onTogglePermission?.(key, next)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── BulkActionsRow ───────────────────────────────────────────────────────────

function BulkActionsRow({
  onBulkReplace,
  selectedCount,
  totalCount,
}: {
  onBulkReplace?: (action: "all" | "view-only" | "none") => void;
  selectedCount: number;
  totalCount: number;
}) {
  if (!onBulkReplace) return null;

  const btn =
    "text-[11px] font-medium px-2 py-1 rounded-md border border-[#E9EDEF] " +
    "bg-white text-[#111B21] hover:bg-[#F0F2F5] transition-colors " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="flex items-center gap-1.5 mb-3 flex-wrap">
      <button
        type="button"
        className={btn}
        onClick={() => onBulkReplace("all")}
        disabled={selectedCount === totalCount}
      >
        Select all
      </button>
      <button type="button" className={btn} onClick={() => onBulkReplace("view-only")}>
        View-only
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => onBulkReplace("none")}
        disabled={selectedCount === 0}
      >
        Clear
      </button>
    </div>
  );
}

// ── PermissionTile ───────────────────────────────────────────────────────────

interface PermissionTileProps {
  permissionKey: string;
  isSelected: boolean;
  isLegacyViewPerm?: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}

function PermissionTile({
  permissionKey,
  isSelected,
  isLegacyViewPerm,
  disabled,
  onToggle,
}: PermissionTileProps) {
  const base =
    "font-mono text-[12px] leading-tight rounded-md px-2.5 py-1.5 border " +
    "break-all transition-colors duration-100 select-none flex items-center gap-2";

  const selectedStyle =
    "bg-[#E9F7F4] border-[#C2E8E1] text-[#111B21]";
  const unselectedStyle =
    "bg-[#F0F2F5] border-[#E9EDEF] text-[#111B21] hover:bg-[#E9EDEF]";
  const clickable = disabled ? "" : "cursor-pointer";

  return (
    <label
      className={[
        base,
        isSelected ? selectedStyle : unselectedStyle,
        clickable,
      ].join(" ")}
      title={isLegacyViewPerm ? "Module access permission" : undefined}
    >
      <input
        type="checkbox"
        className="accent-[var(--brand)] w-3.5 h-3.5 shrink-0"
        checked={isSelected}
        disabled={disabled}
        onChange={(e) => onToggle(e.target.checked)}
        aria-label={permissionKey}
      />
      <span className="flex-1 min-w-0">
        <span className="block truncate">{permissionKey}</span>
        {isLegacyViewPerm && (
          <span className="block text-[10px] text-[#667781] font-sans mt-px">
            module access
          </span>
        )}
      </span>
    </label>
  );
}

// ── Re-export helper for callers (selectors / counters) ──────────────────────

export const moduleBlockHelpers = {
  isViewOnlyKey,
  matchesQuery,
};
