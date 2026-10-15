import { useMemo, useState } from 'react';
import {
  FileUp,
  Upload,
  X,
} from 'lucide-react-native';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { useToast } from '@/contexts/ToastContext';
import { apiRequest } from '@/services/apiClient';
import type { CreateTransactionResponse } from '@/types/api';

type CsvRow = {
  line: number;
  tx_date: string;
  tx_time?: string;
  amount: number;
  merchant_name: string;
  final_category: string;
};

type InvalidRow = {
  line: number;
  reason: string;
};

type Props = {
  categories: string[];
  onImported: () => Promise<void> | void;
};

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase();
}

function findColumn(headers: string[], aliases: string[]) {
  return headers.findIndex((header) =>
    aliases.includes(normalizeHeader(header))
  );
}

function parseCsv(text: string, allowedCategories: Set<string>) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('CSV에 등록할 소비 기록이 없어요.');
  }

  const headers = splitCsvLine(lines[0]);
  const dateIndex = findColumn(headers, ['날짜', 'date', 'tx_date']);
  const timeIndex = findColumn(headers, ['시간', 'time', 'tx_time']);
  const amountIndex = findColumn(headers, ['금액', 'amount']);
  const merchantIndex = findColumn(headers, [
    '결제처',
    '가맹점',
    'merchant',
    'merchant_name',
  ]);
  const categoryIndex = findColumn(headers, [
    '카테고리',
    'category',
    'final_category',
  ]);

  if (
    dateIndex < 0 ||
    amountIndex < 0 ||
    merchantIndex < 0 ||
    categoryIndex < 0
  ) {
    throw new Error(
      'CSV 첫 줄에 날짜, 금액, 결제처, 카테고리 열이 필요해요.'
    );
  }

  const valid: CsvRow[] = [];
  const invalid: InvalidRow[] = [];

  lines.slice(1).forEach((line, offset) => {
    const lineNumber = offset + 2;
    const cells = splitCsvLine(line);

    const txDate = cells[dateIndex]?.trim() ?? '';
    const txTime =
      timeIndex >= 0 ? cells[timeIndex]?.trim() || undefined : undefined;
    const amount = Number(
      (cells[amountIndex] ?? '').replace(/[₩원,\s]/g, '')
    );
    const merchant = cells[merchantIndex]?.trim() ?? '';
    const category = cells[categoryIndex]?.trim() ?? '';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(txDate)) {
      invalid.push({
        line: lineNumber,
        reason: '날짜는 YYYY-MM-DD 형식이어야 해요.',
      });
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      invalid.push({
        line: lineNumber,
        reason: '금액을 확인해 주세요.',
      });
      return;
    }

    if (!merchant) {
      invalid.push({
        line: lineNumber,
        reason: '결제처가 비어 있어요.',
      });
      return;
    }

    if (!allowedCategories.has(category)) {
      invalid.push({
        line: lineNumber,
        reason: `카테고리 "${category}"를 찾을 수 없어요.`,
      });
      return;
    }

    if (txTime && !/^\d{2}:\d{2}(:\d{2})?$/.test(txTime)) {
      invalid.push({
        line: lineNumber,
        reason: '시간은 HH:MM 또는 HH:MM:SS 형식이어야 해요.',
      });
      return;
    }

    valid.push({
      line: lineNumber,
      tx_date: txDate,
      tx_time: txTime,
      amount,
      merchant_name: merchant,
      final_category: category,
    });
  });

  return { valid, invalid };
}

export function CsvImportCard({ categories, onImported }: Props) {
  const { showToast } = useToast();
  const allowedCategories = useMemo(
    () => new Set(categories),
    [categories]
  );

  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<InvalidRow[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [importing, setImporting] = useState(false);

  const chooseFile = () => {
    if (Platform.OS !== 'web') {
      showToast('현재 CSV 가져오기는 웹에서 사용할 수 있어요.');
      return;
    }

    const browser = globalThis as any;
    const document = browser.document;
    const FileReaderCtor = browser.FileReader;

    if (!document || !FileReaderCtor) {
      showToast('이 브라우저에서는 파일을 읽을 수 없어요.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;

      const reader = new FileReaderCtor();
      reader.onload = () => {
        try {
          const text = String(reader.result ?? '');
          const parsed = parseCsv(text, allowedCategories);
          setFileName(file.name);
          setRows(parsed.valid);
          setInvalidRows(parsed.invalid);
          setPreviewVisible(true);
        } catch (error) {
          showToast(
            error instanceof Error
              ? error.message
              : 'CSV 파일을 읽지 못했어요.'
          );
        }
      };
      reader.onerror = () => {
        showToast('CSV 파일을 읽지 못했어요.');
      };
      reader.readAsText(file, 'UTF-8');
    };

    input.click();
  };

  const importRows = async () => {
    if (rows.length === 0) {
      showToast('등록할 수 있는 소비 기록이 없어요.');
      return;
    }

    let success = 0;
    let failed = 0;

    try {
      setImporting(true);

      for (const row of rows) {
        try {
          await apiRequest<CreateTransactionResponse>({
            path: '/transactions',
            method: 'POST',
            auth: true,
            body: {
              tx_date: row.tx_date,
              tx_time: row.tx_time,
              amount: row.amount,
              merchant_name: row.merchant_name,
              final_category: row.final_category,
              is_user_corrected: true,
            },
          });
          success += 1;
        } catch {
          failed += 1;
        }
      }

      setPreviewVisible(false);
      setRows([]);
      setInvalidRows([]);
      setFileName('');
      await onImported();

      if (failed > 0) {
        showToast(`${success}건 등록, ${failed}건 등록 실패했어요.`);
      } else {
        showToast(`${success}건의 소비 기록을 등록했어요.`);
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={chooseFile}
        style={({ pressed }) => [
          styles.card,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.icon}>
          <FileUp size={19} color={colors.text} strokeWidth={2.5} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>CSV 가져오기</Text>
          <Text style={styles.description}>
            날짜, 금액, 결제처, 카테고리가 포함된 CSV를 한 번에 등록해요.
          </Text>
        </View>
        <Upload size={18} color={colors.butterBrown} strokeWidth={2.4} />
      </Pressable>

      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>CSV 가져오기</Text>
                <Text style={styles.fileName}>{fileName}</Text>
              </View>
              <Pressable onPress={() => setPreviewVisible(false)}>
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryValue}>{rows.length}</Text>
                <Text style={styles.summaryLabel}>등록 가능</Text>
              </View>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryValue}>{invalidRows.length}</Text>
                <Text style={styles.summaryLabel}>제외</Text>
              </View>
            </View>

            {invalidRows.length > 0 ? (
              <View style={styles.errorBox}>
                {invalidRows.slice(0, 4).map((item) => (
                  <Text key={item.line} style={styles.errorText}>
                    {item.line}행 · {item.reason}
                  </Text>
                ))}
                {invalidRows.length > 4 ? (
                  <Text style={styles.errorText}>
                    외 {invalidRows.length - 4}건
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.help}>
              지원 열: 날짜, 금액, 결제처, 카테고리 · 시간은 선택이에요.
            </Text>

            <Pressable
              disabled={importing || rows.length === 0}
              onPress={importRows}
              style={[
                styles.importButton,
                (importing || rows.length === 0) && styles.disabled,
              ]}
            >
              <Text style={styles.importButtonText}>
                {importing ? '등록 중' : `${rows.length}건 등록하기`}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 76,
    marginBottom: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.butterPale,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  description: {
    marginTop: 3,
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    lineHeight: 14,
    color: colors.subText,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(33,27,22,0.32)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.backgroundWhite,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  fileName: {
    marginTop: 3,
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    color: colors.subText,
  },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryBox: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.butterPale,
    padding: 12,
  },
  summaryValue: {
    fontFamily: typography.fontFamily,
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },
  summaryLabel: {
    marginTop: 2,
    fontFamily: typography.fontFamily,
    fontSize: 9,
    color: colors.subText,
  },
  errorBox: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    padding: 10,
  },
  errorText: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    lineHeight: 15,
    color: colors.subText,
  },
  help: {
    marginTop: 12,
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    lineHeight: 15,
    color: colors.mutedText,
  },
  importButton: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '900',
    color: colors.backgroundWhite,
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
