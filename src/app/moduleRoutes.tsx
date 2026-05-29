/**
 * app/moduleRoutes.tsx — Auto-generates the <Route> table from the module
 * registry (src/auth/modules.ts).
 *
 * This is the single place where module ids meet React components. The
 * registry stays free of feature/page imports so it remains pure data.
 *
 * To add a new module:
 *   1. Add an entry in src/auth/modules.ts with `route: "/foo"`.
 *   2. Add a `<FooPage />` mapping below under the matching `id`.
 *
 * generateModuleRoutes() returns an array of <Route> elements that the
 * caller spreads inside <Routes>. We export a function (rather than a
 * component) because react-router inspects the direct JSX children of
 * <Routes> and won't traverse through a wrapper component.
 */

import React, { ReactElement } from "react";
import { Route } from "react-router-dom";
import { MODULES } from "../auth/modules";
import { ModuleRouteGuard } from "../auth/guards";

// ── Feature pages ────────────────────────────────────────────────────────────

import { AegisDashboardPage }   from "../features/aegis";
import { NocBridgePage }        from "../features/noc-bridge";
import { OpsWarRoomPage }       from "../features/ops-war-room";
import { GatehousePage }        from "../features/gatehouse";
import { GeofencesPage }         from "../features/geofences";
// import { ProtocolPage }         from "../features/protocol";
import { FirmwarePage }         from "../features/firmware";
import { SimPage }              from "../features/sim";
import { SystemHealthPage }     from "../features/health";
import { AlarmFactoryPage }     from "../features/alarm-factory";
import { AlarmsPage }           from "../features/alarms";
import { TokensPage }           from "../features/tokens";
import { BillingPage }          from "../features/billing";
import { BillingInvoicingPage } from "../features/billing-invoicing";
import { PaymentsPage }         from "../features/payments";
import { MoneyPage }            from "../features/money";
import { TenantTowerPage }      from "../features/tenant-tower";
import { AssetDigitalTwinPage } from "../features/asset-digital-twin";
import { VebaPage }             from "../features/veba";
import { AIWorkloadsPage }      from "../features/ai-workloads";
import { RbacPage }             from "../features/rbac";
import { AuditPage }            from "../features/audit";

// ── Module-id → page element map ─────────────────────────────────────────────

const MODULE_ELEMENTS: Record<string, ReactElement> = {
  "aegis":              <AegisDashboardPage />,
  "noc-bridge":         <NocBridgePage />,
  "ops":                <OpsWarRoomPage />,
  "gatehouse":          <GatehousePage />,
  "protocol":           <GeofencesPage />,
  "firmware":           <FirmwarePage />,
  "sim":                <SimPage />,
  "health":             <SystemHealthPage />,
  "alarms-factory":     <AlarmFactoryPage />,
  "alarms":             <AlarmsPage />,
  "tokens":             <TokensPage />,
  "billing":            <BillingPage />,
  "billing-invoicing":  <BillingInvoicingPage />,
  "payments":           <PaymentsPage />,
  "money":              <MoneyPage />,
  "tenant-tower":       <TenantTowerPage />,
  "asset-digital-twin": <AssetDigitalTwinPage />,
  "veba":               <VebaPage />,
  "ai-workloads":       <AIWorkloadsPage />,
  "rbac":               <RbacPage />,
  "audit":              <AuditPage />,
};

/**
 * generateModuleRoutes — emits a permission-gated <Route> for every module
 * in the registry that has both a `route` and a registered page element.
 * Modules missing an element are skipped with a console warning.
 */
export function generateModuleRoutes(): ReactElement[] {
  return MODULES.filter((m) => m.route).reduce<ReactElement[]>((acc, m) => {
    const element = MODULE_ELEMENTS[m.id];
    if (!element) {
      console.warn(
        `[generateModuleRoutes] No element registered for module "${m.id}" ` +
          `(route ${m.route}). Add a mapping in app/moduleRoutes.tsx.`,
      );
      return acc;
    }
    acc.push(
      <Route
        key={m.id}
        path={m.route!}
        element={
          <ModuleRouteGuard moduleId={m.id}>{element}</ModuleRouteGuard>
        }
      />,
    );
    return acc;
  }, []);
}
