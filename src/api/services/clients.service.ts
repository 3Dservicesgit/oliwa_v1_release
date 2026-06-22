/**
 * clients.service.ts — Clients API service.
 *
 * Endpoints:
 *   POST  /clients/create                         → createClient
 *   GET   /clients/all                            → getAllClients
 *   GET   /clients/{service_provider}/all         → getClientsByProvider
 *   PATCH /clients/{client_uid}/update            → updateClient
 *   PATCH /clients/{client_uid}/trash             → trashClient
 *   POST  /clients/{client_uid}/restore           → restoreClient
 *   GET   /clients/trashed                        → getTrashedClients
 *   GET   /devices/configured/{client_uid}/client → getClientDevices
 *   GET   /tokens/{client_uid}/balance            → getClientBalance
 *   POST  /payments/tokens/buy                    → buyTokens
 *   POST  /tokens/transfer                        → transferTokens
 */

import { get, post, patch } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ApiResponse, RequestOptions } from "../types";
import type {
  Client, ClientDevice, CreateClientRequest, UpdateClientRequest,
  TrashClientRequest, TrashedClient,
  TokenPackage,
  ClientTokenBalance, BuyTokensRequest, BuyTokensResponse,
  TransferTokensRequest, TransferTokensResponse,
  BudgetOfferRequest, BudgetOfferResponse,
} from "../types";

/** Create a new client. */
export function createClient(
  payload: CreateClientRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return post<string>(ENDPOINTS.CLIENTS.CREATE, { data: payload }, opts);
}

/** Fetch all clients. */
export function getAllClients(
  opts?: RequestOptions,
): Promise<ApiResponse<Client[]>> {
  return get<Client[]>(ENDPOINTS.CLIENTS.GET_ALL, opts);
}

/** Fetch clients filtered by service provider. */
export function getClientsByProvider(
  serviceProvider: string,
  opts?: RequestOptions,
): Promise<ApiResponse<Client[]>> {
  return get<Client[]>(`${ENDPOINTS.CLIENTS.BY_PROVIDER}/${serviceProvider}/all`, opts);
}

/** Update client info. */
export function updateClient(
  clientUid: string,
  payload: UpdateClientRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return patch<string>(`${ENDPOINTS.CLIENTS.UPDATE}/${clientUid}/update`, { data: payload }, opts);
}

/** Soft-delete (trash) a client. */
export function trashClient(
  clientUid: string,
  payload: TrashClientRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return patch<string>(`${ENDPOINTS.CLIENTS.TRASH}/${clientUid}/trash`, { data: payload }, opts);
}

/** Restore a trashed client. */
export function restoreClient(
  clientUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return post<string>(`${ENDPOINTS.CLIENTS.RESTORE}/${clientUid}/restore`, {}, opts);
}

/** Fetch all trashed clients. */
export function getTrashedClients(
  opts?: RequestOptions,
): Promise<ApiResponse<TrashedClient[]>> {
  return get<TrashedClient[]>(ENDPOINTS.CLIENTS.GET_TRASHED, opts);
}

/** Fetch configured devices belonging to a specific client. */
export function getClientDevices(
  clientUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<ClientDevice[]>> {
  return get<ClientDevice[]>(`${ENDPOINTS.CLIENTS.DEVICES}/${clientUid}/client`, opts);
}

/** Fetch all available token packages from the registry. */
export function getAllTokens(
  opts?: RequestOptions,
): Promise<ApiResponse<TokenPackage[]>> {
  return get<TokenPackage[]>(ENDPOINTS.TOKENS.GET_ALL, opts);
}

/** Fetch the tokens that fit within a given budget (currency + amount). */
export function getBudgetOffer(
  payload: BudgetOfferRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<BudgetOfferResponse>> {
  return post<BudgetOfferResponse>(ENDPOINTS.TOKENS.BUDGET_OFFER, { data: payload }, opts);
}

/** Fetch token balance for a client. */
export function getClientBalance(
  clientUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<ClientTokenBalance>> {
  return get<ClientTokenBalance>(`${ENDPOINTS.TOKENS.BALANCE}/${clientUid}/balance`, opts);
}

/** Buy tokens via Mobile Money. */
export function buyTokens(
  payload: BuyTokensRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<BuyTokensResponse>> {
  return post<BuyTokensResponse>(ENDPOINTS.TOKENS.BUY, { data: payload }, opts);
}

/** Transfer tokens between clients. */
export function transferTokens(
  payload: TransferTokensRequest,
  opts?: RequestOptions,
): Promise<ApiResponse<TransferTokensResponse>> {
  return post<TransferTokensResponse>(ENDPOINTS.TOKENS.TRANSFER, { data: payload }, opts);
}

// ── Subscription management ─────────────────────────────────────────────────

/** Pause a device subscription (stops billing, conserves hours). */
export function pauseSubscription(
  deviceImei: string,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return post<string>(ENDPOINTS.TOKENS.SUB_PAUSE, { data: { device_imei: deviceImei } }, opts);
}

/** Restore a paused subscription (resumes billing & tracking). */
export function restoreSubscription(
  deviceImei: string,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return post<string>(ENDPOINTS.TOKENS.SUB_RESTORE, { data: { device_imei: deviceImei } }, opts);
}

/** Move a device to a different token (with more hours). */
export function updateSubscription(
  deviceImei: string,
  newTokenBillingUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<string>> {
  return post<string>(ENDPOINTS.TOKENS.SUB_UPDATE, {
    data: { device_imei: deviceImei, new_token_billing_uid: newTokenBillingUid },
  }, opts);
}

/** Check payment status for a specific transaction. */
export function getPaymentStatus(
  transactionUid: string,
  opts?: RequestOptions,
): Promise<ApiResponse<{ transaction_status: string }>> {
  return get<{ transaction_status: string }>(
    `${ENDPOINTS.TOKENS.PAYMENT_STATUS}/${transactionUid}/status`,
    opts,
  );
}
