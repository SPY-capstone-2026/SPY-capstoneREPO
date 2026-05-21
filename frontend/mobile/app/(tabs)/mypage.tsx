import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  Bell,
  ChevronRight,
  CreditCard,
  LogOut,
  PiggyBank,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UserRound,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';

import { AnimatedProgressBar } from '@/components/AnimatedProgressBar';
import { GlassCard } from '@/components/GlassCard';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import {
  mockCategorySettings,
  mockTodayChallenge,
  mockUserProfile,
} from '@/constants/mockAiResult';
import { useMission } from '@/contexts/MissionContext';
import { useToast } from '@/contexts/ToastContext';
import { formatWon, sortEvaluatedCategories } from '@/utils/aiFormat';
import {
  getBudgetBg,
  getBudgetColor,
  getBudgetLabel,
  getBudgetSignalText,
  getBudgetTone,
} from '@/utils/budgetStatus';
import { getCategoryMeta } from '@/utils/categoryMeta';

function getIncomeTypeLabel(incomeType: string) {
  if (incomeType === 'STUDENT') return '학생';
  if (incomeType === 'EMPLOYEE') return '직장인';
  return incomeType;
}

function getSpendProfileLabel(profile: string) {
  if (profile === 'STEADY') return '안정형';
  if (profile === 'IMPULSIVE') return '즉흥 소비형';
  if (profile === 'CYCLICAL') return '주기 소비형';
  if (profile === 'balanced') return '균형형';
  if (profile === 'careful') return '절약형';
  if (profile === 'overspend') return '관리 필요형';
  if (profile === 'custom') return '직접 설정';
  return profile;
}

function getProfileMessage(profile: string) {
  if (profile === 'IMPULSIVE') {
    return '작은 미션으로 충동 소비를 천천히 줄여볼 수 있어요.';
  }

  if (profile === 'CYCLICAL') {
    return '소비가 커지는 시기를 미리 보고 예산을 조절해볼 수 있어요.';
  }

  if (profile === 'STEADY') {
    return '현재 소비 흐름을 안정적으로 유지하는 데 집중하면 좋아요.';
  }

  return '나에게 맞는 소비 흐름을 만들어가는 중이에요.';
}

export default function MyPageScreen() {
  const user = mockUserProfile;
  const mission = mockTodayChallenge;
  const { showToast } = useToast();

  const {
    currentXp,
    currentLevel,
    isTodayMissionCompleted,
  } = useMission();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [missionReminderEnabled, setMissionReminderEnabled] = useState(true);
  const [budgetAlertEnabled, setBudgetAlertEnabled] = useState(true);

  const evaluatedCategories = sortEvaluatedCategories(
    mission.ai_metadata.evaluated_categories
  );

  const missionCategoryCount = useMemo(
    () => mockCategorySettings.filter((item) => item.is_daily_challenge).length,
    []
  );

  const levelGoal = 200;
  const levelProgress = Math.min(currentXp / levelGoal, 1);

  const topCategory =
    evaluatedCategories[0] ?? {
      category_name: mission.category_name,
      budget_pressure: mission.ai_metadata.budget_pressure,
      budget_limit: mission.ai_metadata.budget_limit,
      predicted_monthly_spend: mission.ai_metadata.predicted_monthly_spend,
      rank: 1,
    };

  const topCategoryMeta = getCategoryMeta(topCategory.category_name);
  const TopCategoryIcon = topCategoryMeta.Icon;

  const topCategoryTone = getBudgetTone(topCategory.budget_pressure);
  const topCategoryColor = getBudgetColor(topCategory.budget_pressure);
  const topCategoryBg = getBudgetBg(topCategory.budget_pressure);
  const topCategoryLabel = getBudgetLabel(topCategory.budget_pressure);

  const handleTogglePush = (value: boolean) => {
    setPushEnabled(value);
    showToast(value ? '알림을 켰어요.' : '알림을 껐어요.');
  };

  const handleToggleMissionReminder = (value: boolean) => {
    setMissionReminderEnabled(value);
    showToast(value ? '미션 알림을 켰어요.' : '미션 알림을 껐어요.');
  };

  const handleToggleBudgetAlert = (value: boolean) => {
    setBudgetAlertEnabled(value);
    showToast(value ? '예산 알림을 켰어요.' : '예산 알림을 껐어요.');
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
        <View style={styles.header}>
          <Text style={styles.headerLabel}>MY</Text>
          <Text style={styles.title}>내 소비 습관을 관리해요.</Text>
          <Text style={styles.subtitle}>
            프로필, 미션, 예산 알림을 한곳에서 확인할 수 있습니다.
          </Text>
        </View>

        <GlassCard delay={80} tone="butter" style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatarBubble}>
              <View style={styles.avatarHighlight} />
              <UserRound size={32} color={colors.text} strokeWidth={2.8} />
            </View>

            <View style={styles.profileTextBox}>
              <Text style={styles.cardLabel}>내 프로필</Text>
              <Text style={styles.profileName}>Moni 사용자</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>

            <View style={styles.profileBadge}>
              <Text style={styles.profileBadgeText}>Lv. {currentLevel}</Text>
            </View>
          </View>

          <Text style={styles.profileMessage}>
            {getProfileMessage(user.spend_profile)}
          </Text>

          <View style={styles.profileInfoGrid}>
            <View style={styles.profileInfoItem}>
              <Text style={styles.profileInfoLabel}>유형</Text>
              <Text style={styles.profileInfoValue}>
                {getIncomeTypeLabel(user.income_type)}
              </Text>
            </View>

            <View style={styles.profileInfoItem}>
              <Text style={styles.profileInfoLabel}>소비 성향</Text>
              <Text style={styles.profileInfoValue}>
                {getSpendProfileLabel(user.spend_profile)}
              </Text>
            </View>

            <View style={styles.profileInfoItem}>
              <Text style={styles.profileInfoLabel}>수입일</Text>
              <Text style={styles.profileInfoValue}>매월 {user.payday}일</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard delay={160} style={styles.growthCard}>
          <View style={styles.sectionTitleRow}>
            <Trophy size={19} color={colors.butterDeep} strokeWidth={2.8} />
            <Text style={styles.sectionTitle}>성장 상태</Text>
          </View>

          <View style={styles.growthTopRow}>
            <View>
              <Text style={styles.growthLevel}>Lv. {currentLevel}</Text>
              <Text style={styles.growthDescription}>
                미션을 완료할수록 XP가 쌓입니다.
              </Text>
            </View>

            <View style={styles.xpBadge}>
              <Sparkles size={15} color={colors.butterBrown} strokeWidth={2.8} />
              <Text style={styles.xpBadgeText}>{currentXp} XP</Text>
            </View>
          </View>

          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>다음 레벨까지</Text>
            <Text style={styles.progressValue}>
              {currentXp >= levelGoal
                ? '새로운 레벨에 도달했어요'
                : `${levelGoal - currentXp} XP 남음`}
            </Text>
          </View>

          <AnimatedProgressBar progress={levelProgress} tone="warning" />

          <View
            style={[
              styles.missionStatusBox,
              isTodayMissionCompleted && styles.completedMissionStatusBox,
            ]}
          >
            <Target
              size={16}
              color={
                isTodayMissionCompleted ? colors.successText : colors.butterDeep
              }
              strokeWidth={2.8}
            />
            <Text
              style={[
                styles.missionStatusText,
                isTodayMissionCompleted && styles.completedMissionStatusText,
              ]}
            >
              {isTodayMissionCompleted
                ? '오늘의 미션을 완료했어요.'
                : '오늘의 미션을 완료하면 XP가 쌓입니다.'}
            </Text>
          </View>
        </GlassCard>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>자주 쓰는 설정</Text>
          <Text style={styles.sectionSubtitle}>
            예산과 미션 기준을 빠르게 확인할 수 있습니다.
          </Text>
        </View>

        <Pressable
          style={styles.shortcutCard}
          onPress={() => router.push('/(tabs)/transactions')}
        >
          <View style={styles.shortcutIconBubble}>
            <PiggyBank size={22} color={colors.text} strokeWidth={2.8} />
          </View>

          <View style={styles.shortcutTextBox}>
            <Text style={styles.shortcutTitle}>예산과 지출 관리</Text>
            <Text style={styles.shortcutDescription}>
              지출 추가, 카드 내역, 항목별 예산을 확인합니다.
            </Text>
          </View>

          <ChevronRight size={20} color={colors.butterBrown} strokeWidth={2.8} />
        </Pressable>

        <Pressable
          style={styles.shortcutCard}
          onPress={() => router.push('/(tabs)/challenge')}
        >
          <View style={styles.shortcutIconBubble}>
            <Target size={22} color={colors.text} strokeWidth={2.8} />
          </View>

          <View style={styles.shortcutTextBox}>
            <Text style={styles.shortcutTitle}>오늘의 미션 확인</Text>
            <Text style={styles.shortcutDescription}>
              오늘 완료할 소비 미션과 보상을 확인합니다.
            </Text>
          </View>

          <ChevronRight size={20} color={colors.butterBrown} strokeWidth={2.8} />
        </Pressable>

        <GlassCard delay={260} tone="butter" style={styles.budgetSignalCard}>
          <View style={styles.signalTopRow}>
            <View style={styles.signalIconBubble}>
              <TopCategoryIcon size={24} color={colors.text} strokeWidth={2.8} />
            </View>

            <View style={styles.signalTextBox}>
              <Text style={styles.cardLabel}>가장 신경 쓸 항목</Text>
              <Text style={styles.signalTitle}>{topCategory.category_name}</Text>
              <Text style={styles.signalDescription}>
                {getBudgetSignalText(topCategory.budget_pressure)}
              </Text>
            </View>

            <View
              style={[
                styles.signalBadge,
                {
                  backgroundColor: topCategoryBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.signalBadgeText,
                  {
                    color: topCategoryColor,
                  },
                ]}
              >
                {topCategoryLabel}
              </Text>
            </View>
          </View>

          <View style={styles.signalAmountRow}>
            <View>
              <Text style={styles.amountLabel}>월 예산</Text>
              <Text style={styles.amountValue}>
                {formatWon(topCategory.budget_limit)}
              </Text>
            </View>

            <View style={styles.amountRight}>
              <Text style={styles.amountLabel}>월말 예상</Text>
              <Text style={styles.amountValue}>
                {formatWon(topCategory.predicted_monthly_spend)}
              </Text>
            </View>
          </View>

          <AnimatedProgressBar
            progress={topCategory.budget_pressure}
            tone={topCategoryTone}
          />

          <Text style={styles.signalHint}>
            이 항목은 이번 달 예산 관리에서 가장 먼저 확인하면 좋은 항목입니다.
          </Text>
        </GlassCard>

        <GlassCard delay={340} style={styles.appSettingCard}>
          <View style={styles.sectionTitleRow}>
            <Settings size={19} color={colors.butterDeep} strokeWidth={2.8} />
            <Text style={styles.sectionTitle}>앱 설정</Text>
          </View>

          <View style={styles.settingList}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIconBubble}>
                  <Bell size={19} color={colors.text} strokeWidth={2.8} />
                </View>

                <View style={styles.settingTextBox}>
                  <Text style={styles.settingTitle}>알림 받기</Text>
                  <Text style={styles.settingDescription}>
                    중요한 예산 알림을 받아볼게요.
                  </Text>
                </View>
              </View>

              <Switch
                value={pushEnabled}
                onValueChange={handleTogglePush}
                thumbColor={pushEnabled ? colors.butterStrong : '#F4F4F4'}
                trackColor={{
                  true: colors.butterSoft,
                  false: colors.gray200,
                }}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIconBubble}>
                  <Target size={19} color={colors.text} strokeWidth={2.8} />
                </View>

                <View style={styles.settingTextBox}>
                  <Text style={styles.settingTitle}>미션 알림</Text>
                  <Text style={styles.settingDescription}>
                    오늘의 미션을 잊지 않도록 알려드릴게요.
                  </Text>
                </View>
              </View>

              <Switch
                value={missionReminderEnabled}
                onValueChange={handleToggleMissionReminder}
                thumbColor={
                  missionReminderEnabled ? colors.butterStrong : '#F4F4F4'
                }
                trackColor={{
                  true: colors.butterSoft,
                  false: colors.gray200,
                }}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIconBubble}>
                  <CreditCard size={19} color={colors.text} strokeWidth={2.8} />
                </View>

                <View style={styles.settingTextBox}>
                  <Text style={styles.settingTitle}>예산 알림</Text>
                  <Text style={styles.settingDescription}>
                    예산에 가까워지면 미리 알려드릴게요.
                  </Text>
                </View>
              </View>

              <Switch
                value={budgetAlertEnabled}
                onValueChange={handleToggleBudgetAlert}
                thumbColor={budgetAlertEnabled ? colors.butterStrong : '#F4F4F4'}
                trackColor={{
                  true: colors.butterSoft,
                  false: colors.gray200,
                }}
              />
            </View>
          </View>
        </GlassCard>

        <GlassCard delay={420} style={styles.accountCard}>
          <View style={styles.sectionTitleRow}>
            <ShieldCheck size={19} color={colors.butterDeep} strokeWidth={2.8} />
            <Text style={styles.sectionTitle}>계정</Text>
          </View>

          <Pressable style={styles.accountItem}>
            <View>
              <Text style={styles.accountTitle}>개인정보 관리</Text>
              <Text style={styles.accountDescription}>
                이메일과 기본 정보를 수정합니다.
              </Text>
            </View>

            <ChevronRight size={20} color={colors.butterBrown} strokeWidth={2.8} />
          </Pressable>

          <Pressable style={styles.accountItem}>
            <View>
              <Text style={styles.accountTitle}>연동 관리</Text>
              <Text style={styles.accountDescription}>
                카드 내역과 지출 데이터 연결을 관리합니다.
              </Text>
            </View>

            <ChevronRight size={20} color={colors.butterBrown} strokeWidth={2.8} />
          </Pressable>

          <View style={styles.accountSummaryBox}>
            <View>
              <Text style={styles.accountSummaryLabel}>미션에 사용하는 항목</Text>
              <Text style={styles.accountSummaryValue}>
                {missionCategoryCount}개 항목
              </Text>
            </View>

            <Target size={21} color={colors.butterBrown} strokeWidth={2.8} />
          </View>

          <Pressable
            style={styles.logoutButton}
            onPress={() => router.replace('/auth/login')}
          >
            <LogOut size={19} color={colors.text} strokeWidth={2.8} />
            <Text style={styles.logoutText}>로그아웃</Text>
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
    backgroundColor: 'rgba(242, 201, 76, 0.30)',
  },
  backgroundOrbSmall: {
    position: 'absolute',
    top: 220,
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
    marginBottom: 6,
  },
  profileCard: {
    backgroundColor: colors.butterCard,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  avatarBubble: {
    width: 68,
    height: 68,
    borderRadius: 27,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  avatarHighlight: {
    position: 'absolute',
    top: 10,
    left: 14,
    width: 28,
    height: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.30)',
  },
  profileTextBox: {
    flex: 1,
  },
  profileName: {
    fontFamily: typography.fontFamily,
    fontSize: 23,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  profileEmail: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: colors.subText,
  },
  profileBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  profileBadgeText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.butterBrown,
  },
  profileMessage: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: colors.subText,
    marginBottom: 16,
  },
  profileInfoGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  profileInfoItem: {
    flex: 1,
    minHeight: 76,
    borderRadius: 22,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'center',
  },
  profileInfoLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 5,
  },
  profileInfoValue: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  growthCard: {
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
  growthTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  growthLevel: {
    fontFamily: typography.fontFamily,
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.6,
    marginBottom: 5,
  },
  growthDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: colors.subText,
  },
  xpBadge: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.butterPale,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  xpBadgeText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.butterBrown,
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
    textAlign: 'right',
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    color: colors.butterDeep,
  },
  missionStatusBox: {
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 247, 214, 0.72)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  completedMissionStatusBox: {
    backgroundColor: colors.successBg,
    borderColor: 'rgba(82, 123, 50, 0.20)',
  },
  missionStatusText: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
    color: colors.subText,
  },
  completedMissionStatusText: {
    color: colors.successText,
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
  shortcutCard: {
    minHeight: 76,
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 14,
    backgroundColor: colors.whiteCard,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    shadowColor: colors.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  shortcutIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutTextBox: {
    flex: 1,
  },
  shortcutTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
  },
  shortcutDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 18,
    color: colors.subText,
  },
  budgetSignalCard: {
    backgroundColor: colors.butterCard,
  },
  signalTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    marginBottom: 16,
  },
  signalIconBubble: {
    width: 54,
    height: 54,
    borderRadius: 22,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signalTextBox: {
    flex: 1,
  },
  signalTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  signalDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: colors.subText,
  },
  signalBadge: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  signalBadgeText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
  },
  signalAmountRow: {
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
  signalHint: {
    marginTop: 12,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: colors.subText,
  },
  appSettingCard: {
    backgroundColor: colors.whiteCard,
  },
  settingList: {
    gap: 10,
  },
  settingItem: {
    minHeight: 76,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: 'rgba(255, 247, 214, 0.60)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  settingLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTextBox: {
    flex: 1,
  },
  settingTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.subText,
  },
  accountCard: {
    backgroundColor: colors.whiteCard,
  },
  accountItem: {
    minHeight: 70,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 247, 214, 0.56)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  accountTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
  },
  accountDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.subText,
  },
  accountSummaryBox: {
    minHeight: 64,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 247, 214, 0.56)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  accountSummaryLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    color: colors.subText,
    marginBottom: 4,
  },
  accountSummaryValue: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  logoutButton: {
    height: 56,
    borderRadius: 22,
    backgroundColor: colors.butterStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 6,
  },
  logoutText: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
});