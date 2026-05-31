import { LinearGradient } from 'expo-linear-gradient';
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
import { mockTodayChallenge, mockTransactions } from '@/constants/mockAiResult';
import {
  formatWon,
  getBudgetGap,
  sortEvaluatedCategories,
} from '@/utils/aiFormat';
import {
  getBudgetBg,
  getBudgetColor,
  getBudgetLabel,
  getBudgetSignalText,
  getBudgetTone,
  getFriendlyBudgetMessage,
} from '@/utils/budgetStatus';
import { getCategoryMeta } from '@/utils/categoryMeta';

const weeklyTrend = [
  {
    label: '월',
    amount: 3200,
    value: 0.32,
  },
  {
    label: '화',
    amount: 7800,
    value: 0.58,
  },
  {
    label: '수',
    amount: 4500,
    value: 0.42,
  },
  {
    label: '목',
    amount: 12800,
    value: 0.78,
  },
  {
    label: '금',
    amount: 6200,
    value: 0.5,
  },
  {
    label: '토',
    amount: 15400,
    value: 0.92,
  },
  {
    label: '일',
    amount: 5800,
    value: 0.46,
  },
];

function getWeeklyAverage() {
  const sum = weeklyTrend.reduce((total, item) => total + item.amount, 0);
  return Math.round(sum / weeklyTrend.length);
}

function getPeakDay() {
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
  const mission = mockTodayChallenge;
  const metadata = mission.ai_metadata;

  const evaluatedCategories = sortEvaluatedCategories(
    metadata.evaluated_categories
  );

  const pressureTone = getBudgetTone(metadata.budget_pressure);
  const pressureColor = getBudgetColor(metadata.budget_pressure);
  const pressureBg = getBudgetBg(metadata.budget_pressure);
  const pressureLabel = getBudgetLabel(metadata.budget_pressure);

  const budgetGap = getBudgetGap(mission);

  const totalRecordedSpend = mockTransactions.reduce(
    (sum, transaction) => sum + transaction.amount,
    0
  );

  const weeklyAverage = getWeeklyAverage();
  const peakDay = getPeakDay();

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
          description="가장 중요한 예산 상태와 소비 리듬만 간단히 정리했습니다."
          Icon={BarChart3}
        />

        <GlassCard delay={80} tone="butter" style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View>
              <Text style={styles.cardLabel}>월말 예상 지출</Text>
              <Text style={styles.summaryValue}>
                {formatWon(metadata.predicted_monthly_spend)}
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
              {getBudgetSignalText(metadata.budget_pressure)}
            </Text>
          </View>

          <AnimatedProgressBar
            progress={metadata.budget_pressure}
            tone={pressureTone}
          />

          <Text style={styles.summaryMessage}>
            {getFriendlyBudgetMessage(metadata.budget_pressure)}
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
                {formatWon(totalRecordedSpend)}
              </Text>
            </View>

            <View style={styles.metricItem}>
              <TrendingUp
                size={16}
                color={colors.butterBrown}
                strokeWidth={2.8}
              />
              <Text style={styles.metricLabel}>남은 기간 예상</Text>
              <Text style={styles.metricValue}>
                {formatWon(metadata.predicted_remaining_spend)}
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

          <View style={styles.barChart}>
            {weeklyTrend.map((item) => {
              const isPeak = item.label === peakDay.label;

              return (
                <View key={item.label} style={styles.barItem}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        isPeak && styles.peakBarFill,
                        {
                          height: `${Math.round(item.value * 100)}%`,
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
                    {Math.round(item.amount / 1000)}천
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

          <View style={styles.chartNote}>
            <Sparkles size={15} color={colors.butterDeep} strokeWidth={2.8} />
            <Text style={styles.chartNoteText}>
              {peakDay.label}요일에 소비가 가장 큽니다. 이 요일에는 미리 사용할 금액을 정해두면 좋아요.
            </Text>
          </View>
        </GlassCard>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>항목별 예산 상태</Text>
          <Text style={styles.sectionSubtitle}>
            이번 달에 먼저 확인하면 좋은 항목 순서입니다.
          </Text>
        </View>

        {evaluatedCategories.map((category, index) => {
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
                  예상 {formatWon(category.predicted_monthly_spend)}
                </Text>
                <Text style={styles.categoryAmountText}>
                  예산 {formatWon(category.budget_limit)}
                </Text>
              </View>

              <AnimatedProgressBar
                progress={category.budget_pressure}
                tone={itemPressureTone}
              />
            </GlassCard>
          );
        })}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  backgroundOrbLarge: {
    position: 'absolute',
    top: -90,
    right: -80,
    width: 230,
    height: 230,
    borderRadius: 999,
    backgroundColor: 'rgba(242, 201, 76, 0.28)',
  },
  backgroundOrbSmall: {
    position: 'absolute',
    top: 200,
    left: -64,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
  },
  backgroundOrbTiny: {
    position: 'absolute',
    top: 520,
    right: 34,
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 240, 184, 0.38)',
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
    gap: 12,
    marginBottom: 10,
  },
  categoryAmountText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    color: colors.subText,
  },
});