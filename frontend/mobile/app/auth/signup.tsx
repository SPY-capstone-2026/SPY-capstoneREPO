import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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
import {
  ArrowLeft,
  CalendarDays,
  Check,
  LockKeyhole,
  Mail,
  Sparkles,
  UserRound,
  WalletCards,
} from 'lucide-react-native';
import { useState } from 'react';

import { AnimatedButton } from '@/components/AnimatedButton';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { useToast } from '@/contexts/ToastContext';
import { ApiError } from '@/services/apiClient';
import { signupApi } from '@/services/authApi';
import { signupUser } from '@/services/authService';

const incomeOptions = [
  {
    label: '학생',
    value: 'STUDENT',
  },
  {
    label: '직장인',
    value: 'EMPLOYEE',
  },
];

const profileOptions = [
  {
    label: '안정형',
    value: 'STEADY',
    description: '소비가 비교적 일정해요',
  },
  {
    label: '즉흥 소비형',
    value: 'IMPULSIVE',
    description: '갑자기 쓰는 돈이 많아요',
  },
  {
    label: '주기 소비형',
    value: 'CYCLICAL',
    description: '특정 시기에 소비가 커져요',
  },
];

function getSignupErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return '이미 가입된 이메일입니다.';
    }

    if (error.status === 422) {
      return '입력한 회원가입 정보 형식을 확인해 주세요.';
    }

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
  const [incomeType, setIncomeType] = useState('STUDENT');
  const [payday, setPayday] = useState('25');
  const [spendProfile, setSpendProfile] = useState('IMPULSIVE');
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

    try {
      setIsLoading(true);

      const parsedPayday = Number(payday);

      if (!Number.isInteger(parsedPayday) || parsedPayday < 1 || parsedPayday > 31) {
        showToast('수입일은 1일부터 31일 사이로 입력해 주세요.');
        return;
      }

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
    <LinearGradient
      colors={['#FFF4C7', '#FFFBF0', '#FFFFFF']}
      style={styles.gradient}
    >
      <View style={styles.backgroundOrbLarge} />
      <View style={styles.backgroundOrbSmall} />
      <View style={styles.backgroundOrbTiny} />

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
            style={styles.backButton}
            onPress={() => {
              if (!isLoading) {
                router.push('/auth/login');
              }
            }}
          >
            <ArrowLeft size={18} color={colors.text} strokeWidth={2.8} />
            <Text style={styles.backButtonText}>로그인으로 돌아가기</Text>
          </Pressable>

          <View style={styles.heroCard}>
            <View style={styles.logoBubble}>
              <WalletCards size={34} color={colors.text} strokeWidth={2.8} />
            </View>

            <View style={styles.heroTextBox}>
              <View style={styles.brandPill}>
                <Sparkles
                  size={14}
                  color={colors.butterBrown}
                  strokeWidth={2.8}
                />
                <Text style={styles.brandPillText}>시작 설정</Text>
              </View>

              <Text style={styles.title}>
                나에게 맞는 소비 미션을 준비할게요.
              </Text>
              <Text style={styles.subtitle}>
                계정을 만든 뒤 Moni가 소비 흐름을 더 쉽게 보여줄 수 있도록
                기본 설정을 준비합니다.
              </Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>계정 정보</Text>

            <View style={styles.inputBox}>
              <Mail size={19} color={colors.butterBrown} strokeWidth={2.6} />
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

            <View style={styles.inputBox}>
              <LockKeyhole
                size={19}
                color={colors.butterBrown}
                strokeWidth={2.6}
              />
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
                const isSelected = incomeType === option.value;

                return (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.smallOption,
                      isSelected && styles.selectedSmallOption,
                    ]}
                    onPress={() => {
                      if (!isLoading) {
                        setIncomeType(option.value);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.smallOptionText,
                        isSelected && styles.selectedOptionText,
                      ]}
                    >
                      {option.label}
                    </Text>

                    {isSelected ? (
                      <Check size={15} color={colors.text} strokeWidth={3} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>수입일</Text>

            <View style={styles.inputBox}>
              <CalendarDays
                size={19}
                color={colors.butterBrown}
                strokeWidth={2.6}
              />
              <TextInput
                style={styles.input}
                placeholder="예: 25"
                placeholderTextColor={colors.mutedText}
                keyboardType="number-pad"
                value={payday}
                onChangeText={setPayday}
                editable={!isLoading}
              />
              <Text style={styles.inputSuffix}>일</Text>
            </View>

            <Text style={styles.sectionTitle}>소비 성향</Text>

            <View style={styles.profileOptionList}>
              {profileOptions.map((option) => {
                const isSelected = spendProfile === option.value;

                return (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.profileOption,
                      isSelected && styles.selectedProfileOption,
                    ]}
                    onPress={() => {
                      if (!isLoading) {
                        setSpendProfile(option.value);
                      }
                    }}
                  >
                    <View style={styles.profileOptionIcon}>
                      <UserRound
                        size={19}
                        color={colors.text}
                        strokeWidth={2.7}
                      />
                    </View>

                    <View style={styles.profileOptionTextBox}>
                      <Text style={styles.profileOptionTitle}>
                        {option.label}
                      </Text>
                      <Text style={styles.profileOptionDescription}>
                        {option.description}
                      </Text>
                    </View>

                    {isSelected ? (
                      <View style={styles.checkBubble}>
                        <Check size={15} color={colors.text} strokeWidth={3} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <AnimatedButton
              title={isLoading ? '가입 중...' : 'Moni 시작하기'}
              onPress={handleSignup}
              style={styles.submitButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  backgroundOrbLarge: {
    position: 'absolute',
    top: -94,
    right: -82,
    width: 250,
    height: 250,
    borderRadius: 999,
    backgroundColor: 'rgba(246, 212, 90, 0.34)',
  },
  backgroundOrbSmall: {
    position: 'absolute',
    top: 250,
    left: -70,
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.58)',
  },
  backgroundOrbTiny: {
    position: 'absolute',
    bottom: 150,
    right: 32,
    width: 86,
    height: 86,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 240, 184, 0.42)',
  },
  container: {
    flexGrow: 1,
    padding: 22,
    paddingTop: 56,
    paddingBottom: 40,
  },
  backButton: {
    alignSelf: 'flex-start',
    height: 42,
    borderRadius: 999,
    paddingHorizontal: 13,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 18,
  },
  backButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  heroCard: {
    borderRadius: 32,
    padding: 20,
    backgroundColor: 'rgba(255,248,216,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.46)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
    shadowColor: colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 22,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 5,
  },
  logoBubble: {
    width: 72,
    height: 72,
    borderRadius: 27,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 9,
    },
    elevation: 5,
  },
  heroTextBox: {
    flex: 1,
  },
  brandPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  brandPillText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    color: colors.butterBrown,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: colors.subText,
  },
  formCard: {
    borderRadius: 32,
    padding: 22,
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.46)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.09,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 4,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.2,
    marginBottom: 10,
    marginTop: 6,
  },
  inputBox: {
    height: 58,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(122,111,91,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 15,
    color: colors.text,
  },
  inputSuffix: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    color: colors.butterBrown,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  smallOption: {
    flex: 1,
    height: 52,
    borderRadius: 18,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedSmallOption: {
    backgroundColor: 'rgba(246,212,90,0.54)',
    borderColor: 'rgba(215,169,0,0.28)',
  },
  smallOptionText: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    color: colors.subText,
  },
  selectedOptionText: {
    color: colors.text,
  },
  profileOptionList: {
    gap: 10,
  },
  profileOption: {
    minHeight: 70,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedProfileOption: {
    backgroundColor: 'rgba(255,232,154,0.54)',
    borderColor: 'rgba(215,169,0,0.28)',
  },
  profileOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 17,
    backgroundColor: colors.butterPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileOptionTextBox: {
    flex: 1,
  },
  profileOptionTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
  },
  profileOptionDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    color: colors.subText,
  },
  checkBubble: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apiNotice: {
    marginTop: 12,
    fontFamily: typography.fontFamily,
    fontSize: 12,
    lineHeight: 18,
    color: colors.mutedText,
  },
  submitButton: {
    marginTop: 18,
  },
});