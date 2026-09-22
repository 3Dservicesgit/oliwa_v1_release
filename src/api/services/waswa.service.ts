/**
 * waswa.service.ts — Waswa AI chat for the OLIWA tracking console.
 *
 *   POST /assistant/chat      → sendWaswaMessage
 *   POST /assistant/feedback  → sendWaswaFeedback
 *
 * Every request is sent with surface "oliwa_console" so answers and feedback
 * can be told apart from the CMS and the mobile app. The backend reads who the
 * customer is from the JWT and answers only from what that account may see;
 * nothing here sends a role or a permission.
 */

import { post } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ApiResponse, RequestOptions } from "../types";
import type {
  WaswaChatReply,
  WaswaChatRequest,
  WaswaFeedbackRequest,
  WaswaFeedbackResult,
} from "../types";

const SURFACE = "oliwa_console" as const;

export function sendWaswaMessage(
  req: WaswaChatRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<WaswaChatReply>> {
  return post<WaswaChatReply>(ENDPOINTS.WASWA.CHAT, { data: { surface: SURFACE, ...req } }, opts);
}

export function sendWaswaFeedback(
  req: WaswaFeedbackRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<WaswaFeedbackResult>> {
  return post<WaswaFeedbackResult>(ENDPOINTS.WASWA.FEEDBACK, { data: { surface: SURFACE, ...req } }, opts);
}
