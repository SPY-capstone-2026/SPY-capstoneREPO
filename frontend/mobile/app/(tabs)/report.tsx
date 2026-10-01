import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  Minus,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  WalletCards,
} from 'lucide-react-native';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppLoadingState } from '@/components/AppLoadingState';
import { AppScreenHeader } from '@/components/AppScreenHeader';
import { GlassCard } from '@/components/GlassCard';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { useToast } from '@/contexts/ToastContext';
import {
  getBudgetHistoryFromApi,
  getChallengeStatsFromApi,
  getMonthlyReportFromApi,
  getWeeklyReportFromApi,
} from '@/services/reportService';
import type {
  BudgetHistoryItem,
  ChallengeStatsData,
  MonthlyReportData,
  MonthlyWeeklyBreakdownItem,
  WeeklyCategoryComparison,
  WeeklyReportData,
} from '@/types/report';
import { formatWon } from '@/utils/aiFormat';

type ReportMode = 'weekly' | 'monthly';
type AuxiliaryLoadState = 'idle' | 'success' | 'error';

type DateRange = {
  start: Date;
  end: Date;
};

type BudgetUsageCategory = {
  category_name: string;
  budget_limit: number;
  actual_spend: number;
  predicted_monthly_spend?: number;
  budget_pressure?: number;
};

type VerticalBarDatum = {
  label: string;
  value: number;
};

const PIE_COLORS = [
  '#F2C84B',
  '#E8B84C',
  '#F7D978',
  '#D7A449',
  '#F1D69B',
  '#C98D38',
  '#E7C77E',
  '#8F6225',
];

const EMPTY_CHALLENGE_STATS: ChallengeStatsData = {
  total_count: 0,
  completed_count: 0,
  completion_rate: 0,
  xp_earned: 0,
  by_category: [],
};

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const day = result.getDay();
  const distanceToMonday = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + distanceToMonday);
  return result;
}

function endOfWeek(date: Date) {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  return result;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function shiftDate(date: Date, mode: ReportMode, amount: number) {
  const result = new Date(date);

  if (mode === 'weekly') {
    result.setDate(result.getDate() + amount * 7);
  } else {
    result.setMonth(result.getMonth() + amount, 1);
  }

  return result;
}

function toDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatShortDate(value: Date | string) {
  const date =
    typeof value === 'string'
      ? new Date(`${value.slice(0, 10)}T00:00:00`)
      : value;

  if (Number.isNaN(date.getTime())) return String(value);

  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')}`;
}

function getRange(date: Date, mode: ReportMode): DateRange {
  if (mode === 'weekly') {
    return {
      start: startOfWeek(date),
      end: endOfWeek(date),
    };
  }

  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
}

function getPeriodLabel(
  date: Date,
  mode: ReportMode,
  weekly?: WeeklyReportData | null
) {
  if (
    mode === 'weekly' &&
    weekly?.week_start_date &&
    weekly?.week_end_date
  ) {
    return `${formatShortDate(weekly.week_start_date)} ~ ${formatShortDate(
      weekly.week_end_date
    )}`;
  }

  if (mode === 'weekly') {
    const range = getRange(date, mode);
    return `${formatShortDate(range.start)} ~ ${formatShortDate(range.end)}`;
  }

  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function isCurrentPeriod(date: Date, mode: ReportMode) {
  const today = new Date();

  if (mode === 'weekly') {
    return (
      toDateParam(startOfWeek(date)) ===
      toDateParam(startOfWeek(today))
    );
  }

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth()
  );
}

function changeAmountOf(item: {
  change?: number;
  change_amount?: number;
  this_week?: number;
  last_week?: number;
}) {
  return (
    item.change ??
    item.change_amount ??
    ((item.this_week ?? 0) - (item.last_week ?? 0))
  );
}

function changeRateOf(item: {
  change_rate?: number | null;
  change_ratio?: number | null;
  this_week?: number;
  last_week?: number;
}) {
  const given = item.change_rate ?? item.change_ratio;

  if (typeof given === 'number' && Number.isFinite(given)) {
    return Math.abs(given) <= 3 ? given * 100 : given;
  }

  const previous = item.last_week ?? 0;
  if (previous <= 0) return null;

  return (((item.this_week ?? 0) - previous) / previous) * 100;
}

function formatSignedWon(value: number) {
  if (value === 0) return '변동 없음';
  return `${value > 0 ? '+' : '-'}${formatWon(Math.abs(value))}`;
}

function formatRate(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  if (Math.abs(value) < 0.05) return '0%';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatCompletionRate(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return '0%';
  const percent = value <= 1 ? value * 100 : value;
  if (!Number.isFinite(percent)) return '0%';
  return `${Math.round(percent)}%`;
}

function weeklyBreakdownAmount(item: MonthlyWeeklyBreakdownItem) {
  return item.amount ?? item.total ?? item.total_spend ?? 0;
}

function weeklyBreakdownLabel(
  item: MonthlyWeeklyBreakdownItem,
  index: number
) {
  return (
    item.week_label ??
    item.label ??
    (item.week_number ? `${item.week_number}주차` : `${index + 1}주차`)
  );
}

function budgetHistoryBefore(item: BudgetHistoryItem) {
  return (
    item.old_budget_limit ??
    item.previous_budget_limit ??
    item.before_budget_limit
  );
}

function budgetHistoryAfter(item: BudgetHistoryItem) {
  return (
    item.new_budget_limit ??
    item.after_budget_limit ??
    item.budget_limit
  );
}

function budgetHistoryDate(item: BudgetHistoryItem) {
  return item.changed_at ?? item.changed_date ?? item.created_at;
}

function categoryUsageRatio(category: BudgetUsageCategory) {
  if (
    !Number.isFinite(category.budget_limit) ||
    !Number.isFinite(category.actual_spend) ||
    category.budget_limit <= 0
  ) {
    return 0;
  }

  return safeRatio(category.actual_spend / category.budget_limit);
}

function safeRatio(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 1)
    : 0;
}

function progressWidth(ratio: number) {
  const value = safeRatio(ratio) * 100;
  return `${value}%` as `${number}%`;
}

function barHeight(ratio: number) {
  const safe = safeRatio(ratio);
  if (safe <= 0) return '0%' as `${number}%`;
  const value = Math.min(Math.max(safe * 100, 7), 100);
  return `${value}%` as `${number}%`;
}

function AnimatedHorizontalFill({
  ratio,
  style,
}: {
  ratio: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const target = safeRatio(ratio);

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, target]);

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${Math.round(target * 100)}%`],
  });

  return <Animated.View style={[style, { width }]} />;
}

function AnimatedVerticalFill({
  ratio,
  style,
}: {
  ratio: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const target = safeRatio(ratio);
  const targetPercent =
    target <= 0 ? 0 : Math.max(Math.round(target * 100), 7);

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, target]);

  const height = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${targetPercent}%`],
  });

  return <Animated.View style={[style, { height }]} />;
}

function formatCompactWon(value: number) {
  const abs = Math.abs(value);

  if (abs >= 10000) {
    const units = value / 10000;
    const label =
      Math.abs(units - Math.round(units)) < 0.05
        ? String(Math.round(units))
        : units.toFixed(1);
    return `${label}만`;
  }

  if (abs >= 1000) {
    return `${Math.round(value / 1000)}천`;
  }

  return String(Math.round(value));
}

function formatPressure(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  const percent = Math.abs(value) <= 3 ? value * 100 : value;
  return `${Math.round(percent)}%`;
}

function SummaryMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
    </View>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function ChangeBadge({
  amount,
  rate,
}: {
  amount: number;
  rate?: number | null;
}) {
  const Icon =
    amount > 0 ? TrendingUp : amount < 0 ? TrendingDown : Minus;
  const tone =
    amount > 0
      ? styles.changeUp
      : amount < 0
      ? styles.changeDown
      : styles.changeSame;
  const textTone =
    amount > 0
      ? styles.changeUpText
      : amount < 0
      ? styles.changeDownText
      : styles.changeSameText;

  return (
    <View style={[styles.changeBadge, tone]}>
      <Icon
        size={13}
        color={
          amount > 0
            ? colors.dangerText
            : amount < 0
            ? colors.successText
            : colors.subText
        }
        strokeWidth={2.5}
      />
      <Text style={[styles.changeBadgeText, textTone]}>
        {formatSignedWon(amount)}
        {formatRate(rate) ? ` · ${formatRate(rate)}` : ''}
      </Text>
    </View>
  );
}

export default function ReportScreen() {
  const { showToast } = useToast();

  const [mode, setMode] = useState<ReportMode>('weekly');
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const [weeklyReport, setWeeklyReport] =
    useState<WeeklyReportData | null>(null);
  const [monthlyReport, setMonthlyReport] =
    useState<MonthlyReportData | null>(null);
  const [challengeStats, setChallengeStats] =
    useState<ChallengeStatsData>(EMPTY_CHALLENGE_STATS);
  const [budgetHistory, setBudgetHistory] = useState<BudgetHistoryItem[]>(
    []
  );
  const [challengeStatsState, setChallengeStatsState] =
    useState<AuxiliaryLoadState>('idle');
  const [budgetHistoryState, setBudgetHistoryState] =
    useState<AuxiliaryLoadState>('idle');

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedRange = useMemo(
    () => getRange(selectedDate, mode),
    [mode, selectedDate]
  );

  const canGoNext = !isCurrentPeriod(selectedDate, mode);

  const loadReport = useCallback(async () => {
    const range = getRange(selectedDate, mode);
    const startDate = toDateParam(range.start);
    const endDate = toDateParam(range.end);
    const targetDate =
      mode === 'weekly'
        ? toDateParam(
            endOfWeek(selectedDate) > new Date()
              ? new Date()
              : endOfWeek(selectedDate)
          )
        : toDateParam(startOfMonth(selectedDate));

    setIsLoading(true);
    setErrorMessage(null);
    setChallengeStatsState('idle');
    setBudgetHistoryState('idle');

    try {
      if (mode === 'weekly') {
        const [weeklyResult, monthlyResult, statsResult] =
          await Promise.allSettled([
            getWeeklyReportFromApi(targetDate),
            getMonthlyReportFromApi(targetDate),
            getChallengeStatsFromApi({
              period: 'week',
              startDate,
              endDate,
            }),
          ]);

        if (weeklyResult.status !== 'fulfilled') {
          throw weeklyResult.reason;
        }

        setWeeklyReport(weeklyResult.value);

        if (monthlyResult.status === 'fulfilled') {
          setMonthlyReport(monthlyResult.value);
        } else {
          setMonthlyReport(null);
        }

        if (statsResult.status === 'fulfilled') {
          setChallengeStats(statsResult.value);
          setChallengeStatsState('success');
        } else {
          setChallengeStats(EMPTY_CHALLENGE_STATS);
          setChallengeStatsState('error');
        }

        setBudgetHistory([]);
        setBudgetHistoryState('idle');

        if (
          monthlyResult.status === 'rejected' ||
          statsResult.status === 'rejected'
        ) {
          showToast('주간 리포트의 일부 부가 정보를 불러오지 못했어요.');
        }
      } else {
        const [monthlyResult, statsResult, historyResult] =
          await Promise.allSettled([
            getMonthlyReportFromApi(targetDate),
            getChallengeStatsFromApi({
              period: 'all',
              startDate,
              endDate,
            }),
            getBudgetHistoryFromApi({
              startDate,
              endDate,
            }),
          ]);

        if (monthlyResult.status !== 'fulfilled') {
          throw monthlyResult.reason;
        }

        setMonthlyReport(monthlyResult.value);
        setWeeklyReport(null);

        if (statsResult.status === 'fulfilled') {
          setChallengeStats(statsResult.value);
          setChallengeStatsState('success');
        } else {
          setChallengeStats(EMPTY_CHALLENGE_STATS);
          setChallengeStatsState('error');
        }

        if (historyResult.status === 'fulfilled') {
          setBudgetHistory(historyResult.value);
          setBudgetHistoryState('success');
        } else {
          setBudgetHistory([]);
          setBudgetHistoryState('error');
        }

        if (
          statsResult.status === 'rejected' ||
          historyResult.status === 'rejected'
        ) {
          showToast('월간 리포트의 일부 부가 정보를 불러오지 못했어요.');
        }
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '리포트를 불러오지 못했어요.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [mode, selectedDate, showToast]);

  useFocusEffect(
    useCallback(() => {
      loadReport();
    }, [loadReport])
  );

  const handleModeChange = (nextMode: ReportMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setSelectedDate(new Date());
  };

  const handleMovePeriod = (direction: -1 | 1) => {
    if (direction === 1 && !canGoNext) return;
    setSelectedDate((current) =>
      shiftDate(current, mode, direction)
    );
  };

  const periodLabel = getPeriodLabel(
    selectedDate,
    mode,
    weeklyReport
  );

  const weeklySummary = weeklyReport?.weekly_summary;
  const weeklyChange = weeklySummary
    ? changeAmountOf({
        change: weeklySummary.change,
        change_amount: weeklySummary.change_amount,
        this_week: weeklySummary.week_total,
        last_week: weeklySummary.last_week_total,
      })
    : 0;
  const weeklyChangeRate = weeklySummary
    ? changeRateOf({
        change_rate: weeklySummary.change_rate,
        change_ratio: weeklySummary.change_ratio,
        this_week: weeklySummary.week_total,
        last_week: weeklySummary.last_week_total,
      })
    : null;

  const weeklyBudgetSummary = weeklyReport?.budget;

  const weeklyBudgetCategories =
    weeklyBudgetSummary?.by_category.map((item) => ({
      category_name: item.category_name,
      budget_limit: item.budget_limit,
      actual_spend: item.month_to_date,
      budget_pressure: item.usage_ratio,
    })) ??
    monthlyReport?.evaluated_categories ??
    [];

  const weeklyMonthSpent =
    weeklyBudgetSummary?.total_month_to_date ??
    monthlyReport?.monthly_summary.total_spend ??
    0;

  const weeklyMonthBudget =
    weeklyBudgetSummary?.total_budget ??
    monthlyReport?.monthly_summary.budget_limit ??
    0;

  const weeklyMonthUsageRatio = safeRatio(
    weeklyBudgetSummary?.total_usage_ratio ??
      (weeklyMonthBudget > 0
        ? weeklyMonthSpent / weeklyMonthBudget
        : 0)
  );

  const monthlyBreakdown =
    monthlyReport?.weekly_breakdown ?? [];

  const monthlyBreakdownMax = Math.max(
    1,
    ...monthlyBreakdown.map(weeklyBreakdownAmount)
  );

  const monthlyWeekdayTrend =
    monthlyReport?.weekly_trend ?? [];

  const monthlyWeekdayTrendMax = Math.max(
    1,
    ...monthlyWeekdayTrend.map((item) => item.amount)
  );

  const highestSpendingWeek = useMemo(() => {
    if (monthlyBreakdown.length === 0) return null;

    return monthlyBreakdown.reduce((highest, item, index) => {
      const amount = weeklyBreakdownAmount(item);
      if (!highest || amount > highest.amount) {
        return {
          label: weeklyBreakdownLabel(item, index),
          amount,
        };
      }
      return highest;
    }, null as { label: string; amount: number } | null);
  }, [monthlyBreakdown]);

  const highestSpendingDay = useMemo(() => {
    if (monthlyWeekdayTrend.length === 0) return null;

    return monthlyWeekdayTrend.reduce((highest, item) => {
      if (!highest || item.amount > highest.amount) {
        return {
          label: item.label,
          amount: item.amount,
        };
      }
      return highest;
    }, null as { label: string; amount: number } | null);
  }, [monthlyWeekdayTrend]);

  const monthlyWeekReview = useMemo(() => {
    if (monthlyBreakdown.length < 2) return null;

    const first = weeklyBreakdownAmount(monthlyBreakdown[0]);
    const last = weeklyBreakdownAmount(
      monthlyBreakdown[monthlyBreakdown.length - 1]
    );
    const change = last - first;
    const rate = first > 0 ? (change / first) * 100 : null;

    return {
      firstLabel: weeklyBreakdownLabel(monthlyBreakdown[0], 0),
      lastLabel: weeklyBreakdownLabel(
        monthlyBreakdown[monthlyBreakdown.length - 1],
        monthlyBreakdown.length - 1
      ),
      first,
      last,
      change,
      rate,
    };
  }, [monthlyBreakdown]);

  const overrunItems =
    monthlyReport?.category_overrun?.filter(
      (item) => Boolean(item.overrun_date)
    ) ?? [];

  const challengeXp =
    mode === 'weekly'
      ? challengeStats.xp_earned > 0
        ? challengeStats.xp_earned
        : weeklySummary?.xp_earned ?? 0
      : challengeStats.xp_earned;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <AppScreenHeader
          label="REPORT"
          title="소비 리포트"
          ActionIcon={RefreshCw}
          actionLabel="리포트 새로고침"
          onActionPress={loadReport}
        />

        <View style={styles.modeTabs}>
          <Pressable
            onPress={() => handleModeChange('weekly')}
            style={[
              styles.modeTab,
              mode === 'weekly' && styles.modeTabActive,
            ]}
          >
            <Text
              style={[
                styles.modeTabText,
                mode === 'weekly' && styles.modeTabTextActive,
              ]}
            >
              주간
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleModeChange('monthly')}
            style={[
              styles.modeTab,
              mode === 'monthly' && styles.modeTabActive,
            ]}
          >
            <Text
              style={[
                styles.modeTabText,
                mode === 'monthly' && styles.modeTabTextActive,
              ]}
            >
              월간
            </Text>
          </Pressable>
        </View>

        <View style={styles.periodNavigator}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이전 기간"
            onPress={() => handleMovePeriod(-1)}
            style={({ pressed }) => [
              styles.periodButton,
              pressed && styles.pressed,
            ]}
          >
            <ChevronLeft
              size={18}
              color={colors.text}
              strokeWidth={2.5}
            />
          </Pressable>

          <View style={styles.periodCenter}>
            <CalendarDays
              size={15}
              color={colors.butterDeep}
              strokeWidth={2.4}
            />
            <Text style={styles.periodText}>{periodLabel}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="다음 기간"
            disabled={!canGoNext}
            onPress={() => handleMovePeriod(1)}
            style={({ pressed }) => [
              styles.periodButton,
              !canGoNext && styles.periodButtonDisabled,
              pressed && canGoNext && styles.pressed,
            ]}
          >
            <ChevronRight
              size={18}
              color={
                canGoNext ? colors.text : colors.mutedText
              }
              strokeWidth={2.5}
            />
          </Pressable>
        </View>

        {isLoading ? (
          <AppLoadingState
            title="리포트를 정리하고 있어요"
            description="소비 흐름과 예산 정보를 불러오는 중이에요."
          />
        ) : errorMessage ? (
          <GlassCard style={styles.stateCard}>
            <AlertTriangle
              size={24}
              color={colors.warningText}
              strokeWidth={2.4}
            />
            <Text style={styles.stateTitle}>
              리포트를 불러오지 못했어요.
            </Text>
            <Text style={styles.stateDescription}>
              {errorMessage}
            </Text>
            <Pressable
              onPress={loadReport}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </GlassCard>
        ) : mode === 'weekly' && weeklyReport ? (
          <>
            <SectionHeader
              title="이번 주 요약"
              description="지난주와 비교해 소비 흐름을 확인해요."
            />

            <GlassCard tone="butter">
              <View style={styles.summaryTopRow}>
                <View style={styles.summaryTitleRow}>
                  <BarChart3
                    size={19}
                    color={colors.butterDeep}
                    strokeWidth={2.5}
                  />
                  <Text style={styles.cardTitle}>주간 소비</Text>
                </View>
                <ChangeBadge
                  amount={weeklyChange}
                  rate={weeklyChangeRate}
                />
              </View>

              <View style={styles.metricsRow}>
                <SummaryMetric
                  label="이번 주"
                  value={formatWon(
                    weeklySummary?.week_total ?? 0
                  )}
                />
                <View style={styles.metricDivider} />
                <SummaryMetric
                  label="지난 주"
                  value={formatWon(
                    weeklySummary?.last_week_total ?? 0
                  )}
                />
                <View style={styles.metricDivider} />
                <SummaryMetric
                  label="획득 XP"
                  value={`${challengeXp} XP`}
                />
              </View>
            </GlassCard>

            {weeklyMonthBudget > 0 ||
            weeklyBudgetCategories.length > 0 ? (
              <>
                <SectionHeader
                  title="이번 달 예산 현황"
                  description="이번 주 소비를 월간 누적 예산 안에서 함께 확인해요."
                />

                {weeklyMonthBudget > 0 ? (
                  <GlassCard tone="butter">
                    <View style={styles.summaryTitleRow}>
                      <WalletCards
                        size={19}
                        color={colors.butterDeep}
                        strokeWidth={2.5}
                      />
                      <Text style={styles.cardTitle}>전체 월 예산</Text>
                    </View>

                    <View style={styles.monthlyHero}>
                      <Text style={styles.monthlyHeroLabel}>
                        이번 달 누적 소비
                      </Text>
                      <Text style={styles.monthlyHeroValue}>
                        {formatWon(weeklyMonthSpent)}
                      </Text>
                    </View>

                    <View style={styles.budgetTrack}>
                      <AnimatedHorizontalFill
                        ratio={weeklyMonthUsageRatio}
                        style={[
                          styles.budgetFill,
                          weeklyMonthUsageRatio > 1 &&
                            styles.budgetFillDanger,
                          weeklyMonthUsageRatio >= 0.8 &&
                            weeklyMonthUsageRatio <= 1 &&
                            styles.budgetFillWarning,
                        ]}
                      />
                    </View>

                    <View style={styles.budgetAmounts}>
                      <Text style={styles.budgetAmountText}>
                        사용률{' '}
                        {Math.round(weeklyMonthUsageRatio * 100)}%
                      </Text>
                      <Text style={styles.budgetAmountText}>
                        전체 예산 {formatWon(weeklyMonthBudget)}
                      </Text>
                    </View>
                  </GlassCard>
                ) : null}

                {weeklyBudgetCategories.length > 0 ? (
                  <GlassCard>
                    <BudgetPieChart
                      categories={weeklyBudgetCategories}
                    />
                  </GlassCard>
                ) : null}
              </>
            ) : null}

            {weeklyReport.category_comparison.length > 0 ? (
              <>
                <SectionHeader
                  title="카테고리별 소비 비교"
                  description="이번 주와 지난주의 카테고리별 지출을 비교했어요."
                />

                <GlassCard>
                  {weeklyReport.category_comparison.map(
                    (item, index) => (
                      <WeeklyComparisonRow
                        key={`${item.category_name}-${index}`}
                        item={item}
                        isLast={
                          index ===
                          weeklyReport.category_comparison.length -
                            1
                        }
                      />
                    )
                  )}
                </GlassCard>
              </>
            ) : null}

            <ChallengePerformanceCard
              stats={challengeStats}
              xpOverride={challengeXp}
              periodLabel="이번 주"
              loadState={challengeStatsState}
            />

            <ReportCommentCard
              text={weeklyReport.comment}
              source={weeklyReport.comment_source}
            />
          </>
        ) : mode === 'monthly' && monthlyReport ? (
          <>
            <SectionHeader
              title="이번 달 요약"
              description="지출, 예산, 예상 지출을 한 번에 확인해요."
            />

            <GlassCard tone="butter">
              <View style={styles.summaryTitleRow}>
                <WalletCards
                  size={19}
                  color={colors.butterDeep}
                  strokeWidth={2.5}
                />
                <Text style={styles.cardTitle}>월간 소비</Text>
              </View>

              <View style={styles.monthlyHero}>
                <Text style={styles.monthlyHeroLabel}>
                  현재 총지출
                </Text>
                <Text style={styles.monthlyHeroValue}>
                  {formatWon(
                    monthlyReport.monthly_summary.total_spend
                  )}
                </Text>
              </View>

              <View style={styles.metricsRow}>
                <SummaryMetric
                  label="월 예산"
                  value={formatWon(
                    monthlyReport.monthly_summary.budget_limit
                  )}
                />
                <View style={styles.metricDivider} />
                <SummaryMetric
                  label="월말 예상"
                  value={formatWon(
                    monthlyReport.monthly_summary
                      .predicted_monthly_spend
                  )}
                />
                <View style={styles.metricDivider} />
                <SummaryMetric
                  label="획득 XP"
                  value={`${challengeXp} XP`}
                />
              </View>
            </GlassCard>

            {monthlyBreakdown.length > 0 ? (
              <>
                <SectionHeader
                  title="주차별 소비 리뷰"
                  description="한 달 동안 어느 주에 소비가 집중됐는지 확인해요."
                />

                <GlassCard>
                  <VerticalBarChart
                    data={monthlyBreakdown.map((item, index) => ({
                      label: weeklyBreakdownLabel(item, index),
                      value: weeklyBreakdownAmount(item),
                    }))}
                    maxValue={monthlyBreakdownMax}
                  />

                  <View style={styles.chartSummary}>
                    {highestSpendingWeek ? (
                      <View style={styles.chartSummaryRow}>
                        <Text style={styles.chartSummaryLabel}>
                          가장 지출이 컸던 주
                        </Text>
                        <Text style={styles.chartSummaryValue}>
                          {highestSpendingWeek.label} ·{' '}
                          {formatWon(highestSpendingWeek.amount)}
                        </Text>
                      </View>
                    ) : null}

                    {monthlyWeekReview ? (
                      <View style={styles.chartSummaryRow}>
                        <Text style={styles.chartSummaryLabel}>
                          첫 주 대비 마지막 주
                        </Text>
                        <Text style={styles.chartSummaryValue}>
                          {monthlyWeekReview.firstLabel}{' '}
                          {formatWon(monthlyWeekReview.first)}
                          {'  →  '}
                          {monthlyWeekReview.lastLabel}{' '}
                          {formatWon(monthlyWeekReview.last)}
                        </Text>
                        <View style={styles.reviewChangeRow}>
                          <ChangeBadge
                            amount={monthlyWeekReview.change}
                            rate={monthlyWeekReview.rate}
                          />
                        </View>
                      </View>
                    ) : null}
                  </View>
                </GlassCard>
              </>
            ) : null}

            {monthlyWeekdayTrend.length > 0 ? (
              <>
                <SectionHeader
                  title="요일별 소비 패턴"
                  description="이번 달에 어떤 요일의 소비가 컸는지 확인해요."
                />

                <GlassCard>
                  <VerticalBarChart
                    data={monthlyWeekdayTrend.map((item) => ({
                      label: item.label,
                      value: item.amount,
                    }))}
                    maxValue={monthlyWeekdayTrendMax}
                  />

                  {highestSpendingDay ? (
                    <View style={styles.chartSummary}>
                      <View style={styles.chartSummaryRow}>
                        <Text style={styles.chartSummaryLabel}>
                          소비가 가장 컸던 요일
                        </Text>
                        <Text style={styles.chartSummaryValue}>
                          {highestSpendingDay.label} ·{' '}
                          {formatWon(highestSpendingDay.amount)}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </GlassCard>
              </>
            ) : null}

            {monthlyReport.evaluated_categories.length > 0 ? (
              <>
                <SectionHeader
                  title="카테고리별 예산"
                  description="설정한 월 예산이 카테고리별로 어떻게 배분되어 있는지 확인해요."
                />

                <GlassCard>
                  <BudgetPieChart
                    categories={monthlyReport.evaluated_categories}
                  />
                </GlassCard>
              </>
            ) : null}

            {overrunItems.length > 0 ? (
              <>
                <SectionHeader
                  title="예산 초과 시점"
                  description="예산을 처음 넘어선 시점을 확인해요."
                />

                <View style={styles.stack}>
                  {overrunItems.map((item, index) => {
                    const lastPoint =
                      item.daily_cumulative?.[
                        item.daily_cumulative.length - 1
                      ];
                    const latestAmount =
                      lastPoint?.cumulative_spend ??
                      lastPoint?.cumulative_amount ??
                      lastPoint?.amount;

                    return (
                      <GlassCard
                        key={`${item.category_name}-${index}`}
                        style={styles.overrunCard}
                      >
                        <View style={styles.overrunIcon}>
                          <AlertTriangle
                            size={17}
                            color={colors.warningText}
                            strokeWidth={2.5}
                          />
                        </View>
                        <View style={styles.overrunCopy}>
                          <Text style={styles.overrunCategory}>
                            {item.category_name}
                          </Text>
                          <Text style={styles.overrunText}>
                            {formatShortDate(
                              item.overrun_date as string
                            )}
                            에 예산을 처음 초과했어요.
                          </Text>
                          <Text style={styles.overrunMeta}>
                            {item.budget_limit != null
                              ? `예산 ${formatWon(
                                  item.budget_limit
                                )}`
                              : ''}
                            {item.budget_limit != null &&
                            latestAmount != null
                              ? ' · '
                              : ''}
                            {latestAmount != null
                              ? `누적 ${formatWon(latestAmount)}`
                              : ''}
                          </Text>
                        </View>
                      </GlassCard>
                    );
                  })}
                </View>
              </>
            ) : null}

            {budgetHistory.length > 0 ? (
              <>
                <SectionHeader
                  title="예산 변경 기록"
                  description="이번 달에 조정한 카테고리 예산이에요."
                />

                <GlassCard>
                  {budgetHistory.map((item, index) => {
                    const before = budgetHistoryBefore(item);
                    const after = budgetHistoryAfter(item);
                    const changedDate = budgetHistoryDate(item);

                    return (
                      <View
                        key={
                          item.id ??
                          `${item.category_name}-${changedDate}-${index}`
                        }
                        style={[
                          styles.historyRow,
                          index === budgetHistory.length - 1 &&
                            styles.rowLast,
                        ]}
                      >
                        <View style={styles.historyIcon}>
                          <History
                            size={15}
                            color={colors.butterDeep}
                            strokeWidth={2.4}
                          />
                        </View>

                        <View style={styles.historyCopy}>
                          <View style={styles.historyTop}>
                            <Text style={styles.historyCategory}>
                              {item.category_name}
                            </Text>
                            {changedDate ? (
                              <Text style={styles.historyDate}>
                                {formatShortDate(changedDate)}
                              </Text>
                            ) : null}
                          </View>

                          <Text style={styles.historyValue}>
                            {before != null
                              ? formatWon(before)
                              : '이전 예산'}
                            {'  →  '}
                            {after != null
                              ? formatWon(after)
                              : '변경 예산'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </GlassCard>
              </>
            ) : null}

            <ChallengePerformanceCard
              stats={challengeStats}
              xpOverride={challengeXp}
              periodLabel="이번 달"
              loadState={challengeStatsState}
            />

            <ReportCommentCard
              text={monthlyReport.comment}
              source={monthlyReport.comment_source}
            />
          </>
        ) : (
          <GlassCard style={styles.stateCard}>
            <BarChart3
              size={24}
              color={colors.mutedText}
              strokeWidth={2.3}
            />
            <Text style={styles.stateTitle}>
              표시할 리포트 데이터가 없어요.
            </Text>
            <Text style={styles.stateDescription}>
              소비 기록이 쌓이면 이 기간의 분석을 확인할 수 있어요.
            </Text>
          </GlassCard>
        )}
      </ScrollView>
    </View>
  );
}

function WeeklyComparisonRow({
  item,
  isLast,
}: {
  item: WeeklyCategoryComparison;
  isLast: boolean;
}) {
  const amount = changeAmountOf(item);
  const rate = changeRateOf(item);
  const maxAmount = Math.max(item.this_week, item.last_week, 1);

  return (
    <View
      style={[
        styles.comparisonRow,
        isLast && styles.rowLast,
      ]}
    >
      <View style={styles.comparisonTop}>
        <Text style={styles.categoryName}>
          {item.category_name}
        </Text>
        <ChangeBadge amount={amount} rate={rate} />
      </View>

      <View style={styles.compareLine}>
        <Text style={styles.compareLabel}>이번 주</Text>
        <View style={styles.compareTrack}>
          <AnimatedHorizontalFill
            ratio={item.this_week / maxAmount}
            style={styles.compareFillCurrent}
          />
        </View>
        <Text style={styles.compareValue}>
          {formatWon(item.this_week)}
        </Text>
      </View>

      <View style={styles.compareLine}>
        <Text style={styles.compareLabel}>지난 주</Text>
        <View style={styles.compareTrack}>
          <AnimatedHorizontalFill
            ratio={item.last_week / maxAmount}
            style={styles.compareFillPrevious}
          />
        </View>
        <Text style={styles.compareValue}>
          {formatWon(item.last_week)}
        </Text>
      </View>
    </View>
  );
}

function VerticalBarChart({
  data,
  maxValue,
}: {
  data: VerticalBarDatum[];
  maxValue?: number;
}) {
  const maximum = Math.max(
    maxValue ?? 0,
    ...data.map((item) => item.value),
    1
  );

  return (
    <View style={styles.verticalChart}>
      {data.map((item, index) => {
        const ratio =
          Number.isFinite(item.value) && maximum > 0
            ? safeRatio(item.value / maximum)
            : 0;

        return (
          <View
            key={`${item.label}-${index}`}
            style={styles.verticalBarColumn}
          >
            <Text
              style={styles.verticalBarValue}
              numberOfLines={1}
            >
              {formatCompactWon(item.value)}
            </Text>

            <View style={styles.verticalBarArea}>
              <AnimatedVerticalFill
                ratio={ratio}
                style={styles.verticalBar}
              />
            </View>

            <Text
              style={styles.verticalBarLabel}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function BudgetPieChart({
  categories,
}: {
  categories: BudgetUsageCategory[];
}) {
  const visible = categories.filter(
    (category) => category.budget_limit > 0
  );
  const totalBudget = visible.reduce(
    (sum, category) => sum + category.budget_limit,
    0
  );

  if (visible.length === 0 || totalBudget <= 0) {
    return (
      <EmptyInfoCard text="표시할 카테고리 예산이 없어요." />
    );
  }

  const size = 160;
  const center = size / 2;
  const radius = 52;
  const strokeWidth = 26;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <View style={styles.pieContentRow}>
      <View style={styles.pieChartWrap}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={colors.surfaceMuted}
            strokeWidth={strokeWidth}
          />

          {visible.map((category, index) => {
            const fraction = category.budget_limit / totalBudget;
            const dash = circumference * fraction;
            const dashOffset = -offset;
            offset += dash;

            return (
              <Circle
                key={`${category.category_name}-${index}`}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={PIE_COLORS[index % PIE_COLORS.length]}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={dashOffset}
                rotation="-90"
                origin={`${center}, ${center}`}
              />
            );
          })}
        </Svg>

        <View style={styles.pieCenter}>
          <Text style={styles.pieCenterLabel}>전체 예산</Text>
          <Text style={styles.pieCenterValue}>
            {formatWon(totalBudget)}
          </Text>
        </View>
      </View>

      <View style={styles.pieLegend}>
        {visible.map((category, index) => {
          const ratio =
            category.budget_limit > 0 &&
            Number.isFinite(category.actual_spend) &&
            Number.isFinite(category.budget_limit)
              ? safeRatio(
                  category.actual_spend / category.budget_limit
                )
              : 0;

          return (
            <View
              key={`${category.category_name}-legend-${index}`}
              style={styles.pieLegendRow}
            >
              <View style={styles.pieLegendLeft}>
                <View
                  style={[
                    styles.pieLegendDot,
                    {
                      backgroundColor:
                        PIE_COLORS[index % PIE_COLORS.length],
                    },
                  ]}
                />
                <Text style={styles.pieLegendName}>
                  {category.category_name}
                </Text>
              </View>

              <View style={styles.pieLegendRight}>
                <Text style={styles.pieLegendBudget}>
                  {formatWon(category.budget_limit)}
                </Text>
                <Text style={styles.pieLegendUsage}>
                  사용 {Math.round(ratio * 100)}%
                  {formatPressure(category.budget_pressure)
                    ? ` · 압박도 ${formatPressure(
                        category.budget_pressure
                      )}`
                    : ''}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function EmptyInfoCard({ text }: { text: string }) {
  return (
    <GlassCard style={styles.emptyInfoCard}>
      <Text style={styles.emptyInfoText}>{text}</Text>
    </GlassCard>
  );
}

function BudgetUsageRow({
  category,
  isLast,
}: {
  category: BudgetUsageCategory;
  isLast: boolean;
}) {
  const ratio = categoryUsageRatio(category);
  const isOver = ratio > 1;
  const isNear = ratio >= 0.8 && !isOver;

  return (
    <View
      style={[
        styles.budgetRow,
        isLast && styles.rowLast,
      ]}
    >
      <View style={styles.budgetTop}>
        <Text style={styles.categoryName}>
          {category.category_name}
        </Text>

        <View style={styles.budgetRatioWrap}>
          {formatPressure(category.budget_pressure) ? (
            <Text style={styles.budgetPressure}>
              압박도 {formatPressure(category.budget_pressure)}
            </Text>
          ) : null}

          <Text
            style={[
              styles.budgetRatio,
              isOver && styles.budgetRatioDanger,
              isNear && styles.budgetRatioWarning,
            ]}
          >
            사용 {Math.round(ratio * 100)}%
          </Text>
        </View>
      </View>

      <View style={styles.budgetTrack}>
        <AnimatedHorizontalFill
          ratio={ratio}
          style={[
            styles.budgetFill,
            isOver && styles.budgetFillDanger,
            isNear && styles.budgetFillWarning,
          ]}
        />
      </View>

      <View style={styles.budgetAmounts}>
        <Text style={styles.budgetAmountText}>
          사용 {formatWon(category.actual_spend)}
        </Text>
        <Text style={styles.budgetAmountText}>
          예산 {formatWon(category.budget_limit)}
        </Text>
      </View>

      {category.predicted_monthly_spend != null ? (
        <Text style={styles.budgetPredictionText}>
          월말 예상 {formatWon(category.predicted_monthly_spend)}
        </Text>
      ) : null}
    </View>
  );
}

function ChallengePerformanceCard({
  stats,
  xpOverride,
  periodLabel,
  loadState,
}: {
  stats: ChallengeStatsData;
  xpOverride: number;
  periodLabel: string;
  loadState: AuxiliaryLoadState;
}) {
  const hasStats =
    stats.total_count > 0 ||
    stats.completed_count > 0 ||
    xpOverride > 0 ||
    stats.by_category.length > 0;

  return (
    <>
      <SectionHeader
        title="챌린지 성과"
        description={`${periodLabel} 챌린지 달성 결과예요.`}
      />

      <GlassCard>
        {!hasStats ? (
          <View style={styles.challengeEmpty}>
            <Text style={styles.challengeEmptyText}>
              {loadState === 'error'
                ? '챌린지 통계를 불러오지 못했어요.'
                : `${periodLabel}에 집계된 챌린지가 아직 없어요.`}
            </Text>
          </View>
        ) : (
          <>
        <View style={styles.challengeTop}>
          <View style={styles.challengeIcon}>
            <Trophy
              size={19}
              color={colors.butterDeep}
              strokeWidth={2.5}
            />
          </View>

          <View style={styles.challengeHeadline}>
            <Text style={styles.challengeHeadlineLabel}>
              달성률
            </Text>
            <Text style={styles.challengeHeadlineValue}>
              {formatCompletionRate(stats.completion_rate)}
            </Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <SummaryMetric
            label="받은 챌린지"
            value={`${stats.total_count}개`}
          />
          <View style={styles.metricDivider} />
          <SummaryMetric
            label="완료"
            value={`${stats.completed_count}개`}
          />
          <View style={styles.metricDivider} />
          <SummaryMetric
            label="획득 XP"
            value={`${xpOverride} XP`}
          />
        </View>

        {stats.by_category.length > 0 ? (
          <View style={styles.challengeCategoryList}>
            {stats.by_category.map((item, index) => {
              const total = item.total_count ?? item.total ?? 0;
              const completed =
                item.completed_count ?? item.completed ?? 0;

              return (
                <View
                  key={`${item.category_name}-${index}`}
                  style={styles.challengeCategoryChip}
                >
                  <CheckCircle2
                    size={13}
                    color={colors.successText}
                    strokeWidth={2.4}
                  />
                  <Text style={styles.challengeCategoryText}>
                    {item.category_name} {completed}/{total}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
          </>
        )}
      </GlassCard>
    </>
  );
}

function ReportCommentCard({
  text,
  source,
}: {
  text?: string | null;
  source?: string | null;
}) {
  return (
    <GlassCard tone="butter" style={styles.commentCard}>

        <View style={styles.commentTop}>
          <View style={styles.commentIcon}>
            <Sparkles
              size={18}
              color={colors.butterDeep}
              strokeWidth={2.4}
            />
          </View>
          <Text style={styles.commentLabel}>MONI REVIEW</Text>
        </View>
        <Text style={styles.commentText}>
          {text ?? '아직 생성된 소비 리뷰가 없어요.'}
        </Text>
        {text && source ? (
          <Text style={styles.commentSource}>
            {source === 'llm'
              ? 'AI 종합 평가'
              : source === 'rule_fallback'
              ? '기본 평가'
              : source}
          </Text>
        ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 112,
  },
  modeTabs: {
    flexDirection: 'row',
    borderRadius: 18,
    padding: 4,
    backgroundColor: colors.ink,
    marginBottom: 12,
  },
  modeTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabActive: {
    backgroundColor: colors.backgroundWhite,
    borderWidth: 0,
  },
  modeTabText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: '#AAA4B0',
  },
  modeTabTextActive: {
    color: colors.text,
  },
  periodNavigator: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.popBlue,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    marginBottom: 24,
  },
  periodButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodButtonDisabled: {
    opacity: 0.35,
  },
  periodCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  periodText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  sectionHeader: {
    marginTop: 5,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.3,
  },
  sectionDescription: {
    marginTop: 4,
    fontFamily: typography.fontFamily,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.subText,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  metric: {
    flex: 1,
    minWidth: 0,
  },
  metricDivider: {
    width: 1,
    minHeight: 44,
    marginHorizontal: 10,
    backgroundColor: colors.borderSoft,
  },
  metricLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '800',
    color: colors.mutedText,
    marginBottom: 5,
  },
  metricValue: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
    color: colors.text,
  },
  metricHint: {
    marginTop: 3,
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    color: colors.subText,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },
  changeUp: {
    backgroundColor: colors.dangerBg,
  },
  changeDown: {
    backgroundColor: colors.successBg,
  },
  changeSame: {
    backgroundColor: colors.surfaceMuted,
  },
  changeBadgeText: {
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '900',
  },
  changeUpText: {
    color: colors.dangerText,
  },
  changeDownText: {
    color: colors.successText,
  },
  changeSameText: {
    color: colors.subText,
  },
  verticalChart: {
    minHeight: 220,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 4,
  },
  verticalBarColumn: {
    flex: 1,
    minWidth: 34,
    maxWidth: 76,
    alignItems: 'center',
  },
  verticalBarValue: {
    marginBottom: 6,
    fontFamily: typography.fontFamily,
    fontSize: 9,
    fontWeight: '800',
    color: colors.subText,
  },
  verticalBarArea: {
    width: '70%',
    height: 150,
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.surfaceMuted,
  },
  verticalBar: {
    width: '100%',
    borderRadius: 10,
    backgroundColor: colors.butterStrong,
  },
  verticalBarLabel: {
    marginTop: 7,
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  chartSummary: {
    marginTop: 17,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    gap: 12,
  },
  chartSummaryRow: {
    gap: 4,
  },
  chartSummaryLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.mutedText,
  },
  chartSummaryValue: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
  },
  pieContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pieChartWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieCenter: {
    position: 'absolute',
    width: 105,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieCenterLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.mutedText,
  },
  pieCenterValue: {
    marginTop: 3,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
  },
  pieLegend: {
    flex: 1,
    minWidth: 0,
  },
  pieLegendRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  pieLegendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  pieLegendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  pieLegendName: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '900',
    color: colors.text,
  },
  pieLegendRight: {
    alignItems: 'flex-end',
  },
  pieLegendBudget: {
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.text,
  },
  pieLegendUsage: {
    marginTop: 2,
    fontFamily: typography.fontFamily,
    fontSize: 9,
    color: colors.subText,
  },
  emptyInfoCard: {
    minHeight: 82,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyInfoText: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '700',
    color: colors.subText,
    textAlign: 'center',
  },
  challengeEmpty: {
    minHeight: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeEmptyText: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    lineHeight: 17,
    color: colors.subText,
    textAlign: 'center',
  },

  comparisonRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  comparisonTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  categoryName: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  compareLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 7,
  },
  compareLabel: {
    width: 46,
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '800',
    color: colors.subText,
  },
  compareTrack: {
    flex: 1,
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  compareFillCurrent: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.butterStrong,
  },
  compareFillPrevious: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.gray300,
  },
  compareValue: {
    width: 82,
    textAlign: 'right',
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.text,
  },
  budgetRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  budgetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  budgetRatioWrap: {
    alignItems: 'flex-end',
    gap: 2,
  },
  budgetPressure: {
    fontFamily: typography.fontFamily,
    fontSize: 9,
    fontWeight: '800',
    color: colors.subText,
  },
  budgetRatio: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '900',
    color: colors.successText,
  },
  budgetRatioWarning: {
    color: colors.warningText,
  },
  budgetRatioDanger: {
    color: colors.dangerText,
  },
  budgetTrack: {
    height: 9,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  budgetFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.butterStrong,
  },
  budgetFillWarning: {
    backgroundColor: '#EFB95A',
  },
  budgetFillDanger: {
    backgroundColor: '#D66A61',
  },
  budgetAmounts: {
    marginTop: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  budgetAmountText: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    color: colors.subText,
  },
  budgetPredictionText: {
    marginTop: 5,
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    color: colors.mutedText,
  },
  monthlyHero: {
    marginTop: 17,
    marginBottom: 19,
  },
  monthlyHeroLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.subText,
  },
  monthlyHeroValue: {
    marginTop: 4,
    fontFamily: typography.fontFamily,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -0.8,
    color: colors.text,
  },
  reviewHighlight: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.popMint,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 16,
  },
  reviewHighlightLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.butterDeep,
    marginBottom: 3,
  },
  reviewHighlightValue: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  reviewChangeRow: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  barList: {
    gap: 14,
  },
  barRow: {
    gap: 7,
  },
  barLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  barLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 11.5,
    fontWeight: '900',
    color: colors.text,
  },
  barAmount: {
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.subText,
  },
  barTrack: {
    height: 9,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.popBlue,
  },
  stack: {
    gap: 0,
  },
  overrunCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  overrunIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warningBg,
  },
  overrunCopy: {
    flex: 1,
  },
  overrunCategory: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  overrunText: {
    marginTop: 3,
    fontFamily: typography.fontFamily,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.text,
  },
  overrunMeta: {
    marginTop: 4,
    fontFamily: typography.fontFamily,
    fontSize: 10,
    color: colors.subText,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyCopy: {
    flex: 1,
  },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  historyCategory: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
  },
  historyDate: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.mutedText,
  },
  historyValue: {
    marginTop: 4,
    fontFamily: typography.fontFamily,
    fontSize: 11,
    color: colors.subText,
  },
  challengeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 17,
  },
  challengeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeHeadline: {
    marginLeft: 11,
  },
  challengeHeadlineLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.mutedText,
  },
  challengeHeadlineValue: {
    marginTop: 2,
    fontFamily: typography.fontFamily,
    fontSize: 21,
    fontWeight: '900',
    color: colors.text,
  },
  challengeCategoryList: {
    marginTop: 16,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  challengeCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.successBg,
  },
  challengeCategoryText: {
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.successText,
  },
  commentCard: {
    marginTop: 18,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.popPink,
  },
  commentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 11,
  },
  commentIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    color: colors.butterDeep,
  },
  commentText: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '800',
    color: colors.text,
  },
  commentSource: {
    marginTop: 9,
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    color: colors.mutedText,
  },
  stateCard: {
    minHeight: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    marginTop: 11,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
  },
  stateDescription: {
    marginTop: 5,
    maxWidth: 340,
    fontFamily: typography.fontFamily,
    fontSize: 11,
    lineHeight: 17,
    color: colors.subText,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: colors.butterPale,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  retryText: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '900',
    color: colors.butterBrown,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  pressed: {
    opacity: 0.68,
  },
});
