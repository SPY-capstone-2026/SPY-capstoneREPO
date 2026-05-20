import { PropsWithChildren, useCallback, useRef } from 'react';
import {
  Animated,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';

import { colors } from '@/constants/colors';

type GlassCardProps = PropsWithChildren<{
  delay?: number;
  tone?: 'butter' | 'soft' | 'white';
  style?: StyleProp<ViewStyle>;
}>;

export function GlassCard({
  children,
  delay = 0,
  tone = 'white',
  style,
}: GlassCardProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useFocusEffect(
    useCallback(() => {
      opacity.setValue(0);
      translateY.setValue(12);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 360,
          delay,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 19,
          stiffness: 210,
          mass: 0.55,
          delay,
          useNativeDriver: true,
        }),
      ]).start();
    }, [delay, opacity, translateY])
  );

  const toneStyle =
    tone === 'butter'
      ? styles.butter
      : tone === 'soft'
        ? styles.soft
        : styles.white;

  return (
    <Animated.View
      style={[
        styles.shadowWrap,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <BlurView intensity={32} tint="light" style={[styles.card, toneStyle, style]}>
        {children}
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    marginBottom: 14,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  card: {
    overflow: 'hidden',
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
  },
  white: {
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  butter: {
    backgroundColor: 'rgba(255,248,216,0.42)',
  },
  soft: {
    backgroundColor: 'rgba(255,251,240,0.36)',
  },
});