import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  Bell,
  ChevronRight,
  CreditCard,
  LogOut,
  Pencil,
  Settings,
  ShieldCheck,
  Target,
  UserRound,
  WalletCards,
} from 'lucide-react-native';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppScreenHeader } from '@/components/AppScreenHeader';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { useToast } from '@/contexts/ToastContext';
import { getCurrentUser, updateCurrentUser } from '@/services/authService';
import { getCategoriesFromApi } from '@/services/categoryService';
import {
  DEFAULT_APP_PREFERENCES,
  getAppPreferences,
  saveAppPreferences,
  type AppPreferences,
} from '@/services/preferenceStorage';
import { deleteAccessToken } from '@/services/tokenStorage';
import type { MeResponse } from '@/types/api';

const emptyUser: MeResponse = {
  user_id: '',
  email: '',
  income_type: 'STUDENT',
  payday: 25,
  spend_profile: 'STEADY',
  total_xp: 0,
  current_level: 1,
  current_points: 0,
  created_at: null,
};

const INCOME_TYPES = [
  ['STUDENT', '학생'],
  ['EMPLOYEE', '직장인'],
  ['FREELANCER', '프리랜서'],
  ['OTHER', '기타'],
] as const;

const SPEND_PROFILES = [
  ['STEADY', '안정형'],
  ['IMPULSIVE', '즉흥 소비형'],
  ['CYCLICAL', '주기 소비형'],
] as const;

function getIncomeTypeLabel(value: string) {
  return INCOME_TYPES.find(([key]) => key === value)?.[1] ?? '기타';
}

function getSpendProfileLabel(value: string) {
  return SPEND_PROFILES.find(([key]) => key === value)?.[1] ?? '맞춤형';
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

export default function MyPageScreen() {
  const { showToast } = useToast();

  const [user, setUser] = useState<MeResponse>(emptyUser);
  const [isLoading, setIsLoading] = useState(false);

  const [preferences, setPreferences] = useState<AppPreferences>(
    DEFAULT_APP_PREFERENCES
  );

  const [categorySummary, setCategorySummary] = useState({
    total: 0,
    challengeEnabled: 0,
    averageAlertThreshold: 0,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editEmail, setEditEmail] = useState('');
  const [editIncomeType, setEditIncomeType] = useState('STUDENT');
  const [editPayday, setEditPayday] = useState('25');
  const [editSpendProfile, setEditSpendProfile] = useState('STEADY');

  const levelProgress = useMemo(() => {
    if (user.current_level >= 50) return 1;

    const base = cumulativeXpForLevel(user.current_level);
    const needed = xpRequiredForLevel(user.current_level);
    const current = Math.max(0, user.total_xp - base);

    return needed > 0 ? Math.min(current / needed, 1) : 1;
  }, [user.current_level, user.total_xp]);

  const xpToNext = useMemo(() => {
    if (user.current_level >= 50) return 0;

    const base = cumulativeXpForLevel(user.current_level);
    const needed = xpRequiredForLevel(user.current_level);
    const current = Math.max(0, user.total_xp - base);

    return Math.max(0, needed - current);
  }, [user.current_level, user.total_xp]);

  const loadPage = useCallback(async () => {
    try {
      setIsLoading(true);

      const [userResult, categoriesResult, preferenceResult] =
        await Promise.allSettled([
          getCurrentUser(),
          getCategoriesFromApi(),
          getAppPreferences(),
        ]);

      if (userResult.status === 'fulfilled') {
        setUser(userResult.value);
      } else {
        showToast('내 정보를 불러오지 못했어요.');
      }

      if (categoriesResult.status === 'fulfilled') {
        const categories = categoriesResult.value;
        const challengeEnabled = categories.filter(
          (item) => item.is_daily_challenge
        ).length;

        const averageAlertThreshold =
          categories.length > 0
            ? Math.round(
                categories.reduce(
                  (sum, item) => sum + Number(item.alert_threshold ?? 0),
                  0
                ) / categories.length
              )
            : 0;

        setCategorySummary({
          total: categories.length,
          challengeEnabled,
          averageAlertThreshold,
        });
      }

      if (preferenceResult.status === 'fulfilled') {
        setPreferences(preferenceResult.value);
      }
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      loadPage();
    }, [loadPage])
  );

  const startEdit = () => {
    setEditEmail(user.email);
    setEditIncomeType(user.income_type);
    setEditPayday(String(user.payday));
    setEditSpendProfile(user.spend_profile);
    setIsEditing(true);
  };

  const saveProfile = async () => {
    const payday = Number(editPayday);

    if (!editEmail.trim()) {
      showToast('이메일을 입력해 주세요.');
      return;
    }

    if (!Number.isInteger(payday) || payday < 1 || payday > 31) {
      showToast('수입일은 1일부터 31일 사이로 입력해 주세요.');
      return;
    }

    try {
      setIsSaving(true);

      const updated = await updateCurrentUser({
        email: editEmail.trim(),
        income_type: editIncomeType,
        payday,
        spend_profile: editSpendProfile,
      });

      setUser(updated);
      setIsEditing(false);
      showToast('프로필을 저장했어요.');
    } catch {
      showToast('프로필을 저장하지 못했어요.');
    } finally {
      setIsSaving(false);
    }
  };

  const updatePreference = async (
    key: keyof AppPreferences,
    value: boolean
  ) => {
    const next = {
      ...preferences,
      [key]: value,
    };

    setPreferences(next);

    try {
      await saveAppPreferences(next);
    } catch {
      setPreferences(preferences);
      showToast('설정을 저장하지 못했어요.');
    }
  };

  const logout = async () => {
    await deleteAccessToken();
    showToast('로그아웃되었습니다.');
    router.replace('/auth/login');
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <AppScreenHeader
          label="MY"
          title="내 정보와 설정"
          description={
            isLoading
              ? '설정을 불러오고 있어요.'
              : '프로필, 예산·챌린지 기준, 알림 설정을 관리해요.'
          }
          Icon={UserRound}
        />

        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatar}>
              <UserRound size={25} color={colors.text} strokeWidth={2.5} />
            </View>

            <View style={styles.profileCopy}>
              <Text style={styles.email}>{user.email || 'Moni 사용자'}</Text>
              <Text style={styles.profileMeta}>
                {getIncomeTypeLabel(user.income_type)} ·{' '}
                {getSpendProfileLabel(user.spend_profile)} · 매월 {user.payday}일
              </Text>
            </View>

            <Pressable
              onPress={startEdit}
              style={({ pressed }) => [
                styles.editButton,
                pressed && styles.pressed,
              ]}
            >
              <Pencil size={16} color={colors.text} strokeWidth={2.4} />
            </Pressable>
          </View>
        </View>

        <View style={styles.growthCard}>
          <View style={styles.growthTop}>
            <View>
              <Text style={styles.cardLabel}>성장 상태</Text>
              <Text style={styles.level}>Lv.{user.current_level}</Text>
            </View>

            <View style={styles.pointPill}>
              <WalletCards
                size={15}
                color={colors.butterDeep}
                strokeWidth={2.4}
              />
              <Text style={styles.pointText}>{user.current_points}P</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(levelProgress * 100)}%` },
              ]}
            />
          </View>

          <View style={styles.progressMeta}>
            <Text style={styles.progressText}>{user.total_xp} XP 누적</Text>
            <Text style={styles.progressText}>
              다음 레벨까지 {xpToNext} XP
            </Text>
          </View>

          <Text style={styles.rewardNote}>
            레벨업 시 50P, 5레벨 단위에는 추가 100P와 전용 보상이 지급될 수 있어요.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>소비·챌린지 설정</Text>

        <Pressable
          style={({ pressed }) => [
            styles.navigationCard,
            pressed && styles.pressed,
          ]}
          onPress={() => router.push('/(tabs)/transactions')}
        >
          <View style={styles.navIcon}>
            <CreditCard size={20} color={colors.text} strokeWidth={2.5} />
          </View>

          <View style={styles.navCopy}>
            <Text style={styles.navTitle}>예산과 챌린지 대상 관리</Text>
            <Text style={styles.navDescription}>
              카테고리별 월 예산, 챌린지 포함 여부, 예산 알림 기준을 수정해요.
            </Text>

            <View style={styles.summaryChips}>
              <Text style={styles.summaryChip}>
                카테고리 {categorySummary.total}개
              </Text>
              <Text style={styles.summaryChip}>
                챌린지 {categorySummary.challengeEnabled}개
              </Text>
              {categorySummary.averageAlertThreshold > 0 ? (
                <Text style={styles.summaryChip}>
                  평균 알림 {categorySummary.averageAlertThreshold}%
                </Text>
              ) : null}
            </View>
          </View>

          <ChevronRight size={18} color={colors.mutedText} strokeWidth={2.5} />
        </Pressable>

        <Text style={styles.sectionTitle}>앱 설정</Text>

        <View style={styles.settingsCard}>
          <SettingSwitch
            Icon={Bell}
            title="알림 받기"
            description="Moni의 주요 알림을 표시할지 정해요."
            value={preferences.pushEnabled}
            onChange={(value) => updatePreference('pushEnabled', value)}
          />

          <SettingSwitch
            Icon={Target}
            title="챌린지 알림"
            description="오늘의 챌린지를 확인할 수 있도록 알림 표시 여부를 저장해요."
            value={preferences.challengeReminderEnabled}
            onChange={(value) =>
              updatePreference('challengeReminderEnabled', value)
            }
          />

          <SettingSwitch
            Icon={CreditCard}
            title="예산 알림"
            description="카테고리별 경고 기준에 도달했을 때 알림 표시 여부를 저장해요."
            value={preferences.budgetAlertEnabled}
            onChange={(value) => updatePreference('budgetAlertEnabled', value)}
            last
          />

          <View style={styles.localSettingNote}>
            <Settings size={14} color={colors.mutedText} strokeWidth={2.4} />
            <Text style={styles.localSettingText}>
              알림 구독 API가 아직 없어 위 3개는 이 기기에 저장됩니다. 예산 금액·알림
              기준·챌린지 대상은 서버에 저장됩니다.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>계정</Text>

        <View style={styles.accountCard}>
          <Pressable
            style={({ pressed }) => [
              styles.accountItem,
              pressed && styles.pressed,
            ]}
            onPress={startEdit}
          >
            <View style={styles.accountIcon}>
              <ShieldCheck size={19} color={colors.text} strokeWidth={2.5} />
            </View>
            <View style={styles.accountCopy}>
              <Text style={styles.accountTitle}>개인정보 관리</Text>
              <Text style={styles.accountDescription}>
                이메일, 수입 유형, 수입일, 소비 성향을 수정해요.
              </Text>
            </View>
            <ChevronRight size={18} color={colors.mutedText} strokeWidth={2.5} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.accountItem,
              styles.accountItemBorder,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push('/(tabs)/transactions')}
          >
            <View style={styles.accountIcon}>
              <CreditCard size={19} color={colors.text} strokeWidth={2.5} />
            </View>
            <View style={styles.accountCopy}>
              <Text style={styles.accountTitle}>지출 데이터 관리</Text>
              <Text style={styles.accountDescription}>
                직접 입력한 지출 내역과 분류를 확인하고 수정해요.
              </Text>
            </View>
            <ChevronRight size={18} color={colors.mutedText} strokeWidth={2.5} />
          </Pressable>
        </View>

        <Pressable
          onPress={logout}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.pressed,
          ]}
        >
          <LogOut size={18} color={colors.subText} strokeWidth={2.4} />
          <Text style={styles.logoutText}>로그아웃</Text>
        </Pressable>
      </ScrollView>

      <ProfileEditModal
        visible={isEditing}
        saving={isSaving}
        email={editEmail}
        incomeType={editIncomeType}
        payday={editPayday}
        spendProfile={editSpendProfile}
        setEmail={setEditEmail}
        setIncomeType={setEditIncomeType}
        setPayday={setEditPayday}
        setSpendProfile={setEditSpendProfile}
        onCancel={() => setIsEditing(false)}
        onSave={saveProfile}
      />
    </View>
  );
}

type SettingSwitchProps = {
  Icon: typeof Bell;
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  last?: boolean;
};

function SettingSwitch({
  Icon,
  title,
  description,
  value,
  onChange,
  last = false,
}: SettingSwitchProps) {
  return (
    <View style={[styles.settingItem, last && styles.settingItemLast]}>
      <View style={styles.settingIcon}>
        <Icon size={18} color={colors.text} strokeWidth={2.5} />
      </View>

      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>

      <Switch
        value={value}
        onValueChange={onChange}
        thumbColor={value ? colors.butterStrong : '#F4F4F4'}
        trackColor={{
          true: colors.butterSoft,
          false: colors.gray200,
        }}
      />
    </View>
  );
}

type ProfileEditModalProps = {
  visible: boolean;
  saving: boolean;
  email: string;
  incomeType: string;
  payday: string;
  spendProfile: string;
  setEmail: (value: string) => void;
  setIncomeType: (value: string) => void;
  setPayday: (value: string) => void;
  setSpendProfile: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

function ProfileEditModal({
  visible,
  saving,
  email,
  incomeType,
  payday,
  spendProfile,
  setEmail,
  setIncomeType,
  setPayday,
  setSpendProfile,
  onCancel,
  onSave,
}: ProfileEditModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>개인정보 관리</Text>
          <Text style={styles.modalDescription}>
            AI 분석과 챌린지에 사용하는 기본 정보를 확인하고 수정해요.
          </Text>

          <Text style={styles.editLabel}>이메일</Text>
          <TextInput
            style={styles.editInput}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="이메일"
            placeholderTextColor={colors.mutedText}
          />

          <Text style={styles.editLabel}>수입 유형</Text>
          <View style={styles.optionWrap}>
            {INCOME_TYPES.map(([key, label]) => (
              <Pressable
                key={key}
                style={[
                  styles.optionButton,
                  incomeType === key && styles.optionButtonSelected,
                ]}
                onPress={() => setIncomeType(key)}
              >
                <Text
                  style={[
                    styles.optionText,
                    incomeType === key && styles.optionTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.editLabel}>수입일</Text>
          <TextInput
            style={styles.editInput}
            value={payday}
            onChangeText={setPayday}
            keyboardType="number-pad"
            placeholder="예: 25"
            placeholderTextColor={colors.mutedText}
          />

          <Text style={styles.editLabel}>소비 성향</Text>
          <View style={styles.optionWrap}>
            {SPEND_PROFILES.map(([key, label]) => (
              <Pressable
                key={key}
                style={[
                  styles.optionButton,
                  spendProfile === key && styles.optionButtonSelected,
                ]}
                onPress={() => setSpendProfile(key)}
              >
                <Text
                  style={[
                    styles.optionText,
                    spendProfile === key && styles.optionTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.modalActions}>
            <Pressable style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>취소</Text>
            </Pressable>
            <Pressable
              style={styles.saveButton}
              onPress={onSave}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? '저장 중...' : '저장'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 15,
    marginBottom: 10,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCopy: {
    flex: 1,
  },
  email: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  profileMeta: {
    marginTop: 4,
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.subText,
  },
  editButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  growthCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    marginBottom: 22,
  },
  growthTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '900',
    color: colors.mutedText,
    marginBottom: 3,
  },
  level: {
    fontFamily: typography.fontFamily,
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  pointPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: colors.butterPale,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pointText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.butterDeep,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
    marginTop: 14,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.butterStrong,
  },
  progressMeta: {
    marginTop: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  progressText: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    color: colors.subText,
  },
  rewardNote: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    lineHeight: 16,
    color: colors.mutedText,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 9,
    marginTop: 2,
  },
  navigationCard: {
    minHeight: 88,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 22,
  },
  navIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCopy: {
    flex: 1,
  },
  navTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 13.5,
    fontWeight: '900',
    color: colors.text,
  },
  navDescription: {
    marginTop: 3,
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.subText,
  },
  summaryChips: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  summaryChip: {
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontFamily: typography.fontFamily,
    fontSize: 9,
    fontWeight: '800',
    color: colors.subText,
  },
  settingsCard: {
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginBottom: 22,
  },
  settingItem: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingCopy: {
    flex: 1,
  },
  settingTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    fontWeight: '900',
    color: colors.text,
  },
  settingDescription: {
    marginTop: 2,
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    lineHeight: 14,
    color: colors.subText,
  },
  localSettingNote: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.surfaceSoft,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  localSettingText: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    lineHeight: 14,
    color: colors.mutedText,
  },
  accountCard: {
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  accountItem: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
  },
  accountItemBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  accountIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCopy: {
    flex: 1,
  },
  accountTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    fontWeight: '900',
    color: colors.text,
  },
  accountDescription: {
    marginTop: 2,
    fontFamily: typography.fontFamily,
    fontSize: 9.5,
    lineHeight: 14,
    color: colors.subText,
  },
  logoutButton: {
    marginTop: 14,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  logoutText: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    fontWeight: '900',
    color: colors.subText,
  },
  pressed: {
    opacity: 0.72,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.24)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    maxHeight: '92%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
  },
  modalTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
  },
  modalDescription: {
    marginTop: 4,
    marginBottom: 16,
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.subText,
  },
  editLabel: {
    marginTop: 11,
    marginBottom: 6,
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.subText,
  },
  editInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 12,
    fontFamily: typography.fontFamily,
    fontSize: 12,
    color: colors.text,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  optionButton: {
    minHeight: 40,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionButtonSelected: {
    backgroundColor: colors.butterPale,
    borderColor: colors.butterSoft,
  },
  optionText: {
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.subText,
  },
  optionTextSelected: {
    color: colors.butterDeep,
  },
  modalActions: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.subText,
  },
  saveButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
  },
});
