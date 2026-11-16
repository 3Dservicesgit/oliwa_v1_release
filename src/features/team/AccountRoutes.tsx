/**
 * AccountRoutes — User Management, with the Audit Trail as one of its tabs.
 *
 *   Users        a customer manages their own team (TeamPage); staff get the
 *                platform RBAC console (RbacPage).
 *   Audit trail  a customer sees their account's sign-ins and team changes
 *                (TeamAuditPage); staff get the platform audit (AuditPage).
 *
 *   Branding     a client administrator sets the account's colours and the
 *                assistant's name (BrandingPage) — only when 3D Services has
 *                switched it on for them in the CMS (GET /branding/me →
 *                can_edit).
 *
 * One page at /rbac; the tab is in the URL (?tab=audit, ?tab=branding), so
 * the sidebar keeps "User Management" lit and a tab can be linked to. /audit
 * still works: it opens the Audit trail tab (old links and bookmarks). Each
 * tab shows only to someone who may use it.
 */
import React from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { usePermissions } from "../../auth/PermissionsContext";
import { useCan } from "../../auth/guards";
import { useBranding } from "../../branding/branding";
import { RbacPage } from "../rbac";
import { AuditPage } from "../audit";
import { TeamPage } from "./TeamPage";
import { TeamAuditPage } from "./TeamAuditPage";
import { BrandingPage } from "./BrandingPage";

type Tab = "users" | "audit" | "branding";

function UserManagementHub({ tab, onTab }: { tab: Tab; onTab?: (t: Tab) => void }) {
  const { isCustomer } = usePermissions();
  const canUsers = useCan("rbac.view");
  const canAudit = useCan("audit.view");
  const canBrand = useBranding().branding.can_edit;
  const tabs: [Tab, string][] = [
    ...(canUsers ? [["users", "Users"] as [Tab, string]] : []),
    ...(canAudit ? [["audit", "Audit trail"] as [Tab, string]] : []),
    ...(canBrand ? [["branding", "Branding"] as [Tab, string]] : []),
  ];

  return (
    <div className="flex flex-col h-full w-full min-h-0 bg-[#F0F2F5]">
      {onTab && tabs.length > 1 && (
        <div role="tablist" aria-label="User Management" className="flex gap-1.5 px-3 pt-3">
          {tabs.map(([t, label]) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => onTab(t)}
              className={`h-8 px-4 rounded-full text-[12px] font-extrabold cursor-pointer border ${tab === t
                ? "bg-[var(--brand-dark)] border-[var(--brand-dark)] text-white"
                : "bg-white border-[#E9EDEF] text-[#111B21]"}`}>
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 min-h-0">
        {tab === "branding" ? <BrandingPage />
          : tab === "audit"
            ? (isCustomer ? <TeamAuditPage /> : <AuditPage />)
            : (isCustomer ? <TeamPage /> : <RbacPage />)}
      </div>
    </div>
  );
}

/** /rbac — Users; the Audit trail with ?tab=audit; Branding with ?tab=branding. */
export function UserManagementRoute() {
  const [params, setParams] = useSearchParams();
  const canAudit = useCan("audit.view");
  const canBrand = useBranding().branding.can_edit;
  const wanted = params.get("tab");
  const tab: Tab = wanted === "audit" && canAudit ? "audit"
    : wanted === "branding" && canBrand ? "branding"
    : "users";
  return (
    <UserManagementHub tab={tab}
      onTab={(t) => setParams(t === "users" ? {} : { tab: t }, { replace: true })} />
  );
}

/** /audit — the Audit trail tab of User Management. Someone who may see the
 *  audit but not the users gets the audit on its own. */
export function AuditTrailRoute() {
  const canUsers = useCan("rbac.view");
  if (canUsers) return <Navigate to="/rbac?tab=audit" replace />;
  return <UserManagementHub tab="audit" />;
}
