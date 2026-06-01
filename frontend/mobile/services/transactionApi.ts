import { apiRequest } from '@/services/apiClient';
import type {
  CreateTransactionRequest,
  CreateTransactionResponse,
  DeleteTransactionResponse,
  TransactionsResponse,
  UpdateTransactionRequest,
  UpdateTransactionResponse,
} from '@/types/api';

export async function getTransactionsApi() {
  return apiRequest<TransactionsResponse>({
    path: '/transactions',
    method: 'GET',
    auth: true,
  });
}

export async function createTransactionApi(payload: CreateTransactionRequest) {
  return apiRequest<CreateTransactionResponse>({
    path: '/transactions',
    method: 'POST',
    body: payload,
    auth: true,
  });
}

export async function updateTransactionApi(
  txId: string,
  payload: UpdateTransactionRequest
) {
  return apiRequest<UpdateTransactionResponse>({
    path: `/transactions/${txId}`,
    method: 'PATCH',
    body: payload,
    auth: true,
  });
}

export async function deleteTransactionApi(txId: string) {
  return apiRequest<DeleteTransactionResponse>({
    path: `/transactions/${txId}`,
    method: 'DELETE',
    auth: true,
  });
}