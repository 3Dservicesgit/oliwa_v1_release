import { get } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ApiResponse, RequestOptions } from "../types";
import type {
  ActiveSubscriptionsResponse,
  PausedSubscriptionsResponse,
  HighSubClientsResponse,
  ChurnRateResponse,
  ExpiringSubscriptionsResponse,
  ClientTransaction,
} from "../types";

/** Fetch active token subscriptions. */
export function getActiveSubscriptions(
  opts?: RequestOptions,
): Promise<ApiResponse<ActiveSubscriptionsResponse>> {
  return get<ActiveSubscriptionsResponse>(ENDPOINTS.STATISTICS.TOKENS_ACTIVE, opts);
}

/** Fetch paused token subscriptions. */
export function getPausedSubscriptions(
  opts?: RequestOptions,
): Promise<ApiResponse<PausedSubscriptionsResponse>> {
  return get<PausedSubscriptionsResponse>(ENDPOINTS.STATISTICS.TOKENS_PAUSED, opts);
}

/** Fetch clients ranked by subscription count. */
export function getHighSubClients(
  opts?: RequestOptions,
): Promise<ApiResponse<HighSubClientsResponse>> {
  return get<HighSubClientsResponse>(ENDPOINTS.STATISTICS.HIGH_SUB_CLIENTS, opts);
}

/** Fetch subscription churn rate metrics. */
export function getChurnRate(
  opts?: RequestOptions,
): Promise<ApiResponse<ChurnRateResponse>> {
  return get<ChurnRateResponse>(ENDPOINTS.BILLING.CHURN_RATE, opts);
}

/** Fetch subscriptions expiring within N days. */
export function getExpiringSubscriptions(
  days = 30,
  opts?: RequestOptions,
): Promise<ApiResponse<ExpiringSubscriptionsResponse>> {
  return get<ExpiringSubscriptionsResponse>(`${ENDPOINTS.BILLING.EXPIRING}?days=${days}`, opts);
}

/** Fetch transaction history for a specific client. */
export function getClientTransactions(
  clientUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<ClientTransaction[]>> {
  return get<ClientTransaction[]>(`${ENDPOINTS.PAYMENTS.TRANSACTIONS}/${clientUid}/list`, opts);
}
