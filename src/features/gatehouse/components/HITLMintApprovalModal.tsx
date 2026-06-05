/**
 * HITLMintApprovalModal
 *
 * Full HITL (Human-in-the-Loop) approval modal for high-risk mint actions.
 * Presents scope, safeguards, audit preview and approver notes.
 * All styles use Tailwind utility classes only.
 */
import React from "react";

interface HITLMintApprovalModalProps {
  open:     boolean;
  onClose:  () => void;
  onApprove?: () => void;
  onEscalate?: () => void;
}

export function HITLMintApprovalModal({ open, onClose, onApprove, onEscalate }: HITLMintApprovalModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/45 flex items-center justify-center z-[9999] p-3"
    >
      <div className="
        w-full max-w-[860px] bg-white border border-[#E9EDEF] rounded-2xl
        flex flex-col overflow-hidden
        shadow-[0_18px_60px_rgba(0,0,0,0.25)]
        max-h-[calc(100dvh-24px)]
      ">

        {/* ── Modal Header ────────────────────────────────────────────── */}
        <div className="
          flex items-center justify-between gap-3 px-4 py-3
          bg-[#F0F2F5] border-b border-[#E9EDEF] shrink-0
        ">
          <div className="min-w-0">
            <div className="font-black text-[14px] text-[#111B21] leading-tight">
              HITL Approval — Mint 5,000 Tokens (VEBA)
            </div>
            <div className="text-[11px] text-[#667781] mt-0.5">
              Risk: MONEY MOVEMENT • Audit sealed • Requires human approval
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="
              w-9 h-9 rounded-xl border border-[#E9EDEF] bg-white
              text-[#667781] cursor-pointer shrink-0
              hover:bg-[#F0F2F5] transition-colors
            "
          >
            ✕
          </button>
        </div>

        {/* ── Modal Body ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

          {/* Summary */}
          <Section title="Summary">
            <p className="text-[12px] text-[#667781] leading-relaxed m-0">
              Waswa AI recommends minting 5,000 VEBA tokens to prevent tenant run‑out within 19 hours.
              This action is <strong>irreversible</strong> once approved (hash-chained audit trail).
            </p>
          </Section>

          {/* Scope + Safeguards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoBox title="Scope">
              <KV label="Tenant"  value={<strong>BodaUnion‑KLA</strong>} />
              <KV label="Wallet"  value={<strong>Type‑B (VEBA Rental)</strong>} />
              <KV label="Reason"  value="Prevent escrow settlement interruption" />
            </InfoBox>

            <InfoBox title="Safeguards">
              <KV label="Daily cap"      value={<><strong>150,000</strong> tokens</>} />
              <KV label="80% soft alert" value={<strong>ON</strong>} />
              <KV label="Grace"          value={<strong>2h</strong>} />
              <div className="mt-2.5 border border-[#FFE08A] bg-[#FFF8E1] rounded-lg px-2.5 py-2 text-[11px] text-[#7A5E00] leading-snug">
                Any override → Audit event (immutable). Price rule changes require separate HITL approval.
              </div>
            </InfoBox>
          </div>

          {/* Audit preview */}
          <Section title="Audit Preview">
            <p className="text-[12px] text-[#667781] leading-relaxed m-0">
              Hash preview: <code className="bg-[#F0F2F5] px-1 rounded text-[11px]">0x8d7f…c21a</code>
              &nbsp;• Retention: 365 days • Approver: SystemAdmin (RBAC: Can‑Spend)
            </p>
          </Section>

          {/* Notes to approver */}
          <Section title="Notes to Approver">
            <ul className="text-[12px] text-[#667781] leading-relaxed m-0 pl-4 space-y-1 list-disc">
              <li>Confirm this is not masking a reconciliation mismatch.</li>
              <li>Check gateway health (MTN callbacks) before mint.</li>
              <li>If suspicious: escalate to HIC (Break‑Glass).</li>
            </ul>
          </Section>
        </div>

        {/* ── Modal Footer ────────────────────────────────────────────── */}
        <div className="
          flex items-center justify-between gap-3 px-4 py-3
          border-t border-[#E9EDEF] shrink-0 flex-wrap
        ">
          <span className="text-[11px] text-[#667781]">S01 • Gatehouse Alpha • Modal</span>

          <div className="flex gap-2.5 flex-wrap">
            <ModalBtn variant="dark"  onClick={onClose}>Reject</ModalBtn>
            <ModalBtn variant="teal"  onClick={onEscalate}>Escalate HIC</ModalBtn>
            <ModalBtn variant="green" onClick={onApprove}>Approve Mint</ModalBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-black text-[12px] text-[#111B21] mb-1.5">{title}</div>
      {children}
    </div>
  );
}

function InfoBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[#E9EDEF] rounded-xl p-3 bg-[#F8F9FA] flex flex-col gap-2">
      <div className="font-black text-[12px] text-[#111B21]">{title}</div>
      {children}
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-x-2 text-[12px]">
      <span className="text-[#667781]">{label}</span>
      <span className="text-[#111B21]">{value}</span>
    </div>
  );
}

const modalBtnCls: Record<string, string> = {
  green: "bg-[#25D366] text-[#075E54] hover:brightness-105",
  teal:  "bg-[#128C7E] text-white hover:brightness-105",
  dark:  "bg-[#111B21] text-white hover:brightness-105",
};

function ModalBtn({ variant, onClick, children }: { variant: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`
        h-9 rounded-lg px-4 text-[12px] font-extrabold border-none
        cursor-pointer transition-all active:opacity-85
        ${modalBtnCls[variant]}
      `}
    >
      {children}
    </button>
  );
}
