/**
 * ConfirmDialog — In-app replacement for window.confirm().
 *
 * Usage with the useConfirmDialog hook:
 *
 *   const { confirm, dialogProps } = useConfirmDialog();
 *
 *   async function handleArchive() {
 *     const ok = await confirm({
 *       title: "Archive listing?",
 *       message: "No new bookings can be made.",
 *       confirmLabel: "Archive",
 *       variant: "danger",
 *     });
 *     if (!ok) return;
 *     // ... proceed
 *   }
 *
 *   return <><ConfirmDialog {...dialogProps} /> ... </>;
 */

import React, { useCallback, useRef, useState } from "react";

/* ── Variant styles ──────────────────────────────────────────────────── */

type Variant = "danger" | "warning" | "default";

const CONFIRM_STYLES: Record<Variant, string> = {
  danger:
    "bg-[#D93025] text-white hover:bg-[#B7271D]",
  warning:
    "bg-[#9A6700] text-white hover:bg-[#7A5200]",
  default:
    "bg-[#128C7E] text-white hover:bg-[#0D7466]",
};

/* ── Types ───────────────────────────────────────────────────────────── */

export interface ConfirmOptions {
  /** Dialog heading. */
  title?: string;
  /** Body text explaining what will happen. */
  message: string;
  /** Label for the confirm button (default: "Confirm"). */
  confirmLabel?: string;
  /** Label for the cancel button (default: "Cancel"). */
  cancelLabel?: string;
  /** Colour intent (default: "default"). */
  variant?: Variant;
}

export interface ConfirmDialogProps {
  open: boolean;
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}

/* ── Component ───────────────────────────────────────────────────────── */

export function ConfirmDialog({ open, options, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;

  const {
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "default",
  } = options;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[rgba(17,27,33,0.45)] z-[200]"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201]
                   w-[380px] max-w-[90vw] bg-white rounded-2xl shadow-2xl
                   border border-[#E9EDEF] overflow-hidden"
      >
        <div className="px-5 pt-5 pb-4">
          {title && (
            <h3
              id="confirm-title"
              className="text-[14px] font-extrabold text-[#111B21] mb-1.5"
            >
              {title}
            </h3>
          )}
          <p
            id="confirm-message"
            className="text-[12px] text-[#667781] leading-relaxed"
          >
            {message}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#E9EDEF] bg-[#F8F9FA]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 text-[12px] font-bold rounded-lg border border-[#E9EDEF]
                       bg-white text-[#111B21] hover:bg-[#F0F2F5]
                       cursor-pointer transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-1.5 text-[12px] font-bold rounded-lg border-0
                        cursor-pointer transition-colors ${CONFIRM_STYLES[variant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Hook ────────────────────────────────────────────────────────────── */

const EMPTY_OPTIONS: ConfirmOptions = { message: "" };

/**
 * Hook that returns an async `confirm(opts)` function (resolves true/false)
 * and `dialogProps` to spread onto <ConfirmDialog>.
 */
export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>(EMPTY_OPTIONS);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const onConfirm = useCallback(() => {
    setOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const onCancel = useCallback(() => {
    setOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  return {
    confirm,
    dialogProps: { open, options, onConfirm, onCancel } as ConfirmDialogProps,
  };
}
