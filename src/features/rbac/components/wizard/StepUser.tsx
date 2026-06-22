import React, { useEffect, useState } from "react";
import { createUser, getAllRoles, getAllClients } from "../../../../api";
import type { RbacRole, Client } from "../../../../api";
import { useAuth } from "../../../../auth/AuthContext";
import { MSection, Field, StepSuccessBanner, ErrorBanner, INPUT_CLS, SELECT_CLS, BTN_PRIMARY } from "./WizardShared";

interface Props {
  preSelectedRoleName?: string;
  onSuccess: (userUid?: string) => void;
  onClose: () => void;
  onNext: () => void;
  /** When "full", hides Role & Billing section and changes submit to "Proceed to Assign Role" */
  mode?: "full" | "quick";
}

export function StepUser({ preSelectedRoleName, onSuccess, onClose, onNext, mode = "quick" }: Props) {
  const { state: { accountUid, accountRoot } } = useAuth();
  const [accountName, setAccountName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState("Admin");
  const [assignedRole, setAssignedRole] = useState(preSelectedRoleName ?? "");
  const [billingType, setBillingType] = useState("per_month");

  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [selectedClientUid, setSelectedClientUid] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch roles for the dropdown
  useEffect(() => {
    setRolesLoading(true);
    getAllRoles("engine")
      .then((res) => {
        setRoles(res.data);
        // Set default role: pre-selected from previous step, or first available
        if (preSelectedRoleName) {
          setAssignedRole(preSelectedRoleName);
        } else if (res.data.length > 0 && !assignedRole) {
          setAssignedRole(res.data[0].role_name);
        }
      })
      .catch(() => {})
      .finally(() => setRolesLoading(false));
  }, []);

  // Fetch clients when account type is Customer
  useEffect(() => {
    if (accountType !== "Customer") return;
    setClientsLoading(true);
    getAllClients()
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setClients(list);
        if (list.length > 0 && !selectedClientUid) {
          setSelectedClientUid(list[0].client_uid);
        }
      })
      .catch(() => setClients([]))
      .finally(() => setClientsLoading(false));
  }, [accountType]);

  async function handleSubmit() {
    if (!accountName.trim() || !username.trim() || !email.trim() || !password.trim()) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await createUser({
        account_name: accountName.trim(),
        username: username.trim(),
        account_type: accountType,
        assigned_role: assignedRole,
        email: email.trim(),
        password,
        root_account: accountType === "Customer" ? selectedClientUid : (accountRoot ?? "engine"),
        author: accountUid ?? "engine",
        billing_type: billingType,
      });
      const uid = res.data?.account_uid;
      if (mode === "full") {
        setSuccess(`User "${accountName.trim()}" created successfully.`);
      } else {
        setSuccess(`User "${accountName.trim()}" created successfully with role "${assignedRole}".`);
      }
      onSuccess(uid);
    } catch (err: any) {
      setError(err?.apiMessage ?? err?.message ?? "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = accountName.trim() && username.trim() && email.trim() && password.trim()
    && assignedRole && !submitting
    && (accountType !== "Customer" || selectedClientUid);

  return (
    <div>
      {success && (
        <StepSuccessBanner
          message={success}
          nextLabel="Proceed to Assign Role"
          onNext={onNext}
          onClose={onClose}
        />
      )}
      {error && <ErrorBanner message={error} />}

      <MSection title="Account Details">
        <div className="flex flex-col gap-3">
          <Field label="Full Name" required>
            <input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="e.g. Anthony Kiwanuka" className={INPUT_CLS} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Username" required>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. Kiwanukanthony" className={INPUT_CLS} />
            </Field>
            <Field label="Email" required>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. user@example.com" className={INPUT_CLS} />
            </Field>
          </div>
          <Field label="Password" required>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" className={INPUT_CLS} />
          </Field>
        </div>
      </MSection>

      <MSection title={mode === "full" ? "Account Settings" : "Role & Billing"}>
        <div className="flex flex-col gap-3">
          <div className={`grid gap-3 ${mode === "full" ? "grid-cols-2" : "grid-cols-2"}`}>
            <Field label="Account Type" required>
              <select value={accountType} onChange={(e) => setAccountType(e.target.value)} className={SELECT_CLS}>
                <option value="Admin">Admin</option>
                <option value="Operator">Operator</option>
                <option value="Viewer">Viewer</option>
                <option value="Customer">Customer</option>
              </select>
            </Field>
            {accountType === "Customer" && (
              <Field label="Client" required>
                {clientsLoading ? (
                  <div className="w-full h-9 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#667781] bg-white flex items-center">Loading clients...</div>
                ) : clients.length === 0 ? (
                  <div className="w-full h-9 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#667781] bg-white flex items-center">No clients found</div>
                ) : (
                  <select value={selectedClientUid} onChange={(e) => setSelectedClientUid(e.target.value)} className={SELECT_CLS}>
                    {clients.map((c) => (
                      <option key={c.client_uid} value={c.client_uid}>
                        {c.client_name ?? c.client_uid}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}
            <Field label="Assigned Role" required>
              {rolesLoading ? (
                <div className="w-full h-9 px-3 rounded-lg border border-[#E9EDEF] text-[12px] text-[#667781] bg-white flex items-center">Loading roles...</div>
              ) : (
                <select value={assignedRole} onChange={(e) => setAssignedRole(e.target.value)} className={SELECT_CLS}>
                  {roles.map((r) => (
                    <option key={r.role_uid} value={r.role_name}>
                      {r.role_name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Billing Type" required>
              <select value={billingType} onChange={(e) => setBillingType(e.target.value)} className={SELECT_CLS}>
                <option value="per_month">Per Month</option>
                <option value="per_year">Per Year</option>
                <option value="per_unit">Per Unit</option>
                <option value="prepaid">Prepaid</option>
              </select>
            </Field>
          </div>
        </div>
      </MSection>

      <div className="flex justify-end">
        <button onClick={handleSubmit} disabled={!canSubmit} className={BTN_PRIMARY}>
          {submitting ? "Creating..." : mode === "full" ? "Proceed to Assign Role" : "Create User"}
        </button>
      </div>
    </div>
  );
}
