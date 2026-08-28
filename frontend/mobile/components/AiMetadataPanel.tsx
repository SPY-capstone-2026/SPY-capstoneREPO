import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Database,
  Sparkles,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import type { ChallengeAiMetadata } from '@/types/api';

type FlatMetadataRow = {
  path: string;
  value: unknown;
};

type AiMetadataPanelProps = {
  metadata: ChallengeAiMetadata | null | undefined;
};

const LABELS: Record<string, string> = {
  schema_version: '스키마 버전',
  challenge_origin: '챌린지 생성 기준',
  budget_limit: '월 예산',
  predicted_monthly_spend: '월말 예상 지출',
  predicted_today: '오늘 예상 지출',
  month_to_date_actual: '이번 달 현재 지출',
  predicted_remaining_spend: '남은 기간 예상 지출',
  forecast_lower: '예측 하한',
  forecast_upper: '예측 상한',
  budget_pressure: '예산 압박도',
  daily_limit: '오늘 권장 한도',
  pressure_reduction: '압박도 기반 감축값',
  budget_reduction: '예산 기반 감축값',
  final_reduction: '최종 감축값',
  limit_source: '한도 산정 기준',
  context_label: '상황 설명',
  text_source: '문구 생성 방식',
  model_used: '예측 모델',
  data_points_used: '사용 데이터 일수',
  tx_count_used: '사용 거래 수',
  nonzero_ratio: '소비 발생 비율',
  no_spend_streak: '연속 무지출',
  month_start_date: '분석 월 시작',
  month_end_date: '분석 월 종료',
  days_remaining_in_month: '이번 달 남은 일수',
  month_progress_ratio: '월 진행률',
  category_correction_applied: '카테고리 보정',
  reason: '추천 이유',
  reasons: '추천 이유',
  mae: 'MAE',
  rmse: 'RMSE',
  mape: 'MAPE',
  forecast_metrics: '예측 평가 지표',
  evaluated_categories: '평가 후보',
  category_name: '카테고리',
  rank: '분석 순위',
};

const MONEY_KEYWORDS = [
  'budget',
  'spend',
  'limit',
  'actual',
  'forecast_lower',
  'forecast_upper',
  'reduction',
  'predicted',
];

const RATIO_KEYS = new Set([
  'budget_pressure',
  'nonzero_ratio',
  'month_progress_ratio',
]);

function flattenMetadata(
  value: unknown,
  path = '',
  rows: FlatMetadataRow[] = []
): FlatMetadataRow[] {
  if (value === undefined) return rows;

  if (value === null || typeof value !== 'object') {
    rows.push({ path, value });
    return rows;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      rows.push({ path, value: [] });
      return rows;
    }

    value.forEach((item, index) => {
      flattenMetadata(item, `${path}[${index}]`, rows);
    });
    return rows;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    rows.push({ path, value: {} });
    return rows;
  }

  entries.forEach(([key, item]) => {
    flattenMetadata(item, path ? `${path}.${key}` : key, rows);
  });

  return rows;
}

function leafKey(path: string) {
  const withoutIndex = path.replace(/\[\d+\]/g, '');
  const parts = withoutIndex.split('.');
  return parts[parts.length - 1] || path;
}

function labelForPath(path: string) {
  const key = leafKey(path);
  const baseLabel = LABELS[key] ?? key.replaceAll('_', ' ');

  const categoryMatch = path.match(/^evaluated_categories\[(\d+)\]\.(.+)$/);
  if (categoryMatch) {
    const index = Number(categoryMatch[1]) + 1;
    return `평가 후보 ${index} · ${baseLabel}`;
  }

  const reasonMatch = path.match(/^reasons\[(\d+)\]$/);
  if (reasonMatch) {
    return `추천 이유 ${Number(reasonMatch[1]) + 1}`;
  }

  return baseLabel;
}

function formatWon(value: number) {
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

function formatValue(path: string, value: unknown) {
  const key = leafKey(path);

  if (value === null) return '없음';

  if (typeof value === 'boolean') {
    if (key === 'category_correction_applied') {
      return value ? '적용' : '미적용';
    }
    return value ? '예' : '아니오';
  }

  if (typeof value === 'number') {
    if (RATIO_KEYS.has(key)) {
      return `${value.toFixed(4)} · ${(value * 100).toFixed(1)}%`;
    }

    if (
      MONEY_KEYWORDS.some((keyword) => key.includes(keyword)) &&
      !key.includes('ratio')
    ) {
      return formatWon(value);
    }

    if (key === 'mape') {
      return `${value.toFixed(2)}%`;
    }

    if (key === 'mae' || key === 'rmse') {
      return value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
    }

    return value.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
  }

  if (typeof value === 'string') {
    if (key === 'challenge_origin') {
      if (value === 'pressure') return '예산 압박도';
      if (value === 'streak') return '연속 무지출 보너스';
    }

    if (key === 'model_used') {
      if (value === 'prophet') return 'Prophet';
      if (value === 'simple_average') return '단순 평균';
      if (value === 'no_data') return '데이터 없음';
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.length === 0 ? '빈 목록' : JSON.stringify(value);
  }

  return JSON.stringify(value);
}

function numberValue(metadata: ChallengeAiMetadata, key: string) {
  const value = metadata[key];
  return typeof value === 'number' ? value : null;
}

export function AiMetadataPanel({ metadata }: AiMetadataPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(
    () => flattenMetadata(metadata ?? {}),
    [metadata]
  );

  if (!metadata || rows.length === 0) {
    return null;
  }

  const reason = typeof metadata.reason === 'string' ? metadata.reason : null;
  const predicted = numberValue(metadata, 'predicted_monthly_spend');
  const pressure = numberValue(metadata, 'budget_pressure');
  const budget = numberValue(metadata, 'budget_limit');
  const actual = numberValue(metadata, 'month_to_date_actual');

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <View style={styles.headingIcon}>
          <Sparkles size={15} color={colors.butterDeep} strokeWidth={2.5} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>AI 소비 분석</Text>
          <Text style={styles.subtitle}>
            백엔드가 전달한 분석 값을 빠짐없이 확인할 수 있어요.
          </Text>
        </View>
      </View>

      {reason ? (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>추천 이유</Text>
          <Text style={styles.reasonText}>{reason}</Text>
        </View>
      ) : null}

      <View style={styles.quickGrid}>
        {budget !== null ? (
          <View style={styles.quickItem}>
            <Text style={styles.quickLabel}>월 예산</Text>
            <Text style={styles.quickValue}>{formatWon(budget)}</Text>
          </View>
        ) : null}
        {actual !== null ? (
          <View style={styles.quickItem}>
            <Text style={styles.quickLabel}>현재 지출</Text>
            <Text style={styles.quickValue}>{formatWon(actual)}</Text>
          </View>
        ) : null}
        {predicted !== null ? (
          <View style={styles.quickItem}>
            <Text style={styles.quickLabel}>월말 예상</Text>
            <Text style={styles.quickValue}>{formatWon(predicted)}</Text>
          </View>
        ) : null}
        {pressure !== null ? (
          <View style={styles.quickItem}>
            <Text style={styles.quickLabel}>예산 압박도</Text>
            <Text style={styles.quickValue}>{(pressure * 100).toFixed(1)}%</Text>
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
      >
        <View style={styles.toggleLeft}>
          <Database size={15} color={colors.subText} strokeWidth={2.4} />
          <Text style={styles.toggleText}>
            전체 분석 데이터 {rows.length}개
          </Text>
        </View>
        {expanded ? (
          <ChevronUp size={17} color={colors.subText} strokeWidth={2.4} />
        ) : (
          <ChevronDown size={17} color={colors.subText} strokeWidth={2.4} />
        )}
      </Pressable>

      {expanded ? (
        <View style={styles.rows}>
          {rows.map((row, index) => (
            <View
              key={`${row.path}-${index}`}
              style={[
                styles.row,
                index === rows.length - 1 && styles.lastRow,
              ]}
            >
              <Text style={styles.rowLabel}>{labelForPath(row.path)}</Text>
              <Text selectable style={styles.rowValue}>
                {formatValue(row.path, row.value)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    padding: 14,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  headingIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingCopy: {
    flex: 1,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    fontWeight: '900',
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.mutedText,
  },
  reasonBox: {
    marginTop: 12,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 11,
  },
  reasonLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.butterDeep,
    marginBottom: 4,
  },
  reasonText: {
    fontFamily: typography.fontFamily,
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: '700',
    color: colors.subText,
  },
  quickGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  quickItem: {
    minWidth: '47%',
    flexGrow: 1,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  quickLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 9,
    fontWeight: '800',
    color: colors.mutedText,
    marginBottom: 3,
  },
  quickValue: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
  },
  toggle: {
    marginTop: 10,
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  toggleText: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '900',
    color: colors.subText,
  },
  rows: {
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.mutedText,
    marginBottom: 3,
  },
  rowValue: {
    fontFamily: typography.fontFamily,
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: '700',
    color: colors.text,
  },
  pressed: {
    opacity: 0.72,
  },
});
