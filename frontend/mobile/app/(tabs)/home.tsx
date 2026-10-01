import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Coins,
  PackageOpen,
  Plus,
  ShoppingBag,
  Trophy,
} from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreenHeader } from '@/components/AppScreenHeader';
import { CharacterRoom } from '@/components/CharacterRoom';
import { GlassCard } from '@/components/GlassCard';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { useToast } from '@/contexts/ToastContext';
import { getCurrentUser } from '@/services/authService';
import { getPrimaryBudgetGuide } from '@/services/budgetGuide';
import { getTodayChallengesFromApi } from '@/services/challengeService';
import { getMonthlyReportFromApi } from '@/services/reportService';
import { isVisibleShopItemName } from '@/services/shopCatalog';
import { getInventoryFromApi } from '@/services/shopService';
import type {
  ApiChallenge,
  InventoryItem,
  MeResponse,
  MonthlyReportResponse,
} from '@/types/api';
import { formatWon } from '@/utils/aiFormat';

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
  weekly_trend: [],
  evaluated_categories: [],
};

function getTodayLabel() {
  const now = new Date();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${now.getMonth() + 1}월 ${now.getDate()}일 (${weekdays[now.getDay()]})`;
}

function xpRequiredForLevel(level: number) {
  return 30 + 10 * Math.max(0, level - 1);
}

function cumulativeXpForLevel(level: number) {
  let total = 0;
  for (let current = 1; current < level; current += 1) {
    total += xpRequiredForLevel(current);
  }
  return total;
}

export default function HomeScreen() {
  const { showToast } = useToast();

  const [report, setReport] =
    useState<MonthlyReportData>(defaultReportData);
  const [challenges, setChallenges] = useState<ApiChallenge[]>([]);
  const [user, setUser] = useState<MeResponse | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const summary = report.monthly_summary;

  const completedCount = useMemo(
    () =>
      challenges.filter(
        (challenge) => challenge.status === 'SUCCESS'
      ).length,
    [challenges]
  );

  const nextChallenge = useMemo(
    () =>
      challenges.find(
        (challenge) => challenge.status === 'PENDING'
      ) ??
      challenges[0] ??
      null,
    [challenges]
  );

  const budgetGuide = useMemo(
    () => getPrimaryBudgetGuide(challenges),
    [challenges]
  );

  const equippedCount = useMemo(
    () => inventory.filter((item) => item.is_equipped).length,
    [inventory]
  );

  const levelProgress = useMemo(() => {
    if (!user || user.current_level >= 50) return user ? 1 : 0;

    const base = cumulativeXpForLevel(user.current_level);
    const needed = xpRequiredForLevel(user.current_level);
    const current = Math.max(0, user.total_xp - base);

    return needed > 0 ? Math.min(current / needed, 1) : 1;
  }, [user]);

  const xpToNext = useMemo(() => {
    if (!user) return 0;
    if (user.current_level >= 50) return 0;

    const base = cumulativeXpForLevel(user.current_level);
    const needed = xpRequiredForLevel(user.current_level);
    const current = Math.max(0, user.total_xp - base);

    return Math.max(0, needed - current);
  }, [user]);

  const speechText = budgetGuide
    ? `${budgetGuide.categoryName} 예산을 이미 ${formatWon(
        budgetGuide.overAmount
      )} 넘었어요. 이번 달 예산을 먼저 다시 확인해 주세요.`
    : nextChallenge?.challenge_text ??
      '오늘의 소비 기록이 쌓이면 내가 챌린지를 알려줄게.';

  const loadHome = useCallback(async () => {
    try {
      setIsLoading(true);

      const [
        reportResult,
        challengeResult,
        userResult,
        inventoryResult,
      ] = await Promise.allSettled([
        getMonthlyReportFromApi(),
        getTodayChallengesFromApi(),
        getCurrentUser(),
        getInventoryFromApi(),
      ]);

      if (reportResult.status === 'fulfilled') {
        setReport(reportResult.value);
      }

      if (challengeResult.status === 'fulfilled') {
        setChallenges(challengeResult.value);
      }

      if (userResult.status === 'fulfilled') {
        setUser(userResult.value);
      }

      if (inventoryResult.status === 'fulfilled') {
        setInventory(
          inventoryResult.value.filter((entry) =>
            isVisibleShopItemName(entry.item?.name)
          )
        );
      }

      if (
        reportResult.status === 'rejected' ||
        challengeResult.status === 'rejected' ||
        userResult.status === 'rejected' ||
        inventoryResult.status === 'rejected'
      ) {
        showToast('일부 정보를 불러오지 못했어요.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      loadHome();
    }, [loadHome])
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <AppScreenHeader
          label="TODAY"
          title={`${getTodayLabel()}의 기록`}
          Icon={CalendarDays}
        />

        <GlassCard tone="butter" style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.eyebrow}>이번 달 현재 지출</Text>
              <Text style={styles.heroValue}>
                {formatWon(summary.total_spend)}
              </Text>
            </View>

            <View style={styles.reportIcon}>
              <BarChart3
                size={21}
                color={colors.butterDeep}
                strokeWidth={2.5}
              />
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroBottom}>
            <View>
              <Text style={styles.miniLabel}>월말 예상</Text>
              <Text style={styles.miniValue}>
                {formatWon(summary.predicted_monthly_spend)}
              </Text>
            </View>

            <Pressable
              onPress={() => router.push('/(tabs)/report')}
              style={({ pressed }) => [
                styles.textAction,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.textActionText}>리포트</Text>
            </Pressable>
          </View>
        </GlassCard>

        <View style={styles.roomWrap}>
          <CharacterRoom inventory={inventory} />

          <View
            style={[
              styles.speechBubble,
              budgetGuide && styles.speechBubbleWarning,
            ]}
          >
            <View
              style={[
                styles.speechTail,
                budgetGuide && styles.speechTailWarning,
              ]}
            />

            <View style={styles.speechTopRow}>
              <View style={styles.speechLabelRow}>
                {budgetGuide ? (
                  <AlertTriangle
                    size={14}
                    color={colors.warningText}
                    strokeWidth={2.5}
                  />
                ) : null}
                <Text
                  style={[
                    styles.speechLabel,
                    budgetGuide && styles.speechLabelWarning,
                  ]}
                >
                  {budgetGuide
                    ? '예산을 먼저 확인해요'
                    : 'Moni의 오늘 챌린지'}
                </Text>
              </View>

              {!budgetGuide && challenges.length > 0 ? (
                <Text style={styles.speechCount}>
                  {completedCount}/{challenges.length}
                </Text>
              ) : null}
            </View>

            <Text style={styles.speechText} numberOfLines={4}>
              {speechText}
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.speechAction,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push('/(tabs)/challenge')}
            >
              <Text style={styles.speechActionText}>
                {budgetGuide ? '예산 확인' : '챌린지'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.gameStatusBar}>
          <View style={styles.gameStatusItem}>
            <View style={styles.gameStatusIcon}>
              <Trophy
                size={14}
                color={colors.butterDeep}
                strokeWidth={2.5}
              />
            </View>
            <View style={styles.gameStatusCopy}>
              <Text style={styles.gameStatusLabel}>
                Lv.{user?.current_level ?? '-'}
              </Text>
              <Text style={styles.gameStatusHint}>
                {user?.current_level && user.current_level >= 50
                  ? 'MAX'
                  : `${xpToNext} XP 남음`}
              </Text>
              <View style={styles.gameStatusProgressTrack}>
                <View
                  style={[
                    styles.gameStatusProgressFill,
                    { width: `${Math.round(levelProgress * 100)}%` },
                  ]}
                />
              </View>
            </View>
          </View>

          <View style={styles.gameStatusDivider} />

          <View style={styles.gameStatusItemCompact}>
            <Coins
              size={15}
              color={colors.butterDeep}
              strokeWidth={2.5}
            />
            <Text style={styles.gameStatusNumber}>
              {user?.current_points ?? 0}P
            </Text>
          </View>

          <View style={styles.gameStatusDivider} />

          <View style={styles.gameStatusItemCompact}>
            <PackageOpen
              size={15}
              color={colors.butterDeep}
              strokeWidth={2.5}
            />
            <Text style={styles.gameStatusNumber}>
              {inventory.length}
            </Text>
          </View>
        </View>

        <View style={styles.characterActions}>
          <Pressable
            style={({ pressed }) => [
              styles.smallAction,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push('/shop')}
          >
            <ShoppingBag
              size={19}
              color={colors.text}
              strokeWidth={2.5}
            />
            <Text style={styles.smallActionText}>상점</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.smallAction,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push('/inventory')}
          >
            <PackageOpen
              size={19}
              color={colors.text}
              strokeWidth={2.5}
            />
            <Text style={styles.smallActionText}>보유 아이템</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.smallAction,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push('/(tabs)/transactions')}
          >
            <Plus
              size={19}
              color={colors.text}
              strokeWidth={2.7}
            />
            <Text style={styles.smallActionText}>지출 기록</Text>
          </Pressable>
        </View>

      </ScrollView>
    </View>
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
  gameStatusBar: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  gameStatusItem: {
    flex: 1.6,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  gameStatusIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameStatusCopy: {
    flex: 1,
    minWidth: 0,
  },
  gameStatusLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '900',
    color: colors.text,
  },
  gameStatusHint: {
    marginTop: 1,
    fontFamily: typography.fontFamily,
    fontSize: 7.5,
    fontWeight: '700',
    color: colors.mutedText,
  },
  gameStatusProgressTrack: {
    height: 3,
    marginTop: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  gameStatusProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.butterStrong,
  },
  gameStatusDivider: {
    width: 1,
    height: 26,
    marginHorizontal: 10,
    backgroundColor: colors.borderSoft,
  },
  gameStatusItemCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  gameStatusNumber: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '900',
    color: colors.text,
  },
  roomWrap: {
    position: 'relative',
    marginBottom: 10,
  },
  speechBubble: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 14,
    zIndex: 32,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(225, 221, 210, 0.96)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 15,
    paddingVertical: 13,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  speechBubbleWarning: {
    backgroundColor: 'rgba(255,247,232,0.97)',
    borderColor: '#F0D4A5',
  },
  speechTail: {
    position: 'absolute',
    left: '52%',
    bottom: -7,
    width: 14,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(225, 221, 210, 0.96)',
    transform: [{ rotate: '45deg' }],
  },
  speechTailWarning: {
    backgroundColor: 'rgba(255,247,232,0.97)',
    borderColor: '#F0D4A5',
  },
  speechTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 5,
  },
  speechLabelRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  speechLabel: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.butterDeep,
  },
  speechLabelWarning: {
    color: colors.warningText,
  },
  speechCount: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '900',
    color: colors.mutedText,
  },
  speechText: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    color: colors.text,
  },
  speechAction: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.butterPale,
  },
  speechActionText: {
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.text,
  },
  characterActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  smallAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  smallActionText: {
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
  },
  heroCard: {
    padding: 20,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  eyebrow: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 5,
  },
  heroValue: {
    fontFamily: typography.fontFamily,
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -0.8,
    color: colors.text,
  },
  reportIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDivider: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginVertical: 17,
  },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  miniLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedText,
    marginBottom: 3,
  },
  miniValue: {
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  textAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  textActionText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
  },
  pressed: {
    opacity: 0.68,
  },
});
