import { useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { FileUp, Upload, X } from 'lucide-react-native';
import { apiRequest } from '@/services/apiClient';
import { useToast } from '@/contexts/ToastContext';
import { palette, ui } from '@/constants/moniTheme';

export type ImportedRow = { tx_date: string; tx_time?: string; amount: number; merchant_name: string; final_category: string; line: number };
type InvalidRow = { line: number; reason: string };
type Props = { categories: string[]; onImported: () => Promise<void> | void };

type CsvTable = string[][];
/** RFC4180-style escaped fields, embedded commas, and newlines. */
export function readCsv(text: string): CsvTable {
  const rows: CsvTable = []; let row: string[] = []; let cell = ''; let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '"') { if (quoted && source[i + 1] === '"') { cell += '"'; i += 1; } else { quoted = !quoted; } }
    else if (ch === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((ch === '\r' || ch === '\n') && !quoted) {
      if (ch === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell.trim()); cell = '';
      if (row.some(item => item)) rows.push(row);
      row = [];
    } else { cell += ch; }
  }
  if (quoted) throw new Error('CSV 따옴표가 닫히지 않았어요.');
  row.push(cell.trim()); if (row.some(item => item)) rows.push(row);
  return rows;
}
function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number); const actual = new Date(Date.UTC(y, m - 1, d));
  return actual.getUTCFullYear() === y && actual.getUTCMonth() === m - 1 && actual.getUTCDate() === d;
}
export function parseTransactionsCsv(text: string, allowedCategories: string[]) {
  const table = readCsv(text);
  if (table.length < 2) throw new Error('CSV에 소비 기록이 없어요.');
  const headers = table[0].map(h => h.trim().toLowerCase());
  const idx = (...aliases: string[]) => headers.findIndex(h => aliases.includes(h));
  const indices = {
    date: idx('날짜','거래일','date','tx_date'), amount: idx('금액','amount','거래금액'),
    merchant: idx('결제처','사용처','가맹점','merchant','merchant_name'),
    category: idx('카테고리','분류','category','final_category'),
    time: idx('시간','time','tx_time'),
  };
  if (indices.date < 0 || indices.amount < 0 || indices.merchant < 0 || indices.category < 0) {
    throw new Error('첫 행에 날짜, 금액, 결제처, 카테고리 열이 필요해요.');
  }
  const allowed = new Set(allowedCategories);
  const valid: ImportedRow[] = []; const invalid: InvalidRow[] = [];
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const tx_date = cells[indices.date] || '';
    const rawAmount = (cells[indices.amount] || '').replace(/[₩원,\s]/g, '');
    const amount = Number(rawAmount);
    const merchant_name = (cells[indices.merchant] || '').trim();
    const final_category = (cells[indices.category] || '').trim();
    const tx_time = indices.time >= 0 ? (cells[indices.time] || '').trim() : '';
    const reason = !validDate(tx_date) ? '날짜는 YYYY-MM-DD로 입력해 주세요.'
      : !rawAmount || !Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount) ? '금액은 0보다 큰 정수여야 해요.'
      : !merchant_name ? '결제처가 비어 있어요.'
      : !allowed.has(final_category) ? `등록되지 않은 카테고리: ${final_category}`
      : tx_time && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(tx_time) ? '시간 형식이 잘못됐어요.' : '';
    if (reason) invalid.push({line, reason});
    else valid.push({line, tx_date, amount, merchant_name, final_category, ...(tx_time ? {tx_time} : {})});
  });
  return {valid, invalid};
}

export function CsvImportCard({ categories, onImported }: Props) {
  const { showToast } = useToast();
  const [fileName, setFileName] = useState('');
  const [valid, setValid] = useState<ImportedRow[]>([]);
  const [invalid, setInvalid] = useState<InvalidRow[]>([]);
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const importLock = useRef(false);
  const categoriesKey = categories.join('\u0000');
  const allowed = useMemo(() => categoriesKey ? categoriesKey.split('\u0000') : [], [categoriesKey]);
  const chooseFile = () => {
    if (Platform.OS !== 'web') { showToast('CSV 등록은 현재 웹에서 사용할 수 있어요.'); return; }
    const browser = globalThis as unknown as { document?: any; FileReader?: any };
    if (!browser.document || !browser.FileReader) { showToast('파일 선택을 지원하지 않는 브라우저예요.'); return; }
    const input = browser.document.createElement('input'); input.type = 'file'; input.accept = '.csv,text/csv';
    input.onchange = () => {
      const file = input.files?.[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024) { showToast('CSV는 최대 5MB까지 등록할 수 있어요.'); return; }
      const reader = new browser.FileReader!();
      reader.onload = () => {
        try { const result = parseTransactionsCsv(String(reader.result || ''), allowed); setValid(result.valid); setInvalid(result.invalid); setFileName(file.name); setOpen(true); }
        catch (error) { showToast(error instanceof Error ? error.message : 'CSV를 읽지 못했어요.'); }
      };
      reader.onerror = () => showToast('CSV 파일 읽기에 실패했어요. UTF-8로 저장해 주세요.');
      reader.readAsText(file, 'UTF-8');
    };
    input.click();
  };
  const upload = async () => {
    if (!valid.length || importLock.current) return;
    importLock.current = true; setImporting(true);
    const remaining: ImportedRow[] = []; let success = 0;
    try {
      for (const row of valid) {
        try {
          await apiRequest({
            path: '/transactions', method: 'POST', auth: true,
            body: {tx_date: row.tx_date, ...(row.tx_time ? {tx_time: row.tx_time} : {}), amount: row.amount,
              merchant_name: row.merchant_name, final_category: row.final_category, is_user_corrected: true},
          });
          success += 1;
        } catch { remaining.push(row); }
      }
      setValid(remaining);
      if (success) await onImported();
      if (!remaining.length) { setOpen(false); setInvalid([]); setFileName(''); }
      showToast(`${success}건 등록 완료${remaining.length ? ` · ${remaining.length}건 실패 (재시도 가능)` : ''}`);
    } finally { importLock.current = false; setImporting(false); }
  };
  return <>
    <Pressable style={[ui.card, {backgroundColor: palette.soft}]} onPress={chooseFile} accessibilityRole="button">
      <View style={ui.row}><FileUp color={palette.ink} size={23}/><View style={{flex: 1}}>
        <Text style={ui.heading}>CSV로 소비내역 등록</Text>
        <Text style={ui.muted}>CSV 선택 → 데이터 확인 → 지출 기록 등록 (웹 전용)</Text>
      </View><Upload size={20} color={palette.ink}/></View>
    </Pressable>
    <Modal transparent visible={open} animationType="fade" onRequestClose={() => !importing && setOpen(false)}>
      <View style={{flex: 1, justifyContent: 'center', backgroundColor:'#0009', padding:16}}><View style={[ui.card,{maxWidth:600,width:'100%',alignSelf:'center',maxHeight:'80%'}]}>
        <View style={[ui.row,{justifyContent:'space-between'}]}><Text style={ui.heading}>{fileName}</Text><Pressable disabled={importing} onPress={() => setOpen(false)}><X size={20} color={palette.ink}/></Pressable></View>
        <Text style={ui.subtitle}>등록 가능 {valid.length}건 · 제외 {invalid.length}건. 중복 등록을 자동 차단하지 않습니다.</Text>
        <ScrollView style={{maxHeight:330}}>
          {valid.slice(0,30).map(row => <Text style={[ui.text,{marginVertical:5}]} key={row.line}>{row.line}행 · {row.tx_date} · {row.merchant_name} · {row.amount.toLocaleString()}원 ({row.final_category})</Text>)}
          {valid.length > 30 && <Text style={ui.muted}>외 {valid.length - 30}건</Text>}
          {invalid.map(row => <Text style={[ui.dangerText,{marginVertical:5}]} key={row.line}>{row.line}행 제외: {row.reason}</Text>)}
        </ScrollView>
        <View style={[ui.row,{justifyContent:'flex-end',marginTop:12}]}>
          <Pressable style={ui.secondary} disabled={importing} onPress={() => setOpen(false)}><Text style={ui.buttonText}>취소</Text></Pressable>
          <Pressable style={ui.button} disabled={!valid.length || importing} onPress={() => void upload()}><Text style={ui.buttonText}>{importing?'등록 중':`${valid.length}건 등록`}</Text></Pressable>
        </View>
      </View></View>
    </Modal>
  </>;
}
