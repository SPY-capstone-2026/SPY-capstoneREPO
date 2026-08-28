import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  Check,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  RotateCcw,
  Sparkles,
  Trophy,
  WalletCards,
} from 'lucide-react-native';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AiMetadataPanel } from '@/components/AiMetadataPanel';
import { AppScreenHeader } from '@/components/AppScreenHeader';
import { WanderingMascot } from '@/components/mascot';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { useToast } from '@/contexts/ToastContext';
import { getCurrentUser } from '@/services/authService';
import {
  getTodayChallengesFromApi,
  updateChallengeStatusFromApi,
} from '@/services/challengeService';
import type {
  ApiChallenge,
  ChallengeAiMetadata,
  LevelResult,
  MeResponse,
} from '@/types/api';
import { formatWon } from '@/utils/aiFormat';
import { getCategoryMeta } from '@/utils/categoryMeta';

function getDifficultyLabel(difficulty: string) {
  if (difficulty === 'Hard') return '어려움';
  if (difficulty === 'Medium-Hard') return '조금 어려움';
  if (difficulty === 'Medium') return '보통';
  if (difficulty === 'Special') return '보너스';
  return '쉬움';
}

function getMetadata(challenge: ApiChallenge): ChallengeAiMetadata {
  return challenge.ai_metadata ?? {};
}

type CompletionFeedback = {
  challenge: ApiChallenge;
  levelResult: LevelResult | null;
};

export default function ChallengeScreen() {
  const { showToast } = useToast();
  const [challenges, setChallenges] = useState<ApiChallenge[]>([]);
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<CompletionFeedback | null>(null);

  const completedCount = useMemo(
    () => challenges.filter((challenge) => challenge.status === 'SUCCESS').length,
    [challenges]
  );
  const totalXp = useMemo(
    () => challenges.reduce((sum, challenge) => sum + challenge.xp_reward, 0),
    [challenges]
  );
  const streakCount = useMemo(
    () =>
      challenges.filter(
        (challenge) =>
          challenge.challenge_type === 'streak형' ||
          getMetadata(challenge).challenge_origin === 'streak'
      ).length,
    [challenges]
  );
  const evaluatedCount = useMemo(() => {
    const metadataWithCandidates = challenges
      .map(getMetadata)
      .find((metadata) => Array.isArray(metadata.evaluated_categories));

    if (metadataWithCandidates?.evaluated_categories) {
      return metadataWithCandidates.evaluated_categories.length;
    }

    return new Set(
      challenges
        .filter((challenge) => getMetadata(challenge).challenge_origin !== 'streak')
        .map((challenge) => challenge.category_name)
    ).size;
  }, [challenges]);
  const pendingChallenge = useMemo(
    () => challenges.find((challenge) => challenge.status === 'PENDING') ?? challenges[0] ?? null,
    [challenges]
  );
  const progress = challenges.length > 0 ? completedCount / challenges.length : 0;

  const loadChallenges = useCallback(async () => {
    try {
      setIsLoading(true);
      const [challengeResult, userResult] = await Promise.allSettled([
        getTodayChallengesFromApi(),
        getCurrentUser(),
      ]);

      if (challengeResult.status === 'fulfilled') setChallenges(challengeResult.value);
      if (userResult.status === 'fulfilled') setUser(userResult.value);

      if (challengeResult.status === 'rejected') {
        showToast('오늘의 챌린지를 불러오지 못했어요.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      loadChallenges();
    }, [loadChallenges])
  );

  const changeStatus = async (challenge: ApiChallenge) => {
    if (updatingId !== null || challenge.status === 'FAILED') return;

    const nextStatus = challenge.status === 'SUCCESS' ? 'PENDING' : 'SUCCESS';

    try {
      setUpdatingId(challenge.challenge_id);
      const result = await updateChallengeStatusFromApi(
        String(challenge.challenge_id),
        nextStatus
      );

      setChallenges((current) =>
        current.map((item) =>
          item.challenge_id === challenge.challenge_id ? result.challenge : item
        )
      );
      setUser((current) =>
        current
          ? {
              ...current,
              total_xp: result.userProgress.total_xp,
              current_level: result.userProgress.current_level,
              current_points: result.userProgress.current_points,
            }
          : current
      );

      if (nextStatus === 'SUCCESS') {
        setFeedback({
          challenge: result.challenge,
          levelResult: result.levelResult,
        });
      } else {
        setFeedback(null);
        const reversed = result.reversalResult?.points_reversed ?? 0;
        showToast(
          reversed > 0
            ? `완료를 취소했고 ${reversed}P 보상도 회수됐어요.`
            : '챌린지 완료를 취소했어요.'
        );
      }
    } catch {
      showToast('챌린지 상태를 저장하지 못했어요.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <AppScreenHeader
          label="CHALLENGE"
          title="오늘 할 수 있는 만큼만."
          description={
            isLoading
              ? '개인화 챌린지를 불러오고 있어요.'
              : '오늘의 소비 예측과 예산 흐름을 바탕으로 정리했어요.'
          }
          Icon={ClipboardCheck}
        />

        <View style={styles.mascotRow}>
          <View style={styles.mascotBox}>
            <WanderingMascot
              enabled={false}
              motionEnabled
              size={78}
              state="idle"
              style={styles.fixedMascotMotion}
            />
          </View>
          <View style={styles.speechBubble}>
            <View style={styles.speechTail} />
            <Text style={styles.speechLabel}>Moni가 추천해요</Text>
            <Text style={styles.speechText} numberOfLines={3}>
              {pendingChallenge?.challenge_text ?? '오늘의 소비 기록을 바탕으로 챌린지를 준비하고 있어요.'}
            </Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.summaryLabel}>오늘 진행도</Text>
              <Text style={styles.summaryValue}>{completedCount}/{challenges.length} 완료</Text>
            </View>
            <View style={styles.progressBadge}>
              <CheckCircle2 size={16} color={colors.butterDeep} strokeWidth={2.6} />
              <Text style={styles.progressBadgeText}>{Math.round(progress * 100)}%</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>

          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Trophy size={16} color={colors.subText} strokeWidth={2.4} />
              <Text style={styles.statLabel}>총 보상</Text>
              <Text style={styles.statValue}>{totalXp} XP</Text>
            </View>
            <View style={styles.statItem}>
              <WalletCards size={16} color={colors.subText} strokeWidth={2.4} />
              <Text style={styles.statLabel}>보유 포인트</Text>
              <Text style={styles.statValue}>{user?.current_points ?? 0}P</Text>
            </View>
            <View style={styles.statItem}>
              <Flame size={16} color={colors.subText} strokeWidth={2.4} />
              <Text style={styles.statLabel}>보너스</Text>
              <Text style={styles.statValue}>{streakCount}개</Text>
            </View>
          </View>

          <View style={styles.policyNote}>
            <Sparkles size={15} color={colors.butterDeep} strokeWidth={2.4} />
            <Text style={styles.policyNoteText}>
              예산 압박도 기준 최대 3개에 무지출 연속 보너스 1개가 추가될 수 있어요. 현재 분석 대상은 {evaluatedCount}개예요.
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>오늘의 챌린지</Text>
          <Text style={styles.sectionMeta}>오늘 {challenges.length}개 · 최대 4개</Text>
        </View>

        {challenges.length === 0 && !isLoading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>오늘 표시할 챌린지가 없어요.</Text>
            <Text style={styles.emptyDescription}>
              소비 기록이나 챌린지 대상 카테고리가 없으면 챌린지가 생성되지 않을 수 있어요.
            </Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {challenges.map((challenge, index) => {
            const categoryMeta = getCategoryMeta(challenge.category_name);
            const Icon = categoryMeta.Icon;
            const metadata = getMetadata(challenge);
            const completed = challenge.status === 'SUCCESS';
            const failed = challenge.status === 'FAILED';
            const updating = updatingId === challenge.challenge_id;
            const isStreak =
              challenge.challenge_type === 'streak형' || metadata.challenge_origin === 'streak';
            const hasLimit =
              typeof metadata.daily_limit === 'number' && metadata.daily_limit > 0;
            const hasPredictedToday =
              typeof metadata.predicted_today === 'number' && metadata.predicted_today > 0;
            const streakDays =
              typeof metadata.no_spend_streak === 'number' ? metadata.no_spend_streak : 0;

            return (
              <View
                key={challenge.challenge_id}
                style={[styles.challengeCard, completed && styles.challengeCardCompleted]}
              >
                <View style={styles.challengeTop}>
                  <View style={[styles.challengeIcon, completed && styles.challengeIconCompleted]}>
                    {completed ? (
                      <Check size={22} color={colors.successText} strokeWidth={3} />
                    ) : (
                      <Icon size={22} color={colors.text} strokeWidth={2.5} />
                    )}
                  </View>

                  <View style={styles.challengeCopy}>
                    <View style={styles.cardMetaRow}>
                      <Text style={styles.cardIndex}>챌린지 {index + 1}</Text>
                      <View style={[styles.originBadge, isStreak && styles.streakBadge]}>
                        <Text style={[styles.originText, isStreak && styles.streakText]}>
                          {isStreak ? '연속 절약 보너스' : '맞춤 챌린지'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.challengeText, completed && styles.challengeTextCompleted]}>
                      {challenge.challenge_text}
                    </Text>
                  </View>
                </View>

                <View style={styles.chipRow}>
                  <View style={styles.chip}><Text style={styles.chipText}>{challenge.category_name}</Text></View>
                  <View style={styles.chip}><Text style={styles.chipText}>{challenge.challenge_type}</Text></View>
                  <View style={styles.chip}><Text style={styles.chipText}>{getDifficultyLabel(challenge.difficulty)}</Text></View>
                  <View style={styles.rewardChip}><Text style={styles.rewardChipText}>+{challenge.xp_reward} XP</Text></View>
                </View>

                {metadata.context_label || hasLimit || hasPredictedToday || (isStreak && streakDays > 0) ? (
                  <View style={styles.aiBox}>
                    <View style={styles.aiTitleRow}>
                      <Sparkles size={15} color={colors.butterDeep} strokeWidth={2.5} />
                      <Text style={styles.aiTitle}>이 챌린지의 기준</Text>
                    </View>

                    {metadata.context_label ? (
                      <Text style={styles.contextText}>{metadata.context_label}</Text>
                    ) : null}

                    {isStreak && streakDays > 0 ? (
                      <Text style={styles.basisDetailText}>{streakDays}일 연속 무지출 흐름이 반영됐어요.</Text>
                    ) : null}

                    {hasLimit || hasPredictedToday ? (
                      <View style={styles.aiMetricRow}>
                        {hasPredictedToday ? (
                          <View style={styles.aiMetric}>
                            <Text style={styles.aiMetricLabel}>오늘 예상</Text>
                            <Text style={styles.aiMetricValue}>{formatWon(metadata.predicted_today as number)}</Text>
                          </View>
                        ) : null}
                        {hasLimit ? (
                          <View style={styles.aiMetric}>
                            <Text style={styles.aiMetricLabel}>권장 한도</Text>
                            <Text style={styles.aiMetricValue}>{formatWon(metadata.daily_limit as number)}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <AiMetadataPanel metadata={challenge.ai_metadata} />

                <Pressable
                  disabled={failed || updating}
                  onPress={() => changeStatus(challenge)}
                  style={({ pressed }) => [
                    styles.actionButton,
                    completed && styles.cancelButton,
                    failed && styles.disabledButton,
                    pressed && !failed && styles.pressed,
                  ]}
                >
                  {completed ? (
                    <RotateCcw size={16} color={colors.subText} strokeWidth={2.4} />
                  ) : (
                    <Check size={17} color={colors.text} strokeWidth={2.8} />
                  )}
                  <Text style={[styles.actionButtonText, completed && styles.cancelButtonText]}>
                    {updating
                      ? '저장 중'
                      : failed
                        ? '종료된 챌린지'
                        : completed
                          ? '완료 취소'
                          : '완료하기'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal
        visible={feedback !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFeedback(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.celebrateMascot}>
              <WanderingMascot
                enabled={false}
                motionEnabled
                size={92}
                state="celebrate"
                style={styles.fixedMascotMotion}
              />
            </View>
            <Text style={styles.modalTitle}>챌린지 완료!</Text>
            <Text style={styles.modalDescription}>
              +{feedback?.challenge.xp_reward ?? 0} XP가 반영됐어요.
            </Text>

            {feedback?.levelResult?.leveled_up ? (
              <View style={styles.levelUpBox}>
                <Text style={styles.levelUpTitle}>
                  Lv.{feedback.levelResult.old_level} → Lv.{feedback.levelResult.new_level}
                </Text>
                <Text style={styles.levelUpText}>
                  레벨업 보상 +{feedback.levelResult.points_earned}P
                </Text>
                {feedback.levelResult.unlocked_items.length > 0 ? (
                  <Text style={styles.levelUpText}>
                    새 아이템: {feedback.levelResult.unlocked_items.join(', ')}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.pointsText}>현재 {user?.current_points ?? 0}P 보유</Text>
            )}

            <Pressable style={styles.modalButton} onPress={() => setFeedback(null)}>
              <Text style={styles.modalButtonText}>확인</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: {
    width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20,
    paddingTop: 24, paddingBottom: 112,
  },
  mascotRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  mascotBox: { width: 132, height: 94, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  fixedMascotMotion: { width: '100%', height: '100%' },
  celebrateMascot: { width: 168, height: 118, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  speechBubble: {
    flex: 1, minHeight: 112, borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, padding: 15, justifyContent: 'center', position: 'relative',
  },
  speechTail: {
    position: 'absolute', left: -7, top: 44, width: 14, height: 14,
    backgroundColor: colors.surface, borderLeftWidth: 1, borderBottomWidth: 1,
    borderColor: colors.border, transform: [{ rotate: '45deg' }],
  },
  speechLabel: { fontFamily: typography.fontFamily, fontSize: 10.5, fontWeight: '900', color: colors.butterDeep, marginBottom: 5 },
  speechText: { fontFamily: typography.fontFamily, fontSize: 14.5, lineHeight: 20, fontWeight: '800', color: colors.text },
  summaryCard: { padding: 18, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 22 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  summaryLabel: { fontFamily: typography.fontFamily, fontSize: 12, fontWeight: '800', color: colors.subText, marginBottom: 4 },
  summaryValue: { fontFamily: typography.fontFamily, fontSize: 20, fontWeight: '900', color: colors.text },
  progressBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.butterPale, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  progressBadgeText: { fontFamily: typography.fontFamily, fontSize: 12, fontWeight: '900', color: colors.butterDeep },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.butterStrong },
  statRow: { marginTop: 16, flexDirection: 'row', gap: 8 },
  statItem: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3, paddingVertical: 8 },
  statLabel: { fontFamily: typography.fontFamily, fontSize: 9.5, fontWeight: '700', color: colors.mutedText },
  statValue: { fontFamily: typography.fontFamily, fontSize: 13, fontWeight: '900', color: colors.text },
  policyNote: { marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: colors.borderSoft, flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  policyNoteText: { flex: 1, fontFamily: typography.fontFamily, fontSize: 11.5, lineHeight: 17, color: colors.subText },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  sectionTitle: { fontFamily: typography.fontFamily, fontSize: 19, fontWeight: '900', color: colors.text },
  sectionMeta: { fontFamily: typography.fontFamily, fontSize: 11.5, fontWeight: '800', color: colors.mutedText },
  list: { gap: 12 },
  challengeCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 17 },
  challengeCardCompleted: { backgroundColor: '#FCFFFD', borderColor: '#DCEFE3' },
  challengeTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  challengeIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  challengeIconCompleted: { backgroundColor: colors.successBg },
  challengeCopy: { flex: 1 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6, flexWrap: 'wrap' },
  cardIndex: { fontFamily: typography.fontFamily, fontSize: 11, fontWeight: '900', color: colors.butterDeep },
  originBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.surfaceMuted },
  originText: { fontFamily: typography.fontFamily, fontSize: 9.5, fontWeight: '800', color: colors.subText },
  streakBadge: { backgroundColor: colors.butterPale },
  streakText: { color: colors.butterDeep },
  challengeText: { fontFamily: typography.fontFamily, fontSize: 17, lineHeight: 24, fontWeight: '900', color: colors.text },
  challengeTextCompleted: { color: colors.subText },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  chip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.surfaceMuted },
  chipText: { fontFamily: typography.fontFamily, fontSize: 10.5, fontWeight: '700', color: colors.subText },
  rewardChip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.butterPale },
  rewardChipText: { fontFamily: typography.fontFamily, fontSize: 10.5, fontWeight: '900', color: colors.butterDeep },
  aiBox: { marginTop: 14, borderRadius: 15, backgroundColor: colors.surfaceSoft, padding: 13 },
  aiTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  aiTitle: { fontFamily: typography.fontFamily, fontSize: 11, fontWeight: '900', color: colors.text },
  contextText: { fontFamily: typography.fontFamily, fontSize: 12, fontWeight: '800', color: colors.butterDeep, marginBottom: 4 },
  basisDetailText: { fontFamily: typography.fontFamily, fontSize: 11.5, lineHeight: 17, color: colors.subText },
  aiMetricRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  aiMetric: { flex: 1, paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  aiMetricLabel: { fontFamily: typography.fontFamily, fontSize: 9.5, fontWeight: '700', color: colors.mutedText, marginBottom: 3 },
  aiMetricValue: { fontFamily: typography.fontFamily, fontSize: 13, fontWeight: '900', color: colors.text },
  actionButton: { height: 46, borderRadius: 14, backgroundColor: colors.butterStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  cancelButton: { backgroundColor: colors.surfaceMuted },
  disabledButton: { backgroundColor: colors.surfaceMuted, opacity: 0.7 },
  actionButtonText: { fontFamily: typography.fontFamily, fontSize: 13, fontWeight: '900', color: colors.text },
  cancelButtonText: { color: colors.subText },
  pressed: { opacity: 0.7 },
  emptyCard: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 22, marginBottom: 12 },
  emptyTitle: { fontFamily: typography.fontFamily, fontSize: 16, fontWeight: '900', color: colors.text, textAlign: 'center' },
  emptyDescription: { marginTop: 6, fontFamily: typography.fontFamily, fontSize: 13, lineHeight: 19, color: colors.subText, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.24)', justifyContent: 'center', padding: 24 },
  modalCard: { alignSelf: 'center', width: '100%', maxWidth: 390, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 22, alignItems: 'center' },
  modalTitle: { marginTop: 2, fontFamily: typography.fontFamily, fontSize: 22, fontWeight: '900', color: colors.text },
  modalDescription: { marginTop: 5, fontFamily: typography.fontFamily, fontSize: 13, color: colors.subText },
  levelUpBox: { width: '100%', marginTop: 16, borderRadius: 16, backgroundColor: colors.butterPale, padding: 14, alignItems: 'center' },
  levelUpTitle: { fontFamily: typography.fontFamily, fontSize: 17, fontWeight: '900', color: colors.text },
  levelUpText: { marginTop: 4, fontFamily: typography.fontFamily, fontSize: 12, lineHeight: 18, fontWeight: '700', color: colors.subText, textAlign: 'center' },
  pointsText: { marginTop: 14, fontFamily: typography.fontFamily, fontSize: 12.5, fontWeight: '800', color: colors.subText },
  modalButton: { width: '100%', height: 48, borderRadius: 15, backgroundColor: colors.butterStrong, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  modalButtonText: { fontFamily: typography.fontFamily, fontSize: 13.5, fontWeight: '900', color: colors.text },
});
