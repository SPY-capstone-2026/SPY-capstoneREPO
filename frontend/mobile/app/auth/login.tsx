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

export default function LoginScreen() {
  const { showToast } = useToast();

  const [email, setEmail] = useState('demo@moni.app');
  const [password, setPassword] = useState('12345678');

  const handleLogin = () => {
    if (!email.trim()) {
      showToast('이메일을 입력해 주세요.');
      return;
    }

    if (!password.trim()) {
      showToast('비밀번호를 입력해 주세요.');
      return;
    }

    showToast('로그인되었습니다.');
    router.replace('/(tabs)/home');
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
              <View style={styles.logoLight} />
              <WalletCards size={38} color={colors.text} strokeWidth={2.8} />
            </View>

            <View style={styles.brandPill}>
              <Sparkles size={14} color={colors.butterBrown} strokeWidth={2.8} />
              <Text style={styles.brandPillText}>Moni</Text>
            </View>

            <Text style={styles.title}>소비 습관을 하루 미션으로 관리해요.</Text>
            <Text style={styles.subtitle}>
              지출 흐름을 확인하고, 오늘 실천할 작은 소비 목표를 추천받아보세요.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>로그인</Text>
            <Text style={styles.formDescription}>
              Moni와 함께 오늘의 소비 미션을 확인해 보세요.
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
              />
              <Eye size={18} color={colors.mutedText} strokeWidth={2.4} />
            </View>

            <AnimatedButton
              title="로그인하기"
              onPress={handleLogin}
              style={styles.loginButton}
            />

            <Pressable
              style={styles.signupLink}
              onPress={() => router.push('/auth/signup')}
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
    backgroundColor: 'rgba(255,255,255,0.68)',
  },
  backgroundOrbTiny: {
    position: 'absolute',
    bottom: 150,
    right: 32,
    width: 86,
    height: 86,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 240, 184, 0.52)',
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
    overflow: 'hidden',
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
  padding: 20,
  backgroundColor: 'rgba(255,255,255,0.30)',
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
inputBox: {
  height: 58,
  borderRadius: 22,
  paddingHorizontal: 15,
  backgroundColor: 'rgba(255,255,255,0.08)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.26)',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  marginBottom: 11,
},
signupLink: {
  marginTop: 14,
  minHeight: 52,
  borderRadius: 20,
  backgroundColor: 'rgba(255,247,214,0.18)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.26)',
  paddingHorizontal: 14,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},
brandPill: {
  paddingHorizontal: 12,
  paddingVertical: 7,
  borderRadius: 999,
  backgroundColor: 'rgba(255,255,255,0.18)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.28)',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  marginBottom: 14,
},
logoLight: {
  display: 'none',
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
    marginBottom: 18,
  },
  input: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 15,
    color: colors.text,
  },
  loginButton: {
    marginTop: 8,
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
  helperText: {
    marginTop: 16,
    textAlign: 'center',
    fontFamily: typography.fontFamily,
    fontSize: 12,
    color: colors.mutedText,
  },
});