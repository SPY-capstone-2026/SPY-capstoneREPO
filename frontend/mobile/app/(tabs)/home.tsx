import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Gauge,
  PiggyBank,
  Plus,
  Sparkles,
  Trophy,
  WalletCards,
} from 'lucide-react-native';

import { AnimatedButton } from '@/components/AnimatedButton';
import { AnimatedProgressBar } from '@/components/AnimatedProgressBar';
import { AppScreenHeader } from '@/components/AppScreenHeader';
import { GlassCard } from '@/components/GlassCard';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { mockTodayChallenge, mockTransactions } from '@/constants/mockAiResult';
import { useMission } from '@/contexts/MissionContext';
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

export default function HomeScreen() {
  const mission = mockTodayChallenge;
  const metadata = mission.ai_metadata;
  const missionMeta = getCategoryMeta(mission.category_name);
  const MissionIcon = missionMeta.Icon;

  const {
    isTodayMissionCompleted,
    currentXp,
    currentLevel,
  } = useMission();

  const evaluatedCategories = sortEvaluatedCategories(
    metadata.evaluated_categories
  );

  const pressureTone = getBudgetTone(metadata.budget_pressure);
  const pressureColor = getBudgetColor(metadata.budget_pressure);
  const pressureLabel = getBudgetLabel(metadata.budget_pressure);
  const pressureBg = getBudgetBg(metadata.budget_pressure);
  const missionTone = getChallengeTone(mission.challenge_type);
  const budgetGap = getBudgetGap(mission);

  const levelGoal = 200;
  const levelProgress = Math.min(currentXp / levelGoal, 1);

  const todaySpend = mockTransactions
    .filter((transaction) => transaction.tx_date === mission.challenge_date)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

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
          label="TODAY"
          title={
            isTodayMissionCompleted
              ? '오늘 미션을 완료했어요.'
              : '오늘은 카페 소비를 조심하면 좋아요.'
          }
          description={
            isTodayMissionCompleted
              ? 'XP가 반영되었습니다. 오늘 지출도 함께 확인해 보세요.'
              : '이번 달 예산 흐름상 카페 소비가 가장 먼저 관리하면 좋은 항목입니다.'
          }
          Icon={isTodayMissionCompleted ? BadgeCheck : Sparkles}
        />

        <GlassCard delay={80} tone="butter" style={styles.todayCard}>
          <View style={styles.todayTopRow}>
            <View
              style={[
                styles.todayIconBubble,
                isTodayMissionCompleted && styles.completedIconBubble,
              ]}
            >
              {isTodayMissionCompleted ? (
                <BadgeCheck size={30} color={colors.text} strokeWidth={2.8} />
              ) : (
                <MissionIcon size={29} color={colors.text} strokeWidth={2.8} />
              )}
            </View>

            <View style={styles.todayTextBox}>
              <Text style={styles.cardLabel}>
                {isTodayMissionCompleted ? '완료한 미션' : '오늘의 미션'}
              </Text>
              <Text style={styles.todayTitle}>{mission.challenge_text}</Text>
            </View>
          </View>

          <View style={styles.todayInfoRow}>
            <View style={styles.todayInfoItem}>
              <Text style={styles.infoLabel}>보상</Text>
              <Text style={styles.infoValue}>
                {isTodayMissionCompleted
                  ? `+${mission.xp_reward} XP 완료`
                  : `+${mission.xp_reward} XP`}
              </Text>
            </View>

            <View style={styles.todayInfoItem}>
              <Text style={styles.infoLabel}>현재 레벨</Text>
              <Text style={styles.infoValue}>
                Lv. {currentLevel} · {currentXp} XP
              </Text>
            </View>
          </View>

          <AnimatedButton
            title={isTodayMissionCompleted ? '미션 다시 보기' : '미션 하러가기'}
            onPress={() => router.push('/(tabs)/challenge')}
            style={styles.primaryButton}
          />
        </GlassCard>

        <View style={styles.quickRow}>
          <Pressable
            style={styles.quickCard}
            onPress={() => router.push('/(tabs)/transactions')}
          >
            <View style={styles.quickIconBubble}>
              <Plus size={20} color={colors.text} strokeWidth={2.8} />
            </View>
            <View style={styles.quickTextBox}>
              <Text style={styles.quickTitle}>지출 추가</Text>
              <Text style={styles.quickDescription}>방금 쓴 돈 기록</Text>
            </View>
            <ArrowRight size={17} color={colors.butterBrown} strokeWidth={2.8} />
          </Pressable>

          <Pressable
            style={styles.quickCard}
            onPress={() => router.push('/(tabs)/report')}
          >
            <View style={styles.quickIconBubble}>
              <BarChart3 size={20} color={colors.text} strokeWidth={2.8} />
            </View>
            <View style={styles.quickTextBox}>
              <Text style={styles.quickTitle}>리포트</Text>
              <Text style={styles.quickDescription}>소비 흐름 확인</Text>
            </View>
            <ArrowRight size={17} color={colors.butterBrown} strokeWidth={2.8} />
          </Pressable>
        </View>

        <GlassCard delay={180} style={styles.flowCard}>
          <View style={styles.sectionTitleRow}>
            <Gauge size={18} color={colors.butterDeep} strokeWidth={2.8} />
            <Text style={styles.sectionTitle}>이번 달 흐름</Text>
          </View>

          <View style={styles.flowTopRow}>
            <View>
              <Text style={styles.cardLabel}>월말 예상 지출</Text>
              <Text style={styles.heroValue}>
                {formatWon(metadata.predicted_monthly_spend)}
              </Text>
            </View>

            <View style={[styles.statusBadge, { backgroundColor: pressureBg }]}>
              <Text style={[styles.statusBadgeText, { color: pressureColor }]}>
                {pressureLabel}
              </Text>
            </View>
          </View>

          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>예산 사용 예상</Text>
            <Text style={[styles.progressValue, { color: pressureColor }]}>
              {getBudgetSignalText(metadata.budget_pressure)}
            </Text>
          </View>

          <AnimatedProgressBar
            progress={metadata.budget_pressure}
            tone={pressureTone}
          />

          <Text style={styles.flowDescription}>
            {getFriendlyBudgetMessage(metadata.budget_pressure)}
          </Text>

          <View style={styles.metricGrid}>
            <View style={styles.metricItem}>
              <CreditCard size={16} color={colors.butterBrown} strokeWidth={2.8} />
              <Text style={styles.metricLabel}>오늘 지출</Text>
              <Text style={styles.metricValue}>{formatWon(todaySpend)}</Text>
            </View>

            <View style={styles.metricItem}>
              <CalendarDays
                size={16}
                color={colors.butterBrown}
                strokeWidth={2.8}
              />
              <Text style={styles.metricLabel}>남은 예상</Text>
              <Text style={styles.metricValue}>
                {formatWon(metadata.predicted_remaining_spend)}
              </Text>
            </View>

            <View style={styles.metricItem}>
              <WalletCards
                size={16}
                color={colors.butterBrown}
                strokeWidth={2.8}
              />
              <Text style={styles.metricLabel}>
                {budgetGap >= 0 ? '초과 예상' : '여유 예상'}
              </Text>
              <Text style={styles.metricValue}>{formatWon(Math.abs(budgetGap))}</Text>
            </View>
          </View>
        </GlassCard>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>지금 관리하면 좋은 항목</Text>
          <Text style={styles.sectionSubtitle}>
            예산을 넘기 쉬운 항목만 간단히 보여드립니다.
          </Text>
        </View>

        {evaluatedCategories.slice(0, 3).map((category, index) => {
          const categoryMeta = getCategoryMeta(category.category_name);
          const CategoryIcon = categoryMeta.Icon;

          const itemPressureTone = getBudgetTone(category.budget_pressure);
          const itemPressureColor = getBudgetColor(category.budget_pressure);
          const itemPressureBg = getBudgetBg(category.budget_pressure);
          const isSelected = category.category_name === mission.category_name;

          return (
            <GlassCard
              key={category.category_name}
              delay={260 + index * 60}
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
                    <Text style={styles.categoryName}>
                      {category.category_name}
                    </Text>
                    <Text style={styles.categoryMeta}>
                      예상 {formatWon(category.predicted_monthly_spend)} · 예산{' '}
                      {formatWon(category.budget_limit)}
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
                    {isSelected ? '오늘 관리' : getBudgetLabel(category.budget_pressure)}
                  </Text>
                </View>
              </View>

              <AnimatedProgressBar
                progress={category.budget_pressure}
                tone={itemPressureTone}
              />
            </GlassCard>
          );
        })}

        <GlassCard delay={480} tone="soft" style={styles.levelCard}>
          <View style={styles.levelRow}>
            <View style={styles.levelIconBubble}>
              <Trophy size={21} color={colors.text} strokeWidth={2.8} />
            </View>

            <View style={styles.levelTextBox}>
              <Text style={styles.levelTitle}>
                Lv. {currentLevel} · {currentXp} XP
              </Text>
              <Text style={styles.levelDescription}>
                {currentXp >= levelGoal
                  ? '새로운 레벨에 도달했어요.'
                  : `다음 레벨까지 ${levelGoal - currentXp} XP 남았습니다.`}
              </Text>
            </View>
          </View>

          <AnimatedProgressBar progress={levelProgress} tone="warning" />
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
    backgroundColor: 'rgba(242, 201, 76, 0.28)',
  },
  backgroundOrbSmall: {
    position: 'absolute',
    top: 190,
    left: -64,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
  },
  backgroundOrbTiny: {
    position: 'absolute',
    top: 430,
    right: 28,
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 240, 184, 0.38)',
  },
  container: {
    padding: 20,
    paddingBottom: 128,
  },
  cardLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 6,
  },
  todayCard: {
    backgroundColor: 'rgba(255, 248, 216, 0.42)',
  },
  todayTopRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
  },
  todayIconBubble: {
    width: 62,
    height: 62,
    borderRadius: 24,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedIconBubble: {
    backgroundColor: colors.successBg,
  },
  todayTextBox: {
    flex: 1,
  },
  todayTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 23,
    lineHeight: 31,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.6,
  },
  todayInfoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  todayInfoItem: {
    flex: 1,
    borderRadius: 20,
    padding: 13,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  infoLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 5,
  },
  infoValue: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  primaryButton: {
    marginTop: 2,
  },
  quickRow: {
    gap: 10,
    marginBottom: 14,
  },
  quickCard: {
    minHeight: 68,
    borderRadius: 23,
    paddingHorizontal: 15,
    paddingVertical: 13,
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickIconBubble: {
    width: 41,
    height: 41,
    borderRadius: 17,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTextBox: {
    flex: 1,
  },
  quickTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
  },
  quickDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: colors.subText,
  },
  flowCard: {
    backgroundColor: 'rgba(255,255,255,0.36)',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 21,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 5,
  },
  flowTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  heroValue: {
    fontFamily: typography.fontFamily,
    fontSize: 32,
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
  flowDescription: {
    marginTop: 12,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: colors.subText,
  },
  metricGrid: {
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
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  categoryName: {
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
  },
  categoryMeta: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
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
  levelCard: {
    backgroundColor: 'rgba(255,251,240,0.34)',
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  levelIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelTextBox: {
    flex: 1,
  },
  levelTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
  },
  levelDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: colors.subText,
  },
});