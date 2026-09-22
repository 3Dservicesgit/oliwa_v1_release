/**
 * auth/ProtectedRoute.tsx — Route guard based on RBAC permissions.
 *
 * Usage:
 *   <Route path="/audit" element={
 *     <ProtectedRoute permission="audit.view">
 *       <AuditPage />
 *     </ProtectedRoute>
 *   } />
 *
 * If the user lacks the required permission, an "Access Denied" screen is shown.
 * While permissions are loading, a spinner is displayed.
 */
import React, { ReactNode } from "react";
import { usePermissions } from "./PermissionsContext";

interface ProtectedRouteProps {
  /** The permission string required to access this route (e.g. "audit.view") */
  permission: string;
  children: ReactNode;
}

export function ProtectedRoute({ permission, children }: ProtectedRouteProps) {
  const { hasPermission, loading, error, refetch } = usePermissions();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F0F2F5]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
          <span className="text-[13px] text-[#667781]">Verifying access…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F0F2F5]">
        <div className="bg-white rounded-xl border border-[#E9EDEF] p-8 max-w-md text-center shadow-sm">
          <h2 className="text-[18px] font-bold text-[#111B21] mb-2">Couldn't open this page</h2>
          <p className="text-[13px] text-[#667781] mb-4">{error} Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="h-9 px-4 rounded-lg border-0 bg-[#128C7E] text-white text-[12px] font-extrabold cursor-pointer hover:bg-[#0D7466]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!hasPermission(permission)) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F0F2F5]">
        <div className="bg-white rounded-xl border border-[#E9EDEF] p-8 max-w-md text-center shadow-sm">
          <div className="text-[40px] mb-3">🔒</div>
          <h2 className="text-[18px] font-bold text-[#111B21] mb-2">
            Access Denied
          </h2>
          <p className="text-[13px] text-[#667781] mb-4">
            This page isn't available on your account.
          </p>
          <p className="text-[12px] text-[#667781]">
            Contact your administrator to request access.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
