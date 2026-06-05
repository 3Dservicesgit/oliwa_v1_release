/**
 * RbacPage — Roles, Permissions & Object Access (RBAC)
 *
 * Implements least privilege at scale: define roles, bind rights to modules/blades
 * and object-level access (units, drivers, resources), and enforce separation of duties.
 *
 * Layout: Header + KPIs + Tab-based tables (Roles, Permission Sets, Object ACLs,
 *         Policies, Role Templates) + right detail blade + create modal
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllRoles, getAllPermissions, deletePermission, getActiveRolesCount, getTotalPermissionsCount, getActiveClientsCount, getActive3dClientsCount, getClientUsersCount, getRoleUserCounts, getPermissionRoleCounts } from "../../api";
import type { RbacRole, RbacPermission } from "../../api";
import { PermissionGate } from "../../auth/PermissionGate";
import { usePermissionGuard } from "../../auth/usePermissionGuard";
import { RolesTable } from "./components/RolesTable";
import { PermissionSetsTable } from "./components/PermissionSetsTable";
// import { ObjectAclsTable } from "./components/ObjectAclsTable";
// import { PoliciesTable } from "./components/PoliciesTable";
// import { RoleTemplatesTable } from "./components/RoleTemplatesTable";
import { RbacDetailBlade } from "./components/RbacDetailBlade";
import { EditRoleModal } from "./components/EditRoleModal";
import { EditPermissionModal } from "./components/EditPermissionModal";
import { PermissionDetailBlade } from "./components/PermissionDetailBlade";
import { RbacWizard, type WizardMode } from "./components/wizard/RbacWizard";
import type { StepNumber } from "./components/wizard/useWizardState";
import type { Role } from "./components/RolesTable";
import type { PermissionSet } from "./components/PermissionSetsTable";
// import type { ObjectAcl } from "./components/ObjectAclsTable";
// import type { Policy } from "./components/PoliciesTable";
// import type { RoleTemplate } from "./components/RoleTemplatesTable";

// ─── Section Tabs ────────────────────────────────────────────────────────────
const SECTION_TABS = ["Roles", "Permission Sets" /*, "Object ACLs", "Policies", "Role Templates" */] as const;
type SectionTab = typeof SECTION_TABS[number];

// ─── Helpers: map backend → frontend types ──────────────────────────────────
function mapRbacRoleToRole(r: RbacRole): Role {
  return {
    id: r.role_uid,
    name: r.role_name,
    owner: r.created_by,
    tenant: r.account_root,
    users: -1,
    permissions: r.permissions?.length ?? 0,
    lastModified: r.updated_at?.slice(0, 10) ?? r.created_at?.slice(0, 10) ?? "",
  };
}

function mapRbacPermToPermissionSet(p: RbacPermission): PermissionSet {
  return {
    id: p.permission_uid,
    name: p.permission_name,
    owner: p.created_by ?? "system",
    module: p.permission_module,
    actions: [p.permission_name.split(".")[1] ?? "view"],
    rolesUsing: -1,
    description: p.permission_description ?? "",
  };
}

// ─── Mock Data (sections without backend endpoints yet) ──────────────────────

// const MOCK_ACLS: ObjectAcl[] = [
//   { id: "ACL-001", name: "Fleet A Units", objectType: "Unit", objectRef: "FLEET-A-*", owner: "ops@navas.io", tenant: "TEPU", grantee: "Dealer Operator", access: "Write", status: "Active", lastModified: "2026-03-10" },
//   { id: "ACL-002", name: "Driver Pool KLA", objectType: "Driver", objectRef: "DRV-KLA-*", owner: "admin@navas.io", tenant: "KLA", grantee: "Support Supervisor", access: "Read", status: "Active", lastModified: "2026-03-09" },
//   { id: "ACL-003", name: "Fuel Sensors ACME", objectType: "Resource", objectRef: "FUEL-ACME-*", owner: "admin@navas.io", tenant: "ACME", grantee: "Finance Admin", access: "Read", status: "Active", lastModified: "2026-03-08" },
//   { id: "ACL-004", name: "SIM Pool Global", objectType: "Device", objectRef: "SIM-*", owner: "admin@navas.io", tenant: "TEPU", grantee: "Platform Admin", access: "Admin", status: "Active", lastModified: "2026-03-07" },
//   { id: "ACL-005", name: "Tenant ACME Data", objectType: "Tenant", objectRef: "ACME", owner: "admin@navas.io", tenant: "TEPU", grantee: "GPS Read-Only", access: "Read", status: "Active", lastModified: "2026-03-06" },
//   { id: "ACL-006", name: "Staging Devices", objectType: "Device", objectRef: "DEV-STG-*", owner: "dev@navas.io", tenant: "TEPU", grantee: "Test Role", access: "Write", status: "Disabled", lastModified: "2026-03-05" },
// ];

// const MOCK_POLICIES: Policy[] = [
//   { id: "POL-001", name: "Role Change Approval", owner: "admin@navas.io", tenant: "TEPU", type: "MakerChecker", enforcedOn: ["Roles", "Permissions"], status: "Active", lastModified: "2026-03-10" },
//   { id: "POL-002", name: "Finance vs Ops Separation", owner: "compliance@navas.io", tenant: "TEPU", type: "SoD", enforcedOn: ["Billing", "Ops"], status: "Active", lastModified: "2026-03-09" },
//   { id: "POL-003", name: "After-Hours Lock", owner: "admin@navas.io", tenant: "TEPU", type: "TimeBound", enforcedOn: ["RBAC Admin", "Token Mint"], status: "Active", lastModified: "2026-03-08" },
//   { id: "POL-004", name: "UG Geo-Restriction", owner: "admin@navas.io", tenant: "TEPU", type: "GeoFence", enforcedOn: ["GPS Admin"], status: "Draft", lastModified: "2026-03-07" },
//   { id: "POL-005", name: "Video Access Policy", owner: "admin@navas.io", tenant: "ACME", type: "Custom", enforcedOn: ["VEBA"], status: "Disabled", lastModified: "2026-03-06" },
// ];

// const MOCK_TEMPLATES: RoleTemplate[] = [
//   { id: "TPL-001", name: "Standard Dealer", owner: "admin@navas.io", tenant: "TEPU", description: "Default role for new dealer operators with GPS + alerts", permissionSets: ["GPS.Read", "Alerts.View"], timesUsed: 12, status: "Active", lastModified: "2026-03-10" },
//   { id: "TPL-002", name: "Finance Viewer", owner: "finance@navas.io", tenant: "TEPU", description: "Read-only access to billing, tokens, and payment ledger", permissionSets: ["Billing.View", "Tokens.View"], timesUsed: 8, status: "Active", lastModified: "2026-03-09" },
//   { id: "TPL-003", name: "NOC Operator", owner: "noc@navas.io", tenant: "TEPU", description: "Full NOC bridge access with alarm acknowledgement", permissionSets: ["GPS.Read", "Alerts.Manage", "NOC.Full"], timesUsed: 4, status: "Active", lastModified: "2026-03-08" },
//   { id: "TPL-004", name: "Customer Read-Only", owner: "admin@navas.io", tenant: "TEPU", description: "Minimal access for end-customer portal login", permissionSets: ["GPS.Read"], timesUsed: 22, status: "Active", lastModified: "2026-03-07" },
//   { id: "TPL-005", name: "Full Admin (Dev)", owner: "dev@navas.io", tenant: "TEPU", description: "Unrestricted access for development and staging", permissionSets: ["All"], timesUsed: 2, status: "Draft", lastModified: "2026-03-06" },
// ];

// ─── Page ────────────────────────────────────────────────────────────────────
export function RbacPage() {
  const guard = usePermissionGuard();
  const navigate = useNavigate();
  const [sectionTab, setSectionTab] = useState<SectionTab>("Roles");
  const [bladeOpen, setBladeOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialStep, setWizardInitialStep] = useState<StepNumber>(1);
  const [wizardMode, setWizardMode] = useState<WizardMode>("quick");
  const [editPermModalOpen, setEditPermModalOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<PermissionSet | null>(null);
  const [editRoleModalOpen, setEditRoleModalOpen] = useState(false);
  const [permBladeOpen, setPermBladeOpen] = useState(false);
  const [selectedPerm, setSelectedPerm] = useState<PermissionSet | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // ── API state: Roles ──────────────────────────────────────────────────────
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  // ── API state: Permissions ────────────────────────────────────────────────
  const [permissionSets, setPermissionSets] = useState<PermissionSet[]>([]);
  const [permsLoading, setPermsLoading] = useState(true);

  // ── API state: Stats KPIs ──────────────────────────────────────────────
  const [statsLoading, setStatsLoading] = useState(true);
  const [activeRolesCount, setActiveRolesCount] = useState(0);
  const [totalPermsCount, setTotalPermsCount] = useState(0);
  const [activeClientsCount, setActiveClientsCount] = useState(0);
  const [active3dClientsCount, setActive3dClientsCount] = useState(0);
  const [clientUsersCount, setClientUsersCount] = useState(0);

  // ── Error state ────────────────────────────────────────────────────────
  const [fetchError, setFetchError] = useState<string | null>(null);

  function refreshRoles() {
    setRolesLoading(true);
    setFetchError(null);
    Promise.all([
      getAllRoles("engine"),
      getRoleUserCounts().catch(() => ({ data: {} as Record<string, number> })),
    ])
      .then(([rolesRes, countsRes]) => {
        const counts = countsRes.data;
        setRoles(rolesRes.data.map(r => {
          const role = mapRbacRoleToRole(r);
          role.users = counts[r.role_uid] ?? -1;
          return role;
        }));
      })
      .catch(() => setFetchError("Failed to load roles"))
      .finally(() => setRolesLoading(false));
  }

  function refreshPermissions() {
    setPermsLoading(true);
    setFetchError(null);
    Promise.all([
      getAllPermissions("engine"),
      getPermissionRoleCounts().catch(() => ({ data: {} as Record<string, number> })),
    ])
      .then(([permsRes, countsRes]) => {
        const counts = countsRes.data;
        setPermissionSets(permsRes.data.map(p => {
          const perm = mapRbacPermToPermissionSet(p);
          perm.rolesUsing = counts[p.permission_uid] ?? 0;
          return perm;
        }));
      })
      .catch(() => setFetchError("Failed to load permissions"))
      .finally(() => setPermsLoading(false));
  }

  function refreshStats() {
    setStatsLoading(true);
    Promise.all([
      getActiveRolesCount().then(res => setActiveRolesCount(res.data.total_active_roles)).catch(() => {}),
      getTotalPermissionsCount().then(res => setTotalPermsCount(res.data.total_permissions)).catch(() => {}),
      getActiveClientsCount().then(res => setActiveClientsCount(res.data.total_active_clients)).catch(() => {}),
      getActive3dClientsCount().then(res => setActive3dClientsCount(res.data.total_active_3d_clients)).catch(() => {}),
      getClientUsersCount().then(res => setClientUsersCount(res.data.total_client_users)).catch(() => {}),
    ]).finally(() => setStatsLoading(false));
  }

  useEffect(() => {
    // Roles + user counts
    Promise.all([
      getAllRoles("engine"),
      getRoleUserCounts().catch(() => ({ data: {} as Record<string, number> })),
    ])
      .then(([rolesRes, countsRes]) => {
        const counts = countsRes.data;
        setRoles(rolesRes.data.map(r => {
          const role = mapRbacRoleToRole(r);
          role.users = counts[r.role_uid] ?? -1;
          return role;
        }));
      })
      .catch(() => setFetchError("Failed to load roles"))
      .finally(() => setRolesLoading(false));

    // Permissions + role counts
    Promise.all([
      getAllPermissions("engine"),
      getPermissionRoleCounts().catch(() => ({ data: {} as Record<string, number> })),
    ])
      .then(([permsRes, countsRes]) => {
        const counts = countsRes.data;
        setPermissionSets(permsRes.data.map(p => {
          const perm = mapRbacPermToPermissionSet(p);
          perm.rolesUsing = counts[p.permission_uid] ?? 0;
          return perm;
        }));
      })
      .catch(() => setFetchError("Failed to load permissions"))
      .finally(() => setPermsLoading(false));

    // Stats KPIs
    Promise.all([
      getActiveRolesCount().then(res => setActiveRolesCount(res.data.total_active_roles)).catch(() => {}),
      getTotalPermissionsCount().then(res => setTotalPermsCount(res.data.total_permissions)).catch(() => {}),
      getActiveClientsCount().then(res => setActiveClientsCount(res.data.total_active_clients)).catch(() => {}),
      getActive3dClientsCount().then(res => setActive3dClientsCount(res.data.total_active_3d_clients)).catch(() => {}),
      getClientUsersCount().then(res => setClientUsersCount(res.data.total_client_users)).catch(() => {}),
    ]).finally(() => setStatsLoading(false));
  }, []);

  // Track selected IDs for each section
  const [selectedRoleId, setSelectedRoleId] = useState<string>();
  const [selectedPsId, setSelectedPsId] = useState<string>();
  // const [selectedAclId, setSelectedAclId] = useState<string>();
  // const [selectedPolicyId, setSelectedPolicyId] = useState<string>();
  // const [selectedTemplateId, setSelectedTemplateId] = useState<string>();

  function handleRoleSelect(role: Role) {
    setSelectedRole(role);
    setSelectedRoleId(role.id);
    setBladeOpen(true);
  }

  function handleEditPermission(perm: PermissionSet) {
    setEditingPermission(perm);
    setEditPermModalOpen(true);
  }

  async function handleDeletePermission(perm: PermissionSet) {
    if (!confirm(`Delete permission "${perm.name}"? This will also remove it from all roles.`)) return;
    try {
      await guard("rbac.delete", () => deletePermission(perm.id));
      refreshPermissions();
      refreshStats();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete permission.");
    }
  }

  function handleExport() {
    let csv = "";
    let filename = "";
    if (sectionTab === "Roles") {
      csv = "ID,Name,Owner,Tenant,Users,Permissions,Last Modified\n"
        + roles.map(r => [r.id, r.name, r.owner, r.tenant, r.users === -1 ? "" : r.users, r.permissions, r.lastModified]
          .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(",")
        ).join("\n");
      filename = "rbac-roles.csv";
    } else {
      csv = "ID,Name,Owner,Module,Actions,Roles Using,Description\n"
        + permissionSets.map(p => [p.id, p.name, p.owner, p.module, p.actions.join(";"), p.rolesUsing, p.description]
          .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(",")
        ).join("\n");
      filename = "rbac-permissions.csv";
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const s = statsLoading ? "..." : null;

  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden relative">
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-3 p-3">

          {/* ── Error Banner ──────────────────────────────────────────── */}
          {fetchError && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA]">
              <span className="text-[12px] text-[#EF4444] font-black">{fetchError}</span>
              <button onClick={() => setFetchError(null)} className="text-[#EF4444] text-[14px] font-black bg-transparent border-none cursor-pointer hover:opacity-70">X</button>
            </div>
          )}

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <div className="text-[11px] text-[#667781] mb-0.5">Governance &#9656; Roles, Permissions & Object Access</div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-[16px] text-[#111B21]">RBAC Management</span>
                  <span className="text-[10px] font-black bg-[#128C7E] text-white px-2 py-0.5 rounded-full">HIC / HITL</span>
                </div>
                <div className="text-[11px] text-[#667781] mt-0.5">Least privilege at scale &#8226; Maker-checker for role changes &#8226; Immutable audit trail</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <PermissionGate permission="rbac.create">
                  <Pill onClick={() => navigate("/rbac/roles/new")} color="green">+ Create Role</Pill>
                </PermissionGate>
                <PermissionGate permissions={["rbac.create", "rbac.assign"]}>
                  <Pill onClick={() => { setWizardMode("full"); setWizardInitialStep(1); setWizardOpen(true); }} color="dark">Setup Wizard</Pill>
                </PermissionGate>
                <Pill onClick={handleExport}>Export</Pill>
              </div>
            </div>
          </div>

          {/* ── 5 KPI Cards ──────────────────────────────────────────── */}
          <div className="grid grid-cols-5 gap-3">
            <KpiCard title="Active Roles" value={s ?? String(activeRolesCount)} delta={`${totalPermsCount} permissions`} deltaTone="text-[#25D366]" sub="across all tenants" dot="bg-[#25D366]" />
            <KpiCard title="Total Permissions" value={s ?? String(totalPermsCount)} delta="all modules" deltaTone="text-[#128C7E]" sub="granular access control" dot="bg-[#128C7E]" />
            <KpiCard title="Active Clients" value={s ?? String(activeClientsCount)} delta="logged in 24h" deltaTone="text-[#34B7F1]" sub="client accounts" dot="bg-[#34B7F1]" />
            <KpiCard title="Active 3D Users" value={s ?? String(active3dClientsCount)} delta="logged in 24h" deltaTone="text-[#F97316]" sub="internal users" dot="bg-[#F97316]" />
            <KpiCard title="Client Users" value={s ?? String(clientUsersCount)} delta="total accounts" deltaTone="text-[#8B5CF6]" sub="across all clients" dot="bg-[#8B5CF6]" />
          </div>

          {/* ── Section Tab Bar + Search ──────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-2.5 flex items-center justify-between">
            <div className="flex gap-1.5">
              {SECTION_TABS.map(t => (
                <button
                  key={t}
                  onClick={() => setSectionTab(t)}
                  className={`h-8 px-3 rounded-full text-[11px] font-black border-none cursor-pointer transition-all ${sectionTab === t ? "bg-[#128C7E] text-white" : "bg-[#F0F2F5] text-[#667781] hover:bg-[#E9EDEF]"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, ID, tenant..."
                className="h-8 w-[240px] px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#111B21] bg-[#F8FAFC] outline-none focus:border-[#128C7E]"
              />
              <button
                onClick={() => {
                  if (sectionTab === "Roles") { refreshRoles(); refreshStats(); }
                  else if (sectionTab === "Permission Sets") { refreshPermissions(); refreshStats(); }
                }}
                disabled={sectionTab === "Roles" ? rolesLoading : permsLoading}
                className="h-8 px-3 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
              >
                {(sectionTab === "Roles" ? rolesLoading : permsLoading) ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {/* ── Active Section Table ─────────────────────────────────── */}
          {sectionTab === "Roles" && (
            rolesLoading
              ? <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-8 text-center text-[12px] text-[#667781]">Loading roles...</div>
              : <RolesTable
                  roles={roles.filter(r => !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.id.toLowerCase().includes(searchQuery.toLowerCase()) || r.tenant.toLowerCase().includes(searchQuery.toLowerCase()))}
                  onSelect={handleRoleSelect}
                  selectedId={selectedRoleId}
                />
          )}

          {sectionTab === "Permission Sets" && (
            permsLoading
              ? <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-8 text-center text-[12px] text-[#667781]">Loading permissions...</div>
              : <PermissionSetsTable
                  sets={permissionSets.filter(s => !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.toLowerCase().includes(searchQuery.toLowerCase()) || s.module.toLowerCase().includes(searchQuery.toLowerCase()))}
                  onSelect={s => { setSelectedPsId(s.id); setSelectedPerm(s); setPermBladeOpen(true); }}
                  onEdit={handleEditPermission}
                  onDelete={handleDeletePermission}
                  onCreate={() => { setWizardMode("quick"); setWizardInitialStep(1); setWizardOpen(true); }}
                  selectedId={selectedPsId}
                />
          )}

          {/* {sectionTab === "Object ACLs" && (
            <ObjectAclsTable
              acls={MOCK_ACLS.filter(a => !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.id.toLowerCase().includes(searchQuery.toLowerCase()))}
              onSelect={a => { setSelectedAclId(a.id); }}
              selectedId={selectedAclId}
            />
          )} */}

          {/* {sectionTab === "Policies" && (
            <PoliciesTable
              policies={MOCK_POLICIES.filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase()))}
              onSelect={p => { setSelectedPolicyId(p.id); }}
              selectedId={selectedPolicyId}
            />
          )} */}

          {/* {sectionTab === "Role Templates" && (
            <RoleTemplatesTable
              templates={MOCK_TEMPLATES.filter(t => !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.id.toLowerCase().includes(searchQuery.toLowerCase()))}
              onSelect={t => { setSelectedTemplateId(t.id); }}
              selectedId={selectedTemplateId}
            />
          )} */}

          {/* ── Waswa AI Insights ─────────────────────────────────────── */}
          <div className="bg-[#128C7E] text-white rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-black text-[13px]">Waswa AI &#8226; RBAC Insights</span>
              <span className="text-[12px] opacity-70 cursor-pointer">&#183;&#183;&#183;</span>
            </div>
            <div className="text-[11px] leading-relaxed opacity-90">
              <div>&#8226; Permission drift detected: 2 users with wider access than role baseline (ROL-004)</div>
              <div>&#8226; Least-privilege recommendation: ROL-005 can drop Alerts.View (unused 90d)</div>
              <div>&#8226; Access denied explainer: 3 tickets today attributed to missing Object ACLs (not role permissions)</div>
            </div>
          </div>

          {/* ── Monitoring KPIs (commented out) ─────────────────────── */}
          {/* <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E9EDEF]">
              <div className="font-black text-[13px] text-[#111B21]">Monitoring & KPIs</div>
            </div>
            <div className="p-4">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[#E9EDEF]">
                    {["KPI", "Definition", "Target", "Current", "Status"].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-black text-[#667781]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { kpi: "Availability", def: "Module usable without errors", target: ">= 99.5%", current: "99.8%", ok: true },
                    { kpi: "Change success rate", def: "No rollback required", target: ">= 95%", current: "97.2%", ok: true },
                    { kpi: "Time-to-detect", def: "Issue start to detection", target: "< 15 min (P1)", current: "8 min avg", ok: true },
                    { kpi: "MTTR impact", def: "Resolution time contribution", target: "Continuous reduction", current: "12 min (-18%)", ok: true },
                  ].map(k => (
                    <tr key={k.kpi} className="border-b border-[#E9EDEF] last:border-0">
                      <td className="px-3 py-2.5 font-black text-[#111B21]">{k.kpi}</td>
                      <td className="px-3 py-2.5 text-[#667781]">{k.def}</td>
                      <td className="px-3 py-2.5 text-[#667781]">{k.target}</td>
                      <td className="px-3 py-2.5 font-black text-[#111B21]">{k.current}</td>
                      <td className="px-3 py-2.5">
                        <span className={`flex items-center gap-1.5`}>
                          <span className={`w-2 h-2 rounded-full ${k.ok ? "bg-[#25D366]" : "bg-[#EF4444]"}`} />
                          <span className={`font-black ${k.ok ? "text-[#1A7A3A]" : "text-[#EF4444]"}`}>{k.ok ? "On Target" : "At Risk"}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div> */}

          <div className="text-[11px] text-[#667781] italic px-1 pb-2">End of page</div>
        </div>
      </main>

      {/* ── Blade: Role Detail ───────────────────────────────────── */}
      {bladeOpen && selectedRole && (
        <RbacDetailBlade
          role={selectedRole}
          onClose={() => setBladeOpen(false)}
          onEdit={() => { setBladeOpen(false); navigate(`/rbac/roles/${selectedRole.id}/edit`); }}
          onDisabled={() => { setBladeOpen(false); refreshRoles(); refreshStats(); }}
        />
      )}

      {/* ── Blade: Permission Detail ──────────────────────────────── */}
      {permBladeOpen && selectedPerm && (
        <PermissionDetailBlade
          permission={selectedPerm}
          onClose={() => setPermBladeOpen(false)}
          onEdit={handleEditPermission}
          onDelete={handleDeletePermission}
        />
      )}

      {/* ── RBAC Setup Wizard ─────────────────────────────────── */}
      <RbacWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        mode={wizardMode}
        initialStep={wizardInitialStep}
        onDataChanged={() => { refreshRoles(); refreshPermissions(); refreshStats(); }}
      />

      {/* ── Modal: Edit Role ─────────────────────────────────────── */}
      <EditRoleModal open={editRoleModalOpen} role={selectedRole} onClose={() => setEditRoleModalOpen(false)} onUpdated={() => { refreshRoles(); refreshStats(); }} />

      {/* ── Modal: Edit Permission ──────────────────────────────── */}
      <EditPermissionModal open={editPermModalOpen} permission={editingPermission} onClose={() => setEditPermModalOpen(false)} onUpdated={() => { refreshPermissions(); refreshStats(); }} />
    </div>
  );
}

// ─── Local reusable components ───────────────────────────────────────────────
const pillStyles: Record<string, string> = {
  green: "bg-[#25D366] text-[#075E54]",
  dark:  "bg-[#075E54] text-white",
  ghost: "bg-white border border-[#E9EDEF] text-[#667781]",
};

function Pill({ color = "ghost", onClick, children }: { color?: string; onClick?: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`h-7 px-3 rounded-full text-[11px] font-black border-none cursor-pointer hover:brightness-105 active:opacity-85 transition-all whitespace-nowrap ${pillStyles[color] ?? pillStyles.ghost}`}>{children}</button>;
}

function KpiCard({ title, value, delta, deltaTone, sub, dot }: {
  title: string; value: string; delta: string; deltaTone: string; sub: string; dot: string;
}) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl p-3 relative">
      <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${dot}`} />
      <div className="font-black text-[12px] text-[#111B21]">{title}</div>
      <div className="text-[22px] font-black text-[#111B21] mt-1 leading-tight">{value}</div>
      <div className="flex items-center gap-3 mt-1">
        <span className={`text-[11px] font-black ${deltaTone}`}>{delta}</span>
        <span className="text-[11px] text-[#667781]">{sub}</span>
      </div>
    </div>
  );
}

      
