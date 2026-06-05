/**
 * NavRail — Primary Side Navigation Bar
 * Uses react-router-dom NavLink for URL-driven active state.
 *
 * Permission-filtered: only modules the current user has access to are
 * displayed. Modules with no `viewPermission` (e.g. Aegis dashboard)
 * are always shown. The "home" entry is always visible.
 */
import React, { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { getModulesForNavRail } from "../../auth/modules";
import { usePermissions } from "../../auth/PermissionsContext";

export interface NavRailItem { key: string; glyph: string; label: string; path?: string; permission?: string; }

const HOME_ITEM: NavRailItem = { key: "home", glyph: "⌂", label: "Home", path: "/" };

export function NavRail() {
  const { hasPermission, loading } = usePermissions();

  const items = useMemo(() => {
    const modules = getModulesForNavRail();
    const filtered = modules
      .filter((m) => !m.viewPermission || hasPermission(m.viewPermission))
      .map((m) => ({
        key:   m.id,
        glyph: m.navGlyph ?? "•",
        label: m.navLabel ?? m.name,
        path:  m.route,
      }));
    return [HOME_ITEM, ...filtered];
  }, [hasPermission]);

  // While permissions load, show only the home item to avoid layout shift
  const displayItems = loading ? [HOME_ITEM] : items;
  return (
    <>
      {/* Desktop vertical rail */}
      <nav
        aria-label="Primary navigation"
        className="hidden md:flex flex-col gap-2 w-[60px] bg-white border-r border-[#E9EDEF] px-[10px] py-3 shrink-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {displayItems.map((item) => <RailLink key={item.key} item={item} />)}
      </nav>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary navigation"
        className="flex md:hidden flex-row items-center justify-around fixed bottom-0 left-0 right-0 h-14 z-[200] overflow-x-auto bg-white border-t border-[#E9EDEF] px-2 gap-1"
      >
        {displayItems.map((item) => <RailLink key={item.key} item={item} mobile />)}
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