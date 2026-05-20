import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  BarChart3,
  CalendarDays,
  Gauge,
  LineChart,
  Sparkles,
  TrendingUp,
  Trophy,
  WalletCards,
} from 'lucide-react-native';

import { AnimatedButton } from '@/components/AnimatedButton';
import { AnimatedProgressBar } from '@/components/AnimatedProgressBar';
import { GlassCard } from '@/components/GlassCard';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { mockTodayChallenge, mockTransactions } from '@/constants/mockAiResult';
import {
  formatWon,
  getBudgetGap,
  getChallengeTone,
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

function getFriendlyCategoryMessage(pressure: number) {
  if (pressure >= 1.5) {
    return '이번 달에는 특히 신경 써야 하는 항목이에요.';
  }

  if (pressure >= 1.1) {
    return '예산을 넘을 가능성이 있어 조절이 필요해요.';
  }

  if (pressure >= 0.8) {
    return '아직 괜찮지만 속도를 살짝 늦추면 좋아요.';
  }

  return '안정적으로 관리되고 있어요.';
}

function getWeeklyAverage() {
  const sum = weeklyTrend.reduce((total, item) => total + item.amount, 0);
  return Math.round(sum / weeklyTrend.length);
}

function getPeakDay() {
  return weeklyTrend.reduce((peak, item) =>
    item.amount > peak.amount ? item : peak
  );
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

  const missionTone = getChallengeTone(mission.challenge_type);
  const missionMeta = getCategoryMeta(mission.category_name);
  const MissionIcon = missionMeta.Icon;

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
        <View style={styles.header}>
          <Text style={styles.headerLabel}>REPORT</Text>
          <Text style={styles.title}>이번 달 소비 흐름을 한눈에 볼 수 있어요.</Text>
          <Text style={styles.subtitle}>
            가장 중요한 내용부터 보기 쉽게 정리했습니다.
          </Text>
        </View>

        <GlassCard delay={80} tone="butter" style={styles.summaryCard}>
          <View style={styles.summaryTitleRow}>
            <View style={styles.summaryIconBubble}>
              <Sparkles
                size={22}
                color={colors.butterBrown}
                strokeWidth={2.8}
              />
            </View>

            <View style={styles.summaryTitleBox}>
              <Text style={styles.cardLabel}>Moni의 한 줄 정리</Text>
              <Text style={styles.summaryTitle}>
                이번 달은 {mission.category_name} 소비를 줄이는 게 가장 효과적이에요.
              </Text>
            </View>
          </View>

          <Text style={styles.summaryText}>
            현재 흐름대로라면 {mission.category_name} 지출이 예산보다 커질 가능성이 있습니다.
            작은 미션부터 하나씩 실천하면 월말 소비를 줄이는 데 도움이 됩니다.
          </Text>

          <View style={styles.summaryChipRow}>
            <View style={styles.summaryChip}>
              <MissionIcon
                size={14}
                color={colors.butterBrown}
                strokeWidth={2.8}
              />
              <Text style={styles.summaryChipText}>
                관리 항목 {mission.category_name}
              </Text>
            </View>

            <View style={styles.summaryChip}>
              <Trophy size={14} color={colors.butterBrown} strokeWidth={2.8} />
              <Text style={styles.summaryChipText}>
                미션 보상 +{mission.xp_reward} XP
              </Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard delay={160} style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.cardLabel}>이번 달 월말 예상 지출</Text>
              <Text style={styles.heroValue}>
                {formatWon(metadata.predicted_monthly_spend)}
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: pressureBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    color: pressureColor,
                  },
                ]}
              >
                {pressureLabel}
              </Text>
            </View>
          </View>

          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>예산 사용 예상</Text>
            <Text
              style={[
                styles.progressValue,
                {
                  color: pressureColor,
                },
              ]}
            >
              {getBudgetSignalText(metadata.budget_pressure)}
            </Text>
          </View>

          <AnimatedProgressBar
            progress={metadata.budget_pressure}
            tone={pressureTone}
          />

          <Text style={styles.heroDescription}>
            {getFriendlyBudgetMessage(metadata.budget_pressure)}
          </Text>

          <View style={styles.heroChipRow}>
            <View style={styles.heroChip}>
              <WalletCards
                size={14}
                color={colors.butterBrown}
                strokeWidth={2.8}
              />
              <Text style={styles.heroChipText}>
                월 예산 {formatWon(metadata.budget_limit)}
              </Text>
            </View>

            <View style={styles.heroChip}>
              <CalendarDays
                size={14}
                color={colors.butterBrown}
                strokeWidth={2.8}
              />
              <Text style={styles.heroChipText}>
                현재 기록 {formatWon(totalRecordedSpend)}
              </Text>
            </View>

            <View style={styles.heroChip}>
              <TrendingUp
                size={14}
                color={colors.butterBrown}
                strokeWidth={2.8}
              />
              <Text style={styles.heroChipText}>
                남은 기간 예상 {formatWon(metadata.predicted_remaining_spend)}
              </Text>
            </View>
          </View>

          <Text style={styles.heroSubDescription}>
            현재 흐름대로라면 월 예산보다{' '}
            <Text style={styles.boldText}>
              {formatWon(Math.abs(budgetGap))}
            </Text>
            {budgetGap >= 0
              ? ' 정도 더 쓸 가능성이 있어요.'
              : ' 정도 여유가 있을 것으로 보여요.'}
          </Text>
        </GlassCard>

        <View style={styles.gridRow}>
          <GlassCard delay={240} style={styles.gridCard}>
            <View style={styles.gridIconBubble}>
              <BarChart3 size={19} color={colors.text} strokeWidth={2.8} />
            </View>

            <Text style={styles.gridLabel}>최근 일주일 평균</Text>
            <Text style={styles.gridValue}>{formatWon(weeklyAverage)}</Text>
            <Text style={styles.gridDescription}>
              하루에 이 정도씩 쓰고 있어요.
            </Text>
          </GlassCard>

          <GlassCard delay={300} style={styles.gridCard}>
            <View style={styles.gridIconBubble}>
              <Gauge size={19} color={colors.text} strokeWidth={2.8} />
            </View>

            <Text style={styles.gridLabel}>가장 많이 쓴 요일</Text>
            <Text style={styles.gridValue}>{peakDay.label}요일</Text>
            <Text style={styles.gridDescription}>
              {formatWon(peakDay.amount)} 사용했어요.
            </Text>
          </GlassCard>
        </View>

        <GlassCard delay={380} style={styles.chartCard}>
          <View style={styles.sectionTitleRow}>
            <LineChart size={18} color={colors.butterDeep} strokeWidth={2.8} />
            <Text style={styles.sectionTitle}>요일별 소비 리듬</Text>
          </View>

          <Text style={styles.sectionDescription}>
            소비가 커지는 요일을 확인하면 다음 주 예산을 더 쉽게 조절할 수 있습니다.
          </Text>

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
              {peakDay.label}요일에 소비가 가장 큽니다. 이 요일에는 미리 예산을 정해두면 좋아요.
            </Text>
          </View>
        </GlassCard>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>항목별 예산 상태</Text>
          <Text style={styles.sectionSubtitle}>
            이번 달에 조절하면 좋은 항목부터 보여드립니다.
          </Text>
        </View>

        {evaluatedCategories.map((category, index) => {
          const categoryMeta = getCategoryMeta(category.category_name);
          const CategoryIcon = categoryMeta.Icon;

          const itemPressureTone = getBudgetTone(category.budget_pressure);
          const itemPressureColor = getBudgetColor(category.budget_pressure);
          const itemPressureBg = getBudgetBg(category.budget_pressure);
          const isSelected = category.category_name === mission.category_name;

          return (
            <GlassCard
              key={category.category_name}
              delay={460 + index * 70}
              tone={isSelected ? 'butter' : 'soft'}
            >
              <View style={styles.categoryRow}>
                <View style={styles.categoryLeft}>
                  <View
                    style={[
                      styles.categoryIconBubble,
                      isSelected && styles.selectedCategoryIconBubble,
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

                      <Text style={styles.categoryRank}>
                        {category.rank ?? '-'}위
                      </Text>
                    </View>

                    <Text style={styles.categoryMeta}>
                      {getFriendlyCategoryMessage(category.budget_pressure)}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.pressureBadge,
                    {
                      backgroundColor: itemPressureBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pressureBadgeText,
                      {
                        color: itemPressureColor,
                      },
                    ]}
                  >
                    {isSelected
                      ? '오늘 관리'
                      : getBudgetLabel(category.budget_pressure)}
                  </Text>
                </View>
              </View>

              <View style={styles.categoryAmountRow}>
                <View>
                  <Text style={styles.amountLabel}>월말 예상</Text>
                  <Text style={styles.amountValue}>
                    {formatWon(category.predicted_monthly_spend)}
                  </Text>
                </View>

                <View style={styles.amountRight}>
                  <Text style={styles.amountLabel}>월 예산</Text>
                  <Text style={styles.amountValue}>
                    {formatWon(category.budget_limit)}
                  </Text>
                </View>
              </View>

              <AnimatedProgressBar
                progress={category.budget_pressure}
                tone={itemPressureTone}
              />

              {isSelected ? (
                <View style={styles.selectedCategoryNote}>
                  <Sparkles
                    size={14}
                    color={colors.butterDeep}
                    strokeWidth={2.8}
                  />
                  <Text style={styles.selectedCategoryText}>
                    오늘의 미션으로 추천된 항목입니다.
                  </Text>
                </View>
              ) : null}
            </GlassCard>
          );
        })}

        <GlassCard delay={760} tone="butter" style={styles.missionCard}>
          <View style={styles.missionTopRow}>
            <View style={styles.missionIconBubble}>
              <MissionIcon
                size={25}
                color={colors.text}
                strokeWidth={2.8}
              />
            </View>

            <View style={styles.missionTitleBox}>
              <Text style={styles.cardLabel}>추천 미션</Text>
              <Text style={styles.missionTitle}>
                {mission.category_name} 소비 줄이기
              </Text>
            </View>

            <View
              style={[
                styles.challengeToneBadge,
                {
                  backgroundColor: missionTone.backgroundColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.challengeToneText,
                  {
                    color: missionTone.color,
                  },
                ]}
              >
                +{mission.xp_reward} XP
              </Text>
            </View>
          </View>

          <Text style={styles.recommendText}>{mission.challenge_text}</Text>

          <Text style={styles.missionDescription}>
            예산을 지키는 데 가장 도움이 될 항목이라 오늘의 미션으로 추천되었습니다.
          </Text>

          <AnimatedButton
            title="미션 확인하기"
            onPress={() => router.push('/(tabs)/challenge')}
            style={styles.missionButton}
          />
        </GlassCard>
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
    backgroundColor: 'rgba(242, 201, 76, 0.30)',
  },
  backgroundOrbSmall: {
    position: 'absolute',
    top: 200,
    left: -64,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  backgroundOrbTiny: {
    position: 'absolute',
    top: 520,
    right: 34,
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 240, 184, 0.46)',
  },
  container: {
    padding: 20,
    paddingBottom: 128,
  },
  header: {
    marginBottom: 22,
  },
  headerLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.butterDeep,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.7,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    color: colors.subText,
  },
  cardLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 7,
  },
  summaryCard: {
    backgroundColor: colors.butterCard,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginBottom: 16,
  },
  summaryIconBubble: {
    width: 54,
    height: 54,
    borderRadius: 22,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  summaryTitleBox: {
    flex: 1,
  },
  summaryTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.4,
  },
  summaryText: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    lineHeight: 23,
    color: colors.text,
  },
  summaryChipRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  summaryChip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 247, 214, 0.72)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  summaryChipText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.butterBrown,
  },
  heroCard: {
    backgroundColor: colors.whiteCard,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    alignItems: 'flex-start',
    marginBottom: 22,
  },
  heroValue: {
    fontFamily: typography.fontFamily,
    fontSize: 34,
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
  progressRow: {
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
  heroDescription: {
    marginTop: 12,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: colors.subText,
  },
  heroChipRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroChip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 247, 214, 0.72)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroChipText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.butterBrown,
  },
  heroSubDescription: {
    marginTop: 14,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: colors.subText,
  },
  boldText: {
    fontWeight: '900',
    color: colors.text,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridCard: {
    flex: 1,
    minHeight: 152,
  },
  gridIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 17,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  gridLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 7,
  },
  gridValue: {
    fontFamily: typography.fontFamily,
    fontSize: 19,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 5,
  },
  gridDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 18,
    color: colors.subText,
  },
  chartCard: {
    backgroundColor: colors.whiteCard,
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
    marginBottom: 18,
  },
  barChart: {
    height: 178,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.50)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 12,
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
    backgroundColor: 'rgba(232, 226, 208, 0.72)',
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 247, 214, 0.72)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
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
    marginTop: 10,
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
    marginBottom: 16,
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
  selectedCategoryIconBubble: {
    backgroundColor: colors.butterStrong,
  },
  categoryTextBox: {
    flex: 1,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  categoryName: {
    fontFamily: typography.fontFamily,
    fontSize: 19,
    fontWeight: '900',
    color: colors.text,
  },
  categoryRank: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.58)',
    overflow: 'hidden',
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '900',
    color: colors.butterBrown,
  },
  categoryMeta: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: colors.subText,
  },
  pressureBadge: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  pressureBadgeText: {
    textAlign: 'center',
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
  },
  categoryAmountRow: {
    padding: 15,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.56)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 14,
  },
  amountLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 5,
  },
  amountValue: {
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  amountRight: {
    alignItems: 'flex-end',
  },
  selectedCategoryNote: {
    marginTop: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 247, 214, 0.72)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedCategoryText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.butterDeep,
  },
  missionCard: {
    backgroundColor: colors.butterCard,
  },
  missionTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    marginBottom: 16,
  },
  missionIconBubble: {
    width: 54,
    height: 54,
    borderRadius: 22,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionTitleBox: {
    flex: 1,
  },
  missionTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
  },
  challengeToneBadge: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  challengeToneText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
  },
  recommendText: {
    fontFamily: typography.fontFamily,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  missionDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: colors.subText,
  },
  missionButton: {
    marginTop: 18,
  },
});