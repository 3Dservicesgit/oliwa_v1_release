/**
 * waswa.types.ts — Waswa AI chat for the OLIWA tracking console.
 *
 * Shapes returned by POST /assistant/chat and POST /assistant/feedback
 * (navas-core-apis). Server field names are kept as-is.
 *
 * The OLIWA console is customer-facing: it only chats and rates answers.
 * Training Waswa (corrections, documents, approvals) happens in the CMS.
 */

export type WaswaSurface = "mobile" | "cms" | "oliwa_console";
export type WaswaVerdict = "wrong" | "unhelpful" | "good";

export interface WaswaEvidence {
  source_kind: string;          // account_context | tool | document | verified_answer
  source_ref: string;
  authority_level: number | null;
}

/** A staff-approved answer Waswa used for this reply. */
export interface WaswaVerifiedRef {
  answer_uid: string;
  question: string;
  approved_at: string | null;
  matched_on: string;
}

export interface WaswaChatRequest {
  message: string;
  surface?: WaswaSurface;
  conversation_uid?: string | null;
  /** The console screen the question came from, e.g. "Live Monitoring" — context only. */
  module?: string;
}

export interface WaswaChatReply {
  reply: string;
  model: string | null;
  conversation_uid: string | null;
  message_uid: string | null;
  verified_answers: WaswaVerifiedRef[];
  evidence: WaswaEvidence[];
  intent?: string;
  truncated?: boolean;
}

export interface WaswaFeedbackRequest {
  message_uid: string;
  verdict: WaswaVerdict;
  note?: string;
  surface?: WaswaSurface;
}

export interface WaswaFeedbackResult {
  feedback_uid: string;
  status: string;
  verdict: WaswaVerdict;
}
