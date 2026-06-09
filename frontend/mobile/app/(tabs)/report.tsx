import { useCallback, useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  BarChart3,
  CalendarDays,
  Gauge,
  LineChart,
  Sparkles,
  TrendingUp,
  WalletCards,
} from 'lucide-react-native';

import { AnimatedProgressBar } from '@/components/AnimatedProgressBar';
import { AppScreenHeader } from '@/components/AppScreenHeader';
import { GlassCard } from '@/components/GlassCard';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { useToast } from '@/contexts/ToastContext';
import { getMonthlyReportFromApi } from '@/services/reportService';
import type { MonthlyReportResponse } from '@/types/api';
import { formatWon } from '@/utils/aiFormat';
import {
  getBudgetBg,
  getBudgetColor,
  getBudgetLabel,
  getBudgetSignalText,
  getBudgetTone,
  getFriendlyBudgetMessage,
} from '@/utils/budgetStatus';
import { getCategoryMeta } from '@/utils/categoryMeta';

type MonthlyReportData = MonthlyReportResponse['data'];

const defaultReportData: MonthlyReportData = {
  month: '',
  monthly_summary: {
    total_spend: 0,
    budget_limit: 0,
    predicted_monthly_spend: 0,
    budget_pressure: 0,
    transaction_count: 0,
  },
  weekly_trend: [
    { label: '월', amount: 0 },
    { label: '화', amount: 0 },
    { label: '수', amount: 0 },
    { label: '목', amount: 0 },
    { label: '금', amount: 0 },
    { label: '토', amount: 0 },
    { label: '일', amount: 0 },
  ],
  evaluated_categories: [],
};

function getWeeklyAverage(weeklyTrend: MonthlyReportData['weekly_trend']) {
  if (weeklyTrend.length === 0) {
    return 0;
  }

  const sum = weeklyTrend.reduce((total, item) => total + item.amount, 0);
  return Math.round(sum / weeklyTrend.length);
}

function getPeakDay(weeklyTrend: MonthlyReportData['weekly_trend']) {
  if (weeklyTrend.length === 0) {
    return {
      label: '월',
      amount: 0,
    };
  }

  return weeklyTrend.reduce((peak, item) =>
    item.amount > peak.amount ? item : peak
  );
}

function getFriendlyCategoryMessage(pressure: number) {
  if (pressure >= 1.5) {
    return '가장 먼저 관리하면 좋은 항목이에요.';
  }

  if (pressure >= 1.1) {
    return '예산을 넘을 가능성이 있어 조절이 필요해요.';
  }

  if (pressure >= 0.8) {
    return '조금만 신경 쓰면 안정적으로 유지할 수 있어요.';
  }

  return '안정적으로 관리되고 있어요.';
}

export default function ReportScreen() {
  const { showToast } = useToast();

  const [report, setReport] = useState<MonthlyReportData>(defaultReportData);
  const [isLoading, setIsLoading] = useState(false);

  const monthlySummary = report.monthly_summary;
  const weeklyTrend = report.weekly_trend;
  const evaluatedCategories = report.evaluated_categories;

  const hasMonthlyTransactions = monthlySummary.transaction_count > 0;

  const pressureTone = getBudgetTone(monthlySummary.budget_pressure);
  const pressureColor = getBudgetColor(monthlySummary.budget_pressure);
  const pressureBg = getBudgetBg(monthlySummary.budget_pressure);
  const pressureLabel = getBudgetLabel(monthlySummary.budget_pressure);

  const weeklyAverage = getWeeklyAverage(weeklyTrend);
  const peakDay = getPeakDay(weeklyTrend);

  const maxWeeklyAmount = useMemo(() => {
    const maxAmount = Math.max(...weeklyTrend.map((item) => item.amount), 0);
    return maxAmount > 0 ? maxAmount : 1;
  }, [weeklyTrend]);

  const budgetGap =
    monthlySummary.predicted_monthly_spend - monthlySummary.budget_limit;

  const loadMonthlyReport = useCallback(async () => {
    try {
      setIsLoading(true);

      const apiReport = await getMonthlyReportFromApi();

      setReport({
        ...apiReport,
        weekly_trend:
          apiReport.weekly_trend.length > 0
            ? apiReport.weekly_trend
            : defaultReportData.weekly_trend,
      });
    } catch {
      showToast('리포트를 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      loadMonthlyReport();
    }, [loadMonthlyReport])
  );

  return (
    <LinearGradient
      colors={['#FFF8D8', '#FFFBF0', '#FFFFFF']}
      style={styles.gradient}
    >
      <View style={styles.backgroundOrbLarge} />
      <View style={styles.backgroundOrbSmall} />
      <View style={styles.backgroundOrbTiny} />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <AppScreenHeader
          label="REPORT"
          title="이번 달 소비 흐름을 한눈에 볼 수 있어요."
          description={
            isLoading
              ? '이번 달 지출과 예산 흐름을 불러오고 있어요.'
              : '가장 중요한 예산 상태와 소비 리듬만 간단히 정리했습니다.'
          }
          Icon={BarChart3}
        />

        <GlassCard delay={80} tone="butter" style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View>
              <Text style={styles.cardLabel}>월말 예상 지출</Text>
              <Text style={styles.summaryValue}>
                {formatWon(monthlySummary.predicted_monthly_spend)}
              </Text>
            </View>

            <View style={[styles.statusBadge, { backgroundColor: pressureBg }]}>
              <Text style={[styles.statusBadgeText, { color: pressureColor }]}>
                {pressureLabel}
              </Text>
            </View>
          </View>

          <View style={styles.progressInfoRow}>
            <Text style={styles.progressLabel}>예산 사용 예상</Text>
            <Text style={[styles.progressValue, { color: pressureColor }]}>
              {getBudgetSignalText(monthlySummary.budget_pressure)}
            </Text>
          </View>

          <AnimatedProgressBar
            progress={monthlySummary.budget_pressure}
            tone={pressureTone}
          />

          <Text style={styles.summaryMessage}>
            {hasMonthlyTransactions
              ? getFriendlyBudgetMessage(monthlySummary.budget_pressure)
              : '아직 이번 달 지출 기록이 없어요. 소비 탭에서 지출을 추가하면 월말 예상과 예산 상태가 표시됩니다.'}
          </Text>

          <View style={styles.metricList}>
            <View style={styles.metricItem}>
              <WalletCards
                size={16}
                color={colors.butterBrown}
                strokeWidth={2.8}
              />
              <Text style={styles.metricLabel}>현재 기록</Text>
              <Text style={styles.metricValue}>
                {formatWon(monthlySummary.total_spend)}
              </Text>
            </View>

            <View style={styles.metricItem}>
              <TrendingUp
                size={16}
                color={colors.butterBrown}
                strokeWidth={2.8}
              />
              <Text style={styles.metricLabel}>월 예산</Text>
              <Text style={styles.metricValue}>
                {formatWon(monthlySummary.budget_limit)}
              </Text>
            </View>

            <View style={styles.metricItem}>
              <CalendarDays
                size={16}
                color={colors.butterBrown}
                strokeWidth={2.8}
              />
              <Text style={styles.metricLabel}>
                {budgetGap >= 0 ? '초과 예상' : '여유 예상'}
              </Text>
              <Text style={styles.metricValue}>
                {formatWon(Math.abs(budgetGap))}
              </Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard delay={170} style={styles.chartCard}>
          <View style={styles.sectionTitleRow}>
            <LineChart size={18} color={colors.butterDeep} strokeWidth={2.8} />
            <Text style={styles.sectionTitle}>요일별 소비 리듬</Text>
          </View>

          <Text style={styles.sectionDescription}>
            소비가 커지는 요일을 확인하면 다음 주 예산을 더 쉽게 조절할 수 있습니다.
          </Text>

          <View style={styles.chartSummaryRow}>
            <View style={styles.chartSummaryItem}>
              <Text style={styles.chartSummaryLabel}>하루 평균</Text>
              <Text style={styles.chartSummaryValue}>
                {formatWon(weeklyAverage)}
              </Text>
            </View>

            <View style={styles.chartSummaryItem}>
              <Text style={styles.chartSummaryLabel}>가장 큰 요일</Text>
              <Text style={styles.chartSummaryValue}>{peakDay.label}요일</Text>
            </View>
          </View>

          {hasMonthlyTransactions ? (
            <View style={styles.barChart}>
              {weeklyTrend.map((item) => {
                const isPeak = item.label === peakDay.label && item.amount > 0;
                const barHeight =
                  item.amount > 0
                    ? Math.max(
                        10,
                        Math.round((item.amount / maxWeeklyAmount) * 100)
                      )
                    : 8;

                return (
                  <View key={item.label} style={styles.barItem}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          isPeak && styles.peakBarFill,
                          {
                            height: `${barHeight}%`,
                          },
                        ]}
                      />
                    </View>

                    <Text
                      style={[
                        styles.barAmount,
                        isPeak && styles.peakBarAmount,
                      ]}
                    >
                      {item.amount > 0
                        ? `${Math.round(item.amount / 1000)}천`
                        : '0'}
                    </Text>

                    <Text
                      style={[
                        styles.barLabel,
                        isPeak && styles.peakBarLabel,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.inlineEmptyBox}>
              <LineChart
                size={24}
                color={colors.butterBrown}
                strokeWidth={2.8}
              />
              <Text style={styles.inlineEmptyTitle}>
                아직 요일별 흐름이 없어요.
              </Text>
              <Text style={styles.inlineEmptyDescription}>
                소비 탭에서 지출을 추가하면 요일별 소비 리듬이 표시됩니다.
              </Text>
            </View>
          )}

          <View style={styles.chartNote}>
            <Sparkles size={15} color={colors.butterDeep} strokeWidth={2.8} />
            <Text style={styles.chartNoteText}>
              {peakDay.amount > 0
                ? `${peakDay.label}요일에 소비가 가장 큽니다. 이 요일에는 미리 사용할 금액을 정해두면 좋아요.`
                : '아직 이번 달 지출 기록이 적습니다. 지출을 추가하면 요일별 흐름이 표시됩니다.'}
            </Text>
          </View>
        </GlassCard>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>항목별 예산 상태</Text>
          <Text style={styles.sectionSubtitle}>
            이번 달에 먼저 확인하면 좋은 항목 순서입니다.
          </Text>
        </View>

        {evaluatedCategories.length === 0 ? (
          <GlassCard delay={260} tone="soft">
            <View style={styles.emptyBox}>
              <Gauge size={24} color={colors.butterBrown} strokeWidth={2.8} />
              <Text style={styles.emptyTitle}>
                표시할 예산 상태가 아직 없어요.
              </Text>
              <Text style={styles.emptyDescription}>
                지출을 추가하면 카테고리별 예산 상태가 표시됩니다.
              </Text>
            </View>
          </GlassCard>
        ) : (
          evaluatedCategories.map((category, index) => {
            const categoryMeta = getCategoryMeta(category.category_name);
            const CategoryIcon = categoryMeta.Icon;

            const itemPressureTone = getBudgetTone(category.budget_pressure);
            const itemPressureColor = getBudgetColor(category.budget_pressure);
            const itemPressureBg = getBudgetBg(category.budget_pressure);

            const isPrimary = index === 0;

            return (
              <GlassCard
                key={category.category_name}
                delay={260 + index * 60}
                tone={isPrimary ? 'butter' : 'soft'}
              >
                <View style={styles.categoryRow}>
                  <View style={styles.categoryLeft}>
                    <View
                      style={[
                        styles.categoryIconBubble,
                        isPrimary && styles.primaryCategoryIconBubble,
                      ]}
                    >
                      <CategoryIcon
                        size={20}
                        color={colors.text}
                        strokeWidth={2.8}
                      />
                    </View>

                    <View style={styles.categoryTextBox}>
                      <View style={styles.categoryTitleRow}>
                        <Text style={styles.categoryName}>
                          {category.category_name}
                        </Text>

                        {isPrimary ? (
                          <Text style={styles.primaryLabel}>우선 관리</Text>
                        ) : null}
                      </View>

                      <Text style={styles.categoryMeta}>
                        {getFriendlyCategoryMessage(category.budget_pressure)}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.categoryBadge,
                      {
                        backgroundColor: itemPressureBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryBadgeText,
                        {
                          color: itemPressureColor,
                        },
                      ]}
                    >
                      {getBudgetLabel(category.budget_pressure)}
                    </Text>
                  </View>
                </View>

                <View style={styles.categoryAmountRow}>
                  <Text style={styles.categoryAmountText}>
                    현재 {formatWon(category.actual_spend)}
                  </Text>
                  <Text style={styles.categoryAmountText}>
                    예산 {formatWon(category.budget_limit)}
                  </Text>
                  <Text style={styles.categoryAmountText}>
                    예상 {formatWon(category.predicted_monthly_spend)}
                  </Text>
                </View>

                <AnimatedProgressBar
                  progress={category.budget_pressure}
                  tone={itemPressureTone}
                />
              </GlassCard>
            );
          })
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  backgroundOrbLarge: {
    display: 'none',
  },
  backgroundOrbSmall: {
    display: 'none',
  },
  backgroundOrbTiny: {
    display: 'none',
  },
  container: {
    padding: 20,
    paddingBottom: 128,
  },
  summaryCard: {
    backgroundColor: 'rgba(255,248,216,0.42)',
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  cardLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 6,
  },
  summaryValue: {
    fontFamily: typography.fontFamily,
    fontSize: 33,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
  },
  progressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  progressLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '800',
    color: colors.subText,
  },
  progressValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '900',
  },
  summaryMessage: {
    marginTop: 12,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: colors.subText,
  },
  metricList: {
    marginTop: 15,
    gap: 8,
  },
  metricItem: {
    minHeight: 54,
    borderRadius: 18,
    paddingHorizontal: 13,
    backgroundColor: 'rgba(255,247,214,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricLabel: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: colors.subText,
  },
  metricValue: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  chartCard: {
    backgroundColor: 'rgba(255,255,255,0.36)',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 21,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 5,
  },
  sectionDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: colors.subText,
    marginBottom: 16,
  },
  chartSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122,111,91,0.14)',
  },
  chartSummaryItem: {
    flex: 1,
  },
  chartSummaryLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 5,
  },
  chartSummaryValue: {
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  barChart: {
    height: 178,
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
  },
  barItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  barTrack: {
    width: '100%',
    height: 104,
    borderRadius: 999,
    backgroundColor: 'rgba(232, 226, 208, 0.54)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: colors.butterSoft,
  },
  peakBarFill: {
    backgroundColor: colors.butterStrong,
  },
  barAmount: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '800',
    color: colors.mutedText,
  },
  peakBarAmount: {
    color: colors.butterBrown,
  },
  barLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.subText,
  },
  peakBarLabel: {
    color: colors.text,
  },
  inlineEmptyBox: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  inlineEmptyTitle: {
    marginTop: 10,
    marginBottom: 5,
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  inlineEmptyDescription: {
    textAlign: 'center',
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: colors.subText,
  },
  chartNote: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122,111,91,0.14)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  chartNoteText: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: colors.subText,
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: colors.subText,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  emptyTitle: {
    marginTop: 10,
    marginBottom: 5,
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  emptyDescription: {
    textAlign: 'center',
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: colors.subText,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  categoryLeft: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flex: 1,
  },
  categoryIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 17,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCategoryIconBubble: {
    backgroundColor: colors.butterStrong,
  },
  categoryTextBox: {
    flex: 1,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },
  categoryName: {
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  primaryLabel: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.butterPale,
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '900',
    color: colors.butterBrown,
  },
  categoryMeta: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.subText,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  categoryBadgeText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
  },
  categoryAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  categoryAmountText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    color: colors.subText,
  },
});