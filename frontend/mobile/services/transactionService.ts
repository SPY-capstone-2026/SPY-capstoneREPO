import {
  createTransactionApi,
  deleteTransactionApi,
  getTransactionsApi,
  updateTransactionApi,
} from '@/services/transactionApi';
import type { Transaction } from '@/constants/mockTypes';
import type {
  ApiTransaction,
  CreateTransactionRequest,
  UpdateTransactionRequest,
} from '@/types/api';

function mapApiTransactionToTransaction(
  transaction: ApiTransaction
): Transaction {
  return {
    tx_id: transaction.tx_id,
    user_id: transaction.user_id,
    tx_date: transaction.tx_date,
    tx_time: transaction.tx_time ?? '',
    amount: transaction.amount,
    merchant_name: transaction.merchant_name,
    mydata_category: transaction.mydata_category,
    final_category: transaction.final_category,
    is_user_corrected: transaction.is_user_corrected,
  };
}

export async function getTransactionsFromApi() {
  const response = await getTransactionsApi();

  return response.data.map(mapApiTransactionToTransaction);
}

export async function createTransactionFromApi(
  payload: CreateTransactionRequest
) {
  const response = await createTransactionApi(payload);

  return mapApiTransactionToTransaction(response.data);
}

export async function updateTransactionFromApi(
  txId: string,
  payload: UpdateTransactionRequest
) {
  const response = await updateTransactionApi(txId, payload);

  return mapApiTransactionToTransaction(response.data);
}

export async function deleteTransactionFromApi(txId: string) {
  return deleteTransactionApi(txId);
}