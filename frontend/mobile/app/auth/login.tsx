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
  ArrowRight,
  Eye,
  LockKeyhole,
  Mail,
  Sparkles,
  WalletCards,
} from 'lucide-react-native';
import { useState } from 'react';

import { AnimatedButton } from '@/components/AnimatedButton';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { useToast } from '@/contexts/ToastContext';
import { ApiError } from '@/services/apiClient';
import { getMeApi, loginApi } from '@/services/authApi';
import { deleteAccessToken } from '@/services/tokenStorage';

function getLoginErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return '이메일 또는 비밀번호를 확인해 주세요.';
    }

    if (error.status === 422) {
      return '입력한 로그인 정보 형식을 확인해 주세요.';
    }

    return error.message || '로그인에 실패했습니다.';
  }

  if (error instanceof TypeError) {
    return '서버에 연결할 수 없습니다. 네트워크 또는 CORS 설정을 확인해 주세요.';
  }

  return '로그인 중 문제가 발생했습니다.';
}

export default function LoginScreen() {
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
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

      await loginApi({
        email: email.trim(),
        password,
      });

      await getMeApi();

      showToast('로그인되었습니다.');
      router.replace('/(tabs)/home');
    } catch (error) {
      await deleteAccessToken();
      showToast(getLoginErrorMessage(error));
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
          <View style={styles.hero}>
            <View style={styles.logoBubble}>
              <WalletCards size={38} color={colors.text} strokeWidth={2.8} />
            </View>

            <View style={styles.brandPill}>
              <Sparkles size={14} color={colors.butterBrown} strokeWidth={2.8} />
              <Text style={styles.brandPillText}>Moni</Text>
            </View>

            <Text style={styles.title}>소비 습관을 하루 미션으로 관리해요.</Text>
            <Text style={styles.subtitle}>
              로그인하고 오늘의 소비 미션과 이번 달 예산 흐름을 확인해 보세요.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>로그인</Text>
            <Text style={styles.formDescription}>
              이메일과 비밀번호를 입력해 주세요.
            </Text>

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
              <Eye size={18} color={colors.mutedText} strokeWidth={2.4} />
            </View>

            <AnimatedButton
              title={isLoading ? '로그인 중...' : '로그인하기'}
              onPress={handleLogin}
              style={styles.loginButton}
            />

            <Pressable
              style={styles.signupLink}
              onPress={() => {
                if (!isLoading) {
                  router.push('/auth/signup');
                }
              }}
            >
              <Text style={styles.signupText}>처음이신가요?</Text>
              <View style={styles.signupRight}>
                <Text style={styles.signupStrong}>회원가입</Text>
                <ArrowRight
                  size={15}
                  color={colors.butterBrown}
                  strokeWidth={2.8}
                />
              </View>
            </Pressable>
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
    top: 230,
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
    paddingTop: 78,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBubble: {
    width: 92,
    height: 92,
    borderRadius: 34,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 7,
  },
  brandPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  brandPillText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '900',
    color: colors.butterBrown,
  },
  title: {
    maxWidth: 330,
    textAlign: 'center',
    fontFamily: typography.fontFamily,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -1,
    marginBottom: 11,
  },
  subtitle: {
    maxWidth: 310,
    textAlign: 'center',
    fontFamily: typography.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    color: colors.subText,
  },
  formCard: {
    borderRadius: 32,
    padding: 22,
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.46)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.10,
    shadowRadius: 22,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 5,
  },
  formTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  formDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    color: colors.subText,
    marginBottom: 16,
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
  loginButton: {
    marginTop: 12,
  },
  signupLink: {
    marginTop: 16,
    minHeight: 52,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122,111,91,0.14)',
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  signupText: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: colors.subText,
  },
  signupRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  signupStrong: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    color: colors.butterBrown,
  },
});