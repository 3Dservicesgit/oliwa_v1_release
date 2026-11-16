import { useEffect } from "react";
import { useWizardState, type StepNumber } from "./useWizardState";
import { WizardStepperSidebar, FULL_SETUP_STEPS } from "./WizardStepperSidebar";
import { StepPermission } from "./StepPermission";
import { StepRole } from "./StepRole";
import { StepUser } from "./StepUser";
import { StepAssignRole } from "./StepAssignRole";

export type WizardMode = "full" | "quick";

/** Maps full-setup wizard step numbers to the actual component to render */
const FULL_STEP_MAP: Record<number, "user" | "assign-role" | "permission"> = {
  1: "user",
  2: "assign-role",
  3: "permission",
};

/** Maps quick-action initialStep to the component to render */
const QUICK_STEP_MAP: Record<number, "permission" | "role" | "user" | "assign-role"> = {
  1: "permission",
  2: "role",
  3: "user",
  4: "assign-role",
};

const STEP_TITLES: Record<string, string> = {
  "permission": "Create Permissions",
  "role": "Create Role",
  "user": "Create User",
  "assign-role": "Assign Role",
};

const STEP_SUBTITLES: Record<string, string> = {
  "permission": "Define module actions for your system",
  "role": "Bundle permissions into a named role",
  "user": "Add a new user account to the system",
  "assign-role": "Link a role to an existing user",
};

interface RbacWizardProps {
  open: boolean;
  onClose: () => void;
  mode?: WizardMode;
  initialStep?: StepNumber;
  onDataChanged?: () => void;
}

export function RbacWizard({ open, onClose, mode = "quick", initialStep = 1, onDataChanged }: RbacWizardProps) {
  const maxSteps = mode === "full" ? 3 : 4;
  const wizard = useWizardState(initialStep, maxSteps);

  useEffect(() => {
    if (open) {
      wizard.reset();
      wizard.goToStep(initialStep);
    }
  }, [open, initialStep]);

  if (!open) return null;

  const currentComponent = mode === "full"
    ? FULL_STEP_MAP[wizard.activeStep] ?? "user"
    : QUICK_STEP_MAP[wizard.activeStep] ?? "permission";

  function handleStepSuccess(component: string, data?: Record<string, unknown>) {
    const mapped: Record<string, unknown> = {};
    if (component === "permission" && data?.permissionUids) mapped.permissionUids = data.permissionUids;
    if (component === "role" && data?.roleName) mapped.roleName = data.roleName;
    if (component === "user" && data?.userUid) mapped.userUid = data.userUid;
    wizard.markCompleted(wizard.activeStep, mapped);
    onDataChanged?.();
  }

  function handleClose() {
    wizard.reset();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/35" onClick={handleClose} />

      {/* Panel */}
      <div className={`ml-auto relative h-full bg-white flex flex-col shadow-2xl ${
        mode === "full" ? "w-[min(1100px,90vw)]" : "w-[min(720px,85vw)]"
      }`}>
        {/* Header */}
        <div className="bg-[var(--brand-dark)] text-white px-5 py-3 flex items-center justify-between shrink-0">
          <div>
            <div className="font-black text-[15px]">{STEP_TITLES[currentComponent]}</div>
            <div className="text-[11px] opacity-70">{STEP_SUBTITLES[currentComponent]}</div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg bg-white/15 text-white font-black text-[14px] border-none cursor-pointer grid place-items-center hover:bg-white/25"
          >
            X
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar — only in full setup mode */}
          {mode === "full" && (
            <WizardStepperSidebar
              steps={FULL_SETUP_STEPS}
              activeStep={wizard.activeStep}
              completedSteps={wizard.completedSteps}
              onStepClick={wizard.goToStep}
            />
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-5 bg-[#FBFBFB]">
            {currentComponent === "permission" && (
              <StepPermission
                onSuccess={(uids) => handleStepSuccess("permission", { permissionUids: uids })}
                onClose={handleClose}
                onNext={wizard.goNext}
              />
            )}
            {currentComponent === "role" && (
              <StepRole
                preSelectedPermissionUids={wizard.stepData.permissionUids}
                onSuccess={(roleName) => handleStepSuccess("role", { roleName })}
                onClose={handleClose}
                onNext={wizard.goNext}
              />
            )}
            {currentComponent === "user" && (
              <StepUser
                mode={mode}
                preSelectedRoleName={wizard.stepData.roleName}
                onSuccess={(userUid) => handleStepSuccess("user", { userUid })}
                onClose={handleClose}
                onNext={wizard.goNext}
              />
            )}
            {currentComponent === "assign-role" && (
              <StepAssignRole
                preSelectedUserUid={wizard.stepData.userUid}
                onSuccess={() => handleStepSuccess("assign-role")}
                onClose={handleClose}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
