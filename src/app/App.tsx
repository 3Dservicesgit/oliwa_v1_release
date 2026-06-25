/**
 * App.tsx — Root application component with routing.
 *
 * All routes are defined here. Each feature exports its page
 * component via a barrel export in features/<name>/index.ts.
 *
 * The login overlay (AirlockModal) lives inside AegisDashboardPage
 * and is shown as a modal when the user is not yet authenticated.
 */
import { Routes, Route } from "react-router-dom";
import { useSessionMonitor } from "../hooks/useSessionMonitor";

// ── Shared layout components ─────────────────────────────────────────────────
import { TopBar }      from "../components/navigation";
import { NavRail }     from "../components/navigation";
import { Sidebar }     from "../components/navigation";

// ── Auth context ─────────────────────────────────────────────────────────────
import { AuthProvider } from "../auth/AuthContext";
import { PermissionsProvider } from "../auth/PermissionsContext";
import { ProtectedRoute } from "../auth/ProtectedRoute";

// ── Feature pages ────────────────────────────────────────────────────────────
import { AegisDashboardPage }  from "../features/aegis";
import { NocBridgePage }       from "../features/noc-bridge";
import { OpsWarRoomPage }      from "../features/ops-war-room";
import { GatehousePage }       from "../features/gatehouse";
import { AlarmFactoryPage }    from "../features/alarm-factory";
import { SystemHealthPage }    from "../features/health";
import { AlarmsPage }          from "../features/alarms";
import { TokensPage }          from "../features/tokens";
import { BillingPage }         from "../features/billing";
import { PaymentsPage }        from "../features/payments";
import { VebaPage }            from "../features/veba";
import { AIWorkloadsPage }     from "../features/ai-workloads";
import { RbacPage }            from "../features/rbac";
import { AuditPage }           from "../features/audit";
import { TenantTowerPage }     from "../features/tenant-tower";
import { BillingInvoicingPage } from "../features/billing-invoicing";
import { MoneyPage }            from "../features/money";
import { EventsPage }           from "../features/events";
import { GeofencesPage } from "../features/geofences";
import { ReportsPage }   from "../features/reports";
import { SimPage }             from "../features/sim";

import { AssetDigitalTwinPage }  from "../features/asset-digital-twin";

// ── 404 ──────────────────────────────────────────────────────────────────────
import { NotFoundPage } from "./NotFoundPage";


export default function App() {
  useSessionMonitor();

  return (
    <AuthProvider>
    <PermissionsProvider>
    <div className="h-dvh flex flex-col bg-[#F0F2F5] overflow-hidden w-full">
      <TopBar />

      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden w-full">
        <NavRail />
        <Sidebar />

        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto">
        <Routes>
          {/* ── Dashboard (no permission required — landing page) ─────── */}
          <Route path="/"               element={<AegisDashboardPage />} />
          <Route path="/aegis"          element={<AegisDashboardPage />} />

          {/* ── Built pages (permission-guarded) ─────────────────────── */}
          <Route path="/noc-bridge"     element={<ProtectedRoute permission="live.monitoring.view"><NocBridgePage /></ProtectedRoute>} />
          <Route path="/ops"            element={<ProtectedRoute permission="ops.view"><OpsWarRoomPage /></ProtectedRoute>} />
          <Route path="/gatehouse"      element={<ProtectedRoute permission="track.playback.view"><GatehousePage /></ProtectedRoute>} />
          <Route path="/alarms-factory" element={<ProtectedRoute permission="alarms.view"><AlarmFactoryPage /></ProtectedRoute>} />
          <Route path="/tenant-tower"   element={<ProtectedRoute permission="tenants.view"><TenantTowerPage /></ProtectedRoute>} />
          <Route path="/billing-invoicing" element={<ProtectedRoute permission="billing.view"><BillingInvoicingPage /></ProtectedRoute>} />
          <Route path="/money"            element={<ProtectedRoute permission="money.view"><MoneyPage /></ProtectedRoute>} />
          <Route path="/protocol"         element={<ProtectedRoute permission="geofences.view"><GeofencesPage /></ProtectedRoute>} />
          <Route path="/events"           element={<ProtectedRoute permission="events.view"><EventsPage /></ProtectedRoute>} />
          <Route path="/reports"          element={<ProtectedRoute permission="reports.view"><ReportsPage /></ProtectedRoute>} />
          <Route path="/sim"             element={<ProtectedRoute permission="sim.view"><SimPage /></ProtectedRoute>} />
          <Route path="/asset-digital-twin" element={<ProtectedRoute permission="assets.view"><AssetDigitalTwinPage /></ProtectedRoute>} />

          {/* ── Placeholder pages (permission-guarded) ───────────────── */}
          <Route path="/health"   element={<ProtectedRoute permission="health.view"><SystemHealthPage /></ProtectedRoute>} />
          <Route path="/alarms"   element={<ProtectedRoute permission="alarms.view"><AlarmsPage /></ProtectedRoute>} />
          <Route path="/tokens"   element={<ProtectedRoute permission="tokens.view"><TokensPage /></ProtectedRoute>} />
          <Route path="/billing"  element={<ProtectedRoute permission="billing.view"><BillingPage /></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute permission="payments.view"><PaymentsPage /></ProtectedRoute>} />
          <Route path="/veba"     element={<ProtectedRoute permission="veba.view"><VebaPage /></ProtectedRoute>} />
          <Route path="/ai"       element={<ProtectedRoute permission="ai.view"><AIWorkloadsPage /></ProtectedRoute>} />
          <Route path="/rbac"     element={<ProtectedRoute permission="rbac.view"><RbacPage /></ProtectedRoute>} />
          <Route path="/audit"    element={<ProtectedRoute permission="audit.view"><AuditPage /></ProtectedRoute>} />

          {/* ── 404 ─────────────────────────────────────────────────────── */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </div>
      </div>

      <footer className="hidden md:flex items-center h-[22px] bg-white border-t border-[#E9EDEF] px-3 text-[11px] text-[#667781] overflow-x-auto whitespace-nowrap shrink-0">
        Kafka lag 4.8s • Redis p95 3ms • Cassandra p95 27ms • SSE clients 2.1k • Uptime 99.82%
      </footer>
    </div>
    </PermissionsProvider>
    </AuthProvider>
  );
}
