/**
 * NavRail — Primary Side Navigation Bar
 *
 * Drives its items from the central module registry (auth/modules.ts)
 * and filters out modules the current user doesn't have permission to view.
 * Uses react-router-dom NavLink for URL-driven active state.
 */
import React from "react";
import { NavLink } from "react-router-dom";
import { getModulesForNavRail } from "../../auth/modules";
import { usePermissions } from "../../auth/PermissionsContext";

export interface NavRailItem { key: string; glyph: string; label: string; path?: string; }
interface NavRailProps { items?: NavRailItem[]; }

export function NavRail({ items }: NavRailProps) {
  const { hasPermission, loading } = usePermissions();

  // Derive items from the module registry, filtered by the user's permissions
  const visibleItems: NavRailItem[] = items ?? getModulesForNavRail()
    .filter((m) => {
      // Modules with no viewPermission are always visible (e.g. landing pages)
      if (!m.viewPermission) return true;
      // While permissions are loading, show all items (avoid flash of empty nav)
      if (loading) return true;
      return hasPermission(m.viewPermission);
    })
    .map((m) => ({
      key: m.id,
      glyph: m.navGlyph || m.id.charAt(0).toUpperCase(),
      label: m.navLabel || m.name,
      path: m.route,
    }));

  return (
    <>
      {/* Desktop vertical rail */}
      <nav
        aria-label="Primary navigation"
        className="hidden md:flex flex-col gap-2 w-[60px] bg-white border-r border-[#E9EDEF] px-[10px] py-3 shrink-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {visibleItems.map((item) => <RailLink key={item.key} item={item} />)}
      </nav>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary navigation"
        className="flex md:hidden flex-row items-center justify-around fixed bottom-0 left-0 right-0 h-14 z-[200] overflow-x-auto bg-white border-t border-[#E9EDEF] px-2 gap-1"
      >
        {visibleItems.map((item) => <RailLink key={item.key} item={item} mobile />)}
      </nav>
    </>
  );
}

function RailLink({ item, mobile = false }: { item: NavRailItem; mobile?: boolean }) {
  const to = item.path ?? `/${item.key}`;
  return (
    <NavLink
      to={to}
      end={to === "/"}
      title={item.label}
      aria-label={item.label}
      className={({ isActive }) =>
        [
          mobile ? "w-10 h-10" : "w-9 h-9",
          "rounded-[10px] border font-bold text-[14px] grid place-items-center",
          "cursor-pointer shrink-0 no-underline transition-colors duration-150",
          isActive
            ? "bg-[#128C7E] text-white border-transparent"
            : "bg-[#EEF3F4] text-[#667781] border-[#E9EDEF] hover:bg-[#DCF1EE]",
        ].join(" ")
      }
    >
      {item.glyph}
    </NavLink>
  );
}
