/**
 * App.tsx — Root application component with routing.
 *
 * Module routes are auto-generated from the module registry
 * (`src/auth/modules.ts`) via `generateModuleRoutes()`. To add a new module:
 *   1. Declare it in src/auth/modules.ts
 *   2. Map its id to a page element in src/app/moduleRoutes.tsx
 * Its route, permission gate, and (optionally) nav entry are then derived
 * automatically — no edits to App.tsx are required.
 *
 * Authentication gate:
 *   The `AuthGate` component checks auth state and renders either:
 *     - The full app shell (TopBar, NavRail, Sidebar, Routes) when authenticated
 *     - Just the Aegis landing page (which contains the Airlock login modal)
 *       when NOT authenticated
 *   This prevents unauthenticated users from seeing the protected navigation
 *   or app shell — even briefly.
 */
import { Routes, Route } from "react-router-dom";
import { useSessionMonitor } from "../hooks/useSessionMonitor";

// ── Shared layout components ─────────────────────────────────────────────────
import { TopBar }      from "../components/navigation";
import { NavRail }     from "../components/navigation";
import { Sidebar }     from "../components/navigation";

// ── Auth context ─────────────────────────────────────────────────────────────
import { AuthProvider, useAuth } from "../auth/AuthContext";
import { PermissionsProvider } from "../auth/PermissionsContext";
import { ProtectedRoute } from "../auth/ProtectedRoute";

// ── Auto-generated module routes ─────────────────────────────────────────────
import { generateModuleRoutes } from "./moduleRoutes";

// ── Landing & 404 (special-cased — not module-driven) ────────────────────────
import { AegisDashboardPage } from "../features/aegis";
import { NotFoundPage } from "./NotFoundPage";

// ── RBAC sub-routes (nested under the rbac module) ───────────────────────────
import { RoleCreatorPage } from "../features/rbac";


// ── Auth gate — renders login or app shell based on auth state ───────────────

function AuthGate() {
  useSessionMonitor();
  const { state } = useAuth();

  // Not authenticated → show only the landing page (which has the Airlock login modal)
  if (state.status !== "authenticated") {
    return (
      <div className="h-dvh flex flex-col bg-[#F0F2F5] overflow-hidden w-full">
        <AegisDashboardPage />
      </div>
    );
  }

  // Authenticated → full app shell
  return (
    <div className="h-dvh flex flex-col bg-[#F0F2F5] overflow-hidden w-full">
      <TopBar />

      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden w-full">
        <NavRail />
        <Sidebar />

        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto">
        <Routes>
          {/* Landing (no permission required) */}
          <Route path="/" element={<AegisDashboardPage />} />

          {/* Module routes — auto-generated from src/auth/modules.ts */}
          {generateModuleRoutes()}

          {/* RBAC sub-routes (Role Creator) */}
          <Route
            path="/rbac/roles/new"
            element={
              <ProtectedRoute permission="rbac.view">
                <RoleCreatorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rbac/roles/:uid/edit"
            element={
              <ProtectedRoute permission="rbac.view">
                <RoleCreatorPage />
              </ProtectedRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </div>
      </div>

      <footer className="hidden md:flex items-center h-[22px] bg-white border-t border-[#E9EDEF] px-3 text-[11px] text-[#667781] overflow-x-auto whitespace-nowrap shrink-0">
        Kafka lag 4.8s • Redis p95 3ms • Cassandra p95 27ms • SSE clients 2.1k • Uptime 99.82%
      </footer>
    </div>
  );
}


export default function App() {
  return (
    <AuthProvider>
    <PermissionsProvider>
      <AuthGate />
    </PermissionsProvider>
    </AuthProvider>
  );
}
