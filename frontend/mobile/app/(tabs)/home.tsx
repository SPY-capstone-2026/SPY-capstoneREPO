import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CreditCard,
  Gauge,
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

  const pressureTone = getBudgetTone(metadata.budget_pressure);
  const pressureColor = getBudgetColor(metadata.budget_pressure);
  const pressureLabel = getBudgetLabel(metadata.budget_pressure);
  const pressureBg = getBudgetBg(metadata.budget_pressure);

  const budgetGap = getBudgetGap(mission);

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
              : `${mission.category_name} 소비를 조금만 조심해 볼까요?`
          }
          description={
            isTodayMissionCompleted
              ? '좋은 흐름입니다. 오늘의 지출만 가볍게 확인하면 됩니다.'
              : '오늘 가장 먼저 관리하면 좋은 소비 항목을 Moni가 골라봤어요.'
          }
          Icon={isTodayMissionCompleted ? BadgeCheck : Sparkles}
        />

        <GlassCard delay={80} tone="butter" style={styles.primaryCard}>
          <View style={styles.primaryTopRow}>
            <View
              style={[
                styles.primaryIconBubble,
                isTodayMissionCompleted && styles.completedIconBubble,
              ]}
            >
              {isTodayMissionCompleted ? (
                <BadgeCheck size={30} color={colors.text} strokeWidth={2.8} />
              ) : (
                <MissionIcon size={29} color={colors.text} strokeWidth={2.8} />
              )}
            </View>

            <View style={styles.primaryTextBox}>
              <Text style={styles.cardLabel}>
                {isTodayMissionCompleted ? '완료한 미션' : '오늘의 미션'}
              </Text>

              <Text style={styles.primaryTitle}>
                {isTodayMissionCompleted
                  ? '오늘의 미션을 완료했습니다.'
                  : mission.challenge_text}
              </Text>
            </View>
          </View>

          <View style={styles.compactInfoRow}>
            <View style={styles.compactInfoItem}>
              <Text style={styles.compactLabel}>보상</Text>
              <Text style={styles.compactValue}>
                +{mission.xp_reward} XP
              </Text>
            </View>

            <View style={styles.compactInfoItem}>
              <Text style={styles.compactLabel}>성장</Text>
              <Text style={styles.compactValue}>
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

        <View style={styles.quickSection}>
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
              <Text style={styles.quickTitle}>리포트 보기</Text>
              <Text style={styles.quickDescription}>이번 달 흐름 확인</Text>
            </View>

            <ArrowRight size={17} color={colors.butterBrown} strokeWidth={2.8} />
          </Pressable>
        </View>

        <GlassCard delay={170} style={styles.monthCard}>
          <View style={styles.sectionTitleRow}>
            <Gauge size={18} color={colors.butterDeep} strokeWidth={2.8} />
            <Text style={styles.sectionTitle}>이번 달 한눈에 보기</Text>
          </View>

          <View style={styles.monthTopRow}>
            <View>
              <Text style={styles.cardLabel}>월말 예상 지출</Text>
              <Text style={styles.monthValue}>
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

          <Text style={styles.monthMessage}>
            {getFriendlyBudgetMessage(metadata.budget_pressure)}
          </Text>

          <View style={styles.monthMetricList}>
            <View style={styles.monthMetricItem}>
              <CreditCard
                size={16}
                color={colors.butterBrown}
                strokeWidth={2.8}
              />
              <Text style={styles.monthMetricLabel}>오늘 지출</Text>
              <Text style={styles.monthMetricValue}>{formatWon(todaySpend)}</Text>
            </View>

            <View style={styles.monthMetricItem}>
              <CalendarDays
                size={16}
                color={colors.butterBrown}
                strokeWidth={2.8}
              />
              <Text style={styles.monthMetricLabel}>남은 기간 예상</Text>
              <Text style={styles.monthMetricValue}>
                {formatWon(metadata.predicted_remaining_spend)}
              </Text>
            </View>

            <View style={styles.monthMetricItem}>
              <WalletCards
                size={16}
                color={colors.butterBrown}
                strokeWidth={2.8}
              />
              <Text style={styles.monthMetricLabel}>
                {budgetGap >= 0 ? '초과 예상' : '여유 예상'}
              </Text>
              <Text style={styles.monthMetricValue}>
                {formatWon(Math.abs(budgetGap))}
              </Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard delay={450} tone="soft" style={styles.bottomGuideCard}>
          <View style={styles.bottomGuideRow}>
            <View style={styles.bottomGuideIconBubble}>
              <Trophy size={21} color={colors.text} strokeWidth={2.8} />
            </View>

            <View style={styles.bottomGuideTextBox}>
              <Text style={styles.bottomGuideTitle}>오늘은 이것만 보면 돼요</Text>
              <Text style={styles.bottomGuideDescription}>
                미션 완료 여부, 오늘 지출, 이번 달 예상 흐름만 확인하면 충분합니다.
              </Text>
            </View>
          </View>
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
  primaryCard: {
    backgroundColor: 'rgba(255,248,216,0.42)',
  },
  primaryTopRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
  },
  primaryIconBubble: {
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
  primaryTextBox: {
    flex: 1,
  },
  cardLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 6,
  },
  primaryTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 23,
    lineHeight: 31,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.6,
  },
  compactInfoRow: {
    flexDirection: 'row',
    gap: 22,
    paddingTop: 14,
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122,111,91,0.14)',
  },
  compactInfoItem: {
    flex: 1,
  },
  compactLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 5,
  },
  compactValue: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  primaryButton: {
    marginTop: 2,
  },
  quickSection: {
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
  monthCard: {
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
  monthTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  monthValue: {
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
  monthMessage: {
    marginTop: 12,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: colors.subText,
  },
  monthMetricList: {
    marginTop: 15,
    gap: 8,
  },
  monthMetricItem: {
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
  monthMetricLabel: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: colors.subText,
  },
  monthMetricValue: {
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
  primaryCategoryIconBubble: {
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
  bottomGuideCard: {
    backgroundColor: 'rgba(255,251,240,0.34)',
  },
  bottomGuideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bottomGuideIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomGuideTextBox: {
    flex: 1,
  },
  bottomGuideTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
  },
  bottomGuideDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: colors.subText,
  },
});