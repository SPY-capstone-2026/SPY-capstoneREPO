/**
 * 반투명 글래스모피즘 카드 컨테이너.
 * 마운트 시 fade-in + slide-up 애니메이션이 적용된다.
 * tone으로 배경 톤(default/soft/butter)을 조절한다.
 */

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, Easing, StyleSheet } from 'react-native';

import { colors } from '@/constants/colors';

type GlassCardProps = {
  children: ReactNode;
  delay?: number;
  tone?: 'default' | 'soft' | 'butter';
  style?: StyleProp<ViewStyle>;
};

export function GlassCard({
  children,
  delay = 0,
  tone = 'default',
  style,
}: GlassCardProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 420,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.card,
        tone === 'soft' && styles.softCard,
        tone === 'butter' && styles.butterCard,
        {
          opacity,
          transform: [{ translateY }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  softCard: {
    backgroundColor: colors.surfaceSoft,
  },
  butterCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
});