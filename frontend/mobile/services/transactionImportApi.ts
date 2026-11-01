import { API_BASE_URL } from '@/services/apiConfig';
import { getAccessToken } from '@/services/tokenStorage';
import type { ExcludedRow, ImportPreview, ImportResult, PreviewRow } from '@/types/transactionImport';

/**
 * Server-side import routes. Confirm the two paths against the deployed Swagger spec.
 * No client-side CSV-to-transaction loop: the server owns duplicate detection and categorization.
 * If the deployment uses other names, ONLY change these constants.
 */
export const TRANSACTION_IMPORT_ENDPOINTS = {
  preview: '/transactions/import/preview',
  confirm: '/transactions/import/confirm',
} as const;

type JsonObject = Record<string, unknown>;
const record = (v: unknown): JsonObject => v && typeof v === 'object' && !Array.isArray(v) ? v as JsonObject : {};
const collection = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const string = (v: unknown, fallback = '') => v == null ? fallback : String(v);
const number = (v: unknown, fallback = 0) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v !== 'string') return fallback;
  const n = Number(v.replace(/[₩,\s원]/g,'')); return Number.isFinite(n) ? n : fallback;
};
const first = (...vs: unknown[]) => vs.find(v => v !== undefined && v !== null);
const bool = (v: unknown) => v === true || v === 1 || v === 'true';

export class ImportApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); this.name = 'ImportApiError'; }
}
async function fetchJson(path: string, init: RequestInit): Promise<JsonObject> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Accept','application/json');
  if (token) headers.set('Authorization',`Bearer ${token}`);
  let response: Response;
  try { response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers }); }
  catch { throw new ImportApiError('파일 등록 서버에 연결할 수 없습니다. API 주소와 배포 상태를 확인해 주세요.', 0); }
  let payload: unknown = null;
  try { payload = await response.json(); } catch { /* Error responses may be empty. */ }
  if (!response.ok) {
    const message = string(first(record(payload).detail,record(payload).message), '파일 처리 중 오류가 발생했습니다.');
    if (response.status === 404) throw new ImportApiError('파일 가져오기 API가 아직 배포되지 않았거나 경로가 다릅니다. 배포 후 다시 시도해 주세요.',404);
    throw new ImportApiError(message, response.status);
  }
  return record(payload);
}

function excludedReason(row: JsonObject): string {
  const status = string(first(row.status,row.type,row.reason_code,row.exclude_code)).toUpperCase();
  const explicit = first(row.exclude_reason,row.skip_reason,row.reason,row.error,row.message);
  if (explicit) return string(explicit);
  if (bool(first(row.is_duplicate,row.duplicate)) || status.includes('DUPLICATE')) return '이미 등록한 거래';
  if (bool(row.is_refund)) return '환불 또는 취소 거래';
  if (bool(row.is_income)) return '수입 거래';
  if (status.includes('REFUND') || status.includes('CANCEL')) return '환불 또는 취소 거래';
  if (status.includes('INCOME')) return '수입 거래';
  return '읽지 못한 항목';
}

export function normalizeImportPreview(response: unknown): ImportPreview {
  const root = record(response);
  const data = record(root.data);
  const payload = record(first(data.preview, data.result, root.preview, data.rows ? data : undefined, root.rows ? root : undefined, data));
  const uploadId = first(payload.preview_id, payload.upload_id, payload.import_id, data.preview_id, data.upload_id, root.preview_id);
  const source = collection(first(payload.rows, payload.transactions, payload.items, payload.valid_rows, payload.preview_rows, data.rows, data.preview, root.rows));
  const explicitExcluded = collection(first(payload.excluded, payload.excluded_rows, payload.skipped_rows, payload.invalid_rows, payload.errors, data.excluded, data.excluded_rows, root.excluded));
  const valid: PreviewRow[] = [];
  const excluded: ExcludedRow[] = [];
  let duplicateCount = number(first(payload.duplicate_count, payload.duplicates_count, data.duplicate_count),0);
  function asExcluded(raw: JsonObject, index: number): ExcludedRow {
    return { key: string(first(raw.row_id,raw.id,raw.line,raw.row_number,index)), sourceIndex: number(first(raw.row_index,raw.row_number,raw.line,index),index), reason:excludedReason(raw), merchant_name:string(first(raw.merchant_name,raw.merchant,raw.description,raw.거래처)), amount:number(first(raw.amount,raw.금액),0) };
  }
  source.forEach((entry,index)=>{
    const raw = record(entry);
    const excludedStatus = string(first(raw.status,raw.type)).toUpperCase();
    const isExcluded = bool(first(raw.is_duplicate,raw.duplicate,raw.is_excluded,raw.excluded,raw.is_income,raw.is_refund)) ||
      ['DUPLICATE','INCOME','REFUND','INVALID','EXCLUDED','SKIPPED','ERROR'].some(x=>excludedStatus.includes(x));
    if (isExcluded) { excluded.push(asExcluded(raw,index)); return; }
    const suggestion = string(first(raw.suggested_category,raw.recommended_category,raw.predicted_category,raw.category_suggestion));
    const category = string(first(raw.final_category,raw.category,suggestion));
    valid.push({
      key:string(first(raw.row_id,raw.id,raw.row_index,raw.line,raw.row_number,index)),
      sourceIndex:number(first(raw.row_index,raw.row_number,raw.line,index),index),
      tx_date:string(first(raw.tx_date,raw.date,raw.transaction_date,raw.날짜)),
      tx_time:string(first(raw.tx_time,raw.time)),
      merchant_name:string(first(raw.merchant_name,raw.merchant,raw.description,raw.거래처)),
      amount:number(first(raw.amount,raw.금액)),
      memo:string(first(raw.memo,raw.note)),
      suggested_category:suggestion,
      final_category:category,
      selected:raw.selected === false ? false : true,
      raw,
    });
  });
  explicitExcluded.forEach((entry,index)=>excluded.push(asExcluded(record(entry), index+source.length)));
  // Local consolidation makes the UI safe even if server returns the same excluded row twice.
  const excludedUnique = Array.from(new Map(excluded.map(x=>[`${x.key}:${x.reason}`,x])).values());
  const countedDuplicates = excludedUnique.filter(x=>/중복|이미 등록|duplicate/i.test(x.reason)).length;
  duplicateCount = Math.max(duplicateCount,countedDuplicates);
  return {uploadId:uploadId == null ? undefined : String(uploadId), rows:valid, excluded:excludedUnique, duplicateCount};
}

export async function previewTransactionFile(file: File): Promise<ImportPreview> {
  const form = new FormData(); form.append('file',file,file.name);
  const result = await fetchJson(TRANSACTION_IMPORT_ENDPOINTS.preview,{method:'POST',body:form});
  const normalized = normalizeImportPreview(result);
  const reported = record(first(record(result.data).summary, record(result.data).preview, result.summary));
  const count = number(first(reported.row_count,reported.total_count,record(result.data).count, result.count),-1);
  if (!normalized.rows.length && !normalized.excluded.length && count !== 0) {
    throw new ImportApiError('서버 미리보기 응답을 해석하지 못했습니다. API 응답 형식을 확인해 주세요.',422);
  }
  return normalized;
}

export function normalizeImportResult(response: unknown, fallbackDuplicates=0): ImportResult {
  const root=record(response), data=record(root.data);
  const summary=record(first(data.summary,root.summary,data.result));
  return {
    imported:number(first(summary.imported_count,summary.created_count,summary.imported,summary.registered,summary.success_count,data.imported_count,data.created_count,data.count,root.imported_count,root.count),0),
    duplicateSkipped:number(first(summary.skipped_duplicates,summary.duplicate_count,summary.duplicates_skipped,summary.duplicate_skipped,data.skipped_duplicates,data.duplicate_count,root.skipped_duplicates),fallbackDuplicates),
  };
}

export async function confirmTransactionImport(preview: ImportPreview, selected: PreviewRow[]): Promise<ImportResult> {
  // Carry the original preview row fields through, preserving bank-specific metadata.
  const rows=selected.map(row=>({
    ...row.raw,
    row_id: first(row.raw.row_id,row.raw.id,row.key),
    row_index: first(row.raw.row_index,row.sourceIndex),
    tx_date:row.tx_date, tx_time:row.tx_time || undefined,
    merchant_name:row.merchant_name,amount:row.amount,
    final_category:row.final_category,memo:row.memo,
  }));
  const payload={...(preview.uploadId?{preview_id:preview.uploadId,upload_id:preview.uploadId}:{}), rows};
  const result=await fetchJson(TRANSACTION_IMPORT_ENDPOINTS.confirm,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),
  });
  return normalizeImportResult(result,preview.duplicateCount);
}
