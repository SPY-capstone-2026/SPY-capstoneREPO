import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { deleteAccessToken } from '@/services/tokenStorage';
import { getCurrentUser, updateCurrentUser, } from '@/services/authService';
import type { MeResponse } from '@/types/api';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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
import { useCallback, useState } from 'react';

import { AnimatedProgressBar } from '@/components/AnimatedProgressBar';
import { AppScreenHeader } from '@/components/AppScreenHeader';
import { GlassCard } from '@/components/GlassCard';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import {
  mockCategorySettings,
  mockUserProfile,
} from '@/constants/mockAiResult';
import { useMission } from '@/contexts/MissionContext';
import { useToast } from '@/contexts/ToastContext';

function getIncomeTypeLabel(incomeType: string) {
  if (incomeType === 'STUDENT') return '학생';
  if (incomeType === 'EMPLOYEE') return '직장인';
  if (incomeType === 'FREELANCER') return '프리랜서';
  return '기타';
}

function getSpendProfileLabel(profile: string) {
  if (profile === 'STEADY') return '안정형';
  if (profile === 'IMPULSIVE') return '즉흥 소비형';
  if (profile === 'CYCLICAL') return '주기 소비형';
  return '맞춤형';
}

function getProfileMessage(profile: string) {
  if (profile === 'IMPULSIVE') {
    return '작은 미션으로 갑작스러운 소비를 천천히 줄여볼 수 있어요.';
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

  const handleStartEditProfile = () => {
    setEditEmail(user.email);
    setEditIncomeType(user.income_type);
    setEditPayday(String(user.payday));
    setEditSpendProfile(user.spend_profile);
    setIsEditingProfile(true);
  };

  const [user, setUser] = useState<MeResponse>({
    user_id: '',
    email: '',
    income_type: 'STUDENT',
    payday: 25,
    spend_profile: 'IMPULSIVE',
    total_xp: 0,
    current_level: 1,
    created_at: null,
  });

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [editEmail, setEditEmail] = useState('');
  const [editIncomeType, setEditIncomeType] = useState('STUDENT');
  const [editPayday, setEditPayday] = useState('25');
  const [editSpendProfile, setEditSpendProfile] = useState('IMPULSIVE');

  const loadUserProfile = async () => {
    try {
      setIsUserLoading(true);

      const currentUser = await getCurrentUser();

      setUser(currentUser);
      setEditEmail(currentUser.email);
      setEditIncomeType(currentUser.income_type);
      setEditPayday(String(currentUser.payday));
      setEditSpendProfile(currentUser.spend_profile);
    } catch {
      showToast('내 정보를 불러오지 못했어요.');
    } finally {
      setIsUserLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadUserProfile();
    }, [])
  );

  const [isUserLoading, setIsUserLoading] = useState(false);

  const { showToast } = useToast();

  const {
    currentStreak,
    weeklyCompletedCount,
    isTodayMissionCompleted,
  } = useMission();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [missionReminderEnabled, setMissionReminderEnabled] = useState(true);
  const [budgetAlertEnabled, setBudgetAlertEnabled] = useState(true);

  const currentXp = user.total_xp;
  const currentLevel = user.current_level;
  const levelBaseXp = Math.max(0, (currentLevel - 1) * 100);
  const nextLevelXp = currentLevel * 100;
  const levelProgress =
    nextLevelXp > levelBaseXp
      ? Math.min((currentXp - levelBaseXp) / (nextLevelXp - levelBaseXp), 1)
      : 0;
  const xpToNextLevel = Math.max(0, nextLevelXp - currentXp);

  const missionCategoryCount = mockCategorySettings.filter(
    (item) => item.is_daily_challenge
  ).length;

  const handleSaveProfile = async () => {
    const parsedPayday = Number(editPayday);

    if (!editEmail.trim()) {
      showToast('이메일을 입력해 주세요.');
      return;
    }

    if (!Number.isInteger(parsedPayday) || parsedPayday < 1 || parsedPayday > 31) {
      showToast('수입일은 1일부터 31일 사이로 입력해 주세요.');
      return;
    }

    try {
      setIsSavingProfile(true);

      const updatedUser = await updateCurrentUser({
        email: editEmail.trim(),
        income_type: editIncomeType,
        payday: parsedPayday,
        spend_profile: editSpendProfile,
      });

      setUser(updatedUser);
      setIsEditingProfile(false);
      showToast('개인정보가 저장됐어요.');
    } catch {
      showToast('개인정보를 저장하지 못했어요.');
    } finally {
      setIsSavingProfile(false);
    }
  };

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

  const handleLogout = async () => {
  await deleteAccessToken();
  showToast('로그아웃되었습니다.');
  router.replace('/auth/login');
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
          label="MY"
          title="내 소비 습관과 설정을 관리해요."
          description={
            isUserLoading
              ? '내 정보를 불러오고 있어요.'
              : '프로필, 미션 성장 상태, 알림 설정을 한곳에서 확인할 수 있습니다.'
          }
          Icon={UserRound}
        />

        <GlassCard delay={80} tone="butter" style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatarBubble}>
              <UserRound size={32} color={colors.text} strokeWidth={2.8} />
            </View>

            <View style={styles.profileTextBox}>
              <Text style={styles.cardLabel}>내 프로필</Text>
              <Text style={styles.profileName}>Moni 사용자</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>

            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>Lv. {currentLevel}</Text>
            </View>
          </View>

          <Text style={styles.profileMessage}>
            {getProfileMessage(user.spend_profile)}
          </Text>

          <View style={styles.profileInfoRow}>
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
            <Trophy size={18} color={colors.butterDeep} strokeWidth={2.8} />
            <Text style={styles.sectionTitle}>성장 상태</Text>
          </View>

          <View style={styles.growthMainRow}>
            <View>
              <Text style={styles.growthLevel}>Lv. {currentLevel}</Text>
              <Text style={styles.growthDescription}>
                {xpToNextLevel <= 0
                  ? '새로운 레벨에 도달했어요.'
                  : `다음 레벨까지 ${xpToNextLevel} XP 남았습니다.`}
              </Text>
            </View>

            <View style={styles.xpBadge}>
              <Sparkles size={15} color={colors.butterBrown} strokeWidth={2.8} />
              <Text style={styles.xpBadgeText}>{currentXp} XP</Text>
            </View>
          </View>

          <AnimatedProgressBar progress={levelProgress} tone="warning" />

          <View style={styles.growthStatsRow}>
            <View style={styles.growthStatItem}>
              <Text style={styles.growthStatLabel}>연속 성공</Text>
              <Text style={styles.growthStatValue}>{currentStreak}일</Text>
            </View>

            <View style={styles.growthStatItem}>
              <Text style={styles.growthStatLabel}>이번 주 완료</Text>
              <Text style={styles.growthStatValue}>
                {weeklyCompletedCount}개
              </Text>
            </View>

            <View style={styles.growthStatItem}>
              <Text style={styles.growthStatLabel}>오늘 미션</Text>
              <Text style={styles.growthStatValue}>
                {isTodayMissionCompleted ? '완료' : '진행 중'}
              </Text>
            </View>
          </View>
        </GlassCard>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>자주 쓰는 메뉴</Text>
          <Text style={styles.sectionSubtitle}>
            자주 확인하는 기능만 먼저 모았습니다.
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
            <Text style={styles.shortcutTitle}>지출과 예산 관리</Text>
            <Text style={styles.shortcutDescription}>
              지출 추가, 최근 내역, 항목별 예산을 확인합니다.
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
            <Text style={styles.shortcutTitle}>오늘의 미션</Text>
            <Text style={styles.shortcutDescription}>
              오늘 완료할 소비 미션과 보상을 확인합니다.
            </Text>
          </View>

          <ChevronRight size={20} color={colors.butterBrown} strokeWidth={2.8} />
        </Pressable>

        <GlassCard delay={260} style={styles.settingCard}>
          <View style={styles.sectionTitleRow}>
            <Settings size={18} color={colors.butterDeep} strokeWidth={2.8} />
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
                    중요한 알림을 받아볼게요.
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

        <GlassCard delay={340} style={styles.accountCard}>
          <View style={styles.sectionTitleRow}>
            <ShieldCheck size={18} color={colors.butterDeep} strokeWidth={2.8} />
            <Text style={styles.sectionTitle}>계정</Text>
          </View>

                    <View style={styles.accountEditSection}>
                      <Pressable style={styles.accountItem} onPress={handleStartEditProfile}>
                        <View>
                          <Text style={styles.accountTitle}>개인정보 관리</Text>
                          <Text style={styles.accountDescription}>
                            이메일과 기본 정보를 수정합니다.
                          </Text>
                        </View>

                        <ChevronRight size={20} color={colors.butterBrown} strokeWidth={2.8} />
                      </Pressable>

                      {isEditingProfile ? (
                        <View style={styles.editProfileBox}>
                          <Text style={styles.editLabel}>이메일</Text>
                          <TextInput
                            style={styles.editInput}
                            value={editEmail}
                            onChangeText={setEditEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            placeholder="이메일"
                            placeholderTextColor={colors.mutedText}
                          />

                          <Text style={styles.editLabel}>수입 유형</Text>
                          <View style={styles.editOptionRow}>
                            {['STUDENT', 'EMPLOYEE'].map((option) => (
                              <Pressable
                                key={option}
                                style={[
                                  styles.editOptionButton,
                                  editIncomeType === option && styles.selectedEditOptionButton,
                                ]}
                                onPress={() => setEditIncomeType(option)}
                              >
                                <Text
                                  style={[
                                    styles.editOptionText,
                                    editIncomeType === option && styles.selectedEditOptionText,
                                  ]}
                                >
                                  {getIncomeTypeLabel(option)}
                                </Text>
                              </Pressable>
                            ))}
                          </View>

                          <Text style={styles.editLabel}>수입일</Text>
                          <TextInput
                            style={styles.editInput}
                            value={editPayday}
                            onChangeText={setEditPayday}
                            keyboardType="number-pad"
                            placeholder="예: 25"
                            placeholderTextColor={colors.mutedText}
                          />

                          <Text style={styles.editLabel}>소비 성향</Text>
                          <View style={styles.editOptionColumn}>
                            {['STEADY', 'IMPULSIVE', 'CYCLICAL'].map((option) => (
                              <Pressable
                                key={option}
                                style={[
                                  styles.editOptionButton,
                                  editSpendProfile === option && styles.selectedEditOptionButton,
                                ]}
                                onPress={() => setEditSpendProfile(option)}
                              >
                                <Text
                                  style={[
                                    styles.editOptionText,
                                    editSpendProfile === option && styles.selectedEditOptionText,
                                  ]}
                                >
                                  {getSpendProfileLabel(option)}
                                </Text>
                              </Pressable>
                            ))}
                          </View>

                          <View style={styles.editActionRow}>
                            <Pressable
                              style={styles.cancelEditButton}
                              onPress={() => setIsEditingProfile(false)}
                            >
                              <Text style={styles.cancelEditButtonText}>취소</Text>
                            </Pressable>

                            <Pressable
                              style={styles.saveEditButton}
                              onPress={handleSaveProfile}
                              disabled={isSavingProfile}
                            >
                              <Text style={styles.saveEditButtonText}>
                                {isSavingProfile ? '저장 중...' : '저장'}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : null}
                    </View>

          <Pressable style={styles.accountItem}>
            <View>
              <Text style={styles.accountTitle}>연동 관리</Text>
              <Text style={styles.accountDescription}>
                카드 내역과 지출 데이터 연결을 관리합니다.
              </Text>
            </View>

            <ChevronRight size={20} color={colors.butterBrown} strokeWidth={2.8} />
          </Pressable>

          <View style={styles.accountSummaryLine}>
            <Target size={16} color={colors.butterBrown} strokeWidth={2.8} />
            <Text style={styles.accountSummaryText}>
              현재 {missionCategoryCount}개 항목이 미션에 사용됩니다.
            </Text>
          </View>

          <Pressable style={styles.logoutButton} onPress={handleLogout}>
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
    backgroundColor: 'rgba(242, 201, 76, 0.28)',
  },
  backgroundOrbSmall: {
    position: 'absolute',
    top: 220,
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
  profileCard: {
    backgroundColor: 'rgba(255,248,216,0.42)',
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  avatarBubble: {
    width: 66,
    height: 66,
    borderRadius: 26,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTextBox: {
    flex: 1,
  },
  cardLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 6,
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
  levelBadge: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.butterPale,
  },
  levelBadgeText: {
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
  profileInfoRow: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122,111,91,0.14)',
    flexDirection: 'row',
    gap: 14,
  },
  profileInfoItem: {
    flex: 1,
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
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
    profileEditButton: {
    height: 48,
    borderRadius: 18,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  profileEditButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  editProfileBox: {
    marginTop: 14,
    gap: 9,
  },
  editLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.subText,
  },
  editInput: {
    minHeight: 50,
    borderRadius: 17,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: colors.text,
  },
  editOptionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  editOptionColumn: {
    gap: 8,
  },
  editOptionButton: {
    minHeight: 44,
    borderRadius: 16,
    paddingHorizontal: 13,
    backgroundColor: 'rgba(255,255,255,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedEditOptionButton: {
    backgroundColor: colors.butterStrong,
    borderColor: 'rgba(215,169,0,0.28)',
  },
  editOptionText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.subText,
  },
  selectedEditOptionText: {
    color: colors.text,
  },
  editActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelEditButton: {
    flex: 1,
    height: 48,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelEditButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    color: colors.subText,
  },
  saveEditButton: {
    flex: 1,
    height: 48,
    borderRadius: 18,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveEditButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  growthCard: {
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
  growthMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
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
  growthStatsRow: {
    paddingTop: 14,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122,111,91,0.14)',
    flexDirection: 'row',
    gap: 14,
  },
  growthStatItem: {
    flex: 1,
  },
  growthStatLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    color: colors.subText,
    marginBottom: 5,
  },
  growthStatValue: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
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
  shortcutCard: {
    minHeight: 72,
    borderRadius: 23,
    paddingHorizontal: 15,
    paddingVertical: 13,
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  shortcutIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 17,
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
  settingCard: {
    backgroundColor: 'rgba(255,255,255,0.36)',
  },
  settingList: {
    gap: 14,
  },
  settingItem: {
    minHeight: 58,
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
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: colors.butterPale,
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
    backgroundColor: 'rgba(255,255,255,0.36)',
  },
  accountItem: {
    minHeight: 62,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122,111,91,0.14)',
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  accountEditSection: {
  borderBottomWidth: 1,
  borderBottomColor: 'rgba(122,111,91,0.12)',
  paddingBottom: 12,
  marginBottom: 2,
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
  accountSummaryLine: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122,111,91,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 12,
  },
  accountSummaryText: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: colors.subText,
  },
  logoutButton: {
    height: 54,
    borderRadius: 21,
    backgroundColor: colors.butterStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  logoutText: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
});