import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { getCurrentUser } from '@/services/authService';
import {
  deleteAccessToken,
  getAccessToken,
} from '@/services/tokenStorage';

const KEY_LABELS = ['M', 'O', 'N', 'I'] as const;

const KEY_TONES = [
  '#F2C84B',
  '#F7D978',
  '#E8B84C',
  '#F1D69B',
] as const;

export default function IndexScreen() {
  const [message, setMessage] = useState(
    '로그인 상태를 확인하고 있어요.'
  );

  const float = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );

    const progressLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1150,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 650,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    progressLoop.start();

    return () => {
      floatLoop.stop();
      progressLoop.stop();
    };
  }, [float, progress]);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const token = await getAccessToken();

        if (!token) {
          if (isMounted) {
            setMessage('로그인이 필요합니다.');
            router.replace('/auth/login');
          }
          return;
        }

        await getCurrentUser();

        if (isMounted) {
          setMessage('환영합니다.');
          router.replace('/(tabs)/home');
        }
      } catch {
        await deleteAccessToken();

        if (isMounted) {
          setMessage('다시 로그인해 주세요.');
          router.replace('/auth/login');
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const clusterTranslateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [2, -5],
  });

  const progressTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-56, 56],
  });

  const progressScaleX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.72, 1.16, 0.72],
  });

  return (
    <View style={styles.screen}>
      <View style={styles.topMetaRow}>
        <View style={styles.metaPill}>
          <Text style={styles.metaPillText}>MONI</Text>
        </View>

        <Text style={styles.metaText}>SMART SPENDING</Text>
      </View>

      <View style={styles.content}>
        <Animated.View
          style={[
            styles.keyCluster,
            {
              transform: [{ translateY: clusterTranslateY }],
            },
          ]}
        >
          {KEY_LABELS.map((label, index) => (
            <View
              key={label}
              style={[
                styles.keyShadow,
                index === 0 && styles.keyOne,
                index === 1 && styles.keyTwo,
                index === 2 && styles.keyThree,
                index === 3 && styles.keyFour,
              ]}
            >
              <View
                style={[
                  styles.keyFace,
                  { backgroundColor: KEY_TONES[index] },
                ]}
              >
                <Text style={styles.keyLetter}>{label}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        <View style={styles.copyBlock}>
          <Text style={styles.title}>MONI</Text>
          <Text style={styles.tagline}>
            오늘의 소비를{'\n'} 정리하는 중
          </Text>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusDot} />
            <Text style={styles.statusLabel}>CHECKING SESSION</Text>
          </View>

          <Text style={styles.description}>{message}</Text>

          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  transform: [
                    { translateX: progressTranslateX },
                    { scaleX: progressScaleX },
                  ],
                },
              ]}
            />
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerIndex}>01</Text>
        <View style={styles.footerLine} />
        <Text style={styles.footerText}>MONEY + HABIT</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F2E7',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  topMetaRow: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaPill: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  metaPillText: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: colors.backgroundWhite,
  },
  metaText: {
    fontFamily: typography.fontFamily,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: colors.text,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  keyCluster: {
    height: 238,
    marginBottom: 22,
    position: 'relative',
  },
  keyShadow: {
    position: 'absolute',
    width: 112,
    height: 88,
    borderRadius: 22,
    backgroundColor: '#8D641E',
    borderWidth: 2,
    borderColor: colors.border,
  },
  keyFace: {
    width: '100%',
    height: 78,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -8 }],
  },
  keyLetter: {
    fontFamily: typography.fontFamily,
    fontSize: 43,
    lineHeight: 48,
    fontWeight: '900',
    letterSpacing: -2.2,
    color: colors.text,
  },
  keyOne: {
    left: '7%',
    top: 20,
    transform: [{ rotate: '-8deg' }],
  },
  keyTwo: {
    right: '8%',
    top: 0,
    transform: [{ rotate: '9deg' }],
  },
  keyThree: {
    left: '20%',
    bottom: 5,
    transform: [{ rotate: '7deg' }],
  },
  keyFour: {
    right: '15%',
    bottom: 18,
    transform: [{ rotate: '-7deg' }],
  },
  copyBlock: {
    marginBottom: 22,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: 52,
    lineHeight: 56,
    fontWeight: '900',
    letterSpacing: -3.2,
    color: colors.text,
  },
  tagline: {
    marginTop: 5,
    fontFamily: typography.fontFamily,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.7,
    color: colors.text,
  },
  statusCard: {
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 18,
    paddingVertical: 17,
    shadowColor: colors.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 0,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.butterStrong,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  statusLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: colors.subText,
  },
  description: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    color: colors.text,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginTop: 14,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressBar: {
    width: 84,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.butterStrong,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignSelf: 'center',
  },
  footer: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerIndex: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '900',
    color: colors.text,
  },
  footerLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.text,
  },
  footerText: {
    fontFamily: typography.fontFamily,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.9,
    color: colors.text,
  },
});
