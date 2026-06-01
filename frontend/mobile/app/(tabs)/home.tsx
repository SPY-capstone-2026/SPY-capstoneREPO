import { useCallback, useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Plus,
  ReceiptText,
  Sparkles,
  TrendingUp,
  WalletCards,
} from 'lucide-react-native';

import { AnimatedProgressBar } from '@/components/AnimatedProgressBar';
import { AppScreenHeader } from '@/components/AppScreenHeader';
import { GlassCard } from '@/components/GlassCard';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { mockTodayChallenge } from '@/constants/mockAiResult';
import type { DailyChallenge } from '@/constants/mockTypes';
import { useToast } from '@/contexts/ToastContext';
import { getTodayChallengeFromApi } from '@/services/challengeService';
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

function getTodayLabel() {
  const now = new Date();

  return `${now.getMonth() + 1}월 ${now.getDate()}일`;
}

function getMissionStatusText(mission: DailyChallenge) {
  if (mission.status === 'SUCCESS') {
    return '완료';
  }

  if (mission.status === 'FAILED') {
    return '종료';
  }

  return '진행 중';
}

export default function HomeScreen() {
  const { showToast } = useToast();

  const [mission, setMission] = useState<DailyChallenge>(mockTodayChallenge);
  const [report, setReport] = useState<MonthlyReportData>(defaultReportData);
  const [isLoading, setIsLoading] = useState(false);

  const monthlySummary = report.monthly_summary;
  const hasMonthlyTransactions = monthlySummary.transaction_count > 0;

  const missionMeta = getCategoryMeta(mission.category_name);
  const MissionIcon = missionMeta.Icon;

  const pressureTone = getBudgetTone(monthlySummary.budget_pressure);
  const pressureColor = getBudgetColor(monthlySummary.budget_pressure);
  const pressureBg = getBudgetBg(monthlySummary.budget_pressure);
  const pressureLabel = getBudgetLabel(monthlySummary.budget_pressure);

  const budgetGap =
    monthlySummary.predicted_monthly_spend - monthlySummary.budget_limit;

  const dailyAverage = useMemo(() => {
    const today = new Date().getDate();

    if (today <= 0) {
      return 0;
    }

    return Math.round(monthlySummary.total_spend / today);
  }, [monthlySummary.total_spend]);

  const loadHomeData = async () => {
    try {
      setIsLoading(true);

      const [missionResult, reportResult] = await Promise.allSettled([
        getTodayChallengeFromApi(),
        getMonthlyReportFromApi(),
      ]);

      if (missionResult.status === 'fulfilled') {
        setMission(missionResult.value);
      }

      if (reportResult.status === 'fulfilled') {
        setReport({
          ...reportResult.value,
          weekly_trend:
            reportResult.value.weekly_trend.length > 0
              ? reportResult.value.weekly_trend
              : defaultReportData.weekly_trend,
        });
      }

      if (
        missionResult.status === 'rejected' ||
        reportResult.status === 'rejected'
      ) {
        showToast('홈 정보를 일부 불러오지 못했어요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHomeData();
    }, [])
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
          label="HOME"
          title="오늘의 소비 흐름을 확인해요."
          description={
            isLoading
              ? '오늘의 미션과 이번 달 지출 흐름을 불러오고 있어요.'
              : `${getTodayLabel()} 기준으로 정리했습니다.`
          }
          Icon={Sparkles}
        />

        <GlassCard delay={80} tone="butter" style={styles.missionCard}>
          <View style={styles.missionTopRow}>
            <View style={styles.missionIconBubble}>
              <MissionIcon size={30} color={colors.text} strokeWidth={2.8} />
            </View>

            <View style={styles.missionTextBox}>
              <View style={styles.missionLabelRow}>
                <Text style={styles.cardLabel}>오늘의 미션</Text>
                <Text style={styles.missionStatus}>
                  {getMissionStatusText(mission)}
                </Text>
              </View>

              <Text style={styles.missionTitle}>{mission.challenge_text}</Text>
            </View>
          </View>

          <View style={styles.missionMetaRow}>
            <View style={styles.missionMetaItem}>
              <Text style={styles.metaLabel}>항목</Text>
              <Text style={styles.metaValue}>{mission.category_name}</Text>
            </View>

            <View style={styles.missionMetaItem}>
              <Text style={styles.metaLabel}>난이도</Text>
              <Text style={styles.metaValue}>{mission.difficulty}</Text>
            </View>

            <View style={styles.missionMetaItem}>
              <Text style={styles.metaLabel}>보상</Text>
              <Text style={styles.metaValue}>+{mission.xp_reward} XP</Text>
            </View>
          </View>

          <Pressable
            style={styles.cardButton}
            onPress={() => router.push('/(tabs)/challenge')}
          >
            <Text style={styles.cardButtonText}>미션 확인하기</Text>
            <ArrowRight size={17} color={colors.text} strokeWidth={2.8} />
          </Pressable>
        </GlassCard>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>빠른 실행</Text>
          <Text style={styles.sectionSubtitle}>
            자주 쓰는 기능을 바로 열 수 있어요.
          </Text>
        </View>

        <View style={styles.quickGrid}>
          <Pressable
            style={styles.quickCard}
            onPress={() => router.push('/(tabs)/transactions')}
          >
            <View style={styles.quickIconBubble}>
              <Plus size={21} color={colors.text} strokeWidth={2.8} />
            </View>

            <Text style={styles.quickTitle}>지출 추가</Text>
            <Text style={styles.quickDescription}>방금 쓴 돈 기록</Text>
          </Pressable>

          <Pressable
            style={styles.quickCard}
            onPress={() => router.push('/(tabs)/report')}
          >
            <View style={styles.quickIconBubble}>
              <BarChart3 size={21} color={colors.text} strokeWidth={2.8} />
            </View>

            <Text style={styles.quickTitle}>리포트</Text>
            <Text style={styles.quickDescription}>이번 달 흐름 보기</Text>
          </Pressable>
        </View>

        <GlassCard delay={180} style={styles.summaryCard}>
          <View style={styles.sectionTitleRow}>
            <WalletCards size={18} color={colors.butterDeep} strokeWidth={2.8} />
            <Text style={styles.sectionTitle}>이번 달 한눈에 보기</Text>
          </View>

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
              <ReceiptText
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
              <Text style={styles.metricLabel}>하루 평균</Text>
              <Text style={styles.metricValue}>{formatWon(dailyAverage)}</Text>
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

          <Pressable
            style={styles.cardButton}
            onPress={() => router.push('/(tabs)/report')}
          >
            <Text style={styles.cardButtonText}>자세히 보기</Text>
            <ArrowRight size={17} color={colors.text} strokeWidth={2.8} />
          </Pressable>
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
  missionTextBox: {
    flex: 1,
  },
  missionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  cardLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    color: colors.subText,
  },
  missionStatus: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.butterPale,
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.butterBrown,
  },
  missionTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 23,
    lineHeight: 31,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.6,
  },
  missionMetaRow: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122,111,91,0.14)',
    flexDirection: 'row',
    gap: 14,
  },
  missionMetaItem: {
    flex: 1,
  },
  metaLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 5,
  },
  metaValue: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  cardButton: {
    height: 50,
    borderRadius: 19,
    backgroundColor: colors.butterStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 15,
  },
  cardButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 12,
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
  sectionSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: colors.subText,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  quickCard: {
    flex: 1,
    minHeight: 126,
    borderRadius: 25,
    padding: 15,
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 9,
    },
    elevation: 3,
  },
  quickIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 17,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 5,
  },
  quickDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.subText,
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.36)',
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    alignItems: 'flex-start',
    marginBottom: 18,
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
});