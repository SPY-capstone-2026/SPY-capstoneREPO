import { router } from 'expo-router';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react-native';
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
import { getMeApi, loginApi } from '@/services/authApi';
import { deleteAccessToken } from '@/services/tokenStorage';

function getLoginErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return '이메일 또는 비밀번호를 확인해 주세요.';
    if (error.status === 422) return '입력한 로그인 정보 형식을 확인해 주세요.';
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
  const [passwordVisible, setPasswordVisible] = useState(false);

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
      await loginApi({ email: email.trim(), password });
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
          <View style={styles.brandArea}>
            <View style={styles.mascotWrap}>
              <WanderingMascot
                enabled={false}
                motionEnabled
                size={96}
                state="idle"
                style={styles.fixedMascotMotion}
              />
            </View>
            <Text style={styles.brand}>MONI</Text>
            <Text style={styles.title}>오늘의 소비를 가볍게 관리해요.</Text>
            <Text style={styles.subtitle}>
              지출을 기록하고, 예측에 맞춘 챌린지와 캐릭터 성장을 확인할 수 있어요.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>로그인</Text>
            <Text style={styles.formDescription}>계정 정보를 입력해 주세요.</Text>

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
                secureTextEntry={!passwordVisible}
                value={password}
                onChangeText={setPassword}
                editable={!isLoading}
                onSubmitEditing={handleLogin}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
                onPress={() => setPasswordVisible((value) => !value)}
                hitSlop={8}
              >
                {passwordVisible ? (
                  <EyeOff size={18} color={colors.mutedText} strokeWidth={2.3} />
                ) : (
                  <Eye size={18} color={colors.mutedText} strokeWidth={2.3} />
                )}
              </Pressable>
            </View>

            <Pressable
              disabled={isLoading}
              onPress={handleLogin}
              style={({ pressed }) => [
                styles.loginButton,
                pressed && styles.pressed,
                isLoading && styles.disabled,
              ]}
            >
              <Text style={styles.loginButtonText}>
                {isLoading ? '로그인 중...' : '로그인'}
              </Text>
            </Pressable>

            <Pressable
              disabled={isLoading}
              onPress={() => router.push('/auth/signup')}
              style={({ pressed }) => [styles.signupLink, pressed && styles.pressed]}
            >
              <Text style={styles.signupText}>처음이신가요?</Text>
              <View style={styles.signupRight}>
                <Text style={styles.signupStrong}>회원가입</Text>
                <ArrowRight size={15} color={colors.butterDeep} strokeWidth={2.6} />
              </View>
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
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 38,
  },
  brandArea: { alignItems: 'center', marginBottom: 28 },
  mascotWrap: {
    width: 190,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'visible',
  },
  fixedMascotMotion: { width: '100%', height: '100%' },
  brand: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: colors.butterDeep,
    marginBottom: 8,
  },
  title: {
    maxWidth: 350,
    textAlign: 'center',
    fontFamily: typography.fontFamily,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -0.8,
    color: colors.text,
  },
  subtitle: {
    maxWidth: 360,
    marginTop: 9,
    textAlign: 'center',
    fontFamily: typography.fontFamily,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.subText,
  },
  formCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    backgroundColor: colors.surface,
    padding: 20,
  },
  formTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 21,
    fontWeight: '900',
    color: colors.text,
  },
  formDescription: {
    marginTop: 4,
    marginBottom: 18,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: colors.subText,
  },
  field: {
    height: 54,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 14.5,
    color: colors.text,
  },
  loginButton: {
    height: 50,
    borderRadius: 15,
    backgroundColor: colors.butterStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  loginButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  signupLink: {
    minHeight: 48,
    marginTop: 9,
    paddingHorizontal: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  signupText: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    color: colors.subText,
  },
  signupRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  signupStrong: {
    fontFamily: typography.fontFamily,
    fontSize: 12.5,
    fontWeight: '900',
    color: colors.butterDeep,
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.6 },
});
