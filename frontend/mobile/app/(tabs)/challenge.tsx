import { useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BadgeCheck,
  CalendarDays,
  Check,
  ClipboardCheck,
  Gauge,
  Gift,
  Sparkles,
  Target,
  Trophy,
  WalletCards,
  X,
} from 'lucide-react-native';

import { AnimatedButton } from '@/components/AnimatedButton';
import { AnimatedProgressBar } from '@/components/AnimatedProgressBar';
import { AppScreenHeader } from '@/components/AppScreenHeader';
import { GlassCard } from '@/components/GlassCard';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { mockTodayChallenge } from '@/constants/mockAiResult';
import { useMission } from '@/contexts/MissionContext';
import { useToast } from '@/contexts/ToastContext';
import { formatWon, getChallengeTone, sortEvaluatedCategories } from '@/utils/aiFormat';
import {
  getBudgetBg,
  getBudgetColor,
  getBudgetLabel,
  getBudgetSignalText,
  getBudgetTone,
  getFriendlyBudgetMessage,
} from '@/utils/budgetStatus';
import { getCategoryMeta } from '@/utils/categoryMeta';

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

export default function ChallengeScreen() {
  const mission = mockTodayChallenge;
  const metadata = mission.ai_metadata;
  const missionMeta = getCategoryMeta(mission.category_name);
  const MissionIcon = missionMeta.Icon;

  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);

  const {
    isTodayMissionCompleted,
    currentStreak,
    weeklyCompletedCount,
    completeTodayMission,
  } = useMission();

  const { showToast } = useToast();

  const missionTone = getChallengeTone(mission.challenge_type);

  const pressureTone = getBudgetTone(metadata.budget_pressure);
  const pressureColor = getBudgetColor(metadata.budget_pressure);
  const pressureLabel = getBudgetLabel(metadata.budget_pressure);

  const evaluatedCategories = sortEvaluatedCategories(
    metadata.evaluated_categories
  );

  const selectedCategory = useMemo(
    () =>
      evaluatedCategories.find(
        (category) => category.category_name === mission.category_name
      ),
    [mission.category_name, evaluatedCategories]
  );

  const budgetGap = metadata.predicted_monthly_spend - metadata.budget_limit;

  const handleCompleteMission = () => {
    if (isTodayMissionCompleted) {
      showToast('이미 오늘의 미션을 완료했어요.');
      return;
    }

    completeTodayMission();
    showToast(`미션 완료! +${mission.xp_reward} XP가 쌓였어요.`);
    setIsSuccessModalVisible(true);
  };

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
          label="MISSION"
          title={
            isTodayMissionCompleted
              ? '오늘의 미션을 완료했어요.'
              : '오늘의 소비 미션을 확인해 보세요.'
          }
          description={
            isTodayMissionCompleted
              ? '좋은 흐름입니다. 연속 성공 기록이 이어지고 있어요.'
              : '오늘 하루 실천하기 쉬운 목표를 준비했습니다. 완료하면 XP와 연속 성공 기록이 쌓입니다.'
          }
          Icon={ClipboardCheck}
        />

        <GlassCard delay={80} tone="butter" style={styles.missionCard}>
          <View style={styles.missionTopRow}>
            <View
              style={[
                styles.missionIconBubble,
                isTodayMissionCompleted && styles.completedMissionIconBubble,
              ]}
            >
              {isTodayMissionCompleted ? (
                <BadgeCheck size={30} color={colors.text} strokeWidth={2.8} />
              ) : (
                <MissionIcon size={29} color={colors.text} strokeWidth={2.8} />
              )}
            </View>

            <View style={styles.missionTitleBox}>
              <Text style={styles.cardLabel}>
                {isTodayMissionCompleted ? '완료한 미션' : '오늘의 미션'}
              </Text>
              <Text style={styles.missionCategory}>
                {mission.category_name} 소비 줄이기
              </Text>
            </View>

            <View
              style={[
                styles.missionBadge,
                {
                  backgroundColor: isTodayMissionCompleted
                    ? colors.successBg
                    : missionTone.backgroundColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.missionBadgeText,
                  {
                    color: isTodayMissionCompleted
                      ? colors.successText
                      : missionTone.color,
                  },
                ]}
              >
                {isTodayMissionCompleted ? '완료' : mission.difficulty}
              </Text>
            </View>
          </View>

          <Text style={styles.missionText}>
            {isTodayMissionCompleted
              ? '오늘의 미션을 완료했습니다. 내일도 작은 목표부터 이어가면 좋아요.'
              : mission.challenge_text}
          </Text>

          <Pressable
            disabled={isTodayMissionCompleted}
            style={[
              styles.checkBoxRow,
              isTodayMissionCompleted && styles.completedCheckBoxRow,
            ]}
            onPress={handleCompleteMission}
          >
            <View
              style={[
                styles.checkBox,
                isTodayMissionCompleted && styles.completedCheckBox,
              ]}
            >
              {isTodayMissionCompleted ? (
                <Check size={20} color={colors.text} strokeWidth={3} />
              ) : null}
            </View>

            <View style={styles.checkTextBox}>
              <Text style={styles.checkTitle}>
                {isTodayMissionCompleted
                  ? '오늘 미션 완료!'
                  : '미션을 완료했다면 체크해 주세요'}
              </Text>
              <Text style={styles.checkDescription}>
                {isTodayMissionCompleted
                  ? `+${mission.xp_reward} XP가 기록되었습니다.`
                  : '체크하면 보상과 연속 성공 기록이 바로 반영됩니다.'}
              </Text>
            </View>
          </Pressable>

          <Text style={styles.autoCheckText}>
            체크하지 않아도 괜찮습니다. 하루가 지나면 오늘의 기록을 바탕으로 자동 정리됩니다.
          </Text>
        </GlassCard>

        <View style={styles.gridRow}>
          <GlassCard delay={160} style={styles.gridCard}>
            <View style={styles.gridIconBubble}>
              <Sparkles size={20} color={colors.text} strokeWidth={2.8} />
            </View>

            <Text style={styles.gridLabel}>연속 성공</Text>
            <Text style={styles.gridValue}>{currentStreak}일</Text>
            <Text style={styles.gridDescription}>
              미션을 이어갈수록 습관이 쌓여요.
            </Text>
          </GlassCard>

          <GlassCard delay={220} style={styles.gridCard}>
            <View style={styles.gridIconBubble}>
              <CalendarDays size={20} color={colors.text} strokeWidth={2.8} />
            </View>

            <Text style={styles.gridLabel}>이번 주 완료</Text>
            <Text style={styles.gridValue}>{weeklyCompletedCount}개</Text>
            <Text style={styles.gridDescription}>
              이번 주 달성한 미션 수예요.
            </Text>
          </GlassCard>
        </View>

        <GlassCard delay={300} style={styles.rewardCard}>
          <View style={styles.rewardTopRow}>
            <View style={styles.rewardIconBubble}>
              <Gift size={24} color={colors.butterBrown} strokeWidth={2.8} />
            </View>

            <View style={styles.rewardTextBox}>
              <Text style={styles.cardLabel}>완료 보상</Text>
              <Text style={styles.rewardTitle}>
                {isTodayMissionCompleted
                  ? `+${mission.xp_reward} XP 완료`
                  : `+${mission.xp_reward} XP`}
              </Text>
              <Text style={styles.rewardDescription}>
                미션을 완료하면 성장 경험치와 연속 성공 기록이 함께 쌓입니다.
              </Text>
            </View>

            <Trophy size={23} color={colors.butterBrown} strokeWidth={2.8} />
          </View>

          <View style={styles.rewardPillRow}>
            <View style={styles.rewardPill}>
              <Sparkles size={14} color={colors.butterDeep} strokeWidth={2.8} />
              <Text style={styles.rewardPillText}>레벨 성장</Text>
            </View>

            <View style={styles.rewardPill}>
              <Target size={14} color={colors.butterDeep} strokeWidth={2.8} />
              <Text style={styles.rewardPillText}>소비 습관 관리</Text>
            </View>

            <View style={styles.rewardPill}>
              <CalendarDays
                size={14}
                color={colors.butterDeep}
                strokeWidth={2.8}
              />
              <Text style={styles.rewardPillText}>연속 성공</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard delay={380} style={styles.reasonCard}>
          <View style={styles.sectionTitleRow}>
            <Target size={18} color={colors.butterDeep} strokeWidth={2.8} />
            <Text style={styles.sectionTitle}>왜 이 미션이 나왔나요?</Text>
          </View>

          <Text style={styles.reasonText}>
            이번 달에는 {mission.category_name} 소비가 예산보다 커질 가능성이 있어요.
            오늘 하루만 쉬어가도 월말 소비 흐름을 낮추는 데 도움이 됩니다.
          </Text>

          <View style={styles.reasonPointBox}>
            <View style={styles.reasonPoint}>
              <Text style={styles.reasonPointLabel}>관리 우선순위</Text>
              <Text style={styles.reasonPointValue}>
                {selectedCategory?.rank ?? '-'}위
              </Text>
            </View>

            <View style={styles.reasonPoint}>
              <Text style={styles.reasonPointLabel}>현재 상태</Text>
              <Text
                style={[
                  styles.reasonPointValue,
                  {
                    color: pressureColor,
                  },
                ]}
              >
                {pressureLabel}
              </Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard delay={460} tone="soft" style={styles.flowCard}>
          <View style={styles.sectionTitleRow}>
            <Gauge size={18} color={colors.butterDeep} strokeWidth={2.8} />
            <Text style={styles.sectionTitle}>이번 달 예상 흐름</Text>
          </View>

          <View style={styles.budgetBox}>
            <View>
              <Text style={styles.budgetLabel}>월 예산</Text>
              <Text style={styles.budgetValue}>
                {formatWon(metadata.budget_limit)}
              </Text>
            </View>

            <View style={styles.budgetRight}>
              <Text style={styles.budgetLabel}>월말 예상</Text>
              <Text style={styles.predictedValue}>
                {formatWon(metadata.predicted_monthly_spend)}
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

          <Text style={styles.budgetHint}>
            {getFriendlyBudgetMessage(metadata.budget_pressure)}
          </Text>

          <View style={styles.flowChipRow}>
            <View style={styles.flowChip}>
              <WalletCards
                size={14}
                color={colors.butterBrown}
                strokeWidth={2.8}
              />
              <Text style={styles.flowChipText}>
                현재 기록 {formatWon(metadata.month_to_date_actual)}
              </Text>
            </View>

            <View style={styles.flowChip}>
              <CalendarDays
                size={14}
                color={colors.butterBrown}
                strokeWidth={2.8}
              />
              <Text style={styles.flowChipText}>
                남은 기간 예상 {formatWon(metadata.predicted_remaining_spend)}
              </Text>
            </View>
          </View>

          <Text style={styles.budgetSubHint}>
            현재 흐름대로라면 월 예산보다{' '}
            <Text style={styles.boldText}>
              {formatWon(Math.abs(budgetGap))}
            </Text>
            {budgetGap >= 0
              ? ' 정도 더 쓸 가능성이 있어요.'
              : ' 정도 여유가 있을 것으로 보여요.'}
          </Text>
        </GlassCard>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>관련 항목</Text>
          <Text style={styles.sectionSubtitle}>
            이번 달에 함께 확인하면 좋은 항목입니다.
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
              delay={540 + index * 70}
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
                    {isSelected
                      ? '오늘 미션'
                      : getBudgetLabel(category.budget_pressure)}
                  </Text>
                </View>
              </View>

              <View style={styles.categoryBudgetRow}>
                <Text style={styles.categoryBudgetText}>
                  예산 {formatWon(category.budget_limit)}
                </Text>
                <Text style={styles.categoryBudgetText}>
                  예상 {formatWon(category.predicted_monthly_spend)}
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

      <Modal
        visible={isSuccessModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSuccessModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.successModal}>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setIsSuccessModalVisible(false)}
            >
              <X size={19} color={colors.text} strokeWidth={2.8} />
            </Pressable>

            <View style={styles.successIconBubble}>
              <View style={styles.successIconLight} />
              <BadgeCheck size={38} color={colors.text} strokeWidth={2.8} />
            </View>

            <Text style={styles.successTitle}>미션 성공!</Text>
            <Text style={styles.successText}>
              +{mission.xp_reward} XP가 쌓였고, 연속 성공 기록이 이어졌어요.
            </Text>

            <View style={styles.successStatsRow}>
              <View style={styles.successStatItem}>
                <Text style={styles.successStatValue}>{currentStreak}일</Text>
                <Text style={styles.successStatLabel}>연속 성공</Text>
              </View>

              <View style={styles.successStatItem}>
                <Text style={styles.successStatValue}>
                  {weeklyCompletedCount}개
                </Text>
                <Text style={styles.successStatLabel}>이번 주 완료</Text>
              </View>
            </View>

            <AnimatedButton
              title="확인"
              onPress={() => setIsSuccessModalVisible(false)}
              style={styles.successButton}
            />
          </View>
        </View>
      </Modal>
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
    top: 210,
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
  cardLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 6,
  },
  missionCard: {
    backgroundColor: colors.butterCard,
  },
  missionTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 18,
  },
  missionIconBubble: {
    width: 62,
    height: 62,
    borderRadius: 24,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  completedMissionIconBubble: {
    backgroundColor: colors.successBg,
  },
  missionTitleBox: {
    flex: 1,
  },
  missionCategory: {
    fontFamily: typography.fontFamily,
    fontSize: 23,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.4,
  },
  missionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  missionBadgeText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
  },
  missionText: {
    fontFamily: typography.fontFamily,
    fontSize: 26,
    lineHeight: 36,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.7,
    marginBottom: 18,
  },
  checkBoxRow: {
    padding: 15,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginBottom: 14,
  },
  completedCheckBoxRow: {
    backgroundColor: 'rgba(234, 247, 222, 0.74)',
    borderColor: 'rgba(82, 123, 50, 0.20)',
  },
  checkBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.butterStrong,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedCheckBox: {
    backgroundColor: colors.butterStrong,
  },
  checkTextBox: {
    flex: 1,
  },
  checkTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
  },
  checkDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: colors.subText,
  },
  autoCheckText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 20,
    color: colors.subText,
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
    fontSize: 24,
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
  rewardCard: {
    backgroundColor: colors.whiteCard,
  },
  rewardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  rewardIconBubble: {
    width: 56,
    height: 56,
    borderRadius: 22,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardTextBox: {
    flex: 1,
  },
  rewardTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 25,
    fontWeight: '900',
    color: colors.butterDeep,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  rewardDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: colors.subText,
  },
  rewardPillRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  rewardPill: {
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
  rewardPillText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.butterBrown,
  },
  reasonCard: {
    backgroundColor: colors.whiteCard,
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
  reasonText: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    lineHeight: 23,
    color: colors.text,
  },
  reasonPointBox: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  reasonPoint: {
    flex: 1,
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 247, 214, 0.68)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  reasonPointLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 5,
  },
  reasonPointValue: {
    fontFamily: typography.fontFamily,
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
  },
  flowCard: {
    backgroundColor: colors.creamCard,
  },
  budgetBox: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 16,
  },
  budgetLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 5,
  },
  budgetValue: {
    fontFamily: typography.fontFamily,
    fontSize: 21,
    fontWeight: '900',
    color: colors.text,
  },
  budgetRight: {
    alignItems: 'flex-end',
  },
  predictedValue: {
    fontFamily: typography.fontFamily,
    fontSize: 18,
    fontWeight: '900',
    color: colors.butterDeep,
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
  budgetHint: {
    marginTop: 12,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: colors.subText,
  },
  flowChipRow: {
    marginTop: 14,
    gap: 8,
  },
  flowChip: {
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
  flowChipText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.butterBrown,
  },
  budgetSubHint: {
    marginTop: 14,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 20,
    color: colors.subText,
  },
  boldText: {
    fontWeight: '900',
    color: colors.text,
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
    alignItems: 'center',
    marginBottom: 14,
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
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
  },
  categoryMeta: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: colors.subText,
  },
  categoryBadge: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  categoryBadgeText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
  },
  categoryBudgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  categoryBudgetText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    color: colors.subText,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'center',
    padding: 24,
  },
  successModal: {
    borderRadius: 34,
    backgroundColor: '#FFFBF0',
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 14,
    },
    elevation: 8,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconBubble: {
    width: 84,
    height: 84,
    borderRadius: 32,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 18,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 5,
  },
  successIconLight: {
    position: 'absolute',
    top: 13,
    left: 17,
    width: 34,
    height: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  successTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 30,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 8,
  },
  successText: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    color: colors.subText,
    textAlign: 'center',
    marginBottom: 18,
  },
  successStatsRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  successStatItem: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 247, 214, 0.72)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
  },
  successStatValue: {
    fontFamily: typography.fontFamily,
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
  },
  successStatLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    color: colors.subText,
  },
  successButton: {
    alignSelf: 'stretch',
  },
});