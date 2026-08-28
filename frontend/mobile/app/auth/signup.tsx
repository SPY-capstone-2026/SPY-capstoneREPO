import { router } from 'expo-router';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  LockKeyhole,
  Mail,
  UserRound,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { WanderingMascot } from '@/components/mascot';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { useToast } from '@/contexts/ToastContext';
import { ApiError } from '@/services/apiClient';
import { signupUser } from '@/services/authService';

const incomeOptions = [
  { label: '학생', value: 'STUDENT' },
  { label: '직장인', value: 'EMPLOYEE' },
] as const;

const profileOptions = [
  { label: '안정형', value: 'STEADY', description: '소비가 비교적 일정해요.' },
  { label: '즉흥 소비형', value: 'IMPULSIVE', description: '갑자기 쓰는 돈이 많은 편이에요.' },
  { label: '주기 소비형', value: 'CYCLICAL', description: '특정 시기에 소비가 커지는 편이에요.' },
] as const;

function getSignupErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409) return '이미 가입된 이메일입니다.';
    if (error.status === 422) return '입력한 회원가입 정보 형식을 확인해 주세요.';
    return error.message || '회원가입에 실패했습니다.';
  }

  if (error instanceof TypeError) {
    return '서버에 연결할 수 없습니다. 네트워크 또는 CORS 설정을 확인해 주세요.';
  }

  return '회원가입 중 문제가 발생했습니다.';
}

export default function SignupScreen() {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [incomeType, setIncomeType] = useState<(typeof incomeOptions)[number]['value']>('STUDENT');
  const [payday, setPayday] = useState('25');
  const [spendProfile, setSpendProfile] = useState<(typeof profileOptions)[number]['value']>('IMPULSIVE');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async () => {
    if (isLoading) return;
    if (!email.trim()) {
      showToast('이메일을 입력해 주세요.');
      return;
    }
    if (!password.trim()) {
      showToast('비밀번호를 입력해 주세요.');
      return;
    }

    const parsedPayday = Number(payday);
    if (!Number.isInteger(parsedPayday) || parsedPayday < 1 || parsedPayday > 31) {
      showToast('수입일은 1일부터 31일 사이로 입력해 주세요.');
      return;
    }

    try {
      setIsLoading(true);
      await signupUser(email.trim(), password, {
        income_type: incomeType,
        payday: parsedPayday,
        spend_profile: spendProfile,
      });
      showToast('회원가입이 완료되었습니다. 로그인해 주세요.');
      router.replace('/auth/login');
    } catch (error) {
      showToast(getSignupErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="로그인으로 돌아가기"
            disabled={isLoading}
            onPress={() => router.replace('/auth/login')}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft size={18} color={colors.text} strokeWidth={2.6} />
            <Text style={styles.backText}>로그인</Text>
          </Pressable>

          <View style={styles.brandArea}>
            <View style={styles.signupMascotWrap}>
              <WanderingMascot
                enabled={false}
                motionEnabled
                size={88}
                state="idle"
                style={styles.fixedMascotMotion}
              />
            </View>
            <Text style={styles.brand}>MONI</Text>
            <Text style={styles.title}>나에게 맞는 소비 기준을 준비해요.</Text>
            <Text style={styles.subtitle}>
              계정 정보와 기본 소비 성향만 설정하면 바로 시작할 수 있어요.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>계정 정보</Text>
            <View style={styles.field}>
              <Mail size={18} color={colors.subText} strokeWidth={2.4} />
              <TextInput
                style={styles.input}
                placeholder="이메일"
                placeholderTextColor={colors.mutedText}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
              />
            </View>
            <View style={styles.field}>
              <LockKeyhole size={18} color={colors.subText} strokeWidth={2.4} />
              <TextInput
                style={styles.input}
                placeholder="비밀번호"
                placeholderTextColor={colors.mutedText}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                editable={!isLoading}
              />
            </View>

            <Text style={styles.sectionTitle}>수입 유형</Text>
            <View style={styles.optionRow}>
              {incomeOptions.map((option) => {
                const selected = incomeType === option.value;
                return (
                  <Pressable
                    key={option.value}
                    disabled={isLoading}
                    onPress={() => setIncomeType(option.value)}
                    style={[styles.optionChip, selected && styles.optionChipSelected]}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {option.label}
                    </Text>
                    {selected ? <Check size={15} color={colors.text} strokeWidth={3} /> : null}
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>수입일</Text>
            <View style={styles.field}>
              <CalendarDays size={18} color={colors.subText} strokeWidth={2.4} />
              <TextInput
                style={styles.input}
                placeholder="예: 25"
                placeholderTextColor={colors.mutedText}
                keyboardType="number-pad"
                value={payday}
                onChangeText={setPayday}
                editable={!isLoading}
              />
              <Text style={styles.suffix}>일</Text>
            </View>

            <Text style={styles.sectionTitle}>소비 성향</Text>
            <View style={styles.profileList}>
              {profileOptions.map((option) => {
                const selected = spendProfile === option.value;
                return (
                  <Pressable
                    key={option.value}
                    disabled={isLoading}
                    onPress={() => setSpendProfile(option.value)}
                    style={[styles.profileOption, selected && styles.profileOptionSelected]}
                  >
                    <View style={styles.profileIcon}>
                      <UserRound size={18} color={colors.text} strokeWidth={2.5} />
                    </View>
                    <View style={styles.profileCopy}>
                      <Text style={styles.profileTitle}>{option.label}</Text>
                      <Text style={styles.profileDescription}>{option.description}</Text>
                    </View>
                    {selected ? (
                      <View style={styles.checkCircle}>
                        <Check size={14} color={colors.text} strokeWidth={3} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              disabled={isLoading}
              onPress={handleSignup}
              style={({ pressed }) => [
                styles.submitButton,
                isLoading && styles.submitButtonDisabled,
                pressed && !isLoading && styles.pressed,
              ]}
            >
              <Text style={styles.submitText}>{isLoading ? '가입 중...' : 'Moni 시작하기'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  keyboardView: { flex: 1 },
  container: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 44,
  },
  backButton: {
    alignSelf: 'flex-start',
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  backText: { fontFamily: typography.fontFamily, fontSize: 12.5, fontWeight: '900', color: colors.text },
  brandArea: { alignItems: 'center', marginTop: 24, marginBottom: 22 },
  signupMascotWrap: { width: 176, height: 104, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  fixedMascotMotion: { width: '100%', height: '100%' },
  brand: { marginTop: 8, fontFamily: typography.fontFamily, fontSize: 11, fontWeight: '900', letterSpacing: 1.7, color: colors.butterDeep },
  title: { marginTop: 8, maxWidth: 430, textAlign: 'center', fontFamily: typography.fontFamily, fontSize: 25, lineHeight: 32, fontWeight: '900', letterSpacing: -0.7, color: colors.text },
  subtitle: { marginTop: 8, maxWidth: 420, textAlign: 'center', fontFamily: typography.fontFamily, fontSize: 13, lineHeight: 19, color: colors.subText },
  formCard: { borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 20 },
  sectionTitle: { marginTop: 4, marginBottom: 9, fontFamily: typography.fontFamily, fontSize: 13, fontWeight: '900', color: colors.text },
  field: { minHeight: 54, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14 },
  input: { flex: 1, minHeight: 52, fontFamily: typography.fontFamily, fontSize: 14, color: colors.text },
  suffix: { fontFamily: typography.fontFamily, fontSize: 12, fontWeight: '900', color: colors.subText },
  optionRow: { flexDirection: 'row', gap: 9, marginBottom: 15 },
  optionChip: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionChipSelected: { borderColor: colors.butterSoft, backgroundColor: colors.butterPale },
  optionText: { fontFamily: typography.fontFamily, fontSize: 13, fontWeight: '800', color: colors.subText },
  optionTextSelected: { color: colors.text, fontWeight: '900' },
  profileList: { gap: 8 },
  profileOption: { minHeight: 68, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileOptionSelected: { borderColor: colors.butterSoft, backgroundColor: colors.butterPale },
  profileIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  profileCopy: { flex: 1 },
  profileTitle: { fontFamily: typography.fontFamily, fontSize: 13.5, fontWeight: '900', color: colors.text },
  profileDescription: { marginTop: 3, fontFamily: typography.fontFamily, fontSize: 11, lineHeight: 16, color: colors.subText },
  checkCircle: { width: 26, height: 26, borderRadius: 999, backgroundColor: colors.butterStrong, alignItems: 'center', justifyContent: 'center' },
  submitButton: { height: 50, borderRadius: 15, backgroundColor: colors.butterStrong, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  submitButtonDisabled: { opacity: 0.6 },
  submitText: { fontFamily: typography.fontFamily, fontSize: 14, fontWeight: '900', color: colors.text },
  pressed: { opacity: 0.7 },
});
