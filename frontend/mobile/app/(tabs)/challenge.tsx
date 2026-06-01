import { useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getTodayChallengeFromApi,
  updateChallengeStatusFromApi,
} from '@/services/challengeService';
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
import { formatWon } from '@/utils/aiFormat';
import {
  getBudgetBg,
  getBudgetColor,
  getBudgetLabel,
  getBudgetSignalText,
  getBudgetTone,
} from '@/utils/budgetStatus';
import { getCategoryMeta } from '@/utils/categoryMeta';

export default function ChallengeScreen() {
  const [mission, setMission] = useState(mockTodayChallenge);
  const [isChallengeLoading, setIsChallengeLoading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const hasLoadedChallengeRef = useRef(false);

  const metadata = mission.ai_metadata;
  const isCurrentMissionCompleted = mission.status === 'SUCCESS';

  const missionMeta = getCategoryMeta(mission.category_name);
  const MissionIcon = missionMeta.Icon;

  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);

  const {
    completeTodayMission,
    currentXp,
    currentLevel,
    currentStreak,
    weeklyCompletedCount,
  } = useMission();

  const { showToast } = useToast();

  const pressureTone = getBudgetTone(metadata.budget_pressure);
  const pressureColor = getBudgetColor(metadata.budget_pressure);
  const pressureBg = getBudgetBg(metadata.budget_pressure);
  const pressureLabel = getBudgetLabel(metadata.budget_pressure);

  const loadTodayChallenge = async () => {
    if (isChallengeLoading) {
      return;
    }

    try {
      setIsChallengeLoading(true);

      const apiMission = await getTodayChallengeFromApi();

      setMission(apiMission);
    } catch {
      showToast('오늘의 미션을 불러오지 못했어요.');
    } finally {
      setIsChallengeLoading(false);
    }
  };

useEffect(() => {
  if (hasLoadedChallengeRef.current) {
    return;
  }

  hasLoadedChallengeRef.current = true;
  loadTodayChallenge();
}, []);

  const handleCompleteMission = async () => {
    if (isCompleting) {
      return;
    }

    try {
      setIsCompleting(true);

      const nextStatus = mission.status === 'SUCCESS' ? 'PENDING' : 'SUCCESS';

      const result = await updateChallengeStatusFromApi(
        mission.challenge_id,
        nextStatus
      );

      setMission(result.challenge);

      if (nextStatus === 'SUCCESS') {
        completeTodayMission();
        showToast(`성공! +${result.challenge.xp_reward} XP가 반영됐어요.`);
      } else {
        showToast('미션 완료를 취소했어요.');
      }
    } catch {
      showToast('미션 상태를 저장하지 못했어요.');
    } finally {
      setIsCompleting(false);
    }
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
            isCurrentMissionCompleted
              ? '오늘 미션을 완료했어요.'
              : '오늘의 소비 미션을 확인해 보세요.'
          }
          description={
            isCurrentMissionCompleted
              ? '연속 성공 기록이 이어지고 있어요. 내일도 작은 목표부터 이어가면 됩니다.'
              : '오늘 하루 실천하면 예산 흐름과 소비 습관을 함께 관리할 수 있어요.'
          }
          Icon={isCurrentMissionCompleted ? BadgeCheck : ClipboardCheck}
        />

        <GlassCard delay={80} tone="butter" style={styles.missionCard}>
          <View style={styles.missionTopRow}>
            <View
              style={[
                styles.missionIconBubble,
                isCurrentMissionCompleted && styles.completedMissionIconBubble,
              ]}
            >
              {isCurrentMissionCompleted ? (
                <BadgeCheck size={30} color={colors.text} strokeWidth={2.8} />
              ) : (
                <MissionIcon size={29} color={colors.text} strokeWidth={2.8} />
              )}
            </View>

            <View style={styles.missionTextBox}>
              <Text style={styles.cardLabel}>
                {isCurrentMissionCompleted ? '완료한 미션' : '오늘의 미션'}
              </Text>

              <Text style={styles.missionTitle}>
                {isCurrentMissionCompleted
                  ? '오늘의 미션을 완료했습니다.'
                  : mission.challenge_text}
              </Text>
            </View>
          </View>

          <Pressable
            disabled={isCompleting}
            style={[
              styles.completeRow,
              isCurrentMissionCompleted && styles.completedRow,
            ]}
            onPress={handleCompleteMission}
          >
            <View
              style={[
                styles.checkBox,
                isCurrentMissionCompleted && styles.completedCheckBox,
              ]}
            >
              {isCurrentMissionCompleted ? (
                <Check size={20} color={colors.text} strokeWidth={3} />
              ) : null}
            </View>

            <View style={styles.completeTextBox}>
              <Text style={styles.completeTitle}>
                {isCurrentMissionCompleted
                  ? '완료됨'
                  : isCompleting
                    ? '상태 저장 중...'
                    : '완료했다면 체크해 주세요'}
              </Text>

              <Text style={styles.completeDescription}>
                {isCurrentMissionCompleted
                  ? '다시 누르면 완료를 취소할 수 있어요.'
                  : `체크하면 +${mission.xp_reward} XP와 연속 성공 기록이 쌓입니다.`}
              </Text>
            </View>
          </Pressable>
          <AnimatedButton
  title={isChallengeLoading ? '미션 불러오는 중...' : '오늘 미션 다시 불러오기'}
  variant="ghost"
  onPress={loadTodayChallenge}
  style={styles.reloadButton}
/>
        </GlassCard>

        <GlassCard delay={160} style={styles.statusCard}>
          <View style={styles.sectionTitleRow}>
            <Trophy size={18} color={colors.butterDeep} strokeWidth={2.8} />
            <Text style={styles.sectionTitle}>완료 현황</Text>
          </View>

          <View style={styles.statusGrid}>
            <View style={styles.statusItem}>
              <Sparkles size={17} color={colors.butterBrown} strokeWidth={2.8} />
              <Text style={styles.statusLabel}>연속 성공</Text>
              <Text style={styles.statusValue}>{currentStreak}일</Text>
            </View>

            <View style={styles.statusItem}>
              <CalendarDays
                size={17}
                color={colors.butterBrown}
                strokeWidth={2.8}
              />
              <Text style={styles.statusLabel}>이번 주 완료</Text>
              <Text style={styles.statusValue}>{weeklyCompletedCount}개</Text>
            </View>

            <View style={styles.statusItem}>
              <Trophy size={17} color={colors.butterBrown} strokeWidth={2.8} />
              <Text style={styles.statusLabel}>오늘 보상</Text>
              <Text style={styles.statusValue}>+{mission.xp_reward} XP</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard delay={240} style={styles.reasonCard}>
          <View style={styles.sectionTitleRow}>
            <Gauge size={18} color={colors.butterDeep} strokeWidth={2.8} />
            <Text style={styles.sectionTitle}>왜 이 미션이 나왔나요?</Text>
          </View>

          <Text style={styles.reasonText}>
            이번 달에는 {mission.category_name} 지출이 예산보다 커질 가능성이 높습니다.
            그래서 오늘은 이 항목을 가장 먼저 관리하도록 추천했습니다.
          </Text>

          <View style={styles.reasonSummaryBox}>
            <View style={styles.reasonSummaryTop}>
              <View>
                <Text style={styles.summaryLabel}>예산 사용 예상</Text>
                <Text style={styles.summaryValue}>
                  {getBudgetSignalText(metadata.budget_pressure)}
                </Text>
              </View>

              <View style={[styles.statusBadge, { backgroundColor: pressureBg }]}>
                <Text style={[styles.statusBadgeText, { color: pressureColor }]}>
                  {pressureLabel}
                </Text>
              </View>
            </View>

            <AnimatedProgressBar
              progress={metadata.budget_pressure}
              tone={pressureTone}
            />

            <View style={styles.reasonMetricRow}>
              <View style={styles.reasonMetricItem}>
                <WalletCards
                  size={15}
                  color={colors.butterBrown}
                  strokeWidth={2.8}
                />
                <Text style={styles.reasonMetricLabel}>월 예산</Text>
                <Text style={styles.reasonMetricValue}>
                  {formatWon(metadata.budget_limit)}
                </Text>
              </View>

              <View style={styles.reasonMetricItem}>
                <Target size={15} color={colors.butterBrown} strokeWidth={2.8} />
                <Text style={styles.reasonMetricLabel}>월말 예상</Text>
                <Text style={styles.reasonMetricValue}>
                  {formatWon(metadata.predicted_monthly_spend)}
                </Text>
              </View>
            </View>
          </View>
        </GlassCard>

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
    backgroundColor: 'rgba(242, 201, 76, 0.28)',
  },
  backgroundOrbSmall: {
    position: 'absolute',
    top: 210,
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
  missionCard: {
    backgroundColor: 'rgba(255,248,216,0.42)',
  },
  missionTopRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
  },
  missionIconBubble: {
    width: 62,
    height: 62,
    borderRadius: 24,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedMissionIconBubble: {
    backgroundColor: colors.successBg,
  },
  missionTextBox: {
    flex: 1,
  },
  cardLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 6,
  },
  missionTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 23,
    lineHeight: 31,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.6,
  },
  completeRow: {
    paddingTop: 15,
    paddingBottom: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(122,111,91,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  completedRow: {
    borderColor: 'rgba(82,123,50,0.22)',
  },
  reloadButton: {
  marginTop: 14,
},
  checkBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.butterStrong,
    backgroundColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedCheckBox: {
    backgroundColor: colors.butterStrong,
  },
  completeTextBox: {
    flex: 1,
  },
  completeTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
  },
  completeDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: colors.subText,
  },
  statusCard: {
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
  statusGrid: {
    gap: 9,
  },
  statusItem: {
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
  statusLabel: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: colors.subText,
  },
  statusValue: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  reasonCard: {
    backgroundColor: 'rgba(255,255,255,0.36)',
  },
  reasonText: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    lineHeight: 23,
    color: colors.text,
    marginBottom: 16,
  },
  reasonSummaryBox: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122,111,91,0.14)',
  },
  reasonSummaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  summaryLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 5,
  },
  summaryValue: {
    fontFamily: typography.fontFamily,
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
  },
  reasonMetricRow: {
    marginTop: 14,
    gap: 8,
  },
  reasonMetricItem: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reasonMetricLabel: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: colors.subText,
  },
  reasonMetricValue: {
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
    marginTop: 12,
    marginBottom: 18,
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