/**
 * Sidebar — Secondary Side Navigation Bar
 * Uses react-router-dom NavLink for URL-driven active state.
 */
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { usePermissions } from "../../auth/PermissionsContext";
import { useAuth } from "../../auth/AuthContext";
import { getModulesForSidebar } from "../../auth/modules";

/** Each sidebar item can optionally require a permission to be visible. */
export interface SidebarItem { key: string; label: string; path?: string; permission?: string; }
interface SidebarTip  { title: string; body: string; }
interface SidebarProps {
  title?:    string;
  subtitle?: string;
  items?:    SidebarItem[];
  onSelect?: (key: string) => void;
  tip?:      SidebarTip;
  open?:     boolean;
}

/**
 * Default sidebar items are derived from the module registry
 * (`auth/modules.ts`). Any module with `showInSidebar: true` appears here,
 * in registry order. Override by passing a custom `items` prop.
 */
const DEFAULT_ITEMS: SidebarItem[] = getModulesForSidebar().map((m) => ({
  key:        m.id,
  label:      m.navLabel ?? m.name,
  // Aegis is the landing page — route to "/" rather than "/aegis" so the
  // active-state highlight tracks the home URL the rest of the app uses.
  path:       m.id === "aegis" ? "/" : m.route,
  permission: m.viewPermission,
}));

const DEFAULT_TIP: SidebarTip = {
  title: "Waswa Tip",
  body:  'Type: "why burn↑" to trace token drains to infra.',
};

export function Sidebar({
  title    = "Console",
  subtitle = "Primary Ops+Command Center",
  items    = DEFAULT_ITEMS,
  onSelect,
  open     = false,
}: SidebarProps) {
  const navigate = useNavigate();
  const { hasPermission, loading } = usePermissions();
  const { logout } = useAuth();

  // While permissions are loading, show all items in disabled state to prevent layout shift
  const visibleItems = loading
    ? items
    : items.filter(
        (item) => !item.permission || hasPermission(item.permission),
      );

  const handleLogout = () => {
    logout();
  };
  return (
    <aside
      className={[
        "w-[240px] bg-white border-r border-[#E9EDEF]",
        "flex flex-col gap-2.5 p-3.5 shrink-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "hidden lg:flex",
        open ? "md:flex md:fixed md:left-[60px] md:top-[86px] md:bottom-0 md:z-[150] md:shadow-xl" : "",
      ].join(" ")}
    >
      <div className="font-extrabold text-[#111B21] text-[13px]">{title}</div>
      <div className="text-[11px] text-[#667781]">{subtitle}</div>

      <nav className="flex flex-col gap-1.5" aria-label="Secondary navigation">
        {visibleItems.map((item) => {
          const to = item.path ?? `/${item.key}`;
          const isDisabled = loading && !!item.permission;
          return (
            <NavLink
              key={item.key}
              to={to}
              end={to === "/"}
              onClick={(e) => {
                if (isDisabled) { e.preventDefault(); return; }
                onSelect?.(item.key);
              }}
              className={({ isActive }) =>
                [
                  "relative h-[34px] rounded-lg border flex items-center",
                  "px-2.5 text-[12px] select-none no-underline",
                  "transition-colors duration-100",
                  isDisabled
                    ? "text-[#B0B7BD] border-[#E9EDEF] cursor-not-allowed opacity-60"
                    : "cursor-pointer",
                  !isDisabled && isActive
                    ? "bg-[#E9F7F4] text-[#111B21] border-[#C2E8E1]"
                    : !isDisabled
                      ? "text-[#667781] border-[#E9EDEF] hover:bg-[#F0F2F5]"
                      : "",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && !isDisabled && (
                    <span className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-[#128C7E]" />
                  )}
                  <span className="pl-1">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {(
        <div 
          onClick={handleLogout}
          className="mt-auto border border-[#E9EDEF] bg-[#F0F2F5] rounded-xl p-2.5 cursor-pointer hover:bg-[#E9EDEF] transition-colors"
        >
          <div className="font-bold text-[12px] text-[#111B21]">LogOut - Exit</div>
        </div>
      )}
    </aside>
  );
}