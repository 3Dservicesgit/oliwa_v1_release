import React from "react";
import { usePermissions } from "../../../../auth/PermissionsContext";
import type { StepNumber } from "./useWizardState";

export interface WizardStep {
  id: StepNumber;
  title: string;
  subtitle: string;
  permission: string;
}

export const FULL_SETUP_STEPS: WizardStep[] = [
  { id: 1, title: "Create User", subtitle: "Add user account", permission: "rbac.create" },
  { id: 2, title: "Assign Role", subtitle: "Link role to user", permission: "rbac.assign" },
  { id: 3, title: "Assign Permissions", subtitle: "Define module actions", permission: "rbac.create" },
];

interface Props {
  steps: WizardStep[];
  activeStep: StepNumber;
  completedSteps: Set<number>;
  onStepClick: (step: StepNumber) => void;
}

export function WizardStepperSidebar({ steps, activeStep, completedSteps, onStepClick }: Props) {
  const { hasPermission } = usePermissions();

  return (
    <div className="w-[220px] shrink-0 bg-[#F8FAFC] border-r border-[#E9EDEF] py-4 px-3 flex flex-col gap-1">
      <div className="text-[10px] font-black text-[#667781] uppercase tracking-wider px-2 mb-2">
        Setup Steps
      </div>

      {steps.map((step, idx) => {
        const isActive = activeStep === step.id;
        const isCompleted = completedSteps.has(step.id);
        const allowed = hasPermission(step.permission);
        const isLast = idx === steps.length - 1;

        return (
          <div key={step.id} className="relative">
            {/* Connector line */}
            {!isLast && (
              <div
                className={`absolute left-[18px] top-[36px] w-[2px] h-[12px] ${
                  isCompleted ? "bg-[#25D366]" : "bg-[#E9EDEF]"
                }`}
              />
            )}

            <button
              onClick={() => allowed && onStepClick(step.id)}
              disabled={!allowed}
              className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left transition-colors cursor-pointer border-none ${
                isActive
                  ? "bg-white shadow-sm"
                  : "bg-transparent hover:bg-white/60"
              } ${!allowed ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              {/* Step circle */}
              <div
                className={`w-[28px] h-[28px] rounded-full shrink-0 flex items-center justify-center text-[12px] font-black ${
                  isCompleted
                    ? "bg-[#25D366] text-white"
                    : isActive
                    ? "bg-[var(--brand)] text-white"
                    : "bg-[#E9EDEF] text-[#667781]"
                }`}
              >
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  step.id
                )}
              </div>

              {/* Step text */}
              <div className="min-w-0">
                <div
                  className={`text-[12px] font-black truncate ${
                    isActive ? "text-[#111B21]" : isCompleted ? "text-[var(--brand)]" : "text-[#667781]"
                  }`}
                >
                  {step.title}
                </div>
                <div className="text-[10px] text-[#667781] truncate">{step.subtitle}</div>
              </div>

              {/* Lock icon for no-permission */}
              {!allowed && (
                <svg className="w-3.5 h-3.5 text-[#667781] shrink-0 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
