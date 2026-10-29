import type { ApiTransaction } from '@/types/api';

/** The backend may return memo=null for an empty note. */
export type TransactionWithImport = ApiTransaction & {
  memo?: string | null;
  is_imported?: boolean;
};

export type PreviewRow = {
  key: string;
  sourceIndex: number;
  tx_date: string;
  tx_time?: string;
  merchant_name: string;
  amount: number;
  memo: string;
  final_category: string;
  suggested_category: string;
  selected: boolean;
  raw: Record<string, unknown>;
};
export type ExcludedRow = { key: string; sourceIndex: number; reason: string; merchant_name: string; amount?: number };
export type ImportPreview = { uploadId?: string; rows: PreviewRow[]; excluded: ExcludedRow[]; duplicateCount: number };
export type ImportResult = { imported: number; duplicateSkipped: number };
